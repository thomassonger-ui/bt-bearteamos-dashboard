'use client'

import { useState } from 'react'
import type { Task, ActivityLog } from '@/types'
import { prioritizeTasks, createLogEntry, formatDate } from '@/lib/engine'

interface Props {
  agentId: string
  tasks: Task[]
  onUpdate: (tasks: Task[], log: ActivityLog) => void
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--bt-yellow)',
  overdue: 'var(--bt-red)',
  completed: 'var(--bt-green)',
  missed: 'var(--bt-text-dim)',
}

const TYPE_LABEL: Record<string, string> = {
  follow_up: 'FOLLOW-UP',
  lead_contact: 'LEAD',
  pipeline_update: 'PIPELINE',
  compliance: 'COMPLIANCE',
  onboarding: 'ONBOARDING',
  recovery: 'RECOVERY',
  intervention: 'INTERVENTION',
}

export default function TaskList({ agentId, tasks, onUpdate }: Props) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks)
  const sorted = prioritizeTasks(localTasks)

  function markComplete(taskId: string) {
    const updated = localTasks.map((t) =>
      t.id === taskId
        ? { ...t, status: 'completed' as const, completed_at: new Date().toISOString() }
        : t
    )
    const task = localTasks.find((t) => t.id === taskId)!
    const log = createLogEntry(agentId, 'task_completed', `Completed: ${task.title}`, 'success', taskId)
    setLocalTasks(updated)
    onUpdate(updated, log)
  }

  function markMissed(taskId: string) {
    const updated = localTasks.map((t) =>
      t.id === taskId ? { ...t, status: 'missed' as const } : t
    )
    const task = localTasks.find((t) => t.id === taskId)!
    const log = createLogEntry(agentId, 'task_missed', `Missed: ${task.title}`, 'failure', taskId)
    setLocalTasks(updated)
    onUpdate(updated, log)
  }

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bt-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Required Actions
        </div>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>
          {localTasks.filter((t) => t.status === 'completed').length}/{localTasks.length} completed
        </div>
      </div>

      <div>
        {sorted.map((task, i) => (
          <div
            key={task.id}
            style={{
              padding: '14px 20px',
              borderBottom: i < sorted.length - 1 ? '1px solid var(--bt-border)' : 'none',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              opacity: task.status === 'missed' ? 0.5 : 1,
            }}
          >
            {/* Status indicator */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
              background: STATUS_COLOR[task.status] ?? 'var(--bt-text-dim)',
            }} />

            {/* Content */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: 'var(--bt-accent)', letterSpacing: '0.08em', fontWeight: 600 }}>
                  {TYPE_LABEL[task.type] ?? task.type.toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: STATUS_COLOR[task.status], textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {task.status}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, textDecoration: task.status === 'missed' ? 'line-through' : 'none' }}>
                {task.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>{task.description}</div>
              {task.completed_at && (
                <div style={{ fontSize: 11, color: 'var(--bt-green)', marginTop: 4 }}>
                  ✓ Completed {formatDate(task.completed_at)}
                </div>
              )}
            </div>

            {/* Actions */}
            {(task.status === 'pending' || task.status === 'overdue') && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => markComplete(task.id)} style={btnStyle('var(--bt-green)')}>
                  Done
                </button>
                <button onClick={() => markMissed(task.id)} style={btnStyle('var(--bt-red)')}>
                  Missed
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    border: `1px solid ${color}`,
    background: 'transparent',
    color,
    borderRadius: 3,
    cursor: 'pointer',
    letterSpacing: '0.04em',
  }
}
