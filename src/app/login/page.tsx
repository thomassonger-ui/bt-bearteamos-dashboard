'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        // Store in localStorage so dashboard can read it
        if (data.name) localStorage.setItem('bt_os_agent', data.name);
        if (data.stage) localStorage.setItem('bt_os_stage', data.stage);
        
        setTimeout(() => {
          router.push(from);
          router.refresh();
        }, 500);
      } else {
        setError('Invalid username or password. Try again.');
        setPassword('');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1B2E4B',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 38, height: 38, background: '#1B2E4B', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 17, color: '#E8A020',
          }}>BT</div>
          <span style={{ fontWeight: 800, fontSize: 20, color: '#1B2E4B', letterSpacing: '-0.3px' }}>
            BearTeam<span style={{ color: '#E8A020' }}>OS</span>
          </span>
        </div>

        <div style={{ width: 40, height: 3, background: '#E8A020', borderRadius: 2, margin: '14px auto 22px' }} />

        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#1B2E4B', marginBottom: 4, textAlign: 'center' }}>
          Agent Dashboard
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 28 }}>
          Enter your credentials to continue
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 700,
              color: '#475569', marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: '0.6px',
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', fontSize: 15,
                border: `1.5px solid ${error ? '#DC2626' : '#DDE3EC'}`,
                borderRadius: 7, outline: 'none', color: '#1E293B',
                background: '#F8FAFC', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 700,
              color: '#475569', marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: '0.6px',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '10px 14px', fontSize: 15,
                border: `1.5px solid ${error ? '#DC2626' : '#DDE3EC'}`,
                borderRadius: 7, outline: 'none', color: '#1E293B',
                background: '#F8FAFC', boxSizing: 'border-box',
                letterSpacing: password ? '4px' : '0px',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderLeft: '3px solid #DC2626',
              borderRadius: 6, padding: '8px 12px',
              marginBottom: 14, fontSize: 13, color: '#DC2626',
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width: '100%', padding: '12px',
              background: loading || !username || !password ? '#94A3B8' : '#1B2E4B',
              color: '#fff', border: 'none', borderRadius: 7,
              fontSize: 14, fontWeight: 700,
              cursor: loading || !username || !password ? 'not-allowed' : 'pointer',
              letterSpacing: '0.2px',
            }}
          >
            {loading ? 'Verifying…' : 'Access Dashboard →'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: '12px 14px', background: '#F8FAFC', borderRadius: 7, border: '1px solid #E8EDF4' }}>
          <p style={{ fontSize: 11.5, color: '#64748B', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
            🔒 Bear Team Real Estate · Internal Use Only<br />
            <span style={{ color: '#94A3B8' }}>Contact Tom Songer for access</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
