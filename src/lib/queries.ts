import { getSupabase } from './supabase'
import type { Agent, Task, ActivityLog, Pipeline, ComplianceRecord, HotLeadSource, RecruitLead } from '@/types'

// ─── AGENT ────────────────────────────────────────────────────────────────────

export async function getAgent(agentId: string): Promise<Agent | null> {
  const { data, error } = await getSupabase()
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single()
  if (error) { console.error('getAgent:', error.message); return null }
  return data as Agent
}

export async function getFirstAgent(): Promise<Agent | null> {
  const { data, error } = await getSupabase()
    .from('agents')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  if (error) { console.error('getFirstAgent:', error.message); return null }
  return data as Agent
}

export async function getAgentByUsername(username: string): Promise<Agent | null> {
  const { data, error } = await getSupabase()
    .from('agents')
    .select('*')
    .eq('username', username.toLowerCase().trim())
    .single()
  if (error) { console.error('getAgentByUsername:', error.message); return null }
  return data as Agent
}

export async function getAgentByEmail(email: string): Promise<Agent | null> {
  const { data, error } = await getSupabase()
    .from('agents')
    .select('*')
    .ilike('email', email)
    .single()
  if (error) { console.error('getAgentByEmail:', error.message); return null }
  return data as Agent | null
}


export async function updateAgentLastActive(agentId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('agents')
    .update({ last_active: new Date().toISOString() })
    .eq('id', agentId)
  if (error) console.error('updateAgentLastActive:', error.message)
}

/**
 * Persist performance_score and last_score_update to DB.
 * Called by engine once per run after score calculation.
 */
export async function updateAgentScore(
  agentId: string,
  score: number
): Promise<void> {
  const { error } = await getSupabase()
    .from('agents')
    .update({ performance_score: score, last_score_update: new Date().toISOString() })
    .eq('id', agentId)
  if (error) console.error('updateAgentScore:', error.message)
}

/**
 * Persist inactivity_streak and missed_streak back to DB.
 * Called by engine after calculating streak values each run.
 */
export async function updateAgentStreaks(
  agentId: string,
  inactivityStreak: number,
  missedStreak: number
): Promise<void> {
  const { error } = await getSupabase()
    .from('agents')
    .update({ inactivity_streak: inactivityStreak, missed_streak: missedStreak })
    .eq('id', agentId)
  if (error) console.error('updateAgentStreaks:', error.message)
}

// ─── TASKS ────────────────────────────────────────────────────────────────────

export async function getTasks(agentId: string): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .eq('agent_id', agentId)
    .order('due_date', { ascending: true })
  if (error) { console.error('getTasks:', error.message); return [] }
  return (data ?? []) as Task[]
}

export async function createTask(task: Omit<Task, 'id' | 'created_at'>): Promise<Task | null> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .insert(task as any)
    .select()
    .single()
  // 23505 = unique_violation — expected when idempotency constraint fires, not an error
  if (error) {
    if (error.code === '23505') return null // duplicate blocked by DB constraint — silent
    console.error('createTask:', error.message)
    return null
  }
  return data as Task
}

/**
 * Check if a rule-generated task already exists (active or completed).
 * Used by engine for idempotency before attempting insert.
 */
export async function ruleTaskExists(
  agentId: string,
  sourceRule: string,
  sourceRef: string
): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('id')
    .eq('agent_id', agentId)
    .eq('source_rule', sourceRule)
    .eq('source_ref', sourceRef)
    .limit(1)
  if (error) { console.error('ruleTaskExists:', error.message); return false }
  return (data?.length ?? 0) > 0
}

/**
 * Count pending onboarding tasks for Rule 3.
 */
export async function countPendingOnboardingTasks(agentId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('id')
    .eq('agent_id', agentId)
    .eq('source_rule', 'onboarding')
    .in('status', ['pending', 'overdue'])
  if (error) { console.error('countPendingOnboardingTasks:', error.message); return 0 }
  return data?.length ?? 0
}

/**
 * Delete exact duplicate tasks (same agent_id + title + status = pending),
 * keeping the earliest created_at. Safety pass at engine start.
 */
export async function deduplicateTasks(agentId: string): Promise<void> {
  // Fetch all pending/overdue tasks for this agent
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('id, title, status, created_at')
    .eq('agent_id', agentId)
    .in('status', ['pending', 'overdue'])
    .order('created_at', { ascending: true })
  if (error || !data) return

  // Group by title — keep first, delete rest
  const seen = new Map<string, string>() // title → id to keep
  const toDelete: string[] = []
  for (const row of data) {
    if (seen.has(row.title)) {
      toDelete.push(row.id)
    } else {
      seen.set(row.title, row.id)
    }
  }

  if (toDelete.length > 0) {
    await getSupabase().from('tasks').delete().in('id', toDelete)
    console.log(`[engine] Deduplication: removed ${toDelete.length} duplicate task(s)`)
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: Task['status'],
  completedAt?: string
): Promise<void> {
  const update: Partial<Task> = { status }
  if (completedAt) update.completed_at = completedAt
  const { error } = await getSupabase()
    .from('tasks')
    .update(update)
    .eq('id', taskId)
  if (error) console.error('updateTaskStatus:', error.message)
}

export async function markOverdueTasks(agentId: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await getSupabase()
    .from('tasks')
    .update({ status: 'overdue' })
    .eq('agent_id', agentId)
    .eq('status', 'pending')
    .lt('due_date', now)
  if (error) console.error('markOverdueTasks:', error.message)
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────

export async function getActivityLog(agentId: string, limit = 50): Promise<ActivityLog[]> {
  const { data, error } = await getSupabase()
    .from('activity_log')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('getActivityLog:', error.message); return [] }
  return (data ?? []) as ActivityLog[]
}

export async function logActivity(entry: Omit<ActivityLog, 'id' | 'created_at'>): Promise<void> {
  const { error } = await getSupabase().from('activity_log').insert(entry as any)
  if (error) console.error('logActivity:', error.message)
}

export async function getLastActivityTime(agentId: string): Promise<Date | null> {
  const { data, error } = await getSupabase()
    .from('activity_log')
    .select('created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) return null
  return new Date(data.created_at)
}

// ─── PIPELINE ─────────────────────────────────────────────────────────────────

export async function getPipeline(agentId: string): Promise<Pipeline[]> {
  const { data, error } = await getSupabase()
    .from('pipeline')
    .select('*')
    .eq('agent_id', agentId)
    .or('is_hot_lead.is.null,is_hot_lead.eq.false')
    .order('last_contact', { ascending: true })
  if (error) { console.error('getPipeline:', error.message); return [] }
  return (data ?? []) as Pipeline[]
}

export async function updateLastContact(pipelineId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('pipeline')
    .update({ last_contact: new Date().toISOString() })
    .eq('id', pipelineId)
  if (error) console.error('updateLastContact:', error.message)
}

export async function updatePipelineLead(pipelineId: string, data: Record<string, string>): Promise<void> {
  const { error } = await getSupabase()
    .from('pipeline')
    .update(data)
    .eq('id', pipelineId)
  if (error) console.error('updatePipelineLead:', error.message)
}

export async function updatePipelineStage(pipelineId: string, stage: string): Promise<void> {
  const { error } = await getSupabase()
    .from('pipeline')
    .update({ stage })
    .eq('id', pipelineId)
  if (error) console.error('updatePipelineStage:', error.message)
}

export async function getStalePipelineLeads(agentId: string, daysStale = 3): Promise<Pipeline[]> {
  const cutoff = new Date(Date.now() - daysStale * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await getSupabase()
    .from('pipeline')
    .select('*')
    .eq('agent_id', agentId)
    .lt('last_contact', cutoff)
    .not('stage', 'eq', 'closed')
  if (error) { console.error('getStalePipelineLeads:', error.message); return [] }
  return (data ?? []) as Pipeline[]
}

// ─── COMPLIANCE ───────────────────────────────────────────────────────────────

export async function getCompliance(agentId: string): Promise<ComplianceRecord[]> {
  const { data, error } = await getSupabase()
    .from('compliance')
    .select('*')
    .eq('agent_id', agentId)
    .order('updated_at', { ascending: true })
  if (error) { console.error('getCompliance:', error.message); return [] }
  return (data ?? []) as ComplianceRecord[]
}

export async function updateComplianceStatus(
  complianceId: string,
  status: 'pending' | 'completed'
): Promise<void> {
  const update: Partial<ComplianceRecord> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'completed') update.completed_at = new Date().toISOString()
  const { error } = await getSupabase()
    .from('compliance')
    .update(update)
    .eq('id', complianceId)
  if (error) console.error('updateComplianceStatus:', error.message)
}

// ─── BROKER QUERIES ───────────────────────────────────────────────────────────

/** All agents — broker view */
export async function getAllAgents(): Promise<Agent[]> {
  const { data, error } = await getSupabase()
    .from('agents')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) { console.error('getAllAgents:', error.message); return [] }
  return (data ?? []) as Agent[]
}

/** All tasks across all agents, or for a specific agent */
export async function getAllTasks(agentId?: string): Promise<Task[]> {
  let query = getSupabase().from('tasks').select('*')
  if (agentId) query = query.eq('agent_id', agentId)
  const { data, error } = await query.order('due_date', { ascending: true })
  if (error) { console.error('getAllTasks:', error.message); return [] }
  return (data ?? []) as Task[]
}

/** All compliance records across all agents, or for a specific agent */
export async function getAllCompliance(agentId?: string): Promise<ComplianceRecord[]> {
  let query = getSupabase().from('compliance').select('*')
  if (agentId) query = query.eq('agent_id', agentId)
  const { data, error } = await query.order('updated_at', { ascending: true })
  if (error) { console.error('getAllCompliance:', error.message); return [] }
  return (data ?? []) as ComplianceRecord[]
}

/** All pipeline records across all agents, or for a specific agent */
export async function getAllPipeline(agentId?: string): Promise<Pipeline[]> {
  let query = getSupabase().from('pipeline').select('*')
  if (agentId) query = query.eq('agent_id', agentId)
  const { data, error } = await query.order('last_contact', { ascending: true })
  if (error) { console.error('getAllPipeline:', error.message); return [] }
  return (data ?? []) as Pipeline[]
}

/** Reset all missed tasks for an agent back to pending */
export async function resetMissedTasks(agentId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('tasks')
    .update({ status: 'pending', completed_at: null })
    .eq('agent_id', agentId)
    .eq('status', 'missed')
  if (error) console.error('resetMissedTasks:', error.message)
}

// ─── RECRUITING ──────────────────────────────────────────────────────────────

export async function getRecruitLeads(): Promise<RecruitLead[]> {
  const { data, error } = await getSupabase()
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('getRecruitLeads:', error.message); return [] }
  return (data ?? []) as RecruitLead[]
}

export async function updateRecruitStage(leadId: string, stage: string): Promise<void> {
  const { error } = await getSupabase()
    .from('leads')
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('id', leadId)
  if (error) console.error('updateRecruitStage:', error.message)
}

export async function convertRecruitToAgent(lead: RecruitLead, username: string, role: string): Promise<Agent | null> {
  const { data, error } = await getSupabase()
    .from('agents')
    .insert({
      name: lead.name,
      email: lead.email,
      phone: lead.phone || null,
      username,
      stage: 'Onboarding',
      onboarding_stage: 0,
      last_active: new Date().toISOString(),
      inactivity_streak: 0,
      missed_streak: 0,
      performance_score: 0,
      start_date: new Date().toISOString(),
      role,
    } as any)
    .select()
    .single()
  if (error) { console.error('convertRecruitToAgent:', error.message); return null }

  // Mark lead as converted
  await getSupabase()
    .from('leads')
    .update({ stage: 'closed_won', onboarded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', lead.id)

  return data as Agent
}

// ─── COMMISSIONS ─────────────────────────────────────────────────────────────

export async function getClosedDeals(agentId: string): Promise<Pipeline[]> {
  const { data, error } = await getSupabase()
    .from('pipeline')
    .select('*')
    .eq('agent_id', agentId)
    .eq('stage', 'closed')
    .order('closed_date', { ascending: true })
  if (error) { console.error('getClosedDeals:', error.message); return [] }
  return (data ?? []) as Pipeline[]
}

export async function getAllClosedDeals(): Promise<Pipeline[]> {
  const { data, error } = await getSupabase()
    .from('pipeline')
    .select('*')
    .eq('stage', 'closed')
    .order('closed_date', { ascending: true })
  if (error) { console.error('getAllClosedDeals:', error.message); return [] }
  return (data ?? []) as Pipeline[]
}

// ─── HOT LEADS ───────────────────────────────────────────────────────────────

export async function getHotLeads(filters?: {
  source?: string
  urgency?: string
  type?: string
  zip?: string
}): Promise<Pipeline[]> {
  let query = getSupabase()
    .from('pipeline')
    .select('*')
    .eq('is_hot_lead', true)
    .order('created_at', { ascending: false })

  if (filters?.source) query = query.eq('lead_source', filters.source)
  if (filters?.urgency) query = query.eq('urgency', filters.urgency)
  if (filters?.type) query = query.eq('hot_lead_type', filters.type)
  if (filters?.zip) query = query.eq('zip_code', filters.zip)

  const { data, error } = await query
  if (error) { console.error('getHotLeads:', error.message); return [] }
  return (data ?? []) as Pipeline[]
}

export async function insertHotLead(lead: Omit<Pipeline, 'id' | 'created_at'>): Promise<Pipeline | null> {
  const { data, error } = await getSupabase()
    .from('pipeline')
    .insert(lead as any)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return null
    console.error('insertHotLead:', error.message)
    return null
  }
  return data as Pipeline
}

export async function upsertHotLead(lead: Omit<Pipeline, 'id' | 'created_at'>): Promise<Pipeline | null> {
  if (lead.source_id) {
    const { data: existing } = await getSupabase()
      .from('pipeline')
      .select('id')
      .eq('source_id', lead.source_id)
      .limit(1)
    if (existing && existing.length > 0) return null
  }
  return insertHotLead(lead)
}

export async function assignHotLead(pipelineId: string, agentId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('pipeline')
    .update({ agent_id: agentId, stage: 'new_lead' })
    .eq('id', pipelineId)
  if (error) console.error('assignHotLead:', error.message)
}

export async function getCRMContacts(agentId: string): Promise<Pipeline[]> {
  const { data, error } = await getSupabase()
    .from('pipeline')
    .select('*')
    .eq('agent_id', agentId)
    .eq('in_crm', true)
    .or('is_hot_lead.is.null,is_hot_lead.eq.false')
    .order('lead_name', { ascending: true })
  if (error) { console.error('getCRMContacts:', error.message); return [] }
  return (data ?? []) as Pipeline[]
}

export async function addToCRM(pipelineId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('pipeline')
    .update({ in_crm: true })
    .eq('id', pipelineId)
  if (error) console.error('addToCRM:', error.message)
}


export async function getHotLeadSources(): Promise<HotLeadSource[]> {
  const { data, error } = await getSupabase()
    .from('hot_lead_sources')
    .select('*')
    .order('source_name')
  if (error) { console.error('getHotLeadSources:', error.message); return [] }
  return (data ?? []) as HotLeadSource[]
}

export async function updateHotLeadSourceStatus(
  sourceName: string,
  status: string,
  leadsFound: number
): Promise<void> {
  const { error } = await getSupabase()
    .from('hot_lead_sources')
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: status,
      leads_found: leadsFound,
      updated_at: new Date().toISOString(),
    })
    .eq('source_name', sourceName)
  if (error) console.error('updateHotLeadSourceStatus:', error.message)
}

// ─── CAMPAIGN PIPELINE QUERIES ───────────────────────────────────────────────
// Used by /api/leads/upload and /api/campaigns/send-step

import type { Lead } from "@/types"

export async function insertBatch(
  batchId: string,
  totalRows: number,
  skipped: unknown[]
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from("campaign_batches")
    .insert({ batch_id: batchId, total_rows: totalRows, skipped })
  if (error) throw new Error(error.message)
}

export async function insertLeads(leads: Lead[]): Promise<void> {
  if (leads.length === 0) return
  const supabase = getSupabase()
  const rows = leads.map((l) => ({
    id: l.id,
    batch_id: l.batchId,
    name: l.name,
    email: l.email,
    brokerage: l.brokerage ?? null,
    status: l.status,
    current_step: l.currentStep,
    last_contacted_at: l.lastContactedAt,
    created_at: l.createdAt,
  }))
  const { error } = await supabase
    .from("campaign_leads")
    .upsert(rows, { onConflict: "email,batch_id", ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

export async function getEligibleLeads(
  batchId: string,
  step: number
): Promise<Lead[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("campaign_leads")
    .select("*")
    .eq("batch_id", batchId)
    .eq("current_step", step - 1)
    .neq("status", "paused")
    .neq("status", "unsubscribed")
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToLead)
}

export async function updateLeadAfterSend(
  id: string,
  step: number,
  sentAt: string
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from("campaign_leads")
    .update({ current_step: step, last_contacted_at: sentAt, status: "contacted" })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function updateLeadStatus(
  id: string,
  status: Lead["status"]
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from("campaign_leads")
    .update({ status })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    brokerage: (row.brokerage as string) ?? undefined,
    batchId: row.batch_id as string,
    status: row.status as Lead["status"],
    currentStep: row.current_step as number,
    lastContactedAt: (row.last_contacted_at as string) ?? null,
    createdAt: row.created_at as string,
  }
}


