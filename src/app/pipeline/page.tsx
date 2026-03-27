'use client'

import { useState, useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import PipelineBoard from '@/components/PipelineBoard'
import { getFirstAgent, getAgent, getPipeline, updateLastContact, logActivity } from '@/lib/queries'
import type { Agent, Pipeline } from '@/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function PipelinePage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [pipeline, setPipeline] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Who's the new client? Tell me their name and where they're at." }
  ])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const storedId = sessionStorage.getItem('bt_agent_id')
      const agentData = storedId ? await getAgent(storedId) : await getFirstAgent()
      if (!agentData) { setLoading(false); return }
      const pipelineData = await getPipeline(agentData.id)
      setAgent(agentData)
      setPipeline(pipelineData)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleContact(pipelineId: string, leadName: string) {
    await updateLastContact(pipelineId)
    if (agent) {
      await logActivity({
        agent_id: agent.id,
        action_type: 'pipeline_contact',
        description: `Logged contact with ${leadName}`,
        outcome: 'success',
      })
      setPipeline(await getPipeline(agent.id))
    }
  }

  async function sendMessage() {
    if (!input.trim() || !agent || chatLoading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/pipeline-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          agentId: agent.id,
        }),
      })
      const data = await res.json()
      const reply = data.reply || 'Got it.'

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])

      // If a lead was created/updated, refresh pipeline
      if (data.action) {
        const fresh = await getPipeline(agent.id)
        setPipeline(fresh)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const stalled = pipeline.filter((p) => {
    const days = (Date.now() - new Date(p.last_contact).getTime()) / (1000 * 60 * 60 * 24)
    return days >= 3 && p.stage !== 'closed'
  })

  if (loading) return <div style={{ padding: 40, color: 'var(--bt-text-dim)' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Pipeline</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{agent?.name ?? '—'}</div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Leads', value: pipeline.length },
              { label: 'Under Contract', value: pipeline.filter((p) => p.stage === 'under_contract').length },
              { label: 'Stale (3+ days)', value: stalled.length },
              { label: 'Closed', value: pipeline.filter((p) => p.stage === 'closed').length },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.label === 'Stale (3+ days)' && s.value > 0 ? 'var(--bt-red)' : 'var(--bt-text)' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {stalled.length > 0 && (
            <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 6, fontSize: 13, color: 'var(--bt-red)' }}>
              ⚠ {stalled.length} lead{stalled.length > 1 ? 's' : ''} with no contact in 3+ days — engine will generate follow-up tasks.
            </div>
          )}

          {/* Split layout: pipeline board + chat */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
            {/* Pipeline board */}
            <div>
              <PipelineBoard pipeline={pipeline} onContact={handleContact} />
            </div>

            {/* Chat panel */}
            <div style={{
              background: 'var(--bt-surface)',
              border: '1px solid var(--bt-border)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              height: 520,
              position: 'sticky',
              top: 24,
            }}>
              {/* Chat header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--bt-border)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--bt-accent)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                Add Client
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                  }}>
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: msg.role === 'user' ? 'var(--bt-accent)' : 'var(--bt-muted)',
                      color: msg.role === 'user' ? 'var(--bt-black)' : 'var(--bt-text)',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ alignSelf: 'flex-start' }}>
                    <div style={{ padding: '8px 12px', borderRadius: '12px 12px 12px 2px', background: 'var(--bt-muted)', fontSize: 13, color: 'var(--bt-text-dim)' }}>
                      …
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--bt-border)', display: 'flex', gap: 8 }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="e.g. New buyer, Sarah Johnson, Winter Park..."
                  disabled={chatLoading}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'var(--bt-muted)',
                    border: '1px solid var(--bt-border)',
                    borderRadius: 6,
                    color: 'var(--bt-text)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={chatLoading || !input.trim()}
                  style={{
                    padding: '8px 14px',
                    background: chatLoading || !input.trim() ? 'var(--bt-muted)' : 'var(--bt-accent)',
                    color: 'var(--bt-black)',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: chatLoading || !input.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
