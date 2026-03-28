'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAgentByUsername, getFirstAgent } from '@/lib/queries'
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
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!authRes.ok) {
        setError('Incorrect username or password.')
        setLoading(false)
        return
      }

      const loggedInUsername = username.toLowerCase().trim()
      sessionStorage.setItem('bt_username', loggedInUsername)

      void (async () => {
        try {
          const agent = await getAgentByUsername(loggedInUsername) ?? await getFirstAgent()
          if (!agent) return
          sessionStorage.setItem('bt_agent_id', agent.id)
          sessionStorage.setItem('bt_agent_name', agent.name)
          await logActivity({
            agent_id: agent.id,
            action_type: 'login',
            description: `Agent logged in: ${agent.name}`,
            outcome: 'neutral',
          })
          await runEngine(agent.id)
        } catch (bgErr) {
          console.error('[login bg]', bgErr)
        }
      })()

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
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0d1b2a',
    }}>
      <div style={{
        width: 380,
        background: '#ffffff',
        borderRadius: 12,
        padding: '44px 40px 36px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.28)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0d1b2a', letterSpacing: '-0.01em' }}>
            BearTeamOS Dashboard
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
            Bear Team Real Estate · Orlando, FL
          </div>
        </div>

        <form onSubmit={handleLogin}>
          {/* Username */}
          <div style={{ marginBottom: 14 }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 14,
                color: '#0d1b2a',
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 14,
                color: '#0d1b2a',
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 14,
              fontWeight: 600,
              background: loading ? '#4b5563' : '#0d1b2a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
            }}
          >
            {loading ? 'Signing in…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
