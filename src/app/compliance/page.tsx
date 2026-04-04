'use client'

import { useState, useEffect } from 'react'
import ResponsiveShell from '@/components/ResponsiveShell'
import ComplianceCheck from '@/components/ComplianceCheck'
import MemoryLog from '@/components/MemoryLog'
import { getFirstAgent, getAgent, getCompliance, updateComplianceStatus, getActivityLog, logActivity } from '@/lib/queries'
import type { Agent, ComplianceRecord, ActivityLog } from '@/types'

export default function CompliancePage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [records, setRecords] = useState<ComplianceRecord[]>([])
  const [auditLog, setAuditLog] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const storedId = sessionStorage.getItem('bt_agent_id')
      const agentData = storedId ? await getAgent(storedId) : await getFirstAgent()
      if (!agentData) { setLoading(false); return }
      const [complianceData, logData] = await Promise.all([
        getCompliance(agentData.id),
        getActivityLog(agentData.id, 50),
      ])
      setAgent(agentData)
      setRecords(complianceData)
      setAuditLog(logData.filter((l) => l.action_type === 'compliance_completed'))
      setLoading(false)
    }
    load()
  }, [])

  async function handleUpdate(complianceId: string) {
    await updateComplianceStatus(complianceId, 'completed')
    if (agent) {
      const record = records.find((r) => r.id === complianceId)
      if (record) {
        await logActivity({
          agent_id: agent.id,
          action_type: 'compliance_completed',
          description: `Compliance completed: ${record.requirement}`,
          outcome: 'success',
        })
      }
      const [fresh, freshLog] = await Promise.all([
        getCompliance(agent.id),
        getActivityLog(agent.id, 50),
      ])
      setRecords(fresh)
      setAuditLog(freshLog.filter((l) => l.action_type === 'compliance_completed'))
    }
  }

  const completed = records.filter((r) => r.status === 'completed').length
  const missing = records.filter((r) => r.status === 'pending').length

  if (loading) return <div style={{ padding: 40, color: 'var(--bt-text-dim)' }}>Loading…</div>

  return (
    <ResponsiveShell>
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', height: '100%' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Compliance</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{agent?.name ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginTop: 4 }}>Broker-visible audit trail. All actions logged to memory.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Requirements', value: records.length, color: 'var(--bt-text)' },
              { label: 'Completed', value: completed, color: 'var(--bt-green)' },
              { label: 'Pending', value: missing, color: missing > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <ComplianceCheck records={records} onComplete={handleUpdate} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Audit Log
              </div>
              <MemoryLog log={auditLog} />
            </div>
          </div>
        </div>
      </main>
    </ResponsiveShell>
  )
}
