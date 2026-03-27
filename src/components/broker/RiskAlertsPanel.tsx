'use client'

import type { Agent, Task, Pipeline } from '@/types'

interface Props {
  agents: Agent[]
  tasks: Task[]
  pipeline: Pipeline[]
  onSelectAgent: (agentId: string) => void
}

const h24 = 24 * 60 * 60 * 1000
const h72 = 3 * 24 * 60 * 60 * 1000

export default function RiskAlertsPanel({ agents, tasks, pipeline, onSelectAgent }: Props) {
  const now = Date.now()

  // Inactive agents
  const inactiveAgents = agents.filter(
    (a) => !a.last_active || now - new Date(a.last_active).getTime() >= h24
  )

  // High missed tasks (>3)
  const highMissed = agents.filter((a) => {
    const count = tasks.filter((t) => t.agent_id === a.id && t.status === 'missed').length
    return count > 3
  })

  // High overdue tasks (>3)
  const highOverdue = agents.filter((a) => {
    const count = tasks.filter((t) => t.agent_id === a.id && t.status === 'overdue').length
    return count > 3
  })

  // Stale pipeline (3+ days no contact)
  const staleLeads = pipeline.filter(
    (p) => p.stage !== 'closed' && now - new Date(p.last_contact).getTime() >= h72
  )

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id

  const hasAlerts = inactiveAgents.length > 0 || highMissed.length > 0 || highOverdue.length > 0 || staleLeads.length > 0

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bt-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Risk Alerts
        </div>
        {hasAlerts && (
          <div style={{ fontSize: 11, color: 'var(--bt-red)', fontWeight: 600 }}>
            {inactiveAgents.length + highMissed.length + highOverdue.length + staleLeads.length} items
          </div>
        )}
      </div>

      <div style={{ padding: '12px 20px' }}>
        {!hasAlerts && (
          <div style={{ fontSize: 13, color: 'var(--bt-text-dim)', padding: '8px 0' }}>No active risk alerts.</div>
        )}

        {inactiveAgents.length > 0 && (
          <AlertSection title="Inactive 24h+" color="var(--bt-yellow)">
            {inactiveAgents.map((a) => {
              const hoursAgo = a.last_active
                ? Math.floor((now - new Date(a.last_active).getTime()) / (1000 * 60 * 60))
                : null
              return (
                <AlertRow key={a.id} onClick={() => onSelectAgent(a.id)}>
                  <span style={{ fontWeight: 500 }}>{a.name}</span>
                  <span style={{ color: 'var(--bt-text-dim)', fontSize: 12 }}>
                    {hoursAgo !== null ? `${hoursAgo}h inactive` : 'Never active'}
                  </span>
                </AlertRow>
              )
            })}
          </AlertSection>
        )}

        {highMissed.length > 0 && (
          <AlertSection title="High Missed Tasks (>3)" color="var(--bt-red)">
            {highMissed.map((a) => {
              const count = tasks.filter((t) => t.agent_id === a.id && t.status === 'missed').length
              return (
                <AlertRow key={a.id} onClick={() => onSelectAgent(a.id)}>
                  <span style={{ fontWeight: 500 }}>{a.name}</span>
                  <span style={{ color: 'var(--bt-red)', fontSize: 12 }}>{count} missed</span>
                </AlertRow>
              )
            })}
          </AlertSection>
        )}

        {highOverdue.length > 0 && (
          <AlertSection title="High Overdue Tasks (>3)" color="var(--bt-red)">
            {highOverdue.map((a) => {
              const count = tasks.filter((t) => t.agent_id === a.id && t.status === 'overdue').length
              return (
                <AlertRow key={a.id} onClick={() => onSelectAgent(a.id)}>
                  <span style={{ fontWeight: 500 }}>{a.name}</span>
                  <span style={{ color: 'var(--bt-red)', fontSize: 12 }}>{count} overdue</span>
                </AlertRow>
              )
            })}
          </AlertSection>
        )}

        {staleLeads.length > 0 && (
          <AlertSection title="Stale Pipeline (3+ days no contact)" color="var(--bt-yellow)">
            {staleLeads.map((lead) => {
              const days = Math.floor((now - new Date(lead.last_contact).getTime()) / (1000 * 60 * 60 * 24))
              return (
                <AlertRow key={lead.id} onClick={() => onSelectAgent(lead.agent_id)}>
                  <span style={{ fontWeight: 500 }}>{lead.lead_name}</span>
                  <span style={{ color: 'var(--bt-text-dim)', fontSize: 12 }}>
                    {agentName(lead.agent_id)} · {days}d ago · {lead.stage}
                  </span>
                </AlertRow>
              )
            })}
          </AlertSection>
        )}
      </div>
    </div>
  )
}

function AlertSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function AlertRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 10px', background: 'var(--bt-muted)', borderRadius: 4,
        marginBottom: 4, cursor: 'pointer',
      }}
    >
      {children}
    </div>
  )
}
