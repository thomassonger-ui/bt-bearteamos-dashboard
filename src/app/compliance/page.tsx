'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import ComplianceCheck from '@/components/ComplianceCheck'
import MemoryLog from '@/components/MemoryLog'
import { MOCK_AGENT, MOCK_COMPLIANCE, MOCK_ACTIVITY_LOG } from '@/lib/mockData'
import type { ComplianceRecord, ActivityLog } from '@/types'

export default function CompliancePage() {
  const [records, setRecords] = useState<ComplianceRecord[]>(MOCK_COMPLIANCE)
  const [log, setLog] = useState<ActivityLog[]>(MOCK_ACTIVITY_LOG)

  const completed = records.filter((r) => r.status === 'completed').length
  const missing = records.filter((r) => r.status === 'missing').length
  const late = records.filter((r) => r.status === 'late').length

  function handleUpdate(updatedRecords: ComplianceRecord[], newLog: ActivityLog) {
    setRecords(updatedRecords)
    setLog((prev) => [newLog, ...prev])
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Compliance
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{MOCK_AGENT.name}</div>
            <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginTop: 4 }}>
              Broker-visible audit trail. All actions logged.
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Requirements', value: records.length, color: 'var(--bt-text)' },
              { label: 'Completed', value: completed, color: 'var(--bt-green)' },
              { label: 'Missing', value: missing, color: missing > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)' },
              { label: 'Late', value: late, color: late > 0 ? 'var(--bt-yellow)' : 'var(--bt-text-dim)' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <ComplianceCheck
              agentId={MOCK_AGENT.id}
              records={records}
              onUpdate={handleUpdate}
            />
            <div>
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Audit Log
              </div>
              <MemoryLog log={log.filter((l) => l.action_type === 'compliance_completed')} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
