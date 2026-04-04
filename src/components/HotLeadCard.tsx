'use client'

import type { Pipeline } from '@/types'

interface Props {
  lead: Pipeline
  urgencyColor: string
  sourceLabel: string
  onRefresh: () => void
  onAccept?: (leadId: string) => void
  canAccept?: boolean
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatCurrency(n?: number): string {
  if (!n) return ''
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export default function HotLeadCard({ lead, urgencyColor, sourceLabel, onAccept, canAccept = true }: Props) {
  const typeLabel = lead.hot_lead_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div style={{
      padding: '14px 18px',
      background: 'var(--bt-surface)',
      border: '1px solid var(--bt-border)',
      borderLeft: `3px solid ${urgencyColor}`,
      borderRadius: 6,
    }}>
      {/* Row 1: Name + badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--bt-text)' }}>
            {lead.lead_name}
          </span>

          {/* Urgency badge */}
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '2px 6px', borderRadius: 3,
            background: `${urgencyColor}22`, color: urgencyColor,
          }}>
            {lead.urgency}
          </span>

          {/* Type badge */}
          {typeLabel && (
            <span style={{
              fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '2px 6px', borderRadius: 3,
              background: 'rgba(160,132,232,0.15)', color: '#a084e8',
            }}>
              {typeLabel}
            </span>
          )}

          {/* Source badge */}
          <span style={{
            fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
            padding: '2px 6px', borderRadius: 3,
            background: 'rgba(107,156,245,0.12)', color: '#6b9cf5',
          }}>
            {sourceLabel}
          </span>
        </div>

        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', whiteSpace: 'nowrap' }}>
          {lead.scraped_at ? timeAgo(lead.scraped_at) : timeAgo(lead.created_at)}
        </div>
      </div>

      {/* Row 2: Details */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {lead.property_address && (
          <div style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>
            {lead.property_address}{lead.zip_code ? ` ${lead.zip_code}` : ''}
          </div>
        )}
        {lead.arv && (
          <div style={{ fontSize: 12, color: '#4fbf8a', fontWeight: 600 }}>
            ARV: {formatCurrency(lead.arv)}
          </div>
        )}
        {lead.phone && (
          <div style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>{lead.phone}</div>
        )}
        {lead.email && (
          <div style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>{lead.email}</div>
        )}
      </div>

      {/* Row 3: Pain point / notes */}
      {(lead.pain_point ?? lead.notes) && (
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 6, lineHeight: 1.5 }}>
          {(lead.pain_point ?? lead.notes)?.slice(0, 200)}
        </div>
      )}

      {/* Row 4: Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {lead.source_url && (
          <a
            href={lead.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10, padding: '3px 8px', border: '1px solid var(--bt-border)',
              borderRadius: 3, color: 'var(--bt-text-dim)', textDecoration: 'none',
            }}
          >
            View Source
          </a>
        )}
        {onAccept && canAccept && (
          <button
            onClick={() => onAccept(lead.id)}
            style={{
              fontSize: 10, fontWeight: 600, padding: '4px 12px',
              background: '#4CAF50', color: '#fff', border: 'none',
              borderRadius: 3, cursor: 'pointer',
            }}
          >
            Accept Lead
          </button>
        )}
        {onAccept && !canAccept && (
          <span style={{ fontSize: 10, padding: '4px 8px', color: 'var(--bt-muted)' }}>
            Daily limit reached
          </span>
        )}
      </div>
    </div>
  )
}
