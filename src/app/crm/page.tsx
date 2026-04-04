'use client'

import { useState, useEffect, useMemo } from 'react'
import ResponsiveShell from '@/components/ResponsiveShell'
import { getAgent, getFirstAgent, getPipeline, insertHotLead } from '@/lib/queries'
import type { Agent, Pipeline } from '@/types'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default function CRMPage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [contacts, setContacts] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStage, setFilterStage] = useState<string>('all')
  const [showImport, setShowImport] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  function exportCSV() {
    const headers = ['lead_name', 'lead_type', 'phone', 'email', 'address', 'stage', 'notes', 'last_contact']
    const rows = contacts.map(c => [
      c.lead_name, c.lead_type || '', c.phone || '', c.email || '',
      c.address || '', c.stage, c.notes || '',
      new Date(c.last_contact).toLocaleDateString(),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${agent?.name?.replace(/\s/g, '_') || 'contacts'}_CRM_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !agent) return
    setImporting(true)
    setImportStatus(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { setImportStatus('CSV is empty.'); setImporting(false); return }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"/, '').replace(/"$/, ''))
      const nameIdx = headers.indexOf('lead_name')
      if (nameIdx === -1) { setImportStatus('Missing required column: lead_name'); setImporting(false); return }

      let added = 0
      let skipped = 0
      for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i])
        const get = (col: string) => {
          const idx = headers.indexOf(col)
          return idx >= 0 && idx < vals.length ? vals[idx].trim() : ''
        }
        const name = get('lead_name')
        if (!name) { skipped++; continue }

        const leadType = get('lead_type')
        const validTypes = ['buyer', 'seller', 'rental']
        await insertHotLead({
          agent_id: agent.id,
          lead_name: name,
          lead_type: validTypes.includes(leadType) ? leadType as Pipeline['lead_type'] : undefined,
          phone: get('phone') || undefined,
          email: get('email') || undefined,
          address: get('address') || undefined,
          stage: get('stage') || 'new_lead',
          notes: get('notes') || undefined,
          last_contact: new Date().toISOString(),
        })
        added++
      }
      setImportStatus(`Imported ${added} contact${added !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped` : ''}.`)
      // Refresh contacts
      setContacts(await getPipeline(agent.id))
    } catch (err) {
      setImportStatus('Error reading CSV file.')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current); current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  useEffect(() => {
    async function load() {
      const storedId = sessionStorage.getItem('bt_agent_id')
      const agentData = storedId ? await getAgent(storedId) : await getFirstAgent()
      if (!agentData) { setLoading(false); return }
      const pipeline = await getPipeline(agentData.id)
      setAgent(agentData)
      setContacts(pipeline)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let list = contacts
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.lead_name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      )
    }
    if (filterType !== 'all') list = list.filter(c => c.lead_type === filterType)
    if (filterStage !== 'all') list = list.filter(c => c.stage === filterStage)
    if (activeLetter) list = list.filter(c => c.lead_name.toUpperCase().startsWith(activeLetter!))
    return list.sort((a, b) => a.lead_name.localeCompare(b.lead_name))
  }, [contacts, search, filterType, filterStage, activeLetter])

  const grouped = useMemo(() => {
    const map: Record<string, Pipeline[]> = {}
    for (const c of filtered) {
      const letter = c.lead_name[0]?.toUpperCase() || '#'
      if (!map[letter]) map[letter] = []
      map[letter].push(c)
    }
    return map
  }, [filtered])

  const stages = [...new Set(contacts.map(c => c.stage))].sort()

  function daysSince(iso: string) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  }

  function stageLabel(s: string) {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  function stageColor(s: string) {
    const colors: Record<string, string> = {
      new_lead: 'var(--bt-accent)', attempting_contact: '#FF9800', contacted: '#6b9cf5',
      appointment_set: '#a084e8', active_client: '#FF9800', under_contract: '#4CAF50',
      closed: '#4CAF50', stalled: '#E04E4E',
    }
    return colors[s] || 'var(--bt-text-dim)'
  }

  function typeColor(t: string) {
    if (t === 'buyer') return '#1976D2'
    if (t === 'seller') return '#E04E4E'
    return '#9C27B0'
  }

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--bt-text-dim)' }}>Loading&hellip;</div>

  return (
    <ResponsiveShell>
      <main className="m-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--bt-border)', flexShrink: 0 }}>
          <div className="m-stack" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Contact Book</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{agent?.name ?? '\u2014'}&apos;s CRM</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--bt-text-dim)' }}>{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</span>
              <button onClick={exportCSV} style={{
                fontSize: 11, padding: '5px 12px', fontWeight: 600,
                background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
                color: 'var(--bt-text-dim)', borderRadius: 4, cursor: 'pointer',
              }}>Export CSV</button>
              <button onClick={() => setShowImport(v => !v)} style={{
                fontSize: 11, padding: '5px 12px', fontWeight: 600,
                background: showImport ? '#4CAF50' : 'var(--bt-surface)',
                border: '1px solid var(--bt-border)',
                color: showImport ? '#fff' : 'var(--bt-text-dim)',
                borderRadius: 4, cursor: 'pointer',
              }}>Import CSV</button>
            </div>
          </div>

          {/* Search + Filters */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, email..."
              style={{
                flex: 1, minWidth: 200, padding: '8px 12px', fontSize: 12,
                background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
                color: 'var(--bt-text)', borderRadius: 4, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ padding: '8px 10px', fontSize: 11, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 4, outline: 'none' }}>
              <option value="all">All Types</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="rental">Rental</option>
            </select>
            <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
              style={{ padding: '8px 10px', fontSize: 11, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 4, outline: 'none' }}>
              <option value="all">All Stages</option>
              {stages.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
            </select>
          </div>
        </div>

        {/* Import panel */}
        {showImport && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--bt-border)', background: 'rgba(123,183,183,0.04)', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Import Contacts from CSV</div>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
              <strong>Required column:</strong> <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>lead_name</code><br />
              <strong>Optional columns:</strong>{' '}
              <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>lead_type</code> (buyer, seller, or rental),{' '}
              <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>phone</code>,{' '}
              <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>email</code>,{' '}
              <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>address</code>,{' '}
              <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>stage</code>,{' '}
              <code style={{ background: 'var(--bt-surface)', padding: '1px 4px', borderRadius: 2 }}>notes</code><br />
              <strong>Example CSV:</strong>
            </div>
            <pre style={{ fontSize: 10, color: 'var(--bt-text)', background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 4, padding: '8px 12px', overflowX: 'auto', marginBottom: 10 }}>
{`lead_name,lead_type,phone,email,address,stage,notes
Sarah Mitchell,buyer,407-555-0192,sarah@example.com,Winter Park FL,new_lead,Looking for 3/2 under 400K
James Carter,seller,321-555-8834,james@example.com,123 Oak St Orlando,contacted,Wants to list in May`}
            </pre>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{
                fontSize: 11, padding: '6px 14px', fontWeight: 600,
                background: '#1976D2', color: '#fff', borderRadius: 4, cursor: 'pointer',
              }}>
                Choose CSV File
                <input type="file" accept=".csv" onChange={handleImport} style={{ display: 'none' }} />
              </label>
              {importing && <span style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>Importing...</span>}
              {importStatus && <span style={{ fontSize: 11, color: importStatus.startsWith('Error') || importStatus.startsWith('Missing') ? '#E04E4E' : '#4CAF50' }}>{importStatus}</span>}
            </div>
          </div>
        )}

        {/* Body: A-Z sidebar + contact list */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* A-Z sidebar */}
          <div className="m-hide" style={{
            width: 32, flexShrink: 0, borderRight: '1px solid var(--bt-border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '8px 0', overflowY: 'auto',
          }}>
            <button onClick={() => setActiveLetter(null)}
              style={{
                fontSize: 10, fontWeight: activeLetter === null ? 700 : 400,
                color: activeLetter === null ? 'var(--bt-accent)' : 'var(--bt-text-dim)',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 0',
              }}>All</button>
            {ALPHABET.map(letter => {
              const hasContacts = contacts.some(c => c.lead_name.toUpperCase().startsWith(letter))
              return (
                <button
                  key={letter}
                  onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
                  style={{
                    fontSize: 10, fontWeight: activeLetter === letter ? 700 : 400,
                    color: activeLetter === letter ? 'var(--bt-accent)' : hasContacts ? 'var(--bt-text-dim)' : 'var(--bt-muted)',
                    background: activeLetter === letter ? 'rgba(123,183,183,0.1)' : 'transparent',
                    border: 'none', cursor: hasContacts ? 'pointer' : 'default', padding: '3px 0',
                    borderRadius: 2,
                  }}
                >{letter}</button>
              )
            })}
          </div>

          {/* Contact list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
            {Object.keys(grouped).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--bt-text-dim)', fontSize: 13 }}>
                {search ? 'No contacts match your search.' : 'No contacts yet.'}
              </div>
            ) : (
              Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([letter, leads]) => (
                <div key={letter} id={`letter-${letter}`} style={{ marginBottom: 16 }}>
                  {/* Letter header */}
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: 'var(--bt-accent)',
                    padding: '4px 0', borderBottom: '1px solid var(--bt-border)', marginBottom: 8,
                    position: 'sticky', top: 0, background: 'var(--bt-black)', zIndex: 1,
                  }}>{letter}</div>

                  {/* Contact rows */}
                  {leads.map(contact => {
                    const d = daysSince(contact.last_contact)
                    return (
                      <div key={contact.id} className="m-stack" style={{
                        display: 'grid', gridTemplateColumns: '1fr 120px 140px 100px 90px',
                        gap: 8, alignItems: 'center',
                        padding: '10px 12px', marginBottom: 4,
                        background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
                        borderRadius: 5,
                      }}>
                        {/* Name + Type */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{contact.lead_name}</span>
                            {contact.lead_type && (
                              <span style={{
                                fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
                                background: typeColor(contact.lead_type), color: '#fff',
                              }}>{contact.lead_type.toUpperCase()}</span>
                            )}
                          </div>
                          {contact.notes && (
                            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 2 }}>
                              {contact.notes.length > 50 ? contact.notes.slice(0, 50) + '...' : contact.notes}
                            </div>
                          )}
                        </div>

                        {/* Phone */}
                        <div>
                          {contact.phone ? (
                            <a href={`tel:${contact.phone}`} style={{ fontSize: 11, color: 'var(--bt-accent)', textDecoration: 'none' }}>
                              {contact.phone}
                            </a>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--bt-muted)' }}>&mdash;</span>
                          )}
                        </div>

                        {/* Email */}
                        <div>
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} style={{ fontSize: 11, color: 'var(--bt-accent)', textDecoration: 'none' }}>
                              {contact.email.length > 20 ? contact.email.slice(0, 20) + '...' : contact.email}
                            </a>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--bt-muted)' }}>&mdash;</span>
                          )}
                        </div>

                        {/* Stage */}
                        <div>
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                            border: `1px solid ${stageColor(contact.stage)}`,
                            color: stageColor(contact.stage),
                          }}>{stageLabel(contact.stage)}</span>
                        </div>

                        {/* Last Contact */}
                        <div style={{
                          fontSize: 10,
                          color: d >= 3 ? '#E04E4E' : d === 0 ? '#4CAF50' : 'var(--bt-text-dim)',
                        }}>
                          {d === 0 ? 'Today' : `${d}d ago`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
        {/* Disclosure */}
        <div style={{
          padding: '10px 24px', borderTop: '1px solid var(--bt-border)',
          fontSize: 10, color: 'var(--bt-muted)', lineHeight: 1.5, flexShrink: 0,
        }}>
          All contact data belongs exclusively to the agent who entered it. Contact information is private, not shared across agents, and is the sole property of the originating agent. Bear Team Real Estate does not claim ownership of agent-entered client data. Upon separation from the brokerage, agents retain full rights to their client contacts and relationships.
        </div>
      </main>
    </ResponsiveShell>
  )
}
