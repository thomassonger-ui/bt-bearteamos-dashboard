'use client'

import { useState } from 'react'
import type { Pipeline } from '@/types'

const STAGES = [
  { key: 'new_lead', label: 'New Lead', color: 'var(--bt-accent)' },
  { key: 'attempting_contact', label: 'Attempting', color: '#FF9800' },
  { key: 'contacted', label: 'Contacted', color: '#6b9cf5' },
  { key: 'appointment_set', label: 'Appt Set', color: '#a084e8' },
  { key: 'active_client', label: 'Active', color: '#FF9800' },
  { key: 'under_contract', label: 'Under Contract', color: '#4CAF50' },
]

interface Props {
  pipeline: Pipeline[]
  onContact?: (id: string, name: string) => Promise<void>
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export default function MobilePipeline({ pipeline, onContact }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? pipeline.filter(p => p.lead_name.toLowerCase().includes(search.toLowerCase()))
    : pipeline

  return (
    <div style={{ padding: '12px' }}>
      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search leads..."
        style={{
          width: '100%', padding: '10px 14px', fontSize: 14,
          background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
          color: 'var(--bt-text)', borderRadius: 6, outline: 'none',
          fontFamily: 'inherit', marginBottom: 12,
        }}
      />

      {/* Stage groups */}
      {STAGES.map(stage => {
        const leads = filtered.filter(p => p.stage === stage.key)
        if (leads.length === 0) return null

        return (
          <div key={stage.key} style={{ marginBottom: 16 }}>
            {/* Stage header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 0', borderBottom: `2px solid ${stage.color}`, marginBottom: 8,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: stage.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {stage.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--bt-text-dim)' }}>{leads.length}</span>
            </div>

            {/* Lead cards */}
            {leads.map(lead => {
              const d = daysSince(lead.last_contact)
              const expanded = expandedId === lead.id
              const dotColor = d === 0 ? '#4CAF50' : d >= 3 ? '#E04E4E' : '#FF9800'

              return (
                <div key={lead.id} style={{
                  background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
                  borderRadius: 6, marginBottom: 6, overflow: 'hidden',
                }}>
                  {/* Card header — always visible */}
                  <div
                    onClick={() => setExpandedId(expanded ? null : lead.id)}
                    style={{
                      padding: '12px 14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.lead_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 1 }}>
                          {lead.lead_type?.toUpperCase() || ''} &middot; {d === 0 ? 'Today' : `${d}d ago`}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, color: 'var(--bt-text-dim)' }}>{expanded ? '\u25B2' : '\u25BC'}</span>
                  </div>

                  {/* Expanded details */}
                  {expanded && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--bt-border)' }}>
                      {/* Contact info */}
                      <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {lead.phone && (
                          <a href={`tel:${lead.phone.replace(/\D/g, '')}`} style={{
                            fontSize: 13, color: 'var(--bt-accent)', textDecoration: 'none',
                          }}>Call: {lead.phone}</a>
                        )}
                        {lead.phone && (
                          <a href={`sms:${lead.phone.replace(/\D/g, '')}`} style={{
                            fontSize: 13, color: 'var(--bt-accent)', textDecoration: 'none',
                          }}>Text: {lead.phone}</a>
                        )}
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} style={{
                            fontSize: 13, color: 'var(--bt-accent)', textDecoration: 'none',
                          }}>Email: {lead.email}</a>
                        )}
                      </div>

                      {/* Notes */}
                      {lead.notes && (
                        <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginBottom: 10, lineHeight: 1.4 }}>
                          {lead.notes}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => onContact?.(lead.id, lead.lead_name)}
                          style={{
                            flex: 1, padding: '10px', fontSize: 12, fontWeight: 600,
                            background: '#26A69A', color: '#fff', border: 'none',
                            borderRadius: 4, cursor: 'pointer',
                          }}
                        >Log Contact</button>
                        {lead.phone && (
                          <a href={`tel:${lead.phone.replace(/\D/g, '')}`} style={{
                            flex: 1, padding: '10px', fontSize: 12, fontWeight: 600,
                            background: '#1976D2', color: '#fff', border: 'none',
                            borderRadius: 4, textAlign: 'center', textDecoration: 'none',
                          }}>Call Now</a>
                        )}
                        {lead.phone && (
                          <a href={`sms:${lead.phone.replace(/\D/g, '')}`} style={{
                            flex: 1, padding: '10px', fontSize: 12, fontWeight: 600,
                            background: '#37474F', color: '#fff', border: 'none',
                            borderRadius: 4, textAlign: 'center', textDecoration: 'none',
                          }}>Text</a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--bt-text-dim)' }}>
          {search ? 'No leads match your search.' : 'No leads yet.'}
        </div>
      )}
    </div>
  )
}
