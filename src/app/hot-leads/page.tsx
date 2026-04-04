'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { Pipeline, HotLeadSource } from '@/types'
import ResponsiveShell from '@/components/ResponsiveShell'
import HotLeadCard from '@/components/HotLeadCard'
import HotLeadSourcePanel from '@/components/HotLeadSourcePanel'

const URGENCY_ORDER = { critical: 0, high: 1, normal: 2, low: 3 }
const URGENCY_COLOR: Record<string, string> = {
  critical: '#e05252',
  high: '#e0a040',
  normal: 'var(--bt-accent)',
  low: 'var(--bt-text-dim)',
}

const SOURCE_LABEL: Record<string, string> = {
  facebook_marketplace: 'Facebook Marketplace',
  craigslist: 'Craigslist',
  google_maps: 'Google Maps',
  county_appraisal: 'County Appraisal',
  newspaper: 'Newspaper',
}

export default function HotLeadsPage() {
  const [leads, setLeads] = useState<Pipeline[]>([])
  const [sources, setSources] = useState<HotLeadSource[]>([])
  const [filterSource, setFilterSource] = useState<string>('')
  const [filterUrgency, setFilterUrgency] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const fetchLeads = useCallback(async () => {
    let query = getSupabase()
      .from('pipeline')
      .select('*')
      .eq('is_hot_lead', true)
      .order('created_at', { ascending: false })

    if (filterSource) query = query.eq('lead_source', filterSource)
    if (filterUrgency) query = query.eq('urgency', filterUrgency)
    if (filterType) query = query.eq('hot_lead_type', filterType)

    const { data } = await query
    setLeads((data ?? []) as Pipeline[])
    setLoading(false)
  }, [filterSource, filterUrgency, filterType])

  const fetchSources = useCallback(async () => {
    const { data } = await getSupabase()
      .from('hot_lead_sources')
      .select('*')
      .order('source_name')
    setSources((data ?? []) as HotLeadSource[])
  }, [])

  useEffect(() => { fetchLeads(); fetchSources() }, [fetchLeads, fetchSources])

  const sorted = [...leads].sort((a, b) => {
    const ua = URGENCY_ORDER[a.urgency as keyof typeof URGENCY_ORDER] ?? 2
    const ub = URGENCY_ORDER[b.urgency as keyof typeof URGENCY_ORDER] ?? 2
    return ua - ub
  })

  const stats = {
    total: leads.length,
    critical: leads.filter(l => l.urgency === 'critical').length,
    high: leads.filter(l => l.urgency === 'high').length,
    today: leads.filter(l => {
      const d = new Date(l.created_at)
      const now = new Date()
      return d.toDateString() === now.toDateString()
    }).length,
  }

  // Unique lead types from data
  const leadTypes = [...new Set(leads.map(l => l.hot_lead_type).filter(Boolean))]

  return (
    <ResponsiveShell>
      <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
        {/* ═══ LEFT: Existing content ═══ */}
        <div>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--bt-text)', marginBottom: 4 }}>
            Hot Leads
          </h1>
          <p style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>
            Automated lead pipeline from Apify scrapers via n8n
          </p>
        </div>

        {/* Stats Bar */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Leads', value: stats.total, color: 'var(--bt-accent)' },
            { label: 'Critical', value: stats.critical, color: '#e05252' },
            { label: 'High Priority', value: stats.high, color: '#e0a040' },
            { label: 'New Today', value: stats.today, color: '#4fbf8a' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, padding: '14px 18px', background: 'var(--bt-surface)',
              border: '1px solid var(--bt-border)', borderRadius: 6,
            }}>
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Sources</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={filterUrgency}
            onChange={e => setFilterUrgency(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Urgency</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Types</option>
            {leadTypes.map(t => (
              <option key={t} value={t!}>{t!.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>

          {(filterSource || filterUrgency || filterType) && (
            <button
              onClick={() => { setFilterSource(''); setFilterUrgency(''); setFilterType('') }}
              style={{ fontSize: 11, padding: '6px 12px', border: '1px solid var(--bt-border)', background: 'transparent', color: 'var(--bt-text-dim)', borderRadius: 4, cursor: 'pointer' }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Lead List */}
        {loading ? (
          <div style={{ color: 'var(--bt-text-dim)', fontSize: 13, padding: 40, textAlign: 'center' }}>
            Loading hot leads...
          </div>
        ) : sorted.length === 0 ? (
          <div style={{
            padding: 40, textAlign: 'center', background: 'var(--bt-surface)',
            border: '1px solid var(--bt-border)', borderRadius: 6,
          }}>
            <div style={{ fontSize: 14, color: 'var(--bt-text-dim)', marginBottom: 8 }}>No hot leads yet</div>
            <div style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>
              Connect your Apify scrapers via n8n to start receiving leads
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map(lead => (
              <HotLeadCard
                key={lead.id}
                lead={lead}
                urgencyColor={URGENCY_COLOR[lead.urgency ?? 'normal']}
                sourceLabel={SOURCE_LABEL[lead.lead_source ?? ''] ?? lead.lead_source ?? ''}
                onRefresh={fetchLeads}
              />
            ))}
          </div>
        )}

        {/* Source Health Panel */}
        <div style={{ marginTop: 32 }}>
          <HotLeadSourcePanel sources={sources} />
        </div>
        </div>{/* end LEFT */}

        {/* ═══ RIGHT: Sources & Schedule ═══ */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Scraper Schedule</div>
            {[
              { label: 'Craigslist', schedule: 'Daily 7AM ET', active: true },
              { label: 'Google Maps', schedule: 'Weekly Mon 6AM ET', active: true },
              { label: 'Facebook Marketplace', schedule: 'Mon/Wed/Fri 6AM ET', active: true },
              { label: 'Newspaper', schedule: 'Disabled', active: false },
              { label: 'County Appraisal', schedule: 'Disabled', active: false },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--bt-border)',
                opacity: s.active ? 1 : 0.4,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>{s.schedule}</div>
                </div>
                <span style={{
                  fontSize: 8, fontWeight: 600, padding: '2px 5px', borderRadius: 2,
                  background: s.active ? 'rgba(76,175,80,0.15)' : 'rgba(224,82,82,0.15)',
                  color: s.active ? '#4CAF50' : '#E04E4E',
                }}>{s.active ? 'ACTIVE' : 'OFF'}</span>
              </div>
            ))}
          </div>

          {/* Source Stats */}
          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Leads by Source</div>
            {Object.entries({
              craigslist: 'Craigslist',
              google_maps: 'Google Maps',
              facebook_marketplace: 'Facebook',
              newspaper: 'Newspaper',
              county_appraisal: 'County',
            }).map(([key, label]) => {
              const count = leads.filter(l => l.lead_source === key).length
              return (
                <div key={key} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '6px 0', borderBottom: '1px solid var(--bt-border)',
                  fontSize: 12,
                }}>
                  <span style={{ color: count > 0 ? 'var(--bt-text)' : 'var(--bt-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: count > 0 ? 'var(--bt-accent)' : 'var(--bt-muted)' }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>{/* end RIGHT */}

        </div>{/* end grid */}
      </main>
    </ResponsiveShell>
  )
}

const selectStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '6px 12px',
  background: 'var(--bt-surface)',
  border: '1px solid var(--bt-border)',
  borderRadius: 4,
  color: 'var(--bt-text)',
  cursor: 'pointer',
}
