import type { Task } from '@/types'
import {
  getLastActivityTime,
  getStalePipelineLeads,
  createTask,
  markOverdueTasks,
  logActivity,
  updateAgentLastActive,
  ruleTaskExists,
  countPendingOnboardingTasks,
  deduplicateTasks,
} from './queries'

// ─── MAIN ENGINE ENTRY POINT ─────────────────────────────────────────────────
// Called on: dashboard load, login
// Runs all 4 rules in order — fully idempotent via source_rule + source_ref

export async function runEngine(agentId: string): Promise<void> {
  // 0. Safety pass: remove any exact duplicate pending tasks (same title)
  await deduplicateTasks(agentId)

  // 0b. Mark overdue (pending tasks past due_date)
  await markOverdueTasks(agentId)

  const now = new Date()

  // ── RULE 1: Inactivity Recovery ──────────────────────────────────────────
  // Trigger: no activity_log entry in last 24 hours
  // Idempotency: source_rule='inactivity', source_ref=today's date (YYYY-MM-DD)
  const lastActivity = await getLastActivityTime(agentId)
  const hoursInactive = lastActivity
    ? (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)
    : 999

  if (hoursInactive >= 24) {
    const todayKey = now.toISOString().slice(0, 10) // YYYY-MM-DD
    const exists = await ruleTaskExists(agentId, 'inactivity', todayKey)
    if (!exists) {
      await createTask({
        agent_id: agentId,
        type: 'recovery',
        title: 'Complete 10 follow-ups today',
        description: `No system activity in ${Math.floor(hoursInactive)}h. Recovery required before pipeline work.`,
        status: 'pending',
        due_date: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        source_rule: 'inactivity',
        source_ref: todayKey,
      })
      await logActivity({
        agent_id: agentId,
        action_type: 'engine_rule_triggered',
        description: `Rule 1: Inactivity recovery task created (${Math.floor(hoursInactive)}h gap)`,
        outcome: 'neutral',
      })
    }
  }

  // ── RULE 2: Pipeline Stall ────────────────────────────────────────────────
  // Trigger: pipeline.last_contact > 3 days
  // Idempotency: source_rule='pipeline_stall', source_ref=lead.id (per lead)
  const staleLeads = await getStalePipelineLeads(agentId, 3)
  let rule2Created = 0

  for (const lead of staleLeads) {
    const exists = await ruleTaskExists(agentId, 'pipeline_stall', lead.id)
    if (!exists) {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contact).getTime()) / (1000 * 60 * 60 * 24)
      )
      await createTask({
        agent_id: agentId,
        type: 'follow_up',
        title: `Follow up with ${lead.lead_name}`,
        description: `No contact in ${daysSince} days. Stage: ${lead.stage}. Action required today.`,
        status: 'pending',
        due_date: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        source_rule: 'pipeline_stall',
        source_ref: lead.id,
      })
      rule2Created++
    }
  }

  if (rule2Created > 0) {
    await logActivity({
      agent_id: agentId,
      action_type: 'engine_rule_triggered',
      description: `Rule 2: ${rule2Created} stale pipeline lead(s) — follow-up task(s) created`,
      outcome: 'neutral',
    })
  }

  // ── RULE 3: Onboarding Enforcement ───────────────────────────────────────
  // Trigger: onboarding_stage < 30
  // Idempotency: source_rule='onboarding', source_ref=title_slug — counted via countPendingOnboardingTasks
  const { supabase } = await import('./supabase')
  const { data: agentRow } = await supabase
    .from('agents')
    .select('onboarding_stage')
    .eq('id', agentId)
    .single()

  const onboardingDay: number = agentRow?.onboarding_stage ?? 0

  if (onboardingDay < 30) {
    const ONBOARDING_TASKS = [
      { title: 'Review BearTeam Standards & Practices', slug: 'review-standards' },
      { title: 'Schedule 1:1 with Tom Songer', slug: 'schedule-1on1' },
      { title: 'Complete MLS profile setup', slug: 'mls-profile' },
      { title: 'Log first 3 lead contacts in pipeline', slug: 'log-leads' },
      { title: 'Complete BearTeam Academy Week 1 module', slug: 'academy-week1' },
    ]

    const pendingCount = await countPendingOnboardingTasks(agentId)
    const needed = 5 - pendingCount
    let rule3Created = 0

    if (needed > 0) {
      for (const t of ONBOARDING_TASKS) {
        if (rule3Created >= needed) break
        const exists = await ruleTaskExists(agentId, 'onboarding', t.slug)
        if (!exists) {
          await createTask({
            agent_id: agentId,
            type: 'onboarding',
            title: t.title,
            description: `Onboarding requirement (Day ${onboardingDay}). Must be completed in Foundation phase.`,
            status: 'pending',
            due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
            source_rule: 'onboarding',
            source_ref: t.slug,
          })
          rule3Created++
        }
      }
      if (rule3Created > 0) {
        await logActivity({
          agent_id: agentId,
          action_type: 'engine_rule_triggered',
          description: `Rule 3: Onboarding enforcement — ${rule3Created} task(s) added to meet minimum 5`,
          outcome: 'neutral',
        })
      }
    }
  }

  // ── RULE 4: Missed Task Pressure ─────────────────────────────────────────
  // Trigger: task.status = 'missed'
  // Idempotency: source_rule='retry', source_ref=original_task.id
  const { data: missedRows } = await supabase
    .from('tasks')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'missed')

  const missedTasks = (missedRows ?? []) as Task[]
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  let rule4Created = 0

  for (const missed of missedTasks) {
    const exists = await ruleTaskExists(agentId, 'retry', missed.id)
    if (!exists) {
      await createTask({
        agent_id: agentId,
        type: missed.type,
        title: `[Retry] ${missed.title}`,
        description: `Missed yesterday. This must be completed today. ${missed.description}`,
        status: 'pending',
        due_date: tomorrow,
        source_rule: 'retry',
        source_ref: missed.id,
      })
      rule4Created++
    }
  }

  if (rule4Created > 0) {
    await logActivity({
      agent_id: agentId,
      action_type: 'engine_rule_triggered',
      description: `Rule 4: ${rule4Created} missed task(s) — replacement task(s) created`,
      outcome: 'neutral',
    })
  }

  // Final: update agent last_active timestamp
  await updateAgentLastActive(agentId)
}

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────────

export function prioritizeTasks(tasks: Task[]): Task[] {
  const order: Record<string, number> = {
    overdue: 0,
    pending: 1,
    completed: 2,
    missed: 3,
  }
  return [...tasks].sort((a, b) => {
    const statusDiff = order[a.status] - order[b.status]
    if (statusDiff !== 0) return statusDiff
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })
}

export function getPhaseLabel(onboardingDay: number): string {
  if (onboardingDay < 30) return `Foundation Phase (Day ${onboardingDay}) — High Enforcement`
  if (onboardingDay < 60) return `Pipeline Phase (Day ${onboardingDay}) — Building Momentum`
  if (onboardingDay < 90) return `Production Phase (Day ${onboardingDay}) — Scaling Output`
  return 'Active Agent'
}

export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
