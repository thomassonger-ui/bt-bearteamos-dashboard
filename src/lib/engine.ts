import type { Agent, Task } from '@/types'
import {
  getLastActivityTime,
  getStalePipelineLeads,
  getTasks,
  createTask,
  markOverdueTasks,
  logActivity,
  updateAgentLastActive,
} from './queries'

// ─── MAIN ENGINE ENTRY POINT ─────────────────────────────────────────────────
// Called on: dashboard load, login
// Runs all 4 rules in order, inserts tasks if triggered, marks overdue

export async function runEngine(agentId: string): Promise<void> {
  // 0. Mark overdue first (pending tasks past due_date)
  await markOverdueTasks(agentId)

  // 1. Fetch current state
  const [lastActivity, existingTasks] = await Promise.all([
    getLastActivityTime(agentId),
    getTasks(agentId),
  ])

  const now = new Date()

  // ── RULE 1: Inactivity Recovery ──────────────────────────────────────────
  // IF no activity_log entry in last 24 hours → create recovery task
  const hoursInactive = lastActivity
    ? (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)
    : 999

  if (hoursInactive >= 24) {
    const alreadyExists = existingTasks.some(
      (t) => t.type === 'recovery' && (t.status === 'pending' || t.status === 'overdue')
    )
    if (!alreadyExists) {
      await createTask({
        agent_id: agentId,
        type: 'recovery',
        title: 'Complete 10 follow-ups today',
        description: `No system activity in ${Math.floor(hoursInactive)}h. Recovery required before pipeline work.`,
        status: 'pending',
        due_date: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(), // due in 4h
      })
      await logActivity({
        agent_id: agentId,
        action_type: 'engine_rule_triggered',
        description: `Rule 1: Inactivity recovery task created (${Math.floor(hoursInactive)}h gap)`,
        outcome: 'neutral',
      })
    }
  }

  // ── RULE 2: Pipeline Stall ────────────────────────────────────────────────
  // IF pipeline.last_contact > 3 days → create follow-up task per stale lead
  const staleLeads = await getStalePipelineLeads(agentId, 3)

  for (const lead of staleLeads) {
    const followUpExists = existingTasks.some(
      (t) =>
        t.type === 'follow_up' &&
        t.title.includes(lead.lead_name) &&
        (t.status === 'pending' || t.status === 'overdue')
    )
    if (!followUpExists) {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contact).getTime()) / (1000 * 60 * 60 * 24)
      )
      await createTask({
        agent_id: agentId,
        type: 'follow_up',
        title: `Follow up with ${lead.lead_name}`,
        description: `No contact in ${daysSince} days. Stage: ${lead.stage}. Action required today.`,
        status: 'pending',
        due_date: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // due in 2h
      })
    }
  }

  if (staleLeads.length > 0) {
    await logActivity({
      agent_id: agentId,
      action_type: 'engine_rule_triggered',
      description: `Rule 2: ${staleLeads.length} stale pipeline lead(s) — follow-up tasks created`,
      outcome: 'neutral',
    })
  }

  // ── RULE 3: Onboarding Enforcement ───────────────────────────────────────
  // IF onboarding_stage < 30 → ensure minimum 5 pending/overdue tasks exist
  // Fetch agent inline to get onboarding_stage
  const { supabase } = await import('./supabase')
  const { data: agentRow } = await supabase
    .from('agents')
    .select('onboarding_stage')
    .eq('id', agentId)
    .single()

  const onboardingDay: number = agentRow?.onboarding_stage ?? 0

  if (onboardingDay < 30) {
    const activeTasks = existingTasks.filter(
      (t) => t.status === 'pending' || t.status === 'overdue'
    )
    const needed = 5 - activeTasks.length

    if (needed > 0) {
      const ONBOARDING_TASKS = [
        { title: 'Review BearTeam Standards & Practices', type: 'onboarding' },
        { title: 'Schedule 1:1 with Tom Songer', type: 'onboarding' },
        { title: 'Complete MLS profile setup', type: 'onboarding' },
        { title: 'Log first 3 lead contacts in pipeline', type: 'onboarding' },
        { title: 'Complete BearTeam Academy Week 1 module', type: 'onboarding' },
      ]
      // Only create tasks not already in existingTasks by title
      let created = 0
      for (const t of ONBOARDING_TASKS) {
        if (created >= needed) break
        const titleExists = existingTasks.some((e) => e.title === t.title)
        if (!titleExists) {
          await createTask({
            agent_id: agentId,
            type: t.type,
            title: t.title,
            description: `Onboarding requirement (Day ${onboardingDay}). Must be completed in Foundation phase.`,
            status: 'pending',
            due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          })
          created++
        }
      }
      if (created > 0) {
        await logActivity({
          agent_id: agentId,
          action_type: 'engine_rule_triggered',
          description: `Rule 3: Onboarding enforcement — ${created} task(s) added to meet minimum 5`,
          outcome: 'neutral',
        })
      }
    }
  }

  // ── RULE 4: Missed Task Pressure ─────────────────────────────────────────
  // IF task.status = missed → create replacement task due tomorrow
  const missedTasks = existingTasks.filter((t) => t.status === 'missed')
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  for (const missed of missedTasks) {
    // Check if a replacement already exists
    const replacementExists = existingTasks.some(
      (t) =>
        t.title === `[Retry] ${missed.title}` &&
        (t.status === 'pending' || t.status === 'overdue')
    )
    if (!replacementExists) {
      await createTask({
        agent_id: agentId,
        type: missed.type,
        title: `[Retry] ${missed.title}`,
        description: `Missed yesterday. This must be completed today. ${missed.description}`,
        status: 'pending',
        due_date: tomorrow,
      })
    }
  }

  if (missedTasks.length > 0) {
    await logActivity({
      agent_id: agentId,
      action_type: 'engine_rule_triggered',
      description: `Rule 4: ${missedTasks.length} missed task(s) — replacement tasks created`,
      outcome: 'neutral',
    })
  }

  // 5. Update agent's last_active timestamp
  await updateAgentLastActive(agentId)
}

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────────

export function prioritizeTasks(tasks: Task[]): Task[] {
  const order: Record<string, number> = {
    overdue: 0,
    pending: 1,
    completed: 2,
    missed: 3,
  }
  return [...tasks].sort((a, b) => {
    const statusDiff = order[a.status] - order[b.status]
    if (statusDiff !== 0) return statusDiff
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
