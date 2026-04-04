'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import AIWriter from '@/components/AIWriter'

const NAV: { label: string; href: string; badge?: string }[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Hot Leads', href: '/hot-leads', badge: 'HOT' },
  { label: 'Pipeline', href: '/pipeline' },
  { label: 'Commissions', href: '/commissions' },
  { label: 'CRM', href: '/crm' },
  { label: 'Memory', href: '/memory' },
  { label: 'Compliance', href: '/compliance' },
  { label: 'Knowledge', href: '/knowledge' },
  { label: 'Settings', href: '/settings' },
]

const QUICK_LINKS = [
  {
    group: 'MLS & Data',
    links: [
      { label: 'Stellar MLS', href: 'https://www.stellarmls.com' },
      { label: 'RPR', href: 'https://www.narrpr.com' },
    ],
  },
  {
    group: 'Contracts',
    links: [
      { label: 'FL Realtors Forms', href: 'https://forms.floridarealtors.org/index/signin' },
      { label: 'BrokerMint', href: 'https://control.brokermint.com/users/sign_in' },
    ],
  },
  {
    group: 'Prospecting',
    links: [
      { label: 'Zillow', href: 'https://www.zillow.com' },
      { label: 'Realtor.com', href: 'https://www.realtor.com' },
    ],
  },
  {
    group: 'Training',
    links: [
      { label: 'Bear Academy', href: 'https://worldteachpathways.moodlecloud.com/login/index.php?loginredirect=1' },
    ],
  },
  {
    group: 'Industry',
    links: [
      { label: 'FL Realtors', href: 'https://www.floridarealtors.org' },
      { label: 'NAR', href: 'https://www.nar.realtor' },
    ],
  },
]

export default function Sidebar() {
  const path = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLinks, setShowLinks] = useState(true)
  const [showAIWriter, setShowAIWriter] = useState(false)

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem('bt_is_admin') === 'true')
  }, [])

  return (
    <div style={{
      width: 170, flexShrink: 0,
      background: 'var(--bt-surface)',
      borderRight: '1px solid var(--bt-border)',
      display: 'flex', flexDirection: 'column',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--bt-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 4,
            background: 'var(--bt-accent)', color: 'var(--bt-black)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.02em',
          }}>BT</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--bt-text)' }}>
              BEARTEAM<span style={{ color: 'var(--bt-text-dim)' }}>OS</span>
            </div>
            <div style={{ fontSize: 8, color: 'var(--bt-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Agent Operating System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 0', borderBottom: '1px solid var(--bt-border)', flexShrink: 0 }}>
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px',
              fontSize: 13,
              color: active ? 'var(--bt-text)' : 'var(--bt-text-dim)',
              background: active ? 'rgba(123,183,183,0.1)' : 'transparent',
              borderLeft: active ? '2px solid var(--bt-accent)' : '2px solid transparent',
              fontWeight: active ? 600 : 400,
              textDecoration: 'none',
            }}>
              {item.label}
              {item.badge && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                  background: '#E04E4E', color: '#fff',
                  borderRadius: 3, padding: '1px 5px',
                }}>{item.badge}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* AI Writer button */}
      <div style={{ padding: '10px 16px', flexShrink: 0 }}>
        <button onClick={() => setShowAIWriter(v => !v)} style={{
          display: 'block', width: '100%', textAlign: 'center',
          padding: '10px 12px', borderRadius: 6,
          background: '#2D5A3D', color: '#fff',
          fontSize: 13, fontWeight: 600,
          border: 'none', cursor: 'pointer',
        }}>
          AI Writer
        </button>
      </div>

      <AIWriter open={showAIWriter} onClose={() => setShowAIWriter(false)} />

      {/* Daily Toolkit */}
      <div style={{ flexShrink: 0 }}>
        <button
          onClick={() => setShowLinks(v => !v)}
          style={{
            width: '100%', textAlign: 'left',
            padding: '8px 16px',
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--bt-text-dim)',
            background: 'transparent', border: 'none', cursor: 'pointer',
          }}
        >
          Daily Toolkit
        </button>

        {showLinks && (
          <div style={{ paddingBottom: 8 }}>
            {QUICK_LINKS.map((group) => (
              <div key={group.group} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--bt-muted)', padding: '3px 16px 1px' }}>
                  {group.group}
                </div>
                {group.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '4px 16px',
                      fontSize: 12, color: 'var(--bt-text-dim)',
                      textDecoration: 'none',
                    }}
                  >
                    {link.label}
                    <span style={{ fontSize: 9, opacity: 0.5 }}>&#8599;</span>
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--bt-border)', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {isAdmin && (
          <Link href="/broker" style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--bt-black)', background: 'var(--bt-accent)',
            borderRadius: 4, padding: '6px 10px', textAlign: 'center',
            textDecoration: 'none',
          }}>
            Admin View &rarr;
          </Link>
        )}
        <Link href="/login" style={{ fontSize: 11, color: 'var(--bt-text-dim)', textDecoration: 'none' }}>
          Sign out
        </Link>
      </div>
    </div>
  )
}
