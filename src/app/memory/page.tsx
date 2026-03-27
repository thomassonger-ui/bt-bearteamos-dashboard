'use client'

import Sidebar from '@/components/Sidebar'
import MemoryLog from '@/components/MemoryLog'
import { MOCK_AGENT, MOCK_ACTIVITY_LOG } from '@/lib/mockData'

export default function MemoryPage() {
  const successes = MOCK_ACTIVITY_LOG.filter((l) => l.outcome === 'success').length
  const failures = MOCK_ACTIVITY_LOG.filter((l) => l.outcome === 'failure').length

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Memory
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{MOCK_AGENT.name}</div>
            <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginTop: 4 }}>
              All logged actions persist here and drive future task generation.
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Entries', value: MOCK_ACTIVITY_LOG.length, color: 'var(--bt-text)' },
              { label: 'Successes', value: successes, color: 'var(--bt-green)' },
              { label: 'Failures', value: failures, color: failures > 0 ? 'var(--bt-red)' : 'var(--bt-text-dim)' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <MemoryLog log={MOCK_ACTIVITY_LOG} />

          <div style={{ marginTop: 14, fontSize: 11, color: 'var(--bt-text-dim)', fontStyle: 'italic' }}>
            Memory persistence (database) — Phase 2
          </div>
        </div>
      </main>
    </div>
  )
}
