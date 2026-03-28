import { getSupabase } from './supabase'

// Weekly targets
export const TARGETS = {
  calls:         100,
  conversations:  15,
  appointments:    5,
}

export interface WeeklyMetrics {
  calls_this_week:         number
  conversations_this_week: number
  appointments_this_week:  number
  active_clients:          number
  under_contract:          number
  closed_count:            number
  // derived
  call_pace:          number  // 0–1
  appointment_pace:   number  // 0–1
  listing_projection: number
  pipeline_health:    number  // 0–1 average of pace metrics
}

function weekStart(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

export async function getWeeklyMetrics(agentId: string): Promise<WeeklyMetrics> {
  const supabase = getSupabase()
  const since = weekStart()

  // --- Activity log counts (calls / conversations) ---
  // These action_types will be logged once call tracking is built.
  // For now they stub to 0 safely.
  const [callsRes, convsRes] = await Promise.all([
    supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('action_type', 'call_logged')
      .gte('created_at', since),
    supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('action_type', 'conversation_logged')
      .gte('created_at', since),
  ])

  // --- Pipeline stage counts ---
  const { data: pipelineRows } = await supabase
    .from('pipeline')
    .select('stage')
    .eq('agent_id', agentId)

  const rows = pipelineRows ?? []
  const stageCount = (stage: string) => rows.filter((r: { stage: string }) => r.stage === stage).length

  // Appointments this week = pipeline rows moved to appointment_set this week
  const { count: apptCount } = await supabase
    .from('pipeline')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('stage', 'appointment_set')
    .gte('last_contact', since)

  const calls_this_week         = callsRes.count ?? 0
  const conversations_this_week = convsRes.count ?? 0
  const appointments_this_week  = apptCount ?? 0
  const active_clients          = stageCount('active_client')
  const under_contract          = stageCount('under_contract')
  const closed_count            = stageCount('closed')

  const call_pace          = Math.min(calls_this_week / TARGETS.calls, 1)
  const appointment_pace   = Math.min(appointments_this_week / TARGETS.appointments, 1)
  const listing_projection = appointments_this_week / 3
  const pipeline_health    = (call_pace + appointment_pace) / 2

  return {
    calls_this_week,
    conversations_this_week,
    appointments_this_week,
    active_clients,
    under_contract,
    closed_count,
    call_pace,
    appointment_pace,
    listing_projection,
    pipeline_health,
  }
}

type PaceStatus = 'green' | 'yellow' | 'red'

export function paceStatus(pace: number): PaceStatus {
  if (pace >= 0.8) return 'green'
  if (pace >= 0.5) return 'yellow'
  return 'red'
}

const STATUS_COLOR: Record<PaceStatus, string> = {
  green:  'var(--bt-green)',
  yellow: '#e0a040',
  red:    'var(--bt-red)',
}

export function paceColor(pace: number): string {
  return STATUS_COLOR[paceStatus(pace)]
}

export function insightLine(m: WeeklyMetrics): string {
  const callsLeft = TARGETS.calls - m.calls_this_week
  const apptLeft  = TARGETS.appointments - m.appointments_this_week

  if (m.listing_projection >= 1.5) {
    return `On track for ${m.listing_projection.toFixed(1)} listings this week.`
  }
  if (m.call_pace < 0.5 && callsLeft > 0) {
    return `You are ${callsLeft} call${callsLeft !== 1 ? 's' : ''} behind pace this week.`
  }
  if (m.appointment_pace < 0.8 && apptLeft > 0) {
    return `Add ${apptLeft} more appointment${apptLeft !== 1 ? 's' : ''} to stay on target.`
  }
  if (m.listing_projection > 0) {
    return `On track for ${m.listing_projection.toFixed(1)} listing${m.listing_projection !== 1 ? 's' : ''} this week.`
  }
  return `Book appointments this week to build toward your listing target.`
}
