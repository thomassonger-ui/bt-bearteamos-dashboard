'use client'

import { useState, useRef } from 'react'
import type { Pipeline, EscrowLogEntry } from '@/types'

// ─── Escrow compliance rules (universal) ─────────────────────────────────────
const EMD_DEADLINE_DAYS = 3   // business days from effective date

function calcEscrowDue(effectiveDate: string): Date {
  const d = new Date(effectiveDate)
  d.setDate(d.getDate() + EMD_DEADLINE_DAYS)
  return d
}

export type EscrowStatusCode = 'green' | 'yellow' | 'red' | 'dispute' | 'released' | 'pending'

export function getEscrowStatus(lead: Pipeline): EscrowStatusCode {
  if (lead.escrow_status === 'disputed') return 'dispute'
  if (lead.escrow_status === 'released') return 'released'
  if (!lead.effective_date) return 'pending'

  const due = calcEscrowDue(lead.effective_date)
  const now = new Date()
  const hoursLeft = (due.getTime() - now.getTime()) / 3600000

  const hasProof = lead.escrow_proof_uploaded && lead.escrow_deposit_date
  const hasHolder = !!lead.escrow_holder

  if (hasProof) {
    const depositDate = new Date(lead.escrow_deposit_date!)
    return depositDate <= due ? 'green' : 'red'
  }

  if (hoursLeft < 0) return 'red'          // overdue — no deposit proof
  if (!hasHolder) return 'yellow'            // missing escrow holder
  if (hoursLeft < 48) return 'yellow'        // due within 48h
  return 'yellow'                            // in progress
}

const STATUS_CONFIG: Record<EscrowStatusCode, { label: string; color: string; bg: string; border: string }> = {
  green:    { label: 'EMD On Track',   color: '#4CAF50', bg: 'rgba(76,175,80,0.12)',   border: 'rgba(76,175,80,0.3)' },
  yellow:   { label: 'Action Needed',  color: '#FF9800', bg: 'rgba(255,152,0,0.10)',   border: 'rgba(255,152,0,0.3)' },
  red:      { label: 'OVERDUE',        color: '#E04E4E', bg: 'rgba(224,78,78,0.12)',   border: 'rgba(224,78,78,0.35)' },
  dispute:  { label: '⚠ DISPUTED',     color: '#E04E4E', bg: 'rgba(224,78,78,0.15)',   border: '#E04E4E' },
  released: { label: 'Released',       color: '#6b9cf5', bg: 'rgba(107,156,245,0.10)', border: 'rgba(107,156,245,0.3)' },
  pending:  { label: 'Set Eff. Date',  color: '#888',    bg: 'rgba(136,136,136,0.08)', border: 'rgba(136,136,136,0.2)' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
}

function countdown(due: Date): string {
  const h = Math.ceil((due.getTime() - Date.now()) / 3600000)
  if (h < 0) return `${Math.abs(Math.floor(h / 24))}d overdue`
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

interface Props {
  lead: Pipeline
  isAdmin: boolean
  userName: string
  onSave: (data: Record<string, string>) => Promise<void>
}

export default function EscrowPanel({ lead, isAdmin, userName, onSave }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const releaseRef = useRef<HTMLInputElement>(null)

  const status = getEscrowStatus(lead)
  const cfg = STATUS_CONFIG[status]
  const isDisputed = status === 'dispute'
  const isReleased = status === 'released'

  const due = lead.effective_date ? calcEscrowDue(lead.effective_date) : null
  const log: EscrowLogEntry[] = (lead.escrow_log ?? []) as EscrowLogEntry[]

  async function appendLog(action: string) {
    try {
      await fetch('/api/escrow-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, user: userName, action }),
      })
    } catch { /* non-blocking */ }
  }

  async function save(data: Record<string, string>, logMsg?: string) {
    setSaving(true)
    await onSave(data)
    if (logMsg) await appendLog(logMsg)
    setSaving(false)
  }

  async function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>, isRelease = false) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('leadId', lead.id)
      fd.append('type', isRelease ? 'release' : 'proof')
      const res = await fetch('/api/escrow-upload', { method: 'POST', body: fd })
      const { url } = await res.json()
      if (isRelease) {
        await save({ escrow_release_doc_url: url }, `Release document uploaded by ${userName}`)
      } else {
        await save(
          { escrow_proof_url: url, escrow_proof_uploaded: 'true', escrow_status: 'deposited' },
          `Deposit proof uploaded by ${userName} — file: ${file.name}`
        )
      }
    } catch { /* silent */ }
    setUploading(false)
  }

  async function flagDispute() {
    await save(
      { escrow_status: 'disputed', escrow_dispute_at: new Date().toISOString() },
      `Dispute flagged by ${userName} — disbursement locked`
    )
  }

  async function resolveDispute() {
    await save(
      { escrow_status: 'deposited', escrow_dispute_at: '' },
      `Dispute resolved by ${userName} (Admin)`
    )
  }

  async function releaseEscrow() {
    if (!lead.escrow_release_doc_url) {
      alert('Upload release document before releasing escrow.')
      return
    }
    await save(
      { escrow_status: 'released' },
      `Escrow released by ${userName} (Admin) — doc on file`
    )
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ marginBottom: 6, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 4 }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Escrow
          </span>
          <span style={{
            fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
            background: cfg.color, color: '#fff',
          }}>{cfg.label}</span>
          {due && status !== 'green' && status !== 'released' && (
            <span style={{ fontSize: 8, color: status === 'red' ? '#E04E4E' : '#FF9800', fontWeight: 700 }}>
              {countdown(due)}
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ background: 'transparent', border: 'none', color: 'var(--bt-text-dim)', fontSize: 10, cursor: 'pointer', padding: '0 2px' }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div style={{ padding: '0 8px 8px 8px' }}>

          {/* Dispute lock banner */}
          {isDisputed && (
            <div style={{ background: 'rgba(224,78,78,0.15)', border: '1px solid #E04E4E', borderRadius: 3, padding: '5px 8px', marginBottom: 6, fontSize: 9, color: '#E04E4E', fontWeight: 700 }}>
              ⚠ DISPUTE ACTIVE — Disbursement locked. Upload documentation and resolve before proceeding.
              {isAdmin && (
                <button onClick={resolveDispute} style={{ marginLeft: 8, fontSize: 8, padding: '2px 6px', background: '#E04E4E', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer' }}>
                  Resolve (Admin)
                </button>
              )}
            </div>
          )}

          {/* Required fields */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Required Fields
            </div>

            {/* Escrow Holder */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 8, color: 'var(--bt-text-dim)', marginBottom: 1 }}>
                Escrow Holder {!lead.escrow_holder && <span style={{ color: '#E04E4E' }}>*</span>}
              </div>
              <input
                defaultValue={lead.escrow_holder ?? ''}
                placeholder="Title company / Attorney"
                disabled={isDisputed || isReleased || !isAdmin && false}
                onBlur={async e => {
                  if (e.target.value !== (lead.escrow_holder ?? '')) {
                    await save({ escrow_holder: e.target.value }, `Escrow holder set to "${e.target.value}" by ${userName}`)
                  }
                }}
                style={{ width: '100%', padding: '3px 5px', fontSize: 9, background: 'var(--bt-surface)', border: `1px solid ${!lead.escrow_holder ? '#E04E4E' : 'var(--bt-border)'}`, color: 'var(--bt-text)', borderRadius: 3 }}
              />
            </div>

            {/* Amount */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: 'var(--bt-text-dim)', marginBottom: 1 }}>EMD Amount ($)</div>
                <input
                  type="number"
                  defaultValue={lead.escrow_amount ?? ''}
                  placeholder="0.00"
                  disabled={isDisputed || isReleased}
                  onBlur={async e => {
                    if (e.target.value && parseFloat(e.target.value) !== lead.escrow_amount) {
                      await save({ escrow_amount: e.target.value }, `EMD amount set to $${e.target.value} by ${userName}`)
                    }
                  }}
                  style={{ width: '100%', padding: '3px 5px', fontSize: 9, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 3 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: 'var(--bt-text-dim)', marginBottom: 1 }}>
                  Due Date {due && <span style={{ color: status === 'red' ? '#E04E4E' : '#FF9800', fontWeight: 700 }}>({fmtDate(due.toISOString())})</span>}
                </div>
                <div style={{ padding: '3px 5px', fontSize: 9, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--bt-border)', color: due && new Date() > due ? '#E04E4E' : 'var(--bt-text-dim)', borderRadius: 3, minHeight: 22 }}>
                  {due ? fmtDate(due.toISOString()) : 'Set effective date first'}
                </div>
              </div>
            </div>

            {/* Received / Deposit dates */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: 'var(--bt-text-dim)', marginBottom: 1 }}>Received Date</div>
                <input
                  type="date"
                  defaultValue={lead.escrow_received_date ?? ''}
                  disabled={isDisputed}
                  onBlur={async e => {
                    if (e.target.value !== (lead.escrow_received_date ?? '')) {
                      await save({ escrow_received_date: e.target.value }, `EMD received date logged: ${e.target.value} by ${userName}`)
                    }
                  }}
                  style={{ width: '100%', padding: '2px 4px', fontSize: 8, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 3 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: 'var(--bt-text-dim)', marginBottom: 1 }}>Deposit Date</div>
                <input
                  type="date"
                  defaultValue={lead.escrow_deposit_date ?? ''}
                  disabled={isDisputed}
                  onBlur={async e => {
                    if (e.target.value !== (lead.escrow_deposit_date ?? '')) {
                      await save({ escrow_deposit_date: e.target.value }, `Deposit date logged: ${e.target.value} by ${userName}`)
                    }
                  }}
                  style={{ width: '100%', padding: '2px 4px', fontSize: 8, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 3 }}
                />
              </div>
            </div>
          </div>

          {/* Proof upload */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Proof of Deposit {!lead.escrow_proof_uploaded && <span style={{ color: '#E04E4E' }}>* Required</span>}
            </div>
            {lead.escrow_proof_uploaded && lead.escrow_proof_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, color: '#4CAF50', fontWeight: 700 }}>✓ Document on file</span>
                <a href={lead.escrow_proof_url} target="_blank" rel="noreferrer" style={{ fontSize: 8, color: '#6b9cf5', textDecoration: 'underline' }}>View</a>
                {!isDisputed && (
                  <button onClick={() => fileRef.current?.click()} style={{ fontSize: 8, padding: '1px 5px', background: 'transparent', border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)', borderRadius: 2, cursor: 'pointer' }}>Replace</button>
                )}
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading || isDisputed}
                style={{ width: '100%', padding: '5px', fontSize: 9, fontWeight: 600, background: '#E04E4E', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}
              >
                {uploading ? 'Uploading...' : '↑ Upload Check Copy / Wire Receipt'}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => handleProofUpload(e, false)} />
          </div>

          {/* Admin-only controls */}
          {isAdmin && !isReleased && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginBottom: 6 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                Admin Controls
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {!isDisputed && (
                  <button onClick={flagDispute} style={{ fontSize: 8, padding: '3px 7px', background: 'rgba(224,78,78,0.15)', color: '#E04E4E', border: '1px solid rgba(224,78,78,0.4)', borderRadius: 3, cursor: 'pointer', fontWeight: 600 }}>
                    Flag Dispute
                  </button>
                )}
                <div style={{ flex: 1 }}>
                  {lead.escrow_release_doc_url ? (
                    <button onClick={releaseEscrow} disabled={isDisputed} style={{ width: '100%', fontSize: 8, padding: '3px 7px', background: isDisputed ? 'var(--bt-border)' : 'rgba(76,175,80,0.15)', color: isDisputed ? 'var(--bt-text-dim)' : '#4CAF50', border: `1px solid ${isDisputed ? 'var(--bt-border)' : 'rgba(76,175,80,0.4)'}`, borderRadius: 3, cursor: isDisputed ? 'default' : 'pointer', fontWeight: 600 }}>
                      Release Escrow
                    </button>
                  ) : (
                    <button onClick={() => releaseRef.current?.click()} disabled={isDisputed} style={{ width: '100%', fontSize: 8, padding: '3px 7px', background: 'transparent', color: 'var(--bt-text-dim)', border: '1px solid var(--bt-border)', borderRadius: 3, cursor: isDisputed ? 'default' : 'pointer' }}>
                      ↑ Upload Release Doc First
                    </button>
                  )}
                  <input ref={releaseRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleProofUpload(e, true)} />
                </div>
              </div>
            </div>
          )}

          {/* Audit log */}
          <div>
            <button onClick={() => setShowLog(v => !v)} style={{ background: 'transparent', border: 'none', fontSize: 8, color: 'var(--bt-text-dim)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              {showLog ? 'Hide' : 'Show'} Audit Log ({log.length})
            </button>
            {showLog && (
              <div style={{ marginTop: 4, maxHeight: 100, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '4px 6px' }}>
                {log.length === 0 ? (
                  <div style={{ fontSize: 8, color: 'var(--bt-text-dim)', fontStyle: 'italic' }}>No actions logged yet.</div>
                ) : (
                  [...log].reverse().map((entry, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 7, color: 'var(--bt-text-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {new Date(entry.ts).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ fontSize: 7, color: '#6b9cf5', flexShrink: 0 }}>{entry.user}</span>
                      <span style={{ fontSize: 7, color: 'var(--bt-text)' }}>{entry.action}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
