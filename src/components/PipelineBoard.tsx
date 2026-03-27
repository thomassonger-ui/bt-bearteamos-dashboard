'use client'

import type { Pipeline } from '@/types'

interface Props {
  pipeline: Pipeline[]
  onContact?: (pipelineId: string, leadName: string) => Promise<void>
}

const STAGE_ORDER = [
  'new_lead', 'contacted', 'appointment_set', 'under_contract', 'closed', 'stalled',
]

const STAGE_LABEL: Record<string, string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  appointment_set: 'Appointment Set',
  under_contract: 'Under Contract',
  closed: 'Closed',
  stalled: 'Stalled',
}

const STAGE_COLOR: Record<string, string> = {
  new_lead: 'var(--bt-accent)',
  contacted: '#6b9cf5',
  appointment_set: '#a084e8',
  under_contract: 'var(--bt-green)',
  closed: 'var(--bt-green)',
  stalled: 'var(--bt-red)',
}

function daysSince(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24))
}

export default function PipelineBoard({ pipeline, onContact }: Props) {
  // Group by stage — also include any stages in data not in STAGE_ORDER
  const allStages = [...new Set([...STAGE_ORDER, ...pipeline.map((p) => p.stage)])]

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bt-border)' }}>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Pipeline
        </div>
      </div>

      <div style={{ padding: '12px 20px' }}>
        {allStages.map((stage) => {
          const leads = pipeline.filter((p) => p.stage === stage)
          return (
            <div key={stage} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: STAGE_COLOR[stage] ?? 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                  {STAGE_LABEL[stage] ?? stage}
                </div>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>{leads.length}</div>
              </div>

              {leads.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', fontStyle: 'italic' }}>—</div>
              ) : (
                leads.map((lead) => {
                  const days = daysSince(lead.last_contact)
                  const stale = days >= 3
                  return (
                    <div key={lead.id} style={{
                      padding: '10px 14px', background: 'var(--bt-muted)', borderRadius: 4, marginBottom: 6,
                      border: stale ? '1px solid rgba(224,82,82,0.3)' : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{lead.lead_name}</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ fontSize: 11, color: stale ? 'var(--bt-red)' : 'var(--bt-text-dim)' }}>
                            {days === 0 ? 'Today' : `${days}d ago`}
                          </div>
                          {onContact && stage !== 'closed' && (
                            <button
                              onClick={() => onContact(lead.id, lead.lead_name)}
                              style={{ fontSize: 10, padding: '2px 7px', border: '1px solid var(--bt-accent)', background: 'transparent', color: 'var(--bt-accent)', borderRadius: 3, cursor: 'pointer' }}
                            >
                              Log Contact
                            </button>
                          )}
                        </div>
                      </div>
                      {lead.notes && (
                        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 3 }}>{lead.notes}</div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
