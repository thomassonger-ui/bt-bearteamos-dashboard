import { getSupabase } from '@/lib/supabase'
import { logActivity } from '@/lib/queries'

// ─── FORCE TASK ───────────────────────────────────────────────────────────────
// Insert a broker-assigned intervention task for the agent who owns this lead.

export async function forceTask(leadId: string, title: string): Promise<void> {
  // Resolve agent_id from pipeline row
  const { data: lead, error: leadErr } = await getSupabase()
    .from('pipeline')
    .select('agent_id')
    .eq('id', leadId)
    .single()

  if (leadErr || !lead) {
    console.error('[actions] forceTask — lead not found:', leadErr?.message)
    return
  }

  const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error } = await getSupabase().from('tasks').insert({
    agent_id: lead.agent_id,
    type: 'intervention',
    title,
    description: 'Broker-assigned intervention task.',
    status: 'pending',
    due_date: due,
    created_at: new Date().toISOString(),
  } as any)

  if (error) {
    console.error('[actions] forceTask insert failed:', error.message)
    return
  }

  await logAction(lead.agent_id, `Force task created: "${title}"`)
}

// ─── ADVANCE STAGE ────────────────────────────────────────────────────────────
// Update the pipeline stage for a lead and log the broker action.

export async function advanceStage(leadId: string, stage: string): Promise<void> {
  const { data: lead, error: leadErr } = await getSupabase()
    .from('pipeline')
    .select('agent_id')
    .eq('id', leadId)
    .single()

  if (leadErr || !lead) {
    console.error('[actions] advanceStage — lead not found:', leadErr?.message)
    return
  }

  const { error } = await getSupabase()
    .from('pipeline')
    .update({ stage, last_contact: new Date().toISOString() })
    .eq('id', leadId)

  if (error) {
    console.error('[actions] advanceStage update failed:', error.message)
    return
  }

  await logAction(lead.agent_id, `Lead stage advanced to "${stage}" by broker`)
}

// ─── TRIGGER FOLLOW-UP ────────────────────────────────────────────────────────
// Insert an immediate follow-up task for the agent who owns this lead.

export async function triggerFollowUp(leadId: string): Promise<void> {
  const { data: lead, error: leadErr } = await getSupabase()
    .from('pipeline')
    .select('agent_id, lead_name')
    .eq('id', leadId)
    .single()

  if (leadErr || !lead) {
    console.error('[actions] triggerFollowUp — lead not found:', leadErr?.message)
    return
  }

  const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error } = await getSupabase().from('tasks').insert({
    agent_id: lead.agent_id,
    type: 'intervention',
    title: `Follow up immediately — broker triggered`,
    description: `Broker requested immediate follow-up for lead: ${lead.lead_name ?? leadId}`,
    status: 'pending',
    due_date: due,
    created_at: new Date().toISOString(),
  } as any)

  if (error) {
    console.error('[actions] triggerFollowUp insert failed:', error.message)
    return
  }

  await logAction(lead.agent_id, `Follow-up triggered by broker for lead: ${lead.lead_name ?? leadId}`)
}

// ─── INTERNAL LOG HELPER ──────────────────────────────────────────────────────

async function logAction(agentId: string, description: string): Promise<void> {
  await logActivity({
    agent_id: agentId,
    action_type: 'broker_action',
    description,
    outcome: 'neutral',
  })
}
