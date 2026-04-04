'use client'

import { useState } from 'react'
import type { RecruitLead } from '@/types'

const STAGES = [
  { key: 'new_lead', label: 'New Lead', color: 'var(--bt-accent)' },
  { key: 'outreach_sent', label: 'Outreach Sent', color: '#FF9800' },
  { key: 'active_convo', label: 'Active Convo', color: '#6b9cf5' },
  { key: 'call_scheduled', label: 'Call Scheduled', color: '#a084e8' },
  { key: 'booked', label: 'Booked', color: '#a084e8' },
  { key: 'offer_extended', label: 'Offer Extended', color: '#FF9800' },
  { key: 'closed_won', label: 'Closed Won', color: '#4CAF50' },
  { key: 'closed_lost', label: 'Closed Lost', color: '#E04E4E' },
  { key: 'revival_queue', label: 'Revival Queue', color: 'var(--bt-text-dim)' },
]

interface Props {
  leads: RecruitLead[]
  onStageChange: (leadId: string, stage: string) => Promise<void>
  onConvert: (leadId: string) => void
  onDraftOutreach: (lead: RecruitLead) => void
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export default function RecruitPipeline({ leads, onStageChange, onConvert, onDraftOutreach }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? leads.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || (l.email && l.email.toLowerCase().includes(search.toLowerCase())))
    : leads

  // Group by stage
  const grouped = STAGES.map(s => ({
    ...s,
    leads: filtered.filter(l => {
      const stage = l.stage || l.status || 'new_lead'
      return stage === s.key
    }),
  })).filter(g => g.leads.length > 0)

  // Unmatched leads
  const matchedKeys = new Set(STAGES.map(s => s.key))
  const unmatched = filtered.filter(l => !matchedKeys.has(l.stage || l.status || ''))

  const totalActive = leads.filter(l => !['closed_won', 'closed_lost'].includes(l.stage || l.status || '')).length

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Total Prospects', value: leads.length, color: 'var(--bt-text)' },
          { label: 'Active Pipeline', value: totalActive, color: 'var(--bt-accent)' },
          { label: 'Calls Scheduled', value: leads.filter(l => ['call_scheduled', 'booked'].includes(l.stage || l.status || '')).length, color: '#a084e8' },
          { label: 'Closed Won', value: leads.filter(l => (l.stage || l.status) === 'closed_won').length, color: '#4CAF50' },
          { label: 'Closed Lost', value: leads.filter(l => (l.stage || l.status) === 'closed_lost').length, color: '#E04E4E' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 5, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search recruits by name or email..."
        style={{
          width: '100%', padding: '8px 12px', fontSize: 12, marginBottom: 16,
          background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
          color: 'var(--bt-text)', borderRadius: 4, outline: 'none', fontFamily: 'inherit',
        }}
      />

      {/* Pipeline list grouped by stage */}
      {grouped.map(group => (
        <div key={group.key} style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 0', borderBottom: `2px solid ${group.color}`, marginBottom: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: group.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {group.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--bt-text-dim)' }}>{group.leads.length}</span>
          </div>

          {group.leads.map(lead => {
            const expanded = expandedId === lead.id
            const d = daysSince(lead.created_at)
            const stage = lead.stage || lead.status || 'new_lead'

            return (
              <div key={lead.id} style={{
                background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
                borderRadius: 6, marginBottom: 6, overflow: 'hidden',
              }}>
                {/* Header */}
                <div onClick={() => setExpandedId(expanded ? null : lead.id)} style={{
                  padding: '10px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{lead.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>
                      {lead.brokerage || 'Unknown brokerage'} &middot; {lead.deal_count ? `${lead.deal_count} deals/yr` : 'N/A'} &middot; {d}d ago
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>{expanded ? '\u25B2' : '\u25BC'}</span>
                </div>

                {/* Expanded */}
                {expanded && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--bt-border)' }}>
                    <div style={{ padding: '10px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                      <div><span style={{ color: 'var(--bt-text-dim)' }}>Email:</span> {lead.email || '\u2014'}</div>
                      <div><span style={{ color: 'var(--bt-text-dim)' }}>Phone:</span> {lead.phone || '\u2014'}</div>
                      <div><span style={{ color: 'var(--bt-text-dim)' }}>Source:</span> {lead.source || lead.entry_type || '\u2014'}</div>
                      <div><span style={{ color: 'var(--bt-text-dim)' }}>Tier:</span> {lead.tier || '\u2014'}</div>
                      <div><span style={{ color: 'var(--bt-text-dim)' }}>Avg Price:</span> {lead.avg_price ? `$${lead.avg_price.toLocaleString()}` : '\u2014'}</div>
                      <div><span style={{ color: 'var(--bt-text-dim)' }}>Top Objection:</span> {lead.top_objection || '\u2014'}</div>
                    </div>
                    {lead.notes && (
                      <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginBottom: 10, lineHeight: 1.4 }}>
                        {lead.notes}
                      </div>
                    )}

                    {/* Stage move */}
                    <div style={{ marginBottom: 10 }}>
                      <select
                        value={stage}
                        onChange={async (e) => { await onStageChange(lead.id, e.target.value) }}
                        style={{
                          padding: '6px 10px', fontSize: 11, background: 'var(--bt-surface)',
                          border: '1px solid var(--bt-border)', color: 'var(--bt-text)',
                          borderRadius: 4, outline: 'none', width: '100%',
                        }}
                      >
                        {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => onDraftOutreach(lead)} style={{
                        fontSize: 11, padding: '6px 12px', fontWeight: 600,
                        background: 'var(--bt-accent)', color: 'var(--bt-black)',
                        border: 'none', borderRadius: 4, cursor: 'pointer',
                      }}>Draft Outreach</button>

                      {lead.phone && (
                        <a href={`tel:${lead.phone.replace(/\D/g, '')}`} style={{
                          fontSize: 11, padding: '6px 12px', fontWeight: 600,
                          background: '#1976D2', color: '#fff', borderRadius: 4, textDecoration: 'none',
                        }}>Call</a>
                      )}

                      {lead.email && (
                        <a href={`mailto:${lead.email}`} style={{
                          fontSize: 11, padding: '6px 12px', fontWeight: 600,
                          background: 'var(--bt-border)', color: 'var(--bt-text-dim)',
                          borderRadius: 4, textDecoration: 'none',
                        }}>Email</a>
                      )}

                      {stage === 'closed_won' && !lead.onboarded_at && (
                        <button onClick={() => onConvert(lead.id)} style={{
                          fontSize: 11, padding: '6px 12px', fontWeight: 700,
                          background: '#4CAF50', color: '#fff',
                          border: 'none', borderRadius: 4, cursor: 'pointer',
                        }}>Convert to Agent</button>
                      )}

                      {lead.onboarded_at && (
                        <span style={{ fontSize: 10, padding: '6px 12px', color: '#4CAF50', fontWeight: 600 }}>
                          Onboarded
                        </span>
                      )}

                      {lead.calendly_event_uri && (
                        <span style={{ fontSize: 10, padding: '6px 8px', color: '#a084e8' }}>
                          Calendly booked
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Unmatched */}
      {unmatched.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 8, borderBottom: '2px solid var(--bt-border)', paddingBottom: 6 }}>
            Other ({unmatched.length})
          </div>
          {unmatched.map(lead => (
            <div key={lead.id} style={{ padding: '8px 14px', background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, marginBottom: 4, fontSize: 12 }}>
              {lead.name} &middot; {lead.email || 'No email'} &middot; Stage: {lead.stage || lead.status || 'unknown'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
