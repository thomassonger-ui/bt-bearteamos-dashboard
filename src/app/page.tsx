'use client';

import { useState, useEffect } from 'react';

// ─── STAGE-BASED ONBOARDING TASKS ─────────────────────────────────────────

const STAGE_PRIORITIES: Record<string, Array<{ id: number; text: string; section: string }>> = {
  'onboarding-30': [
    // Days 1-30 (18 tasks)
    { id: 1, text: 'Complete broker orientation and office tour', section: 'Getting Started' },
    { id: 2, text: 'Set up MLS account and learn dashboard basics', section: 'Getting Started' },
    { id: 3, text: 'Configure email, CRM, and transaction management tools', section: 'Getting Started' },
    { id: 4, text: 'Review Bear Team policies and compliance requirements', section: 'Getting Started' },
    { id: 5, text: 'Schedule 1:1 with Tom Songer (Team Lead)', section: 'Getting Started' },
    { id: 6, text: 'Complete E&O insurance forms and enrollment', section: 'Compliance' },
    { id: 7, text: 'Attend BearTeam Academy orientation module', section: 'Training' },
    { id: 8, text: 'Set up transaction file naming convention and folder structure', section: 'Systems' },
    { id: 9, text: 'Complete first practice transaction in BrokerMint', section: 'Training' },
    { id: 10, text: 'Upload professional headshot and bio to agent profile', section: 'Marketing' },
    { id: 11, text: 'Learn showroom showing procedures and FAQs', section: 'Operations' },
    { id: 12, text: 'Review recent market conditions for Orlando area', section: 'Market Knowledge' },
    { id: 13, text: 'Set up buyer and seller lead sources (Zillow, ShowingTime, etc)', section: 'Lead Generation' },
    { id: 14, text: 'Schedule follow-up with Tom Songer on progress', section: 'Check-In' },
    { id: 15, text: 'Review and sign independent contractor agreement', section: 'Legal' },
    { id: 16, text: 'Attend team huddle (weekly walkthrough)', section: 'Team' },
    { id: 17, text: 'Complete first 3 MLS property showings', section: 'Production' },
    { id: 18, text: 'Log all activities in CRM and review with mentor', section: 'Systems' },
  ],
  'onboarding-60': [
    // Days 30-60 (11 tasks)
    { id: 19, text: 'Complete first transaction from start to closing', section: 'Milestones' },
    { id: 20, text: 'Process first commission payment and verify earnings', section: 'Financial' },
    { id: 21, text: 'Establish buyer database and nurture sequence setup', section: 'Lead Management' },
    { id: 22, text: 'Review listing strategy and local market trends', section: 'Production' },
    { id: 23, text: 'Complete mid-program assessment with mentor', section: 'Training' },
    { id: 24, text: 'Set up quarterly business review (QBR) metrics tracking', section: 'Goals' },
    { id: 25, text: 'Attend advanced BearTeam Academy modules', section: 'Training' },
    { id: 26, text: 'Review and optimize daily workflow and time management', section: 'Operations' },
    { id: 27, text: 'Complete 10 more showings and closing walkthroughs', section: 'Production' },
    { id: 28, text: 'Network event attendance (broker-sponsored)', section: 'Networking' },
    { id: 29, text: 'Prepare 60-day progress report for Bethanne', section: 'Check-In' },
  ],
  'onboarding-90': [
    // Days 60-90 (9 tasks)
    { id: 30, text: 'Complete 5 full transactions (buy and/or sell side)', section: 'Production' },
    { id: 31, text: 'Establish personal brand and social media strategy', section: 'Marketing' },
    { id: 32, text: 'Build repeat and referral sources', section: 'Client Relations' },
    { id: 33, text: 'Final mastery assessment with Tom Songer', section: 'Training' },
    { id: 34, text: 'Achieve minimum production targets for Phase 3', section: 'Goals' },
    { id: 35, text: 'Optimize commission structure (tier review)', section: 'Compensation' },
    { id: 36, text: 'Create personal 90-day action plan for year 2', section: 'Planning' },
    { id: 37, text: 'Complete full onboarding program graduation review', section: 'Graduation' },
    { id: 38, text: 'Transition to "Active Agent" independent operations', section: 'Graduation' },
  ],
  'active': [
    // Active agents (6 core responsibilities)
    { id: 39, text: 'Review leads and follow up on hot prospects (daily)', section: 'Daily' },
    { id: 40, text: 'Prepare CMAs and pricing analysis for buyers/sellers', section: 'Production' },
    { id: 41, text: 'Conduct showings and document feedback in CRM', section: 'Production' },
    { id: 42, text: 'Process transaction documents and manage closing timelines', section: 'Transactions' },
    { id: 43, text: 'Maintain client relationships and nurture for repeat business', section: 'Client Relations' },
    { id: 44, text: 'Track production metrics and prepare monthly reports', section: 'Reporting' },
  ],
};

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
  { icon: 'D', label: 'Dashboard' },
  { icon: 'P', label: 'Production' },
  { icon: 'T', label: 'Transactions' },
  { icon: 'C', label: 'Compliance' },
  { icon: 'L', label: 'Listings' },
  { icon: 'M', label: 'Marketing' },
  { icon: 'A', label: 'Academy' },
  { icon: 'S', label: 'Scout AI' },
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
  const [agentName, setAgentName] = useState('Agent');
  const [agentInitials, setAgentInitials] = useState('--');
  const [stage, setStage] = useState('active');
  const [stageTasks, setStageTasks] = useState<typeof STAGE_PRIORITIES['active']>([]);

  const toggle = (id: number) => setDone(prev => ({ ...prev, [id]: !prev[id] }));
  const completedCount = Object.values(done).filter(Boolean).length;

  // Read cookies on mount
  useEffect(() => {
    const getCookie = (name: string) => {
      const match = document.cookie.match(new RegExp(`${name}=([^;]+)`));
      return match ? decodeURIComponent(match[1]) : null;
    };

    const nameFromCookie = getCookie('bt_os_agent');
    const stageFromCookie = getCookie('bt_os_stage') || 'active';

    if (nameFromCookie) {
      setAgentName(nameFromCookie);
      // Extract initials: "Tom Songer" → "TS"
      const initials = nameFromCookie
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase();
      setAgentInitials(initials);
    }

    setStage(stageFromCookie);
    setStageTasks(STAGE_PRIORITIES[stageFromCookie] || STAGE_PRIORITIES['active']);
  }, []);

  // Stage badge
  const stageBadgeText = {
    'onboarding-30': 'Days 1-30',
    'onboarding-60': 'Days 30-60',
    'onboarding-90': 'Days 60-90',
    'active': 'Active Agent',
  }[stage] || 'Active Agent';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#F1F4F8', color: '#1E293B',
    }}>

      {/* ── TOP NAVBAR ─────────────────────────────────────────────────────── */}
      <header style={{
        height: 52, background: '#1B2E4B', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px', position: 'sticky',
        top: 0, zIndex: 200, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: '#E8A020', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: '#fff' }}>BT</div>
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
            <div style={{ width: 30, height: 30, background: '#2563EB', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{agentInitials}</div>
            <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>{agentName}</span>
            <span style={{ color: '#64748B', fontSize: 10 }}>▾</span>
          </div>
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

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
                <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0, fontWeight: 700 }}>{item.icon}</span>
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

          {/* ── WELCOME BANNER ────────────────────────────────────────── */}
          <section style={{ background: 'linear-gradient(135deg, #1B2E4B 0%, #2D4A7B 100%)', borderRadius: 8, padding: '16px 20px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Good morning, {agentName}</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#CBD5E1' }}>Welcome to BearTeamOS — Your command center for success</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{stageBadgeText}</span>
              </div>
            </div>
          </section>

          {/* ── TODAY'S PRIORITIES ────────────────────────────────────── */}
          <section style={{ background: '#fff', border: '1px solid #DDE3EC', borderRadius: 7, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8EDF4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#1B2E4B' }}>Today's Priorities</span>
                <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 8 }}>Onboarding checklist</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{completedCount}/{stageTasks.length}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 3, background: '#E8EDF4', flexShrink: 0 }}>
              <div style={{ height: '100%', background: '#2563EB', width: `${(completedCount / stageTasks.length) * 100}%`, transition: 'width 0.3s' }} />
            </div>

            <div style={{ overflowY: 'auto', flex: 1, maxHeight: '400px' }}>
              {stageTasks.map((task, i) => (
                <div key={task.id} onClick={() => toggle(task.id)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 16px',
                  borderBottom: i < stageTasks.length - 1 ? '1px solid #F1F5F9' : 'none',
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
                  {/* Tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{task.section}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── CRITICAL ALERTS ──────────────────────────────────────── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Critical Alerts</span>
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

        </main>
      </div>
    </div>
  );
}
