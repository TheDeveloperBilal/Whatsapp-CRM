// Digital Nova Tech — WhatsApp Portal marketing site
// Design: Space Grotesk (headings) + Inter (body) | Ink / Emerald / Amber palette

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
  Menu, X, Check, ChevronDown, ArrowRight,
  MessageSquare, Zap, Megaphone, LayoutDashboard,
  Calendar, CreditCard, BookOpen, GitBranch,
  Route, Smartphone, Package, BarChart2,
  Users, MessageCircle, Building2, Shield, Clock, Server
} from 'lucide-react'

// ── Design tokens ────────────────────────────────────────────────────────────
const T = {
  ink:     '#0B1120',
  ink2:    '#141A2E',
  ink3:    '#1D2640',
  surf:    '#FAFAF8',
  surf2:   '#F0EFEC',
  white:   '#FFFFFF',
  em:      '#0C9A68',          // refined emerald (NOT WhatsApp #25D366)
  emBg:    'rgba(12,154,104,0.09)',
  emRing:  'rgba(12,154,104,0.22)',
  amber:   '#B87B20',
  amberBg: 'rgba(184,123,32,0.10)',
  t1:      '#0B1120',          // primary text
  t2:      '#3C485E',          // secondary
  t3:      '#7E8FA5',          // muted
  bd:      'rgba(255,255,255,0.08)',   // border on dark bg
  bl:      'rgba(11,17,32,0.08)',     // border on light bg
}

// ── Inject global animations once ────────────────────────────────────────────
const CSS_ANIMATIONS = `
  @keyframes marquee { from { transform:translateX(0) } to { transform:translateX(-50%) } }
  @keyframes floatA  { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
  @keyframes floatB  { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-6px)} }
  @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  .sg { font-family: 'Space Grotesk', system-ui, sans-serif; }
  .inter { font-family: 'Inter', system-ui, sans-serif; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
`

// ── Hooks ────────────────────────────────────────────────────────────────────
function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(true); return }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setV(true), delay); obs.disconnect() }
    }, { threshold: 0.08 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])
  const style = { opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(20px)', transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }
  return [ref, style] as const
}

function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [threshold])
  return scrolled
}

function useCounter(target: number, duration = 1800) {
  const [val, setVal] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect() } }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  useEffect(() => {
    if (!started) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(target); return }
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [started, target, duration])
  return [ref, val] as const
}

function useParallax() {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const fn = (e: MouseEvent) => {
      setPos({ x: (e.clientX / window.innerWidth - 0.5) * 14, y: (e.clientY / window.innerHeight - 0.5) * 8 })
    }
    window.addEventListener('mousemove', fn, { passive: true })
    return () => window.removeEventListener('mousemove', fn)
  }, [])
  return pos
}

// ── Brand wordmark ────────────────────────────────────────────────────────────
function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={T.em} />
        <path d="M8 22V12a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-6l-4 2v-2h-2z" fill="white" fillOpacity=".15" />
        <path d="M10 21.5V12a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-5l-4 2v-3z" fill="white" />
        <circle cx="14" cy="15" r="1.2" fill={T.em} />
        <circle cx="18" cy="15" r="1.2" fill={T.em} />
      </svg>
      <div>
        <div className="sg font-semibold leading-none text-[15px]" style={{ color: dark ? T.white : T.ink }}>
          Digital Nova Tech
        </div>
        <div className="inter text-[10px] leading-none mt-0.5 font-medium tracking-wide" style={{ color: dark ? 'rgba(255,255,255,0.45)' : T.t3 }}>
          WhatsApp Portal
        </div>
      </div>
    </div>
  )
}

// ── Sticky nav ────────────────────────────────────────────────────────────────
function Nav() {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const scrolled = useScrolled()

  const links = [
    ['#features', 'Features'],
    ['#comparison', 'Compare'],
    ['#pricing', 'Pricing'],
    ['#faq', 'FAQ'],
  ]

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: scrolled ? 'rgba(11,17,32,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? `1px solid ${T.bd}` : '1px solid transparent',
        transition: 'background 0.3s ease, backdrop-filter 0.3s ease, border-color 0.3s ease',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: scrolled ? 60 : 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'height 0.3s ease' }}>
        <Brand dark />

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="inter text-sm font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            >{label}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => nav('/login')} className="inter text-sm font-medium cursor-pointer transition-colors"
            style={{ color: 'rgba(255,255,255,0.65)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
          >Sign in</button>
          <button onClick={() => nav('/login')}
            className="inter inline-flex items-center gap-1.5 h-9 px-5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all"
            style={{ background: T.em }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
          >
            Get access <ArrowRight className="size-3.5" />
          </button>
        </div>

        {/* Mobile toggle */}
        <button aria-label="Toggle menu" className="md:hidden text-white cursor-pointer p-1" onClick={() => setOpen(o => !o)}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{ background: T.ink2, borderTop: `1px solid ${T.bd}`, padding: '16px 24px 20px' }}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}
              className="inter block py-2.5 text-sm font-medium"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >{label}</a>
          ))}
          <button onClick={() => nav('/login')}
            className="inter mt-3 w-full h-11 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ background: T.em }}
          >Get access</button>
        </div>
      )}
    </nav>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function DashboardMockup({ x, y }: { x: number; y: number }) {
  const conversations = [
    { name: 'Ahmed Al-Rashidi', preview: 'Can I get a quote for 50 units?', time: '2m', unread: 2, color: '#0C9A68' },
    { name: 'Sara Malik', preview: 'When does my order ship?', time: '14m', unread: 0, color: '#6366f1' },
    { name: 'Bilal Enterprises', preview: 'I need the invoice for order…', time: '1h', unread: 1, color: '#f59e0b' },
    { name: 'Noor Digital', preview: 'Thanks for the quick response', time: '3h', unread: 0, color: '#ec4899' },
  ]
  return (
    <div style={{
      transform: `perspective(1200px) rotateY(${x * 0.25}deg) rotateX(${-y * 0.15}deg)`,
      transition: 'transform 0.1s ease-out',
      position: 'relative',
    }}>
      {/* Floating chips */}
      <div style={{ position: 'absolute', top: -14, right: 24, animation: 'floatA 3.5s ease-in-out infinite', zIndex: 10 }}>
        <div className="inter flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg"
          style={{ background: T.white, color: T.em, border: `1px solid ${T.emRing}` }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: T.em, animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
          Bot handled 89%
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 40, left: -16, animation: 'floatB 4s ease-in-out infinite 1s', zIndex: 10 }}>
        <div className="inter flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg"
          style={{ background: T.white, color: T.amber, border: `1px solid rgba(184,123,32,0.3)` }}>
          3 pending handoffs
        </div>
      </div>

      {/* Main frame */}
      <div style={{
        width: '100%', maxWidth: 540,
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid rgba(255,255,255,0.12)`,
        boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
        background: T.ink3,
      }}>
        {/* Chrome bar */}
        <div style={{ height: 36, background: T.ink2, borderBottom: `1px solid ${T.bd}`, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
          <span className="inter text-[11px] ml-3" style={{ color: 'rgba(255,255,255,0.3)' }}>digitalnovatech.com/inbox</span>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', height: 300 }}>
          {/* Left panel: chat list */}
          <div style={{ width: 180, borderRight: `1px solid ${T.bd}`, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.bd}` }}>
              <div className="inter text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.t3 }}>Conversations</div>
            </div>
            {conversations.map((c, i) => (
              <div key={i} style={{
                padding: '9px 12px', borderBottom: `1px solid ${T.bd}`,
                background: i === 0 ? 'rgba(12,154,104,0.08)' : 'transparent',
                borderLeft: i === 0 ? `2px solid ${T.em}` : '2px solid transparent',
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span className="inter text-[11px] font-semibold" style={{ color: i === 0 ? T.white : 'rgba(255,255,255,0.7)' }}>{c.name.split(' ')[0]}</span>
                  <span className="inter text-[10px]" style={{ color: T.t3 }}>{c.time}</span>
                </div>
                <div className="inter text-[10px] truncate" style={{ color: T.t3 }}>{c.preview}</div>
                {c.unread > 0 && (
                  <div style={{ marginTop: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: T.em }}>
                    <span className="inter text-[8px] font-bold text-white">{c.unread}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right panel: conversation thread */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.bd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="inter text-[12px] font-semibold" style={{ color: T.white }}>Ahmed Al-Rashidi</span>
              <span className="inter text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: T.emBg, color: T.em }}>AI on</span>
            </div>
            <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'hidden' }}>
              {/* Incoming */}
              <div style={{ alignSelf: 'flex-start', maxWidth: '80%', background: 'rgba(255,255,255,0.06)', borderRadius: '12px 12px 12px 4px', padding: '8px 11px' }}>
                <p className="inter text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>Can I get a quote for 50 units of the Pro plan?</p>
              </div>
              {/* Outgoing AI */}
              <div style={{ alignSelf: 'flex-end', maxWidth: '82%', background: T.emBg, border: `1px solid ${T.emRing}`, borderRadius: '12px 12px 4px 12px', padding: '8px 11px' }}>
                <p className="inter text-[11px]" style={{ color: 'rgba(255,255,255,0.9)' }}>50 units of Pro is <strong>$2,800</strong> — includes setup and 30-day support. Want me to send an invoice?</p>
                <div className="inter text-[9px] mt-1" style={{ color: T.em }}>via Auto-Responder · read</div>
              </div>
              {/* Incoming */}
              <div style={{ alignSelf: 'flex-start', maxWidth: '60%', background: 'rgba(255,255,255,0.06)', borderRadius: '12px 12px 12px 4px', padding: '8px 11px' }}>
                <p className="inter text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>Yes, send it over</p>
              </div>
              {/* Outgoing AI */}
              <div style={{ alignSelf: 'flex-end', maxWidth: '80%', background: T.emBg, border: `1px solid ${T.emRing}`, borderRadius: '12px 12px 4px 12px', padding: '8px 11px' }}>
                <p className="inter text-[11px]" style={{ color: 'rgba(255,255,255,0.9)' }}>Invoice sent! Payment link: pay.dnt.co/inv-4821 — valid 72hrs.</p>
                <div className="inter text-[9px] mt-1" style={{ color: T.em }}>via Auto-Responder · delivered</div>
              </div>
            </div>
            {/* Reply bar */}
            <div style={{ borderTop: `1px solid ${T.bd}`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                <span className="inter text-[10px]" style={{ color: T.t3 }}>AI is ON — reply to take over...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  const nav = useNavigate()
  const { x, y } = useParallax()

  return (
    <section style={{ background: T.ink, position: 'relative', overflow: 'hidden' }}>
      {/* Subtle dot grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
      {/* Emerald glow */}
      <div style={{ position: 'absolute', top: '20%', right: '10%', width: 400, height: 400, background: `radial-gradient(circle, ${T.emBg} 0%, transparent 65%)`, pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 100px' }}>
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-10">
          {/* Left: copy */}
          <div style={{ flex: 1, maxWidth: 560 }}>
            {/* Eyebrow */}
            <div className="inter inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6 text-[11px] font-semibold tracking-widest uppercase"
              style={{ background: T.emBg, color: T.em, border: `1px solid ${T.emRing}` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.em, display: 'inline-block', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
              All-in-one WhatsApp CRM
            </div>

            <h1 className="sg font-bold leading-tight" style={{ fontSize: 'clamp(36px, 5vw, 60px)', color: T.white, letterSpacing: '-0.02em' }}>
              One platform.<br />
              <span style={{ color: T.em }}>Every WhatsApp</span>{' '}
              conversation.
            </h1>

            <p className="inter mt-5 leading-relaxed" style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', maxWidth: 440 }}>
              Inbox, auto-responder, CRM, campaigns, payments, booking — 15 features in a single self-hosted platform. GoHighLevel charges $297/month for half of this.
            </p>

            <div style={{ marginTop: 36, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button onClick={() => nav('/login')}
                className="inter inline-flex items-center gap-2 h-12 px-7 rounded-xl text-white font-semibold cursor-pointer transition-all text-sm"
                style={{ background: T.em }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
              >
                Get started <ArrowRight className="size-4" />
              </button>
              <a href="#features"
                className="inter inline-flex items-center gap-2 h-12 px-7 rounded-xl font-medium cursor-pointer transition-all text-sm"
                style={{ color: 'rgba(255,255,255,0.7)', border: `1px solid ${T.bd}` }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                See all features <ChevronDown className="size-4" />
              </a>
            </div>

            {/* Trust badges */}
            <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {[[Server, 'Self-hosted'], [Shield, 'Your data, your server'], [Clock, 'Live in under an hour']].map(([Icon, label]) => (
                <div key={label as string} className="inter flex items-center gap-1.5 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  <Icon className="size-3.5" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: animated dashboard */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', width: '100%', maxWidth: 560 }}>
            <DashboardMockup x={x} y={y} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Stats strip ───────────────────────────────────────────────────────────────
function StatsStrip() {
  const [r1, v1] = useReveal(0)
  const [cRef1, n1] = useCounter(15)
  const [cRef2, n2] = useCounter(89)
  const [cRef3, n3] = useCounter(297)

  return (
    <section style={{ background: T.em, padding: '20px 0' }}>
      <div ref={r1} style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '24px 48px', ...v1 }}>
        {[
          [cRef1, n1, '', '+', 'Built-in features'],
          [cRef2, n2, '', '%', 'Avg bot-handled chats'],
          [cRef3, n3, '$', '/mo', 'GoHighLevel costs'],
        ].map(([cRef, n, prefix, suffix, label], i) => (
          <div key={i} className="text-center">
            <div className="sg text-2xl font-bold text-white">
              {prefix}<span ref={cRef as React.RefObject<HTMLSpanElement>}>{n as number}</span>{suffix}
            </div>
            <div className="inter text-xs font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>{label as string}</div>
          </div>
        ))}
        <div className="text-center">
          <div className="sg text-2xl font-bold text-white">&lt; 1 hr</div>
          <div className="inter text-xs font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Setup time</div>
        </div>
        <div className="text-center">
          <div className="sg text-2xl font-bold text-white">Unlimited</div>
          <div className="inter text-xs font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Team seats</div>
        </div>
      </div>
    </section>
  )
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: MessageSquare, title: 'Shared Team Inbox', line: 'Every channel, every agent — one shared queue that never drops a message.' },
  { icon: Zap,           title: 'Auto-Responder',     line: 'Keyword rules run first. Trained fallback handles the rest. No hallucinations.' },
  { icon: Megaphone,     title: 'Broadcast Campaigns', line: 'Send targeted bulk messages with per-contact personalisation and delivery tracking.' },
  { icon: LayoutDashboard, title: 'CRM Pipeline',    line: 'Kanban deal board from first contact to closed — with stage durations and deal values.' },
  { icon: Calendar,      title: 'Appointment Booking', line: 'Customers book via WhatsApp. No third-party scheduler, no extra cost.' },
  { icon: CreditCard,    title: 'Payments & Invoices', line: 'Generate payment links and invoices and send them directly in the conversation.' },
  { icon: BookOpen,      title: 'Knowledge Base',     line: 'Your auto-responder reads your articles before replying — accurate, every time.' },
  { icon: GitBranch,     title: 'Workflow Automation', line: 'Trigger actions on message events, tag changes, or pipeline stage moves.' },
  { icon: Route,         title: 'Intent Routing',     line: 'Detect customer intent on first message and route to the right team automatically.' },
  { icon: Smartphone,    title: 'Multi-Number Support', line: 'Multiple WhatsApp numbers per workspace. One login, full visibility.' },
  { icon: Package,       title: 'Product Catalog',    line: 'Prices and stock the responder quotes with precision — never invented numbers.' },
  { icon: BarChart2,     title: 'Analytics',          line: 'Response times, resolution rates, agent performance. Numbers that drive decisions.' },
  { icon: Users,         title: 'Team Management',    line: 'Roles, assignments, and conversation ownership. Full accountability.' },
  { icon: MessageCircle, title: 'Canned Responses',   line: 'Type / to shortcut common replies. Consistent tone, faster agents.' },
  { icon: Building2,     title: 'Multi-Workspace',    line: 'Separate workspaces per brand or client — isolated data, one admin panel.' },
]

const FEAT_COLORS = ['#0C9A68','#6366f1','#f59e0b','#ec4899','#3b82f6','#14b8a6',
  '#8b5cf6','#0C9A68','#f59e0b','#6366f1','#ec4899','#3b82f6','#14b8a6','#8b5cf6','#0C9A68']

function FeatureCard({ icon: Icon, title, line, color, delay }: { icon: React.ElementType; title: string; line: string; color: string; delay: number }) {
  const [ref, vis] = useReveal(delay)
  return (
    <div ref={ref} style={{
      ...vis, background: T.white, borderRadius: 16, padding: '22px 24px',
      border: `1px solid ${T.bl}`, transition: `${vis.transition}, border-color 0.2s, box-shadow 0.2s`,
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 24px rgba(0,0,0,0.06)` }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.bl; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon style={{ width: 18, height: 18, color }} />
      </div>
      <h3 className="sg font-semibold text-[15px] mb-1.5" style={{ color: T.t1 }}>{title}</h3>
      <p className="inter text-sm leading-relaxed" style={{ color: T.t2 }}>{line}</p>
    </div>
  )
}

function FeaturesSection() {
  const [r, v] = useReveal()
  return (
    <section id="features" style={{ background: T.surf, padding: '96px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div ref={r} style={{ ...v, maxWidth: 640, marginBottom: 64 }}>
          <p className="inter text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.em }}>Platform capabilities</p>
          <h2 className="sg font-bold leading-tight" style={{ fontSize: 'clamp(28px, 4vw, 42px)', color: T.t1, letterSpacing: '-0.02em' }}>
            15 features. One platform.<br />No per-feature pricing.
          </h2>
          <p className="inter mt-4 leading-relaxed text-base" style={{ color: T.t2 }}>
            GoHighLevel charges $297/month and still doesn't cover WhatsApp natively. Generic WhatsApp CRMs at $99–200/month skip the CRM, payments, and booking entirely. This covers everything.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {FEATURES.map(({ icon: Icon, title, line }, i) => (
            <FeatureCard key={title} icon={Icon} title={title} line={line} color={FEAT_COLORS[i]} delay={i * 40} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Deep dives ────────────────────────────────────────────────────────────────
function DeepDive({ id, tag, h2, body, points, accent, reverse, visual }: {
  id?: string; tag: string; h2: string; body: string; points: string[]
  accent: string; reverse?: boolean; visual: React.ReactNode
}) {
  const [r, v] = useReveal()
  return (
    <section id={id} style={{ background: T.white, padding: '96px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div ref={r} style={{ ...v, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}
          className={`lg:flex-row ${reverse ? 'lg:flex-row-reverse' : ''}`}
        >
          <div style={{ flex: 1, maxWidth: 500 }}>
            <span className="inter inline-block text-[11px] font-bold uppercase tracking-widest rounded-full px-3.5 py-1.5 mb-5"
              style={{ background: `${accent}12`, color: accent }}>
              {tag}
            </span>
            <h2 className="sg font-bold leading-tight mb-4" style={{ fontSize: 'clamp(24px,3.5vw,36px)', color: T.t1, letterSpacing: '-0.02em' }}>
              {h2}
            </h2>
            <p className="inter text-base leading-relaxed mb-6" style={{ color: T.t2 }}>{body}</p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {points.map(p => (
                <li key={p} className="inter flex items-start gap-3 text-sm" style={{ color: T.t1 }}>
                  <span style={{ flexShrink: 0, marginTop: 2, width: 18, height: 18, borderRadius: '50%', background: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check style={{ width: 10, height: 10, color: accent }} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ flex: 1, width: '100%', maxWidth: 520 }}>{visual}</div>
        </div>
      </div>
    </section>
  )
}

function InboxVisual() {
  const rows = [
    { name: 'Ahmed Al-Rashidi', msg: 'Can I get a quote for 50 units?', tag: 'Sales',   tagC: T.em,    unread: 2 },
    { name: 'Sara Malik',       msg: 'When does my order ship?',         tag: 'Support', tagC: '#6366f1', unread: 0 },
    { name: 'Bilal Enterprises',msg: 'I need the invoice for order 1042',tag: 'Billing', tagC: T.amber,   unread: 1 },
  ]
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.bl}`, boxShadow: '0 8px 40px rgba(0,0,0,0.07)' }}>
      <div className="inter text-xs font-semibold px-5 py-3 border-b flex items-center justify-between" style={{ background: T.surf2, borderColor: T.bl, color: T.t2 }}>
        Shared Inbox — 3 open
        <span style={{ background: T.em, color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>LIVE</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${T.bl}`, background: i === 0 ? `${T.em}06` : T.white, borderLeft: `3px solid ${i === 0 ? T.em : 'transparent'}` }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: [T.em,'#6366f1',T.amber][i] + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="inter text-xs font-bold" style={{ color: [T.em,'#6366f1',T.amber][i] }}>{r.name[0]}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="inter font-semibold text-sm" style={{ color: T.t1 }}>{r.name}</span>
              {r.unread > 0 && <span style={{ background: T.em, color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{r.unread}</span>}
            </div>
            <p className="inter text-xs truncate mt-0.5" style={{ color: T.t3 }}>{r.msg}</p>
            <span className="inter text-[10px] font-semibold mt-1 inline-block px-2 py-0.5 rounded" style={{ background: `${r.tagC}14`, color: r.tagC }}>{r.tag}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function AutoRVisual() {
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.bl}`, boxShadow: '0 8px 40px rgba(0,0,0,0.07)' }}>
      <div className="inter text-xs font-semibold px-5 py-3 border-b flex items-center justify-between" style={{ background: T.surf2, borderColor: T.bl, color: T.t2 }}>
        Auto-Responder — Active
        <span style={{ background: T.emBg, color: T.em, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, border: `1px solid ${T.emRing}` }}>Rules: 4</span>
      </div>
      {[
        { trigger: 'price, cost, quote', action: 'Quotes from product catalog', color: T.em },
        { trigger: 'delivery, shipping', action: 'Reads knowledge base article', color: '#6366f1' },
        { trigger: 'human, agent, cs', action: 'Transfers to team member', color: T.amber },
        { trigger: 'anything else', action: 'Trained responder with KB context', color: '#14b8a6', italic: true },
      ].map((r, i) => (
        <div key={i} style={{ padding: '13px 20px', borderBottom: `1px solid ${T.bl}`, display: 'flex', alignItems: 'center', gap: 12, background: T.white }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${r.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap style={{ width: 14, height: 14, color: r.color }} />
          </div>
          <div>
            <p className="inter text-[11px]" style={{ color: T.t3 }}>Trigger</p>
            <p className="inter text-xs font-semibold" style={{ color: T.t1, fontStyle: r.italic ? 'italic' : 'normal' }}>{r.trigger}</p>
            <p className="inter text-xs mt-0.5" style={{ color: r.color }}>{r.action}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function PipelineVisual() {
  const cols = [
    { name: 'Lead', color: '#6366f1', deals: ['Ravi M. · $1,800', 'Noor D. · $3,200'] },
    { name: 'Proposal', color: T.amber, deals: ['Ahmed · $2,800'] },
    { name: 'Won', color: T.em, deals: ['Sara · $5,600', 'Bilal · $900'] },
  ]
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.bl}`, boxShadow: '0 8px 40px rgba(0,0,0,0.07)' }}>
      <div className="inter text-xs font-semibold px-5 py-3 border-b flex items-center justify-between" style={{ background: T.surf2, borderColor: T.bl, color: T.t2 }}>
        CRM Pipeline <span style={{ color: T.t3 }}>5 open deals · $14,300</span>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: 16, background: T.surf }}>
        {cols.map(c => (
          <div key={c.name} style={{ flex: 1 }}>
            <div className="inter text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: T.t2 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
              {c.name}
            </div>
            {c.deals.map(d => (
              <div key={d} style={{ borderRadius: 8, padding: '8px 10px', marginBottom: 6, background: T.white, border: `1px solid ${T.bl}` }}>
                <p className="inter text-xs font-semibold" style={{ color: T.t1 }}>{d.split('·')[0].trim()}</p>
                <p className="inter text-xs" style={{ color: c.color }}>{d.split('·')[1]?.trim()}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Comparison ────────────────────────────────────────────────────────────────
const CMP_FEATURES = [
  'Shared WhatsApp inbox','Auto-responder with rules','Knowledge base integration',
  'CRM pipeline (Kanban)','Appointment booking','Payments & invoices',
  'Workflow automation','Product catalog','Multi-number support',
  'Multi-workspace / clients','Broadcast campaigns','Analytics dashboard','Self-hosted / data ownership',
]
const CMP_DATA: [string, string, (true | false | string)[], boolean][] = [
  ['WhatsApp Portal', 'Your cost', Array(13).fill(true), true],
  ['GoHighLevel', '$297/mo', [false,'Limited','Add-on',true,true,true,true,false,false,'$297+',true,true,false], false],
  ['Basic WA CRM', '$99–200/mo', [true,'Rules only',false,false,false,false,false,false,'Extra',false,true,'Basic',false], false],
]

function ComparisonSection() {
  const [r, v] = useReveal()
  return (
    <section id="comparison" style={{ background: T.surf, padding: '96px 0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        <div ref={r} style={{ ...v, textAlign: 'center', maxWidth: 580, margin: '0 auto 56px' }}>
          <p className="inter text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.em }}>How it compares</p>
          <h2 className="sg font-bold leading-tight" style={{ fontSize: 'clamp(28px,4vw,40px)', color: T.t1, letterSpacing: '-0.02em' }}>
            More than GoHighLevel.<br />Built for WhatsApp from day one.
          </h2>
        </div>

        <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.bl}`, boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: T.white }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.bl}` }} />
            {CMP_DATA.map(([name, price, , highlight]) => (
              <div key={name} style={{ padding: '16px 12px', textAlign: 'center', background: highlight ? T.ink : T.white, borderBottom: `1px solid ${highlight ? T.bd : T.bl}` }}>
                <p className="sg text-sm font-semibold" style={{ color: highlight ? T.white : T.t1 }}>{name}</p>
                <p className="inter text-[11px] mt-0.5" style={{ color: highlight ? T.em : T.t3 }}>{price}</p>
              </div>
            ))}
          </div>
          {/* Rows */}
          {CMP_FEATURES.map((feat, fi) => (
            <div key={feat} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', borderBottom: `1px solid ${T.bl}`, background: fi % 2 === 0 ? T.white : T.surf }}>
              <div className="inter text-sm px-5 py-3 font-medium" style={{ color: T.t1 }}>{feat}</div>
              {CMP_DATA.map(([name, , values, highlight]) => {
                const v2 = values[fi]
                return (
                  <div key={name} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: highlight ? `${T.ink}08` : undefined }}>
                    {v2 === true ? <Check style={{ width: 16, height: 16, color: highlight ? T.em : '#22c55e' }} />
                      : v2 === false ? <X style={{ width: 14, height: 14, color: '#ef4444', opacity: 0.6 }} />
                      : <span className="inter text-[11px] text-center font-medium" style={{ color: T.t3 }}>{v2}</span>}
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

// ── Pricing ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter', price: '$49', per: '/mo', desc: 'For small teams getting started with WhatsApp CRM.',
    features: ['1 workspace', '3 WhatsApp numbers', 'Unlimited team members', 'All 15 features', 'Community support'],
    cta: 'Get Starter', highlight: false,
  },
  {
    name: 'Business', price: '$99', per: '/mo', desc: 'For growing teams running active sales and support.',
    features: ['3 workspaces', '10 WhatsApp numbers', 'Unlimited team members', 'All 15 features', 'Priority support', 'Custom domain'],
    cta: 'Get Business', highlight: true,
    badge: 'Most popular',
  },
  {
    name: 'Agency', price: '$249', per: '/mo', desc: 'For agencies managing multiple client accounts.',
    features: ['Unlimited workspaces', 'Unlimited numbers', 'Unlimited team members', 'All 15 features', 'Dedicated support', 'White-label option'],
    cta: 'Get Agency', highlight: false,
  },
]

function PricingSection() {
  const [r, v] = useReveal()
  const nav = useNavigate()
  return (
    <section id="pricing" style={{ background: T.white, padding: '96px 0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        <div ref={r} style={{ ...v, textAlign: 'center', maxWidth: 560, margin: '0 auto 56px' }}>
          <p className="inter text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.em }}>Transparent pricing</p>
          <h2 className="sg font-bold leading-tight" style={{ fontSize: 'clamp(28px,4vw,40px)', color: T.t1, letterSpacing: '-0.02em' }}>
            No per-seat fees.<br />No feature paywalls.
          </h2>
          <p className="inter mt-3 text-base" style={{ color: T.t2 }}>Every plan includes all 15 features and unlimited team members. You only pay for the number of workspaces and WhatsApp connections.</p>
          <p className="inter mt-2 text-xs" style={{ color: T.t3 }}>* Indicative pricing — contact us for current rates and annual discounts.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {PLANS.map(({ name, price, per, desc, features, cta, highlight, badge }) => (
            <div key={name} style={{
              borderRadius: 20, padding: '32px 28px', position: 'relative',
              background: highlight ? T.ink : T.surf,
              border: `1px solid ${highlight ? T.em : T.bl}`,
              boxShadow: highlight ? '0 16px 48px rgba(0,0,0,0.18)' : '0 2px 12px rgba(0,0,0,0.04)',
              transform: highlight ? 'scale(1.03)' : 'none',
            }}>
              {badge && (
                <span className="inter absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1"
                  style={{ background: T.em, color: '#fff' }}>{badge}</span>
              )}
              <p className="sg font-semibold text-base mb-1" style={{ color: highlight ? T.white : T.t1 }}>{name}</p>
              <div className="flex items-end gap-1 mb-2">
                <span className="sg font-bold" style={{ fontSize: 40, lineHeight: 1, color: highlight ? T.white : T.t1 }}>{price}</span>
                <span className="inter text-sm mb-1.5" style={{ color: highlight ? 'rgba(255,255,255,0.5)' : T.t3 }}>{per}</span>
              </div>
              <p className="inter text-sm mb-6" style={{ color: highlight ? 'rgba(255,255,255,0.55)' : T.t2 }}>{desc}</p>
              <ul style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {features.map(f => (
                  <li key={f} className="inter flex items-center gap-2.5 text-sm" style={{ color: highlight ? 'rgba(255,255,255,0.8)' : T.t1 }}>
                    <Check style={{ width: 14, height: 14, color: highlight ? T.em : T.em, flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => nav('/login')}
                className="inter w-full h-11 rounded-xl font-semibold text-sm cursor-pointer transition-all"
                style={{ background: highlight ? T.em : 'transparent', color: highlight ? '#fff' : T.em, border: highlight ? 'none' : `1.5px solid ${T.em}` }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >{cta}</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQS = [
  { q: 'Do I need to host it myself?', a: 'Yes — WhatsApp Portal runs on your own server (any Linux VPS on DigitalOcean, Hetzner, AWS, or similar). Your data never leaves your infrastructure. We provide step-by-step setup docs and the entire codebase.' },
  { q: 'How does my WhatsApp number connect?', a: 'You scan a QR code in the dashboard to link your number using the Baileys WhatsApp Web client. No WhatsApp Business API account, no Meta approval, no monthly API fees — just your existing WhatsApp number.' },
  { q: 'How long does setup take?', a: 'Under an hour for someone comfortable with a Linux terminal. You need a server (or a $6/month DigitalOcean Droplet), your domain, and a WhatsApp number. The install script handles the rest.' },
  { q: 'Is there really no per-seat fee?', a: 'Correct. Invite your entire team — 5 agents or 50 — at no extra charge. The platform license covers the software, not headcount.' },
  { q: 'What happens to my customer data?', a: "Everything is stored on your server in a JSON database (or you can swap it for Postgres). We never see your conversations, contacts, or files. You own your backups and control access completely." },
  { q: 'Do you offer support?', a: 'Starter plans include community support. Business and Agency plans include priority email support with a guaranteed response time. Contact hello@digitalnovatech.com.' },
]

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)
  const [r, v] = useReveal()
  return (
    <section id="faq" style={{ background: T.surf, padding: '96px 0' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
        <div ref={r} style={{ ...v, textAlign: 'center', marginBottom: 56 }}>
          <p className="inter text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.em }}>Frequently asked</p>
          <h2 className="sg font-bold leading-tight" style={{ fontSize: 'clamp(28px,4vw,40px)', color: T.t1, letterSpacing: '-0.02em' }}>Common questions</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQS.map(({ q, a }, i) => (
            <div key={i} style={{ borderRadius: 12, border: `1px solid ${open === i ? T.em : T.bl}`, overflow: 'hidden', transition: 'border-color 0.2s', background: T.white }}>
              <button
                className="inter w-full flex items-center justify-between gap-4 px-6 py-4 text-left cursor-pointer"
                style={{ background: 'none', border: 'none', fontFamily: 'inherit' }}
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="font-semibold text-sm" style={{ color: T.t1 }}>{q}</span>
                <ChevronDown style={{ width: 16, height: 16, color: T.t3, flexShrink: 0, transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
              </button>
              <div style={{ maxHeight: open === i ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                <p className="inter text-sm leading-relaxed px-6 pb-5" style={{ color: T.t2 }}>{a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
function CTASection() {
  const [r, v] = useReveal()
  const nav = useNavigate()
  return (
    <section style={{ background: T.ink, padding: '112px 0' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        <div ref={r} style={{ ...v }}>
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" style={{ margin: '0 auto 24px' }} aria-hidden="true">
            <rect width="32" height="32" rx="8" fill={T.em} />
            <path d="M10 21.5V12a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-5l-4 2v-3z" fill="white" />
            <circle cx="14" cy="15" r="1.2" fill={T.em} />
            <circle cx="18" cy="15" r="1.2" fill={T.em} />
          </svg>
          <h2 className="sg font-bold leading-tight mb-4" style={{ fontSize: 'clamp(30px,4vw,46px)', color: T.white, letterSpacing: '-0.02em' }}>
            Ready to run your WhatsApp business properly?
          </h2>
          <p className="inter text-base mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Connect your number, invite your team, and go live — all in under an hour.
          </p>
          <button onClick={() => nav('/login')}
            className="inter inline-flex items-center gap-2 h-12 px-10 rounded-xl text-white font-semibold text-sm cursor-pointer transition-all"
            style={{ background: T.em }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
          >
            Get started today <ArrowRight className="size-4" />
          </button>
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 28px' }}>
            {[[Shield,'Self-hosted — your data'],[Clock,'Live in under an hour'],[Users,'Unlimited team seats']].map(([Icon, label]) => (
              <div key={label as string} className="inter flex items-center gap-1.5 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <Icon className="size-3.5" />{label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const nav = useNavigate()
  const col = (label: string, links: [string, string, boolean?][]) => (
    <div key={label}>
      <p className="inter text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: T.t3 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map(([href, text, ext]) => (
          ext
            ? <a key={text} href={href} target="_blank" rel="noopener noreferrer" className="inter text-sm transition-colors cursor-pointer" style={{ color: T.t2 }}
                onMouseEnter={e => (e.currentTarget.style.color = T.t1)} onMouseLeave={e => (e.currentTarget.style.color = T.t2)}>{text}</a>
            : <a key={text} href={href} className="inter text-sm transition-colors cursor-pointer" style={{ color: T.t2 }}
                onMouseEnter={e => (e.currentTarget.style.color = T.t1)} onMouseLeave={e => (e.currentTarget.style.color = T.t2)} onClick={href.startsWith('/') ? (e) => { e.preventDefault(); nav(href) } : undefined}>{text}</a>
        ))}
      </div>
    </div>
  )

  return (
    <footer style={{ background: T.surf, borderTop: `1px solid ${T.bl}`, padding: '64px 0 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '40px 32px', marginBottom: 56 }}>
          {/* Brand column */}
          <div style={{ gridColumn: 'span 1' }}>
            <Brand />
            <p className="inter text-sm mt-4 leading-relaxed" style={{ color: T.t2, maxWidth: 220 }}>
              WhatsApp CRM for teams that mean business. Self-hosted. No per-seat fees.
            </p>
            <p className="inter text-xs mt-4" style={{ color: T.t3 }}>
              <a href="mailto:hello@digitalnovatech.com" style={{ color: T.em }}>hello@digitalnovatech.com</a>
            </p>
          </div>

          {col('Product', [
            ['#features', 'Features'],
            ['#pricing', 'Pricing'],
            ['#comparison', 'Compare'],
            ['#faq', 'FAQ'],
          ])}
          {col('Company', [
            ['mailto:hello@digitalnovatech.com', 'Contact'],
            ['mailto:hello@digitalnovatech.com', 'Support'],
          ])}
          {col('Legal', [
            ['/privacy', 'Privacy Policy'],
            ['/terms', 'Terms of Service'],
          ])}
        </div>

        <div style={{ borderTop: `1px solid ${T.bl}`, paddingTop: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
          <p className="inter text-xs" style={{ color: T.t3 }}>
            © {new Date().getFullYear()} Digital Nova Tech. WhatsApp Portal.
          </p>
          <p className="inter text-xs" style={{ color: T.t3 }}>
            Not affiliated with WhatsApp Inc. or Meta.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = CSS_ANIMATIONS
    document.head.appendChild(el)
    return () => el.remove()
  }, [])

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: T.t1, lineHeight: 1.6 }}>
      <Nav />
      <Hero />
      <StatsStrip />
      <FeaturesSection />
      <DeepDive
        tag="Team inbox"
        h2="One inbox. Every WhatsApp number. Every agent."
        body="Stop juggling personal phones and forwarded screenshots. Connect all your WhatsApp numbers and let your whole team work from a shared inbox — with assignments, tags, and live message updates."
        points={[
          'Assign conversations to specific agents or leave them in the shared queue',
          'Tag conversations (Sales, Billing, Support) to filter and prioritise',
          'See who is viewing or typing to prevent duplicate replies',
          'Real-time updates across all agents — no refresh required',
        ]}
        accent={T.em}
        visual={<InboxVisual />}
      />
      <DeepDive
        tag="Auto-responder"
        h2="Rules first. Trained responder for everything else."
        body="Define keyword rules for your most predictable questions — pricing, hours, delivery. Anything that doesn't match goes to a responder that reads your knowledge base and product catalog before every reply."
        points={[
          'Rules are instant, free, and always run before the trained responder',
          'Trained responder draws from your knowledge base — never invents information',
          'Product catalog integration: quotes exact prices and stock levels',
          'Escalates to a human agent after 3 consecutive failures — never the first',
        ]}
        accent="#6366f1"
        reverse
        visual={<AutoRVisual />}
      />
      <DeepDive
        tag="CRM & payments"
        h2="From first message to closed deal and paid invoice."
        body="Your pipeline sits right next to your inbox. When a deal closes, send a payment link or invoice in the same conversation. No switching between six tools."
        points={[
          'Kanban pipeline with custom stages, deal values, and stage durations',
          'Generate and send payment links directly in any WhatsApp conversation',
          'Issue professional invoices and track payment status from the dashboard',
          'Appointment booking for service businesses — customers book via WhatsApp',
        ]}
        accent={T.amber}
        visual={<PipelineVisual />}
      />
      <ComparisonSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  )
}
