import { useMemo } from 'react'
import { usePortal } from '@/lib/portal-context'
import { TrendingUp, Users, MessageSquare, DollarSign, BarChart2, Target } from 'lucide-react'

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmt(value: number, currency = 'USD') {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function pct(a: number, b: number) {
  if (!b) return '0%'
  return `${Math.round((a / b) * 100)}%`
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  )
}

// â”€â”€ Stat Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700">{icon}</div>
      </div>
    </div>
  )
}

// â”€â”€ Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</h3>
      {children}
    </div>
  )
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Analytics() {
  const { contacts, conversations, deals, pipelineStages, campaigns, paymentLinks, invoices, botRules, sessions } = usePortal()

  const data = useMemo(() => {
    // Pipeline funnel
    const stageMap: Record<string, { stage: typeof pipelineStages[0]; count: number; value: number }> = {}
    pipelineStages.forEach((s) => { stageMap[s.id] = { stage: s, count: 0, value: 0 } })
    deals.forEach((d) => { if (stageMap[d.stageId]) { stageMap[d.stageId].count++; stageMap[d.stageId].value += d.value ?? 0 } })
    const funnel = pipelineStages.map((s) => stageMap[s.id] ?? { stage: s, count: 0, value: 0 })
    const maxFunnelCount = Math.max(...funnel.map((f) => f.count), 1)

    // Deal metrics
    const totalDeals = deals.length
    const wonDeals = deals.filter((d) => d.outcome === 'won')
    const lostDeals = deals.filter((d) => d.outcome === 'lost')
    const pipelineValue = deals.reduce((s, d) => s + (d.value ?? 0), 0)
    const wonValue = wonDeals.reduce((s, d) => s + (d.value ?? 0), 0)

    // Revenue
    const paidLinkRevenue = paymentLinks.filter((l) => l.status === 'paid').reduce((s, l) => s + l.amount, 0)
    const paidInvRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)
    const totalRevenue = paidLinkRevenue + paidInvRevenue
    const pendingRevenue = paymentLinks.filter((l) => l.status === 'active').reduce((s, l) => s + l.amount, 0)
      + invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0)

    // Conversations
    const totalConvs = conversations.length
    const openConvs = conversations.filter((c) => c.status === 'open').length
    const botHandled = conversations.filter((c) => c.botActive).length
    const humanHandled = totalConvs - botHandled

    // Contacts by source (using tag as proxy)
    const contactGrowth = contacts.length

    // Campaigns
    const activeCampaigns = campaigns.filter((c) => c.active).length
    const campLeads = campaigns.reduce((s, c) => s + (typeof c.leads === 'number' ? c.leads : 0), 0)

    // Agents / sessions
    const onlineSessions = sessions.filter((s) => s.status === 'connected').length

    return {
      funnel, maxFunnelCount,
      totalDeals, wonDeals: wonDeals.length, lostDeals: lostDeals.length, pipelineValue, wonValue,
      totalRevenue, pendingRevenue,
      totalConvs, openConvs, botHandled, humanHandled,
      contactGrowth, activeCampaigns, campLeads,
      onlineSessions,
    }
  }, [contacts, conversations, deals, pipelineStages, campaigns, paymentLinks, invoices, sessions])

  const currency = paymentLinks[0]?.currency ?? invoices[0]?.currency ?? 'USD'

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Contacts" value={data.contactGrowth} icon={<Users className="h-4 w-4 text-blue-500" />} />
        <StatCard label="Open Conversations" value={data.openConvs} sub={`${data.totalConvs} total`} icon={<MessageSquare className="h-4 w-4 text-green-500" />} />
        <StatCard label="Pipeline Value" value={fmt(data.pipelineValue, currency)} icon={<TrendingUp className="h-4 w-4 text-purple-500" />} />
        <StatCard label="Revenue Collected" value={fmt(data.totalRevenue, currency)} sub={`${fmt(data.pendingRevenue, currency)} pending`} icon={<DollarSign className="h-4 w-4 text-green-600" />} />
        <StatCard label="Win Rate" value={pct(data.wonDeals, data.wonDeals + data.lostDeals)} sub={`${data.wonDeals} won / ${data.lostDeals} lost`} icon={<Target className="h-4 w-4 text-orange-500" />} />
        <StatCard label="Active Campaigns" value={data.activeCampaigns} sub={`${data.campLeads} leads`} icon={<BarChart2 className="h-4 w-4 text-pink-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pipeline Funnel */}
        <Section title="Pipeline Funnel">
          {data.funnel.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No stages configured</p>}
          <div className="space-y-3">
            {data.funnel.map(({ stage, count, value }) => (
              <div key={stage.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{stage.name}</span>
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 tabular-nums">{count} · {fmt(value, currency)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bar value={count} max={data.maxFunnelCount} color="bg-blue-500" />
                  <span className="text-xs text-gray-400 w-8 text-right">{pct(count, data.maxFunnelCount)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Conversation Breakdown */}
        <Section title="Conversation Breakdown">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Bot Handled</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{data.botHandled} <span className="text-gray-400">({pct(data.botHandled, data.totalConvs)})</span></span>
              </div>
              <Bar value={data.botHandled} max={data.totalConvs} color="bg-purple-500" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Human Handled</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{data.humanHandled} <span className="text-gray-400">({pct(data.humanHandled, data.totalConvs)})</span></span>
              </div>
              <Bar value={data.humanHandled} max={data.totalConvs} color="bg-green-500" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Currently Open</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{data.openConvs} <span className="text-gray-400">({pct(data.openConvs, data.totalConvs)})</span></span>
              </div>
              <Bar value={data.openConvs} max={data.totalConvs} color="bg-amber-500" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Bot Rules</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{botRules.filter((r) => r.enabled).length}</p>
                <p className="text-xs text-gray-400">active</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">WA Sessions</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{data.onlineSessions}</p>
                <p className="text-xs text-gray-400">online</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Revenue Breakdown */}
        <Section title="Revenue Overview">
          <div className="space-y-3">
            {[
              { label: 'Collected (Links)', value: paymentLinks.filter((l) => l.status === 'paid').reduce((s, l) => s + l.amount, 0), color: 'bg-green-500' },
              { label: 'Collected (Invoices)', value: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0), color: 'bg-emerald-400' },
              { label: 'Active Payment Links', value: paymentLinks.filter((l) => l.status === 'active').reduce((s, l) => s + l.amount, 0), color: 'bg-blue-400' },
              { label: 'Overdue Invoices', value: invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.total, 0), color: 'bg-red-400' },
            ].map(({ label, value, color }) => {
              const total = data.totalRevenue + data.pendingRevenue || 1
              return (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{label}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{fmt(value, currency)}</span>
                  </div>
                  <Bar value={value} max={total} color={color} />
                </div>
              )
            })}
          </div>
        </Section>

        {/* Campaign Performance */}
        <Section title="Campaign Performance">
          {campaigns.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No campaigns created yet</p>}
          <div className="space-y-3">
            {campaigns.slice(0, 6).map((c) => {
              const leads = typeof c.leads === 'number' ? c.leads : 0
              const statusColor = c.active ? 'text-green-500' : 'text-gray-400'
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.name}</p>
                      <span className={`text-xs font-medium ${statusColor} flex-shrink-0 ml-2`}>{c.active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Bar value={leads} max={Math.max(...campaigns.map((x) => typeof x.leads === 'number' ? x.leads : 0), 1)} color="bg-pink-400" />
                      <span className="text-xs text-gray-400 flex-shrink-0 w-10 text-right">{leads} leads</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

      </div>

      {/* Deal Outcome Summary */}
      <Section title="Deal Outcome Summary">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Deals', value: data.totalDeals, color: 'text-blue-600' },
            { label: 'Won', value: data.wonDeals, color: 'text-green-600', sub: fmt(data.wonValue, currency) },
            { label: 'Lost', value: data.lostDeals, color: 'text-red-500' },
            { label: 'Win Rate', value: pct(data.wonDeals, data.wonDeals + data.lostDeals), color: 'text-purple-600' },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>
      </Section>

    </div>
  )
}

