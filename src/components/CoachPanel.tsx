'use client'

import { useState } from 'react'

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
    'If I could show you why your home didn\'t sell and fix it, would you be open to a quick conversation?',
    'If your home could be repositioned to attract buyers immediately, would that be worth discussing?',
    'If the issue wasn\'t your home but how it was marketed, would you want to see the difference?',
    'If I could get your home sold in today\'s market, would you give me 10 minutes?',
    'If you didn\'t have to go through the same frustration again, would you consider a different approach?',
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
    'If you\'re closer to owning than you think, would you be open to finding out?',
    'If I could show you a path to ownership with minimal upfront cost, would you consider it?',
    'If your rent could build equity instead, would that be worth a quick conversation?',
  ],
}

export default function CoachPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('FSBO')
  const [copied, setCopied] = useState<number | null>(null)

  function copy(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div style={{
      width: 260,
      flexShrink: 0,
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
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bt-accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>
            Coach / Scout
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--bt-border)',
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--bt-accent)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab ? 'var(--bt-accent)' : 'var(--bt-text-dim)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Scripts — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', minHeight: 0 }}>
        {SCRIPTS[activeTab].map((script, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: 10,
              padding: '10px 12px',
              background: 'rgba(123,183,183,0.05)',
              border: '1px solid var(--bt-border)',
              borderRadius: 5,
              position: 'relative',
            }}
          >
            <div style={{
              fontSize: 12,
              lineHeight: 1.55,
              color: 'var(--bt-text)',
              paddingRight: 28,
            }}>
              &ldquo;{script}&rdquo;
            </div>
            <button
              onClick={() => copy(script, idx)}
              title="Copy script"
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                color: copied === idx ? 'var(--bt-accent)' : 'var(--bt-muted)',
                padding: '2px 4px',
                borderRadius: 3,
                transition: 'color 0.15s',
              }}
            >
              {copied === idx ? '✓' : '⧉'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
