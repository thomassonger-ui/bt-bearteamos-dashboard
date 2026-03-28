'use client'

import { useState } from 'react'
import type { Pipeline } from '@/types'

// ─── Stage-aware recommended prompts ─────────────────────────────────────────
type Stage = Pipeline['stage'] | 'stalled' | 'default'

const STAGE_PROMPTS: Record<Stage, string[]> = {
  new_lead: [
    'If I could show you how to get ahead of other buyers right now, would you want to know how?',
    'If the right home came up this week, would you be in a position to act?',
    'If I could save you time and show you only homes that match exactly what you want, would that help?',
  ],
  attempting_contact: [
    'If I could show you why now is actually a great time to move, would you be open to a quick call?',
    'If I could get you more information with zero pressure, would that be worth a few minutes?',
    'If we could connect this week, I\'d love to share what\'s happening in your target area.',
  ],
  contacted: [
    'If we could lock in a time this week, I can show you exactly what\'s available in your price range.',
    'If I could get you in front of two or three homes this weekend, would you be open to it?',
    'If setting an appointment now could save you from losing a home later, would that be worth it?',
  ],
  appointment_set: [
    'Just confirming our appointment — is there anything specific you want me to pull together?',
    'I\'ll have a full market summary ready for when we meet. Looking forward to it.',
    'If anything changes before we meet, don\'t hesitate to reach out — I\'m flexible.',
  ],
  active_client: [
    'If we move quickly on this one, you could avoid competing offers — want me to schedule a showing?',
    'Based on what you\'ve told me, I have a home I think you\'ll want to see today.',
    'If we wait another week, pricing in this area is likely to shift — want to review options now?',
  ],
  under_contract: [
    'Everything is tracking well — I\'ll keep you posted on each milestone.',
    'If anything comes up before closing, I\'m on it. Don\'t hesitate to call.',
    'We\'re in the home stretch — I\'ll make sure nothing falls through the cracks.',
  ],
  closed: [
    'Congratulations again — if you know anyone thinking of buying or selling, I\'d love the referral.',
    'Now that you\'re settled in, if you have any questions about your new neighborhood, I\'m here.',
    'A quick 5-star review would mean the world — here\'s my profile link.',
  ],
  stalled: [
    'I wanted to check in — has anything changed on your end since we last spoke?',
    'If timing was the issue before, the market has shifted a bit — might be worth another look.',
    'I have a couple of new listings that match what you were looking for. Worth a quick call?',
  ],
  default: [
    'If I could show you how to net more without paying more, would you be open to a quick conversation?',
    'If buyers were already willing to pay more for your home, would you want to know how to reach them?',
    'If we could connect this week, I\'d love to share what\'s happening in your target area.',
  ],
}

// ─── Full tabbed scripts (reference library) ──────────────────────────────────
const TABS = ['FSBO', 'EXPIRED', 'LISTINGS', 'BUYERS', 'RENTERS'] as const
type Tab = typeof TABS[number]

const SCRIPTS: Record<Tab, string[]> = {
  FSBO: [
    'If I could show you how to net more without paying more, would you be open to a quick conversation?',
    'If buyers were already willing to pay more for your home, would you want to know how to reach them?',
    'If your home could sell faster and still net you more, would that be worth 10 minutes?',
    'If I could bring you a qualified buyer without disrupting your process, would you consider it?',
    'If you could avoid the biggest mistakes FSBO sellers make, would you want a quick walkthrough?',
  ],
  EXPIRED: [
    "If I could show you why your home didn't sell and fix it, would you be open to a quick conversation?",
    'If your home could be repositioned to attract buyers immediately, would that be worth discussing?',
    "If the issue wasn't your home but how it was marketed, would you want to see the difference?",
    "If I could get your home sold in today's market, would you give me 10 minutes?",
    "If you didn't have to go through the same frustration again, would you consider a different approach?",
  ],
  LISTINGS: [
    'If we could maximize your price without sitting on the market, would you want to see how?',
    'If pricing strategically could create multiple offers, would that interest you?',
    'If I could show you how buyers are actually making decisions right now, would that help?',
    'If the right strategy could save you weeks on market, would you be open to it?',
    'If we could control how buyers respond to your home, would that be worth reviewing?',
  ],
  BUYERS: [
    'If I could get you access to homes before they hit the market, would that help your search?',
    'If you could secure a home before competing buyers, would you want to know how?',
    'If waiting could cost you more later, would you be open to looking sooner?',
    'If I could simplify the process and save you time, would that be valuable?',
    'If the right home came up tomorrow, would you be ready to act?',
  ],
  RENTERS: [
    'If you could own for about the same monthly cost, would you want to explore it?',
    'If renting is costing you more long-term, would you want to see your options?',
    "If you're closer to owning than you think, would you be open to finding out?",
    'If I could show you a path to ownership with minimal upfront cost, would you consider it?',
    'If your rent could build equity instead, would that be worth a quick conversation?',
  ],
}

const STAGE_LABELS: Partial<Record<Stage, string>> = {
  new_lead: 'New Lead',
  attempting_contact: 'Attempting Contact',
  contacted: 'Contacted',
  appointment_set: 'Appointment Set',
  active_client: 'Active Client',
  under_contract: 'Under Contract',
  closed: 'Closed',
  stalled: 'Stalled',
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface CoachPanelProps {
  selectedLead?: Pipeline | null
}

export default function CoachPanel({ selectedLead }: CoachPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('FSBO')
  const [copied, setCopied] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  // Determine which stage prompts to show
  const stage: Stage = (() => {
    if (!selectedLead) return 'default'
    const s = selectedLead.stage as Stage
    // Check if stalled (no contact in 3+ days and not closed)
    const daysSince = (Date.now() - new Date(selectedLead.last_contact).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince >= 3 && s !== 'closed' && s !== 'under_contract') return 'stalled'
    return STAGE_PROMPTS[s] ? s : 'default'
  })()

  const recommended = STAGE_PROMPTS[stage]
  const stageLabel = selectedLead ? (STAGE_LABELS[stage] ?? stage) : null

  return (
    <div style={{
      width: '100%',
      background: 'var(--bt-surface)',
      border: '1px solid var(--bt-border)',
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--bt-border)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bt-accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>
            Coach / Scout
          </span>
        </div>
        {stageLabel && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: 'var(--bt-accent)',
            background: 'rgba(123,183,183,0.12)',
            border: '1px solid rgba(123,183,183,0.25)',
            borderRadius: 3,
            padding: '2px 7px',
            letterSpacing: '0.04em',
          }}>
            {stageLabel}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {/* ── Recommended Right Now ── */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bt-border)' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--bt-text-dim)',
            marginBottom: 10,
          }}>
            Recommended Right Now
          </div>
          {recommended.map((script, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: 8,
                padding: '9px 11px',
                background: 'rgba(123,183,183,0.06)',
                border: '1px solid rgba(123,183,183,0.18)',
                borderRadius: 5,
                position: 'relative',
              }}
            >
              <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--bt-text)', paddingRight: 24 }}>
                &ldquo;{script}&rdquo;
              </div>
              <button
                onClick={() => copy(script, `rec-${idx}`)}
                title="Copy"
                style={{
                  position: 'absolute', top: 7, right: 7,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 11, padding: '2px 3px', borderRadius: 3,
                  color: copied === `rec-${idx}` ? 'var(--bt-accent)' : 'var(--bt-muted)',
                }}
              >
                {copied === `rec-${idx}` ? '✓' : '⧉'}
              </button>
            </div>
          ))}
          {!selectedLead && (
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', fontStyle: 'italic', marginTop: 4 }}>
              Select a lead to get stage-specific prompts.
            </div>
          )}
        </div>

        {/* ── All Scripts (collapsible) ── */}
        <div style={{ padding: '10px 14px 0' }}>
          <button
            onClick={() => setShowAll(v => !v)}
            style={{
              width: '100%', textAlign: 'left',
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--bt-text-dim)',
              padding: '4px 0 10px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 9 }}>{showAll ? '▼' : '▶'}</span>
            All Scripts
          </button>

          {showAll && (
            <>
              {/* Tabs */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--bt-border)',
                marginBottom: 10,
                overflowX: 'auto',
              }}>
                {TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1,
                      padding: '7px 4px',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                      border: 'none',
                      borderBottom: activeTab === tab ? '2px solid var(--bt-accent)' : '2px solid transparent',
                      background: 'transparent',
                      color: activeTab === tab ? 'var(--bt-accent)' : 'var(--bt-text-dim)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Scripts */}
              <div style={{ paddingBottom: 14 }}>
                {SCRIPTS[activeTab].map((script, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom: 8,
                      padding: '9px 11px',
                      background: 'rgba(123,183,183,0.04)',
                      border: '1px solid var(--bt-border)',
                      borderRadius: 5,
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--bt-text)', paddingRight: 24 }}>
                      &ldquo;{script}&rdquo;
                    </div>
                    <button
                      onClick={() => copy(script, `tab-${idx}`)}
                      title="Copy"
                      style={{
                        position: 'absolute', top: 7, right: 7,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontSize: 11, padding: '2px 3px', borderRadius: 3,
                        color: copied === `tab-${idx}` ? 'var(--bt-accent)' : 'var(--bt-muted)',
                      }}
                    >
                      {copied === `tab-${idx}` ? '✓' : '⧉'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
