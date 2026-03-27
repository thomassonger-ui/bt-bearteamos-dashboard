import type { Task } from '@/types'
import {
  getLastActivityTime,
  getStalePipelineLeads,
  createTask,
  markOverdueTasks,
  logActivity,
  updateAgentLastActive,
  updateAgentStreaks,
  updateAgentScore,
  ruleTaskExists,
  countPendingOnboardingTasks,
  deduplicateTasks,
} from './queries'

// ─── MAIN ENGINE ENTRY POINT ─────────────────────────────────────────────────
// Called on: dashboard load, login
// Runs all base rules + escalation levels — fully idempotent

export async function runEngine(agentId: string): Promise<void> {
  // 0. Safety pass: remove duplicate pending tasks
  await deduplicateTasks(agentId)

  // 0b. Mark overdue (pending tasks past due_date)
  await markOverdueTasks(agentId)

  const now = new Date()
  const { supabase } = await import('./supabase')

  // ── STREAK CALCULATION ────────────────────────────────────────────────────
  // Fetch current streak values from DB
  const { data: agentRow } = await supabase
    .from('agents')
    .select('inactivity_streak, missed_streak, onboarding_stage')
    .eq('id', agentId)
    .single()

  const currentInactivityStreak: number = agentRow?.inactivity_streak ?? 0
  const currentMissedStreak: number = agentRow?.missed_streak ?? 0
  const onboardingDay: number = agentRow?.onboarding_stage ?? 0

  // Calculate inactivity: if ≥24h since last activity → increment, else reset
  const lastActivity = await getLastActivityTime(agentId)
  const hoursInactive = lastActivity
    ? (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)
    : 999

  const newInactivityStreak = hoursInactive >= 24
    ? currentInactivityStreak + 1
    : 0

  // Calculate missed streak: count missed tasks in last 48h window
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const { data: recentMissed } = await supabase
    .from('tasks')
    .select('id')
    .eq('agent_id', agentId)
    .eq('status', 'missed')
    .gte('created_at', cutoff48h)

  const recentMissedCount = recentMissed?.length ?? 0
  const newMissedStreak = recentMissedCount >= 2
    ? currentMissedStreak + 1
    : 0

  // Persist updated streaks
  await updateAgentStreaks(agentId, newInactivityStreak, newMissedStreak)

  const todayKey = now.toISOString().slice(0, 10) // YYYY-MM-DD

  // ── RULE 1: Inactivity Recovery (Level 1 — Base) ─────────────────────────
  // Trigger: no activity in last 24 hours
  // Idempotency: source_rule='inactivity', source_ref=today's date
  if (hoursInactive >= 24) {
    const exists = await ruleTaskExists(agentId, 'inactivity', todayKey)
    if (!exists) {
      await createTask({
        agent_id: agentId,
        type: 'recovery',
        title: 'Complete 10 follow-ups today',
        description: `No system activity in ${Math.floor(hoursInactive)}h. Recovery required before pipeline work.`,
        status: 'pending',
        due_date: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        source_rule: 'inactivity',
        source_ref: todayKey,
      })
      await logActivity({
        agent_id: agentId,
        action_type: 'engine_rule_triggered',
        description: `Rule 1: Inactivity recovery task created (${Math.floor(hoursInactive)}h gap)`,
        outcome: 'neutral',
      })
    }
  }

  // ── RULE 2: Pipeline Stall (Level 1 — Base) ───────────────────────────────
  // Trigger: pipeline.last_contact > 3 days
  // Idempotency: source_rule='pipeline_stall', source_ref=lead.id
  const staleLeads = await getStalePipelineLeads(agentId, 3)
  let rule2Created = 0

  for (const lead of staleLeads) {
    const exists = await ruleTaskExists(agentId, 'pipeline_stall', lead.id)
    if (!exists) {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contact).getTime()) / (1000 * 60 * 60 * 24)
      )
      await createTask({
        agent_id: agentId,
        type: 'follow_up',
        title: `Follow up with ${lead.lead_name}`,
        description: `No contact in ${daysSince} days. Stage: ${lead.stage}. Action required today.`,
        status: 'pending',
        due_date: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        source_rule: 'pipeline_stall',
        source_ref: lead.id,
      })
      rule2Created++
    }
  }

  if (rule2Created > 0) {
    await logActivity({
      agent_id: agentId,
      action_type: 'engine_rule_triggered',
      description: `Rule 2: ${rule2Created} stale pipeline lead(s) — follow-up task(s) created`,
      outcome: 'neutral',
    })
  }

  // ── RULE 3: Onboarding Enforcement ───────────────────────────────────────
  // Idempotency: source_rule='onboarding', source_ref=title_slug
  if (onboardingDay < 30) {
    const ONBOARDING_TASKS = [
      { title: 'Review BearTeam Standards & Practices', slug: 'review-standards' },
      { title: 'Schedule 1:1 with Tom Songer', slug: 'schedule-1on1' },
      { title: 'Complete MLS profile setup', slug: 'mls-profile' },
      { title: 'Log first 3 lead contacts in pipeline', slug: 'log-leads' },
      { title: 'Complete BearTeam Academy Week 1 module', slug: 'academy-week1' },
    ]

    const pendingCount = await countPendingOnboardingTasks(agentId)
    const needed = 5 - pendingCount
    let rule3Created = 0

    if (needed > 0) {
      for (const t of ONBOARDING_TASKS) {
        if (rule3Created >= needed) break
        const exists = await ruleTaskExists(agentId, 'onboarding', t.slug)
        if (!exists) {
          await createTask({
            agent_id: agentId,
            type: 'onboarding',
            title: t.title,
            description: `Onboarding requirement (Day ${onboardingDay}). Must be completed in Foundation phase.`,
            status: 'pending',
            due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
            source_rule: 'onboarding',
            source_ref: t.slug,
          })
          rule3Created++
        }
      }
      if (rule3Created > 0) {
        await logActivity({
          agent_id: agentId,
          action_type: 'engine_rule_triggered',
          description: `Rule 3: Onboarding enforcement — ${rule3Created} task(s) added to meet minimum 5`,
          outcome: 'neutral',
        })
      }
    }
  }

  // ── RULE 4: Missed Task Pressure ─────────────────────────────────────────
  // Idempotency: source_rule='retry', source_ref=original_task.id
  const { data: missedRows } = await supabase
    .from('tasks')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'missed')

  const missedTasks = (missedRows ?? []) as Task[]
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  let rule4Created = 0

  for (const missed of missedTasks) {
    const exists = await ruleTaskExists(agentId, 'retry', missed.id)
    if (!exists) {
      await createTask({
        agent_id: agentId,
        type: missed.type,
        title: `[Retry] ${missed.title}`,
        description: `Missed yesterday. This must be completed today. ${missed.description}`,
        status: 'pending',
        due_date: tomorrow,
        source_rule: 'retry',
        source_ref: missed.id,
      })
      rule4Created++
    }
  }

  if (rule4Created > 0) {
    await logActivity({
      agent_id: agentId,
      action_type: 'engine_rule_triggered',
      description: `Rule 4: ${rule4Created} missed task(s) — replacement task(s) created`,
      outcome: 'neutral',
    })
  }

  // ── ESCALATION: Level 2 — Moderate Pressure ──────────────────────────────
  // Trigger: inactivity_streak ≥ 2 OR missed_streak ≥ 2
  // One task per day, idempotent
  if (newInactivityStreak >= 2 || newMissedStreak >= 2) {
    const exists = await ruleTaskExists(agentId, 'pressure_level_2', todayKey)
    if (!exists) {
      await createTask({
        agent_id: agentId,
        type: 'pressure',
        title: 'Complete 15 calls today',
        description: `Escalation: ${newInactivityStreak >= 2 ? `${newInactivityStreak} consecutive days inactive` : `${newMissedStreak} consecutive runs with missed tasks`}. Increased output required.`,
        status: 'pending',
        due_date: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        source_rule: 'pressure_level_2',
        source_ref: todayKey,
      })
      await logActivity({
        agent_id: agentId,
        action_type: 'pressure_level_2_triggered',
        description: `Level 2 pressure: inactivity_streak=${newInactivityStreak}, missed_streak=${newMissedStreak}`,
        outcome: 'neutral',
      })
    }
  }

  // ── ESCALATION: Level 3 — High Pressure ──────────────────────────────────
  // Trigger: inactivity_streak ≥ 3 OR missed_streak ≥ 3
  // Creates two tasks: high call volume + mandatory broker check-in
  if (newInactivityStreak >= 3 || newMissedStreak >= 3) {
    const [existsL3, existsBroker] = await Promise.all([
      ruleTaskExists(agentId, 'pressure_level_3', todayKey),
      ruleTaskExists(agentId, 'broker_check', todayKey),
    ])

    if (!existsL3) {
      await createTask({
        agent_id: agentId,
        type: 'pressure',
        title: 'Complete 25 calls + update all leads',
        description: `High pressure escalation: ${newInactivityStreak >= 3 ? `${newInactivityStreak} consecutive days inactive` : `${newMissedStreak} consecutive runs with missed tasks`}. All pipeline leads must be updated today.`,
        status: 'pending',
        due_date: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        source_rule: 'pressure_level_3',
        source_ref: todayKey,
      })
    }

    if (!existsBroker) {
      await createTask({
        agent_id: agentId,
        type: 'compliance',
        title: 'MANDATORY: Check in with broker',
        description: `Required broker check-in due to sustained performance issues (streak ${Math.max(newInactivityStreak, newMissedStreak)} days). Contact Tom Songer or Bethanne Baer today.`,
        status: 'pending',
        due_date: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        source_rule: 'broker_check',
        source_ref: todayKey,
      })
    }

    if (!existsL3 || !existsBroker) {
      await logActivity({
        agent_id: agentId,
        action_type: 'pressure_level_3_triggered',
        description: `Level 3 pressure: inactivity_streak=${newInactivityStreak}, missed_streak=${newMissedStreak}`,
        outcome: 'neutral',
      })
    }
  }

  // ── ESCALATION: Level 4 — Critical (Hard Enforcement) ────────────────────
  // Trigger: inactivity_streak ≥ 5
  // Creates critical task + flags agent in activity_log for broker visibility
  if (newInactivityStreak >= 5) {
    const exists = await ruleTaskExists(agentId, 'critical_recovery', todayKey)
    if (!exists) {
      await createTask({
        agent_id: agentId,
        type: 'critical',
        title: 'CRITICAL: Re-engage immediately — 30 calls required',
        description: `Agent has been inactive for ${newInactivityStreak} consecutive days. Immediate re-engagement mandatory. 30 outbound calls required today. Broker has been notified.`,
        status: 'pending',
        due_date: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        source_rule: 'critical_recovery',
        source_ref: todayKey,
      })
      await logActivity({
        agent_id: agentId,
        action_type: 'critical_triggered',
        description: `Level 4 CRITICAL: agent inactive ${newInactivityStreak} consecutive days — flagged for broker`,
        outcome: 'neutral',
      })
      // Flag agent for broker visibility
      await logActivity({
        agent_id: agentId,
        action_type: 'agent_flagged_critical',
        description: `Agent flagged CRITICAL: ${newInactivityStreak} day inactivity streak. Broker action required.`,
        outcome: 'failure',
      })
    }
  }

  // ── PERFORMANCE SCORING ───────────────────────────────────────────────────
  // Score is calculated from last 24h of activity_log events.
  // +10 per completed task, +5 per pipeline contact, +5 per compliance completion
  // -10 per missed task, -20 flat if inactive ≥ 24h
  // Clamped 0–100, written once per engine run.
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recentActivity } = await supabase
    .from('activity_log')
    .select('action_type')
    .eq('agent_id', agentId)
    .gte('created_at', cutoff24h)

  const activityEvents = recentActivity ?? []

  const completedCount = activityEvents.filter((e) => e.action_type === 'task_completed').length
  const pipelineCount = activityEvents.filter((e) => e.action_type === 'pipeline_contact').length
  const complianceCount = activityEvents.filter((e) => e.action_type === 'compliance_completed').length

  // Count missed tasks created in last 24h for scoring
  const { data: missedFor24h } = await supabase
    .from('tasks')
    .select('id')
    .eq('agent_id', agentId)
    .eq('status', 'missed')
    .gte('created_at', cutoff24h)
  const missedCount24h = missedFor24h?.length ?? 0

  let rawScore = 0
  rawScore += completedCount * 10
  rawScore += pipelineCount * 5
  rawScore += complianceCount * 5
  rawScore -= missedCount24h * 10
  if (hoursInactive >= 24) rawScore -= 20

  const finalScore = Math.max(0, Math.min(100, rawScore))

  await updateAgentScore(agentId, finalScore)
  await logActivity({
    agent_id: agentId,
    action_type: 'score_updated',
    description: `Performance score updated: ${finalScore}/100 (completed=${completedCount}, missed=${missedCount24h}, pipeline=${pipelineCount}, compliance=${complianceCount}, inactive=${hoursInactive >= 24})`,
    outcome: finalScore >= 50 ? 'success' : 'neutral',
  })

  // Final: update agent last_active timestamp
  await updateAgentLastActive(agentId)
}

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────────

// Priority weight for sorting — lower number = higher priority
function taskPriorityWeight(task: Task): number {
  // Critical tasks first
  if (task.source_rule === 'critical_recovery') return 0
  if (task.type === 'critical') return 0
  // Overdue tasks
  if (task.status === 'overdue') return 1
  // Pressure level 3 / broker check
  if (task.source_rule === 'pressure_level_3') return 2
  if (task.source_rule === 'broker_check') return 2
  // Pressure level 2
  if (task.source_rule === 'pressure_level_2') return 3
  // Pending tasks
  if (task.status === 'pending') return 4
  // Completed / missed last
  if (task.status === 'completed') return 6
  if (task.status === 'missed') return 7
  return 5
}

export function prioritizeTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const weightDiff = taskPriorityWeight(a) - taskPriorityWeight(b)
    if (weightDiff !== 0) return weightDiff
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })
}

export function getPhaseLabel(onboardingDay: number): string {
  if (onboardingDay < 30) return `Foundation Phase (Day ${onboardingDay}) — High Enforcement`
  if (onboardingDay < 60) return `Pipeline Phase (Day ${onboardingDay}) — Building Momentum`
  if (onboardingDay < 90) return `Production Phase (Day ${onboardingDay}) — Scaling Output`
  return 'Active Agent'
}

export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
