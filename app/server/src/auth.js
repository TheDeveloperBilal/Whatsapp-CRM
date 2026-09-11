// ─── Auth utilities: password hashing + HMAC token (no extra packages) ───────
import crypto from 'node:crypto'

const SECRET = process.env.JWT_SECRET || 'portal-dev-secret-change-in-production'
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex')
  return `${salt}:${hash}`
}

export function checkPassword(password, stored) {
  try {
    const [salt, expected] = stored.split(':')
    if (!salt || !expected) return false
    const hash = crypto.createHmac('sha256', salt).update(password).digest('hex')
    if (hash.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected))
  } catch {
    return false
  }
}

export function createToken(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    tenantId: user.tenantId ?? null,
    role: user.role,
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyToken(token) {
  if (!token) return null
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return null
    const data = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'unauthorized' })
  req.user = payload
  next()
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'forbidden' })
  next()
}

export function canAccessTenant(user, tid) {
  if (user.role === 'superadmin') return true
  return user.tenantId === tid
}

// Plan limits
const PLAN_LIMITS = {
  free: { maxSessions: 1, broadcast: false },
  pro: { maxSessions: 3, broadcast: true },
  business: { maxSessions: Infinity, broadcast: true },
}

export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
}
