// ─── DB Row types (match Supabase column names exactly) ─────────────────────

export interface Agent {
  id: string
  name: string
  email: string
  phone?: string
  username?: string           // BearTeamOS login username
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

export interface ChecklistEntry {
  done: boolean
  date?: string   // YYYY-MM-DD when completed
}

export interface Pipeline {
  id: string
  agent_id: string
  lead_name: string
  stage: string
  lead_type?: 'buyer' | 'seller' | 'rental'
  phone?: string
  email?: string
  address?: string
  last_contact: string              // ISO timestamp
  notes?: string
  created_at: string
  scout_session_id?: string
  scout_name?: string
  scout_email?: string
  scout_phone?: string
  scout_last_interaction?: string
  engagement_score?: number
  last_engagement_update?: string
  brokerage?: string
  enrichment_status?: 'complete' | 'failed' | 'pending' | null
  // Commission fields
  closed_date?: string
  sale_price?: number
  commission_rate?: number
  gci?: number
  // Transaction timeline
  target_close_date?: string
  milestone_inspection?: boolean
  milestone_appraisal?: boolean
  milestone_financing?: boolean
  milestone_walkthrough?: boolean
  // Transaction tracker (effective date driven)
  effective_date?: string
  tx_checklist?: Record<string, boolean>
  tx_side?: 'buyer' | 'seller' | 'both'
  // Compliance checklists with dates
  pre_contract_checklist?: Record<string, ChecklistEntry>
  post_close_checklist?: Record<string, ChecklistEntry>
  // Hot lead fields
  lead_source?: LeadSource
  hot_lead_type?: HotLeadType
  urgency?: 'critical' | 'high' | 'normal' | 'low'
  arv?: number
  property_address?: string
  zip_code?: string
  pain_point?: string
  source_url?: string
  source_id?: string
  scraped_at?: string
  is_hot_lead?: boolean
}

export type LeadSource =
  | 'facebook_marketplace'
  | 'craigslist'
  | 'google_maps'
  | 'county_appraisal'
  | 'newspaper'

export type HotLeadType =
  | 'probate'
  | 'pre_foreclosure'
  | 'tax_delinquent'
  | 'expired_listing'
  | 'fsbo'
  | 'code_violation'
  | 'hoa_lien'
  | 'divorce'
  | 'obituary'
  | 'str_distress'
  | 'eviction'
  | 'arm_reset'
  | 'downsizer'
  | 'job_relocation'
  | 'flip_failure'

export interface HotLeadSource {
  id: string
  source_name: LeadSource
  apify_actor_id?: string
  is_active: boolean
  last_run_at?: string
  last_run_status?: string
  leads_found: number
  run_frequency: string
  config?: Record<string, unknown>
  created_at: string
  updated_at: string
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

export interface RecruitLead {
  id: string
  name: string
  email: string
  phone?: string
  source?: string
  status?: string
  stage?: string
  brokerage?: string
  deal_count?: number
  avg_price?: number
  notes?: string
  entry_type?: string
  tier?: string
  call_outcome?: string
  top_objection?: string
  follow_up_date?: string
  calendly_event_uri?: string
  drip_step?: number
  onboarded_at?: string
  created_at: string
  updated_at?: string
}

// ─── Campaign Pipeline Lead ───────────────────────────────────────────────────

export interface Lead {
  id: string
  name: string
  email: string
  brokerage?: string
  batchId: string
  status: 'new' | 'contacted' | 'paused' | 'unsubscribed'
  currentStep: number
  lastContactedAt: string | null
  createdAt: string
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export type TaskStatus = Task['status']
export type TaskType = string
