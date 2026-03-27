// ─── DB Row types (match Supabase column names exactly) ─────────────────────

export interface Agent {
  id: string
  name: string
  email: string
  phone?: string
  stage: string               // existing column: 'Onboarding' | 'Active' etc
  onboarding_stage: number    // days into onboarding (0–90+)
  last_active: string         // ISO timestamp
  inactivity_streak: number   // consecutive days inactive (≥24h each)
  missed_streak: number       // consecutive engine runs with ≥2 missed tasks in 48h
  performance_score: number   // 0–100, calculated each engine run
  last_score_update?: string  // ISO timestamp of last score calculation
  start_date?: string
  created_at: string
  updated_at?: string
}

export interface Task {
  id: string
  agent_id: string
  type: string
  title: string
  description: string
  status: 'pending' | 'completed' | 'missed' | 'overdue'
  due_date: string            // ISO timestamp
  completed_at?: string
  created_at: string
  source_rule?: string        // which engine rule created this task
  source_ref?: string         // entity that triggered it (lead_id, date, task_id)
}

export interface ActivityLog {
  id: string
  agent_id: string
  action_type: string
  description: string
  outcome: 'success' | 'failure' | 'neutral'
  task_id?: string
  created_at: string
}

export interface Pipeline {
  id: string
  agent_id: string
  lead_name: string
  stage: string
  last_contact: string              // ISO timestamp
  notes?: string
  created_at: string
  scout_session_id?: string         // ties Scout conversation to this lead
  scout_name?: string               // extracted from conversation
  scout_email?: string              // extracted from conversation
  scout_phone?: string              // extracted from conversation
  scout_last_interaction?: string   // ISO timestamp of last Scout message
  engagement_score?: number         // 0–100 Scout engagement score
  last_engagement_update?: string   // ISO timestamp of last score update
}

export interface ComplianceRecord {
  id: string
  agent_id: string
  requirement: string
  status: 'pending' | 'completed'
  due_date?: string
  completed_at?: string
  notes?: string
  updated_at: string
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export type TaskStatus = Task['status']
export type TaskType = string
