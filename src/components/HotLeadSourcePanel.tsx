'use client'

import type { HotLeadSource } from '@/types'

interface Props {
  sources: HotLeadSource[]
}

const STATUS_COLOR: Record<string, string> = {
  success: '#4fbf8a',
  failed: '#e05252',
  partial: '#e0a040',
}

export default function HotLeadSourcePanel({ sources }: Props) {
  if (sources.length === 0) return null

  return (
    <div style={{
      background: 'var(--bt-surface)',
      border: '1px solid var(--bt-border)',
      borderRadius: 6,
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bt-border)' }}>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Sources
        </div>
      </div>

      <div style={{ padding: '12px 18px' }}>
        {sources.map(s => (
          <div key={s.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid var(--bt-border)',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--bt-text)' }}>
                {s.source_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>
                {s.apify_actor_id ?? 'No actor configured'} &middot; {s.run_frequency}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: s.is_active
                    ? (STATUS_COLOR[s.last_run_status ?? ''] ?? 'var(--bt-text-dim)')
                    : 'var(--bt-text-dim)',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>
                  {s.is_active ? (s.last_run_status ?? 'pending') : 'inactive'}
                </span>
              </div>
              {s.last_run_at && (
                <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 2 }}>
                  {s.leads_found} leads &middot; {new Date(s.last_run_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
