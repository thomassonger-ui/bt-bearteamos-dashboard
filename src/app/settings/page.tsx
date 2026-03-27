import Sidebar from '@/components/Sidebar'
import { MOCK_AGENT } from '@/lib/mockData'
import { getPhaseLabel } from '@/lib/engine'

export default function SettingsPage() {
  const agent = MOCK_AGENT

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Settings
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Agent Profile</div>
          </div>

          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
            {[
              { label: 'Name', value: agent.name },
              { label: 'Email', value: agent.email },
              { label: 'Agent ID', value: agent.id },
              { label: 'Onboarding Stage', value: agent.onboarding_stage },
              { label: 'Phase', value: getPhaseLabel(agent.onboarding_stage) },
              { label: 'Onboarding Day', value: `Day ${agent.onboarding_day}` },
              { label: 'Performance Score', value: `${agent.performance_score}/100 (placeholder)` },
              { label: 'Compliance Rate', value: `${agent.compliance_rate}% (placeholder)` },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '14px 20px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--bt-border)' : 'none',
              }}>
                <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', width: 160, flexShrink: 0 }}>{row.label}</div>
                <div style={{ fontSize: 13, color: 'var(--bt-text)', textAlign: 'right' }}>{row.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              System Info
            </div>
            {[
              { label: 'Version', value: 'BearTeamOS v1.0 — Phase 1' },
              { label: 'Auth', value: 'Placeholder (no real auth)' },
              { label: 'Database', value: 'None — mock data only' },
              { label: 'Integrations', value: 'None — Phase 2' },
              { label: 'AI Layer', value: 'None — Phase 2 (Scout)' },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--bt-border)' : 'none',
              }}>
                <div style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>{row.label}</div>
                <div style={{ fontSize: 12, color: 'var(--bt-accent)' }}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
