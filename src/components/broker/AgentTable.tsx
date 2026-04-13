'use client'

import { useState } from 'react'
import type { Agent, Task, ComplianceRecord } from '@/types'
import { relativeTime } from '@/lib/engine'

interface AgentRow {
  agent: Agent
  totalTasks: number
  overdueTasks: number
  missedTasks: number
  compliancePending: number
  inactive: boolean
  atRisk: boolean
}

interface Props {
  agents: Agent[]
  tasks: Task[]
  compliance: ComplianceRecord[]
  selectedAgentId: string | null
  onSelect: (agentId: string) => void
  onDelete?: (agentId: string, agentName: string) => Promise<void>
}

const h24 = 24 * 60 * 60 * 1000

function scoreTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'High Performer', color: 'var(--bt-green)' }
  if (score >= 50) return { label: 'Active',         color: 'var(--bt-accent)' }
  if (score >= 1)  return { label: 'At Risk',        color: 'var(--bt-yellow)' }
  return               { label: 'Inactive',          color: 'var(--bt-text-dim)' }
}

export default function AgentTable({ agents, tasks, compliance, selectedAgentId, onSelect, onDelete }: Props) {
  const now = Date.now()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

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

  rows.sort((a, b) => (b.agent.performance_score ?? 0) - (a.agent.performance_score ?? 0))

  const handleDeleteClick = (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation()
    setConfirmId(agentId)
  }

  const handleConfirmDelete = async (e: React.MouseEvent, agentId: string, agentName: string) => {
    e.stopPropagation()
    if (!onDelete) return
    setDeletingId(agentId)
    setConfirmId(null)
    try {
      await onDelete(agentId, agentName)
    } finally {
      setDeletingId(null)
    }
  }

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmId(null)
  }

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 80px 100px 70px 80px 80px 80px 80px 60px',
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
        <div style={{ textAlign: 'center' }}>Action</div>
      </div>

      {/* Rows */}
      {rows.map((row) => {
        const isSelected = selectedAgentId === row.agent.id
        const isConfirming = confirmId === row.agent.id
        const isDeleting = deletingId === row.agent.id
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
          <div key={row.agent.id}>
            <div
              onClick={() => onSelect(row.agent.id)}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 80px 100px 70px 80px 80px 80px 80px 60px',
                padding: '12px 16px', borderBottom: isConfirming ? 'none' : '1px solid var(--bt-border)',
                cursor: 'pointer', background: rowBg, borderLeft,
                alignItems: 'center', opacity: isDeleting ? 0.4 : 1,
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

              {/* Delete button */}
              <div style={{ textAlign: 'center' }}>
                {isDeleting ? (
                  <span style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>...</span>
                ) : (
                  <button
                    onClick={(e) => handleDeleteClick(e, row.agent.id)}
                    style={{
                      background: 'transparent', border: '1px solid var(--bt-red)',
                      color: 'var(--bt-red)', borderRadius: 4, padding: '3px 8px',
                      fontSize: 10, cursor: 'pointer', letterSpacing: '0.04em',
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>

            {/* Inline confirmation row */}
            {isConfirming && (
              <div style={{
                padding: '10px 16px', borderBottom: '1px solid var(--bt-border)',
                background: 'rgba(224, 82, 82, 0.08)',
                display: 'flex', alignItems: 'center', gap: 12, fontSize: 12,
              }}>
                <span style={{ color: 'var(--bt-red)', fontWeight: 600 }}>
                  Delete {row.agent.name}? This cannot be undone.
                </span>
                <button
                  onClick={(e) => handleConfirmDelete(e, row.agent.id, row.agent.name)}
                  style={{
                    background: 'var(--bt-red)', border: 'none', color: '#fff',
                    borderRadius: 4, padding: '4px 14px', fontSize: 11,
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Yes, Delete
                </button>
                <button
                  onClick={handleCancelDelete}
                  style={{
                    background: 'transparent', border: '1px solid var(--bt-border)',
                    color: 'var(--bt-text-dim)', borderRadius: 4, padding: '4px 14px',
                    fontSize: 11, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
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
