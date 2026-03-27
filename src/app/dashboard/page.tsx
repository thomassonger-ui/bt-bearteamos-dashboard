'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import DailySummaryCard from '@/components/DailySummaryCard'
import TaskList from '@/components/TaskList'
import { MOCK_AGENT, MOCK_TASKS, MOCK_COMPLIANCE, MOCK_ACTIVITY_LOG } from '@/lib/mockData'
import type { Task, ActivityLog } from '@/types'

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS)
  const [log, setLog] = useState<ActivityLog[]>(MOCK_ACTIVITY_LOG)

  function handleTaskUpdate(updatedTasks: Task[], newLog: ActivityLog) {
    setTasks(updatedTasks)
    setLog((prev) => [newLog, ...prev])
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DailySummaryCard
            agent={MOCK_AGENT}
            tasks={tasks}
            compliance={MOCK_COMPLIANCE}
          />
          <TaskList
            agentId={MOCK_AGENT.id}
            tasks={tasks}
            onUpdate={handleTaskUpdate}
          />
        </div>
      </main>
    </div>
  )
}
