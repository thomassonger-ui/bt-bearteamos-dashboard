'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getFirstAgent } from '@/lib/queries'
import { runEngine } from '@/lib/engine'
import { logActivity } from '@/lib/queries'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) { setError('Username and password are required.'); return }
    setLoading(true)
    setError('')

    try {
      // Validate password server-side — sets bt_session cookie on success
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!authRes.ok) {
        setError('Incorrect password.')
        setLoading(false)
        return
      }

      // Fetch agent from DB
      const agent = await getFirstAgent()
      if (!agent) { setError('No agent found in system.'); setLoading(false); return }

      // Log the login event
      await logActivity({
        agent_id: agent.id,
        action_type: 'login',
        description: `Agent logged in: ${agent.name}`,
        outcome: 'neutral',
      })

      // Run engine on login — 24h inactivity check fires here
      await runEngine(agent.id)

      // Store agent ID in sessionStorage for pages to use
      sessionStorage.setItem('bt_agent_id', agent.id)
      sessionStorage.setItem('bt_agent_name', agent.name)

      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      setError('System error. Please try again.')
    } finally {
      setLoading(false)
    }
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
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14,
                background: 'var(--bt-muted)', border: '1px solid var(--bt-border)',
                borderRadius: 4, color: 'var(--bt-text)', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
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

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '10px', fontSize: 13, fontWeight: 600,
            background: loading ? 'var(--bt-muted)' : 'var(--bt-accent)',
            color: 'var(--bt-black)', border: 'none', borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.04em',
          }}>
            {loading ? 'Loading system…' : 'Enter System'}
          </button>
        </form>

        <div style={{ marginTop: 24, fontSize: 11, color: 'var(--bt-text-dim)', textAlign: 'center' }}>
          Bear Team Real Estate · Orlando, FL<br />
          BearTeamOS — Live Database
        </div>
      </div>
    </div>
  )
}
