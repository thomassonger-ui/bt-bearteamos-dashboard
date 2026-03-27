'use client'

import type { Agent, Task, ComplianceRecord } from '@/types'
import { relativeTime } from '@/lib/engine'

interface AgentRow {
  agent: Agent
  totalTasks: number
  overdueTasks: number
  missedTasks: number
  compliancePending: number
  inactive: boolean   // last_active > 24h
  atRisk: boolean     // missed > 3 OR overdue > 3
}

interface Props {
  agents: Agent[]
  tasks: Task[]
  compliance: ComplianceRecord[]
  selectedAgentId: string | null
  onSelect: (agentId: string) => void
}

const h24 = 24 * 60 * 60 * 1000

function scoreTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'High Performer', color: 'var(--bt-green)' }
  if (score >= 50) return { label: 'Active',         color: 'var(--bt-accent)' }
  if (score >= 1)  return { label: 'At Risk',        color: 'var(--bt-yellow)' }
  return               { label: 'Inactive',          color: 'var(--bt-text-dim)' }
}

export default function AgentTable({ agents, tasks, compliance, selectedAgentId, onSelect }: Props) {
  const now = Date.now()

  const rows: AgentRow[] = agents.map((agent) => {
    const agentTasks = tasks.filter((t) => t.agent_id === agent.id)
    const overdue = agentTasks.filter((t) => t.status === 'overdue').length
    const missed = agentTasks.filter((t) => t.status === 'missed').length
    const compPending = compliance.filter((c) => c.agent_id === agent.id && c.status === 'pending').length
    const inactive = !agent.last_active || now - new Date(agent.last_active).getTime() >= h24

    return {
      agent,
      totalTasks: agentTasks.length,
      overdueTasks: overdue,
      missedTasks: missed,
      compliancePending: compPending,
      inactive,
      atRisk: missed > 3 || overdue > 3,
    }
  })

  // Sort by performance_score DESC
  rows.sort((a, b) => (b.agent.performance_score ?? 0) - (a.agent.performance_score ?? 0))

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 80px 100px 70px 80px 80px 80px 80px',
        padding: '10px 16px', borderBottom: '1px solid var(--bt-border)',
        fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        <div>Agent</div>
        <div>Stage</div>
        <div>Last Active</div>
        <div style={{ textAlign: 'center' }}>Score</div>
        <div style={{ textAlign: 'center' }}>Tasks</div>
        <div style={{ textAlign: 'center' }}>Overdue</div>
        <div style={{ textAlign: 'center' }}>Missed</div>
        <div style={{ textAlign: 'center' }}>Compliance</div>
      </div>

      {/* Rows */}
      {rows.map((row) => {
        const isSelected = selectedAgentId === row.agent.id
        const rowBg = isSelected
          ? 'rgba(200, 169, 110, 0.08)'
          : row.atRisk
          ? 'rgba(224, 82, 82, 0.04)'
          : row.inactive
          ? 'rgba(224, 168, 74, 0.04)'
          : 'transparent'
        const borderLeft = isSelected
          ? '2px solid var(--bt-accent)'
          : row.atRisk
          ? '2px solid var(--bt-red)'
          : row.inactive
          ? '2px solid var(--bt-yellow)'
          : '2px solid transparent'

        const score = row.agent.performance_score ?? 0
        const tier = scoreTier(score)

        return (
          <div
            key={row.agent.id}
            onClick={() => onSelect(row.agent.id)}
            style={{
              display: 'grid', gridTemplateColumns: '2fr 80px 100px 70px 80px 80px 80px 80px',
              padding: '12px 16px', borderBottom: '1px solid var(--bt-border)',
              cursor: 'pointer', background: rowBg, borderLeft,
              alignItems: 'center',
            }}
          >
            {/* Name + flags */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{row.agent.name}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                {row.inactive && (
                  <span style={{ fontSize: 9, color: 'var(--bt-yellow)', letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid var(--bt-yellow)', padding: '1px 5px', borderRadius: 3 }}>
                    INACTIVE
                  </span>
                )}
                {row.atRisk && (
                  <span style={{ fontSize: 9, color: 'var(--bt-red)', letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid var(--bt-red)', padding: '1px 5px', borderRadius: 3 }}>
                    AT RISK
                  </span>
                )}
              </div>
            </div>

            {/* Stage */}
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>
              Day {row.agent.onboarding_stage ?? 0}
            </div>

            {/* Last active */}
            <div style={{ fontSize: 12, color: row.inactive ? 'var(--bt-yellow)' : 'var(--bt-text-dim)' }}>
              {row.agent.last_active ? relativeTime(row.agent.last_active) : 'Never'}
            </div>

            {/* Score */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tier.color }}>{score}</div>
              <div style={{ fontSize: 9, color: tier.color, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 1 }}>{tier.label}</div>
            </div>

            {/* Counts */}
            <div style={{ textAlign: 'center', fontSize: 13 }}>{row.totalTasks}</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: row.overdueTasks > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)', fontWeight: row.overdueTasks > 3 ? 700 : 400 }}>
              {row.overdueTasks}
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, color: row.missedTasks > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)', fontWeight: row.missedTasks > 3 ? 700 : 400 }}>
              {row.missedTasks}
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, color: row.compliancePending > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)' }}>
              {row.compliancePending}
            </div>
          </div>
        )
      })}

      {rows.length === 0 && (
        <div style={{ padding: '24px 16px', fontSize: 13, color: 'var(--bt-text-dim)', textAlign: 'center' }}>
          No agents in system.
        </div>
      )}
    </div>
  )
}
