'use client'

import { useState } from 'react'
import type { Agent, Pipeline } from '@/types'

const TIERS = [
  { min: 1,  max: 5,  label: 'Tier 1',     agentSplit: 0.60, brokerSplit: 0.40 },
  { min: 6,  max: 9,  label: 'Tier 2',     agentSplit: 0.70, brokerSplit: 0.30 },
  { min: 10, max: 15, label: 'Tier 3',     agentSplit: 0.80, brokerSplit: 0.20 },
  { min: 16, max: 999, label: 'Team Lead', agentSplit: 0.90, brokerSplit: 0.10 },
]
const CAP = 16000
const TX_FEE = 150
const DEFAULT_RATE = 0.025

function getTier(dealCount: number) {
  return TIERS.find(t => dealCount >= t.min && dealCount <= t.max) ?? TIERS[0]
}

interface Props {
  agents: Agent[]
  allDeals: Pipeline[]
  onRefresh?: () => void
}

interface AgentCommission {
  agent: Agent
  deals: Pipeline[]
  dealCount: number
  tier: typeof TIERS[0]
  totalGCI: number
  agentEarnings: number
  brokerRevenue: number
  capProgress: number
  capHit: boolean
}

export default function CommissionSummary({ agents, allDeals, onRefresh }: Props) {
  const [showImport, setShowImport] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [qaAgent, setQaAgent] = useState('')
  const [qaClient, setQaClient] = useState('')
  const [qaPrice, setQaPrice] = useState('')
  const [qaDate, setQaDate] = useState('')
  const [qaType, setQaType] = useState('buyer')
  const [qaSaving, setQaSaving] = useState(false)

  function exportCSV() {
    const headers = ['Agent', 'Client', 'Close Date', 'Sale Price', 'GCI', 'Tier', 'Agent Split', 'Agent Earnings', 'Broker Revenue']
    const rows = allDeals.map(d => {
      const agent = agents.find(a => a.id === d.agent_id)
      const agentDeals = allDeals.filter(dd => dd.agent_id === d.agent_id)
      const idx = agentDeals.indexOf(d)
      const tier = getTier(idx + 1)
      const gci = d.gci ?? (d.sale_price ?? 0) * (d.commission_rate ?? 0.025)
      return [
        agent?.name ?? 'Unknown', d.lead_name,
        d.closed_date ? new Date(d.closed_date).toLocaleDateString() : '',
        d.sale_price ?? 0, Math.round(gci), tier.label,
        `${Math.round(tier.agentSplit * 100)}%`,
        Math.round(gci * tier.agentSplit - TX_FEE),
        Math.round(gci * tier.brokerSplit),
      ]
    })
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `BearTeam_Commission_Report_${new Date().toISOString().slice(0, 10)}.csv`
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
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, j) => { row[h] = vals[j] || '' })
        rows.push(row)
      }
      const res = await fetch('/api/import-closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      setImportResult(`Imported ${data.imported} closing${data.imported !== 1 ? 's' : ''}${data.skipped > 0 ? `, ${data.skipped} skipped` : ''}${data.errors?.length ? ': ' + data.errors[0] : ''}`)
      onRefresh?.()
    } catch { setImportResult('Error reading file.') }
    finally { setImporting(false); e.target.value = '' }
  }

  async function quickAdd() {
    if (!qaAgent || !qaPrice || qaSaving) return
    setQaSaving(true)
    try {
      const res = await fetch('/api/import-closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{
          agent_name: qaAgent, sale_price: qaPrice, close_date: qaDate || new Date().toISOString().slice(0, 10),
          lead_name: qaClient || 'Client', lead_type: qaType,
        }]}),
      })
      const data = await res.json()
      if (data.imported > 0) {
        setQaAgent(''); setQaClient(''); setQaPrice(''); setQaDate('')
        setShowQuickAdd(false)
        onRefresh?.()
      } else {
        alert(data.errors?.[0] || 'Failed to add closing')
      }
    } finally { setQaSaving(false) }
  }

  // Calculate per-agent commissions
  const agentCommissions: AgentCommission[] = agents.map(agent => {
    const deals = allDeals.filter(d => d.agent_id === agent.id)
    let totalGCI = 0, agentEarnings = 0, brokerRevenue = 0

    deals.forEach((deal, i) => {
      const price = deal.sale_price ?? 0
      const rate = deal.commission_rate ?? DEFAULT_RATE
      const gci = deal.gci ?? price * rate
      const tier = getTier(i + 1)
      totalGCI += gci
      agentEarnings += gci * tier.agentSplit - TX_FEE
      brokerRevenue += gci * tier.brokerSplit
    })

    const tier = getTier(deals.length || 1)
    return {
      agent, deals, dealCount: deals.length, tier,
      totalGCI, agentEarnings, brokerRevenue,
      capProgress: Math.min(brokerRevenue, CAP),
      capHit: brokerRevenue >= CAP,
    }
  }).sort((a, b) => b.brokerRevenue - a.brokerRevenue)

  const totalBrokerRevenue = agentCommissions.reduce((s, a) => s + a.brokerRevenue, 0)
  const totalGCI = agentCommissions.reduce((s, a) => s + a.totalGCI, 0)
  const totalDeals = agentCommissions.reduce((s, a) => s + a.dealCount, 0)
  const producingAgents = agentCommissions.filter(a => a.dealCount > 0).length

  const now = new Date()
  const monthsElapsed = now.getMonth() + 1
  const projectedAnnualRevenue = totalBrokerRevenue > 0 ? Math.round((totalBrokerRevenue / monthsElapsed) * 12) : 0

  // Tier distribution
  const tierDist = TIERS.map(t => ({
    ...t,
    count: agentCommissions.filter(a => a.dealCount > 0 && a.tier.label === t.label).length,
  }))

  return (
    <div>
      {/* Toolbar: Import / Export / Quick Add */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={exportCSV} style={{
          fontSize: 11, padding: '6px 14px', fontWeight: 600,
          background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
          color: 'var(--bt-text-dim)', borderRadius: 4, cursor: 'pointer',
        }}>Export Report CSV</button>
        <button onClick={() => { setShowImport(v => !v); setShowQuickAdd(false) }} style={{
          fontSize: 11, padding: '6px 14px', fontWeight: 600,
          background: showImport ? '#1976D2' : 'var(--bt-surface)',
          border: '1px solid var(--bt-border)',
          color: showImport ? '#fff' : 'var(--bt-text-dim)',
          borderRadius: 4, cursor: 'pointer',
        }}>Import Closings CSV</button>
        <button onClick={() => { setShowQuickAdd(v => !v); setShowImport(false) }} style={{
          fontSize: 11, padding: '6px 14px', fontWeight: 600,
          background: showQuickAdd ? '#4CAF50' : 'var(--bt-surface)',
          border: '1px solid var(--bt-border)',
          color: showQuickAdd ? '#fff' : 'var(--bt-text-dim)',
          borderRadius: 4, cursor: 'pointer',
        }}>+ Quick Add Closing</button>
      </div>

      {/* Import Panel */}
      {showImport && (
        <div style={{ marginBottom: 16, padding: '14px', background: 'rgba(25,118,210,0.06)', border: '1px solid rgba(25,118,210,0.2)', borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Import Closings from CSV</div>
          <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', lineHeight: 1.6, marginBottom: 8 }}>
            CSV columns (any format accepted &mdash; AI matches agent names automatically):<br />
            <strong>Required:</strong> <code>agent_name</code> (or Agent), <code>sale_price</code> (or Price)<br />
            <strong>Optional:</strong> <code>close_date</code>, <code>lead_name</code> (or Client), <code>lead_type</code> (buyer/seller), <code>commission_rate</code> (default 2.5%)
          </div>
          <pre style={{ fontSize: 10, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 4, padding: '8px', marginBottom: 8, overflowX: 'auto' }}>
{`agent_name,sale_price,close_date,lead_name,lead_type
Kevin Songer,385000,2026-01-20,Maria Lopez,buyer
Kevin Songer,475000,2026-02-14,Robert Chen,buyer`}
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

      {/* Quick Add Panel */}
      {showQuickAdd && (
        <div style={{ marginBottom: 16, padding: '14px', background: 'rgba(76,175,80,0.06)', border: '1px solid rgba(76,175,80,0.2)', borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Quick Add Closing</div>
          <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>Agent</div>
              <select value={qaAgent} onChange={e => setQaAgent(e.target.value)} style={inputSt}>
                <option value="">Select agent</option>
                {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>Client</div>
              <input value={qaClient} onChange={e => setQaClient(e.target.value)} placeholder="Client name" style={inputSt} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>Sale Price</div>
              <input value={qaPrice} onChange={e => setQaPrice(e.target.value)} placeholder="415000" style={inputSt} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>Close Date</div>
              <input type="date" value={qaDate} onChange={e => setQaDate(e.target.value)} style={inputSt} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>Type</div>
              <select value={qaType} onChange={e => setQaType(e.target.value)} style={inputSt}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
            </div>
            <button onClick={quickAdd} disabled={!qaAgent || !qaPrice || qaSaving} style={{
              padding: '8px 16px', fontSize: 11, fontWeight: 700,
              background: qaAgent && qaPrice ? '#4CAF50' : 'var(--bt-border)',
              color: '#fff', border: 'none', borderRadius: 4, cursor: qaAgent && qaPrice ? 'pointer' : 'default',
            }}>{qaSaving ? '...' : 'Add'}</button>
          </div>
        </div>
      )}

      {/* Brokerage Revenue Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Broker Revenue YTD', value: `$${Math.round(totalBrokerRevenue).toLocaleString()}`, color: '#4CAF50' },
          { label: 'Total GCI', value: `$${Math.round(totalGCI).toLocaleString()}`, color: 'var(--bt-text)' },
          { label: 'Total Closings', value: totalDeals.toString(), color: 'var(--bt-text)' },
          { label: 'Producing Agents', value: `${producingAgents}/${agents.length}`, color: 'var(--bt-accent)' },
          { label: 'Projected Annual', value: `$${projectedAnnualRevenue.toLocaleString()}`, color: '#FF9800' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 5, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tier Distribution */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tierDist.map(t => (
          <div key={t.label} style={{
            flex: 1, padding: '10px', borderRadius: 4,
            border: '1px solid var(--bt-border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{t.count}</div>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>{t.label}</div>
            <div style={{ fontSize: 9, color: 'var(--bt-muted)' }}>{Math.round(t.agentSplit * 100)}/{Math.round(t.brokerSplit * 100)}</div>
          </div>
        ))}
      </div>

      {/* Agent Earnings Table */}
      <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Agent Commission Breakdown</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--bt-border)' }}>
              {['Agent', 'Deals', 'Tier', 'Total GCI', 'Agent Earnings', 'Broker Revenue', 'Cap Status', 'Avg/Deal'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 6px', fontSize: 9, fontWeight: 600, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agentCommissions.map(ac => (
              <tr key={ac.agent.id} style={{ borderBottom: '1px solid var(--bt-border)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 500 }}>{ac.agent.name}</td>
                <td style={{ padding: '8px 6px' }}>{ac.dealCount}</td>
                <td style={{ padding: '8px 6px' }}>
                  {ac.dealCount > 0 ? (
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3, border: '1px solid var(--bt-accent)', color: 'var(--bt-accent)' }}>
                      {ac.tier.label}
                    </span>
                  ) : <span style={{ color: 'var(--bt-muted)' }}>&mdash;</span>}
                </td>
                <td style={{ padding: '8px 6px' }}>{ac.dealCount > 0 ? `$${Math.round(ac.totalGCI).toLocaleString()}` : '\u2014'}</td>
                <td style={{ padding: '8px 6px', color: '#4CAF50', fontWeight: 600 }}>{ac.dealCount > 0 ? `$${Math.round(ac.agentEarnings).toLocaleString()}` : '\u2014'}</td>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>{ac.dealCount > 0 ? `$${Math.round(ac.brokerRevenue).toLocaleString()}` : '\u2014'}</td>
                <td style={{ padding: '8px 6px' }}>
                  {ac.dealCount > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 5, background: 'var(--bt-border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: ac.capHit ? '#4CAF50' : '#FF9800', width: `${Math.min((ac.capProgress / CAP) * 100, 100)}%`, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>{Math.round((ac.capProgress / CAP) * 100)}%</span>
                    </div>
                  ) : <span style={{ color: 'var(--bt-muted)' }}>&mdash;</span>}
                </td>
                <td style={{ padding: '8px 6px', color: 'var(--bt-text-dim)' }}>
                  {ac.dealCount > 0 ? `$${Math.round(ac.totalGCI / ac.dealCount).toLocaleString()}` : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--bt-border)' }}>
              <td style={{ padding: '10px 6px', fontWeight: 700, fontSize: 11 }}>TOTALS</td>
              <td style={{ padding: '10px 6px', fontWeight: 700 }}>{totalDeals}</td>
              <td></td>
              <td style={{ padding: '10px 6px', fontWeight: 700 }}>${Math.round(totalGCI).toLocaleString()}</td>
              <td style={{ padding: '10px 6px', fontWeight: 700, color: '#4CAF50' }}>${Math.round(agentCommissions.reduce((s, a) => s + a.agentEarnings, 0)).toLocaleString()}</td>
              <td style={{ padding: '10px 6px', fontWeight: 700 }}>${Math.round(totalBrokerRevenue).toLocaleString()}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
  color: 'var(--bt-text)', borderRadius: 4, outline: 'none', fontFamily: 'inherit',
}
