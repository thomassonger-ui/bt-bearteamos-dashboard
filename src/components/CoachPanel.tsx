'use client'

import { useState, useRef, useEffect } from 'react'
import type { Pipeline } from '@/types'

interface CoachPanelProps {
  selectedLead?: Pipeline | null
}

const QUICK_PROMPTS = [
  'What do I say to open this call?',
  'They said they\'re not interested',
  'They want to wait / not ready',
  'They already have an agent',
  'How much do you charge?',
  'They went quiet / ghosting me',
  'They want to think about it',
  'Confirm the appointment',
]

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
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop(); setListening(false); return
    }
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

    // Build context from selected lead
    const context = selectedLead
      ? `[Agent is on a call with: ${selectedLead.lead_name}, stage: ${selectedLead.stage}${selectedLead.lead_type ? `, type: ${selectedLead.lead_type}` : ''}] `
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
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.role,
            // strip the context prefix from display but keep in API history
            content: m.content,
          })),
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Try again.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error — try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send()
  }

  // Strip the context prefix for display
  function displayContent(msg: { role: string; content: string }) {
    if (msg.role === 'user') {
      return msg.content.replace(/^\[Agent is on a call with:.*?\]\s*/,'')
    }
    return msg.content
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bt-surface)',
      border: '1px solid var(--bt-border)',
      borderRadius: 6,
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--bt-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bt-accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>
              Coach / Scout
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {selectedLead && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: 'var(--bt-accent)',
                background: 'rgba(123,183,183,0.12)',
                border: '1px solid rgba(123,183,183,0.25)',
                borderRadius: 3,
                padding: '2px 6px',
                maxWidth: 110,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {selectedLead.lead_name}
              </span>
            )}
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                title="Clear chat"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--bt-muted)', padding: '1px 4px' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 4, opacity: 0.7 }}>
          Live call coaching · Ask anything
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', minHeight: 0 }}>
        {messages.length === 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginBottom: 10, fontStyle: 'italic' }}>
              {selectedLead
                ? `Coaching for ${selectedLead.lead_name}. What's happening on the call?`
                : 'What's happening on your call? I\'ll give you the words.'}
            </div>
            {/* Quick prompts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p)}
                  style={{
                    textAlign: 'left',
                    background: 'rgba(123,183,183,0.05)',
                    border: '1px solid var(--bt-border)',
                    borderRadius: 4,
                    padding: '7px 10px',
                    fontSize: 11,
                    color: 'var(--bt-text-dim)',
                    cursor: 'pointer',
                    lineHeight: 1.4,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.borderColor = 'var(--bt-accent)'
                    ;(e.target as HTMLElement).style.color = 'var(--bt-text)'
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.borderColor = 'var(--bt-border)'
                    ;(e.target as HTMLElement).style.color = 'var(--bt-text-dim)'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            {m.role === 'user' ? (
              <div style={{
                fontSize: 11,
                color: 'var(--bt-text-dim)',
                fontStyle: 'italic',
                marginBottom: 2,
              }}>
                {displayContent(m)}
              </div>
            ) : (
              <div style={{
                fontSize: 12,
                color: 'var(--bt-text)',
                lineHeight: 1.6,
                background: 'rgba(123,183,183,0.07)',
                border: '1px solid rgba(123,183,183,0.2)',
                borderRadius: 5,
                padding: '9px 11px',
              }}>
                {displayContent(m)}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{
            fontSize: 12, color: 'var(--bt-accent)', fontStyle: 'italic',
            padding: '8px 11px',
            background: 'rgba(123,183,183,0.05)',
            borderRadius: 5,
          }}>
            Coaching…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        alignItems: 'center',
        borderTop: '1px solid var(--bt-border)',
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="What's happening on the call?"
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: 12,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--bt-text)',
          }}
        />
        <button
          type="button"
          onClick={toggleMic}
          title={listening ? 'Stop' : 'Speak'}
          style={{
            padding: '10px 6px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            color: listening ? 'var(--bt-red)' : 'var(--bt-muted)',
            flexShrink: 0,
          }}
        >
          {listening ? '⏹' : '🎙'}
        </button>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 12px',
            background: input.trim() ? 'var(--bt-accent)' : 'var(--bt-border)',
            border: 'none',
            color: 'var(--bt-black)',
            fontWeight: 700,
            fontSize: 13,
            cursor: input.trim() ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          →
        </button>
      </form>
    </div>
  )
}
