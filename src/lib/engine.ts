import type { Agent, Task, ActivityLog } from '@/types'

/**
 * Dynamic task generation rules.
 * Evaluates agent state and returns triggered tasks to inject.
 */
export function generateDynamicTasks(
  agent: Agent,
  existingTasks: Task[]
): Partial<Task>[] {
  const triggered: Partial<Task>[] = []
  const now = new Date()
  const lastActive = new Date(agent.last_active)
  const hoursInactive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60)

  // Rule: No activity in 48+ hours → recovery task
  if (hoursInactive >= 48) {
    const alreadyExists = existingTasks.some(
      (t) => t.type === 'recovery' && t.status === 'pending'
    )
    if (!alreadyExists) {
      triggered.push({
        type: 'recovery',
        title: `Activity gap: ${Math.floor(hoursInactive)}h inactive`,
        description: 'System requires you to log an activity before proceeding.',
        status: 'pending',
        due_date: new Date(now.getTime() + 1000 * 60 * 60).toISOString(),
      })
    }
  }

  return triggered
}

/**
 * Returns task priority order for daily view.
 * overdue > pending (by due_date) > completed > missed
 */
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

/**
 * Returns a summary label for agent onboarding phase.
 */
export function getPhaseLabel(stage: Agent['onboarding_stage']): string {
  switch (stage) {
    case '0-30':
      return 'Foundation Phase (Days 0–30) — Structured, High Enforcement'
    case '30-60':
      return 'Pipeline Phase (Days 30–60) — Building Momentum'
    case '60-90':
      return 'Production Phase (Days 60–90) — Scaling Output'
    case 'active':
      return 'Active Agent'
  }
}

/**
 * Builds a new activity log entry.
 */
export function createLogEntry(
  agentId: string,
  actionType: string,
  description: string,
  outcome: ActivityLog['outcome'],
  taskId?: string
): ActivityLog {
  return {
    id: `log-${Date.now()}`,
    agent_id: agentId,
    action_type: actionType,
    description,
    timestamp: new Date().toISOString(),
    outcome,
    task_id: taskId,
  }
}

/**
 * Formats an ISO date string to a readable relative time.
 */
export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

/**
 * Formats an ISO date string to MM/DD/YYYY HH:MM.
 */
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
