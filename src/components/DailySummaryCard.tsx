'use client'

import type { Agent, Task, ComplianceRecord } from '@/types'
import { getPhaseLabel, relativeTime } from '@/lib/engine'

interface Props {
  agent: Agent
  tasks: Task[]
  compliance: ComplianceRecord[]
}

export default function DailySummaryCard({ agent, tasks, compliance }: Props) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'overdue')
  const overdue = tasks.filter((t) => t.status === 'overdue')
  const completed = tasks.filter((t) => t.status === 'completed')
  const complianceMissing = compliance.filter(
    (c) => c.status === 'missing' || c.status === 'late'
  )

  const lastActive = relativeTime(agent.last_active)

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            Daily Briefing
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--bt-text)' }}>
            {today}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginBottom: 2 }}>Last Active</div>
          <div style={{ fontSize: 13, color: overdue.length > 0 ? 'var(--bt-yellow)' : 'var(--bt-text-dim)' }}>
            {lastActive}
          </div>
        </div>
      </div>

      {/* Agent + Phase */}
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--bt-border)' }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{agent.name}</div>
        <div style={{ fontSize: 12, color: 'var(--bt-accent)' }}>{getPhaseLabel(agent.onboarding_stage)}</div>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>Day {agent.onboarding_day} of onboarding</div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatBox label="Required Today" value={pending.length} color={pending.length > 0 ? 'var(--bt-text)' : 'var(--bt-green)'} />
        <StatBox label="Overdue" value={overdue.length} color={overdue.length > 0 ? 'var(--bt-red)' : 'var(--bt-green)'} />
        <StatBox label="Completed" value={completed.length} color="var(--bt-green)" />
        <StatBox label="Compliance Gaps" value={complianceMissing.length} color={complianceMissing.length > 0 ? 'var(--bt-red)' : 'var(--bt-green)'} />
      </div>

      {/* Alert Banner */}
      {overdue.length > 0 && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 4, fontSize: 13, color: 'var(--bt-red)' }}>
          ⚠ {overdue.length} overdue item{overdue.length > 1 ? 's' : ''} require immediate action.
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'var(--bt-muted)', borderRadius: 4, padding: '12px 14px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
