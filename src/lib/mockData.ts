import type {
  Agent,
  Task,
  ActivityLog,
  Pipeline,
  ComplianceRecord,
} from '@/types'

// ─── AGENT ────────────────────────────────────────────────────────────────────
export const MOCK_AGENT: Agent = {
  id: 'agent-001',
  name: 'Sarah Mitchell',
  email: 'sarah.mitchell@bearteam.com',
  onboarding_stage: '0-30',
  onboarding_day: 14,
  last_active: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // 26h ago
  performance_score: 62,
  compliance_rate: 78,
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
export const MOCK_TASKS: Task[] = [
  {
    id: 'task-001',
    agent_id: 'agent-001',
    type: 'compliance',
    title: 'Complete Fair Housing module',
    description: 'Required within first 30 days. Overdue by 2 days.',
    status: 'overdue',
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: 'task-002',
    agent_id: 'agent-001',
    type: 'follow_up',
    title: 'Follow up: Johnson lead',
    description: 'No contact in 72 hours. Trigger follow-up call or text.',
    status: 'pending',
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'task-003',
    agent_id: 'agent-001',
    type: 'onboarding',
    title: 'Set up MLS profile',
    description: 'Required onboarding task for week 2.',
    status: 'completed',
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
  {
    id: 'task-004',
    agent_id: 'agent-001',
    type: 'recovery',
    title: 'Log activity — 26 hours inactive',
    description: 'No system activity logged since yesterday. Recovery task triggered.',
    status: 'pending',
    due_date: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'task-005',
    agent_id: 'agent-001',
    type: 'pipeline_update',
    title: 'Update Garcia deal stage',
    description: 'Deal has been in "Under Contract" for 8 days with no update.',
    status: 'pending',
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'task-006',
    agent_id: 'agent-001',
    type: 'lead_contact',
    title: 'Contact new referral: T. Williams',
    description: 'New lead assigned this morning. First contact required within 24h.',
    status: 'pending',
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
  },
]

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
export const MOCK_ACTIVITY_LOG: ActivityLog[] = [
  {
    id: 'log-001',
    agent_id: 'agent-001',
    action_type: 'task_completed',
    description: 'Completed: Set up MLS profile',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    outcome: 'success',
    task_id: 'task-003',
  },
  {
    id: 'log-002',
    agent_id: 'agent-001',
    action_type: 'pipeline_update',
    description: 'Updated Garcia deal to Under Contract',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    outcome: 'success',
  },
  {
    id: 'log-003',
    agent_id: 'agent-001',
    action_type: 'task_missed',
    description: 'Missed: Follow up with Carter lead',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    outcome: 'failure',
  },
  {
    id: 'log-004',
    agent_id: 'agent-001',
    action_type: 'login',
    description: 'Agent logged into BearTeamOS',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    outcome: 'neutral',
  },
  {
    id: 'log-005',
    agent_id: 'agent-001',
    action_type: 'compliance_completed',
    description: 'Completed: E&O Insurance acknowledgment',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    outcome: 'success',
  },
]

// ─── PIPELINE ─────────────────────────────────────────────────────────────────
export const MOCK_PIPELINE: Pipeline[] = [
  {
    id: 'pipe-001',
    agent_id: 'agent-001',
    lead_name: 'David Garcia',
    stage: 'under_contract',
    last_contact: new Date(Date.now() - 1000 * 60 * 60 * 48 * 4).toISOString(),
    days_in_stage: 8,
    notes: 'Closing scheduled for April 12',
  },
  {
    id: 'pipe-002',
    agent_id: 'agent-001',
    lead_name: 'Marcus Johnson',
    stage: 'contacted',
    last_contact: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    days_in_stage: 3,
    notes: 'Interested in Windermere area, $450K budget',
  },
  {
    id: 'pipe-003',
    agent_id: 'agent-001',
    lead_name: 'Tanya Williams',
    stage: 'new_lead',
    last_contact: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    days_in_stage: 0,
    notes: 'Referral from Bethanne. Relocating from Chicago.',
  },
  {
    id: 'pipe-004',
    agent_id: 'agent-001',
    lead_name: 'Kevin Carter',
    stage: 'stalled',
    last_contact: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    days_in_stage: 10,
    notes: 'No response since initial contact. Intervention needed.',
  },
]

// ─── COMPLIANCE ───────────────────────────────────────────────────────────────
export const MOCK_COMPLIANCE: ComplianceRecord[] = [
  {
    id: 'comp-001',
    agent_id: 'agent-001',
    requirement: 'Fair Housing Training (30-day)',
    status: 'missing',
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    notes: 'Overdue. Required before first transaction.',
  },
  {
    id: 'comp-002',
    agent_id: 'agent-001',
    requirement: 'E&O Insurance Acknowledgment',
    status: 'completed',
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 96 * 2).toISOString(),
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
  {
    id: 'comp-003',
    agent_id: 'agent-001',
    requirement: 'BearTeam Standards & Practices Sign-off',
    status: 'completed',
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
  },
  {
    id: 'comp-004',
    agent_id: 'agent-001',
    requirement: 'MLS Board Orientation',
    status: 'missing',
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    notes: 'Due in 2 days.',
  },
  {
    id: 'comp-005',
    agent_id: 'agent-001',
    requirement: 'BearTeam Academy: Week 2 Modules',
    status: 'late',
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    notes: '1 day overdue.',
  },
]
