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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    fontSize: 15,
    fontFamily: 'sans-serif',
    color: '#1a1a1a',
    backgroundColor: 'transparent',
    border: '1px solid rgb(209, 213, 219)',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0b1d3a',
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        width: 360,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: '40px 48px',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#0b1d3a',
            fontFamily: 'sans-serif',
            lineHeight: 1.2,
            marginBottom: 8,
          }}>
            BearTeamOS Dashboard
          </div>
          <div style={{
            fontSize: 14,
            color: '#6b7280',
            fontFamily: 'sans-serif',
            fontWeight: 400,
          }}>
            Bear Team Real Estate · Orlando, FL
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 12, fontFamily: 'sans-serif' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 0',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'sans-serif',
              backgroundColor: loading ? '#374151' : '#0b1d3a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
