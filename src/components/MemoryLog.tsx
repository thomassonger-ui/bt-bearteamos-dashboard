'use client'

import type { ActivityLog } from '@/types'
import { formatDate } from '@/lib/engine'

interface Props {
  log: ActivityLog[]
}

const OUTCOME_COLOR: Record<string, string> = {
  success: 'var(--bt-green)',
  failure: 'var(--bt-red)',
  neutral: 'var(--bt-text-dim)',
}

const ACTION_LABEL: Record<string, string> = {
  task_completed: 'Task Completed',
  task_missed: 'Task Missed',
  pipeline_update: 'Pipeline Update',
  compliance_completed: 'Compliance Completed',
  login: 'Session Started',
  recovery: 'Recovery Triggered',
}

export default function MemoryLog({ log }: Props) {
  const sorted = [...log].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bt-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Memory Log
        </div>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>{log.length} entries</div>
      </div>

      <div>
        {sorted.length === 0 && (
          <div style={{ padding: '20px', fontSize: 13, color: 'var(--bt-text-dim)', textAlign: 'center' }}>
            No activity recorded yet.
          </div>
        )}
        {sorted.map((entry, i) => (
          <div key={entry.id} style={{
            padding: '12px 20px',
            borderBottom: i < sorted.length - 1 ? '1px solid var(--bt-border)' : 'none',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            {/* Outcome dot */}
            <div style={{
              width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0,
              background: OUTCOME_COLOR[entry.outcome],
            }} />

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--bt-accent)', letterSpacing: '0.06em', marginBottom: 2 }}>
                {ACTION_LABEL[entry.action_type] ?? entry.action_type.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div style={{ fontSize: 13, color: 'var(--bt-text)', marginBottom: 2 }}>
                {entry.description}
              </div>
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>
                {formatDate(entry.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
