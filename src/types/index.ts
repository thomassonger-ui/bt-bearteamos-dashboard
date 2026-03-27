export type OnboardingStage = '0-30' | '30-60' | '60-90' | 'active'

export type TaskStatus = 'pending' | 'completed' | 'missed' | 'overdue'

export type TaskType =
  | 'follow_up'
  | 'lead_contact'
  | 'pipeline_update'
  | 'compliance'
  | 'onboarding'
  | 'recovery'
  | 'intervention'

export type ComplianceStatus = 'completed' | 'missing' | 'late'

export type PipelineStage =
  | 'new_lead'
  | 'contacted'
  | 'appointment_set'
  | 'under_contract'
  | 'closed'
  | 'stalled'

export interface Agent {
  id: string
  name: string
  email: string
  onboarding_stage: OnboardingStage
  onboarding_day: number // days since joining
  last_active: string // ISO date string
  performance_score: number // 0–100 placeholder
  compliance_rate: number // 0–100 placeholder
}

export interface Task {
  id: string
  agent_id: string
  type: TaskType
  title: string
  description: string
  status: TaskStatus
  due_date: string // ISO date string
  completed_at?: string
}

export interface ActivityLog {
  id: string
  agent_id: string
  action_type: string
  description: string
  timestamp: string // ISO date string
  outcome: 'success' | 'failure' | 'neutral'
  task_id?: string
}

export interface Pipeline {
  id: string
  agent_id: string
  lead_name: string
  stage: PipelineStage
  last_contact: string // ISO date string
  notes?: string
  days_in_stage: number
}

export interface ComplianceRecord {
  id: string
  agent_id: string
  requirement: string
  status: ComplianceStatus
  due_date: string
  timestamp?: string // when completed
  notes?: string
}
