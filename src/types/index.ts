// ─── DB Row types (match Supabase column names exactly) ─────────────────────

export interface EscrowLogEntry {
  ts: string      // ISO timestamp — immutable once written
  user: string    // agent name or 'Admin'
  action: string  // description of action taken
}

export interface Agent {
  id: string
  name: string
  email: string
  phone?: string
  username?: string
  stage: string
  onboarding_stage: number
  last_active: string
  inactivity_streak: number
  missed_streak: number
  performance_score: number
  last_score_update?: string
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
  due_date: string
  completed_at?: string
  created_at: string
  source_rule?: string
  source_ref?: string
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
  date?: string
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
  last_contact: string
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
  // Commission
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
  // Transaction tracker
  effective_date?: string
  tx_checklist?: Record<string, boolean>
  tx_side?: 'buyer' | 'seller' | 'both'
  // Compliance checklists with dates
  pre_contract_checklist?: Record<string, ChecklistEntry>
  post_close_checklist?: Record<string, ChecklistEntry>
  // ─── Escrow Compliance ───────────────────────────────────────────────────
  escrow_holder?: string                                    // title company / attorney
  escrow_amount?: number                                    // EMD amount
  escrow_due_date?: string                                  // auto-calc: eff date + 3 days
  escrow_received_date?: string                             // when agent received EMD
  escrow_deposit_date?: string                              // when deposited into escrow account
  escrow_proof_uploaded?: boolean                           // proof of deposit on file
  escrow_proof_url?: string                                 // URL to uploaded proof doc
  escrow_status?: 'pending' | 'deposited' | 'disputed' | 'released'
  escrow_release_doc_url?: string                           // mutual release / closing statement
  escrow_dispute_at?: string                                // ISO timestamp when dispute flagged
  escrow_log?: EscrowLogEntry[]                             // append-only audit trail
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
  | 'zillow_fsbo'
  | 'forsalebyowner'
  | 'fsbo_com'
  | 'byowner'
  | 'manual_upload'

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

export type TaskStatus = Task['status']
export type TaskType = string
