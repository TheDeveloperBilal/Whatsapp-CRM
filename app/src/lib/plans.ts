import type { PlanFeature, PlanId, PlanInfo } from '@/types/portal'

// Mirrors app/server/src/plans.js — the server is what actually enforces these
export const PLAN_OPTIONS: { id: PlanId; name: string; price: string; summary: string }[] = [
  { id: 'starter', name: 'Starter', price: 'Rs 4,999/mo', summary: '1 number, 2 team members, AI inbox' },
  { id: 'business', name: 'Business', price: 'Rs 9,999/mo', summary: '2 numbers, 5 members, broadcast, pipeline, automation' },
  { id: 'pro', name: 'Pro', price: 'Rs 19,999/mo', summary: '5 numbers, unlimited members, workflows, payments' },
]

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  broadcast: 'Broadcast',
  pipeline: 'Sales pipeline',
  booking: 'Appointment booking',
  automations: 'Automation rules',
  intentRouting: 'Intent routing',
  departments: 'Departments & auto-assign',
  leadCapture: 'Lead capture',
  analytics: 'Full analytics',
  workflows: 'Workflow builder',
  webhooks: 'Webhooks',
  payments: 'Invoices & payments',
}

export const ROUTE_FEATURES: Record<string, PlanFeature> = {
  '/pipeline': 'pipeline',
  '/automation': 'automations',
  '/workflows': 'workflows',
  '/intent-routing': 'intentRouting',
  '/campaigns': 'leadCapture',
  '/broadcast': 'broadcast',
  '/payments': 'payments',
  '/booking': 'booking',
  '/analytics': 'analytics',
}

// Before bootstrap loads (plan null) nothing is locked, so pages never flash a lock screen
export function planAllows(plan: PlanInfo | null, feature: PlanFeature | undefined): boolean {
  if (!feature || !plan || plan.unrestricted) return true
  return plan.features.includes(feature)
}

export function planName(id: string): string {
  return PLAN_OPTIONS.find((p) => p.id === id)?.name ?? id
}
