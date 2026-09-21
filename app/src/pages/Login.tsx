import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { PortalClient, DEFAULT_BACKEND_URL } from '@/lib/backend'
import { setToken } from '@/lib/auth'
import { loadProfile } from '@/lib/gateway'

const client = new PortalClient(loadProfile().baseUrl || DEFAULT_BACKEND_URL)

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
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 45%, #ede9fe 100%)' }}
    >
      {/* Decorative orbs */}
      <div
        className="absolute top-0 right-0 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)', transform: 'translate(30%, -30%)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.14), transparent 70%)', transform: 'translate(-30%, 30%)' }}
      />

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-3xl px-8 py-9 relative z-10"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.8)',
          boxShadow: '0 24px 64px rgba(79,70,229,0.13), 0 4px 16px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo + Brand */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div
            className="flex size-14 items-center justify-center rounded-2xl text-white font-extrabold text-xl select-none"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 6px 20px rgba(99,102,241,0.42)',
            }}
          >
            W
          </div>
          <div className="text-center">
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900">WhatsApp Portal</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to your workspace</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-[13px] font-semibold text-gray-700">
              Username
            </Label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              autoFocus
              className="w-full h-11 rounded-xl px-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: '1.5px solid #e5e7eb',
              }}
              onFocus={e => (e.target.style.borderColor = '#6366f1')}
              onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px] font-semibold text-gray-700">
              Password
            </Label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full h-11 rounded-xl px-3.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  border: '1.5px solid #e5e7eb',
                }}
                onFocus={e => (e.target.style.borderColor = '#6366f1')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="text-sm text-red-600 rounded-xl px-3.5 py-2.5"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all mt-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 14px rgba(99,102,241,0.38)',
            }}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Sign in'}
          </button>
        </form>

        {/* Hint */}
        <p className="mt-5 text-center text-[11px] text-gray-400">
          Default: <span className="font-mono font-semibold text-gray-500">admin</span>
          {' / '}
          <span className="font-mono font-semibold text-gray-500">admin123</span>
        </p>
      </div>

      {/* Footer */}
      <p className="absolute bottom-5 left-0 right-0 text-center text-[11px]" style={{ color: 'rgba(99,102,241,0.5)' }}>
        WhatsApp CRM · AI-Powered
      </p>
    </div>
  )
}
