'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { getFirstAgent, getAgent } from '@/lib/queries'
import { getPhaseLabel } from '@/lib/engine'
import type { Agent } from '@/types'

export default function SettingsPage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const storedId = sessionStorage.getItem('bt_agent_id')
      const agentData = storedId ? await getAgent(storedId) : await getFirstAgent()
      setAgent(agentData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding: 40, color: 'var(--bt-text-dim)' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Settings</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Agent Profile</div>
          </div>

          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
            {agent && [
              { label: 'Name', value: agent.name },
              { label: 'Email', value: agent.email },
              { label: 'Agent ID', value: agent.id },
              { label: 'Stage', value: agent.stage },
              { label: 'Onboarding Day', value: `Day ${agent.onboarding_stage ?? 0}` },
              { label: 'Phase', value: getPhaseLabel(agent.onboarding_stage ?? 0) },
              { label: 'Start Date', value: agent.start_date ?? '—' },
              { label: 'Last Active', value: agent.last_active ? new Date(agent.last_active).toLocaleString() : '—' },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '14px 20px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--bt-border)' : 'none',
              }}>
                <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', width: 160, flexShrink: 0 }}>{row.label}</div>
                <div style={{ fontSize: 13, color: 'var(--bt-text)', textAlign: 'right', wordBreak: 'break-all' }}>{row.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>System Info</div>
            {[
              { label: 'Version', value: 'BearTeamOS v2.0 — Phase 2' },
              { label: 'Database', value: 'Supabase (Postgres) — Live' },
              { label: 'Auth', value: 'Placeholder — Phase 3' },
              { label: 'Engine', value: '4 rules active' },
              { label: 'AI Layer', value: 'None — Phase 3 (Scout)' },
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
