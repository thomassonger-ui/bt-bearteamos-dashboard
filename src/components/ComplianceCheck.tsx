'use client'

import { useState } from 'react'
import type { ComplianceRecord, ActivityLog } from '@/types'
import { formatDate, createLogEntry } from '@/lib/engine'

interface Props {
  agentId: string
  records: ComplianceRecord[]
  onUpdate: (records: ComplianceRecord[], log: ActivityLog) => void
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'var(--bt-green)',
  missing: 'var(--bt-red)',
  late: 'var(--bt-yellow)',
}

export default function ComplianceCheck({ agentId, records, onUpdate }: Props) {
  const [localRecords, setLocalRecords] = useState<ComplianceRecord[]>(records)

  const completed = localRecords.filter((r) => r.status === 'completed').length
  const total = localRecords.length

  function markComplete(id: string) {
    const updated = localRecords.map((r) =>
      r.id === id
        ? { ...r, status: 'completed' as const, timestamp: new Date().toISOString() }
        : r
    )
    const record = localRecords.find((r) => r.id === id)!
    const log = createLogEntry(
      agentId,
      'compliance_completed',
      `Compliance completed: ${record.requirement}`,
      'success'
    )
    setLocalRecords(updated)
    onUpdate(updated, log)
  }

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bt-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Compliance
        </div>
        <div style={{
          fontSize: 11,
          color: completed === total ? 'var(--bt-green)' : 'var(--bt-red)',
          fontWeight: 600,
        }}>
          {completed}/{total}
        </div>
      </div>

      <div>
        {localRecords.map((record, i) => (
          <div key={record.id} style={{
            padding: '14px 20px',
            borderBottom: i < localRecords.length - 1 ? '1px solid var(--bt-border)' : 'none',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            {/* Status bar */}
            <div style={{
              width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
              background: STATUS_COLOR[record.status],
            }} />

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{record.requirement}</div>
                <div style={{ fontSize: 11, color: STATUS_COLOR[record.status], textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
                  {record.status}
                </div>
              </div>
              {record.notes && (
                <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginBottom: 4 }}>{record.notes}</div>
              )}
              {record.timestamp && (
                <div style={{ fontSize: 11, color: 'var(--bt-green)' }}>
                  ✓ {formatDate(record.timestamp)}
                </div>
              )}
              {!record.timestamp && (
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>
                  Due: {new Date(record.due_date).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Mark complete */}
            {record.status !== 'completed' && (
              <button
                onClick={() => markComplete(record.id)}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  border: '1px solid var(--bt-green)', background: 'transparent',
                  color: 'var(--bt-green)', borderRadius: 3, cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Complete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
