'use client'

import { useState, useEffect } from 'react'
import ResponsiveShell from '@/components/ResponsiveShell'
import TaskList from '@/components/TaskList'
import { getFirstAgent, getAgent, getTasks, updateTaskStatus, logActivity } from '@/lib/queries'
import type { Agent, Task } from '@/types'

export default function TasksPage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const storedId = sessionStorage.getItem('bt_agent_id')
      const agentData = storedId ? await getAgent(storedId) : await getFirstAgent()
      if (!agentData) { setLoading(false); return }
      const taskData = await getTasks(agentData.id)
      setAgent(agentData)
      setTasks(taskData)
      setLoading(false)
    }
    load()
  }, [])

  async function handleTaskUpdate(taskId: string, status: Task['status']) {
    const completedAt = status === 'completed' ? new Date().toISOString() : undefined
    await updateTaskStatus(taskId, status, completedAt)
    if (agent) {
      const task = tasks.find((t) => t.id === taskId)
      if (task) {
        await logActivity({
          agent_id: agent.id,
          action_type: status === 'completed' ? 'task_completed' : 'task_missed',
          description: `${status === 'completed' ? 'Completed' : 'Missed'}: ${task.title}`,
          outcome: status === 'completed' ? 'success' : 'failure',
          task_id: taskId,
        })
      }
      setTasks(await getTasks(agent.id))
    }
  }

  const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'overdue')
  const completed = tasks.filter((t) => t.status === 'completed')
  const missed = tasks.filter((t) => t.status === 'missed')

  if (loading) return <div style={{ padding: 40, color: 'var(--bt-text-dim)' }}>Loading…</div>

  return (
    <ResponsiveShell>
      <main className="m-pad m-scroll" style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', height: '100%' }}>
        <div className="m-full" style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Task Management</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{agent?.name ?? '—'}</div>
          </div>

          <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
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

          {agent && <TaskList agentId={agent.id} tasks={tasks} onUpdate={handleTaskUpdate} />}
        </div>
      </main>
    </ResponsiveShell>
  )
}
