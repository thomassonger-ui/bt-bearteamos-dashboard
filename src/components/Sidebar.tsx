'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Tasks',     href: '/tasks' },
  { label: 'Pipeline',  href: '/pipeline' },
  { label: 'Memory',    href: '/memory' },
  { label: 'Compliance',href: '/compliance' },
  { label: 'Knowledge', href: '/knowledge' },
  { label: 'Settings',  href: '/settings' },
]

const QUICK_LINKS = [
  {
    group: 'MLS & Data',
    links: [
      { label: 'Stellar MLS',               href: 'https://www.stellarmls.com/' },
      { label: 'OC Property Appraiser',     href: 'https://www.ocpafl.org/' },
      { label: 'OC Tax Collector',          href: 'https://www.octaxcol.com/' },
    ],
  },
  {
    group: 'Contracts & Compliance',
    links: [
      { label: 'FL Realtors Forms (FAR)',   href: 'https://forms.floridarealtors.org/index/signin' },
      { label: 'DBPR License Lookup',       href: 'https://www.myfloridalicense.com/wl11.asp' },
      { label: 'FREC Rules',                href: 'https://www.myfloridalicense.com/DBPR/real-estate-commission/' },
      { label: 'BrokerMint',                href: 'https://control.brokermint.com/users/sign_in' },
    ],
  },
  {
    group: 'Lead & Prospecting',
    links: [
      { label: 'Zillow',                    href: 'https://www.zillow.com/' },
      { label: 'Realtor.com',               href: 'https://www.realtor.com/' },
    ],
  },
  {
    group: 'Training',
    links: [
      { label: 'Tom Ferry',                 href: 'https://www.tomferry.com/' },
      { label: 'Bear Academy',              href: 'https://worldteachpathways.moodlecloud.com/login/index.php?loginredirect=1' },
    ],
  },
  {
    group: 'Industry',
    links: [
      { label: 'NAR',                       href: 'https://www.nar.realtor/' },
      { label: 'Florida Realtors',          href: 'https://www.floridarealtors.org/' },
    ],
  },
]

export default function Sidebar() {
  const path = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem('bt_is_admin') === 'true')
  }, [])

  return (
    <div style={{
      width: 200, flexShrink: 0,
      background: 'var(--bt-surface)',
      borderRight: '1px solid var(--bt-border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--bt-border)', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--bt-accent)' }}>
          BEARTEAM<span style={{ color: 'var(--bt-text-dim)' }}>OS</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 2 }}>Agent Operating System</div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 0', flexShrink: 0 }}>
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'block',
              padding: '7px 20px',
              fontSize: 13,
              color: active ? 'var(--bt-text)' : 'var(--bt-text-dim)',
              background: active ? 'var(--bt-muted)' : 'transparent',
              borderLeft: active ? '2px solid var(--bt-accent)' : '2px solid transparent',
              fontWeight: active ? 500 : 400,
            }}>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Quick Links — scrollable, fills remaining space */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        borderTop: '1px solid var(--bt-border)',
        padding: '10px 20px 4px',
        scrollbarWidth: 'none',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--bt-text-dim)', marginBottom: 6 }}>
          Quick Links
        </div>
        {QUICK_LINKS.map((group) => (
          <div key={group.group} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bt-accent)', opacity: 0.7, marginBottom: 3 }}>
              {group.group}
            </div>
            {group.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '1px 0',
                  fontSize: 11,
                  color: 'var(--bt-text-dim)',
                  textDecoration: 'none',
                  lineHeight: 1.5,
                }}
              >
                {link.label}
                <span style={{ fontSize: 8, opacity: 0.5 }}>↗</span>
              </a>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--bt-border)', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {isAdmin && (
          <Link href="/broker" style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--bt-black)',
            background: 'var(--bt-accent)',
            padding: '5px 10px',
            borderRadius: 4,
            letterSpacing: '0.04em',
            textAlign: 'center',
          }}>
            Admin View →
          </Link>
        )}
        {!isAdmin && (
          <Link href="/broker" style={{ fontSize: 11, color: 'var(--bt-accent)', letterSpacing: '0.06em' }}>
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
