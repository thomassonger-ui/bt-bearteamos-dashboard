'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import PerformanceSummary from '@/components/broker/PerformanceSummary'
import RiskAlertsPanel from '@/components/broker/RiskAlertsPanel'
import AgentTable from '@/components/broker/AgentTable'
import AgentDetailPanel from '@/components/broker/AgentDetailPanel'
import CommissionSummary from '@/components/broker/CommissionSummary'
import RecruitPipeline from '@/components/broker/RecruitPipeline'
import RecruiterPerformance from '@/components/broker/RecruiterPerformance'
import {
  getAllAgents,
  getAllTasks,
  getAllCompliance,
  getAllPipeline,
  getAllClosedDeals,
  getRecruitLeads,
  updateRecruitStage,
  getActivityLog,
} from '@/lib/queries'
import type { RecruitLead } from '@/types'
import { rankLeads, generateAlerts } from '@/lib/intelligence'
import type { RankedLead, LeadAlert } from '@/lib/intelligence'
import type { Agent, Task, ComplianceRecord, Pipeline, ActivityLog } from '@/types'

const SUPER_ADMIN_EMAIL = 'tom@bearteam.com'

interface AuthUser {
  id: string
  email: string
  status: 'active' | 'invited' | 'revoked'
  last_login: string | null
  created_at: string
}

export default function BrokerPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [compliance, setCompliance] = useState<ComplianceRecord[]>([])
  const [pipeline, setPipeline] = useState<Pipeline[]>([])
  const [rankedLeads, setRankedLeads] = useState<RankedLead[]>([])
  const [alerts, setAlerts] = useState<LeadAlert[]>([])
  const [closedDeals, setClosedDeals] = useState<Pipeline[]>([])
  const [recruitLeads, setRecruitLeads] = useState<RecruitLead[]>([])
  const [loading, setLoading] = useState(true)
  const [brokerTab, setBrokerTab] = useState<'agents' | 'commissions' | 'recruiting' | 'performance' | 'access'>('agents')
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [convertResult, setConvertResult] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('')

  // Agent Access tab state
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([])
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessMsg, setAccessMsg] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')

  // Detail panel state
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [agentLog, setAgentLog] = useState<ActivityLog[]>([])
  const [agentTasks, setAgentTasks] = useState<Task[]>([])
  const [agentPipeline, setAgentPipeline] = useState<Pipeline[]>([])
  const [agentCompliance, setAgentCompliance] = useState<ComplianceRecord[]>([])

  const loadAll = useCallback(async () => {
    const [a, t, c, p, cd, rl] = await Promise.all([
      getAllAgents(),
      getAllTasks(),
      getAllCompliance(),
      getAllPipeline(),
      getAllClosedDeals(),
      getRecruitLeads(),
    ])
    setAgents(a)
    setTasks(t)
    setCompliance(c)
    setPipeline(p)
    setClosedDeals(cd)
    setRecruitLeads(rl)
    setRankedLeads(rankLeads(p))
    setAlerts(generateAlerts(p))
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check sessionStorage first for immediate render
      const storedEmail = sessionStorage.getItem('bt_user_email') ?? ''
      if (storedEmail === SUPER_ADMIN_EMAIL) {
        setCurrentUserEmail(storedEmail)
        setIsSuperAdmin(true)
      }
      // Also verify via Supabase auth
      import('@/lib/supabase').then(({ getSupabase }) => {
        getSupabase().auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) => {
          const email = data?.user?.email ?? ''
          setCurrentUserEmail(email)
          setIsSuperAdmin(email === SUPER_ADMIN_EMAIL)
          // Store for next render
          if (email) sessionStorage.setItem('bt_user_email', email)
        })
      })
    }
  }, [])

  async function loadAuthUsers() {
    setAccessLoading(true)
    try {
      const res = await fetch(`/api/admin/agent-access?callerEmail=${encodeURIComponent(currentUserEmail)}`)
      const data = await res.json()
      if (res.ok) setAuthUsers(data.users)
      else setAccessMsg(data.error)
    } finally {
      setAccessLoading(false)
    }
  }

  useEffect(() => {
    if (brokerTab === 'access' && isSuperAdmin) loadAuthUsers()
  }, [brokerTab, isSuperAdmin])

  async function handleAccessAction(action: string, email: string) {
    setAccessMsg(null)
    const res = await fetch('/api/admin/agent-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, email, callerEmail: currentUserEmail }),
    })
    const data = await res.json()
    setAccessMsg(data.message || data.error)
    if (res.ok) loadAuthUsers()
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    await handleAccessAction('invite', inviteEmail.trim())
    setInviteEmail('')
  }

  async function handleSelectAgent(agentId: string) {
    setSelectedAgentId(agentId)
    const [log, aTasks, aPipeline, aCompliance] = await Promise.all([
      getActivityLog(agentId, 10),
      getAllTasks(agentId),
      getAllPipeline(agentId),
      getAllCompliance(agentId),
    ])
    setAgentLog(log)
    setAgentTasks(aTasks)
    setAgentPipeline(aPipeline)
    setAgentCompliance(aCompliance)
  }

  async function handleRefresh() {
    await loadAll()
    if (selectedAgentId) await handleSelectAgent(selectedAgentId)
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bt-black)' }}>
        <div style={{ fontSize: 13, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Loading broker view…
        </div>
      </div>
    )
  }

  const tabs = [
    { key: 'agents' as const, label: 'Agents & Performance' },
    { key: 'commissions' as const, label: 'Commissions & Revenue' },
    { key: 'recruiting' as const, label: 'Recruiting' },
    ...((typeof window !== 'undefined' && ['tom', 'beth'].includes(sessionStorage.getItem('bt_username') ?? '')) ? [{ key: 'performance' as const, label: 'Recruiter/Trainer' }] : []),
    ...(isSuperAdmin ? [{ key: 'access' as const, label: '🔑 Agent Access' }] : []),
  ]

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bt-black)' }}>
      {/* Top bar */}
      <div style={{
        height: 48, background: 'var(--bt-surface)', borderBottom: '1px solid var(--bt-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bt-accent)', letterSpacing: '0.06em' }}>
            BEARTEAM<span style={{ color: 'var(--bt-text-dim)' }}>OS</span>
            <span style={{ color: 'var(--bt-text-dim)', fontWeight: 400, marginLeft: 10, fontSize: 11 }}>
              Broker Command Center
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link href="/dashboard" style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.06em' }}>
            ← Agent View
          </Link>
          <button
            onClick={handleRefresh}
            style={{ fontSize: 11, color: 'var(--bt-accent)', background: 'transparent', border: '1px solid var(--bt-border)', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--bt-border)', background: 'var(--bt-surface)', padding: '0 24px', flexShrink: 0 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setBrokerTab(tab.key)} style={{
            padding: '10px 20px', fontSize: 11, fontWeight: brokerTab === tab.key ? 700 : 400,
            color: brokerTab === tab.key ? (tab.key === 'access' ? '#f59e0b' : 'var(--bt-accent)') : 'var(--bt-text-dim)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: brokerTab === tab.key ? `2px solid ${tab.key === 'access' ? '#f59e0b' : 'var(--bt-accent)'}` : '2px solid transparent',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>

          {/* AGENT ACCESS TAB — Tom Songer only */}
          {brokerTab === 'access' && isSuperAdmin && (
            <div>
              <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Agent Access Management
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="email"
                    placeholder="agent@email.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInvite()}
                    style={{
                      fontSize: 12, padding: '6px 12px', background: 'var(--bt-black)',
                      border: '1px solid var(--bt-border)', borderRadius: 4, color: 'var(--bt-text)',
                      width: 220,
                    }}
                  />
                  <button onClick={handleInvite} style={{
                    fontSize: 12, padding: '6px 14px', fontWeight: 600,
                    background: '#f59e0b', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer',
                  }}>+ Invite Agent</button>
                </div>
              </div>

              {accessMsg && (
                <div style={{
                  marginBottom: 14, padding: '10px 14px', borderRadius: 4, fontSize: 12,
                  background: accessMsg.toLowerCase().includes('error') ? 'rgba(224,78,78,0.1)' : 'rgba(76,175,80,0.1)',
                  border: accessMsg.toLowerCase().includes('error') ? '1px solid rgba(224,78,78,0.3)' : '1px solid rgba(76,175,80,0.3)',
                  color: accessMsg.toLowerCase().includes('error') ? '#E04E4E' : '#4CAF50',
                }}>{accessMsg}</div>
              )}

              {accessLoading ? (
                <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', padding: 20 }}>Loading users…</div>
              ) : (
                <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--bt-border)' }}>
                        {['Email', 'Status', 'Last Login', 'Created', 'Actions'].map(h => (
                          <th key={h} style={{
                            padding: '10px 16px', textAlign: 'left', fontSize: 10,
                            fontWeight: 700, color: 'var(--bt-text-dim)', letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {authUsers.map((u, i) => (
                        <tr key={u.id} style={{
                          borderBottom: i < authUsers.length - 1 ? '1px solid var(--bt-border)' : 'none',
                          background: u.email === SUPER_ADMIN_EMAIL ? 'rgba(245,158,11,0.04)' : 'transparent',
                        }}>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--bt-text)' }}>
                            {u.email}
                            {u.email === SUPER_ADMIN_EMAIL && (
                              <span style={{ marginLeft: 8, fontSize: 9, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.06em' }}>SUPER ADMIN</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 3,
                              background: u.status === 'active' ? 'rgba(76,175,80,0.15)' : u.status === 'revoked' ? 'rgba(224,78,78,0.15)' : 'rgba(245,158,11,0.15)',
                              color: u.status === 'active' ? '#4CAF50' : u.status === 'revoked' ? '#E04E4E' : '#f59e0b',
                            }}>{u.status.toUpperCase()}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--bt-text-dim)' }}>
                            {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--bt-text-dim)' }}>
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {u.email !== SUPER_ADMIN_EMAIL && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => handleAccessAction('reset', u.email!)} style={{
                                  fontSize: 10, padding: '4px 10px', fontWeight: 600,
                                  background: 'transparent', color: '#6b9cf5',
                                  border: '1px solid #6b9cf5', borderRadius: 3, cursor: 'pointer',
                                }}>Reset Password</button>
                                {u.status !== 'revoked' ? (
                                  <button onClick={() => {
                                    if (!confirm(`Revoke access for ${u.email}? They will be locked out immediately.`)) return
                                    handleAccessAction('revoke', u.email!)
                                  }} style={{
                                    fontSize: 10, padding: '4px 10px', fontWeight: 600,
                                    background: 'transparent', color: '#E04E4E',
                                    border: '1px solid #E04E4E', borderRadius: 3, cursor: 'pointer',
                                  }}>Revoke Access</button>
                                ) : (
                                  <button onClick={() => handleAccessAction('restore', u.email!)} style={{
                                    fontSize: 10, padding: '4px 10px', fontWeight: 600,
                                    background: 'transparent', color: '#4CAF50',
                                    border: '1px solid #4CAF50', borderRadius: 3, cursor: 'pointer',
                                  }}>Restore Access</button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {brokerTab === 'commissions' && (
            <CommissionSummary agents={agents} allDeals={closedDeals} onRefresh={handleRefresh} />
          )}

          {brokerTab === 'performance' && (
            <RecruiterPerformance agents={agents} allDeals={closedDeals} />
          )}

          {brokerTab === 'recruiting' && (
            <div>
              {convertResult && (
                <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)', borderRadius: 4, fontSize: 12, color: '#4CAF50' }}>
                  {convertResult}
                </div>
              )}
              <RecruitPipeline
                leads={recruitLeads}
                onRefresh={async () => setRecruitLeads(await getRecruitLeads())}
                onAddRecruit={async (data) => {
                  const { getSupabase } = await import('@/lib/supabase')
                  await getSupabase().from('leads').insert({
                    name: data.name,
                    email: data.email || null,
                    phone: data.phone || null,
                    brokerage: data.brokerage || null,
                    deal_count: data.deal_count ? parseInt(data.deal_count) : null,
                    source: data.source || 'manual',
                    status: 'new_lead',
                    stage: 'new_lead',
                  })
                  setRecruitLeads(await getRecruitLeads())
                }}
                onStageChange={async (leadId, stage) => {
                  await updateRecruitStage(leadId, stage)
                  setRecruitLeads(await getRecruitLeads())
                }}
                onConvert={async (leadId) => {
                  setConvertingId(leadId)
                  setConvertResult(null)
                  try {
                    const res = await fetch('/api/onboard-agent', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ leadId, role: 'Buyer Agent' }),
                    })
                    const data = await res.json()
                    if (res.ok) {
                      setConvertResult(`Agent created: ${data.agent.name} (username: ${data.credentials.username}, password: ${data.credentials.password}). Welcome email sent.`)
                      setRecruitLeads(await getRecruitLeads())
                      await loadAll()
                    } else {
                      setConvertResult(`Error: ${data.error}`)
                    }
                  } catch { setConvertResult('Error converting recruit.') }
                  finally { setConvertingId(null) }
                }}
                onDelete={async (leadId) => {
                  const { getSupabase } = await import('@/lib/supabase')
                  await getSupabase().from('leads').delete().eq('id', leadId)
                  setRecruitLeads(await getRecruitLeads())
                }}
                onDraftOutreach={(lead) => {
                  sessionStorage.setItem('bt_selected_lead', JSON.stringify({
                    name: lead.name,
                    email: lead.email || '',
                  }))
                  alert(`Draft outreach for ${lead.name}:\n\nOpen AI Writer from the sidebar and use this prompt:\n\n"Write a recruiting outreach email to ${lead.name} who currently works at ${lead.brokerage || 'another brokerage'}${lead.deal_count ? ` and does about ${lead.deal_count} deals per year` : ''}. Highlight Bear Team's $0 monthly fees, progressive cap model, and Orlando market support."`)
                }}
              />
            </div>
          )}

          {brokerTab === 'agents' && (
            <>
              {alerts.length > 0 && (
                <div style={{ marginBottom: 20, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, padding: '14px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Scout Lead Alerts — {alerts.length} active
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {alerts.map((alert) => {
                      const colors: Record<string, string> = { high: '#ef4444', stale: '#f59e0b', low: '#3b82f6' }
                      const icons: Record<string, string> = { high: '🔴', stale: '🟡', low: '🔵' }
                      return (
                        <div key={`${alert.type}-${alert.leadId}`} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          fontSize: 12, color: 'var(--bt-text)',
                          padding: '6px 10px', borderRadius: 4,
                          borderLeft: `3px solid ${colors[alert.type]}`,
                          background: 'var(--bt-black)',
                        }}>
                          <span>{icons[alert.type]}</span>
                          <span style={{ fontWeight: 600, color: colors[alert.type], textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>{alert.type}</span>
                          <span style={{ color: 'var(--bt-text-dim)' }}>—</span>
                          <span>{alert.message}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--bt-text-dim)', fontFamily: 'monospace' }}>{alert.leadId.slice(0, 8)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <PerformanceSummary agents={agents} tasks={tasks} compliance={compliance} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 20 }}>
                <AgentTable
                  agents={agents}
                  tasks={tasks}
                  compliance={compliance}
                  selectedAgentId={selectedAgentId}
                  onSelect={handleSelectAgent}
                />
                <RiskAlertsPanel
                  agents={agents}
                  tasks={tasks}
                  pipeline={pipeline}
                  onSelectAgent={handleSelectAgent}
                />
              </div>

              {selectedAgent && (
                <AgentDetailPanel
                  agent={selectedAgent}
                  tasks={agentTasks}
                  activityLog={agentLog}
                  pipeline={agentPipeline}
                  compliance={agentCompliance}
                  onRefresh={handleRefresh}
                />
              )}
              {!selectedAgent && (
                <div style={{ padding: '20px', background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6, fontSize: 13, color: 'var(--bt-text-dim)', textAlign: 'center' }}>
                  Select an agent to view details and take action.
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
