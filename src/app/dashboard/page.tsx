'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import DailySummaryCard from '@/components/DailySummaryCard'
import TaskList from '@/components/TaskList'
import { getAgent, getFirstAgent, getTasks, getCompliance, updateTaskStatus, logActivity } from '@/lib/queries'
import { runEngine } from '@/lib/engine'
import type { Agent, Task, ActivityLog, ComplianceRecord } from '@/types'

export default function DashboardPage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [compliance, setCompliance] = useState<ComplianceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      // Get agent ID from session, fallback to first agent
      const storedId = typeof window !== 'undefined' ? sessionStorage.getItem('bt_agent_id') : null
      const agentData = storedId ? await getAgent(storedId) : await getFirstAgent()
      if (!agentData) { setLoading(false); return }

      // Run engine on dashboard load (checks rules, marks overdue)
      await runEngine(agentData.id)

      // Fetch fresh data after engine runs
      const [freshTasks, freshCompliance] = await Promise.all([
        getTasks(agentData.id),
        getCompliance(agentData.id),
      ])

      setAgent(agentData)
      setTasks(freshTasks)
      setCompliance(freshCompliance)
      setLoading(false)
    }
    init()
  }, [])

  async function handleTaskUpdate(taskId: string, status: Task['status']) {
    const completedAt = status === 'completed' ? new Date().toISOString() : undefined
    await updateTaskStatus(taskId, status, completedAt)

    const task = tasks.find((t) => t.id === taskId)
    if (task && agent) {
      await logActivity({
        agent_id: agent.id,
        action_type: status === 'completed' ? 'task_completed' : 'task_missed',
        description: `${status === 'completed' ? 'Completed' : 'Missed'}: ${task.title}`,
        outcome: status === 'completed' ? 'success' : 'failure',
        task_id: taskId,
      })
    }

    // Refresh tasks
    if (agent) setTasks(await getTasks(agent.id))
  }

  if (loading) return <LoadingScreen />

  if (!agent) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--bt-text-dim)' }}>
      No agent found. <a href="/login" style={{ color: 'var(--bt-accent)', marginLeft: 8 }}>Login</a>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DailySummaryCard agent={agent} tasks={tasks} compliance={compliance} />
          <TaskList agentId={agent.id} tasks={tasks} onUpdate={handleTaskUpdate} />
        </div>
      </main>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bt-black)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Running engine…
        </div>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 8 }}>
          Checking rules · Generating tasks
        </div>
      </div>
    </div>
  )
}
