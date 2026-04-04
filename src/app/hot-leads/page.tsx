'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { Pipeline } from '@/types'
import ResponsiveShell from '@/components/ResponsiveShell'

const SOURCE_LABEL: Record<string, string> = {
  facebook_marketplace: 'Facebook Marketplace',
  craigslist: 'Craigslist',
  google_maps: 'Google Maps',
  county_appraisal: 'County Appraisal',
  newspaper: 'Newspaper',
}

const SCRAPER_SCHEDULE = [
  { source: 'craigslist', label: 'Craigslist', schedule: 'Daily 7AM ET', status: 'active' },
  { source: 'google_maps', label: 'Google Maps', schedule: 'Weekly Monday 6AM ET', status: 'active' },
  { source: 'facebook_marketplace', label: 'Facebook Marketplace', schedule: 'Mon/Wed/Fri 6AM ET', status: 'active' },
  { source: 'newspaper', label: 'Newspaper', schedule: 'Disabled', status: 'disabled' },
  { source: 'county_appraisal', label: 'County Appraisal', schedule: 'Disabled', status: 'disabled' },
]

export default function HotLeadsPage() {
  const [leads, setLeads] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeads = useCallback(async () => {
    const { data } = await getSupabase()
      .from('pipeline')
      .select('*')
      .eq('is_hot_lead', true)
      .order('created_at', { ascending: false })
    setLeads((data ?? []) as Pipeline[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // Group leads by source
  const bySource: Record<string, Pipeline[]> = {}
  for (const lead of leads) {
    const src = lead.lead_source || 'unknown'
    if (!bySource[src]) bySource[src] = []
    bySource[src].push(lead)
  }

  return (
    <ResponsiveShell>
      <main className="m-pad m-scroll" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        <div className="m-full" style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Hot Leads</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Automated Scraper Pipeline</div>
          </div>

          {/* Scraper Schedule */}
          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Scraper Schedule</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bt-border)' }}>
                  {['Source', 'Schedule', 'Status', 'Last Posted', 'Leads'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 6px', fontSize: 9, fontWeight: 600, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCRAPER_SCHEDULE.map(s => {
                  const sourcLeads = bySource[s.source] || []
                  const lastPosted = sourcLeads.length > 0 ? new Date(sourcLeads[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '\u2014'
                  return (
                    <tr key={s.source} style={{ borderBottom: '1px solid var(--bt-border)', opacity: s.status === 'disabled' ? 0.4 : 1 }}>
                      <td style={{ padding: '10px 6px', fontWeight: 500 }}>{s.label}</td>
                      <td style={{ padding: '10px 6px', color: 'var(--bt-text-dim)' }}>{s.schedule}</td>
                      <td style={{ padding: '10px 6px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                          background: s.status === 'active' ? 'rgba(76,175,80,0.15)' : 'rgba(224,82,82,0.15)',
                          color: s.status === 'active' ? '#4CAF50' : '#E04E4E',
                        }}>{s.status === 'active' ? 'ACTIVE' : 'DISABLED'}</span>
                      </td>
                      <td style={{ padding: '10px 6px', color: 'var(--bt-text-dim)', fontSize: 11 }}>{lastPosted}</td>
                      <td style={{ padding: '10px 6px', fontWeight: 600 }}>{sourcLeads.length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Recent Leads by Date */}
          {leads.length > 0 ? (
            <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
              <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
                Recent Leads ({leads.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bt-border)' }}>
                    {['Lead', 'Source', 'Date', 'Type', 'Urgency'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 6px', fontSize: 9, fontWeight: 600, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 50).map(lead => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid var(--bt-border)' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 500 }}>{lead.lead_name}</td>
                      <td style={{ padding: '8px 6px', color: 'var(--bt-text-dim)' }}>{SOURCE_LABEL[lead.lead_source || ''] || lead.lead_source || '\u2014'}</td>
                      <td style={{ padding: '8px 6px', color: 'var(--bt-text-dim)', fontSize: 11 }}>
                        {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        {lead.hot_lead_type ? (
                          <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 2, border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)' }}>
                            {lead.hot_lead_type.replace(/_/g, ' ')}
                          </span>
                        ) : '\u2014'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        {lead.urgency ? (
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 2,
                            color: lead.urgency === 'critical' ? '#E04E4E' : lead.urgency === 'high' ? '#FF9800' : 'var(--bt-text-dim)',
                          }}>{lead.urgency.toUpperCase()}</span>
                        ) : '\u2014'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '30px', textAlign: 'center', color: 'var(--bt-text-dim)' }}>
              {loading ? 'Loading...' : 'No hot leads yet. Scrapers will post here when they run.'}
            </div>
          )}
        </div>
      </main>
    </ResponsiveShell>
  )
}
