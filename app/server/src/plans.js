// ─── Subscription packages ───────────────────────────────────────────────────
// Single source of truth for what each package allows. null = unlimited.
import { collection, save } from './db.js'

const BUSINESS_FEATURES = [
  'broadcast', 'pipeline', 'booking', 'automations', 'intentRouting',
  'departments', 'leadCapture', 'analytics',
]
const PRO_FEATURES = [...BUSINESS_FEATURES, 'workflows', 'webhooks', 'payments']

export const PLANS = {
  starter: {
    id: 'starter', name: 'Starter', priceMonthlyPkr: 4999,
    limits: { sessions: 1, users: 2, kbArticles: 10, products: 25, aiRepliesPerMonth: 1000 },
    features: [],
  },
  business: {
    id: 'business', name: 'Business', priceMonthlyPkr: 9999,
    limits: { sessions: 2, users: 5, kbArticles: null, products: null, aiRepliesPerMonth: 5000 },
    features: BUSINESS_FEATURES,
  },
  pro: {
    id: 'pro', name: 'Pro', priceMonthlyPkr: 19999,
    limits: { sessions: 5, users: null, kbArticles: null, products: null, aiRepliesPerMonth: 15000 },
    features: PRO_FEATURES,
  },
}

export const FEATURE_LABELS = {
  broadcast: 'Broadcast',
  pipeline: 'Sales pipeline',
  booking: 'Appointment booking',
  automations: 'Automation rules',
  intentRouting: 'Intent routing',
  departments: 'Departments & auto-assign',
  leadCapture: 'Lead capture (Campaigns)',
  analytics: 'Full analytics',
  workflows: 'Workflow builder',
  webhooks: 'Webhooks',
  payments: 'Invoices & payments',
}

// Plan ids before packages existed. The old and new names overlap
// ("business" was the unlimited tier, now "pro"), so tenants are migrated once
// and marked with planVersion 2.
const LEGACY_PLAN = { free: 'starter', pro: 'business', business: 'pro' }
const PLAN_VERSION = 2

function migrateTenantPlans() {
  let changed = false
  for (const t of collection('tenants') || []) {
    if (t.planVersion === PLAN_VERSION) continue
    const next = PLANS[LEGACY_PLAN[t.plan]] ? LEGACY_PLAN[t.plan] : PLANS[t.plan] ? t.plan : 'starter'
    console.log(`[plans] ${t.name}: "${t.plan}" -> "${next}"`)
    t.plan = next
    t.planVersion = PLAN_VERSION
    changed = true
  }
  if (changed) save()
}
migrateTenantPlans()

export function isValidPlan(id) {
  return Object.hasOwn(PLANS, id)
}

export function planForTenant(tenant) {
  if (!tenant) return PLANS.starter
  const id = tenant.planVersion === PLAN_VERSION ? tenant.plan : LEGACY_PLAN[tenant.plan] ?? tenant.plan
  return PLANS[id] ?? PLANS.starter
}

export function tenantPlan(tenantId) {
  return planForTenant((collection('tenants') || []).find((t) => t.id === tenantId))
}

export function tenantHasFeature(tenantId, feature) {
  return tenantPlan(tenantId).features.includes(feature)
}

// Returns an error message when adding one more item would exceed the plan, else null
export function limitError(tenantId, limitKey, currentCount, noun) {
  const plan = tenantPlan(tenantId)
  const max = plan.limits[limitKey]
  if (max == null || currentCount < max) return null
  return `Your ${plan.name} plan allows up to ${max} ${max === 1 ? noun.replace(/s$/, '') : noun}. Upgrade your plan to add more.`
}

export function featureError(tenantId, feature) {
  if (tenantHasFeature(tenantId, feature)) return null
  return `${FEATURE_LABELS[feature] ?? feature} is not included in your ${tenantPlan(tenantId).name} plan. Upgrade your plan to use it.`
}

// Express helpers. Superadmin is never limited.
export function denyFeature(req, res, tenantId, feature) {
  if (req.user?.role === 'superadmin') return false
  const err = featureError(tenantId, feature)
  if (!err) return false
  res.status(402).json({ error: err, upgrade: true, feature })
  return true
}

export function denyLimit(req, res, tenantId, limitKey, currentCount, noun) {
  if (req.user?.role === 'superadmin') return false
  const err = limitError(tenantId, limitKey, currentCount, noun)
  if (!err) return false
  res.status(402).json({ error: err, upgrade: true, limit: limitKey })
  return true
}

export function requireFeature(feature) {
  return (req, res, next) => {
    if (denyFeature(req, res, req.params.tid, feature)) return
    next()
  }
}

// ── Monthly AI reply quota ───────────────────────────────────────────────────
// Months roll over at midnight Pakistan time (UTC+5). Usage lives on the tenant:
// aiUsage { month, replies, warned80, warnedFull }, aiBonus { month, replies } (admin top-up)
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000

export function currentMonth() {
  return new Date(Date.now() + PKT_OFFSET_MS).toISOString().slice(0, 7)
}

function findTenant(tenantId) {
  return (collection('tenants') || []).find((t) => t.id === tenantId)
}

export function aiQuota(tenantId) {
  const t = findTenant(tenantId)
  const month = currentMonth()
  const used = t?.aiUsage?.month === month ? t.aiUsage.replies : 0
  const bonus = t?.aiBonus?.month === month ? t.aiBonus.replies : 0
  const base = planForTenant(t).limits.aiRepliesPerMonth
  const limit = base == null ? null : base + bonus
  return { month, used, base, bonus, limit, exhausted: limit != null && used >= limit }
}

// Counts one AI reply; returns which alert thresholds were crossed for the first time this month
export function recordAiReply(tenantId) {
  const t = findTenant(tenantId)
  if (!t) return { reached80: false, reachedFull: false }
  const month = currentMonth()
  if (t.aiUsage?.month !== month) t.aiUsage = { month, replies: 0, warned80: false, warnedFull: false }
  t.aiUsage.replies += 1
  const { used, limit } = aiQuota(tenantId)
  const out = { reached80: false, reachedFull: false, used, limit }
  if (limit != null && !t.aiUsage.warned80 && used >= Math.ceil(limit * 0.8)) {
    t.aiUsage.warned80 = true
    out.reached80 = true
  }
  if (limit != null && !t.aiUsage.warnedFull && used >= limit) {
    t.aiUsage.warnedFull = true
    out.reachedFull = true
  }
  save()
  return out
}

export function setAiBonus(tenantId, replies) {
  const t = findTenant(tenantId)
  if (!t) return
  t.aiBonus = { month: currentMonth(), replies }
  // Re-arm the "used up" alert so the client hears about the new ceiling
  if (t.aiUsage?.month === currentMonth()) t.aiUsage.warnedFull = false
}

export function planInfo(tenantId, user) {
  const plan = tenantPlan(tenantId)
  const q = aiQuota(tenantId)
  return {
    id: plan.id, name: plan.name, limits: plan.limits, features: plan.features,
    unrestricted: user?.role === 'superadmin',
    aiUsage: { month: q.month, used: q.used, limit: q.limit, bonus: q.bonus },
  }
}
