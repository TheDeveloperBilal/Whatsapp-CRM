import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import {
  LayoutDashboard, MessagesSquare, Users, Bot, Smartphone, Workflow,
  Building2, Settings, MessageSquareDashed, Megaphone, BookOpen, Package,
  LogOut, ShieldCheck, Wrench, MonitorSmartphone, Flame, Zap,
  KanbanSquare, CalendarCheck, CreditCard, BarChart2, Search, Menu,
  ChevronDown, ServerCog,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BusinessType } from '@/types/portal'
import { BUSINESS_TYPE_META } from '@/types/portal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { usePortal } from '@/lib/store'
import { cn } from '@/lib/utils'

// ─── Page title map ───────────────────────────────────────────────────────────

const titles: Record<string, string> = {
  '/': 'Overview',
  '/inbox': 'Shared Inbox',
  '/contacts': 'Contacts & CRM',
  '/bots': 'AI Auto-Responder',
  '/sessions': 'WhatsApp Sessions',
  '/automation': 'Automation Rules',
  '/workflows': 'Workflows',
  '/products': 'Product Catalog',
  '/campaigns': 'Lead Capture & Campaigns',
  '/intent-routing': 'Intent Routing',
  '/pipeline': 'Pipeline & Deals',
  '/booking': 'Booking & Appointments',
  '/payments': 'Payment Gateway',
  '/analytics': 'Advanced Analytics',
  '/canned-responses': 'Canned Responses',
  '/broadcast': 'Broadcast Message',
  '/knowledge-base': 'Knowledge Base',
  '/tenants': 'Tenants & Team',
  '/settings': 'Settings',
  '/system-config': 'System Config',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: number | null
}

interface NavGroup {
  label: string
  items: NavItem[]
}

interface SidebarPaneProps {
  groups: NavGroup[]
  search: string
  setSearch: (v: string) => void
  onNavClick: () => void
  username?: string
  role?: string
  isSuperAdmin: boolean
  connected: number
  totalSessions: number
  gatewayKind: string
  backendOnline: boolean | null
  logout: () => void
}

// ─── Sidebar pane (extracted so it can be used in mobile overlay too) ─────────

function SidebarPane({
  groups, search, setSearch, onNavClick,
  username, role, isSuperAdmin,
  connected, totalSessions, gatewayKind, backendOnline,
  logout,
}: SidebarPaneProps) {
  const filtered: NavGroup[] = search.trim()
    ? [{
        label: 'RESULTS',
        items: groups.flatMap(g => g.items).filter(i =>
          i.label.toLowerCase().includes(search.toLowerCase())
        ),
      }]
    : groups

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 55%, #1a1938 100%)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white font-extrabold text-base"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 14px rgba(99,102,241,0.45)' }}
        >
          W
        </div>
        <div>
          <div className="text-white font-bold text-[15px] leading-none tracking-tight">WhatsApp</div>
          <div className="text-[11px] font-semibold mt-0.5 tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            PORTAL
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          <Search className="size-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search menu..."
            className="bg-transparent text-[13px] outline-none flex-1 min-w-0"
            style={{ color: 'rgba(255,255,255,0.7)', caretColor: '#818cf8' }}
          />
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2 sidebar-scroll">
        {filtered.map(group => (
          <div key={group.label} className="mb-5">
            <div
              className="text-[9px] font-bold tracking-[0.16em] uppercase px-3 mb-1.5"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavClick}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer group',
                    isActive ? 'text-white' : ''
                  )}
                  style={({ isActive }) =>
                    isActive
                      ? { background: 'rgba(255,255,255,0.13)', color: 'white' }
                      : { color: 'rgba(255,255,255,0.72)' }
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className="size-[15px] shrink-0 transition-colors"
                        style={{ color: isActive ? '#c7d2fe' : 'rgba(255,255,255,0.55)' }}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span
                          className="text-[10px] font-bold text-white px-1.5 py-px rounded-full min-w-[18px] text-center leading-tight"
                          style={{ background: 'rgba(99,102,241,0.85)' }}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 space-y-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Status dot */}
        <div className="flex items-center gap-2 px-1">
          <div
            className={cn('size-1.5 rounded-full shrink-0 shadow-sm',
              backendOnline === false ? 'bg-red-400' : connected > 0 ? 'bg-emerald-400' : 'bg-amber-400'
            )}
          />
          <span className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {backendOnline === false
              ? 'Backend offline'
              : `${connected}/${totalSessions} sessions · ${gatewayKind}`}
          </span>
        </div>

        {/* User row */}
        {username && (
          <div
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold"
              style={{ background: 'rgba(99,102,241,0.5)' }}
            >
              {isSuperAdmin ? <ShieldCheck className="size-3.5" /> : username.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.92)' }}>
                {username}
              </div>
              <div className="text-[10px] capitalize" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {role}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-lg transition-all duration-150 hover:scale-110"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export default function AppLayout() {
  const {
    tenants, tenant, setTenantId, sessions, conversations,
    gatewayKind, backendOnline, currentUser, logout,
  } = usePortal()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  const unread = conversations.reduce((n, c) => n + c.unread, 0)
  const connected = sessions.filter(s => s.status === 'connected').length
  const isSuperAdmin = currentUser?.role === 'superadmin'
  const businessType: BusinessType = (tenant.businessType ?? 'service') as BusinessType
  const btMeta = BUSINESS_TYPE_META[businessType] ?? BUSINESS_TYPE_META.service
  const productIcon =
    businessType === 'service' ? Wrench
    : businessType === 'digital' ? MonitorSmartphone
    : Package

  const navGroups: NavGroup[] = [
    {
      label: 'MAIN',
      items: [
        { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/inbox', label: 'Inbox', icon: MessagesSquare, badge: unread },
        { to: '/contacts', label: 'Contacts', icon: Users },
        { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
      ],
    },
    {
      label: 'MESSAGING',
      items: [
        { to: '/bots', label: 'AI Auto-Responder', icon: Bot },
        { to: '/sessions', label: 'WA Sessions', icon: Smartphone, badge: connected },
        { to: '/automation', label: 'Automation', icon: Workflow },
        { to: '/workflows', label: 'Workflows', icon: Zap },
        { to: '/intent-routing', label: 'Intent Routing', icon: Zap },
        { to: '/campaigns', label: 'Campaigns', icon: Flame },
        { to: '/broadcast', label: 'Broadcast', icon: Megaphone },
        { to: '/canned-responses', label: 'Canned Responses', icon: MessageSquareDashed },
      ],
    },
    {
      label: 'COMMERCE',
      items: [
        { to: '/products', label: btMeta.productLabel, icon: productIcon },
        { to: '/payments', label: 'Payments', icon: CreditCard },
        { to: '/booking', label: 'Booking', icon: CalendarCheck },
      ],
    },
    {
      label: 'INSIGHTS',
      items: [
        { to: '/analytics', label: 'Analytics', icon: BarChart2 },
        { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
      ],
    },
    {
      label: 'ADMIN',
      items: [
        ...(isSuperAdmin ? [{ to: '/tenants', label: 'Tenants & Team', icon: Building2 } as NavItem] : []),
        { to: '/settings', label: 'Settings', icon: Settings },
        ...(isSuperAdmin ? [{ to: '/system-config', label: 'System Config', icon: ServerCog } as NavItem] : []),
      ],
    },
  ]

  const sidebarProps: SidebarPaneProps = {
    groups: navGroups,
    search,
    setSearch,
    onNavClick: () => setMobileOpen(false),
    username: currentUser?.username,
    role: currentUser?.role,
    isSuperAdmin,
    connected,
    totalSessions: sessions.length,
    gatewayKind: gatewayKind ?? '',
    backendOnline,
    logout,
  }

  const title = titles[location.pathname] ?? 'WhatsApp Portal'

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 45%, #ede9fe 100%)' }}
    >
      {/* ── Desktop sidebar ── */}
      <div className="hidden md:flex md:flex-col w-[242px] shrink-0 m-3 rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 8px 32px rgba(30,27,75,0.28)' }}>
        <SidebarPane {...sidebarProps} />
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="relative w-[242px] m-3 rounded-2xl overflow-hidden z-10"
            style={{ boxShadow: '0 8px 32px rgba(30,27,75,0.35)' }}
          >
            <SidebarPane {...sidebarProps} />
          </div>
        </div>
      )}

      {/* ── Right panel ── */}
      <div className="flex-1 min-w-0 flex flex-col m-3 ml-0">

        {/* Header */}
        <header
          className="flex items-center gap-3 px-5 py-3.5 mb-3 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.75)',
            boxShadow: '0 1px 3px rgba(79,70,229,0.07), 0 1px 8px rgba(0,0,0,0.04)',
          }}
        >
          {/* Mobile toggle */}
          <button
            className="md:hidden p-1.5 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          {/* Page title */}
          <h1 className="flex-1 text-[17px] font-bold text-gray-800 tracking-tight truncate">
            {title}
          </h1>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Workspace switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-semibold transition-colors border"
                  style={{ background: '#eef2ff', borderColor: '#e0e7ff', color: '#4338ca' }}
                >
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="hidden sm:block max-w-[110px] truncate">{tenant.name}</span>
                  <ChevronDown className="size-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tenants.map(t => (
                  <DropdownMenuItem key={t.id} onClick={() => setTenantId(t.id)}>
                    <Building2 className="mr-2 size-4" />
                    <span className="flex-1">{t.name}</span>
                    {t.id === tenant.id && (
                      <Badge variant="secondary" className="text-[10px]">active</Badge>
                    )}
                  </DropdownMenuItem>
                ))}
                {isSuperAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <NavLink to="/tenants" className="flex items-center">
                        <Building2 className="mr-2 size-4" />
                        Manage tenants
                      </NavLink>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User avatar pill */}
            {currentUser && (
              <div
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl cursor-default select-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
                  border: '1px solid rgba(99,102,241,0.15)',
                }}
                title={`${currentUser.username} · ${currentUser.role}`}
              >
                <div
                  className="flex size-6 items-center justify-center rounded-lg text-white text-[11px] font-bold"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {currentUser.username.slice(0, 1).toUpperCase()}
                </div>
                <span className="hidden sm:block text-[12px] font-semibold text-indigo-700">
                  {currentUser.username}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 min-h-0 overflow-auto rounded-2xl main-scroll"
          style={{
            background: 'rgba(255,255,255,0.78)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.68)',
            boxShadow: '0 1px 3px rgba(79,70,229,0.05)',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
