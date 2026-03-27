'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    // Placeholder — no real auth in Phase 1
    router.push('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bt-black)',
    }}>
      <div style={{
        width: 340, background: 'var(--bt-surface)',
        border: '1px solid var(--bt-border)', borderRadius: 8, padding: '36px 32px',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--bt-accent)', letterSpacing: '0.06em' }}>
            BEARTEAM<span style={{ color: 'var(--bt-text-dim)' }}>OS</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', marginTop: 4 }}>
            Agent Operating System
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Agent Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sarah Mitchell"
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14,
                background: 'var(--bt-muted)', border: '1px solid var(--bt-border)',
                borderRadius: 4, color: 'var(--bt-text)', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--bt-red)', marginBottom: 12 }}>{error}</div>
          )}

          <button type="submit" style={{
            width: '100%', padding: '10px', fontSize: 13, fontWeight: 600,
            background: 'var(--bt-accent)', color: 'var(--bt-black)',
            border: 'none', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em',
          }}>
            Enter System
          </button>
        </form>

        <div style={{ marginTop: 24, fontSize: 11, color: 'var(--bt-text-dim)', textAlign: 'center' }}>
          Bear Team Real Estate · Orlando, FL<br />
          Phase 1 — Placeholder Auth
        </div>
      </div>
    </div>
  )
}
