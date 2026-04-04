'use client'

import type { Agent, Pipeline } from '@/types'

// ─── Contract Terms ──────────────────────────────────────────────────────────
// Pre-contract payments (before ICA effective date April 1, 2026)
const PRE_CONTRACT_PAYMENTS: { month: number; year: number; label: string; amount: number; type: string }[] = [
  { month: 1, year: 2026, label: 'Feb', amount: 1500, type: 'Academy (pre-contract)' },
  { month: 2, year: 2026, label: 'Mar', amount: 1500, type: 'Academy (pre-contract)' },
  { month: 3, year: 2026, label: 'Apr', amount: 1500, type: 'Academy' },
  { month: 3, year: 2026, label: 'Apr', amount: 2000, type: 'Stipend' },
]

const BASE_PHASES = [
  { label: 'Phase 1', start: '2026-04-01', end: '2026-08-31', monthly: 3500, rationale: 'Ramp / systems build-out' },
  { label: 'Phase 2', start: '2026-09-01', end: '2026-12-31', monthly: 2500, rationale: 'Stabilization / pipeline growth' },
  { label: 'Phase 3', start: '2027-01-01', end: '2099-12-31', monthly: 3000, rationale: 'Steady-state operations' },
]

const OVERRIDE_STANDARD = 0.05 // 5% until 99 deals
const OVERRIDE_ENHANCED = 0.06 // 6% after 100 deals
const OVERRIDE_THRESHOLD = 100

const BONUSES = [
  { deals: 25, amount: 2500 },
  { deals: 40, amount: 5000 },
  { deals: 50, amount: 7500 },
  { deals: 75, amount: 10000 },
  { deals: 100, amount: 20000 },
]

// Beth Baer's agent ID — her personal production is excluded from override
const BETH_AGENT_ID_EXCLUSIONS = ['3d9b7a89-39c9-4575-8ec5-6e7721732168']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Props {
  agents: Agent[]
  allDeals: Pipeline[]
}

function getPhase(date: Date) {
  const iso = date.toISOString().slice(0, 10)
  return BASE_PHASES.find(p => iso >= p.start && iso <= p.end) ?? BASE_PHASES[BASE_PHASES.length - 1]
}

export default function RecruiterPerformance({ agents, allDeals }: Props) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Filter out Beth's personal deals for override calculation
  const eligibleDeals = allDeals.filter(d => !BETH_AGENT_ID_EXCLUSIONS.includes(d.agent_id))
  const totalCumulativeDeals = eligibleDeals.length

  // Override rate
  const overrideRate = totalCumulativeDeals >= OVERRIDE_THRESHOLD ? OVERRIDE_ENHANCED : OVERRIDE_STANDARD

  // Monthly breakdown
  const monthlyData = MONTHS.map((label, monthIdx) => {
    const monthDeals = eligibleDeals.filter(d => {
      const closeDate = d.closed_date ? new Date(d.closed_date) : new Date(d.created_at)
      return closeDate.getFullYear() === currentYear && closeDate.getMonth() === monthIdx
    })

    const monthGCI = monthDeals.reduce((sum, d) => sum + (d.gci ?? (d.sale_price ?? 0) * (d.commission_rate ?? 0.025)), 0)
    const override = monthGCI * overrideRate

    // Pre-contract payments for this month
    const preContractPayments = PRE_CONTRACT_PAYMENTS.filter(p => p.month === monthIdx && p.year === currentYear)
    const preContractTotal = preContractPayments.reduce((s, p) => s + p.amount, 0)
    const preContractLabel = preContractPayments.map(p => `${p.type}: $${p.amount.toLocaleString()}`).join(' + ')

    // Base compensation for this month (contract base starts April)
    const monthDate = new Date(currentYear, monthIdx, 15)
    const phase = getPhase(monthDate)
    const isPast = monthIdx <= currentMonth
    const contractStarted = monthIdx >= 3 // April = month 3
    const base = isPast && contractStarted ? phase.monthly : 0

    // Actual paid = pre-contract payments OR contract base (not both for same month)
    const actualPaid = preContractTotal > 0 ? preContractTotal : base

    // Bonus check — cumulative deals up to this month
    const cumulativeDealsToMonth = eligibleDeals.filter(d => {
      const closeDate = d.closed_date ? new Date(d.closed_date) : new Date(d.created_at)
      return closeDate.getFullYear() < currentYear ||
        (closeDate.getFullYear() === currentYear && closeDate.getMonth() <= monthIdx)
    }).length

    let bonusThisMonth = 0
    for (const b of BONUSES) {
      const cumulativePrevMonth = eligibleDeals.filter(d => {
        const closeDate = d.closed_date ? new Date(d.closed_date) : new Date(d.created_at)
        return closeDate.getFullYear() < currentYear ||
          (closeDate.getFullYear() === currentYear && closeDate.getMonth() < monthIdx)
      }).length
      if (cumulativeDealsToMonth >= b.deals && cumulativePrevMonth < b.deals) {
        bonusThisMonth += b.amount
      }
    }

    return {
      label, monthIdx, deals: monthDeals.length, gci: monthGCI,
      override, base: actualPaid, bonus: bonusThisMonth,
      total: actualPaid + override + bonusThisMonth,
      isPast, preContractLabel,
    }
  })

  // YTD totals
  const ytdBase = monthlyData.reduce((s, m) => s + m.base, 0)
  const ytdOverride = monthlyData.reduce((s, m) => s + m.override, 0)
  const ytdBonus = monthlyData.reduce((s, m) => s + m.bonus, 0)
  const ytdTotal = ytdBase + ytdOverride + ytdBonus
  const ytdDeals = monthlyData.reduce((s, m) => s + m.deals, 0)
  const ytdGCI = monthlyData.reduce((s, m) => s + m.gci, 0)

  // Projected annual
  const monthsElapsed = currentMonth + 1
  const projectedDeals = ytdDeals > 0 ? Math.round((ytdDeals / monthsElapsed) * 12) : 0
  const projectedTotal = ytdTotal > 0 ? Math.round((ytdTotal / monthsElapsed) * 12) : 0

  // Current phase
  const currentPhase = getPhase(now)

  // Next bonus milestone
  const nextBonus = BONUSES.find(b => totalCumulativeDeals < b.deals)
  const earnedBonuses = BONUSES.filter(b => totalCumulativeDeals >= b.deals)

  // Eligible agent count
  const eligibleAgentCount = agents.filter(a => !BETH_AGENT_ID_EXCLUSIONS.includes(a.id)).length

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,82,82,0.06)', border: '1px solid rgba(224,82,82,0.15)', borderRadius: 6, fontSize: 10, color: 'var(--bt-text-dim)' }}>
        CONFIDENTIAL &mdash; Visible to Tom Songer and Beth Baer only. Per ICA dated April 1, 2026.
      </div>

      {/* Top Cards */}
      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>

        {/* Total Compensation */}
        <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
          <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>YTD Total Compensation</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#4CAF50' }}>${ytdTotal.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 4 }}>Projected annual: ${projectedTotal.toLocaleString()}</div>
        </div>

        {/* Base */}
        <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
          <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Base Compensation</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>${ytdBase.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--bt-accent)', marginTop: 4 }}>{currentPhase.label}: ${currentPhase.monthly.toLocaleString()}/mo</div>
          <div style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>{currentPhase.rationale}</div>
        </div>

        {/* Override */}
        <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
          <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Override Earned</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#FF9800' }}>${Math.round(ytdOverride).toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 4 }}>
            {Math.round(overrideRate * 100)}% of ${Math.round(ytdGCI).toLocaleString()} GCI
          </div>
          <div style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>{eligibleAgentCount} eligible agents &middot; {ytdDeals} deals</div>
        </div>

        {/* Bonuses */}
        <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
          <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Bonuses Earned</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#a084e8' }}>${ytdBonus.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 4 }}>
            {earnedBonuses.length}/{BONUSES.length} milestones hit
          </div>
        </div>
      </div>

      {/* Bonus Milestones */}
      <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px', marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>Production Bonus Milestones</div>
        <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {BONUSES.map(b => {
            const hit = totalCumulativeDeals >= b.deals
            const isNext = nextBonus?.deals === b.deals
            return (
              <div key={b.deals} style={{
                padding: '10px', borderRadius: 4, textAlign: 'center',
                border: isNext ? '2px solid #FF9800' : hit ? '2px solid #4CAF50' : '1px solid var(--bt-border)',
                background: hit ? 'rgba(76,175,80,0.08)' : isNext ? 'rgba(255,152,0,0.06)' : 'transparent',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: hit ? '#4CAF50' : 'var(--bt-text)' }}>${b.amount.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 2 }}>{b.deals} deals</div>
                <div style={{ fontSize: 9, fontWeight: 600, marginTop: 4, color: hit ? '#4CAF50' : isNext ? '#FF9800' : 'var(--bt-muted)' }}>
                  {hit ? 'EARNED' : isNext ? `${b.deals - totalCumulativeDeals} to go` : 'PENDING'}
                </div>
              </div>
            )
          })}
        </div>
        {/* Progress bar */}
        {nextBonus && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--bt-text-dim)', marginBottom: 3 }}>
              <span>Cumulative deals: {totalCumulativeDeals}</span>
              <span>Next: {nextBonus.deals} deals (${nextBonus.amount.toLocaleString()})</span>
            </div>
            <div style={{ height: 6, background: 'var(--bt-border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, background: '#FF9800',
                width: `${Math.min((totalCumulativeDeals / nextBonus.deals) * 100, 100)}%`,
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Override Rate Info */}
      <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px', marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>Override Rate</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{
            padding: '10px 16px', borderRadius: 4, textAlign: 'center',
            border: overrideRate === OVERRIDE_STANDARD ? '2px solid var(--bt-accent)' : '1px solid var(--bt-border)',
            background: overrideRate === OVERRIDE_STANDARD ? 'rgba(123,183,183,0.08)' : 'transparent',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>5%</div>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>Standard (1&ndash;99 deals)</div>
          </div>
          <div style={{
            padding: '10px 16px', borderRadius: 4, textAlign: 'center',
            border: overrideRate === OVERRIDE_ENHANCED ? '2px solid #4CAF50' : '1px solid var(--bt-border)',
            background: overrideRate === OVERRIDE_ENHANCED ? 'rgba(76,175,80,0.08)' : 'transparent',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>6%</div>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>Enhanced (100+ deals)</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--bt-text-dim)' }}>
            {totalCumulativeDeals < OVERRIDE_THRESHOLD
              ? `${OVERRIDE_THRESHOLD - totalCumulativeDeals} deals until enhanced rate`
              : 'Enhanced rate active'}
          </div>
        </div>
      </div>

      {/* Monthly Summary Table */}
      <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '16px' }}>
        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>Monthly Breakdown — {currentYear}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--bt-border)' }}>
              {['Month', 'Deals', 'GCI', 'Base', 'Override', 'Bonus', 'Total'].map(h => (
                <th key={h} style={{ textAlign: h === 'Month' ? 'left' : 'right', padding: '8px 6px', fontSize: 9, fontWeight: 600, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthlyData.map(m => (
              <tr key={m.label} style={{
                borderBottom: '1px solid var(--bt-border)',
                opacity: m.isPast ? 1 : 0.4,
              }}>
                <td style={{ padding: '8px 6px', fontWeight: m.monthIdx === currentMonth ? 700 : 400 }}>
                  {m.label} {m.monthIdx === currentMonth && '\u25C0'}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{m.deals || '\u2014'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{m.gci > 0 ? `$${Math.round(m.gci).toLocaleString()}` : '\u2014'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} title={m.preContractLabel || ''}>{m.base > 0 ? `$${m.base.toLocaleString()}` : '\u2014'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: '#FF9800' }}>{m.override > 0 ? `$${Math.round(m.override).toLocaleString()}` : '\u2014'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: '#a084e8' }}>{m.bonus > 0 ? `$${m.bonus.toLocaleString()}` : '\u2014'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: '#4CAF50' }}>{m.total > 0 ? `$${Math.round(m.total).toLocaleString()}` : '\u2014'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--bt-border)' }}>
              <td style={{ padding: '10px 6px', fontWeight: 700, fontSize: 11 }}>YTD TOTAL</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700 }}>{ytdDeals}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700 }}>${Math.round(ytdGCI).toLocaleString()}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700 }}>${ytdBase.toLocaleString()}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, color: '#FF9800' }}>${Math.round(ytdOverride).toLocaleString()}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, color: '#a084e8' }}>${ytdBonus.toLocaleString()}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, color: '#4CAF50' }}>${Math.round(ytdTotal).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Contract reference */}
      <div style={{ marginTop: 16, fontSize: 9, color: 'var(--bt-muted)', lineHeight: 1.5 }}>
        Per Independent Contractor Agreement dated April 1, 2026. Base Compensation per Section 4.1. Override per Section 4.3 (5% standard / 6% enhanced at 100 deals). Bonuses per Section 4.4 (cumulative, non-forfeitable). Beth Baer personal production excluded per Section 3.3. GCI calculated pre-deduction per Section 3.1.
      </div>
    </div>
  )
}
