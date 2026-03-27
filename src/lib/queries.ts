import { getSupabase } from './supabase'
import type { Agent, Task, ActivityLog, Pipeline, ComplianceRecord } from '@/types'

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
