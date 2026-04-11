'use client'

import { useState } from 'react'
import type { Pipeline, Agent } from '@/types'

interface Props {
  lead: Pipeline
  urgencyColor: string
  sourceLabel: string
  onRefresh: () => void
  onAccept?: (leadId: string) => void
  canAccept?: boolean
  agents?: Agent[]
  onTransfer?: (leadId: string, agentId: string) => void
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

export default function HotLeadCard({ lead, urgencyColor, sourceLabel, onAccept, canAccept = true, agents, onTransfer }: Props) {
  const typeLabel = lead.hot_lead_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [transferred, setTransferred] = useState(false)

  async function handleTransfer(agentId: string) {
    if (!onTransfer) return
    setTransferring(true)
    setShowTransfer(false)
    await onTransfer(lead.id, agentId)
    setTransferring(false)
    setTransferred(true)
  }

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
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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

        {/* Transfer button — admin only, shown when agents prop is provided */}
        {agents && agents.length > 0 && onTransfer && !transferred && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTransfer(v => !v)}
              disabled={transferring}
              style={{
                fontSize: 10, fontWeight: 600, padding: '4px 12px',
                background: transferring ? 'var(--bt-surface)' : '#1976D2',
                color: transferring ? 'var(--bt-text-dim)' : '#fff',
                border: '1px solid #1976D2', borderRadius: 3, cursor: transferring ? 'default' : 'pointer',
              }}
            >
              {transferring ? 'Transferring…' : 'Transfer ▾'}
            </button>

            {showTransfer && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 200,
                background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
                borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                minWidth: 180, marginTop: 4,
              }}>
                <div style={{ padding: '6px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--bt-text-dim)', textTransform: 'uppercase', borderBottom: '1px solid var(--bt-border)' }}>
                  Assign to Agent
                </div>
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => handleTransfer(agent.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 12px', fontSize: 11, fontWeight: 500,
                      color: 'var(--bt-text)', background: 'transparent',
                      border: 'none', cursor: 'pointer',
                      borderBottom: '1px solid var(--bt-border)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {agent.name}
                    <span style={{ fontSize: 9, color: 'var(--bt-text-dim)', display: 'block' }}>
                      {agent.stage}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {transferred && (
          <span style={{ fontSize: 10, color: '#4fbf8a', fontWeight: 600 }}>✓ Transferred</span>
        )}
      </div>
    </div>
  )
}
