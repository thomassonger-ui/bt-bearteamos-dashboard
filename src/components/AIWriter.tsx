'use client'

import { useState, useRef, useEffect } from 'react'

interface AIWriterProps {
  open: boolean
  onClose: () => void
}

const QUICK_PROMPTS = [
  { label: 'First touch – new buyer lead', prompt: 'Write a short, warm first-touch email to a new buyer lead I just added to my pipeline. They\'re looking in Orlando.' },
  { label: 'Follow-up after no response', prompt: 'Write a brief follow-up email to a seller lead who hasn\'t responded to my last message. Keep it casual, not pushy.' },
  { label: 'Listing presentation invite', prompt: 'Write an email inviting a seller lead to a listing presentation. Highlight Bear Team\'s marketing and local Orlando expertise.' },
  { label: 'Price reduction conversation', prompt: 'Write a gentle email to a seller client suggesting we discuss a price reduction to attract more buyers.' },
  { label: 'Under contract congrats', prompt: 'Write a congratulations email to a buyer client who just went under contract. Warm, celebratory, and sets expectations for next steps.' },
  { label: 'Closed deal thank you', prompt: 'Write a thank-you email to a client after a successful closing. Ask for a referral and a Google review.' },
  { label: 'Re-engage cold lead', prompt: 'Write an email to re-engage a lead who went cold 2 months ago. Short, low-pressure check-in.' },
  { label: 'Open house follow-up', prompt: 'Write a follow-up email to someone who attended one of my open houses this weekend.' },
]

export default function AIWriter({ open, onClose }: AIWriterProps) {
  const [input, setInput] = useState('')
  const [clientName, setClientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [agentName, setAgentName] = useState('Tom Songer')
  const [agentPhone, setAgentPhone] = useState('407-758-8102')
  const [agentEmail, setAgentEmail] = useState('')

  useEffect(() => {
    const id = sessionStorage.getItem('bt_agent_id')
    if (id) {
      fetch(`/api/auth?agentId=${encodeURIComponent(id)}`)
        .then(r => r.json())
        .then(data => {
          if (data.name) setAgentName(data.name)
          if (data.phone) setAgentPhone(data.phone)
          if (data.email) setAgentEmail(data.email)
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (open) {
      const stored = sessionStorage.getItem('bt_selected_lead')
      if (stored) {
        try {
          const lead = JSON.parse(stored)
          if (lead.name) setClientName(lead.name)
          if (lead.email) setRecipientEmail(lead.email)
        } catch {}
      }
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  async function generate(prompt: string) {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setOutput('')
    setCopied(false)
    setSendStatus(null)
    try {
      const fullPrompt = clientName.trim()
        ? `${prompt}\n\nThe client's name is ${clientName.trim()}.`
        : prompt
      const res = await fetch('/api/ai-writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, agentName, agentPhone, agentEmail, clientName: clientName.trim() || undefined }),
      })
      const data = await res.json()
      let reply = data.reply ?? 'Something went wrong – try again.'
      if (clientName.trim()) {
        reply = reply.replace(/\[CLIENT NAME\]/gi, clientName.trim())
        reply = reply.replace(/\[CLIENT'S NAME\]/gi, clientName.trim())
        reply = reply.replace(/\[Client Name\]/gi, clientName.trim())
      }
      setOutput(reply)
    } catch {
      setOutput('Error connecting to AI. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    generate(input)
  }

  function copyOutput() {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function usePrompt(prompt: string) {
    setInput(prompt)
    generate(prompt)
  }

  async function handleSend() {
    if (!recipientEmail.trim() || sending) return
    if (scheduleMode && !scheduleAt) {
      setSendStatus('Pick a time')
      return
    }
    setSending(true)
    setSendStatus(null)
    try {
      const subjectMatch = output.match(/^Subject:\s*(.+)/m)
      const subject = subjectMatch ? subjectMatch[1].trim() : 'Bear Team Real Estate'
      const emailBody = output.replace(/^Subject:\s*.+\n\n?/, '')
      const payload: Record<string, string> = {
        to: recipientEmail.trim(),
        subject,
        body: emailBody,
        fromName: agentName,
        ...(agentEmail ? { replyTo: agentEmail } : {}),
      }
      if (scheduleMode && scheduleAt) {
        payload.sendAt = new Date(scheduleAt).toISOString()
      }
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setSendStatus(scheduleMode ? 'Scheduled!' : 'Sent!')
        setScheduleMode(false)
        setScheduleAt('')
        setTimeout(() => setSendStatus(null), 3000)
      } else {
        setSendStatus('Failed')
      }
    } catch {
      setSendStatus('Error')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  const minDateTime = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: '#0d1825', borderLeft: '1px solid var(--bt-border)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bt-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--bt-accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI Writer</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2, marginLeft: 15 }}>
              {agentEmail ? `Replies → ${agentEmail}` : 'Draft emails, scripts & messages'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--bt-text-dim)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>&#x2715;</button>
        </div>

        {/* Quick prompts */}
        <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Quick Templates</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_PROMPTS.map((p) => (
              <button key={p.label} onClick={() => usePrompt(p.prompt)} disabled={loading}
                style={{ fontSize: 11, padding: '5px 10px', background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)', borderRadius: 4, cursor: 'pointer' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Client name */}
        <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>Client Name</div>
          <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Sarah Mitchell"
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 5, outline: 'none', fontFamily: 'inherit' }} />
        </div>

        {/* Custom prompt */}
        <form onSubmit={handleSubmit} style={{ padding: '10px 20px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>Custom Prompt</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
              placeholder="e.g. Write a follow-up text to a buyer who toured 3 homes yesterday..." rows={3}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(input) } }}
              style={{ flex: 1, padding: '10px 12px', fontSize: 12, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 5, resize: 'none', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit' }} />
            <button type="submit" disabled={loading || !input.trim()}
              style={{ padding: '0 16px', background: input.trim() && !loading ? 'var(--bt-accent)' : 'var(--bt-border)', border: 'none', borderRadius: 5, color: 'var(--bt-black)', fontWeight: 700, fontSize: 18, cursor: input.trim() && !loading ? 'pointer' : 'default', flexShrink: 0, alignSelf: 'stretch' }}>
              {loading ? '\u23F3' : '\u2728'}
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 4 }}>⌘ + Enter to generate</div>
        </form>

        {/* Output area */}
        <div style={{ flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, flexShrink: 0 }}>Output</div>

          {loading ? (
            <div style={{ flex: 1, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 5, padding: '12px 14px', fontSize: 13, color: 'var(--bt-text-dim)', fontStyle: 'italic', minHeight: 120 }}>Writing...</div>
          ) : output ? (
            <textarea value={output} onChange={e => setOutput(e.target.value)}
              style={{ flex: 1, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 5, padding: '12px 14px', fontSize: 13, lineHeight: 1.7, color: 'var(--bt-text)', resize: 'none', outline: 'none', fontFamily: 'inherit', minHeight: 120, whiteSpace: 'pre-wrap' }} />
          ) : (
            <div style={{ flex: 1, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 5, padding: '12px 14px', fontSize: 13, color: 'var(--bt-text-dim)', fontStyle: 'italic', minHeight: 120 }}>Your email will appear here</div>
          )}

          {/* Send bar */}
          {output && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="client@email.com"
                  style={{ flex: 1, padding: '8px 10px', fontSize: 12, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: 'var(--bt-text)', borderRadius: 4, outline: 'none', fontFamily: 'inherit' }} />

                {/* Schedule toggle */}
                <button
                  onClick={() => { setScheduleMode(!scheduleMode); setScheduleAt('') }}
                  title="Schedule for later"
                  style={{
                    fontSize: 14, padding: '8px 10px',
                    background: scheduleMode ? 'var(--bt-accent)' : 'var(--bt-surface)',
                    border: '1px solid var(--bt-border)',
                    color: scheduleMode ? 'var(--bt-black)' : 'var(--bt-text-dim)',
                    borderRadius: 4, cursor: 'pointer',
                  }}>&#x1F550;</button>

                {/* Send / Schedule button */}
                <button onClick={handleSend} disabled={!recipientEmail.trim() || sending}
                  style={{
                    fontSize: 12, padding: '8px 14px', fontWeight: 700,
                    background: !recipientEmail.trim() || sending
                      ? 'var(--bt-border)'
                      : sendStatus === 'Sent!' || sendStatus === 'Scheduled!' ? '#2ecc71'
                      : sendStatus === 'Failed' || sendStatus === 'Error' ? '#e74c3c'
                      : '#E04E4E',
                    border: 'none', color: '#fff', borderRadius: 4,
                    cursor: recipientEmail.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap',
                  }}>
                  {sending ? '...' : sendStatus || (scheduleMode ? 'Schedule' : 'Send')}
                </button>

                <button onClick={copyOutput}
                  style={{ fontSize: 12, padding: '8px 12px', background: copied ? 'var(--bt-accent)' : 'var(--bt-surface)', border: '1px solid var(--bt-border)', color: copied ? 'var(--bt-black)' : 'var(--bt-text-dim)', borderRadius: 4, cursor: 'pointer', fontWeight: copied ? 700 : 400 }}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* DateTime picker */}
              {scheduleMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, whiteSpace: 'nowrap' }}>Send at</div>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    min={minDateTime}
                    onChange={e => setScheduleAt(e.target.value)}
                    style={{
                      flex: 1, padding: '7px 10px', fontSize: 12,
                      background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
                      color: 'var(--bt-text)', borderRadius: 4, outline: 'none',
                      fontFamily: 'inherit', colorScheme: 'dark',
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
