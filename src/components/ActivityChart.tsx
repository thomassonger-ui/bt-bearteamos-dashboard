'use client'

import { useEffect, useState } from 'react'

interface Bucket {
  week: string
  calls: number
  closings: number
  target: number
}

interface Props {
  agentId: string
  onLogCall: () => void
  logCallLoading: boolean
}

// Color based on calls vs 35-call target
function barColor(calls: number, target: number): string {
  const pct = calls / target
  if (pct >= 0.8) return 'var(--bt-green)'
  if (pct >= 0.5) return '#e0a040'
  return 'var(--bt-red)'
}

export default function ActivityChart({ agentId, onLogCall, logCallLoading }: Props) {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/activity-chart?agentId=${agentId}`)
      .then(r => r.json())
      .then(d => { setBuckets(d.buckets ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [agentId])

  // Refresh when parent signals a new call was logged
  useEffect(() => {
    if (!logCallLoading) {
      fetch(`/api/activity-chart?agentId=${agentId}`)
        .then(r => r.json())
        .then(d => setBuckets(d.buckets ?? []))
    }
  }, [logCallLoading, agentId])

  const maxCalls = Math.max(35, ...buckets.map(b => b.calls))
  const totalCalls    = buckets.reduce((s, b) => s + b.calls, 0)
  const totalClosings = buckets.reduce((s, b) => s + b.closings, 0)

  return (
    <div style={{
      background: 'var(--bt-surface)',
      border: '1px solid var(--bt-border)',
      borderRadius: 6,
      padding: '16px 20px',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            90-Day Activity
          </div>
          <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginTop: 2 }}>
            {totalCalls} calls · {totalClosings} closings · 35 calls = 1 closing
          </div>
        </div>
        <button
          onClick={onLogCall}
          disabled={logCallLoading}
          style={{
            padding: '7px 16px',
            background: logCallLoading ? 'var(--bt-muted)' : 'var(--bt-accent)',
            color: 'var(--bt-black)',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            cursor: logCallLoading ? 'not-allowed' : 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          {logCallLoading ? 'Logging…' : '+ Log Call'}
        </button>
      </div>

      {/* Chart */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
          {buckets.map((b, i) => {
            const callHeight  = maxCalls > 0 ? (b.calls / maxCalls) * 72 : 2
            const hasClosing  = b.closings > 0
            const color       = barColor(b.calls, b.target)
            const isLast      = i === buckets.length - 1
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative' }}>
                {/* Closing dot */}
                {hasClosing && (
                  <div title={`${b.closings} closing${b.closings > 1 ? 's' : ''}`} style={{
                    position: 'absolute',
                    top: 0,
                    width: 6, height: 6,
                    borderRadius: '50%',
                    background: 'var(--bt-green)',
                    border: '1px solid var(--bt-surface)',
                  }} />
                )}
                {/* Call bar */}
                <div style={{
                  width: '100%',
                  height: Math.max(callHeight, 2),
                  background: color,
                  borderRadius: '2px 2px 0 0',
                  opacity: isLast ? 1 : 0.85,
                  transition: 'height 0.3s ease',
                }} title={`${b.week}: ${b.calls} calls`} />
                {/* Week label — show every 3rd */}
                {i % 3 === 0 && (
                  <div style={{ fontSize: 8, color: 'var(--bt-text-dim)', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {b.week}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        {[
          { color: 'var(--bt-green)',  label: '≥ 28 calls (80%+)' },
          { color: '#e0a040',          label: '18–27 calls (50–79%)' },
          { color: 'var(--bt-red)',    label: '< 18 calls (< 50%)' },
          { color: 'var(--bt-green)',  label: '● Closing', dot: true },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {l.dot
              ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />
              : <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, opacity: 0.85 }} />
            }
            <span style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
