'use client'

import { useState, useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import PipelineBoard from '@/components/PipelineBoard'
import ActivityChart from '@/components/ActivityChart'
import CoachPanel from '@/components/CoachPanel'
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
  const [selectedLead, setSelectedLead] = useState<Pipeline | null>(null)

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
      <main style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
        {/* Outer flex: left = main content, right = sticky Coach panel */}
        <div style={{ display: 'flex', height: '100%' }}>

        {/* ── Left: fixed height, internal scroll only on pipeline board ── */}
        <div style={{ flex: 1, minWidth: 0, padding: '16px 20px 0 20px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

          {/* Title — compact */}
          <div style={{ marginBottom: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Pipeline</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{agent?.name ?? '—'}</div>
          </div>

          {/* 90-day chart + Pipeline AI — side by side, fixed height */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10, alignItems: 'stretch', flexShrink: 0, height: 200 }}>

            {/* Left: 90-day Activity Chart */}
            {agent && (
              <ActivityChart
                agentId={agent.id}
                onLogCall={logCall}
                logCallLoading={logCallLoading}
              />
            )}

            {/* Right: Pipeline AI — square box, full height */}
            <div style={{
              background: 'var(--bt-surface)',
              border: '1px solid var(--bt-border)',
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Chat header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--bt-border)',
                display: 'flex', alignItems: 'center', gap: 7,
                flexShrink: 0,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bt-accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>
                  Pipeline AI
                </span>
              </div>

              {/* Messages — fills available space */}
              <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', minHeight: 0 }}>
                {chatMessages.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', fontStyle: 'italic', lineHeight: 1.6 }}>
                    Add, update, or remove leads.<br />
                    <span style={{ opacity: 0.7 }}>e.g. John Smith buyer $450K 3/2 Winter Park</span>
                  </div>
                ) : (
                  chatMessages.map((m, i) => (
                    <div key={i} style={{
                      marginBottom: 8,
                      fontSize: 12,
                      color: m.role === 'user' ? 'var(--bt-text)' : 'var(--bt-accent)',
                      paddingLeft: m.role === 'assistant' ? 8 : 0,
                      borderLeft: m.role === 'assistant' ? '2px solid var(--bt-accent)' : 'none',
                      lineHeight: 1.5,
                    }}>
                      {m.content}
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', fontStyle: 'italic' }}>Thinking…</div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input row — pinned to bottom */}
              <form onSubmit={sendChat} style={{
                display: 'flex', alignItems: 'center',
                borderTop: '1px solid var(--bt-border)',
                flexShrink: 0,
              }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder='e.g. "407-555-1212 john@gmail.com"'
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
                    padding: '10px 8px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
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
                    padding: '10px 14px',
                    background: chatInput.trim() ? 'var(--bt-accent)' : 'var(--bt-border)',
                    border: 'none', color: 'var(--bt-black)',
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

          {/* Compact stats bar — all 8 metrics in one row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexShrink: 0, flexWrap: 'wrap' }}>
            {[
              ...(metrics ? [
                { label: 'Calls', value: metrics.calls_this_week, target: TARGETS.calls, color: paceColor(metrics.call_pace) },
                { label: 'Appts', value: metrics.appointments_this_week, target: TARGETS.appointments, color: paceColor(metrics.appointment_pace) },
                { label: 'Active', value: metrics.active_clients + metrics.under_contract, color: 'var(--bt-text)' },
                { label: 'Proj.', value: metrics.listing_projection.toFixed(1), color: 'var(--bt-text)' },
              ] : []),
              { label: 'Leads', value: pipeline.length, color: 'var(--bt-text)' },
              { label: 'Contract', value: pipeline.filter(p => p.stage === 'under_contract').length, color: 'var(--bt-text)' },
              { label: 'Stale', value: stalled.length, color: stalled.length > 0 ? 'var(--bt-red)' : 'var(--bt-text)' },
              { label: 'Closed', value: pipeline.filter(p => p.stage === 'closed').length, color: 'var(--bt-green)' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 4, padding: '6px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 54 }}>
                <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: s.color }}>{s.value}{'target' in s && s.target ? <span style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginLeft: 2 }}>/{s.target}</span> : null}</span>
                <span style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{s.label}</span>
              </div>
            ))}
          </div>
          {metrics && (
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', fontStyle: 'italic', marginBottom: 6, flexShrink: 0 }}>
              {insightLine(metrics)}
            </div>
          )}

          {stalled.length > 0 && (
            <div style={{ marginBottom: 6, padding: '5px 10px', background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 4, fontSize: 11, color: 'var(--bt-red)', flexShrink: 0 }}>
              ⚠ {stalled.length} lead{stalled.length > 1 ? 's' : ''} with no contact in 3+ days
            </div>
          )}

          {/* Pipeline board — takes remaining space, scrolls internally */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 16 }}>
            <PipelineBoard pipeline={pipeline} onContact={handleContact} onSelectLead={setSelectedLead} selectedLeadId={selectedLead?.id ?? null} />
          </div>

        </div>{/* end left col */}

        {/* ── Right: Coach / Scout panel — full height, no scroll ── */}
        <div style={{
          width: 270,
          flexShrink: 0,
          height: '100%',
          padding: '16px 12px 16px 0',
          borderLeft: '1px solid var(--bt-border)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <CoachPanel selectedLead={selectedLead} />
        </div>

        </div>{/* end outer flex */}
      </main>
    </div>
  )
}
