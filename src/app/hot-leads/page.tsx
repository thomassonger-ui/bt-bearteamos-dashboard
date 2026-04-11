'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { Pipeline, HotLeadSource, Agent } from '@/types'
import { getAllAgents } from '@/lib/queries'
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
  craigslist: 'Craigslist',
  zillow_fsbo: 'Zillow FSBO',
  forsalebyowner: 'ForSaleByOwner.com',
  fsbo_com: 'FSBO.com',
  byowner: 'ByOwner.com',
  manual_upload: 'Manual Upload',
}

export default function HotLeadsPage() {
  const [leads, setLeads] = useState<Pipeline[]>([])
  const [sources, setSources] = useState<HotLeadSource[]>([])
  const [filterSource, setFilterSource] = useState<string>('')
  const [filterUrgency, setFilterUrgency] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [acceptedToday, setAcceptedToday] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<string | null>(null)
  const MAX_DAILY = 2

  useEffect(() => {
    const admin = sessionStorage.getItem('bt_is_admin') === 'true'
    setIsAdmin(admin)
    if (admin) {
      getAllAgents().then(setAgents)
    }
  }, [])

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++ } else inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { result.push(current); current = '' }
      else current += ch
    }
    result.push(current)
    return result
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { setUploadResult('CSV is empty.'); setUploading(false); return }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))

      function findInRow(vals: string[], test: (v: string) => boolean): string {
        for (const v of vals) { if (v && test(v.trim())) return v.trim() }
        return ''
      }

      let added = 0
      let skipped = 0
      let detectedSource = 'manual_upload'

      for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i])
        if (vals.every(v => !v.trim())) continue

        const get = (keys: string[]) => { for (const k of keys) { const idx = headers.indexOf(k); if (idx >= 0 && vals[idx]) return vals[idx].trim() } return '' }

        let title = get(['address', 'title', 'name', 'lead_name', 'property', 'street'])
        if (!title) title = findInRow(vals, v => /^\d+\s+[\w]/.test(v) && !v.startsWith('http') && !v.startsWith('$') && !/^\d+$/.test(v.trim()) && v.length > 6 && v.length < 100 && /[A-Za-z]{2,}/.test(v))

        let fullAddr = findInRow(vals, v => /\d+.*,\s*(Orlando|FL|Florida|Kissimmee|Sanford|Ocoee|Apopka|Winter Park|Altamonte|Lake Mary)/i.test(v))
        if (!title && fullAddr) title = fullAddr.split(',')[0].trim()

        if (!title) {
          const urlVal = findInRow(vals, v => v.startsWith('http'))
          if (urlVal) {
            const pathMatch = urlVal.match(/\/(\d+-[a-z0-9-]+-(?:orlando|fl|kissimmee|sanford|winter-park|lake-mary|altamonte)[a-z0-9-]*)/i)
            if (pathMatch) {
              title = pathMatch[1]
                .replace(/-(\d{5}).*$/, ', FL $1')
                .replace(/-fl-/, ', FL ')
                .replace(/-orlando-/, ', Orlando, ')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
                .trim()
            }
          }
        }

        if (!title) { skipped++; continue }

        let priceStr = get(['price', 'sale_price', 'asking_price', 'list_price'])
        if (!priceStr) priceStr = findInRow(vals, v => /^\$[\d,]+/.test(v))
        const price = priceStr ? parseFloat(priceStr.replace(/[$,]/g, '')) : undefined
        if (price && price < 5000) { skipped++; continue }

        let url = get(['url', 'link', 'listing_url', 'c11n href', 'block href'])
        if (!url) url = findInRow(vals, v => v.startsWith('http'))

        if (url.includes('zillow.com')) detectedSource = 'zillow_fsbo'
        else if (url.includes('forsalebyowner.com')) detectedSource = 'forsalebyowner'
        else if (url.includes('fsbo.com')) detectedSource = 'fsbo_com'
        else if (url.includes('byowner.com')) detectedSource = 'byowner'

        let location = get(['location', 'city', 'neighborhood', 'area'])
        if (!location && fullAddr) location = fullAddr
        if (!location) location = findInRow(vals, v => /Orlando|FL|\d{5}/.test(v) && !v.startsWith('http') && !v.startsWith('$'))

        let zip = get(['zip', 'zipcode', 'zip_code', 'postal'])
        if (!zip) { const zipMatch = (fullAddr || location || '').match(/\b(3\d{4})\b/); if (zipMatch) zip = zipMatch[1] }

        const allText = vals.join(' ')
        const bedsMatch = allText.match(/(\d+)\s*(bed|bd|br)/i)
        const bathsMatch = allText.match(/([\d.]+)\s*(bath|ba)/i)
        const sqftMatch = allText.match(/([\d,]+)\s*sq\s*ft/i)
        const desc = [bedsMatch ? `${bedsMatch[1]} bed` : '', bathsMatch ? `${bathsMatch[1]} bath` : '', sqftMatch ? `${sqftMatch[1]} sqft` : ''].filter(Boolean).join(', ')

        const { error } = await getSupabase().from('pipeline').insert({
          agent_id: 'e424ecf9-ce0d-4e7f-85e9-286dd9f66e1e',
          lead_name: title.slice(0, 100),
          stage: 'new_lead',
          last_contact: new Date().toISOString(),
          lead_source: detectedSource,
          urgency: 'normal',
          arv: price && !isNaN(price) ? price : null,
          property_address: location || null,
          zip_code: zip || null,
          phone: get(['phone', 'contact', 'seller_phone']) || null,
          email: get(['email', 'seller_email', 'contact_email']) || null,
          notes: desc || null,
          source_url: url || null,
          source_id: url || `upload_${Date.now()}_${i}`,
          scraped_at: new Date().toISOString(),
          is_hot_lead: true,
        })
        if (!error) added++
        else skipped++
      }
      setUploadResult(`Imported ${added} lead${added !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped` : ''}.`)
      fetchLeads()
    } catch { setUploadResult('Error reading file.') }
    finally { setUploading(false); e.target.value = '' }
  }

  useEffect(() => {
    const agentId = sessionStorage.getItem('bt_agent_id') || 'default'
    const storedDate = sessionStorage.getItem(`bt_accept_date_${agentId}`)
    const storedCount = sessionStorage.getItem(`bt_accept_count_${agentId}`)
    const today = new Date().toDateString()
    if (storedDate === today && storedCount) {
      setAcceptedToday(parseInt(storedCount))
    } else {
      sessionStorage.setItem(`bt_accept_date_${agentId}`, today)
      sessionStorage.setItem(`bt_accept_count_${agentId}`, '0')
      setAcceptedToday(0)
    }
  }, [])

  // ─── TRANSFER LEAD — admin only, reassigns lead to a specific agent ──────────
  async function transferLead(leadId: string, agentId: string) {
    await getSupabase()
      .from('pipeline')
      .update({ agent_id: agentId, stage: 'new_lead', is_hot_lead: false })
      .eq('id', leadId)
    fetchLeads()
  }

  // ─── ACCEPT LEAD — now with automatic skip trace enrichment ──────────────────
  async function acceptLead(leadId: string) {
    if (!isAdmin && acceptedToday >= MAX_DAILY) return
    const remaining = MAX_DAILY - acceptedToday
    const confirmed = window.confirm(
      `You are about to accept this lead.\n\n` +
      (!isAdmin ? `You have ${remaining} lead${remaining !== 1 ? 's' : ''} remaining today.\nAfter accepting ${MAX_DAILY} leads, this page will lock for 24 hours.\n\n` : '') +
      `This lead will be added to your pipeline. Continue?`
    )
    if (!confirmed) return

    const agentId = sessionStorage.getItem('bt_agent_id')
    if (!agentId) return

    // 1. Move lead into agent's pipeline immediately
    await getSupabase()
      .from('pipeline')
      .update({ agent_id: agentId, stage: 'new_lead', is_hot_lead: false })
      .eq('id', leadId)

    // 2. Update daily counter
    const aid = sessionStorage.getItem('bt_agent_id') || 'default'
    const newCount = acceptedToday + 1
    setAcceptedToday(newCount)
    sessionStorage.setItem(`bt_accept_count_${aid}`, newCount.toString())
    sessionStorage.setItem(`bt_accept_date_${aid}`, new Date().toDateString())

    // 3. Run skip trace via server-side API route (TRACERFY_API_KEY is server-only)
    const lead = leads.find(l => l.id === leadId)
    const addrSource = lead?.property_address || lead?.lead_name || '' // property_address first — lead_name may be listing title not street address
    if (lead && addrSource) {
      // lead_name holds the full address e.g. "5314 E Kaley Street ORLANDO, FL 32812"
      // Greedy match: capture everything before the last city token + FL
      const addrMatch = addrSource.match(/^(.+)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*),?\s*FL\b/i)
      let streetAddress = addrSource
      let city = 'Orlando'
      if (addrMatch) {
        streetAddress = addrMatch[1].trim()
        city = addrMatch[2].trim()
      }
      fetch('/api/skip-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          address: streetAddress,
          city,
          zip: lead.zip_code ?? undefined,
        }),
      })
        .then(r => r.json())
        .then(result => console.log('[skipTrace] Result:', result))
        .catch(err => console.error('[skipTrace] API call failed:', err))
    }

    fetchLeads()
  }

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

  const leadTypes = [...new Set(leads.map(l => l.hot_lead_type).filter(Boolean))]

  return (
    <ResponsiveShell>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Disclaimer banner */}
        <div style={{
          padding: '8px 32px', background: 'rgba(224,82,82,0.08)',
          borderBottom: '1px solid rgba(224,82,82,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: '#E04E4E', fontWeight: 600 }}>
            {MAX_DAILY} Leads Per Day &middot; 24-Hour Reset &middot; Once a lead is accepted, owner name, phone &amp; email will appear in Pipeline
          </span>
          <span style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>
            {acceptedToday}/{MAX_DAILY} accepted today
          </span>
        </div>

        {/* Admin CSV Upload */}
        {isAdmin && (
          <div style={{ padding: '0 32px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: showUpload ? 0 : 8 }}>
              <button onClick={() => setShowUpload(v => !v)} style={{
                fontSize: 11, padding: '5px 12px', fontWeight: 600,
                background: showUpload ? '#1976D2' : 'var(--bt-surface)',
                border: '1px solid var(--bt-border)',
                color: showUpload ? '#fff' : 'var(--bt-text-dim)',
                borderRadius: 4, cursor: 'pointer',
              }}>Upload Leads CSV</button>
            </div>
            {showUpload && (
              <div style={{ marginTop: 8, marginBottom: 12, padding: '12px', background: 'rgba(25,118,210,0.06)', border: '1px solid rgba(25,118,210,0.2)', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', lineHeight: 1.8, marginBottom: 10 }}>
                  <strong style={{ color: 'var(--bt-text)', fontSize: 12 }}>How to get FSBO leads from each site:</strong><br /><br />
                  <strong style={{ color: '#E04E4E' }}>Zillow FSBO:</strong> Go to <a href="https://www.zillow.com/orlando-fl/fsbo/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--bt-accent)' }}>zillow.com/orlando-fl/fsbo</a> &rarr; Scroll through listings &rarr; Copy addresses + prices into a spreadsheet &rarr; Save as .csv &rarr; Upload here<br />
                  <strong style={{ color: '#1976D2' }}>ForSaleByOwner.com:</strong> Go to <a href="https://www.forsalebyowner.com/search/fl/orlando" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--bt-accent)' }}>forsalebyowner.com/search/fl/orlando</a> &rarr; Copy listing data into spreadsheet &rarr; Save as .csv &rarr; Upload here<br />
                  <strong style={{ color: '#4CAF50' }}>FSBO.com:</strong> Go to <a href="https://www.fsbo.com/florida/orlando/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--bt-accent)' }}>fsbo.com/florida/orlando</a> &rarr; Copy listing data into spreadsheet &rarr; Save as .csv &rarr; Upload here<br />
                  <strong style={{ color: '#9C27B0' }}>ByOwner.com:</strong> Go to <a href="https://www.byowner.com/orlando/florida" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--bt-accent)' }}>byowner.com/orlando/florida</a> &rarr; Instant Data Scraper &rarr; Download CSV &rarr; Upload here<br />
                  <strong style={{ color: '#FF9800' }}>Craigslist:</strong> Auto-scraped daily at 7AM ET &mdash; no action needed<br /><br />
                  <strong>CSV columns:</strong> <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>address</code> (required), <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>price</code>, <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>city</code>, <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>zip</code>, <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>phone</code>, <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>email</code>, <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>url</code>, <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>description</code>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 11, padding: '6px 14px', fontWeight: 600, background: '#1976D2', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>
                    Choose CSV File
                    <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
                  </label>
                  {uploading && <span style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>Uploading...</span>}
                  {uploadResult && <span style={{ fontSize: 11, color: uploadResult.includes('Error') ? '#E04E4E' : '#4CAF50' }}>{uploadResult}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {!isAdmin && acceptedToday >= MAX_DAILY ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12, padding: 40,
          }}>
            <div style={{ fontSize: 40 }}>&#128274;</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--bt-text)' }}>Daily Limit Reached</div>
            <div style={{ fontSize: 13, color: 'var(--bt-text-dim)', textAlign: 'center', maxWidth: 400 }}>
              You have accepted {MAX_DAILY} leads today. New leads will be available in 24 hours.
            </div>
            <div style={{ fontSize: 12, color: 'var(--bt-muted)', marginTop: 8 }}>
              {acceptedToday}/{MAX_DAILY} leads accepted today
            </div>
          </div>
        ) : (<>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px 24px', minHeight: 0 }}>
        <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
        <div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--bt-text)', marginBottom: 4 }}>Hot Leads</h1>
          <p style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>Automated lead pipeline from Apify scrapers</p>
        </div>

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
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={selectStyle}>
            <option value="">All Sources</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)} style={selectStyle}>
            <option value="">All Urgency</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
            <option value="">All Types</option>
            {leadTypes.map(t => <option key={t} value={t!}>{t!.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
          {(filterSource || filterUrgency || filterType) && (
            <button onClick={() => { setFilterSource(''); setFilterUrgency(''); setFilterType('') }}
              style={{ fontSize: 11, padding: '6px 12px', border: '1px solid var(--bt-border)', background: 'transparent', color: 'var(--bt-text-dim)', borderRadius: 4, cursor: 'pointer' }}>
              Clear Filters
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ color: 'var(--bt-text-dim)', fontSize: 13, padding: 40, textAlign: 'center' }}>Loading hot leads...</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
            <div style={{ fontSize: 14, color: 'var(--bt-text-dim)', marginBottom: 8 }}>No hot leads yet</div>
            <div style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>Connect your Apify scrapers via n8n to start receiving leads</div>
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
                onAccept={acceptLead}
                canAccept={isAdmin || acceptedToday < MAX_DAILY}
                agents={isAdmin ? agents : undefined}
                onTransfer={isAdmin ? transferLead : undefined}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          <HotLeadSourcePanel sources={sources} />
        </div>
        </div>

        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Schedule</div>
            {[
              { label: 'Craigslist', schedule: 'Daily 7AM ET (auto)', active: true },
              { label: 'Zillow FSBO', schedule: 'Manual CSV upload', active: true },
              { label: 'ForSaleByOwner', schedule: 'Manual CSV upload', active: true },
              { label: 'FSBO.com', schedule: 'Manual CSV upload', active: true },
              { label: 'ByOwner.com', schedule: 'Manual CSV upload', active: true },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bt-border)', opacity: s.active ? 1 : 0.4 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>{s.schedule}</div>
                </div>
                <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 5px', borderRadius: 2, background: s.active ? 'rgba(76,175,80,0.15)' : 'rgba(224,82,82,0.15)', color: s.active ? '#4CAF50' : '#E04E4E' }}>{s.active ? 'ACTIVE' : 'OFF'}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Leads by Source</div>
            {Object.entries({ craigslist: 'Craigslist', zillow_fsbo: 'Zillow FSBO', forsalebyowner: 'ForSaleByOwner', fsbo_com: 'FSBO.com', byowner: 'ByOwner.com', manual_upload: 'Manual' }).map(([key, label]) => {
              const count = leads.filter(l => l.lead_source === key).length
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bt-border)', fontSize: 12 }}>
                  <span style={{ color: count > 0 ? 'var(--bt-text)' : 'var(--bt-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: count > 0 ? 'var(--bt-accent)' : 'var(--bt-muted)' }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        </div>
        </div>
        </>)}
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
