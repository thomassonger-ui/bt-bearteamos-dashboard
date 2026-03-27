'use client'

import Sidebar from '@/components/Sidebar'
import PipelineBoard from '@/components/PipelineBoard'
import { MOCK_AGENT, MOCK_PIPELINE } from '@/lib/mockData'

export default function PipelinePage() {
  const stalled = MOCK_PIPELINE.filter((p) => p.stage === 'stalled')

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Pipeline
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{MOCK_AGENT.name}</div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Leads', value: MOCK_PIPELINE.length },
              { label: 'Under Contract', value: MOCK_PIPELINE.filter((p) => p.stage === 'under_contract').length },
              { label: 'Stalled', value: stalled.length },
              { label: 'Closed', value: MOCK_PIPELINE.filter((p) => p.stage === 'closed').length },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.label === 'Stalled' && s.value > 0 ? 'var(--bt-red)' : 'var(--bt-text)' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {stalled.length > 0 && (
            <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 6, fontSize: 13, color: 'var(--bt-red)' }}>
              ⚠ {stalled.length} stalled lead{stalled.length > 1 ? 's' : ''} — intervention required.
            </div>
          )}

          <PipelineBoard pipeline={MOCK_PIPELINE} />
        </div>
      </main>
    </div>
  )
}
