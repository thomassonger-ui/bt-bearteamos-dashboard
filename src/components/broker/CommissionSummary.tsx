'use client'

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

export default function CommissionSummary({ agents, allDeals }: Props) {
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
