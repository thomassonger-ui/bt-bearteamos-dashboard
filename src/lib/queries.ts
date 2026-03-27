import { supabase } from './supabase'
import type { Agent, Task, ActivityLog, Pipeline, ComplianceRecord } from '@/types'

// ─── AGENT ────────────────────────────────────────────────────────────────────

export async function getAgent(agentId: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single()
  if (error) { console.error('getAgent:', error.message); return null }
  return data as Agent
}

export async function getFirstAgent(): Promise<Agent | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  if (error) { console.error('getFirstAgent:', error.message); return null }
  return data as Agent
}

export async function updateAgentLastActive(agentId: string): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .update({ last_active: new Date().toISOString() })
    .eq('id', agentId)
  if (error) console.error('updateAgentLastActive:', error.message)
}

// ─── TASKS ────────────────────────────────────────────────────────────────────

export async function getTasks(agentId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('agent_id', agentId)
    .order('due_date', { ascending: true })
  if (error) { console.error('getTasks:', error.message); return [] }
  return (data ?? []) as Task[]
}

export async function createTask(task: Omit<Task, 'id' | 'created_at'>): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()
  if (error) { console.error('createTask:', error.message); return null }
  return data as Task
}

export async function updateTaskStatus(
  taskId: string,
  status: Task['status'],
  completedAt?: string
): Promise<void> {
  const update: Partial<Task> = { status }
  if (completedAt) update.completed_at = completedAt
  const { error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', taskId)
  if (error) console.error('updateTaskStatus:', error.message)
}

export async function markOverdueTasks(agentId: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'overdue' })
    .eq('agent_id', agentId)
    .eq('status', 'pending')
    .lt('due_date', now)
  if (error) console.error('markOverdueTasks:', error.message)
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────

export async function getActivityLog(agentId: string, limit = 50): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('getActivityLog:', error.message); return [] }
  return (data ?? []) as ActivityLog[]
}

export async function logActivity(entry: Omit<ActivityLog, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('activity_log').insert(entry)
  if (error) console.error('logActivity:', error.message)
}

export async function getLastActivityTime(agentId: string): Promise<Date | null> {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
    .from('pipeline')
    .select('*')
    .eq('agent_id', agentId)
    .order('last_contact', { ascending: true })
  if (error) { console.error('getPipeline:', error.message); return [] }
  return (data ?? []) as Pipeline[]
}

export async function updateLastContact(pipelineId: string): Promise<void> {
  const { error } = await supabase
    .from('pipeline')
    .update({ last_contact: new Date().toISOString() })
    .eq('id', pipelineId)
  if (error) console.error('updateLastContact:', error.message)
}

export async function getStalePipelineLeads(agentId: string, daysStale = 3): Promise<Pipeline[]> {
  const cutoff = new Date(Date.now() - daysStale * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { error } = await supabase
    .from('compliance')
    .update(update)
    .eq('id', complianceId)
  if (error) console.error('updateComplianceStatus:', error.message)
}
