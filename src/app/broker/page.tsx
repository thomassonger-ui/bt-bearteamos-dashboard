'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import PerformanceSummary from '@/components/broker/PerformanceSummary'
import RiskAlertsPanel from '@/components/broker/RiskAlertsPanel'
import AgentTable from '@/components/broker/AgentTable'
import AgentDetailPanel from '@/components/broker/AgentDetailPanel'
import {
  getAllAgents,
  getAllTasks,
  getAllCompliance,
  getAllPipeline,
  getActivityLog,
} from '@/lib/queries'
import type { Agent, Task, ComplianceRecord, Pipeline, ActivityLog } from '@/types'

export default function BrokerPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [compliance, setCompliance] = useState<ComplianceRecord[]>([])
  const [pipeline, setPipeline] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)

  // Detail panel state
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [agentLog, setAgentLog] = useState<ActivityLog[]>([])
  const [agentTasks, setAgentTasks] = useState<Task[]>([])
  const [agentPipeline, setAgentPipeline] = useState<Pipeline[]>([])
  const [agentCompliance, setAgentCompliance] = useState<ComplianceRecord[]>([])

  const loadAll = useCallback(async () => {
    const [a, t, c, p] = await Promise.all([
      getAllAgents(),
      getAllTasks(),
      getAllCompliance(),
      getAllPipeline(),
    ])
    setAgents(a)
    setTasks(t)
    setCompliance(c)
    setPipeline(p)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function handleSelectAgent(agentId: string) {
    setSelectedAgentId(agentId)
    const [log, aTasks, aPipeline, aCompliance] = await Promise.all([
      getActivityLog(agentId, 10),
      getAllTasks(agentId),
      getAllPipeline(agentId),
      getAllCompliance(agentId),
    ])
    setAgentLog(log)
    setAgentTasks(aTasks)
    setAgentPipeline(aPipeline)
    setAgentCompliance(aCompliance)
  }

  async function handleRefresh() {
    await loadAll()
    if (selectedAgentId) await handleSelectAgent(selectedAgentId)
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bt-black)' }}>
        <div style={{ fontSize: 13, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Loading broker view…
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bt-black)' }}>
      {/* Top bar */}
      <div style={{
        height: 48, background: 'var(--bt-surface)', borderBottom: '1px solid var(--bt-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bt-accent)', letterSpacing: '0.06em' }}>
            BEARTEAM<span style={{ color: 'var(--bt-text-dim)' }}>OS</span>
            <span style={{ color: 'var(--bt-text-dim)', fontWeight: 400, marginLeft: 10, fontSize: 11 }}>
              Broker Command Center
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link href="/dashboard" style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.06em' }}>
            ← Agent View
          </Link>
          <button
            onClick={handleRefresh}
            style={{ fontSize: 11, color: 'var(--bt-accent)', background: 'transparent', border: '1px solid var(--bt-border)', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Performance summary */}
        <div style={{ marginBottom: 20 }}>
          <PerformanceSummary agents={agents} tasks={tasks} compliance={compliance} />
        </div>

        {/* Two-column: table + alerts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 20 }}>
          <AgentTable
            agents={agents}
            tasks={tasks}
            compliance={compliance}
            selectedAgentId={selectedAgentId}
            onSelect={handleSelectAgent}
          />
          <RiskAlertsPanel
            agents={agents}
            tasks={tasks}
            pipeline={pipeline}
            onSelectAgent={handleSelectAgent}
          />
        </div>

        {/* Agent detail panel — shown when agent selected */}
        {selectedAgent && (
          <AgentDetailPanel
            agent={selectedAgent}
            tasks={agentTasks}
            activityLog={agentLog}
            pipeline={agentPipeline}
            compliance={agentCompliance}
            onRefresh={handleRefresh}
          />
        )}
        {!selectedAgent && (
          <div style={{ padding: '20px', background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, fontSize: 13, color: 'var(--bt-text-dim)', textAlign: 'center' }}>
            Select an agent to view details and take action.
          </div>
        )}
      </div>
    </div>
  )
}
