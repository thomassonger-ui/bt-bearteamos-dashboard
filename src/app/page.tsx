'use client';

import { useState } from 'react';

// ─── DATA ────────────────────────────────────────────────────────────────────

const CRITICAL_ALERTS = [
  {
    id: 1,
    severity: 'critical',
    title: '3 Deals Missing Documents',
    detail: 'Closing dates within 7 days — broker cannot approve without docs',
    cta: 'Fix Now',
    count: 3,
  },
  {
    id: 2,
    severity: 'critical',
    title: '2 Files Awaiting Broker Approval',
    detail: 'Sitting in queue 48+ hrs — delays jeopardize closing',
    cta: 'View Files',
    count: 2,
  },
  {
    id: 3,
    severity: 'warning',
    title: '5 Overdue Follow-Ups',
    detail: 'Leads not contacted in 7+ days — risk of losing to competition',
    cta: 'Start Calls',
    count: 5,
  },
];

const PIPELINE = [
  { label: 'Active Deals', value: 11, sub: '3 added this week', status: 'good', icon: '📁' },
  { label: 'Pending', value: 6, sub: '1 at risk — docs missing', status: 'risk', icon: '⏳' },
  { label: 'Closings This Month', value: 4, sub: 'On track', status: 'good', icon: '🏁' },
  { label: 'Commission Pipeline', value: '$94,200', sub: 'Est. gross', status: 'good', icon: '💰' },
];

const DAILY_TASKS = [
  { id: 1, type: 'call', priority: 'urgent', text: 'Call Sara Martinez — expressed urgency, hasn\'t heard back', tag: 'Lead' },
  { id: 2, type: 'respond', priority: 'urgent', text: 'Respond to Mike Chen — submitted inquiry 3 hrs ago', tag: 'Lead' },
  { id: 3, type: 'docs', priority: 'high', text: 'Upload HOA docs for 123 Oak St before EOD', tag: 'Compliance' },
  { id: 4, type: 'appt', priority: 'high', text: 'Confirm showing — 44 Maple Dr @ 3pm with Johnson family', tag: 'Showing' },
  { id: 5, type: 'task', priority: 'medium', text: 'Send CMA to Johnson family before tomorrow\'s showing', tag: 'Task' },
  { id: 6, type: 'mls', priority: 'medium', text: 'Review 12 new listings in 32804 matching active buyer criteria', tag: 'MLS' },
  { id: 7, type: 'task', priority: 'low', text: 'Log last 2 showings into transaction file', tag: 'Admin' },
];

const SCOUT_RECS = [
  { priority: 1, action: 'Call Sara Martinez immediately', reason: 'Hot buyer — 72hr window before she goes dark', cta: 'Open Lead' },
  { priority: 2, action: 'Upload 3 missing compliance docs', reason: 'Closing in 6 days — broker queue takes 24hrs', cta: 'Open Files' },
  { priority: 3, action: 'Send price reduction alert to buyer list', reason: '4 new price drops in 32819 match 8 active buyers', cta: 'Send Alert' },
];

const SCOUT_STATS = [
  { label: 'New Leads (24h)', value: '7', color: '#2563EB' },
  { label: 'Hot Prospects', value: '3', color: '#DC2626' },
  { label: 'Drip Active', value: '24', color: '#059669' },
  { label: 'Avg Response', value: '4m', color: '#7C3AED' },
];

const NAV = [
  { icon: '⊞', label: 'Dashboard' },
  { icon: '📈', label: 'Production' },
  { icon: '📋', label: 'Transactions' },
  { icon: '✅', label: 'Compliance' },
  { icon: '🏠', label: 'Listings' },
  { icon: '📣', label: 'Marketing' },
  { icon: '🎓', label: 'Academy' },
  { icon: '🤖', label: 'Scout AI' },
];

// ─── PRIORITY TAG ─────────────────────────────────────────────────────────────

function PriorityTag({ p }: { p: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    urgent: { bg: '#FEF2F2', color: '#DC2626', label: 'URGENT' },
    high:   { bg: '#FFFBEB', color: '#D97706', label: 'HIGH' },
    medium: { bg: '#EFF6FF', color: '#2563EB', label: 'MED' },
    low:    { bg: '#F8FAFC', color: '#64748B', label: 'LOW' },
  };
  const s = map[p] || map.low;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 6px', borderRadius: 4, flexShrink: 0, letterSpacing: '0.3px' }}>
      {s.label}
    </span>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const toggle = (id: number) => setDone(prev => ({ ...prev, [id]: !prev[id] }));
  const completedCount = Object.values(done).filter(Boolean).length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#F1F4F8', overflow: 'hidden', color: '#1E293B',
    }}>

      {/* ── TOP NAVBAR ─────────────────────────────────────────────────── */}
      <header style={{
        height: 52, background: '#1B2E4B', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px', position: 'fixed',
        top: 0, left: 0, right: 0, zIndex: 200, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: '#E8A020', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff' }}>B</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.2px' }}>BearTeam<span style={{ color: '#E8A020' }}>OS</span></span>
        </div>

        {/* Center title */}
        <span style={{ fontWeight: 600, fontSize: 14, color: '#CBD5E1', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Dashboard</span>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span style={{ position: 'absolute', top: -5, right: -5, background: '#DC2626', color: '#fff', borderRadius: 8, fontSize: 9, fontWeight: 800, padding: '1px 4px', lineHeight: 1.4 }}>5</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ width: 30, height: 30, background: '#2563EB', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>TS</div>
            <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>Tom Songer</span>
            <span style={{ color: '#64748B', fontSize: 10 }}>▾</span>
          </div>
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', marginTop: 52, height: 'calc(100vh - 52px)' }}>

        {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
        <nav style={{
          width: 200, background: '#fff', borderRight: '1px solid #DDE3EC',
          padding: '10px 0', flexShrink: 0, overflowY: 'auto',
        }}>
          <div style={{ padding: '8px 16px 4px', fontSize: 10, color: '#94A3B8', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Navigation</div>
          {NAV.map((item, i) => {
            const active = i === 0;
            return (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 16px', cursor: 'pointer',
                borderLeft: active ? '3px solid #2563EB' : '3px solid transparent',
                background: active ? '#EFF6FF' : 'transparent',
                color: active ? '#2563EB' : '#475569',
                fontWeight: active ? 600 : 400,
                fontSize: 13.5,
              }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </div>
            );
          })}

          <div style={{ margin: '12px 16px', borderTop: '1px solid #E8EDF4' }} />
          <div style={{ padding: '6px 16px 4px', fontSize: 10, color: '#94A3B8', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Quick Access</div>
          {['Stellar MLS', 'Brokermint', 'DocuSign', 'ShowingTime', 'Follow Up Boss'].map(link => (
            <div key={link} style={{ padding: '7px 16px', fontSize: 13, color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: '#CBD5E1' }}>↗</span>{link}
            </div>
          ))}

          <div style={{ margin: '12px 16px 6px', borderTop: '1px solid #E8EDF4' }} />
          <div style={{ padding: '8px 16px', background: '#FFFBEB', margin: '0 10px', borderRadius: 6, border: '1px solid #FDE68A' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', marginBottom: 2 }}>⚠ 5 items need attention</div>
            <div style={{ fontSize: 11, color: '#92400E' }}>Review Critical Alerts</div>
          </div>
        </nav>

        {/* ── MAIN ─────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── ZONE 1: CRITICAL ALERTS ──────────────────────────────── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.8px' }}>⚠ Critical Alerts</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>— These require action before anything else</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {CRITICAL_ALERTS.map(alert => {
                const isCrit = alert.severity === 'critical';
                return (
                  <div key={alert.id} style={{
                    background: '#fff',
                    border: `1px solid ${isCrit ? '#FECACA' : '#FDE68A'}`,
                    borderTop: `3px solid ${isCrit ? '#DC2626' : '#F59E0B'}`,
                    borderRadius: 7, padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: isCrit ? '#DC2626' : '#D97706', lineHeight: 1.3 }}>{alert.title}</span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: isCrit ? '#DC2626' : '#D97706', flexShrink: 0 }}>{alert.count}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, margin: 0 }}>{alert.detail}</p>
                    <button style={{
                      marginTop: 4, padding: '6px 12px', background: isCrit ? '#DC2626' : '#D97706',
                      color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', alignSelf: 'flex-start',
                    }}>{alert.cta} →</button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── ZONE 2: PRODUCTION PIPELINE ──────────────────────────── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1B365D', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Production Pipeline</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>— Business health at a glance</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {PIPELINE.map((p, i) => {
                const atRisk = p.status === 'risk';
                return (
                  <div key={i} style={{
                    background: '#fff', borderRadius: 7, padding: '14px 16px',
                    border: `1px solid ${atRisk ? '#FDE68A' : '#DDE3EC'}`,
                    borderLeft: `4px solid ${atRisk ? '#F59E0B' : '#2563EB'}`,
                    cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{p.label}</span>
                      <span style={{ fontSize: 16 }}>{p.icon}</span>
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: atRisk ? '#D97706' : '#1B2E4B', lineHeight: 1 }}>{p.value}</div>
                    <div style={{ marginTop: 5, fontSize: 11.5, color: atRisk ? '#D97706' : '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {atRisk ? '⚠' : '↑'} {p.sub}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── ZONES 3 + 4: DAILY EXECUTION + SCOUT AI ─────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14, flex: 1, minHeight: 0 }}>

            {/* ── ZONE 3: DAILY EXECUTION ──────────────────────────── */}
            <section style={{ background: '#fff', border: '1px solid #DDE3EC', borderRadius: 7, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8EDF4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#1B2E4B' }}>Daily Execution</span>
                  <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 8 }}>System-generated task queue</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>{completedCount}/{DAILY_TASKS.length} completed</span>
                  <button style={{ padding: '5px 12px', background: '#1B2E4B', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    + Add Task
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 3, background: '#E8EDF4', flexShrink: 0 }}>
                <div style={{ height: '100%', background: '#2563EB', width: `${(completedCount / DAILY_TASKS.length) * 100}%`, transition: 'width 0.3s' }} />
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {DAILY_TASKS.map((task, i) => (
                  <div key={task.id} onClick={() => toggle(task.id)} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 16px',
                    borderBottom: i < DAILY_TASKS.length - 1 ? '1px solid #F1F5F9' : 'none',
                    cursor: 'pointer', background: done[task.id] ? '#FAFBFC' : '#fff',
                    transition: 'background 0.15s',
                  }}>
                    {/* Checkbox */}
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, marginTop: 1, flexShrink: 0,
                      border: done[task.id] ? 'none' : '1.5px solid #CBD5E1',
                      background: done[task.id] ? '#2563EB' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {done[task.id] && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: done[task.id] ? '#94A3B8' : '#1E293B', textDecoration: done[task.id] ? 'line-through' : 'none', lineHeight: 1.4 }}>{task.text}</span>
                    </div>
                    {/* Tags */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{task.tag}</span>
                      <PriorityTag p={task.priority} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── ZONE 4: SCOUT AI ─────────────────────────────────── */}
            <section style={{ background: '#fff', border: '1px solid #DDE3EC', borderRadius: 7, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8EDF4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#1B2E4B' }}>Scout AI</span>
                  <span style={{ fontSize: 11, marginLeft: 6, color: '#059669', background: '#ECFDF5', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>● Live</span>
                </div>
                <span style={{ fontSize: 11, color: '#64748B' }}>Decision layer</span>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '12px 14px', borderBottom: '1px solid #E8EDF4', flexShrink: 0 }}>
                {SCOUT_STATS.map((s, i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 6, padding: '9px 12px', textAlign: 'center', border: '1px solid #E8EDF4' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* AI Recommendations */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #E8EDF4', flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1B2E4B', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>What You Should Do Next</div>
                {SCOUT_RECS.map((rec, i) => (
                  <div key={i} style={{ padding: '9px 10px', marginBottom: 6, background: '#F8FAFC', borderRadius: 6, border: '1px solid #E8EDF4', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 18, height: 18, background: '#1B2E4B', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{rec.priority}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>{rec.action}</span>
                      </div>
                      <button style={{ padding: '3px 9px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>{rec.cta}</button>
                    </div>
                    <p style={{ fontSize: 11.5, color: '#64748B', margin: 0, lineHeight: 1.4, paddingLeft: 24 }}>{rec.reason}</p>
                  </div>
                ))}
              </div>

              {/* Run My Day CTA */}
              <div style={{ padding: '14px', flexShrink: 0, marginTop: 'auto' }}>
                <button style={{
                  width: '100%', padding: '11px', background: '#1B2E4B', color: '#fff',
                  border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <span>🤖</span> Run My Day
                </button>
                <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', margin: '6px 0 0', lineHeight: 1.4 }}>
                  Scout will sequence your top 5 priorities and auto-prep each task
                </p>
              </div>
            </section>
          </div>

        </main>
      </div>
    </div>
  );
}
