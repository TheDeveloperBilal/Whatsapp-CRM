import { NavLink, Outlet, useLocation } from 'react-router'
import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  Bot,
  Smartphone,
  Workflow,
  Building2,
  Settings,
  ChevronsUpDown,
  Circle,
  MessageSquareDashed,
  Megaphone,
  BookOpen,
  Package,
  LogOut,
  ShieldCheck,
  UserCircle,
  Wrench,
  MonitorSmartphone,
} from 'lucide-react'
import type { BusinessType } from '@/types/portal'
import { BUSINESS_TYPE_META } from '@/types/portal'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { usePortal } from '@/lib/store'

function getNav(businessType: BusinessType) {
  const meta = BUSINESS_TYPE_META[businessType] ?? BUSINESS_TYPE_META.service
  return [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/inbox', label: 'Inbox', icon: MessagesSquare },
    { to: '/contacts', label: 'Contacts', icon: Users },
    { to: '/bots', label: 'AI Auto-Responder', icon: Bot },
    { to: '/sessions', label: 'WhatsApp Sessions', icon: Smartphone },
    { to: '/automation', label: 'Automation', icon: Workflow },
    {
      to: '/products',
      label: meta.productLabel,
      icon: businessType === 'service' ? Wrench : businessType === 'digital' ? MonitorSmartphone : Package,
    },
    { to: '/canned-responses', label: 'Canned Responses', icon: MessageSquareDashed },
    { to: '/broadcast', label: 'Broadcast', icon: Megaphone },
    { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
    { to: '/tenants', label: 'Tenants & Team', icon: Building2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]
}

const titles: Record<string, string> = {
  '/': 'Overview',
  '/inbox': 'Shared Inbox',
  '/contacts': 'Contacts & CRM',
  '/bots': 'AI Auto-Responder',
  '/sessions': 'WhatsApp Sessions',
  '/automation': 'Automation Rules',
  '/products': 'Product Catalog',
  '/canned-responses': 'Canned Responses',
  '/broadcast': 'Broadcast Message',
  '/knowledge-base': 'Knowledge Base',
  '/tenants': 'Tenants & Team',
  '/settings': 'Settings',
}

export default function AppLayout() {
  const { tenants, tenant, setTenantId, sessions, conversations, gatewayKind, backendOnline, currentUser, logout } = usePortal()
  const location = useLocation()
  const unread = conversations.reduce((n, c) => n + c.unread, 0)
  const connected = sessions.filter((s) => s.status === 'connected').length
  const isSuperAdmin = currentUser?.role === 'superadmin'
  const businessType: BusinessType = (tenant.businessType ?? 'service') as BusinessType
  const nav = getNav(businessType)
  const btMeta = BUSINESS_TYPE_META[businessType] ?? BUSINESS_TYPE_META.service

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                    <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
                      {tenant.name.slice(0, 1)}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{tenant.name}</span>
                      <span className="truncate text-xs text-muted-foreground capitalize">
                        {btMeta.emoji} {btMeta.label} · {tenant.plan}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="start">
                  <DropdownMenuLabel>Switch tenant</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {tenants.map((t) => (
                    <DropdownMenuItem key={t.id} onClick={() => setTenantId(t.id)}>
                      <Building2 className="mr-2 size-4" />
                      <span className="flex-1">{t.name}</span>
                      {t.id === tenant.id && <Badge variant="secondary">active</Badge>}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {isSuperAdmin ? (
                    <DropdownMenuItem asChild>
                      <NavLink to="/tenants">
                        <Building2 className="mr-2 size-4" />
                        Manage tenants
                      </NavLink>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                      Contact your admin to add tenants
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={item.end ? location.pathname === '/' : location.pathname.startsWith(item.to)}>
                      <NavLink to={item.to} end={item.end}>
                        <item.icon />
                        <span>{item.label}</span>
                        {item.to === '/inbox' && unread > 0 && (
                          <Badge className="ml-auto" variant="default">
                            {unread}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          {currentUser && (
            <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                {currentUser.role === 'superadmin'
                  ? <ShieldCheck className="size-3.5 text-primary" />
                  : <UserCircle className="size-3.5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{currentUser.username}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{currentUser.role}</div>
              </div>
              <button
                onClick={logout}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Sign out"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
            <Circle
              className={`size-2 ${backendOnline === false ? 'fill-red-500 text-red-500' : connected > 0 ? 'fill-emerald-500 text-emerald-500' : 'fill-amber-500 text-amber-500'}`}
            />
            <span>
              {backendOnline === false
                ? 'backend offline · check terminal'
                : `${connected}/${sessions.length} sessions online · ${gatewayKind}`}
            </span>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-lg font-semibold">
            {titles[location.pathname] ?? 'WhatsApp Portal'}
          </h1>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
