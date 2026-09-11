// ─── Frontend auth utilities ─────────────────────────────────────────────────
import type { AuthUser } from '@/types/portal'

const TOKEN_KEY = 'portal_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function decodeUser(token: string): AuthUser | null {
  try {
    const dotIdx = token.lastIndexOf('.')
    const data = token.slice(0, dotIdx)
    // base64url → base64 → JSON
    const json = atob(data.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as AuthUser
  } catch {
    return null
  }
}

export function getUser(): AuthUser | null {
  const token = getToken()
  if (!token) return null
  const user = decodeUser(token)
  if (!user || user.exp < Date.now()) {
    clearToken()
    return null
  }
  return user
}

export function isLoggedIn(): boolean {
  return getUser() !== null
}
