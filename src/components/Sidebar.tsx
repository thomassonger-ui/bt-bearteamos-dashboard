'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Pipeline', href: '/pipeline' },
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
    group: 'Contracts & Compliance',
    links: [
      { label: 'FL Realtors Forms', href: 'https://forms.floridarealtors.org/index/signin' },
      { label: 'BrokerMint', href: 'https://control.brokermint.com/users/sign_in' },
    ],
  },
  {
    group: 'Lead & Prospecting',
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
  const [showLinks, setShowLinks] = useState(false)

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem('bt_is_admin') === 'true')
  }, [])

  return (
    <div style={{
      width: 200, flexShrink: 0,
      background: 'var(--bt-surface)',
      borderRight: '1px solid var(--bt-border)',
      display: 'flex', flexDirection: 'column',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--bt-border)', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--bt-accent)' }}>
          BEARTEAM<span style={{ color: 'var(--bt-text-dim)' }}>OS</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 2 }}>Agent Operating System</div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 0', borderBottom: '1px solid var(--bt-border)', flexShrink: 0 }}>
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'block',
              padding: '9px 20px',
              fontSize: 13,
              color: active ? 'var(--bt-text)' : 'var(--bt-text-dim)',
              background: active ? 'rgba(123,183,183,0.1)' : 'transparent',
              borderLeft: active ? '2px solid var(--bt-accent)' : '2px solid transparent',
              fontWeight: active ? 500 : 400,
            }}>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Quick Links */}
      <div style={{ flexShrink: 0 }}>
        <button
          onClick={() => setShowLinks(v => !v)}
          style={{
            width: '100%', textAlign: 'left',
            padding: '10px 20px',
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--bt-text-dim)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>Daily Toolkit</span>
          <span style={{ fontSize: 10 }}>{showLinks ? '▲' : '▼'}</span>
        </button>

        {showLinks && (
          <div style={{ paddingBottom: 8 }}>
            {QUICK_LINKS.map((group) => (
              <div key={group.group} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--bt-muted)', padding: '4px 20px 2px' }}>
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
                      padding: '5px 20px',
                      fontSize: 12, color: 'var(--bt-text-dim)',
                    }}
                  >
                    {link.label}
                    <span style={{ fontSize: 9, opacity: 0.5 }}>↗</span>
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', padding: '14px 20px', borderTop: '1px solid var(--bt-border)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {isAdmin ? (
          <Link href="/broker" style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--bt-black)', background: 'var(--bt-accent)',
            borderRadius: 4, padding: '6px 10px', textAlign: 'center',
          }}>
            Admin View →
          </Link>
        ) : (
          <Link href="/broker" style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.06em' }}>
            Broker View →
          </Link>
        )}
        <Link href="/login" style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>
          Sign out
        </Link>
      </div>
    </div>
  )
}
