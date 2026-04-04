'use client'

import type { Agent, Task, Pipeline } from '@/types'
import type { WeeklyMetrics } from '@/lib/metrics'

interface Props {
  agent: Agent
  tasks: Task[]
  pipeline: Pipeline[]
  metrics: WeeklyMetrics | null
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export default function MobileDashboard({ agent, tasks, pipeline, metrics }: Props) {
  const overdue = tasks.filter(t => t.status === 'overdue')
  const pending = tasks.filter(t => t.status === 'pending' || t.status === 'overdue')
  const completed = tasks.filter(t => t.status === 'completed')

  const stalled = pipeline.filter(p => {
    const d = daysSince(p.last_contact)
    return d >= 3 && p.stage !== 'closed'
  })

  const nextBestCall = [...pipeline]
    .filter(p => p.stage !== 'closed' && p.stage !== 'stalled')
    .sort((a, b) => new Date(a.last_contact).getTime() - new Date(b.last_contact).getTime())[0]

  const now = new Date()
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {dayName}, {dateStr}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>Hey, {agent.name.split(' ')[0]}</div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'Tasks', value: pending.length, color: pending.length > 0 ? '#FF9800' : 'var(--bt-text)' },
          { label: 'Overdue', value: overdue.length, color: overdue.length > 0 ? '#E04E4E' : 'var(--bt-text)' },
          { label: 'Done', value: completed.length, color: '#4CAF50' },
          { label: 'Leads', value: pipeline.length, color: 'var(--bt-accent)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
            borderRadius: 6, padding: '10px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Next Best Call */}
      {nextBestCall && (
        <div style={{
          background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
          borderRadius: 8, padding: '14px',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#FF9800', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Next Best Call
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{nextBestCall.lead_name}</div>
              <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 2 }}>
                {nextBestCall.lead_type?.toUpperCase() || ''} &middot; {daysSince(nextBestCall.last_contact) === 0 ? 'Today' : `${daysSince(nextBestCall.last_contact)}d ago`}
              </div>
              {nextBestCall.phone && (
                <a href={`tel:${nextBestCall.phone}`} style={{ fontSize: 12, color: 'var(--bt-accent)', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
                  {nextBestCall.phone}
                </a>
              )}
            </div>
            <a href={nextBestCall.phone ? `tel:${nextBestCall.phone.replace(/\D/g, '')}` : '#'} style={{
              padding: '10px 18px', background: '#1976D2', color: '#fff', borderRadius: 6,
              fontWeight: 700, fontSize: 13, textDecoration: 'none',
            }}>Call</a>
          </div>
        </div>
      )}

      {/* Stale Leads Warning */}
      {stalled.length > 0 && (
        <div style={{
          padding: '10px 14px', background: 'rgba(224,82,82,0.08)',
          border: '1px solid rgba(224,82,82,0.3)', borderRadius: 6,
          fontSize: 12, color: '#E04E4E',
        }}>
          &#9888; {stalled.length} lead{stalled.length > 1 ? 's' : ''} with no contact in 3+ days
        </div>
      )}

      {/* Pipeline Summary */}
      <div style={{
        background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
        borderRadius: 8, padding: '14px',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Pipeline
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[
            { label: 'Active', value: pipeline.filter(p => ['new_lead', 'attempting_contact', 'contacted', 'appointment_set', 'active_client'].includes(p.stage)).length },
            { label: 'Contract', value: pipeline.filter(p => p.stage === 'under_contract').length },
            { label: 'Closed', value: pipeline.filter(p => p.stage === 'closed').length },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>{s.label}</div>
            </div>
          ))}
        </div>
        {metrics && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '8px 0', borderTop: '1px solid var(--bt-border)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: metrics.calls_this_week >= 20 ? '#4CAF50' : '#E04E4E' }}>{metrics.calls_this_week}/100</div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>Calls</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{metrics.appointments_this_week}/5</div>
              <div style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>Appts</div>
            </div>
          </div>
        )}
      </div>

      {/* Today's Tasks */}
      <div style={{
        background: 'var(--bt-surface)', border: '1px solid var(--bt-border)',
        borderRadius: 8, padding: '14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--bt-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Required Actions
          </span>
          <span style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>{completed.length}/{tasks.length}</span>
        </div>
        {pending.slice(0, 5).map(task => (
          <div key={task.id} style={{
            padding: '8px 0', borderBottom: '1px solid var(--bt-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{task.title}</div>
              <div style={{ fontSize: 9, color: task.status === 'overdue' ? '#E04E4E' : 'var(--bt-text-dim)' }}>
                {task.status === 'overdue' ? 'OVERDUE' : task.type.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
        {pending.length > 5 && (
          <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', textAlign: 'center', padding: '8px 0' }}>
            +{pending.length - 5} more
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <a href="/pipeline" style={{
          padding: '14px', background: 'var(--bt-accent)', color: 'var(--bt-black)',
          borderRadius: 6, textAlign: 'center', fontWeight: 700, fontSize: 13,
          textDecoration: 'none',
        }}>Start My Day</a>
        <a href="/crm" style={{
          padding: '14px', background: 'var(--bt-surface)', color: 'var(--bt-text)',
          border: '1px solid var(--bt-border)',
          borderRadius: 6, textAlign: 'center', fontWeight: 700, fontSize: 13,
          textDecoration: 'none',
        }}>Contact Book</a>
      </div>
    </div>
  )
}
