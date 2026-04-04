'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const TABS = [
  { label: 'Home', href: '/dashboard', icon: '\u2302' },
  { label: 'Pipeline', href: '/pipeline', icon: '\u25A6' },
  { label: 'CRM', href: '/crm', icon: '\u260E' },
  { label: 'Earn', href: '/commissions', icon: '$' },
]

const ALL_NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Hot Leads', href: '/hot-leads' },
  { label: 'Pipeline', href: '/pipeline' },
  { label: 'Commissions', href: '/commissions' },
  { label: 'CRM', href: '/crm' },
  { label: 'Memory', href: '/memory' },
  { label: 'Compliance', href: '/compliance' },
  { label: 'Knowledge', href: '/knowledge' },
  { label: 'Settings', href: '/settings' },
]

interface Props {
  children: React.ReactNode
}

export default function MobileLayout({ children }: Props) {
  const path = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const pageTitle = ALL_NAV.find(n => path === n.href || path.startsWith(n.href + '/'))?.label || 'BearTeamOS'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Top header bar with hamburger */}
      <div style={{
        height: 48, flexShrink: 0,
        background: 'var(--bt-surface)', borderBottom: '1px solid var(--bt-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', zIndex: 500,
      }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 22, color: 'var(--bt-text)', padding: '4px 8px',
            lineHeight: 1,
          }}
        >
          {menuOpen ? '\u2715' : '\u2630'}
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>{pageTitle}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bt-accent)', letterSpacing: '0.04em' }}>BT</span>
          <span style={{ fontSize: 9, color: 'var(--bt-text-dim)' }}>OS</span>
        </div>
      </div>

      {/* Hamburger slide-out menu */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600,
          }} />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: 260,
            background: '#0a1520', borderRight: '1px solid var(--bt-border)',
            zIndex: 601, display: 'flex', flexDirection: 'column',
            overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          }}>
            {/* Menu header */}
            <div style={{
              padding: '16px 18px', borderBottom: '1px solid var(--bt-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 4,
                  background: 'var(--bt-accent)', color: 'var(--bt-black)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                }}>BT</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bt-text)' }}>BEARTEAMOS</div>
                  <div style={{ fontSize: 8, color: 'var(--bt-text-dim)', textTransform: 'uppercase' }}>Agent OS</div>
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)} style={{
                background: 'transparent', border: 'none', color: 'var(--bt-text-dim)',
                fontSize: 20, cursor: 'pointer',
              }}>&times;</button>
            </div>

            {/* Nav items */}
            <nav style={{ padding: '8px 0', flex: 1 }}>
              {ALL_NAV.map(item => {
                const active = path === item.href
                return (
                  <button
                    key={item.href}
                    onClick={() => { router.push(item.href); setMenuOpen(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '12px 18px', fontSize: 15,
                      color: active ? 'var(--bt-accent)' : 'var(--bt-text)',
                      background: active ? 'rgba(123,183,183,0.1)' : 'transparent',
                      borderLeft: active ? '3px solid var(--bt-accent)' : '3px solid transparent',
                      border: 'none', cursor: 'pointer',
                      fontWeight: active ? 600 : 400,
                    }}
                  >{item.label}</button>
                )
              })}
            </nav>

            {/* Sign out */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--bt-border)' }}>
              <button onClick={() => { router.push('/login'); setMenuOpen(false) }} style={{
                width: '100%', textAlign: 'left', padding: '10px 0',
                fontSize: 13, color: 'var(--bt-text-dim)',
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}>Sign out</button>
            </div>
          </div>
        </>
      )}

      {/* Content — scrollable with touch support */}
      <div style={{
        flex: 1, overflowY: 'auto', minHeight: 0,
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}>
        {children}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        height: 52, flexShrink: 0,
        background: 'var(--bt-surface)', borderTop: '1px solid var(--bt-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        zIndex: 500,
      }}>
        {TABS.map(tab => {
          const active = path === tab.href || path.startsWith(tab.href + '/')
          return (
            <button
              key={tab.label}
              onClick={() => { setMenuOpen(false); router.push(tab.href) }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: active ? 'var(--bt-accent)' : 'var(--bt-text-dim)',
                padding: '6px 0',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 400 }}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
