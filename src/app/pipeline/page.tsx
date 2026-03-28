'use client'

import { useState, useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import PipelineBoard from '@/components/PipelineBoard'
import ActivityChart from '@/components/ActivityChart'
import { getFirstAgent, getAgent, getPipeline, updateLastContact, logActivity } from '@/lib/queries'
import { getWeeklyMetrics, paceColor, insightLine, TARGETS } from '@/lib/metrics'
import type { Agent, Pipeline } from '@/types'
import type { WeeklyMetrics } from '@/lib/metrics'

export default function PipelinePage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [pipeline, setPipeline] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<WeeklyMetrics | null>(null)
  const [logCallLoading, setLogCallLoading] = useState(false)

  // Chat state
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    async function load() {
      const storedId = sessionStorage.getItem('bt_agent_id')
      const agentData = storedId ? await getAgent(storedId) : await getFirstAgent()
      if (!agentData) { setLoading(false); return }
      const [pipelineData, metricsData] = await Promise.all([
        getPipeline(agentData.id),
        getWeeklyMetrics(agentData.id),
      ])
      setAgent(agentData)
      setPipeline(pipelineData)
      setMetrics(metricsData)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

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

  async function logCall() {
    if (!agent) return
    setLogCallLoading(true)
    try {
      await fetch('/api/log-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      })
      const m = await getWeeklyMetrics(agent.id)
      setMetrics(m)
    } finally {
      setLogCallLoading(false)
    }
  }

  function toggleMic() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser.')
      return
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setChatInput(prev => prev ? prev + ' ' + transcript : transcript)
      setListening(false)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognition.start()
    setListening(true)
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim() || !agent) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)
    try {
      const res = await fetch('/api/pipeline-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, agentId: agent.id, pipeline }),
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Done.' }])
      if (data.action_type && data.action_type !== 'none' && data.action_type !== 'ask_type') {
        setPipeline(await getPipeline(agent.id))
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error — please try again.' }])
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', height: '100%' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* Header row — title left, chat right */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>

            {/* Left: title */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Pipeline</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{agent?.name ?? '—'}</div>
            </div>

            {/* Right: AI Chat panel */}
            <div style={{
              flex: 1,
              background: 'var(--bt-surface)',
              border: '1px solid var(--bt-border)',
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              {/* Chat header */}
              <div style={{
                padding: '8px 14px',
                borderBottom: '1px solid var(--bt-border)',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bt-accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>
                  Pipeline AI
                </span>
              </div>

              {/* Messages */}
              {chatMessages.length > 0 && (
                <div style={{ padding: '10px 14px', maxHeight: 140, overflowY: 'auto' }}>
                  {chatMessages.map((m, i) => (
                    <div key={i} style={{
                      marginBottom: 6,
                      fontSize: 12,
                      color: m.role === 'user' ? 'var(--bt-text)' : 'var(--bt-accent)',
                      paddingLeft: m.role === 'assistant' ? 8 : 0,
                      borderLeft: m.role === 'assistant' ? '2px solid var(--bt-accent)' : 'none',
                    }}>
                      {m.content}
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', fontStyle: 'italic' }}>Thinking…</div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* Input row */}
              <form onSubmit={sendChat} style={{
                display: 'flex', alignItems: 'center',
                borderTop: chatMessages.length > 0 ? '1px solid var(--bt-border)' : 'none',
              }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder='e.g. "John Smith buyer $450K 3/2 Winter Park 407-555-1212 john@gmail.com"'
                  disabled={chatLoading}
                  style={{
                    flex: 1, padding: '10px 14px', fontSize: 12,
                    background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--bt-text)',
                  }}
                />
                {/* Mic button */}
                <button
                  type="button"
                  onClick={toggleMic}
                  title={listening ? 'Stop listening' : 'Speak a lead'}
                  style={{
                    padding: '10px 10px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 15,
                    color: listening ? 'var(--bt-red)' : 'var(--bt-text-dim)',
                    flexShrink: 0,
                  }}
                >
                  {listening ? '⏹' : '🎙'}
                </button>
                {/* Send button */}
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  style={{
                    padding: '10px 16px',
                    background: chatInput.trim() ? 'var(--bt-accent)' : 'var(--bt-border)',
                    border: 'none',
                    color: 'var(--bt-black)',
                    fontWeight: 700, fontSize: 13,
                    cursor: chatInput.trim() ? 'pointer' : 'default',
                    flexShrink: 0,
                  }}
                >
                  →
                </button>
              </form>
            </div>
          </div>

          {/* 90-day Activity Chart */}
          {agent && (
            <ActivityChart
              agentId={agent.id}
              onLogCall={logCall}
              logCallLoading={logCallLoading}
            />
          )}

          {/* Performance Strip */}
          {metrics && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 10 }}>
                {[
                  { label: 'Calls This Week', value: metrics.calls_this_week, target: TARGETS.calls, pace: metrics.call_pace },
                  { label: 'Appointments', value: metrics.appointments_this_week, target: TARGETS.appointments, pace: metrics.appointment_pace },
                  { label: 'Active Pipeline', value: metrics.active_clients + metrics.under_contract, target: null, pace: null },
                  { label: 'Listing Projection', value: metrics.listing_projection.toFixed(1), target: null, pace: null },
                ].map((s) => (
                  <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.pace !== null ? paceColor(s.pace) : 'var(--bt-text)' }}>
                      {s.value}{s.target ? <span style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginLeft: 4 }}>/ {s.target}</span> : null}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', fontStyle: 'italic' }}>
                {insightLine(metrics)}
              </div>
            </div>
          )}

          {/* Lead Stats */}
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

          <PipelineBoard pipeline={pipeline} onContact={handleContact} />

        </div>
      </main>
    </div>
  )
}
