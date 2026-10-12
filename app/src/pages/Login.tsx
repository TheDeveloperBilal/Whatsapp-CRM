import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { PortalClient, DEFAULT_BACKEND_URL } from '@/lib/backend'
import { setToken } from '@/lib/auth'
import { loadProfile } from '@/lib/gateway'

const client = new PortalClient(loadProfile().baseUrl || DEFAULT_BACKEND_URL)

const T = {
  ink:    '#0B1120',
  ink2:   '#141A2E',
  surf:   '#FAFAF8',
  white:  '#FFFFFF',
  em:     '#0C9A68',
  emBg:   'rgba(12,154,104,0.09)',
  emRing: 'rgba(12,154,104,0.22)',
  t1:     '#0B1120',
  t2:     '#3C485E',
  t3:     '#7E8FA5',
  bd:     'rgba(11,17,32,0.10)',
}

interface Props {
  onLogin: () => void
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const { token } = await client.login(username.trim(), password)
      setToken(token)
      onLogin()
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: T.ink,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Subtle dot grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
      {/* Emerald glow */}
      <div style={{ position: 'absolute', top: '10%', right: '5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(12,154,104,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 24,
          padding: '40px 36px',
          position: 'relative',
          zIndex: 10,
          background: T.white,
          border: `1px solid rgba(255,255,255,0.08)`,
          boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
        }}
      >
        {/* Brand wordmark */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill={T.em} />
              <path d="M10 21.5V12a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-5l-4 2v-3z" fill="white" />
              <circle cx="14" cy="15" r="1.2" fill={T.em} />
              <circle cx="18" cy="15" r="1.2" fill={T.em} />
            </svg>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: 16, lineHeight: 1, color: T.t1 }}>
                Digital Nova Tech
              </div>
              <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, lineHeight: 1, marginTop: 4, color: T.t3, fontWeight: 500, letterSpacing: '0.04em' }}>
                WhatsApp Portal
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 22, color: T.t1, margin: 0, letterSpacing: '-0.02em' }}>
              Sign in
            </h1>
            <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, color: T.t3, marginTop: 6, margin: '6px 0 0' }}>
              Access your workspace
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Username */}
          <div>
            <label htmlFor="username" style={{ display: 'block', fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: T.t2, marginBottom: 6 }}>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                padding: '0 14px',
                fontSize: 14,
                color: T.t1,
                background: T.surf,
                border: `1.5px solid ${T.bd}`,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: "'Inter', system-ui, sans-serif",
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = T.em)}
              onBlur={e => (e.target.style.borderColor = T.bd)}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" style={{ display: 'block', fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: T.t2, marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 12,
                  padding: '0 44px 0 14px',
                  fontSize: 14,
                  color: T.t1,
                  background: T.surf,
                  border: `1.5px solid ${T.bd}`,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = T.em)}
                onBlur={e => (e.target.style.borderColor = T.bd)}
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.t3, minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                fontSize: 13,
                color: '#dc2626',
                borderRadius: 10,
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 12,
              background: loading || !username.trim() || !password ? `${T.em}80` : T.em,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Inter', system-ui, sans-serif",
              border: 'none',
              cursor: loading || !username.trim() || !password ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
              transition: 'opacity 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
          >
            {loading ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : 'Sign in'}
          </button>
        </form>
      </div>

      {/* Footer note */}
      <p style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
        WhatsApp Portal · Digital Nova Tech
      </p>
    </div>
  )
}
