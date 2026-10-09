import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  MessageSquare, Zap, Megaphone, LayoutDashboard, Calendar,
  CreditCard, BookOpen, GitBranch, Smartphone, Users,
  Package, BarChart2, Building2, Check, X,
  ArrowRight, Menu as MenuIcon, ChevronDown,
  MessageCircle, Route, Shield, Clock
} from 'lucide-react'

// ─── Colour tokens (matching the app's CSS variables) ────────────────────────
const C = {
  dark:    '#1e1b4b',   // sidebar / hero bg
  darker:  '#15123a',   // slightly deeper for hero bottom
  accent:  '#6366f1',   // primary indigo
  accentHover: '#4f46e5',
  wa:      '#25D366',   // WhatsApp green (used sparingly)
  light:   '#f8f9fc',
  white:   '#ffffff',
  text:    '#111318',
  muted:   '#6b7280',
  border:  '#e3e4e9',
  success: '#10b981',
}

// ─── Feature data ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Shared Team Inbox',
    desc: 'Every conversation from all your WhatsApp numbers lands in one shared inbox. Assign to agents, add tags, and resolve — nothing falls through the cracks.',
    color: '#6366f1',
  },
  {
    icon: Zap,
    title: 'Auto-Responder',
    desc: 'Set keyword rules for instant replies, then let a trained responder handle everything else — drawing only from your knowledge base, never making things up.',
    color: '#8b5cf6',
  },
  {
    icon: Megaphone,
    title: 'Broadcast Campaigns',
    desc: 'Send personalised bulk messages to contact segments. Schedule delivery, track opens, and follow up with non-openers automatically.',
    color: '#ec4899',
  },
  {
    icon: LayoutDashboard,
    title: 'CRM Pipeline',
    desc: 'Track every deal from first contact to close. Custom stages, deal values, and a visual Kanban board your sales team will actually use.',
    color: '#f59e0b',
  },
  {
    icon: Calendar,
    title: 'Appointment Booking',
    desc: 'Let customers book appointments directly through WhatsApp. Define service types, durations, and pricing. No third-party scheduler needed.',
    color: '#10b981',
  },
  {
    icon: CreditCard,
    title: 'Payments & Invoices',
    desc: 'Generate payment links and professional invoices. Send them over chat and track status from the same dashboard.',
    color: '#3b82f6',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    desc: 'Write articles your auto-responder reads before replying. It quotes prices, explains policies, and describes products accurately — every time.',
    color: '#6366f1',
  },
  {
    icon: GitBranch,
    title: 'Visual Workflow Builder',
    desc: 'Drag-and-drop automation flows. Trigger actions when a tag is added, a message matches a keyword, or a deal stage changes.',
    color: '#8b5cf6',
  },
  {
    icon: Route,
    title: 'Intent Routing',
    desc: "Detect what a customer needs from their first message and route them to the right team automatically. Sales to sales, support to support.",
    color: '#ec4899',
  },
  {
    icon: Smartphone,
    title: 'Multi-Number Support',
    desc: 'Connect multiple WhatsApp numbers under one account. Separate brands, regions, or teams while managing everything from a single login.',
    color: '#f59e0b',
  },
  {
    icon: Package,
    title: 'Product Catalog',
    desc: 'Add your full product list with prices, variants, and stock. Your auto-responder quotes exact figures from this data — never invents numbers.',
    color: '#10b981',
  },
  {
    icon: BarChart2,
    title: 'Analytics & Reporting',
    desc: 'Response times, resolution rates, bot vs human ratios, and per-agent performance. The numbers your operations team needs to improve.',
    color: '#3b82f6',
  },
  {
    icon: Users,
    title: 'Team Management',
    desc: 'Invite agents, define roles, track who replied to what. Full accountability with conversation assignment and audit trail.',
    color: '#6366f1',
  },
  {
    icon: MessageCircle,
    title: 'Canned Responses',
    desc: 'Shortcut common replies with a / command. Agents type faster, stay consistent, and stop rewriting the same answers 40 times a day.',
    color: '#8b5cf6',
  },
  {
    icon: Building2,
    title: 'Multi-Workspace',
    desc: 'Run multiple client accounts or business units from one admin panel. Each workspace is fully isolated with its own sessions, contacts, and team.',
    color: '#ec4899',
  },
]

// ─── Comparison data ─────────────────────────────────────────────────────────
const COMPARE_FEATURES = [
  'Shared WhatsApp inbox',
  'Auto-responder with rules',
  'CRM pipeline',
  'Appointment booking',
  'Payments & invoices',
  'Visual workflow builder',
  'Knowledge base',
  'Product catalog',
  'Multi-number support',
  'Multi-workspace / clients',
  'Broadcast campaigns',
  'Analytics dashboard',
]

const COMPARE_DATA: Record<string, (boolean | string)[]> = {
  'WhatsApp Portal': [true, true, true, true, true, true, true, true, true, true, true, true],
  'GoHighLevel ($297/mo)': [false, 'Limited', true, true, true, true, 'Add-on', false, false, '$297+', true, true],
  'Basic WA CRM ($99/mo)': [true, 'Rules only', false, false, false, false, false, false, 'Extra', false, true, 'Basic'],
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{ background: C.dark, borderBottom: `1px solid rgba(255,255,255,0.07)` }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <a href="#hero" className="flex items-center gap-2.5 shrink-0 cursor-pointer">
          <div
            className="size-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: C.accent }}
          >
            W
          </div>
          <span className="font-semibold text-white text-[15px] tracking-tight">
            WhatsApp Portal
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {[['#features', 'Features'], ['#comparison', 'Compare'], ['#get-started', 'Pricing']].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.65)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="h-9 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.18)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/login')}
            className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition-all cursor-pointer"
            style={{ background: C.accent }}
            onMouseEnter={e => { e.currentTarget.style.background = C.accentHover }}
            onMouseLeave={e => { e.currentTarget.style.background = C.accent }}
          >
            Get access
          </button>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-white p-1 cursor-pointer"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden px-4 pb-4 flex flex-col gap-3"
          style={{ background: C.dark }}
        >
          {[['#features', 'Features'], ['#comparison', 'Compare']].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium py-2"
              style={{ color: 'rgba(255,255,255,0.75)' }}
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
          <button
            onClick={() => navigate('/login')}
            className="mt-1 h-10 rounded-lg text-sm font-semibold text-white cursor-pointer"
            style={{ background: C.accent }}
          >
            Sign in
          </button>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  const navigate = useNavigate()

  return (
    <section
      id="hero"
      className="relative overflow-hidden"
      style={{ background: C.dark }}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-8 text-xs font-semibold tracking-wide"
          style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
          <span
            className="size-1.5 rounded-full"
            style={{ background: C.wa }}
          />
          WhatsApp Business Platform
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight max-w-4xl mx-auto">
          The complete WhatsApp platform{' '}
          <span style={{ color: '#a5b4fc' }}>your team will actually use</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Shared inbox, auto-responder, CRM pipeline, broadcast campaigns, payments,
          and appointment booking — in one platform, connected to your WhatsApp numbers.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl text-white font-semibold text-sm cursor-pointer transition-all"
            style={{ background: C.accent }}
            onMouseEnter={e => { e.currentTarget.style.background = C.accentHover; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Get started
            <ArrowRight className="size-4" />
          </button>
          <a
            href="#features"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl font-semibold text-sm transition-all cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            See all features
            <ChevronDown className="size-4" />
          </a>
        </div>

        {/* Stats strip */}
        <div className="mt-16 pt-10 border-t flex flex-wrap justify-center gap-8 md:gap-16"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {[
            ['15+', 'Built-in features'],
            ['Multi-number', 'WhatsApp support'],
            ['Real-time', 'Team inbox'],
            ['No monthly', 'per-seat fees'],
          ].map(([val, label]) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold text-white">{val}</div>
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Value banner ────────────────────────────────────────────────────────────
function ValueBanner() {
  return (
    <section
      className="py-5"
      style={{ background: C.accent }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center">
        {[
          'Shared inbox built for teams',
          'CRM pipeline included',
          'Payments & invoicing out of the box',
          'No per-feature pricing',
        ].map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm font-medium text-white">
            <Check className="size-4 shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Features grid ───────────────────────────────────────────────────────────
function FeaturesGrid() {
  return (
    <section id="features" className="py-20 md:py-28" style={{ background: C.light }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Heading */}
        <div className="max-w-2xl mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: C.accent }}>
            Full feature set
          </p>
          <h2 className="text-3xl md:text-4xl font-bold leading-tight" style={{ color: C.text }}>
            Everything your team needs to run sales and support on WhatsApp
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: C.muted }}>
            GoHighLevel charges $297/month for a subset of what's here. Most dedicated WhatsApp CRMs
            charge $99–200/month and don't include a pipeline, booking, or payments. This covers it all.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="group rounded-2xl p-6 transition-all duration-200 cursor-default"
              style={{ background: C.white, border: `1px solid ${C.border}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 24px rgba(0,0,0,0.06)` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div
                className="size-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${color}15` }}
              >
                <Icon className="size-5" style={{ color }} />
              </div>
              <h3 className="font-semibold text-[15px] mb-1.5" style={{ color: C.text }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Deep-dive sections ───────────────────────────────────────────────────────
function DeepDive({
  tag, headline, body, points, reverse = false, accent,
  visual,
}: {
  tag: string
  headline: string
  body: string
  points: string[]
  reverse?: boolean
  accent: string
  visual: React.ReactNode
}) {
  return (
    <section className="py-16 md:py-24" style={{ background: C.white }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 md:gap-16`}>
          {/* Text */}
          <div className="flex-1">
            <span
              className="inline-block text-xs font-bold uppercase tracking-widest rounded-full px-3 py-1 mb-5"
              style={{ background: `${accent}12`, color: accent }}
            >
              {tag}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold leading-snug mb-4" style={{ color: C.text }}>
              {headline}
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: C.muted }}>{body}</p>
            <ul className="space-y-2.5">
              {points.map(p => (
                <li key={p} className="flex items-start gap-3 text-sm" style={{ color: C.text }}>
                  <span
                    className="mt-0.5 size-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `${accent}15` }}
                  >
                    <Check className="size-3" style={{ color: accent }} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          {/* Visual */}
          <div className="flex-1 w-full">{visual}</div>
        </div>
      </div>
    </section>
  )
}

// Mock "dashboard screenshot" visuals (clean placeholder cards that look intentional)
function InboxVisual() {
  const convs = [
    { name: 'Ahmed Al Rashidi', msg: 'Do you offer same-day delivery?', time: '2m', tag: 'Support', tagC: '#3b82f6', dot: '#22c55e' },
    { name: 'Fatima Hassan', msg: 'I need the invoice for order #1042', time: '15m', tag: 'Billing', tagC: '#f59e0b', dot: '#22c55e' },
    { name: 'Sara Malik', msg: 'What are your working hours?', time: '32m', tag: 'New Lead', tagC: '#10b981', dot: '#e5e7eb' },
  ]
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border" style={{ borderColor: C.border }}>
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: C.dark, borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="size-3 rounded-full bg-red-500/60" />
        <div className="size-3 rounded-full bg-yellow-500/60" />
        <div className="size-3 rounded-full bg-green-500/60" />
        <span className="ml-2 text-xs text-white/40">Shared Inbox — OviTech</span>
      </div>
      {/* Conversations */}
      <div style={{ background: C.white }}>
        {convs.map((c, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 px-4 py-3.5 border-b ${i === 0 ? 'border-l-2' : ''}`}
            style={{
              borderColor: i === 0 ? C.accent : C.border,
              background: i === 0 ? `${C.accent}06` : undefined,
            }}
          >
            <div
              className="size-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
              style={{ background: ['#6366f1', '#8b5cf6', '#ec4899'][i] }}
            >
              {c.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="font-semibold text-sm truncate" style={{ color: C.text }}>{c.name}</span>
                <span className="text-xs shrink-0" style={{ color: C.muted }}>{c.time}</span>
              </div>
              <p className="text-xs truncate" style={{ color: C.muted }}>{c.msg}</p>
              <span className="inline-block mt-1.5 text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: `${c.tagC}15`, color: c.tagC }}>{c.tag}</span>
            </div>
            <span className="size-2 rounded-full mt-1.5 shrink-0" style={{ background: c.dot }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PipelineVisual() {
  const stages = [
    { name: 'New Lead', count: 8, color: '#3b82f6', deals: ['Ahmed — $2,400', 'Sara — $1,800'] },
    { name: 'Proposal', count: 5, color: '#8b5cf6', deals: ['Ravi — $5,200'] },
    { name: 'Won', count: 3, color: '#10b981', deals: ['Bilal — $3,900', 'Noor — $7,100'] },
  ]
  return (
    <div className="rounded-2xl overflow-hidden border shadow-lg" style={{ borderColor: C.border }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ background: C.light, borderColor: C.border }}>
        <span className="text-sm font-semibold" style={{ color: C.text }}>Sales Pipeline</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${C.accent}12`, color: C.accent }}>16 open deals</span>
      </div>
      <div className="flex gap-3 p-4 overflow-x-auto" style={{ background: C.white }}>
        {stages.map(s => (
          <div key={s.name} className="shrink-0 w-44">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: C.text }}>{s.name}</span>
              <span className="text-[10px] rounded-full px-1.5 py-0.5 font-bold" style={{ background: `${s.color}15`, color: s.color }}>{s.count}</span>
            </div>
            <div className="space-y-1.5">
              {s.deals.map(d => (
                <div key={d} className="rounded-lg px-2.5 py-2 text-xs" style={{ background: C.light, border: `1px solid ${C.border}` }}>
                  <div className="font-medium" style={{ color: C.text }}>{d.split('—')[0].trim()}</div>
                  <div style={{ color: s.color }}>{d.split('—')[1]?.trim()}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AutoResponderVisual() {
  const rules = [
    { match: 'price, cost, how much', reply: 'Shares pricing from product catalog', on: true, color: '#6366f1' },
    { match: 'delivery, shipping', reply: 'Answers from knowledge base article', on: true, color: '#8b5cf6' },
    { match: 'human, agent, cs', reply: 'Transfers to team member', on: true, color: '#f59e0b' },
  ]
  return (
    <div className="rounded-2xl overflow-hidden border shadow-lg" style={{ borderColor: C.border }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ background: C.light, borderColor: C.border }}>
        <span className="text-sm font-semibold" style={{ color: C.text }}>Auto-Responder Rules</span>
        <span className="text-xs font-medium" style={{ color: C.success }}>● Active</span>
      </div>
      <div style={{ background: C.white }}>
        {rules.map((r, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5 border-b last:border-b-0" style={{ borderColor: C.border }}>
            <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${r.color}12` }}>
              <Zap className="size-3.5" style={{ color: r.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium mb-0.5" style={{ color: C.muted }}>Trigger keywords</p>
              <p className="text-xs font-semibold mb-1" style={{ color: C.text }}>{r.match}</p>
              <p className="text-[11px]" style={{ color: C.muted }}>{r.reply}</p>
            </div>
            <div className="shrink-0 mt-1">
              <div className="w-8 h-4 rounded-full flex items-center" style={{ background: r.on ? C.accent : C.border }}>
                <div className="size-3 rounded-full bg-white ml-auto mr-0.5 shadow" />
              </div>
            </div>
          </div>
        ))}
        <div className="px-4 py-3 text-xs rounded-b-2xl" style={{ background: `${C.accent}06`, color: C.muted }}>
          + Anything not matched by a rule is handled by your trained responder
        </div>
      </div>
    </div>
  )
}

// ─── Comparison table ────────────────────────────────────────────────────────
function ComparisonTable() {
  const cols = Object.keys(COMPARE_DATA)
  return (
    <section id="comparison" className="py-20 md:py-28" style={{ background: C.light }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: C.accent }}>
            How it stacks up
          </p>
          <h2 className="text-3xl md:text-4xl font-bold" style={{ color: C.text }}>
            More features than GoHighLevel — built for WhatsApp from day one
          </h2>
        </div>

        <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ borderColor: C.border }}>
          {/* Header */}
          <div className="grid border-b" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr', borderColor: C.border }}>
            <div className="px-5 py-4" style={{ background: C.white }} />
            {cols.map((col, i) => (
              <div
                key={col}
                className="px-4 py-4 text-center"
                style={{ background: i === 0 ? C.dark : C.white }}
              >
                <p className={`font-bold text-sm ${i === 0 ? 'text-white' : ''}`} style={{ color: i > 0 ? C.text : undefined }}>
                  {col.split(' (')[0]}
                </p>
                {col.includes('(') && (
                  <p className="text-xs mt-0.5" style={{ color: i === 0 ? 'rgba(255,255,255,0.5)' : C.muted }}>
                    {col.match(/\(([^)]+)\)/)?.[1]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Rows */}
          {COMPARE_FEATURES.map((feat, fi) => (
            <div
              key={feat}
              className="grid border-b last:border-b-0"
              style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr', borderColor: C.border, background: fi % 2 === 0 ? C.white : C.light }}
            >
              <div className="px-5 py-3 text-sm font-medium" style={{ color: C.text }}>{feat}</div>
              {cols.map((col, ci) => {
                const val = COMPARE_DATA[col][fi]
                return (
                  <div key={col} className="px-4 py-3 flex items-center justify-center">
                    {val === true ? (
                      <Check className="size-5" style={{ color: ci === 0 ? C.accent : C.success }} />
                    ) : val === false ? (
                      <X className="size-4" style={{ color: '#ef4444' }} />
                    ) : (
                      <span className="text-xs font-medium text-center" style={{ color: C.muted }}>{val}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  const navigate = useNavigate()
  return (
    <section id="get-started" className="py-20 md:py-28" style={{ background: C.dark }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <div
          className="size-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-6"
          style={{ background: C.accent }}
        >
          W
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to run your entire WhatsApp operation from one place?
        </h2>
        <p className="text-base mb-10 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Set up your workspace, connect your WhatsApp number, and have your team in the inbox within the hour.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-10 rounded-xl text-white font-semibold text-sm cursor-pointer transition-all"
            style={{ background: C.accent }}
            onMouseEnter={e => { e.currentTarget.style.background = C.accentHover }}
            onMouseLeave={e => { e.currentTarget.style.background = C.accent }}
          >
            Get started
            <ArrowRight className="size-4" />
          </button>
        </div>

        {/* Trust badges */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
          {[
            [Shield, 'Data stays on your server'],
            [Clock, 'Set up in under an hour'],
            [Users, 'Unlimited team members'],
          ].map(([Icon, label]) => (
            <div key={label as string} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <Icon className="size-4" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  const navigate = useNavigate()
  return (
    <footer className="border-t" style={{ background: C.white, borderColor: C.border }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: C.accent }}>W</div>
          <span className="font-semibold text-sm" style={{ color: C.text }}>WhatsApp Portal</span>
        </div>
        <p className="text-xs" style={{ color: C.muted }}>
          Built for teams that run their business on WhatsApp.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="text-sm font-semibold cursor-pointer transition-colors"
          style={{ color: C.accent }}
          onMouseEnter={e => { e.currentTarget.style.color = C.accentHover }}
          onMouseLeave={e => { e.currentTarget.style.color = C.accent }}
        >
          Sign in →
        </button>
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="min-h-screen" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Navbar />
      <Hero />
      <ValueBanner />
      <FeaturesGrid />

      {/* Deep-dive: Inbox */}
      <DeepDive
        tag="Team inbox"
        headline="One inbox for your whole team, every WhatsApp number"
        body="Stop juggling personal phones. Connect all your WhatsApp numbers to one shared inbox where agents pick up conversations, collaborate on replies, and nothing gets missed."
        points={[
          'Assign conversations to specific agents or leave them in the shared queue',
          'Tag conversations (VIP, Billing, Support) to filter and prioritise',
          'See who is currently viewing or replying to avoid duplicate responses',
          'Real-time updates — every team member sees new messages instantly',
        ]}
        accent={C.accent}
        visual={<InboxVisual />}
      />

      {/* Deep-dive: Auto-Responder */}
      <DeepDive
        tag="Auto-responder"
        headline="Keyword rules first, then a trained responder for everything else"
        body="Define rules for your most common questions — pricing, delivery, hours. Anything that doesn't match a rule goes to a responder trained on your knowledge base and product catalog."
        points={[
          'Rules run first: instant, predictable, zero cost',
          'Fallback responder reads your knowledge base articles before replying',
          'Quotes exact prices from your product catalog — never invents numbers',
          'Transfers to a human agent after 3 consecutive failures, not the first',
        ]}
        accent="#8b5cf6"
        reverse
        visual={<AutoResponderVisual />}
      />

      {/* Deep-dive: Pipeline + Payments */}
      <DeepDive
        tag="CRM & payments"
        headline="Track deals and collect payments without leaving the platform"
        body="Your sales pipeline sits right next to your inbox. When a deal closes, generate an invoice or payment link and send it in the same conversation — all from one place."
        points={[
          'Custom pipeline stages that match your actual sales process',
          'Deal values, stage durations, and win/loss tracking',
          'Generate and send payment links directly in any conversation',
          'Appointment booking for services — customers book without leaving WhatsApp',
        ]}
        accent="#10b981"
        visual={<PipelineVisual />}
      />

      <ComparisonTable />
      <FinalCTA />
      <Footer />
    </div>
  )
}
