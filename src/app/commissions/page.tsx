'use client'

import { useState, useEffect, useMemo } from 'react'
import ResponsiveShell from '@/components/ResponsiveShell'
import { getAgent, getFirstAgent, getClosedDeals } from '@/lib/queries'
import type { Agent, Pipeline } from '@/types'

// ─── Commission Model ────────────────────────────────────────────────────────
const TIERS = [
  { min: 1,  max: 5,  label: 'Tier 1',     agentSplit: 0.60, brokerSplit: 0.40 },
  { min: 6,  max: 9,  label: 'Tier 2',     agentSplit: 0.70, brokerSplit: 0.30 },
  { min: 10, max: 15, label: 'Tier 3',     agentSplit: 0.80, brokerSplit: 0.20 },
  { min: 16, max: 999, label: 'Team Lead', agentSplit: 0.90, brokerSplit: 0.10 },
]
const CAP = 16000
const TX_FEE = 150
const DEFAULT_RATE = 0.025

function getTier(dealNumber: number) {
  return TIERS.find(t => dealNumber >= t.min && dealNumber <= t.max) ?? TIERS[0]
}

function calcDeal(deal: Pipeline, dealIndex: number) {
  const price = deal.sale_price ?? 0
  const rate = deal.commission_rate ?? DEFAULT_RATE
  const gci = deal.gci ?? price * rate
  const tier = getTier(dealIndex + 1)
  const agentEarnings = gci * tier.agentSplit - TX_FEE
  const brokerRevenue = gci * tier.brokerSplit
  return { gci, agentEarnings, brokerRevenue, tier, dealNumber: dealIndex + 1 }
}

// ─── Months ──────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function CommissionsPage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [deals, setDeals] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const storedId = sessionStorage.getItem('bt_agent_id')
      const agentData = storedId ? await getAgent(storedId) : await getFirstAgent()
      if (!agentData) { setLoading(false); return }
      const closed = await getClosedDeals(agentData.id)
      setAgent(agentData)
      setDeals(closed)
      setLoading(false)
    }
    load()
  }, [])

  const ytd = useMemo(() => {
    let totalGCI = 0, agentTotal = 0, brokerTotal = 0
    const dealCalcs = deals.map((deal, i) => {
      const c = calcDeal(deal, i)
      totalGCI += c.gci
      agentTotal += c.agentEarnings
      brokerTotal += c.brokerRevenue
      return { deal, ...c }
    })
    const currentTier = getTier(deals.length > 0 ? deals.length : 1)
    const capProgress = Math.min(brokerTotal, CAP)
    const capHit = brokerTotal >= CAP
    return { totalGCI, agentTotal, brokerTotal, capProgress, capHit, currentTier, dealCalcs }
  }, [deals])

  // Monthly data for chart
  const monthlyData = useMemo(() => {
    const data = MONTHS.map(() => ({ closings: 0, earnings: 0 }))
    ytd.dealCalcs.forEach(dc => {
      const d = dc.deal.closed_date ? new Date(dc.deal.closed_date) : new Date(dc.deal.created_at)
      const month = d.getMonth()
      data[month].closings++
      data[month].earnings += dc.agentEarnings
    })
    return data
  }, [ytd])

  const maxEarnings = Math.max(...monthlyData.map(m => m.earnings), 1)

  // Projected annual
  const now = new Date()
  const monthsElapsed = now.getMonth() + 1
  const projectedDeals = deals.length > 0 ? Math.round((deals.length / monthsElapsed) * 12) : 0
  const projectedEarnings = ytd.agentTotal > 0 ? Math.round((ytd.agentTotal / monthsElapsed) * 12) : 0

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--bt-text-dim)' }}>Loading&hellip;</div>

  return (
    <ResponsiveShell>
      <main className="m-pad m-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        <div className="m-full" style={{ maxWidth: 1000, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Commissions</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{agent?.name ?? '\u2014'}</div>
          </div>

          {/* Top row: Tier + YTD + Projected */}
          <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>

            {/* Tier Progress */}
            <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
              <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Current Tier</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--bt-accent)', marginBottom: 4 }}>{ytd.currentTier.label}</div>
              <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginBottom: 10 }}>
                {deals.length} deal{deals.length !== 1 ? 's' : ''} closed &middot; {Math.round(ytd.currentTier.agentSplit * 100)}/{Math.round(ytd.currentTier.brokerSplit * 100)} split
              </div>
              {/* Progress to next tier */}
              {ytd.currentTier.max < 999 && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginBottom: 4 }}>
                    {ytd.currentTier.max - deals.length + 1} more deal{ytd.currentTier.max - deals.length + 1 !== 1 ? 's' : ''} to {TIERS[TIERS.indexOf(ytd.currentTier) + 1]?.label ?? 'next tier'}
                  </div>
                  <div style={{ height: 6, background: 'var(--bt-border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: 'var(--bt-accent)',
                      width: `${((deals.length - ytd.currentTier.min + 1) / (ytd.currentTier.max - ytd.currentTier.min + 1)) * 100}%`,
                    }} />
                  </div>
                </>
              )}
              {ytd.currentTier.max >= 999 && (
                <div style={{ fontSize: 10, color: '#4CAF50', fontWeight: 600 }}>Highest tier reached</div>
              )}
            </div>

            {/* YTD Summary */}
            <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
              <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Year-to-Date</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>Total GCI</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>${ytd.totalGCI.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>Your Earnings</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#4CAF50' }}>${Math.round(ytd.agentTotal).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>Broker Portion</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>${Math.round(ytd.brokerTotal).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>Tx Fees Paid</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>${(deals.length * TX_FEE).toLocaleString()}</div>
                </div>
              </div>
              {/* Cap progress */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--bt-text-dim)', marginBottom: 3 }}>
                  <span>Cap Progress</span>
                  <span>${Math.round(ytd.capProgress).toLocaleString()} / ${CAP.toLocaleString()}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bt-border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: ytd.capHit ? '#4CAF50' : '#FF9800',
                    width: `${Math.min((ytd.capProgress / CAP) * 100, 100)}%`,
                  }} />
                </div>
                {ytd.capHit && <div style={{ fontSize: 10, color: '#4CAF50', fontWeight: 600, marginTop: 3 }}>Cap reached &mdash; graduated to {ytd.currentTier.label}</div>}
              </div>
            </div>

            {/* Projected */}
            <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
              <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Projected Annual</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>Deals</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{projectedDeals}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>Earnings</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#4CAF50' }}>${projectedEarnings.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>Projected Tier</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--bt-accent)' }}>{getTier(projectedDeals || 1).label}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>Pace</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{(deals.length / monthsElapsed).toFixed(1)}/mo</div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>Monthly Closings &amp; Earnings</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
              {monthlyData.map((m, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 9, color: '#4CAF50', fontWeight: 600 }}>
                    {m.earnings > 0 ? `$${Math.round(m.earnings / 1000)}k` : ''}
                  </div>
                  <div style={{
                    width: '100%', maxWidth: 40,
                    height: m.earnings > 0 ? Math.max((m.earnings / maxEarnings) * 80, 4) : 2,
                    background: m.earnings > 0 ? 'var(--bt-accent)' : 'var(--bt-border)',
                    borderRadius: 3,
                  }} />
                  <div style={{ fontSize: 9, color: m.closings > 0 ? 'var(--bt-text)' : 'var(--bt-muted)' }}>
                    {m.closings > 0 ? m.closings : '\u2014'}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--bt-text-dim)' }}>{MONTHS[i]}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 9, color: 'var(--bt-text-dim)' }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--bt-accent)', borderRadius: 2, marginRight: 4 }} />Earnings</span>
              <span>Numbers = closings</span>
            </div>
          </div>

          {/* Deal-by-Deal Table */}
          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>Deal History</div>

            {ytd.dealCalcs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--bt-text-dim)', fontSize: 13 }}>
                No closed deals yet. Close your first deal to see commission breakdowns here.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bt-border)' }}>
                    {['#', 'Client', 'Close Date', 'Sale Price', 'GCI', 'Tier', 'Split', 'Your Earnings', 'Broker'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 6px', fontSize: 9, fontWeight: 600, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ytd.dealCalcs.map((dc) => (
                    <tr key={dc.deal.id} style={{ borderBottom: '1px solid var(--bt-border)' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{dc.dealNumber}</td>
                      <td style={{ padding: '8px 6px' }}>{dc.deal.lead_name}</td>
                      <td style={{ padding: '8px 6px', color: 'var(--bt-text-dim)' }}>
                        {dc.deal.closed_date ? new Date(dc.deal.closed_date).toLocaleDateString() : '\u2014'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>${(dc.deal.sale_price ?? 0).toLocaleString()}</td>
                      <td style={{ padding: '8px 6px' }}>${Math.round(dc.gci).toLocaleString()}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3, border: '1px solid var(--bt-accent)', color: 'var(--bt-accent)' }}>
                          {dc.tier.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px', color: 'var(--bt-text-dim)' }}>
                        {Math.round(dc.tier.agentSplit * 100)}/{Math.round(dc.tier.brokerSplit * 100)}
                      </td>
                      <td style={{ padding: '8px 6px', fontWeight: 600, color: '#4CAF50' }}>${Math.round(dc.agentEarnings).toLocaleString()}</td>
                      <td style={{ padding: '8px 6px', color: 'var(--bt-text-dim)' }}>${Math.round(dc.brokerRevenue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--bt-border)' }}>
                    <td colSpan={4} style={{ padding: '10px 6px', fontWeight: 700, fontSize: 11 }}>TOTALS</td>
                    <td style={{ padding: '10px 6px', fontWeight: 700 }}>${Math.round(ytd.totalGCI).toLocaleString()}</td>
                    <td colSpan={2}></td>
                    <td style={{ padding: '10px 6px', fontWeight: 700, color: '#4CAF50' }}>${Math.round(ytd.agentTotal).toLocaleString()}</td>
                    <td style={{ padding: '10px 6px', fontWeight: 700 }}>${Math.round(ytd.brokerTotal).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Tier Reference */}
          <div style={{ marginTop: 20, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Progressive Cap Model</div>
            <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {TIERS.map(t => (
                <div key={t.label} style={{
                  padding: '10px', borderRadius: 4,
                  border: ytd.currentTier.label === t.label ? '2px solid var(--bt-accent)' : '1px solid var(--bt-border)',
                  background: ytd.currentTier.label === t.label ? 'rgba(123,183,183,0.08)' : 'transparent',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ytd.currentTier.label === t.label ? 'var(--bt-accent)' : 'var(--bt-text)' }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 2 }}>Deals {t.min}{t.max < 999 ? `\u2013${t.max}` : '+'}</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>{Math.round(t.agentSplit * 100)}% / {Math.round(t.brokerSplit * 100)}%</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 8 }}>
              Cap: $16,000 broker collections (Tier 1) &middot; Transaction fee: $150/closing &middot; E&amp;O: Paid by Bear Team
            </div>
          </div>

        </div>
      </main>
    </ResponsiveShell>
  )
}
