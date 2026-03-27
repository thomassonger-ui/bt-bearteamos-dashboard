'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import MemoryLog from '@/components/MemoryLog'
import { getFirstAgent, getAgent, getActivityLog } from '@/lib/queries'
import type { Agent, ActivityLog } from '@/types'

export default function MemoryPage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [log, setLog] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const storedId = sessionStorage.getItem('bt_agent_id')
      const agentData = storedId ? await getAgent(storedId) : await getFirstAgent()
      if (!agentData) { setLoading(false); return }
      const logData = await getActivityLog(agentData.id, 100)
      setAgent(agentData)
      setLog(logData)
      setLoading(false)
    }
    load()
  }, [])

  const successes = log.filter((l) => l.outcome === 'success').length
  const failures = log.filter((l) => l.outcome === 'failure').length

  if (loading) return <div style={{ padding: 40, color: 'var(--bt-text-dim)' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Memory</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{agent?.name ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginTop: 4 }}>
              All logged actions persist here and drive future task generation.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Entries', value: log.length, color: 'var(--bt-text)' },
              { label: 'Successes', value: successes, color: 'var(--bt-green)' },
              { label: 'Failures', value: failures, color: failures > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <MemoryLog log={log} />
        </div>
      </main>
    </div>
  )
}
