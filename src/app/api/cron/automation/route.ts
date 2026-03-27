import { getAllPipeline, createTask, ruleTaskExists, logActivity } from '@/lib/queries'
import type { Pipeline } from '@/types'

// ─── LOGGING HELPER ───────────────────────────────────────────────────────────

function logEvent(label: string, data?: unknown) {
  console.log(`[${label}]`, data ?? '')
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DEFAULT_AGENT_ID = 'e53282c8-8b69-437d-9c32-503b5e87b7f0'

const HOUR = 1000 * 60 * 60

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function hoursSince(ts: string | null | undefined): number {
  if (!ts) return Infinity
  return (Date.now() - new Date(ts).getTime()) / HOUR
}

function lastInteraction(lead: Pipeline): string | null | undefined {
  return lead.scout_last_interaction ?? lead.last_contact ?? undefined
}

function agentId(lead: Pipeline): string {
  return lead.agent_id ?? DEFAULT_AGENT_ID
}

// ─── RULE RUNNER ──────────────────────────────────────────────────────────────

interface RuleResult {
  rule: string
  leadId: string
  acted: boolean
}

async function runRule(
  lead: Pipeline,
  sourceRule: string,
  title: string,
  description: string,
): Promise<RuleResult> {
  const aid = agentId(lead)
  const due = new Date(Date.now() + 24 * HOUR).toISOString()
  const today = new Date().toISOString().slice(0, 10)
  // source_ref = leadId + date — one task per lead per rule per day
  const sourceRef = `${lead.id}:${today}`

  const exists = await ruleTaskExists(aid, sourceRule, sourceRef)
  if (exists) return { rule: sourceRule, leadId: lead.id, acted: false }

  await createTask({
    agent_id: aid,
    type: 'intervention',
    title,
    description,
    status: 'pending',
    due_date: due,
    source_rule: sourceRule,
    source_ref: sourceRef,
  })

  await logActivity({
    agent_id: aid,
    action_type: 'automation_trigger',
    description: `[${sourceRule}] ${title} — lead: ${lead.id}`,
    outcome: 'neutral',
  })

  return { rule: sourceRule, leadId: lead.id, acted: true }
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // ── Cron safety — block manual calls in production ──────────────────────────
  const isCron = req.headers.get('user-agent')?.includes('vercel-cron')
  if (!isCron && process.env.NODE_ENV === 'production') {
    logEvent('cron_blocked', { reason: 'non-cron caller in production' })
    return new Response('forbidden', { status: 403 })
  }

  try {
  logEvent('cron_start', { time: new Date().toISOString() })

  const leads = await getAllPipeline()

  const results: RuleResult[] = []

  for (const lead of leads) {
    const hours = hoursSince(lastInteraction(lead))
    const score = lead.engagement_score ?? 0

    // RULE 1 — Cold Lead: inactive > 48h, not yet qualified
    if (hours > 48 && lead.stage !== 'qualified') {
      const r = await runRule(
        lead,
        'auto_cold_lead',
        'Follow up — system re-engagement',
        `Lead has been inactive for ${Math.floor(hours)}h. Automated re-engagement trigger.`,
      )
      results.push(r)
    }

    // RULE 2 — High Value Not Closed: score ≥ 70, not qualified
    if (score >= 70 && lead.stage !== 'qualified') {
      const r = await runRule(
        lead,
        'auto_high_value',
        'High priority lead — close now',
        `Lead engagement score is ${score}/100. Broker action required to close.`,
      )
      results.push(r)
    }

    // RULE 3 — Stale Engaged: stage=engaged, inactive > 72h
    if (lead.stage === 'engaged' && hours > 72) {
      const r = await runRule(
        lead,
        'auto_stale_engaged',
        'Engaged lead at risk — immediate follow-up',
        `Lead reached engaged stage but has been inactive for ${Math.floor(hours)}h.`,
      )
      results.push(r)
    }
  }

  const acted = results.filter((r) => r.acted)
  const skipped = results.filter((r) => !r.acted)

  logEvent('cron_complete', {
    processed: leads.length,
    tasks_created: acted.length,
    duplicates_skipped: skipped.length,
  })

  return Response.json({
    ok: true,
    processed: leads.length,
    tasks_created: acted.length,
    duplicates_skipped: skipped.length,
    actions: acted,
  })

  } catch (err) {
    logEvent('cron_error', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 })
  }
}
