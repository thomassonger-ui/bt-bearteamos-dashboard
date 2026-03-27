'use client'

import { useState } from 'react'
import type { Agent, Task, ActivityLog, Pipeline, ComplianceRecord } from '@/types'
import { formatDate, relativeTime } from '@/lib/engine'
import { createTask, updateComplianceStatus, resetMissedTasks } from '@/lib/queries'

interface Props {
  agent: Agent
  tasks: Task[]
  activityLog: ActivityLog[]
  pipeline: Pipeline[]
  compliance: ComplianceRecord[]
  onRefresh: () => Promise<void>
}

type Tab = 'activity' | 'tasks' | 'pipeline' | 'compliance'

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--bt-yellow)',
  overdue: 'var(--bt-red)',
  completed: 'var(--bt-green)',
  missed: 'var(--bt-text-dim)',
}

export default function AgentDetailPanel({ agent, tasks, activityLog, pipeline, compliance, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('activity')
  const [forcing, setForcing] = useState(false)
  const [forceTitle, setForceTitle] = useState('')
  const [forceMsg, setForceMsg] = useState('')

  const activeTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'overdue')

  async function handleForceTask() {
    if (!forceTitle.trim()) return
    setForcing(true)
    await createTask({
      agent_id: agent.id,
      type: 'intervention',
      title: forceTitle.trim(),
      description: 'Broker-assigned task.',
      status: 'pending',
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    setForceTitle('')
    setForceMsg('Task created.')
    setTimeout(() => setForceMsg(''), 3000)
    setForcing(false)
    await onRefresh()
  }

  async function handleMarkCompliance(id: string) {
    await updateComplianceStatus(id, 'completed')
    await onRefresh()
  }

  async function handleResetMissed() {
    await resetMissedTasks(agent.id)
    await onRefresh()
  }

  const missedCount = tasks.filter((t) => t.status === 'missed').length

  return (
    <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
      {/* Agent header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bt-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{agent.name}</div>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>
              {agent.email} · Day {agent.onboarding_stage ?? 0} · Last active: {agent.last_active ? relativeTime(agent.last_active) : 'Never'}
            </div>
          </div>
          {/* Control actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {missedCount > 0 && (
              <button onClick={handleResetMissed} style={ctrlBtn('var(--bt-yellow)')}>
                Reset {missedCount} Missed
              </button>
            )}
          </div>
        </div>

        {/* Force task */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            type="text"
            value={forceTitle}
            onChange={(e) => setForceTitle(e.target.value)}
            placeholder="Force task title…"
            style={{
              flex: 1, padding: '7px 10px', fontSize: 12,
              background: 'var(--bt-muted)', border: '1px solid var(--bt-border)',
              borderRadius: 4, color: 'var(--bt-text)', outline: 'none',
            }}
          />
          <button onClick={handleForceTask} disabled={forcing || !forceTitle.trim()} style={ctrlBtn('var(--bt-accent)')}>
            Force Task
          </button>
        </div>
        {forceMsg && <div style={{ fontSize: 11, color: 'var(--bt-green)', marginTop: 6 }}>{forceMsg}</div>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--bt-border)' }}>
        {(['activity', 'tasks', 'pipeline', 'compliance'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 16px', fontSize: 11, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? 'var(--bt-accent)' : 'var(--bt-text-dim)',
            background: 'transparent', border: 'none',
            borderBottom: tab === t ? '2px solid var(--bt-accent)' : '2px solid transparent',
            cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '12px 0', maxHeight: 400, overflowY: 'auto' }}>

        {/* Activity */}
        {tab === 'activity' && (
          activityLog.length === 0
            ? <Empty>No activity logged.</Empty>
            : activityLog.slice(0, 10).map((entry, i) => (
              <Row key={entry.id} last={i === Math.min(9, activityLog.length - 1)}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: entry.outcome === 'success' ? 'var(--bt-green)' : entry.outcome === 'failure' ? 'var(--bt-red)' : 'var(--bt-text-dim)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12 }}>{entry.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>{formatDate(entry.created_at)}</div>
                </div>
              </Row>
            ))
        )}

        {/* Tasks */}
        {tab === 'tasks' && (
          activeTasks.length === 0
            ? <Empty>No active tasks.</Empty>
            : activeTasks.map((task, i) => (
              <Row key={task.id} last={i === activeTasks.length - 1}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: STATUS_COLOR[task.status] }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{task.title}</div>
                  <div style={{ fontSize: 11, color: STATUS_COLOR[task.status], textTransform: 'uppercase', marginTop: 2, letterSpacing: '0.06em' }}>
                    {task.status} · Due {formatDate(task.due_date)}
                  </div>
                </div>
              </Row>
            ))
        )}

        {/* Pipeline */}
        {tab === 'pipeline' && (
          pipeline.length === 0
            ? <Empty>No pipeline records.</Empty>
            : pipeline.map((lead, i) => {
              const days = Math.floor((Date.now() - new Date(lead.last_contact).getTime()) / (1000 * 60 * 60 * 24))
              const stale = days >= 3
              return (
                <Row key={lead.id} last={i === pipeline.length - 1}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{lead.lead_name}</div>
                      <div style={{ fontSize: 11, color: stale ? 'var(--bt-red)' : 'var(--bt-text-dim)' }}>
                        {days === 0 ? 'Today' : `${days}d ago`}{stale ? ' ⚠' : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>
                      {lead.stage}{lead.notes ? ` · ${lead.notes}` : ''}
                    </div>
                  </div>
                </Row>
              )
            })
        )}

        {/* Compliance */}
        {tab === 'compliance' && (
          compliance.length === 0
            ? <Empty>No compliance records.</Empty>
            : compliance.map((record, i) => (
              <Row key={record.id} last={i === compliance.length - 1}>
                <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0, background: record.status === 'completed' ? 'var(--bt-green)' : 'var(--bt-red)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{record.requirement}</div>
                  <div style={{ fontSize: 11, color: record.status === 'completed' ? 'var(--bt-green)' : 'var(--bt-red)', textTransform: 'uppercase', marginTop: 2, letterSpacing: '0.06em' }}>
                    {record.status}
                    {record.completed_at ? ` · ${formatDate(record.completed_at)}` : ''}
                  </div>
                </div>
                {record.status === 'pending' && (
                  <button onClick={() => handleMarkCompliance(record.id)} style={ctrlBtn('var(--bt-green)')}>
                    Complete
                  </button>
                )}
              </Row>
            ))
        )}
      </div>
    </div>
  )
}

function Row({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      padding: '10px 20px',
      borderBottom: last ? 'none' : '1px solid var(--bt-border)',
    }}>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '20px', fontSize: 13, color: 'var(--bt-text-dim)', textAlign: 'center' }}>
      {children}
    </div>
  )
}

function ctrlBtn(color: string): React.CSSProperties {
  return {
    padding: '5px 10px', fontSize: 11, fontWeight: 600,
    border: `1px solid ${color}`, background: 'transparent',
    color, borderRadius: 3, cursor: 'pointer', letterSpacing: '0.04em', flexShrink: 0,
  }
}
