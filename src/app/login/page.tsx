'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getAgentByEmail, getFirstAgent } from '@/lib/queries'
import { runEngine } from '@/lib/engine'
import { logActivity } from '@/lib/queries'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) { setError('Email and password are required.'); return }
    setLoading(true)
    setError('')

    try {
      // Supabase Auth sign in
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (authErr || !data.session) {
        setError('Incorrect email or password.')
        setLoading(false)
        return
      }

      // Store session token for legacy middleware cookie check
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: data.session.access_token }),
      })
      const sessionData = await res.json()

      sessionStorage.setItem('bt_username', email.trim().toLowerCase())
      sessionStorage.setItem('bt_access_token', data.session.access_token)
      if (sessionData.is_admin) {
        sessionStorage.setItem('bt_is_admin', 'true')
      } else {
        sessionStorage.removeItem('bt_is_admin')
      }

      // Resolve agent profile
      const agent = await getAgentByEmail(email.trim().toLowerCase()) ?? await getFirstAgent()
      if (agent) {
        sessionStorage.setItem('bt_agent_id', agent.id)
        sessionStorage.setItem('bt_agent_name', agent.name)
        logActivity({
          agent_id: agent.id,
          action_type: 'login',
          description: `Agent logged in: ${agent.name}`,
          outcome: 'neutral',
        }).catch(() => {})
        runEngine(agent.id).catch(() => {})
      }

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
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0b1d3a', fontFamily: 'sans-serif', lineHeight: 1.2, marginBottom: 8 }}>
            BearTeamOS
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', fontFamily: 'sans-serif', fontWeight: 400 }}>
            Bear Team Real Estate · Orlando, FL
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoFocus
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
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
