'use client'

import { useState } from 'react'
import type { Pipeline, ChecklistEntry } from '@/types'
import EscrowPanel from '@/components/EscrowPanel'

interface Props {
  pipeline: Pipeline[]
  onContact?: (pipelineId: string, leadName: string) => Promise<void>
  onSelectLead?: (lead: Pipeline | null) => void
  selectedLeadId?: string | null
  onStageChange?: (pipelineId: string, newStage: string) => Promise<void>
  onEditSave?: (pipelineId: string, data: Record<string, string>) => Promise<void>
}

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'new_lead',           label: 'New Lead',        color: 'var(--bt-accent)' },
  { key: 'attempting_contact', label: 'Attempting',      color: '#FF9800' },
  { key: 'contacted',          label: 'Contacted',       color: '#6b9cf5' },
  { key: 'appointment_set',    label: 'Appt Set',        color: '#a084e8' },
  { key: 'active_client',      label: 'Active',          color: '#FF9800' },
  { key: 'under_contract',     label: 'Under Contract',  color: '#4CAF50' },
]

// ─── Pre-Contract compliance items ───────────────────────────────────────────
const PRE_CONTRACT_ITEMS: { key: string; label: string }[] = [
  { key: 'agency_disclosure',    label: 'Agency Disclosure Signed' },
  { key: 'buyer_seller_agmt',    label: 'Buyer/Seller Agreement Executed' },
  { key: 'pre_approval',         label: 'Pre-Approval / Proof of Funds' },
  { key: 'offer_submitted',      label: 'Offer Submitted' },
  { key: 'offer_accepted',       label: 'Offer Accepted / Ratified' },
]

// ─── Post-Close compliance items ─────────────────────────────────────────────
const POST_CLOSE_ITEMS: { key: string; label: string }[] = [
  { key: 'commission_auth',      label: 'Commission Disbursement Auth' },
  { key: 'broker_file',          label: 'File Submitted to Broker' },
  { key: 'followup_30day',       label: '30-Day Client Follow-Up' },
  { key: 'review_requested',     label: 'Review Request Sent' },
  { key: 'referral_requested',   label: 'Referral Request' },
  { key: 'tagged_past_client',   label: 'Tagged as Past Client' },
]

// ─── Transaction Section 2 checklist ─────────────────────────────────────────
const TX_SECTIONS = [
  {
    group: 'Contract & EMD',
    items: [
      { key: 'executed_contract',    label: 'Execute purchase agreement' },
      { key: 'emd_collected',        label: 'EMD collected & delivered' },
      { key: 'escrow_opened',        label: 'Escrow / title opened' },
    ],
  },
  {
    group: 'Inspection',
    items: [
      { key: 'inspection_ordered',     label: 'Inspection ordered' },
      { key: 'inspection_reviewed',    label: 'Inspection report reviewed' },
      { key: 'repair_requests_sent',   label: 'Repair requests submitted' },
      { key: 'repair_addendum_signed', label: 'Repair addendum signed' },
    ],
  },
  {
    group: 'Financing & Appraisal',
    items: [
      { key: 'loan_app_submitted', label: 'Loan application submitted' },
      { key: 'appraisal_ordered',  label: 'Appraisal ordered' },
      { key: 'appraisal_received', label: 'Appraisal received' },
      { key: 'clear_to_close',     label: 'Clear to close' },
    ],
  },
  {
    group: 'Title & Closing',
    items: [
      { key: 'title_commitment',   label: 'Title commitment received' },
      { key: 'closing_disclosure', label: 'Closing disclosure reviewed' },
      { key: 'final_walkthrough',  label: 'Final walkthrough done' },
      { key: 'keys_transferred',   label: 'Keys transferred / Closed' },
    ],
  },
]

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function fmtShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

// ─── Reusable compliance dropdown section ─────────────────────────────────────
function ComplianceSection({
  label,
  color,
  items,
  checklist,
  expanded,
  onToggle,
  onCheck,
  onDate,
}: {
  label: string
  color: string
  items: { key: string; label: string }[]
  checklist: Record<string, ChecklistEntry>
  expanded: boolean
  onToggle: () => void
  onCheck: (key: string, done: boolean) => void
  onDate: (key: string, date: string) => void
}) {
  const doneCount = items.filter(i => checklist[i.key]?.done).length
  const allDone = doneCount === items.length
  return (
    <div style={{ marginBottom: 6, background: `rgba(${color},0.06)`, border: `1px solid rgba(${color},0.2)`, borderRadius: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: `rgb(${color})`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: allDone ? '#4CAF50' : `rgb(${color})` }}>
            {doneCount}/{items.length}
          </span>
          <button
            onClick={onToggle}
            style={{ background: 'transparent', border: 'none', color: 'var(--bt-text-dim)', fontSize: 10, cursor: 'pointer', padding: '0 2px' }}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Items */}
      {expanded && (
        <div style={{ padding: '0 8px 8px 8px' }}>
          {items.map(item => {
            const entry = checklist[item.key] ?? { done: false }
            return (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {/* Checkbox */}
                <span
                  onClick={() => onCheck(item.key, !entry.done)}
                  style={{
                    width: 10, height: 10, borderRadius: 2, flexShrink: 0, cursor: 'pointer',
                    border: entry.done ? `1px solid rgb(${color})` : '1px solid var(--bt-border)',
                    background: entry.done ? `rgb(${color})` : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 7, color: '#fff',
                  }}
                >
                  {entry.done ? '✓' : ''}
                </span>
                {/* Label */}
                <span style={{
                  flex: 1, fontSize: 9,
                  color: entry.done ? `rgb(${color})` : 'var(--bt-text-dim)',
                  textDecoration: entry.done ? 'line-through' : 'none',
                }}>
                  {item.label}
                </span>
                {/* Date */}
                <input
                  type="date"
                  value={entry.date ?? ''}
                  onChange={e => onDate(item.key, e.target.value)}
                  style={{
                    width: 82, padding: '1px 3px', fontSize: 8,
                    background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
                    color: entry.date ? 'var(--bt-text)' : 'var(--bt-text-dim)', borderRadius: 2,
                  }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PipelineBoard({ pipeline, onContact, onSelectLead, selectedLeadId, onStageChange, onEditSave }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [emailLead, setEmailLead] = useState<string | null>(null)
  const [emailBody, setEmailBody] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const [editLeadId, setEditLeadId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{ lead_name: string; phone: string; email: string; property_address: string; notes: string; lead_type: string }>({ lead_name: '', phone: '', email: '', property_address: '', notes: '', lead_type: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [apptLead, setApptLead] = useState<Pipeline | null>(null)
  const [apptDate, setApptDate] = useState('')
  const [apptTime, setApptTime] = useState('10:00')
  const [apptDuration, setApptDuration] = useState('60')
  const [apptTitle, setApptTitle] = useState('')
  const [apptSaving, setApptSaving] = useState(false)
  const [apptStatus, setApptStatus] = useState<string | null>(null)
  // Section expand states
  const [expandedTx, setExpandedTx] = useState<Record<string, boolean>>({})
  const [expandedPre, setExpandedPre] = useState<Record<string, boolean>>({})
  const [expandedPost, setExpandedPost] = useState<Record<string, boolean>>({})

  const grouped = STAGES.map(s => ({
    ...s,
    leads: pipeline.filter(p => p.stage === s.key),
  }))

  const activeCount = pipeline.filter(p => !['closed', 'stalled'].includes(p.stage)).length

  async function saveComplianceChecklist(
    leadId: string,
    field: 'pre_contract_checklist' | 'post_close_checklist',
    current: Record<string, ChecklistEntry>,
    key: string,
    update: Partial<ChecklistEntry>
  ) {
    const updated = { ...current, [key]: { ...(current[key] ?? { done: false }), ...update } }
    await onEditSave?.(leadId, { [field]: JSON.stringify(updated) })
  }

  async function sendInlineEmail(lead: Pipeline) {
    if (!lead.email || !emailBody.trim() || emailSending) return
    setEmailSending(true)
    setEmailStatus(null)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lead.email,
          subject: `Following up — Bear Team Real Estate`,
          body: emailBody,
          fromName: 'Tom Songer',
          fromEmail: 'thomas.songer@gmail.com',
        }),
      })
      if (res.ok) {
        setEmailStatus('Sent!')
        setEmailBody('')
        setTimeout(() => { setEmailStatus(null); setEmailLead(null) }, 2000)
      } else { setEmailStatus('Failed') }
    } catch { setEmailStatus('Error') }
    finally { setEmailSending(false) }
  }

  function openApptSetter(lead: Pipeline) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    setApptLead(lead)
    setApptDate(tomorrow.toISOString().split('T')[0])
    setApptTime('10:00')
    setApptDuration('60')
    setApptTitle(`Meeting with ${lead.lead_name}`)
    setApptStatus(null)
  }

  async function saveAppointment() {
    if (!apptLead || !apptDate || !apptTime || apptSaving) return
    setApptSaving(true)
    setApptStatus(null)
    try {
      const start = new Date(`${apptDate}T${apptTime}:00`)
      const end = new Date(start.getTime() + parseInt(apptDuration) * 60 * 1000)
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      const title = encodeURIComponent(apptTitle || `Meeting with ${apptLead.lead_name}`)
      const details = encodeURIComponent(`Lead: ${apptLead.lead_name}\nType: ${apptLead.lead_type || 'N/A'}\nPhone: ${apptLead.phone || 'N/A'}\nEmail: ${apptLead.email || 'N/A'}`)
      const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${fmt(start)}/${fmt(end)}`
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = calUrl
      document.body.appendChild(iframe)
      if (onStageChange) await onStageChange(apptLead.id, 'appointment_set')
      setApptStatus('Saved! Check Google Calendar.')
      setTimeout(() => { setApptLead(null); setApptStatus(null); document.body.removeChild(iframe) }, 2500)
    } catch { setApptStatus('Error') }
    finally { setApptSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>
          Pipeline Board
        </span>
        <span style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>&middot; {activeCount} Active</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 6, alignItems: 'start' }}>
        {grouped.map(col => (
          <div
            key={col.key}
            onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={async e => {
              e.preventDefault(); setDragOver(null)
              if (dragId && onStageChange) await onStageChange(dragId, col.key)
              setDragId(null)
            }}
            style={{ background: dragOver === col.key ? 'rgba(123,183,183,0.05)' : 'transparent', borderRadius: 6, transition: 'background 0.15s', minHeight: 100 }}
          >
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', marginBottom: 6, borderBottom: `2px solid ${col.color}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: col.color }}>{col.label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--bt-text-dim)' }}>{col.leads.length}</span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 50 }}>
              {col.leads.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--bt-muted)', fontStyle: 'italic', textAlign: 'center', padding: '12px 4px' }}>No leads here</div>
              ) : (
                col.leads.map(lead => {
                  const d = daysSince(lead.last_contact)
                  const selected = lead.id === selectedLeadId
                  const stale = d >= 3
                  const dotColor = d === 0 ? '#4CAF50' : stale ? '#E04E4E' : '#FF9800'
                  const contactText = d === 0 ? 'Contacted today' : `${d}d \u2014 follow up`

                  const preCL  = (lead.pre_contract_checklist  ?? {}) as Record<string, ChecklistEntry>
                  const postCL = (lead.post_close_checklist ?? {}) as Record<string, ChecklistEntry>

                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDragId(lead.id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null) }}
                      onClick={() => onSelectLead?.(selectedLeadId === lead.id ? null : lead)}
                      style={{
                        background: selected ? 'rgba(123,183,183,0.08)' : 'var(--bt-surface)',
                        border: selected ? '1px solid var(--bt-accent)' : '1px solid var(--bt-border)',
                        borderRadius: 6, padding: '8px', cursor: 'grab',
                        opacity: dragId === lead.id ? 0.5 : 1,
                      }}
                    >
                      {/* Name row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{lead.lead_name}</span>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      </div>

                      {/* Badges */}
                      <div style={{ display: 'flex', gap: 3, marginBottom: 3, flexWrap: 'wrap' }}>
                        {lead.is_hot_lead && <span style={{ fontSize: 8, fontWeight: 700, background: '#E04E4E', color: '#fff', borderRadius: 2, padding: '1px 4px' }}>NBC</span>}
                        {lead.lead_type && (
                          <span style={{ fontSize: 8, fontWeight: 700, borderRadius: 2, padding: '1px 4px', background: lead.lead_type === 'buyer' ? '#1976D2' : lead.lead_type === 'seller' ? '#E04E4E' : '#9C27B0', color: '#fff' }}>
                            {lead.lead_type.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 9, color: dotColor, marginBottom: 5 }}>{contactText}</div>

                      {lead.notes && (
                        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginBottom: 6, lineHeight: 1.3 }}>
                          {lead.notes.length > 60 ? lead.notes.slice(0, 60) + '...' : lead.notes}
                        </div>
                      )}

                      {/* ─── Under Contract: all three compliance sections ─── */}
                      {col.key === 'under_contract' && (
                        <div onClick={e => e.stopPropagation()}>

                          {/* 1 ── Pre-Contract Compliance */}
                          <ComplianceSection
                            label="Pre-Contract"
                            color="107,156,245"
                            items={PRE_CONTRACT_ITEMS}
                            checklist={preCL}
                            expanded={!!expandedPre[lead.id]}
                            onToggle={() => setExpandedPre(p => ({ ...p, [lead.id]: !p[lead.id] }))}
                            onCheck={(key, done) => saveComplianceChecklist(lead.id, 'pre_contract_checklist', preCL, key, { done, date: done ? new Date().toISOString().split('T')[0] : undefined })}
                            onDate={(key, date) => saveComplianceChecklist(lead.id, 'pre_contract_checklist', preCL, key, { date })}
                          />

                          {/* 1.5 ── Escrow Compliance Panel */}
                          <EscrowPanel
                            lead={lead}
                            isAdmin={typeof window !== 'undefined' && sessionStorage.getItem('bt_is_admin') === 'true'}
                            userName={typeof window !== 'undefined' ? (sessionStorage.getItem('bt_agent_id') ?? 'Agent') : 'Agent'}
                            onSave={async (data) => { await onEditSave?.(lead.id, data) }}
                          />

                          {/* 2 ── Transaction Tracker */}
                          <div style={{ marginBottom: 6, background: 'rgba(76,175,80,0.06)', border: '1px solid rgba(76,175,80,0.2)', borderRadius: 4 }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderBottom: '1px solid rgba(76,175,80,0.15)' }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#4CAF50', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transaction</span>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {lead.target_close_date && (() => {
                                  const dLeft = Math.ceil((new Date(lead.target_close_date!).getTime() - Date.now()) / 86400000)
                                  return <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: dLeft <= 7 ? '#E04E4E' : '#4CAF50', color: '#fff' }}>{Math.max(0, dLeft)}d</span>
                                })()}
                                <button onClick={() => setExpandedTx(p => ({ ...p, [lead.id]: !p[lead.id] }))}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--bt-text-dim)', fontSize: 10, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>
                                  {expandedTx[lead.id] ? '▲' : '▼'}
                                </button>
                              </div>
                            </div>

                            {/* Dates row */}
                            <div style={{ padding: '5px 8px', borderBottom: expandedTx[lead.id] ? '1px solid rgba(76,175,80,0.15)' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                                <span style={{ fontSize: 9, color: 'var(--bt-text-dim)', whiteSpace: 'nowrap', minWidth: 62 }}>Eff. Date:</span>
                                {lead.effective_date ? (
                                  <span style={{ fontSize: 9, color: '#4CAF50', fontWeight: 700 }}>{fmtShort(lead.effective_date)} ✓</span>
                                ) : (
                                  <input type="date"
                                    onChange={async e => {
                                      if (!e.target.value) return
                                      await onEditSave?.(lead.id, { effective_date: e.target.value })
                                      if (lead.agent_id) fetch('/api/transaction-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id, agentId: lead.agent_id, effectiveDate: e.target.value }) }).catch(console.error)
                                    }}
                                    style={{ flex: 1, padding: '2px 4px', fontSize: 9, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 3 }}
                                  />
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 9, color: 'var(--bt-text-dim)', whiteSpace: 'nowrap', minWidth: 62 }}>Close Date:</span>
                                {lead.target_close_date ? (
                                  <span style={{ fontSize: 9, color: 'var(--bt-text)', fontWeight: 600 }}>{fmtShort(lead.target_close_date)}</span>
                                ) : (
                                  <input type="date"
                                    onChange={async e => { if (e.target.value) await onEditSave?.(lead.id, { target_close_date: new Date(e.target.value).toISOString() }) }}
                                    style={{ flex: 1, padding: '2px 4px', fontSize: 9, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 3 }}
                                  />
                                )}
                              </div>
                            </div>

                            {/* Expanded deadlines + checklist */}
                            {expandedTx[lead.id] && (
                              <div style={{ padding: '6px 8px' }}>
                                {lead.effective_date && (() => {
                                  const deadlines = [
                                    { label: 'EMD Due', day: 3 }, { label: 'Loan App', day: 5 },
                                    { label: 'Inspection End', day: 10 }, { label: 'Repair Request', day: 11 },
                                    { label: 'Seller Response', day: 13 }, { label: 'Appraisal', day: 21 },
                                  ]
                                  return (
                                    <div style={{ marginBottom: 8 }}>
                                      <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Critical Deadlines</div>
                                      {deadlines.map(dl => {
                                        const dueISO = addDaysISO(lead.effective_date!, dl.day)
                                        const past = new Date(dueISO) < new Date()
                                        return (
                                          <div key={dl.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                                            <span style={{ fontSize: 9, color: past ? '#E04E4E' : 'var(--bt-text-dim)' }}>{past ? '⚠ ' : ''}{dl.label}</span>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: past ? '#E04E4E' : 'var(--bt-text)' }}>{fmtShort(dueISO)}</span>
                                          </div>
                                        )
                                      })}
                                      {lead.target_close_date && (
                                        <>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                                            <span style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>Closing Disclosure</span>
                                            <span style={{ fontSize: 9, fontWeight: 700 }}>{fmtShort(addDaysISO(lead.target_close_date, -3))}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                                            <span style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>Final Walkthrough</span>
                                            <span style={{ fontSize: 9, fontWeight: 700 }}>{fmtShort(addDaysISO(lead.target_close_date, -1))}</span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )
                                })()}
                                {TX_SECTIONS.map(section => {
                                  const cl = (lead.tx_checklist ?? {}) as Record<string, boolean>
                                  const doneCount = section.items.filter(i => cl[i.key]).length
                                  return (
                                    <div key={section.group} style={{ marginBottom: 6 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, fontWeight: 700, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                                        <span>{section.group}</span>
                                        <span style={{ color: doneCount === section.items.length ? '#4CAF50' : 'var(--bt-text-dim)' }}>{doneCount}/{section.items.length}</span>
                                      </div>
                                      {section.items.map(item => {
                                        const checked = !!cl[item.key]
                                        return (
                                          <div key={item.key} onClick={async () => { const u = { ...cl, [item.key]: !checked }; await onEditSave?.(lead.id, { tx_checklist: JSON.stringify(u) }) }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0', cursor: 'pointer' }}>
                                            <span style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0, border: checked ? '1px solid #4CAF50' : '1px solid var(--bt-border)', background: checked ? '#4CAF50' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#fff' }}>{checked ? '✓' : ''}</span>
                                            <span style={{ fontSize: 9, color: checked ? '#4CAF50' : 'var(--bt-text-dim)', textDecoration: checked ? 'line-through' : 'none' }}>{item.label}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* 3 ── Post-Close Compliance */}
                          <ComplianceSection
                            label="Post-Close"
                            color="160,132,232"
                            items={POST_CLOSE_ITEMS}
                            checklist={postCL}
                            expanded={!!expandedPost[lead.id]}
                            onToggle={() => setExpandedPost(p => ({ ...p, [lead.id]: !p[lead.id] }))}
                            onCheck={(key, done) => saveComplianceChecklist(lead.id, 'post_close_checklist', postCL, key, { done, date: done ? new Date().toISOString().split('T')[0] : undefined })}
                            onDate={(key, date) => saveComplianceChecklist(lead.id, 'post_close_checklist', postCL, key, { date })}
                          />
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                        <button onClick={e => { e.stopPropagation(); onContact?.(lead.id, lead.lead_name) }} style={btnStyle('#26A69A', '#fff', true)}>Called</button>
                        <button onClick={e => { e.stopPropagation(); onContact?.(lead.id, lead.lead_name) }} style={btnStyle('#37474F', '#fff')}>VM</button>
                      </div>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                        <button onClick={e => { e.stopPropagation(); onContact?.(lead.id, lead.lead_name) }} style={btnStyle('var(--bt-border)', 'var(--bt-text-dim)')}>Spoke</button>
                        <button onClick={e => { e.stopPropagation(); if (lead.phone) window.open(`sms:${lead.phone.replace(/\D/g, '')}`); else alert('No phone number') }} style={btnStyle('var(--bt-border)', 'var(--bt-text-dim)')}>Text</button>
                      </div>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                        <button onClick={e => { e.stopPropagation(); if (!lead.email) { alert('No email'); return } setEmailLead(emailLead === lead.id ? null : lead.id); setEmailBody(''); setEmailStatus(null) }} style={btnStyle(emailLead === lead.id ? '#1976D2' : 'var(--bt-border)', emailLead === lead.id ? '#fff' : 'var(--bt-text-dim)')}>Email</button>
                        <button onClick={e => { e.stopPropagation(); openApptSetter(lead) }} style={btnStyle('var(--bt-border)', 'var(--bt-text-dim)')}>Appt</button>
                      </div>

                      {/* Inline email */}
                      {emailLead === lead.id && lead.email && (
                        <div onClick={e => e.stopPropagation()} style={{ marginBottom: 4, padding: '6px', background: 'var(--bt-muted)', borderRadius: 4 }}>
                          <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', marginBottom: 3 }}>To: {lead.email}</div>
                          <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Type your message..." rows={3} style={{ width: '100%', padding: '6px', fontSize: 10, lineHeight: 1.4, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 3, resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            <button onClick={() => sendInlineEmail(lead)} disabled={!emailBody.trim() || emailSending} style={{ fontSize: 9, padding: '3px 8px', fontWeight: 600, background: emailBody.trim() ? '#E04E4E' : 'var(--bt-border)', border: 'none', color: '#fff', borderRadius: 3, cursor: emailBody.trim() ? 'pointer' : 'default' }}>{emailSending ? '...' : emailStatus || 'Send'}</button>
                            <button onClick={() => setEmailLead(null)} style={{ fontSize: 9, padding: '3px 8px', background: 'transparent', border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)', borderRadius: 3, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {/* Inline edit form */}
                      {editLeadId === lead.id && (
                        <div onClick={e => e.stopPropagation()} style={{ marginBottom: 4, padding: '6px', background: 'var(--bt-muted)', borderRadius: 4 }}>
                          <input value={editData.lead_name} onChange={e => setEditData(d => ({ ...d, lead_name: e.target.value }))} placeholder="Name" style={{ ...inputStyle, marginBottom: 4 }} />
                          <input value={editData.phone} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} placeholder="Phone" style={{ ...inputStyle, marginBottom: 4 }} />
                          <input value={editData.email} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} placeholder="Email" style={{ ...inputStyle, marginBottom: 4 }} />
                          <input value={editData.property_address} onChange={e => setEditData(d => ({ ...d, property_address: e.target.value }))} placeholder="Address" style={{ ...inputStyle, marginBottom: 4 }} />
                          <select value={editData.lead_type} onChange={e => setEditData(d => ({ ...d, lead_type: e.target.value }))} style={{ ...inputStyle, marginBottom: 4 }}>
                            <option value="">Type</option>
                            <option value="buyer">Buyer</option>
                            <option value="seller">Seller</option>
                            <option value="rental">Rental</option>
                          </select>
                          <textarea value={editData.notes} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} placeholder="Notes" rows={2} style={{ ...inputStyle, resize: 'none', marginBottom: 4 }} />
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={async () => { setEditSaving(true); await onEditSave?.(lead.id, editData); setEditSaving(false); setEditLeadId(null) }} style={{ fontSize: 9, padding: '3px 8px', fontWeight: 600, background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>{editSaving ? '...' : 'Save'}</button>
                            <button onClick={() => setEditLeadId(null)} style={{ fontSize: 9, padding: '3px 8px', background: 'transparent', border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)', borderRadius: 3, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {/* Edit / Sleep / Stage */}
                      <div style={{ display: 'flex', gap: 3, borderTop: '1px solid var(--bt-border)', paddingTop: 4, flexWrap: 'wrap' }}>
                        <button onClick={e => { e.stopPropagation(); if (editLeadId === lead.id) { setEditLeadId(null); return } setEditLeadId(lead.id); setEditData({ lead_name: lead.lead_name || '', phone: lead.phone || '', email: lead.email || '', property_address: lead.property_address || '', notes: lead.notes || '', lead_type: lead.lead_type || '' }); onSelectLead?.(lead) }} style={editLeadId === lead.id ? { ...btnOutline, color: '#4CAF50', borderColor: '#4CAF50' } : btnOutline}>Edit</button>
                        <button onClick={e => { e.stopPropagation(); onContact?.(lead.id, lead.lead_name) }} style={btnOutline}>Sleep</button>
                        {col.key !== 'active_client' && <button onClick={async e => { e.stopPropagation(); await onStageChange?.(lead.id, 'active_client') }} style={{ ...btnOutline, color: '#FF9800', borderColor: '#FF9800' }}>Active</button>}
                        {col.key !== 'under_contract' && <button onClick={async e => { e.stopPropagation(); await onStageChange?.(lead.id, 'under_contract') }} style={{ ...btnOutline, color: '#4CAF50', borderColor: '#4CAF50' }}>Contract</button>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Floating Appointment Setter */}
      {apptLead && (
        <>
          <div onClick={() => setApptLead(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 380, background: '#0d1825', border: '1px solid var(--bt-border)', borderRadius: 8, padding: '20px', zIndex: 301, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Set Appointment</div>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{apptLead.lead_name}</div>
              </div>
              <button onClick={() => setApptLead(null)} style={{ background: 'transparent', border: 'none', color: 'var(--bt-text-dim)', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={labelStyle}>Title</label><input value={apptTitle} onChange={e => setApptTitle(e.target.value)} style={inputStyle} /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Date</label><input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)} style={inputStyle} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Time</label><input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)} style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>Duration</label><select value={apptDuration} onChange={e => setApptDuration(e.target.value)} style={inputStyle}><option value="30">30 min</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></div>
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', padding: '6px 0' }}>Lead: {apptLead.lead_type?.toUpperCase() || 'N/A'} &middot; {apptLead.phone || 'No phone'} &middot; {apptLead.email || 'No email'}</div>
              <button onClick={saveAppointment} disabled={!apptDate || apptSaving} style={{ width: '100%', padding: '10px', fontSize: 13, fontWeight: 700, background: apptStatus === 'Saved! Check Google Calendar.' ? '#4CAF50' : '#E04E4E', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                {apptSaving ? 'Setting...' : apptStatus || 'Set Appointment'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 4, outline: 'none', fontFamily: 'inherit' }
const btnStyle = (bg: string, color: string, bold = false): React.CSSProperties => ({ fontSize: 9, padding: '3px 7px', borderRadius: 3, background: bg, color, border: 'none', cursor: 'pointer', fontWeight: bold ? 600 : 400 })
const btnOutline: React.CSSProperties = { fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'transparent', color: 'var(--bt-text-dim)', border: '1px solid var(--bt-border)', cursor: 'pointer' }
