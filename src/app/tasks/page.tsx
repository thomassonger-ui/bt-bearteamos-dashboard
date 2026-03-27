'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import TaskList from '@/components/TaskList'
import { MOCK_AGENT, MOCK_TASKS, MOCK_ACTIVITY_LOG } from '@/lib/mockData'
import type { Task, ActivityLog } from '@/types'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS)
  const [log, setLog] = useState<ActivityLog[]>(MOCK_ACTIVITY_LOG)

  const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'overdue')
  const completed = tasks.filter((t) => t.status === 'completed')
  const missed = tasks.filter((t) => t.status === 'missed')

  function handleTaskUpdate(updatedTasks: Task[], newLog: ActivityLog) {
    setTasks(updatedTasks)
    setLog((prev) => [newLog, ...prev])
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Task Management
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{MOCK_AGENT.name}</div>
          </div>

          {/* Summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Pending / Overdue', value: pending.length, color: pending.length > 0 ? 'var(--bt-yellow)' : 'var(--bt-green)' },
              { label: 'Completed', value: completed.length, color: 'var(--bt-green)' },
              { label: 'Missed', value: missed.length, color: missed.length > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <TaskList
            agentId={MOCK_AGENT.id}
            tasks={tasks}
            onUpdate={handleTaskUpdate}
          />

          {/* Session log */}
          {log.length > 0 && (
            <div style={{ marginTop: 20, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Session Activity
              </div>
              {log.slice(0, 5).map((entry) => (
                <div key={entry.id} style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginBottom: 4 }}>
                  {entry.description}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
