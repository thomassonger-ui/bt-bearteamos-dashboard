'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Pipeline', href: '/pipeline' },
  { label: 'Memory', href: '/memory' },
  { label: 'Compliance', href: '/compliance' },
  { label: 'Knowledge', href: '/knowledge' },
  { label: 'Settings', href: '/settings' },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <div style={{
      width: 200, flexShrink: 0,
      background: 'var(--bt-surface)',
      borderRight: '1px solid var(--bt-border)',
      display: 'flex', flexDirection: 'column',
      minHeight: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--bt-border)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--bt-accent)' }}>
          BEARTEAM<span style={{ color: 'var(--bt-text-dim)' }}>OS</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--bt-text-dim)', marginTop: 2 }}>Agent Operating System</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'block',
              padding: '9px 20px',
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

      {/* Footer */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--bt-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href="/broker" style={{ fontSize: 11, color: 'var(--bt-accent)', letterSpacing: '0.06em' }}>
          Broker View →
        </Link>
        <Link href="/login" style={{ fontSize: 11, color: 'var(--bt-text-dim)' }}>
          Sign out
        </Link>
      </div>
    </div>
  )
}
