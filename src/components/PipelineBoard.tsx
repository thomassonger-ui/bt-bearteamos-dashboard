'use client'

import { useState } from 'react'
import type { Pipeline } from '@/types'

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

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export default function PipelineBoard({ pipeline, onContact, onSelectLead, selectedLeadId, onStageChange, onEditSave }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [emailLead, setEmailLead] = useState<string | null>(null)
  const [emailBody, setEmailBody] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const [editLeadId, setEditLeadId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{ lead_name: string; phone: string; email: string; address: string; notes: string; lead_type: string }>({ lead_name: '', phone: '', email: '', address: '', notes: '', lead_type: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [apptLead, setApptLead] = useState<Pipeline | null>(null)
  const [apptDate, setApptDate] = useState('')
  const [apptTime, setApptTime] = useState('10:00')
  const [apptDuration, setApptDuration] = useState('60')
  const [apptTitle, setApptTitle] = useState('')
  const [apptSaving, setApptSaving] = useState(false)
  const [apptStatus, setApptStatus] = useState<string | null>(null)

  const grouped = STAGES.map(s => ({
    ...s,
    leads: pipeline.filter(p => p.stage === s.key),
  }))

  const activeCount = pipeline.filter(p => !['closed', 'stalled'].includes(p.stage)).length

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
      const [h, m] = apptTime.split(':').map(Number)
      const start = new Date(`${apptDate}T${apptTime}:00`)
      const end = new Date(start.getTime() + parseInt(apptDuration) * 60 * 1000)
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

      // Create via Google Calendar API iframe
      const title = encodeURIComponent(apptTitle || `Meeting with ${apptLead.lead_name}`)
      const details = encodeURIComponent(`Lead: ${apptLead.lead_name}\nType: ${apptLead.lead_type || 'N/A'}\nPhone: ${apptLead.phone || 'N/A'}\nEmail: ${apptLead.email || 'N/A'}`)
      const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${fmt(start)}/${fmt(end)}`

      // Open in hidden iframe to avoid leaving page
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = calUrl
      document.body.appendChild(iframe)

      // Also update lead stage to appointment_set
      if (onStageChange) {
        await onStageChange(apptLead.id, 'appointment_set')
      }

      setApptStatus('Saved! Check Google Calendar.')
      setTimeout(() => {
        setApptLead(null)
        setApptStatus(null)
        document.body.removeChild(iframe)
      }, 2500)
    } catch {
      setApptStatus('Error')
    } finally { setApptSaving(false) }
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
              e.preventDefault()
              setDragOver(null)
              if (dragId && onStageChange) {
                await onStageChange(dragId, col.key)
              }
              setDragId(null)
            }}
            style={{
              background: dragOver === col.key ? 'rgba(123,183,183,0.05)' : 'transparent',
              borderRadius: 6, transition: 'background 0.15s',
              minHeight: 100,
            }}
          >
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 8px', marginBottom: 6,
              borderBottom: `2px solid ${col.color}`,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: col.color }}>
                {col.label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--bt-text-dim)' }}>{col.leads.length}</span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 50 }}>
              {col.leads.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--bt-muted)', fontStyle: 'italic', textAlign: 'center', padding: '12px 4px' }}>
                  No leads here
                </div>
              ) : (
                col.leads.map(lead => {
                  const d = daysSince(lead.last_contact)
                  const selected = lead.id === selectedLeadId
                  const stale = d >= 3
                  const dotColor = d === 0 ? '#4CAF50' : stale ? '#E04E4E' : '#FF9800'
                  const contactText = d === 0 ? 'Contacted today' : `${d}d \u2014 follow up`

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
                        {lead.is_hot_lead && (
                          <span style={{ fontSize: 8, fontWeight: 700, background: '#E04E4E', color: '#fff', borderRadius: 2, padding: '1px 4px' }}>NBC</span>
                        )}
                        {lead.lead_type && (
                          <span style={{
                            fontSize: 8, fontWeight: 700, borderRadius: 2, padding: '1px 4px',
                            background: lead.lead_type === 'buyer' ? '#1976D2' : lead.lead_type === 'seller' ? '#E04E4E' : '#9C27B0',
                            color: '#fff',
                          }}>{lead.lead_type.toUpperCase()}</span>
                        )}
                      </div>

                      {/* Contact status */}
                      <div style={{ fontSize: 9, color: dotColor, marginBottom: 5 }}>{contactText}</div>

                      {/* Notes preview */}
                      {lead.notes && (
                        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginBottom: 6, lineHeight: 1.3 }}>
                          {lead.notes.length > 60 ? lead.notes.slice(0, 60) + '...' : lead.notes}
                        </div>
                      )}

                      {/* Transaction Timeline — Under Contract only */}
                      {col.key === 'under_contract' && (
                        <div onClick={e => e.stopPropagation()} style={{
                          marginBottom: 6, padding: '6px', background: 'rgba(76,175,80,0.06)',
                          border: '1px solid rgba(76,175,80,0.2)', borderRadius: 4,
                        }}>
                          {/* Closing countdown */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#4CAF50', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Closing Timeline</span>
                            {lead.target_close_date && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
                                background: Math.ceil((new Date(lead.target_close_date).getTime() - Date.now()) / 86400000) <= 7 ? '#E04E4E' : '#4CAF50',
                                color: '#fff',
                              }}>
                                {Math.max(0, Math.ceil((new Date(lead.target_close_date).getTime() - Date.now()) / 86400000))}d left
                              </span>
                            )}
                          </div>

                          {/* Close date setter */}
                          {!lead.target_close_date && (
                            <div style={{ marginBottom: 5 }}>
                              <input
                                type="date"
                                onChange={async (e) => {
                                  if (e.target.value) await onEditSave?.(lead.id, { target_close_date: new Date(e.target.value).toISOString() })
                                }}
                                style={{ width: '100%', padding: '3px 5px', fontSize: 9, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 3 }}
                              />
                            </div>
                          )}

                          {/* Milestones */}
                          {[
                            { key: 'milestone_inspection', label: 'Inspection', icon: '\uD83D\uDD0D' },
                            { key: 'milestone_appraisal', label: 'Appraisal', icon: '\uD83D\uDCCA' },
                            { key: 'milestone_financing', label: 'Financing', icon: '\uD83C\uDFE6' },
                            { key: 'milestone_walkthrough', label: 'Final Walkthrough', icon: '\uD83D\uDEB6' },
                          ].map(ms => {
                            const done = !!(lead as unknown as Record<string, unknown>)[ms.key]
                            return (
                              <div
                                key={ms.key}
                                onClick={async () => {
                                  await onEditSave?.(lead.id, { [ms.key]: (!done).toString() })
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0',
                                  cursor: 'pointer', fontSize: 10,
                                  color: done ? '#4CAF50' : 'var(--bt-text-dim)',
                                  textDecoration: done ? 'line-through' : 'none',
                                }}
                              >
                                <span style={{
                                  width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                                  border: done ? '1px solid #4CAF50' : '1px solid var(--bt-border)',
                                  background: done ? '#4CAF50' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 8, color: '#fff',
                                }}>{done ? '\u2713' : ''}</span>
                                <span>{ms.icon} {ms.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Action buttons row 1: Called, VM */}
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                        <button onClick={(e) => { e.stopPropagation(); onContact?.(lead.id, lead.lead_name) }}
                          style={btnStyle('#26A69A', '#fff', true)}>Called</button>
                        <button onClick={(e) => { e.stopPropagation(); onContact?.(lead.id, lead.lead_name) }}
                          style={btnStyle('#37474F', '#fff')}>VM</button>
                      </div>

                      {/* Row 2: Spoke, Text */}
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                        <button onClick={(e) => { e.stopPropagation(); onContact?.(lead.id, lead.lead_name) }}
                          style={btnStyle('var(--bt-border)', 'var(--bt-text-dim)')}>Spoke</button>
                        <button onClick={(e) => {
                            e.stopPropagation()
                            if (lead.phone) window.open(`sms:${lead.phone.replace(/\D/g, '')}`)
                            else alert('No phone number')
                          }}
                          style={btnStyle('var(--bt-border)', 'var(--bt-text-dim)')}>Text</button>
                      </div>

                      {/* Row 3: Email (inline), Appt */}
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                        <button onClick={(e) => {
                            e.stopPropagation()
                            if (!lead.email) { alert('No email for this lead'); return }
                            setEmailLead(emailLead === lead.id ? null : lead.id)
                            setEmailBody('')
                            setEmailStatus(null)
                          }}
                          style={btnStyle(emailLead === lead.id ? '#1976D2' : 'var(--bt-border)', emailLead === lead.id ? '#fff' : 'var(--bt-text-dim)')}>Email</button>
                        <button onClick={(e) => { e.stopPropagation(); openApptSetter(lead) }}
                          style={btnStyle('var(--bt-border)', 'var(--bt-text-dim)')}>Appt</button>
                      </div>

                      {/* Inline email compose */}
                      {emailLead === lead.id && lead.email && (
                        <div onClick={e => e.stopPropagation()} style={{ marginBottom: 4, padding: '6px', background: 'var(--bt-muted)', borderRadius: 4 }}>
                          <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', marginBottom: 3 }}>To: {lead.email}</div>
                          <textarea
                            value={emailBody}
                            onChange={e => setEmailBody(e.target.value)}
                            placeholder="Type your message..."
                            rows={3}
                            style={{
                              width: '100%', padding: '6px', fontSize: 10, lineHeight: 1.4,
                              background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
                              color: 'var(--bt-text)', borderRadius: 3, resize: 'none', outline: 'none',
                              fontFamily: 'inherit',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            <button
                              onClick={() => sendInlineEmail(lead)}
                              disabled={!emailBody.trim() || emailSending}
                              style={{
                                fontSize: 9, padding: '3px 8px', fontWeight: 600,
                                background: emailBody.trim() ? '#E04E4E' : 'var(--bt-border)',
                                border: 'none', color: '#fff', borderRadius: 3, cursor: emailBody.trim() ? 'pointer' : 'default',
                              }}
                            >{emailSending ? '...' : emailStatus || 'Send'}</button>
                            <button onClick={() => setEmailLead(null)}
                              style={{ fontSize: 9, padding: '3px 8px', background: 'transparent', border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)', borderRadius: 3, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {/* Inline Edit Form */}
                      {editLeadId === lead.id && (
                        <div onClick={e => e.stopPropagation()} style={{ marginBottom: 4, padding: '6px', background: 'var(--bt-muted)', borderRadius: 4 }}>
                          <input value={editData.lead_name} onChange={e => setEditData(d => ({ ...d, lead_name: e.target.value }))} placeholder="Name" style={{ ...inputStyle, marginBottom: 4 }} />
                          <input value={editData.phone} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} placeholder="Phone" style={{ ...inputStyle, marginBottom: 4 }} />
                          <input value={editData.email} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} placeholder="Email" style={{ ...inputStyle, marginBottom: 4 }} />
                          <input value={editData.address} onChange={e => setEditData(d => ({ ...d, address: e.target.value }))} placeholder="Address" style={{ ...inputStyle, marginBottom: 4 }} />
                          <select value={editData.lead_type} onChange={e => setEditData(d => ({ ...d, lead_type: e.target.value }))} style={{ ...inputStyle, marginBottom: 4 }}>
                            <option value="">Type</option>
                            <option value="buyer">Buyer</option>
                            <option value="seller">Seller</option>
                            <option value="rental">Rental</option>
                          </select>
                          <textarea value={editData.notes} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} placeholder="Notes" rows={2} style={{ ...inputStyle, resize: 'none', marginBottom: 4 }} />
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={async () => {
                              setEditSaving(true)
                              await onEditSave?.(lead.id, editData)
                              setEditSaving(false)
                              setEditLeadId(null)
                            }} style={{ fontSize: 9, padding: '3px 8px', fontWeight: 600, background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
                              {editSaving ? '...' : 'Save'}
                            </button>
                            <button onClick={() => setEditLeadId(null)} style={{ fontSize: 9, padding: '3px 8px', background: 'transparent', border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)', borderRadius: 3, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {/* Edit / Sleep / Stage */}
                      <div style={{ display: 'flex', gap: 3, borderTop: '1px solid var(--bt-border)', paddingTop: 4, flexWrap: 'wrap' }}>
                        <button onClick={(e) => {
                            e.stopPropagation()
                            if (editLeadId === lead.id) { setEditLeadId(null); return }
                            setEditLeadId(lead.id)
                            setEditData({
                              lead_name: lead.lead_name || '',
                              phone: lead.phone || '',
                              email: lead.email || '',
                              address: lead.address || '',
                              notes: lead.notes || '',
                              lead_type: lead.lead_type || '',
                            })
                            onSelectLead?.(lead)
                          }}
                          style={editLeadId === lead.id ? { ...btnOutline, color: '#4CAF50', borderColor: '#4CAF50' } : btnOutline}>Edit</button>
                        <button onClick={(e) => { e.stopPropagation(); onContact?.(lead.id, lead.lead_name) }}
                          style={btnOutline}>Sleep</button>
                        {/* Stage move buttons */}
                        {col.key !== 'active_client' && (
                          <button onClick={async (e) => { e.stopPropagation(); await onStageChange?.(lead.id, 'active_client') }}
                            style={{ ...btnOutline, color: '#FF9800', borderColor: '#FF9800' }}>Active</button>
                        )}
                        {col.key !== 'under_contract' && (
                          <button onClick={async (e) => { e.stopPropagation(); await onStageChange?.(lead.id, 'under_contract') }}
                            style={{ ...btnOutline, color: '#4CAF50', borderColor: '#4CAF50' }}>Contract</button>
                        )}
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
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 380, background: '#0d1825', border: '1px solid var(--bt-border)',
            borderRadius: 8, padding: '20px', zIndex: 301,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Set Appointment</div>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{apptLead.lead_name}</div>
              </div>
              <button onClick={() => setApptLead(null)} style={{ background: 'transparent', border: 'none', color: 'var(--bt-text-dim)', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={apptTitle} onChange={e => setApptTitle(e.target.value)}
                  style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)}
                    style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Time</label>
                  <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)}
                    style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Duration</label>
                <select value={apptDuration} onChange={e => setApptDuration(e.target.value)}
                  style={inputStyle}>
                  <option value="30">30 min</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', padding: '6px 0' }}>
                Lead: {apptLead.lead_type?.toUpperCase() || 'N/A'} &middot; {apptLead.phone || 'No phone'} &middot; {apptLead.email || 'No email'}
              </div>
              <button
                onClick={saveAppointment}
                disabled={!apptDate || apptSaving}
                style={{
                  width: '100%', padding: '10px', fontSize: 13, fontWeight: 700,
                  background: apptStatus === 'Saved! Check Google Calendar.' ? '#4CAF50' : '#E04E4E',
                  color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
                }}
              >
                {apptSaving ? 'Setting...' : apptStatus || 'Set Appointment'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--bt-text-dim)',
  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 12,
  background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
  color: 'var(--bt-text)', borderRadius: 4, outline: 'none',
  fontFamily: 'inherit',
}

const btnStyle = (bg: string, color: string, bold = false): React.CSSProperties => ({
  fontSize: 9, padding: '3px 7px', borderRadius: 3,
  background: bg, color, border: 'none', cursor: 'pointer',
  fontWeight: bold ? 600 : 400,
})

const btnOutline: React.CSSProperties = {
  fontSize: 9, padding: '2px 6px', borderRadius: 3,
  background: 'transparent', color: 'var(--bt-text-dim)',
  border: '1px solid var(--bt-border)', cursor: 'pointer',
}
