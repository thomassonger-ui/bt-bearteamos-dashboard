'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import DailySummaryCard from '@/components/DailySummaryCard'
import TaskList from '@/components/TaskList'
import { getAgent, getFirstAgent, getTasks, getCompliance, updateTaskStatus, logActivity } from '@/lib/queries'
import { runEngine } from '@/lib/engine'
import type { Agent, Task, ComplianceRecord } from '@/types'

// Wraps a promise with a timeout — resolves null instead of hanging
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

export default function DashboardPage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [compliance, setCompliance] = useState<ComplianceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        // Get agent ID from session, fallback to first agent — 5s timeout
        const storedId = typeof window !== 'undefined' ? sessionStorage.getItem('bt_agent_id') : null
        const agentData = await withTimeout(
          storedId ? getAgent(storedId) : getFirstAgent(),
          5000
        )

        if (!agentData) {
          setDbError(true)
          setLoading(false)
          return
        }

        // Run engine non-blocking — don't await, don't let it gate the dashboard
        void runEngine(agentData.id).catch((e) => console.error('[engine]', e))

        // Fetch data with timeout
        const [freshTasks, freshCompliance] = await Promise.all([
          withTimeout(getTasks(agentData.id), 5000).then(r => r ?? []),
          withTimeout(getCompliance(agentData.id), 5000).then(r => r ?? []),
        ])

        setAgent(agentData)
        setTasks(freshTasks)
        setCompliance(freshCompliance)
      } catch (err) {
        console.error('[dashboard init]', err)
        setDbError(true)
      } finally {
        setLoading(false)
      }
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

    if (agent) setTasks(await getTasks(agent.id))
  }

  if (loading) return <LoadingScreen />

  if (dbError || !agent) return (
    <div style={{
      display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bt-black)', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 13, color: 'var(--bt-text-dim)', textAlign: 'center' }}>
        {dbError
          ? 'Database not configured yet. Run the Supabase setup SQL to activate the system.'
          : 'No agent record found.'
        }
      </div>
      <a href="/login" style={{ fontSize: 12, color: 'var(--bt-accent)' }}>← Back to login</a>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', overflowY: 'auto' }}>
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
