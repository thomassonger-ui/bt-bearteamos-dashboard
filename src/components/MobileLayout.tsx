'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const TABS = [
  { label: 'Home', href: '/dashboard', icon: '\u2302' },
  { label: 'Pipeline', href: '/pipeline', icon: '\u25A6' },
  { label: 'CRM', href: '/crm', icon: '\u260E' },
  { label: 'Earn', href: '/commissions', icon: '$' },
  { label: 'More', href: '#more', icon: '\u2261' },
]

const MORE_ITEMS = [
  { label: 'Hot Leads', href: '/hot-leads' },
  { label: 'Tasks', href: '/tasks' },
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
  const [showMore, setShowMore] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {children}
      </div>

      {/* More menu overlay */}
      {showMore && (
        <>
          <div onClick={() => setShowMore(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }} />
          <div style={{
            position: 'fixed', bottom: 56, left: 0, right: 0,
            background: '#0d1825', borderTop: '1px solid var(--bt-border)',
            zIndex: 401, padding: '8px 0',
          }}>
            {MORE_ITEMS.map(item => (
              <button
                key={item.href}
                onClick={() => { router.push(item.href); setShowMore(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '12px 20px', fontSize: 14,
                  color: path === item.href ? 'var(--bt-accent)' : 'var(--bt-text)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid var(--bt-border)',
                }}
              >{item.label}</button>
            ))}
          </div>
        </>
      )}

      {/* Bottom tab bar */}
      <div style={{
        height: 56, flexShrink: 0,
        background: 'var(--bt-surface)', borderTop: '1px solid var(--bt-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        zIndex: 402,
      }}>
        {TABS.map(tab => {
          const active = tab.href === '#more' ? showMore : path === tab.href || path.startsWith(tab.href + '/')
          return (
            <button
              key={tab.label}
              onClick={() => {
                if (tab.href === '#more') { setShowMore(v => !v) }
                else { setShowMore(false); router.push(tab.href) }
              }}
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
