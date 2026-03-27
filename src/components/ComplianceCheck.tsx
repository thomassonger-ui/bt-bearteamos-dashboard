'use client'

import type { ComplianceRecord } from '@/types'
import { formatDate } from '@/lib/engine'

interface Props {
  records: ComplianceRecord[]
  onComplete: (complianceId: string) => Promise<void>
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'var(--bt-green)',
  pending: 'var(--bt-red)',
}

export default function ComplianceCheck({ records, onComplete }: Props) {
  const completed = records.filter((r) => r.status === 'completed').length

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bt-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Compliance</div>
        <div style={{ fontSize: 11, color: completed === records.length && records.length > 0 ? 'var(--bt-green)' : 'var(--bt-red)', fontWeight: 600 }}>
          {completed}/{records.length}
        </div>
      </div>

      <div>
        {records.length === 0 && (
          <div style={{ padding: '20px', fontSize: 13, color: 'var(--bt-text-dim)', textAlign: 'center' }}>
            No compliance records. Add them in the database.
          </div>
        )}
        {records.map((record, i) => (
          <div key={record.id} style={{
            padding: '14px 20px',
            borderBottom: i < records.length - 1 ? '1px solid var(--bt-border)' : 'none',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0, background: STATUS_COLOR[record.status] }} />
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
              {record.completed_at && (
                <div style={{ fontSize: 11, color: 'var(--bt-green)' }}>✓ {formatDate(record.completed_at)}</div>
              )}
              {!record.completed_at && record.due_date && (
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>
                  Due: {new Date(record.due_date).toLocaleDateString()}
                </div>
              )}
            </div>
            {record.status !== 'completed' && (
              <button
                onClick={() => onComplete(record.id)}
                style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--bt-green)', background: 'transparent', color: 'var(--bt-green)', borderRadius: 3, cursor: 'pointer', flexShrink: 0 }}
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
