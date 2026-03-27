'use client'

import type { Agent, Task, ComplianceRecord } from '@/types'

interface Props {
  agents: Agent[]
  tasks: Task[]
  compliance: ComplianceRecord[]
}

export default function PerformanceSummary({ agents, tasks, compliance }: Props) {
  const now = Date.now()
  const h24 = 24 * 60 * 60 * 1000

  const activeToday = agents.filter(
    (a) => a.last_active && now - new Date(a.last_active).getTime() < h24
  ).length

  const totalOverdue = tasks.filter((t) => t.status === 'overdue').length
  const totalMissed = tasks.filter((t) => t.status === 'missed').length
  const totalCompliancePending = compliance.filter((c) => c.status === 'pending').length

  // Performance score stats
  const avgScore = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + (a.performance_score ?? 0), 0) / agents.length)
    : 0

  const highPerformers = agents.filter((a) => (a.performance_score ?? 0) >= 80).length
  const active = agents.filter((a) => { const s = a.performance_score ?? 0; return s >= 50 && s < 80 }).length
  const atRisk = agents.filter((a) => { const s = a.performance_score ?? 0; return s >= 1 && s < 50 }).length
  const inactive = agents.filter((a) => (a.performance_score ?? 0) === 0).length

  const avgColor = avgScore >= 80 ? 'var(--bt-green)' : avgScore >= 50 ? 'var(--bt-accent)' : avgScore > 0 ? 'var(--bt-yellow)' : 'var(--bt-text-dim)'

  const stats = [
    { label: 'Total Agents',      value: agents.length,                  color: 'var(--bt-text)' },
    { label: 'Active Today',      value: activeToday,                    color: 'var(--bt-green)' },
    { label: 'Inactive (24h+)',   value: agents.length - activeToday,    color: agents.length - activeToday > 0 ? 'var(--bt-yellow)' : 'var(--bt-text-dim)' },
    { label: 'Total Overdue',     value: totalOverdue,                   color: totalOverdue > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)' },
    { label: 'Total Missed',      value: totalMissed,                    color: totalMissed > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)' },
    { label: 'Compliance Gaps',   value: totalCompliancePending,         color: totalCompliancePending > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)' },
    { label: 'Avg Score',         value: avgScore,                       color: avgColor },
    { label: 'High Performers',   value: highPerformers,                 color: highPerformers > 0 ? 'var(--bt-green)' : 'var(--bt-text-dim)' },
    { label: 'Active Tier',       value: active,                         color: active > 0 ? 'var(--bt-accent)' : 'var(--bt-text-dim)' },
    { label: 'At Risk Tier',      value: atRisk,                         color: atRisk > 0 ? 'var(--bt-yellow)' : 'var(--bt-text-dim)' },
    { label: 'Inactive Tier',     value: inactive,                       color: inactive > 0 ? 'var(--bt-text-dim)' : 'var(--bt-text-dim)' },
  ]

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
        Brokerage Overview
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: 'var(--bt-muted)', borderRadius: 4, padding: '12px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
