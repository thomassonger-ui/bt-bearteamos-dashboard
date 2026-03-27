'use client'

// PLACEHOLDER — Phase 1 only. No AI integration.

const KNOWLEDGE_ITEMS = [
  {
    category: 'Commission',
    q: 'What is the commission split structure?',
    a: '60/40 → 70/30 → 80/20 → 90/10. Advances automatically at each $16,000 company dollar cap. No monthly fees. $150 flat transaction fee per closing.',
  },
  {
    category: 'Compliance',
    q: 'What is required in the first 30 days?',
    a: 'Fair Housing Training, E&O acknowledgment, BearTeam Standards sign-off, MLS board orientation, and BearTeam Academy Week 1–2 modules.',
  },
  {
    category: 'Pipeline',
    q: 'When should I escalate a stalled lead?',
    a: 'If no contact for 7+ days, trigger an intervention task. Notify team lead after 10 days of no response.',
  },
  {
    category: 'Onboarding',
    q: 'What changes at day 30?',
    a: 'Phase shifts from Foundation to Pipeline. Task expectations move from setup/compliance to active prospecting and pipeline building.',
  },
  {
    category: 'Operations',
    q: 'What costs do agents have?',
    a: 'Only cost: $150 flat transaction fee per closing. Zero monthly fees, desk fees, or technology fees. E&O is covered by brokerage.',
  },
]

export default function KnowledgeQuery() {
  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bt-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Knowledge Base
        </div>
        <div style={{ fontSize: 10, color: 'var(--bt-accent)', letterSpacing: '0.06em' }}>
          PHASE 1 — STATIC
        </div>
      </div>

      <div style={{ padding: '4px 0' }}>
        {KNOWLEDGE_ITEMS.map((item, i) => (
          <div key={i} style={{ padding: '14px 20px', borderBottom: i < KNOWLEDGE_ITEMS.length - 1 ? '1px solid var(--bt-border)' : 'none' }}>
            <div style={{ fontSize: 10, color: 'var(--bt-accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              {item.category}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--bt-text)' }}>
              {item.q}
            </div>
            <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', lineHeight: 1.6 }}>
              {item.a}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bt-border)', fontSize: 11, color: 'var(--bt-text-dim)', fontStyle: 'italic' }}>
        AI-powered query (Scout integration) — Phase 2
      </div>
    </div>
  )
}
