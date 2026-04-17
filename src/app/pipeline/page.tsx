'use client'

import { useState, useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import MobileLayout from '@/components/MobileLayout'
import MobilePipeline from '@/components/MobilePipeline'
import PipelineBoard from '@/components/PipelineBoard'
import ActivityChart from '@/components/ActivityChart'
import CoachPanel from '@/components/CoachPanel'
import { getFirstAgent, getAgent, getPipeline, updateLastContact, updatePipelineStage, updatePipelineLead, logActivity, addToCRM } from '@/lib/queries'
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
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Store selected lead for AI Writer
  useEffect(() => {
    if (selectedLead) {
      sessionStorage.setItem('bt_selected_lead', JSON.stringify({
        name: selectedLead.lead_name,
        email: selectedLead.email || '',
        phone: selectedLead.phone || '',
      }))
    }
  }, [selectedLead])

  // Chat state (Pipeline AI)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // Request notification permission on load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

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

  // Poll for new leads every 60s — Speed-to-Lead alerts
  useEffect(() => {
    if (!agent) return
    let lastCount = pipeline.length
    const interval = setInterval(async () => {
      const fresh = await getPipeline(agent.id)
      if (fresh.length > lastCount) {
        const newLeads = fresh.slice(lastCount)
        setPipeline(fresh)
        if ('Notification' in window && Notification.permission === 'granted') {
          for (const lead of newLeads) {
            new Notification('New Lead — Call within 5 minutes!', {
              body: `${lead.lead_name} — ${lead.lead_type?.toUpperCase() || 'Lead'}${lead.phone ? ' \u00B7 ' + lead.phone : ''}`,
              icon: '/favicon.ico',
              tag: `speed-to-lead-${lead.id}`,
            })
          }
        }
      }
      lastCount = fresh.length
    }, 60000)
    return () => clearInterval(interval)
  }, [agent, pipeline.length])

  async function handleEditSave(pipelineId: string, data: Record<string, string>) {
    await updatePipelineLead(pipelineId, data)
    if (agent) setPipeline(await getPipeline(agent.id))
  }

  async function handleStageChange(pipelineId: string, newStage: string) {
    await updatePipelineStage(pipelineId, newStage)
    if (agent) {
      await logActivity({
        agent_id: agent.id,
        action_type: 'stage_change',
        description: `Moved lead to ${newStage}`,
        outcome: 'success',
      })
      setPipeline(await getPipeline(agent.id))
    }
  }

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
    if (!SpeechRecognition) { alert('Speech recognition not supported.'); return }
    if (listening && recognitionRef.current) { recognitionRef.current.stop(); setListening(false); return }
    const recognition = new SpeechRecognition()
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US'
    recognitionRef.current = recognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => { setChatInput(prev => prev ? prev + ' ' + event.results[0][0].transcript : event.results[0][0].transcript); setListening(false) }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start(); setListening(true)
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, agentId: agent.id, pipeline }),
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Done.' }])
      // Refresh pipeline if any action was taken
      if (data.action) {
        const fresh = await getPipeline(agent.id)
        setPipeline(fresh)
        // Speed-to-Lead notification for new leads
        if (data.action.type === 'created' && 'Notification' in window && Notification.permission === 'granted') {
          const lead = data.action.lead
          new Notification('New Lead — Call within 5 minutes!', {
            body: `${lead.lead_name} — ${lead.lead_type?.toUpperCase() || 'Lead'}${lead.phone ? ' · ' + lead.phone : ''}`,
            icon: '/favicon.ico',
            tag: 'speed-to-lead',
          })
        }
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error \u2014 please try again.' }])
    } finally { setChatLoading(false) }
  }

  const stalled = pipeline.filter((p) => {
    const days = (Date.now() - new Date(p.last_contact).getTime()) / (1000 * 60 * 60 * 24)
    return days >= 3 && p.stage !== 'closed'
  })

  // Next best call - most stale non-closed lead
  const nextBestCall = [...pipeline]
    .filter(p => p.stage !== 'closed' && p.stage !== 'stalled')
    .sort((a, b) => new Date(a.last_contact).getTime() - new Date(b.last_contact).getTime())[0]

  if (loading) return <div style={{ padding: 40, color: 'var(--bt-text-dim)' }}>Loading\u2026</div>

  if (isMobile) {
    return (
      <MobileLayout>
        <MobilePipeline pipeline={pipeline} onContact={handleContact} />
      </MobileLayout>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'hidden', height: '100%', display: 'grid', gridTemplateColumns: '1fr 270px', gap: 0 }}>

        {/* ═══ LEFT: Main content ═══ */}
        <div style={{ padding: '12px 16px 0 20px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>

          {/* Title + disclaimer */}
          <div style={{ marginBottom: 8, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Pipeline</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{agent?.name ?? '\u2014'}</div>
            <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 2 }}>Client data belongs to the agent who enters it and is not shared across agents.</div>
          </div>

          {/* 90-day Activity Chart */}
          {agent && (
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
              <ActivityChart agentId={agent.id} onLogCall={logCall} logCallLoading={logCallLoading} />
            </div>
          )}

          {/* KPI bar */}
          <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 4, flexShrink: 0 }}>
            {[
              ...(metrics ? [
                { label: 'Calls', value: metrics.calls_this_week, target: TARGETS.calls, color: paceColor(metrics.call_pace) },
                { label: 'Appts', value: metrics.appointments_this_week, target: TARGETS.appointments, color: paceColor(metrics.appointment_pace) },
                { label: 'Active', value: metrics.active_clients + metrics.under_contract, color: 'var(--bt-text)' },
                { label: 'Proj.', value: metrics.listing_projection.toFixed(1), color: 'var(--bt-text)' },
              ] : [
                { label: 'Calls', value: '\u2014', color: 'var(--bt-text-dim)' },
                { label: 'Appts', value: '\u2014', color: 'var(--bt-text-dim)' },
                { label: 'Active', value: '\u2014', color: 'var(--bt-text-dim)' },
                { label: 'Proj.', value: '\u2014', color: 'var(--bt-text-dim)' },
              ]),
              { label: 'Leads', value: pipeline.length, color: 'var(--bt-text)' },
              { label: 'Contract', value: pipeline.filter(p => p.stage === 'under_contract').length, color: 'var(--bt-text)' },
              { label: 'Stale', value: stalled.length, color: stalled.length > 0 ? 'var(--bt-red)' : 'var(--bt-text)' },
              { label: 'Closed', value: pipeline.filter(p => p.stage === 'closed').length, color: 'var(--bt-green)' },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 5,
                padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              }}>
                <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: s.color }}>
                  {s.value}{'target' in s && s.target ? <span style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginLeft: 1 }}>/{s.target}</span> : null}
                </span>
                <span style={{ fontSize: 8, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {metrics && (
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', fontStyle: 'italic', marginBottom: 4, flexShrink: 0 }}>
              {insightLine(metrics)}
            </div>
          )}

          {stalled.length > 0 && (
            <div style={{ marginBottom: 6, padding: '4px 10px', background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 4, fontSize: 11, color: 'var(--bt-red)', flexShrink: 0 }}>
              &#9888; {stalled.length} lead{stalled.length > 1 ? 's' : ''} with no contact in 3+ days
            </div>
          )}

          {/* Next Best Call */}
          {nextBestCall && (
            <div style={{
              flexShrink: 0, marginBottom: 8, padding: '10px 14px',
              background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#FF9800', letterSpacing: '0.06em', marginBottom: 2 }}>&#9889; Next Best Call</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{nextBestCall.lead_name}</span>
                  <span style={{ fontSize: 10, color: '#4CAF50' }}>
                    {Math.floor((Date.now() - new Date(nextBestCall.last_contact).getTime()) / 86400000) === 0 ? 'Contacted today' : `${Math.floor((Date.now() - new Date(nextBestCall.last_contact).getTime()) / 86400000)}d ago`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleContact(nextBestCall.id, nextBestCall.lead_name)}
                style={{
                  padding: '8px 16px', background: '#1976D2', color: '#fff', border: 'none',
                  borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >Call Now</button>
            </div>
          )}

          {/* Pipeline board - scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <PipelineBoard pipeline={pipeline} onContact={handleContact} onSelectLead={setSelectedLead} selectedLeadId={selectedLead?.id ?? null} onStageChange={handleStageChange} onEditSave={handleEditSave} 
          onAddToCRM={async (id) => { await addToCRM(id) }}
        />
          </div>
        </div>

        {/* ═══ RIGHT: Pipeline AI + Coach ═══ */}
        <div style={{ borderLeft: '1px solid var(--bt-border)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

          {/* Pipeline AI */}
          <div style={{
            background: 'var(--bt-surface)', borderBottom: '1px solid var(--bt-border)',
            display: 'flex', flexDirection: 'column', height: 240, flexShrink: 0,
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bt-border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bt-accent)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>Pipeline AI</span>
            </div>
            <div style={{ flex: 1, padding: '10px 14px', overflowY: 'auto', minHeight: 0 }}>
              {chatMessages.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', fontStyle: 'italic', lineHeight: 1.6 }}>
                  Add, update, or remove leads.<br />
                  <span style={{ opacity: 0.7 }}>e.g. John Smith buyer $450K 3/2 Winter Park</span>
                </div>
              ) : chatMessages.map((m, i) => (
                <div key={i} style={{
                  marginBottom: 8, fontSize: 12, lineHeight: 1.5,
                  color: m.role === 'user' ? 'var(--bt-text)' : 'var(--bt-accent)',
                  paddingLeft: m.role === 'assistant' ? 8 : 0,
                  borderLeft: m.role === 'assistant' ? '2px solid var(--bt-accent)' : 'none',
                }}>{m.content}</div>
              ))}
              {chatLoading && <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', fontStyle: 'italic' }}>Thinking&hellip;</div>}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--bt-border)', flexShrink: 0 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder='e.g. "407-555-1212 john@gma' disabled={chatLoading}
                style={{ flex: 1, padding: '8px 12px', fontSize: 12, background: 'transparent', border: 'none', outline: 'none', color: 'var(--bt-text)' }} />
              <button type="button" onClick={toggleMic} style={{ padding: '8px 6px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: listening ? 'var(--bt-red)' : 'var(--bt-text-dim)' }}>
                {listening ? '\u23F9' : '\uD83C\uDF99'}
              </button>
              <button type="submit" disabled={chatLoading || !chatInput.trim()}
                style={{ padding: '8px 12px', background: chatInput.trim() ? 'var(--bt-accent)' : 'var(--bt-border)', border: 'none', color: 'var(--bt-black)', fontWeight: 700, fontSize: 13, cursor: chatInput.trim() ? 'pointer' : 'default' }}>
                &rarr;
              </button>
            </form>
          </div>

          {/* Coach / Scout */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <CoachPanel selectedLead={selectedLead} />
          </div>
        </div>

      </main>
    </div>
  )
}

