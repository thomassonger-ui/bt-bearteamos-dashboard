'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { Pipeline } from '@/types'
import { getEscrowStatus, type EscrowStatusCode } from '@/components/EscrowPanel'

const BADGE_COLORS: Record<EscrowStatusCode, { bg: string; label: string }> = {
  green:    { bg: '#4CAF50', label: 'On Track'  },
  yellow:   { bg: '#FF9800', label: 'Attention' },
  red:      { bg: '#E04E4E', label: 'Overdue'   },
  dispute:  { bg: '#9C27B0', label: 'Dispute'   },
  released: { bg: '#26A69A', label: 'Released'  },
  pending:  { bg: '#607D8B', label: 'Pending'   },
}

function EscrowBadge({ status }: { status: EscrowStatusCode }) {
  const { bg, label } = BADGE_COLORS[status]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
      background: bg, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {label}
    </span>
  )
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function calcEMDDue(effectiveDate?: string) {
  if (!effectiveDate) return '—'
  const d = new Date(effectiveDate)
  d.setDate(d.getDate() + 3)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function ComplianceTransactionsPage() {
  const [leads, setLeads] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)

  useEffect(() => {
    const admin = sessionStorage.getItem('bt_is_admin') === 'true'
    const aid   = sessionStorage.getItem('bt_agent_id')
    setIsAdmin(admin)
    setAgentId(aid)

    async function load() {
      const supabase = getSupabase()
      let query = supabase
        .from('pipeline')
        .select('*')
        .eq('stage', 'under_contract')
        .order('effective_date', { ascending: true })

      if (!admin && aid) {
        query = query.eq('agent_id', aid)
      }

      const { data } = await query
      setLeads(data ?? [])
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--bt-text-dim)', fontSize: 13 }}>
        Loading compliance data...
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--bt-text)' }}>
          Escrow Compliance
        </span>
        {isAdmin && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 3, background: '#E04E4E', color: '#fff' }}>
            ADMIN VIEW — ALL AGENTS
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginLeft: 'auto' }}>
          {leads.length} Under Contract
        </span>
      </div>

      {leads.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--bt-text-dim)', fontStyle: 'italic' }}>
          No active under-contract deals.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bt-border)' }}>
                {['Deal', isAdmin ? 'Agent ID' : null, 'Effective Date', 'EMD Due (Day 3)', 'Proof on File', 'Escrow Status', 'Issues']
                  .filter(Boolean)
                  .map(h => (
                    <th key={h!} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 9, fontWeight: 700, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => {
                const status = getEscrowStatus(lead)
                const issues: string[] = []
                if (!lead.effective_date)      issues.push('No effective date')
                if (!lead.escrow_proof_uploaded) issues.push('Proof not uploaded')
                if (status === 'red')          issues.push('EMD overdue')
                if (status === 'dispute')      issues.push('Dispute active')

                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid var(--bt-border)', background: status === 'red' || status === 'dispute' ? 'rgba(224,78,78,0.05)' : 'transparent' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--bt-text)' }}>
                      {lead.lead_name}
                      {lead.property_address && (
                        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', fontWeight: 400 }}>{lead.property_address}</div>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '8px 10px', color: 'var(--bt-text-dim)', fontSize: 11 }}>
                        {lead.agent_id ?? '—'}
                      </td>
                    )}
                    <td style={{ padding: '8px 10px' }}>{fmtDate(lead.effective_date)}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: status === 'red' ? '#E04E4E' : 'var(--bt-text)' }}>
                      {calcEMDDue(lead.effective_date)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {lead.escrow_proof_uploaded ? (
                        <span style={{ color: '#4CAF50', fontWeight: 700 }}>✓ Yes</span>
                      ) : (
                        <span style={{ color: '#E04E4E', fontWeight: 700 }}>✗ No</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <EscrowBadge status={status} />
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: '#E04E4E' }}>
                      {issues.length === 0
                        ? <span style={{ color: '#4CAF50' }}>None</span>
                        : issues.join(' · ')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Object.entries(BADGE_COLORS).map(([key, { bg, label }]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: bg }} />
            <span style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
