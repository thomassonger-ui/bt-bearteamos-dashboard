'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — set password
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2 — confirm profile
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // Load user data from Supabase session (they arrived via magic link)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? '')
        setName(data.user.user_metadata?.name ?? '')
        setPhone(data.user.user_metadata?.phone ?? '')
      }
    })
  }, [])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep(2)
  }

  async function handleConfirmProfile(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      // Update Supabase Auth metadata
      await supabase.auth.updateUser({ data: { name, phone } })

      // Update agent row via API
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/auth/me/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name, phone, onboarded: true, onboarding_stage: 3 }),
      })

      // Store session info for legacy sessionStorage usage
      sessionStorage.setItem('bt_username', email)
      setStep(3)
    } catch (err) {
      setError('Something went wrong. Try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function goToDashboard() {
    // Set legacy session cookie via existing auth route
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      sessionStorage.setItem('bt_access_token', session.access_token)
    }
    router.push('/dashboard')
  }

  const cardStyle: React.CSSProperties = {
    width: 400, backgroundColor: '#fff', borderRadius: 12,
    padding: '40px 48px', fontFamily: 'sans-serif',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: 15,
    border: '1px solid #d1d5db', borderRadius: 6, outline: 'none',
    boxSizing: 'border-box', marginBottom: 12,
  }
  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '10px 0', fontSize: 15, fontWeight: 600,
    backgroundColor: '#0b1d3a', color: '#fff', border: 'none',
    borderRadius: 6, cursor: 'pointer', marginTop: 8,
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1d3a' }}>
      <div style={cardStyle}>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: s <= step ? '#0b1d3a' : '#e5e7eb' }} />
          ))}
        </div>

        {step === 1 && (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0b1d3a', marginBottom: 6 }}>Welcome to Bear Team</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>Set a password to secure your account.</div>
            <form onSubmit={handleSetPassword}>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="New password (8+ characters)" style={inputStyle} />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm password" style={inputStyle} />
              {error && <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 8 }}>{error}</div>}
              <button type="submit" disabled={loading} style={btnStyle}>{loading ? 'Saving…' : 'Set Password'}</button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0b1d3a', marginBottom: 6 }}>Confirm Your Profile</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>This is how you'll appear in the system.</div>
            <form onSubmit={handleConfirmProfile}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" style={inputStyle} />
              <input value={email} readOnly style={{ ...inputStyle, backgroundColor: '#f9fafb', color: '#9ca3af' }} />
              {error && <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 8 }}>{error}</div>}
              <button type="submit" disabled={loading} style={btnStyle}>{loading ? 'Saving…' : 'Confirm & Continue'}</button>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0b1d3a', marginBottom: 6 }}>You're all set, {name.split(' ')[0]}!</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
              Your BearTeamOS account is ready. Tom will reach out to schedule your Week 1 check-in.
            </div>
            <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: 8, marginBottom: 24, fontSize: 13, color: '#166534' }}>
              ✓ Account secured<br/>✓ Profile saved<br/>✓ Dashboard access ready
            </div>
            <button onClick={goToDashboard} style={btnStyle}>Go to Dashboard →</button>
          </>
        )}

      </div>
    </div>
  )
}
