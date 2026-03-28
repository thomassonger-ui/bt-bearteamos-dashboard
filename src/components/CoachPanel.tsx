'use client'

import { useState, useRef, useEffect } from 'react'
import type { Pipeline } from '@/types'

interface CoachPanelProps {
  selectedLead?: Pipeline | null
}

// Initial prompts shown before any message
const OPENING_PROMPTS = [
  'What do I say to open this call?',
  "They said they're not interested",
  'They want to wait / not ready',
  'They already have an agent',
  'How much do you charge?',
  'They went quiet / ghosting me',
  'They want to think about it',
  'Confirm the appointment',
]

// Follow-up prompts shown after each AI response — keep the conversation flowing
const FOLLOWUP_PROMPTS: Record<string, string[]> = {
  'open': [
    'They said they already have an agent',
    "They're not interested right now",
    'They asked what makes me different',
    'They want to know my experience',
  ],
  'not interested': [
    'They still pushed back',
    'They hung up — what do I text?',
    'They asked to call back later',
    'What do I say on the follow-up call?',
  ],
  'wait': [
    'They said maybe in 6 months',
    'They want to sell first before buying',
    'What do I say to create urgency?',
    'How do I stay top of mind?',
  ],
  'agent': [
    "Their agent's listing expired",
    "They said they're loyal to their agent",
    'Ask if they signed a buyer agreement',
    'What if their agent is a friend or family?',
  ],
  'charge': [
    'They said another agent charges less',
    'They asked about the buyer agreement',
    "They're comparing me to discount agents",
    'How do I justify my commission?',
  ],
  'quiet': [
    'What do I say in the voicemail?',
    'What do I text after no response?',
    'How many times should I follow up?',
    'They responded — now what?',
  ],
  'think': [
    'What specifically are they unsure about?',
    'They said they need to talk to their spouse',
    'They want to see more homes first',
    'How do I close without pressure?',
  ],
  'confirm': [
    'They asked to reschedule',
    'How do I anchor the appointment?',
    'What do I send before the meeting?',
    'They cancelled — how do I re-book?',
  ],
  'default': [
    'They pushed back again',
    'What do I say next?',
    'Give me a stronger version',
    'How do I close from here?',
  ],
}

function getFollowups(lastUserMsg: string): string[] {
  const msg = lastUserMsg.toLowerCase()
  if (msg.includes('open') || msg.includes('opener') || msg.includes('start')) return FOLLOWUP_PROMPTS['open']
  if (msg.includes('not interest')) return FOLLOWUP_PROMPTS['not interested']
  if (msg.includes('wait') || msg.includes('not ready') || msg.includes('later')) return FOLLOWUP_PROMPTS['wait']
  if (msg.includes('agent') || msg.includes('already have')) return FOLLOWUP_PROMPTS['agent']
  if (msg.includes('charge') || msg.includes('commission') || msg.includes('fee')) return FOLLOWUP_PROMPTS['charge']
  if (msg.includes('quiet') || msg.includes('ghost') || msg.includes('respond')) return FOLLOWUP_PROMPTS['quiet']
  if (msg.includes('think') || msg.includes('consider') || msg.includes('decide')) return FOLLOWUP_PROMPTS['think']
  if (msg.includes('confirm') || msg.includes('appointment') || msg.includes('meeting')) return FOLLOWUP_PROMPTS['confirm']
  return FOLLOWUP_PROMPTS['default']
}

function PromptButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: 'rgba(123,183,183,0.05)',
        border: '1px solid var(--bt-border)',
        borderRadius: 3,
        padding: '5px 8px',
        fontSize: 11,
        color: 'var(--bt-text-dim)',
        cursor: 'pointer',
        lineHeight: 1.35,
        width: '100%',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--bt-accent)'
        el.style.color = 'var(--bt-text)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--bt-border)'
        el.style.color = 'var(--bt-text-dim)'
      }}
    >
      {label}
    </button>
  )
}

export default function CoachPanel({ selectedLead }: CoachPanelProps) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function toggleMic() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) { alert('Speech not supported in this browser.'); return }
    if (listening && recognitionRef.current) { recognitionRef.current.stop(); setListening(false); return }
    const r = new SR()
    r.continuous = false; r.interimResults = false; r.lang = 'en-US'
    recognitionRef.current = r
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript
      setInput(prev => prev ? prev + ' ' + t : t)
      setListening(false)
    }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    r.start(); setListening(true)
  }

  async function send(text?: string) {
    const userMsg = (text ?? input).trim()
    if (!userMsg || loading) return
    setInput('')
    const context = selectedLead
      ? `[Calling: ${selectedLead.lead_name}, stage: ${selectedLead.stage}${selectedLead.lead_type ? `, ${selectedLead.lead_type}` : ''}] `
      : ''
    const fullMsg = context + userMsg
    const newMessages: { role: 'user' | 'assistant'; content: string }[] = [
      ...messages,
      { role: 'user', content: fullMsg },
    ]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Try again.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error — try again.' }])
    } finally {
      setLoading(false)
    }
  }

  // Strip context prefix for display
  function display(msg: { role: string; content: string }) {
    if (msg.role === 'user') return msg.content.replace(/^\[Calling:.*?\]\s*/, '')
    return msg.content
  }

  // Last user message for followup context
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const followups = lastUserMsg ? getFollowups(display(lastUserMsg)) : []
  const showFollowups = messages.length > 0 && !loading

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, overflow: 'hidden' }}>

      {/* Header — compact */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--bt-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--bt-accent)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>Coach / Scout</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {selectedLead && (
              <span style={{ fontSize: 10, color: 'var(--bt-accent)', background: 'rgba(123,183,183,0.12)', border: '1px solid rgba(123,183,183,0.25)', borderRadius: 3, padding: '1px 5px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedLead.lead_name}
              </span>
            )}
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} title="Clear" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--bt-muted)', padding: '0 2px' }}>✕</button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 2, opacity: 0.6 }}>Live call coaching · Ask anything</div>
      </div>

      {/* Messages + prompts */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', minHeight: 0 }}>

        {/* Opening state — no messages yet */}
        {messages.length === 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginBottom: 7, fontStyle: 'italic' }}>
              {selectedLead ? `On a call with ${selectedLead.lead_name}. What's happening?` : "What's happening on the call?"}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {OPENING_PROMPTS.map((p, i) => <PromptButton key={i} label={p} onClick={() => send(p)} />)}
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            {m.role === 'user' ? (
              <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', fontStyle: 'italic', marginBottom: 3 }}>
                {display(m)}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--bt-text)', lineHeight: 1.55, background: 'rgba(123,183,183,0.07)', border: '1px solid rgba(123,183,183,0.2)', borderRadius: 4, padding: '7px 9px' }}>
                {display(m)}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ fontSize: 11, color: 'var(--bt-accent)', fontStyle: 'italic', padding: '5px 9px', background: 'rgba(123,183,183,0.05)', borderRadius: 4 }}>
            Coaching…
          </div>
        )}

        {/* Follow-up prompts after each response */}
        {showFollowups && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--bt-border)', paddingTop: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginBottom: 5, opacity: 0.7, letterSpacing: '0.05em', textTransform: 'uppercase' }}>What next?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {followups.map((p, i) => <PromptButton key={i} label={p} onClick={() => send(p)} />)}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); send() }} style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--bt-border)', flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="What's happening on the call?"
          disabled={loading}
          style={{ flex: 1, padding: '9px 10px', fontSize: 11, background: 'transparent', border: 'none', outline: 'none', color: 'var(--bt-text)' }}
        />
        <button type="button" onClick={toggleMic} title={listening ? 'Stop' : 'Speak'}
          style={{ padding: '9px 6px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: listening ? 'var(--bt-red)' : 'var(--bt-muted)', flexShrink: 0 }}>
          {listening ? '⏹' : '🎙'}
        </button>
        <button type="submit" disabled={loading || !input.trim()}
          style={{ padding: '9px 12px', background: input.trim() ? 'var(--bt-accent)' : 'var(--bt-border)', border: 'none', color: 'var(--bt-black)', fontWeight: 700, fontSize: 13, cursor: input.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
          →
        </button>
      </form>
    </div>
  )
}
