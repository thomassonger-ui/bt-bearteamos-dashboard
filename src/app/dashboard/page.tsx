'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import MobileLayout from '@/components/MobileLayout'
import MobileDashboard from '@/components/MobileDashboard'
import DailySummaryCard from '@/components/DailySummaryCard'
import TaskList from '@/components/TaskList'
import { getAgent, getFirstAgent, getTasks, getCompliance, getPipeline, updateTaskStatus, logActivity } from '@/lib/queries'
import { getWeeklyMetrics } from '@/lib/metrics'
import type { WeeklyMetrics } from '@/lib/metrics'
import { runEngine } from '@/lib/engine'
import type { Agent, Task, Pipeline, ComplianceRecord } from '@/types'

// Market data feed content
const MARKET_CARDS = [
  {
    source: 'Orlando Regional REALTOR\u00AE',
    priority: 'HIGH PRIORITY',
    label: 'LOCAL TRUTH \u2014 MLS BACKED',
    body: 'Days on market holding at 38 days metro-wide, but well-priced listings under $400K are going under contract in under 10 days. Price correctly or watch buyers pass.',
  },
  {
    source: 'Orlando Regional REALTOR\u00AE',
    priority: 'MARKET SHIFT',
    label: 'LOCAL TRUTH \u2014 MLS BACKED',
    body: 'New listings +6% this week \u2014 first meaningful inventory increase since Q4 2024. Still not enough to shift leverage from sellers. Monitor days-on-market closely.',
  },
  {
    source: 'Orlando Regional REALTOR\u00AE',
    priority: 'PRICE WATCH',
    label: 'LOCAL TRUTH \u2014 MLS BACKED',
    body: 'Lake Nona median up 7.1% YoY. Horizon West +6.4%. Only 12% of listings cut price in last 30 days \u2014 sellers holding firm in strong submarkets.',
  },
  {
    source: 'Florida Realtors\u00AE',
    priority: 'STATEWIDE',
    label: 'FL MARKET REPORT',
    body: 'Statewide closed sales down 2.1% but median price up 3.8%. Cash buyers represent 31% of transactions. International buyer activity rebounding in Central FL.',
  },
  {
    source: 'Mortgage Rate Watch',
    priority: 'RATE ALERT',
    label: 'LENDING UPDATE',
    body: '30-year fixed holding at 6.7%. FHA rates at 6.25%. Rate buydowns gaining traction \u2014 2-1 buydown most popular. Advise buyers to lock when rates dip below 6.5%.',
  },
]

const PULSE_DATA = {
  title: 'Price Momentum Strong',
  items: [
    'Median price $412K \u2014 up 4.2% YoY',
    'Lake Nona +7.1% | Horizon West +6.4% YoY',
    'Only 12% of listings cut price in last 30 days',
  ],
}

const MARKET_STATS = [
  { label: 'Median Price', value: '$412K', change: '+4.2%', up: true },
  { label: 'Days on Market', value: '38', change: '-3 days', up: true },
  { label: 'Inventory', value: '2.1 mo', change: '-0.4', up: false },
  { label: '30-Yr Fixed', value: '6.7%', change: '\u2014', up: false },
]

// Training feed content
const TRAINING_CARDS = [
  {
    source: 'Tom Ferry International',
    badge: 'WHAT TO DO',
    label: 'DAILY ACTIVITY STANDARDS',
    body: 'Lead follow-up within 5 minutes increases conversion by 400%. Speed is your edge. Set a phone alarm labeled "CALL NOW" the moment a new lead comes in. Response time wins deals.',
  },
  {
    source: 'Tom Ferry International',
    badge: 'SCRIPTS',
    label: 'OBJECTION HANDLING',
    body: 'Role-play objections for 15 minutes before your first call \u2014 preparation is performance. The agent who has handled an objection 50 times in practice handles it once in real life.',
  },
  {
    source: 'Bear Team Academy',
    badge: 'NEW MODULE',
    label: 'LISTING PRESENTATION MASTERY',
    body: 'Your listing presentation should answer 3 questions: Why now? Why this price? Why me? Master these and your conversion rate will double.',
  },
  {
    source: 'Tom Ferry International',
    badge: 'MINDSET',
    label: 'DAILY ACCOUNTABILITY',
    body: 'Track your numbers daily. The agents who know their conversion rates are the ones who improve them. If you do not measure it, you cannot manage it.',
  },
  {
    source: 'Bear Team Academy',
    badge: 'SYSTEMS',
    label: 'CRM BEST PRACTICES',
    body: 'Log every contact within 5 minutes. Tag leads by source and type. Set follow-up reminders immediately. Your CRM is only as good as the data you put in.',
  },
]

const TODAY_PROTOCOL = {
  title: 'Speed-to-Lead Protocol',
  items: [
    'Respond to new leads within 5 minutes \u2014 4x conversion',
    'Set phone alarm labeled "CALL NOW" on every new lead',
    'Text first if no answer \u2014 keep conversation alive',
  ],
}

const COACHING_STATS = [
  { label: 'Daily Call Goal', value: '20', unit: 'calls' },
  { label: 'Follow-Up Rule', value: '8\u201312x', unit: 'touches' },
  { label: 'Response Window', value: '< 5', unit: 'min', sub: 'speed wins' },
  { label: 'Pipeline Audit', value: 'Mon', unit: '8am', sub: 'weekly' },
]

export default function DashboardPage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [compliance, setCompliance] = useState<ComplianceRecord[]>([])
  const [pipeline, setPipelineData] = useState<Pipeline[]>([])
  const [metrics, setMetrics] = useState<WeeklyMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [marketIdx, setMarketIdx] = useState(0)
  const [trainingIdx, setTrainingIdx] = useState(0)

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Request notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Auto-rotate feeds every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setMarketIdx(prev => (prev + 1) % MARKET_CARDS.length)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setTrainingIdx(prev => (prev + 1) % TRAINING_CARDS.length)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function init() {
      const storedId = typeof window !== 'undefined' ? sessionStorage.getItem('bt_agent_id') : null
      const agentData = storedId ? await getAgent(storedId) : await getFirstAgent()
      if (!agentData) { setLoading(false); return }
      await runEngine(agentData.id)
      const [freshTasks, freshCompliance, pipelineData, metricsData] = await Promise.all([
        getTasks(agentData.id),
        getCompliance(agentData.id),
        getPipeline(agentData.id),
        getWeeklyMetrics(agentData.id),
      ])
      setAgent(agentData)
      setTasks(freshTasks)
      setCompliance(freshCompliance)
      setPipelineData(pipelineData)
      setMetrics(metricsData)
      setLoading(false)
    }
    init()
  }, [])

  async function handleTaskUpdate(taskId: string, status: Task['status']) {
    const completedAt = status === 'completed' ? new Date().toISOString() : undefined
    await updateTaskStatus(taskId, status, completedAt)
    const task = tasks.find((t) => t.id === taskId)
    if (task && agent) {
      await logActivity({
        agent_id: agent.id,
        action_type: status === 'completed' ? 'task_completed' : 'task_missed',
        description: `${status === 'completed' ? 'Completed' : 'Missed'}: ${task.title}`,
        outcome: status === 'completed' ? 'success' : 'failure',
        task_id: taskId,
      })
    }
    if (agent) setTasks(await getTasks(agent.id))
  }

  if (loading) return <LoadingScreen />

  if (!agent) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--bt-text-dim)' }}>
      No agent found. <a href="/login" style={{ color: 'var(--bt-accent)', marginLeft: 8 }}>Login</a>
    </div>
  )

  if (isMobile) {
    return (
      <MobileLayout>
        <MobileDashboard agent={agent} tasks={tasks} pipeline={pipeline} metrics={metrics} />
      </MobileLayout>
    )
  }

  const now = new Date()
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'overdue')
  const overdueTasks = tasks.filter(t => t.status === 'overdue')
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const complianceGaps = compliance.filter(c => c.status === 'pending')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, height: '100vh', overflow: 'hidden', display: 'grid', gridTemplateColumns: '280px 1fr 280px', gridTemplateRows: '1fr' }}>

        {/* ═══ LEFT: Market Data Feed ═══ */}
        <div style={{ borderRight: '1px solid var(--bt-border)', padding: '16px', overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#E04E4E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Market Data Feed</div>

          {MARKET_CARDS.map((card, i) => (
            <div key={i} style={{ display: i === marketIdx ? 'block' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{card.source}</span>
                <span style={{ fontSize: 9, fontWeight: 700, background: '#E04E4E', color: '#fff', borderRadius: 3, padding: '2px 6px' }}>{card.priority}</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#1976D2', letterSpacing: '0.06em', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 12, color: 'var(--bt-text)', lineHeight: 1.5 }}>{card.body}</div>
            </div>
          ))}

          {/* Carousel dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: i === marketIdx ? 16 : 6, height: 6, borderRadius: 3, background: i === marketIdx ? 'var(--bt-accent)' : 'var(--bt-border)' }} />
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button onClick={() => setMarketIdx(Math.max(0, marketIdx - 1))} style={{ fontSize: 11, background: 'transparent', border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}>&lsaquo;</button>
              <span style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>{marketIdx + 1}/{MARKET_CARDS.length}</span>
              <button onClick={() => setMarketIdx(Math.min(MARKET_CARDS.length - 1, marketIdx + 1))} style={{ fontSize: 11, background: 'transparent', border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}>&rsaquo;</button>
            </div>
          </div>

          {/* Up Next */}
          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1976D2' }} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>Orlando Regional REALTOR&reg;</span>
              <span style={{ fontSize: 8, fontWeight: 700, background: '#FF9800', color: '#fff', borderRadius: 2, padding: '1px 4px' }}>UP NEXT</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 4, lineHeight: 1.4 }}>
              New listings +6% this week &mdash; first meaningful inventory increase since Q4 2024. Still not enough to shift leverage from sellers. Monitor days-on-market...
            </div>
          </div>

          {/* Pulse */}
          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 4, padding: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>Pulse</span>
              <span style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>2/5</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1976D2', marginBottom: 6 }}>{PULSE_DATA.title}</div>
            {PULSE_DATA.items.map((item, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--bt-text)', marginBottom: 3, paddingLeft: 8 }}>&bull; {item}</div>
            ))}
          </div>

          {/* Bottom stats */}
          <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MARKET_STATS.map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: s.up ? '#4CAF50' : '#E04E4E' }}>{s.change}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ CENTER: Daily Briefing ═══ */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', minHeight: 0 }}>
          <DailySummaryCard agent={agent} tasks={tasks} compliance={compliance} />

          {/* Daily Direction */}
          <div style={{ marginTop: 20, background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--bt-border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>Daily Direction</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--bt-text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Listings Week</span>
                <a href="/pipeline" style={{ fontSize: 11, fontWeight: 700, padding: '6px 14px', background: '#E04E4E', color: '#fff', borderRadius: 4, textDecoration: 'none', display: 'inline-block' }}>
                  Start My Day &rarr;
                </a>
              </div>
            </div>
            <div style={{ padding: '14px 16px', maxHeight: 180, overflowY: 'auto' }}>
              <div style={{ fontSize: 13, color: 'var(--bt-text)', lineHeight: 1.6, marginBottom: 8 }}>
                Reset today. Focus on calls first&mdash;everything else second. You should be at 10 calls by now. {agent.name.split(' ')[0]}, call those {pendingTasks.length > 0 ? 1 : 0} leads today.
              </div>
              <ul style={{ fontSize: 12, color: 'var(--bt-text)', lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
                <li>Book at least one appointment today.</li>
                <li>You need 20 calls today to stay on track.</li>
              </ul>
            </div>
          </div>

          {/* Task List */}
          <TaskList agentId={agent.id} tasks={tasks} onUpdate={handleTaskUpdate} />

          {/* Broker Updates */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-text-dim)', marginBottom: 10 }}>Broker Updates</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Focus on converting new leads to appointments this week.</div>
            <ul style={{ fontSize: 12, color: 'var(--bt-text)', lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
              <li>Bear Team Academy &mdash; new objection handling module now live.</li>
              <li>Commission structure effective April 1st &mdash; see Bethanne for details.</li>
              <li>Team meeting Thursday 9am &mdash; pipeline review + Q2 goals.</li>
            </ul>
          </div>
        </div>

        {/* ═══ RIGHT: Training Feed ═══ */}
        <div style={{ borderLeft: '1px solid var(--bt-border)', padding: '16px', overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#E04E4E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Training Feed</div>

          {TRAINING_CARDS.map((card, i) => (
            <div key={i} style={{ display: i === trainingIdx ? 'block' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{card.source}</span>
                <span style={{ fontSize: 9, fontWeight: 700, background: '#1976D2', color: '#fff', borderRadius: 3, padding: '2px 6px' }}>{card.badge}</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#1976D2', letterSpacing: '0.06em', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 12, color: 'var(--bt-text)', lineHeight: 1.5 }}>{card.body}</div>
            </div>
          ))}

          {/* Carousel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: i === trainingIdx ? 16 : 6, height: 6, borderRadius: 3, background: i === trainingIdx ? 'var(--bt-accent)' : 'var(--bt-border)' }} />
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button onClick={() => setTrainingIdx(Math.max(0, trainingIdx - 1))} style={{ fontSize: 11, background: 'transparent', border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}>&lsaquo;</button>
              <span style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>{trainingIdx + 1}/{TRAINING_CARDS.length}</span>
              <button onClick={() => setTrainingIdx(Math.min(TRAINING_CARDS.length - 1, trainingIdx + 1))} style={{ fontSize: 11, background: 'transparent', border: '1px solid var(--bt-border)', color: 'var(--bt-text-dim)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}>&rsaquo;</button>
            </div>
          </div>

          {/* Up Next */}
          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1976D2' }} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>Tom Ferry International</span>
              <span style={{ fontSize: 8, fontWeight: 700, background: '#FF9800', color: '#fff', borderRadius: 2, padding: '1px 4px' }}>UP NEXT</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 4, lineHeight: 1.4 }}>
              Role-play objections for 15 minutes before your first call &mdash; preparation is performance. The agent who has handled an objection 50 times in...
            </div>
          </div>

          {/* Today section */}
          <div style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 4, padding: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--bt-text-dim)' }}>Today</span>
              <span style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>2/5</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#E04E4E', marginBottom: 6 }}>{TODAY_PROTOCOL.title}</div>
            {TODAY_PROTOCOL.items.map((item, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--bt-text)', marginBottom: 3, paddingLeft: 8 }}>&bull; {item}</div>
            ))}
          </div>

          {/* Bottom coaching stats */}
          <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {COACHING_STATS.map(s => (
              <div key={s.label} style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)', borderRadius: 4, padding: '8px' }}>
                <div style={{ fontSize: 9, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{s.value}</span>
                  <span style={{ fontSize: 10, color: 'var(--bt-text-dim)' }}>{s.unit}</span>
                </div>
                {s.sub && <div style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bt-black)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Running engine&hellip;
        </div>
        <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 8 }}>
          Checking rules &middot; Generating tasks
        </div>
      </div>
    </div>
  )
}
