import { Bot } from 'lucide-react'
import { usePortal } from '@/lib/store'

// Monthly AI reply allowance for the active workspace. Hidden for unlimited plans.
export function AiUsageMeter({ className = '' }: { className?: string }) {
  const { plan } = usePortal()
  const usage = plan?.aiUsage
  if (!usage || usage.limit == null) return null
  const pct = Math.min(100, Math.round((usage.used / Math.max(usage.limit, 1)) * 100))
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Bot className="size-4 text-indigo-500" />
          AI replies this month
        </div>
        <div className="text-sm font-semibold text-gray-900">
          {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {pct >= 100
          ? 'Allowance used up. New chats go to your team until next month or an upgrade.'
          : `${plan?.name} plan${usage.bonus ? `, including ${usage.bonus.toLocaleString()} extra` : ''}. Resets on the 1st of each month.`}
      </p>
    </div>
  )
}
