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
  onRefresh?: () => void
  onAddRecruit?: (data: Record<string, string>) => Promise<void>
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export default function RecruitPipeline({ leads, onStageChange, onConvert, onDraftOutreach, onRefresh, onAddRecruit }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addBrokerage, setAddBrokerage] = useState('')
  const [addDeals, setAddDeals] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  function exportCSV() {
    const headers = ['name', 'email', 'phone', 'brokerage', 'deal_count', 'stage', 'source', 'notes', 'created_at']
    const rows = leads.map(l => [
      l.name, l.email || '', l.phone || '', l.brokerage || '',
      l.deal_count ?? '', l.stage || l.status || '', l.source || '',
      l.notes || '', l.created_at ? new Date(l.created_at).toLocaleDateString() : '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `BearTeam_Recruit_Pipeline_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { setImportResult('CSV is empty.'); setImporting(false); return }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
      let added = 0
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const get = (keys: string[]) => { for (const k of keys) { const idx = headers.indexOf(k); if (idx >= 0 && vals[idx]) return vals[idx] } return '' }
        const name = get(['name', 'agent_name', 'agent', 'full_name'])
        if (!name) continue
        await onAddRecruit?.({
          name,
          email: get(['email', 'e-mail']),
          phone: get(['phone', 'cell', 'mobile']),
          brokerage: get(['brokerage', 'company', 'broker']),
          deal_count: get(['deal_count', 'deals', 'transactions']),
          source: 'csv_import',
        })
        added++
      }
      setImportResult(`Imported ${added} recruit${added !== 1 ? 's' : ''}.`)
      onRefresh?.()
    } catch { setImportResult('Error reading file.') }
    finally { setImporting(false); e.target.value = '' }
  }

  async function handleAdd() {
    if (!addName.trim() || addSaving) return
    setAddSaving(true)
    await onAddRecruit?.({
      name: addName.trim(),
      email: addEmail.trim(),
      phone: addPhone.trim(),
      brokerage: addBrokerage.trim(),
      deal_count: addDeals.trim(),
      source: 'manual',
    })
    setAddName(''); setAddEmail(''); setAddPhone(''); setAddBrokerage(''); setAddDeals('')
    setShowAdd(false)
    setAddSaving(false)
    onRefresh?.()
  }

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
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => { setShowAdd(v => !v); setShowImport(false) }} style={{
          fontSize: 11, padding: '6px 14px', fontWeight: 600,
          background: showAdd ? '#4CAF50' : 'var(--bt-surface)', border: '1px solid var(--bt-border)',
          color: showAdd ? '#fff' : 'var(--bt-text-dim)', borderRadius: 4, cursor: 'pointer',
        }}>+ Add Recruit</button>
        <button onClick={() => { setShowImport(v => !v); setShowAdd(false) }} style={{
          fontSize: 11, padding: '6px 14px', fontWeight: 600,
          background: showImport ? '#1976D2' : 'var(--bt-surface)', border: '1px solid var(--bt-border)',
          color: showImport ? '#fff' : 'var(--bt-text-dim)', borderRadius: 4, cursor: 'pointer',
        }}>Import CSV</button>
        <button onClick={exportCSV} style={{
          fontSize: 11, padding: '6px 14px', fontWeight: 600,
          background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
          color: 'var(--bt-text-dim)', borderRadius: 4, cursor: 'pointer',
        }}>Export CSV</button>
      </div>

      {/* Add Recruit Form */}
      {showAdd && (
        <div style={{ marginBottom: 12, padding: '14px', background: 'rgba(76,175,80,0.06)', border: '1px solid rgba(76,175,80,0.2)', borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Add Recruit</div>
          <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>Name *</div>
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Jane Smith" style={inpSt} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>Email</div>
              <input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="jane@example.com" style={inpSt} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>Phone</div>
              <input value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="407-555-1234" style={inpSt} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>Brokerage</div>
              <input value={addBrokerage} onChange={e => setAddBrokerage(e.target.value)} placeholder="Keller Williams" style={inpSt} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>Deals/yr</div>
              <input value={addDeals} onChange={e => setAddDeals(e.target.value)} placeholder="8" style={inpSt} />
            </div>
            <button onClick={handleAdd} disabled={!addName.trim() || addSaving} style={{
              padding: '8px 16px', fontSize: 11, fontWeight: 700,
              background: addName.trim() ? '#4CAF50' : 'var(--bt-border)',
              color: '#fff', border: 'none', borderRadius: 4, cursor: addName.trim() ? 'pointer' : 'default',
            }}>{addSaving ? '...' : 'Add'}</button>
          </div>
        </div>
      )}

      {/* Import Panel */}
      {showImport && (
        <div style={{ marginBottom: 12, padding: '14px', background: 'rgba(25,118,210,0.06)', border: '1px solid rgba(25,118,210,0.2)', borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Import Recruits from CSV</div>
          <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', lineHeight: 1.6, marginBottom: 8 }}>
            <strong>Required:</strong> <code>name</code><br />
            <strong>Optional:</strong> <code>email</code>, <code>phone</code>, <code>brokerage</code>, <code>deal_count</code>
          </div>
          <pre style={{ fontSize: 10, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 4, padding: '8px', marginBottom: 8, overflowX: 'auto' }}>
{`name,email,phone,brokerage,deal_count
Jane Smith,jane@example.com,407-555-1234,Keller Williams,12
Sarah Kim,sarah@example.com,321-555-5678,eXp Realty,8`}
          </pre>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 11, padding: '6px 14px', fontWeight: 600, background: '#1976D2', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>
              Choose CSV File
              <input type="file" accept=".csv" onChange={handleImport} style={{ display: 'none' }} />
            </label>
            {importing && <span style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>Importing...</span>}
            {importResult && <span style={{ fontSize: 11, color: importResult.includes('Error') ? '#E04E4E' : '#4CAF50' }}>{importResult}</span>}
          </div>
        </div>
      )}

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

const inpSt: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
  color: 'var(--bt-text)', borderRadius: 4, outline: 'none', fontFamily: 'inherit',
}
