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
import { rankLeads, generateAlerts } from '@/lib/intelligence'
import type { RankedLead, LeadAlert } from '@/lib/intelligence'
import type { Agent, Task, ComplianceRecord, Pipeline, ActivityLog } from '@/types'

export default function BrokerPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [compliance, setCompliance] = useState<ComplianceRecord[]>([])
  const [pipeline, setPipeline] = useState<Pipeline[]>([])
  const [rankedLeads, setRankedLeads] = useState<RankedLead[]>([])
  const [alerts, setAlerts] = useState<LeadAlert[]>([])
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
    setRankedLeads(rankLeads(p))
    setAlerts(generateAlerts(p))
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
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bt-black)' }}>
        <div style={{ fontSize: 13, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Loading broker view…
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bt-black)' }}>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Scout Lead Intelligence Alerts */}
        {alerts.length > 0 && (
          <div style={{ marginBottom: 20, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Scout Lead Alerts — {alerts.length} active
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {alerts.map((alert) => {
                const colors: Record<string, string> = {
                  high: '#ef4444',
                  stale: '#f59e0b',
                  low: '#3b82f6',
                }
                const icons: Record<string, string> = { high: '🔴', stale: '🟡', low: '🔵' }
                return (
                  <div
                    key={`${alert.type}-${alert.leadId}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontSize: 12, color: 'var(--bt-text)',
                      padding: '6px 10px', borderRadius: 4,
                      borderLeft: `3px solid ${colors[alert.type]}`,
                      background: 'var(--bt-black)',
                    }}
                  >
                    <span>{icons[alert.type]}</span>
                    <span style={{ fontWeight: 600, color: colors[alert.type], textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>
                      {alert.type}
                    </span>
                    <span style={{ color: 'var(--bt-text-dim)' }}>—</span>
                    <span>{alert.message}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--bt-text-dim)', fontFamily: 'monospace' }}>
                      {alert.leadId.slice(0, 8)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
    </div>
  )
}
