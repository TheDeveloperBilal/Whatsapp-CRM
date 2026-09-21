// ─── Demo provider: seed data + MockAdapter live simulation ─────────────────
// Also used for direct openwa/evolution gateway profiles (partial coverage).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { getGateway } from '@/lib/gateway'
import type { WhatsAppGateway } from '@/lib/gateway/types'
import type { TenantUser } from '@/lib/backend'
import { PortalCtx } from '@/lib/portal-context'
import type { PortalState } from '@/lib/portal-state'
import {
  tenants as seedTenants,
  tags as seedTags,
  botRules as seedRules,
  botConfigs,
  automationRules as seedAutomations,
} from '@/lib/gateway/seed'
import type {
  Tenant,
  WaSession,
  Contact,
  Conversation,
  Message,
  BotRule,
  BotConfig,
  AutomationRule,
  IntentRule,
  PipelineStage,
  Deal,
  AppointmentType,
  Appointment,
  PaymentGateway,
  PaymentLink,
  Invoice,
  CannedResponse,
  KbArticle,
  Product,
  Campaign,
  GatewayProfile,
  DashboardStats,
  ConversationStatus,
} from '@/types/portal'

interface Props {
  children: ReactNode
  profile: GatewayProfile
  updateProfile: (p: GatewayProfile) => void
}

export function MockProvider({ children, profile, updateProfile }: Props) {
  const gatewayRef = useRef<WhatsAppGateway>(getGateway(profile))
  const [gatewayKind, setGatewayKind] = useState(gatewayRef.current.kind)

  useEffect(() => {
    gatewayRef.current = getGateway(profile)
    setGatewayKind(gatewayRef.current.kind)
  }, [profile])

  const [tenants] = useState<Tenant[]>(seedTenants)
  const [tenantId, setTenantId] = useState(seedTenants[0].id)
  const tenant = useMemo(() => tenants.find((t) => t.id === tenantId)!, [tenants, tenantId])

  const [sessions, setSessions] = useState<WaSession[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [msgCache, setMsgCache] = useState<Record<string, Message[]>>({})
  const [loading, setLoading] = useState(true)

  const [botRules, setBotRules] = useState<BotRule[]>(seedRules)
  const [configs, setConfigs] = useState<BotConfig[]>(botConfigs)
  const [automations, setAutomations] = useState<AutomationRule[]>(seedAutomations)
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([])
  const [knowledgeBase, setKnowledgeBase] = useState<KbArticle[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [intents, setIntents] = useState<IntentRule[]>([])
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([
    { id: 'ps1', tenantId: 't1', name: 'New Lead',  color: '#3b82f6', order: 0 },
    { id: 'ps2', tenantId: 't1', name: 'Contacted', color: '#f59e0b', order: 1 },
    { id: 'ps3', tenantId: 't1', name: 'Qualified', color: '#8b5cf6', order: 2 },
    { id: 'ps4', tenantId: 't1', name: 'Proposal',  color: '#ec4899', order: 3 },
    { id: 'ps5', tenantId: 't1', name: 'Won',       color: '#10b981', order: 4 },
    { id: 'ps6', tenantId: 't1', name: 'Lost',      color: '#ef4444', order: 5 },
  ])
  const [deals, setDeals] = useState<Deal[]>([])
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([
    { id: 'at1', tenantId: 't1', name: 'Free Consultation', duration: 30, price: 0, currency: 'USD', description: '30-minute discovery call', active: true },
    { id: 'at2', tenantId: 't1', name: 'Service Session', duration: 60, price: 50, currency: 'USD', description: '1-hour full service session', active: true },
  ])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([])
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const botConfig = useMemo(
    () => configs.find((c) => c.tenantId === tenantId) ?? configs[0],
    [configs, tenantId],
  )

  useEffect(() => {
    let alive = true
    setLoading(true)
    const gw = gatewayRef.current
    Promise.all([
      gw.listSessions(tenantId).catch(() => [] as WaSession[]),
      gw.listContacts(tenantId).catch(() => [] as Contact[]),
      gw.listConversations(tenantId).catch(() => [] as Conversation[]),
      gw.getStats(tenantId).catch(() => null),
    ]).then(([s, c, cv, st]) => {
      if (!alive) return
      setSessions(s)
      setContacts(c)
      setConversations(cv)
      setStats(st)
      setMsgCache({})
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [tenantId, gatewayKind])

  useEffect(() => {
    return gatewayRef.current.subscribe({
      onMessage: (msg, conv, contact) => {
        setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)])
        setMsgCache((prev) => ({ ...prev, [conv.id]: [...(prev[conv.id] ?? []), msg] }))
        if (contact.tenantId === tenantId) {
          toast.message(`💬 ${contact.name}`, { description: msg.body })
        }
      },
      onSessionStatus: (s) => {
        setSessions((prev) => prev.map((x) => (x.id === s.id ? s : x)))
      },
    })
  }, [tenantId, gatewayKind])

  const messagesFor = useCallback((cid: string) => msgCache[cid] ?? [], [msgCache])

  const ensureMessages = useCallback(async (cid: string) => {
    const msgs = await gatewayRef.current.listMessages(cid).catch(() => [] as Message[])
    setMsgCache((prev) => ({ ...prev, [cid]: msgs }))
  }, [])

  const sendMessage = useCallback(
    async (cid: string, text: string) => {
      const conv = conversations.find((c) => c.id === cid)
      const contact = contacts.find((c) => c.id === conv?.contactId)
      if (!conv || !contact) return
      const msg = await gatewayRef.current.sendMessage({
        sessionId: conv.sessionId,
        chatId: contact.chatId,
        text,
      })
      setMsgCache((prev) => ({ ...prev, [cid]: [...(prev[cid] ?? []), msg] }))
      setConversations((prev) =>
        prev.map((c) => (c.id === cid ? { ...c, lastMessage: msg, updatedAt: msg.timestamp } : c)),
      )
    },
    [conversations, contacts],
  )

  const setConversationStatus = useCallback((cid: string, status: ConversationStatus) => {
    setConversations((prev) => prev.map((c) => (c.id === cid ? { ...c, status } : c)))
  }, [])

  const toggleConversationBot = useCallback((cid: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === cid ? { ...c, botEnabled: !c.botEnabled } : c)),
    )
  }, [])

  const assignConversation = useCallback((cid: string, memberId: string | undefined) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === cid ? { ...c, assigneeId: memberId } : c)),
    )
  }, [])

  const markRead = useCallback((cid: string) => {
    setConversations((prev) => prev.map((c) => (c.id === cid ? { ...c, unread: 0 } : c)))
  }, [])

  const startSession = useCallback(async (sid: string) => {
    const s = await gatewayRef.current.startSession(sid)
    setSessions((prev) => prev.map((x) => (x.id === sid ? { ...x, ...s, name: x.name } : x)))
    return s
  }, [])

  const createSession = useCallback(
    async (name: string, engine?: string) => {
      const s = await gatewayRef.current.createSession(tenantId, { name, engine })
      setSessions((prev) => [...prev, s])
      return s
    },
    [tenantId],
  )

  const deleteSession = useCallback(async (sid: string) => {
    await gatewayRef.current.deleteSession(sid)
    setSessions((prev) => prev.filter((s) => s.id !== sid))
  }, [])

  const toggleBotRule = useCallback((ruleId: string) => {
    setBotRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)))
  }, [])

  const saveBotRule = useCallback((rule: BotRule) => {
    setBotRules((prev) =>
      prev.some((r) => r.id === rule.id) ? prev.map((r) => (r.id === rule.id ? rule : r)) : [...prev, rule],
    )
  }, [])

  const deleteBotRule = useCallback((ruleId: string) => {
    setBotRules((prev) => prev.filter((r) => r.id !== ruleId))
  }, [])

  const updateBotConfig = useCallback(
    (patch: Partial<BotConfig>) => {
      setConfigs((prev) => prev.map((c) => (c.tenantId === tenantId ? { ...c, ...patch } : c)))
    },
    [tenantId],
  )

  const toggleAutomation = useCallback((id: string) => {
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)))
  }, [])

  const saveAutomation = useCallback(async (rule: Omit<AutomationRule, 'id' | 'tenantId'>) => {
    const created = { ...rule, id: `a${Date.now()}`, tenantId }
    setAutomations((prev) => [...prev, created as AutomationRule])
  }, [tenantId])

  const deleteAutomation = useCallback(async (id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const saveContactNote = useCallback((contactId: string, notes: string) => {
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, notes } : c)))
  }, [])

  const saveCannedResponse = useCallback(async (cr: Omit<CannedResponse, 'id' | 'tenantId'>) => {
    setCannedResponses((prev) => [...prev, { ...cr, id: `cr${Date.now()}`, tenantId }])
  }, [tenantId])

  const updateCannedResponse = useCallback(async (id: string, patch: Partial<CannedResponse>) => {
    setCannedResponses((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  const deleteCannedResponse = useCallback(async (id: string) => {
    setCannedResponses((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const saveKbArticle = useCallback(async (article: Omit<KbArticle, 'id' | 'tenantId'>) => {
    setKnowledgeBase((prev) => [...prev, { ...article, id: `kb${Date.now()}`, tenantId }])
  }, [tenantId])

  const updateKbArticle = useCallback(async (id: string, patch: Partial<KbArticle>) => {
    setKnowledgeBase((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  const deleteKbArticle = useCallback(async (id: string) => {
    setKnowledgeBase((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const sendBroadcast = useCallback(async (_message: string, contactIds: string[]) => {
    return { sent: contactIds.length, failed: 0 }
  }, [])

  const saveProduct = useCallback(async (product: Omit<Product, 'id' | 'tenantId'>) => {
    setProducts((prev) => [...prev, { ...product, id: `p${Date.now()}`, tenantId }])
  }, [tenantId])

  const updateProduct = useCallback(async (id: string, patch: Partial<Product>) => {
    setProducts((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  const deleteProduct = useCallback(async (id: string) => {
    setProducts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const logout = useCallback(() => { window.location.href = '/' }, [])

  const createTenant = useCallback(async (data: { name: string; slug: string; plan: string; businessType: string; adminUsername: string; adminPassword: string }) => {
    const t = { id: `t${Date.now()}`, name: data.name, slug: data.slug, plan: data.plan as 'free' | 'pro' | 'business', businessType: (data.businessType ?? 'service') as 'service' | 'digital' | 'physical', suspended: false, members: [], createdAt: new Date().toISOString() }
    return t
  }, [])

  const createCampaign = useCallback(async (data: Omit<Campaign, 'id' | 'tenantId' | 'leads' | 'createdAt'>) => {
    const c: Campaign = { ...data, id: `camp${Date.now()}`, tenantId, leads: 0, createdAt: new Date().toISOString() }
    setCampaigns((prev) => [...prev, c])
    return c
  }, [tenantId])

  const updateCampaign = useCallback(async (id: string, patch: Partial<Campaign>) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])

  const deleteCampaign = useCallback(async (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const updateTenant = useCallback(async (_id: string, _patch: { name?: string; plan?: string; businessType?: string; suspended?: boolean }) => {}, [])
  const deleteTenant = useCallback(async (_id: string) => {}, [])
  const getTenantUsers = useCallback(async (_tenantId: string): Promise<TenantUser[]> => [], [])
  const createTenantUser = useCallback(async (tenantId: string, data: { username: string; password: string; role?: string }): Promise<TenantUser> => {
    return { id: `usr${Date.now()}`, username: data.username, tenantId, role: data.role ?? 'agent' }
  }, [])
  const deleteTenantUser = useCallback(async (_tenantId: string, _userId: string) => {}, [])

  const createIntent = useCallback(async (data: Omit<IntentRule, 'id' | 'tenantId' | 'matchCount' | 'createdAt'>) => {
    const intent: IntentRule = { ...data, id: `int${Date.now()}`, tenantId, matchCount: 0, createdAt: new Date().toISOString() }
    setIntents((prev) => [...prev, intent])
    return intent
  }, [tenantId])

  const updateIntent = useCallback(async (id: string, patch: Partial<IntentRule>) => {
    setIntents((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  const deleteIntent = useCallback(async (id: string) => {
    setIntents((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const testIntent = useCallback(async (message: string): Promise<IntentRule | null> => {
    const lower = message.toLowerCase()
    return intents.find((i) => i.enabled && i.keywords.some((kw) => lower.includes(kw.trim().toLowerCase()))) ?? null
  }, [intents])

  const createStage = useCallback(async (data: { name: string; color: string }) => {
    const stage: PipelineStage = { ...data, id: `ps${Date.now()}`, tenantId, order: pipelineStages.length }
    setPipelineStages((prev) => [...prev, stage])
    return stage
  }, [tenantId, pipelineStages.length])

  const updateStage = useCallback(async (id: string, patch: Partial<PipelineStage>) => {
    setPipelineStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const deleteStage = useCallback(async (id: string) => {
    setPipelineStages((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const createDeal = useCallback(async (data: Omit<Deal, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    const deal: Deal = { ...data, id: `deal${Date.now()}`, tenantId, createdAt: now, updatedAt: now }
    setDeals((prev) => [...prev, deal])
    return deal
  }, [tenantId])

  const updateDeal = useCallback(async (id: string, patch: Partial<Deal>) => {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d)))
  }, [])

  const deleteDeal = useCallback(async (id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id))
  }, [])

  // ── Booking ──
  const createAppointmentType = useCallback(async (data: Omit<AppointmentType, 'id' | 'tenantId'>) => {
    const at: AppointmentType = { ...data, id: `at${Date.now()}`, tenantId }
    setAppointmentTypes((prev) => [...prev, at])
    return at
  }, [tenantId])

  const updateAppointmentType = useCallback(async (id: string, patch: Partial<AppointmentType>) => {
    setAppointmentTypes((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  const deleteAppointmentType = useCallback(async (id: string) => {
    setAppointmentTypes((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const createAppointment = useCallback(async (data: Omit<Appointment, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    const appt: Appointment = { ...data, id: `appt${Date.now()}`, tenantId, createdAt: now, updatedAt: now }
    setAppointments((prev) => [...prev, appt])
    return appt
  }, [tenantId])

  const updateAppointment = useCallback(async (id: string, patch: Partial<Appointment>) => {
    setAppointments((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)))
  }, [])

  const deleteAppointment = useCallback(async (id: string) => {
    setAppointments((prev) => prev.filter((x) => x.id !== id))
  }, [])

  // ── Payments ──
  const createPaymentGateway = useCallback(async (data: { provider: string; name: string; secretKey: string; publicKey?: string; live?: boolean }) => {
    const gw: PaymentGateway = { id: `gw${Date.now()}`, tenantId, provider: data.provider as 'stripe' | 'paypal', name: data.name, publicKey: data.publicKey, hasSecretKey: true, live: data.live ?? false, active: true, createdAt: new Date().toISOString() }
    setPaymentGateways((prev) => [...prev, gw])
    return gw
  }, [tenantId])

  const updatePaymentGateway = useCallback(async (id: string, patch: { name?: string; live?: boolean; active?: boolean }) => {
    setPaymentGateways((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  const deletePaymentGateway = useCallback(async (id: string) => {
    setPaymentGateways((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const createPaymentLink = useCallback(async (data: { contactId: string; dealId?: string; amount: number; currency: string; description: string; gatewayId: string }) => {
    const link: PaymentLink = { id: `pl${Date.now()}`, tenantId, ...data, dealId: data.dealId || null, provider: (paymentGateways.find((g) => g.id === data.gatewayId)?.provider ?? 'stripe'), status: 'active', url: `https://checkout.example.com/demo/${Date.now()}`, expiresAt: new Date(Date.now() + 86400000).toISOString(), paidAt: null, createdAt: new Date().toISOString() }
    setPaymentLinks((prev) => [...prev, link])
    return link
  }, [tenantId, paymentGateways])

  const updatePaymentLink = useCallback(async (id: string, patch: { status?: string; paidAt?: string }) => {
    setPaymentLinks((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  const sendPaymentLink = useCallback(async (_id: string, _message?: string) => {
    // mock: no-op
  }, [])

  const createInvoice = useCallback(async (data: { contactId: string; dealId?: string; items: { description: string; qty: number; unitPrice: number }[]; currency?: string; dueDate?: string; notes?: string; taxPct?: number }) => {
    const subtotal = data.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
    const tax = data.taxPct ? Math.round(subtotal * (data.taxPct / 100) * 100) / 100 : 0
    const inv: Invoice = { id: `inv${Date.now()}`, tenantId, contactId: data.contactId, dealId: data.dealId || null, items: data.items, subtotal, tax, total: subtotal + tax, currency: data.currency || 'USD', dueDate: data.dueDate || null, notes: data.notes || '', status: 'draft', paidAt: null, createdAt: new Date().toISOString() }
    setInvoices((prev) => [...prev, inv])
    return inv
  }, [tenantId])

  const updateInvoice = useCallback(async (id: string, patch: { status?: string; paidAt?: string; notes?: string; dueDate?: string }) => {
    setInvoices((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  const deleteInvoice = useCallback(async (id: string) => {
    setInvoices((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const value: PortalState = {
    currentUser: null,
    logout,
    tenants,
    tenant,
    setTenantId,
    profile,
    updateProfile,
    gatewayKind,
    backendOnline: true,
    tags: seedTags,
    sessions,
    contacts,
    conversations,
    stats,
    botRules: botRules.filter((r) => r.tenantId === tenantId),
    botConfig,
    automations: automations.filter((a) => a.tenantId === tenantId),
    cannedResponses: cannedResponses.filter((x) => x.tenantId === tenantId),
    knowledgeBase: knowledgeBase.filter((x) => x.tenantId === tenantId),
    products: products.filter((x) => x.tenantId === tenantId),
    campaigns: campaigns.filter((x) => x.tenantId === tenantId),
    intents: intents.filter((x) => x.tenantId === tenantId),
    pipelineStages: pipelineStages.filter((x) => x.tenantId === tenantId),
    deals: deals.filter((x) => x.tenantId === tenantId),
    appointmentTypes: appointmentTypes.filter((x) => x.tenantId === tenantId),
    appointments: appointments.filter((x) => x.tenantId === tenantId),
    paymentGateways: paymentGateways.filter((x) => x.tenantId === tenantId),
    paymentLinks: paymentLinks.filter((x) => x.tenantId === tenantId),
    invoices: invoices.filter((x) => x.tenantId === tenantId),
    loading,
    messagesFor,
    ensureMessages,
    sendMessage,
    setConversationStatus,
    toggleConversationBot,
    assignConversation,
    markRead,
    startSession,
    createSession,
    deleteSession,
    toggleBotRule,
    saveBotRule,
    deleteBotRule,
    updateBotConfig,
    toggleAutomation,
    saveAutomation,
    deleteAutomation,
    saveContactNote,
    saveCannedResponse,
    updateCannedResponse,
    deleteCannedResponse,
    saveKbArticle,
    updateKbArticle,
    deleteKbArticle,
    sendBroadcast,
    saveProduct,
    updateProduct,
    deleteProduct,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    createIntent,
    updateIntent,
    deleteIntent,
    testIntent,
    createStage,
    updateStage,
    deleteStage,
    createDeal,
    updateDeal,
    deleteDeal,
    createAppointmentType,
    updateAppointmentType,
    deleteAppointmentType,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    createPaymentGateway,
    updatePaymentGateway,
    deletePaymentGateway,
    createPaymentLink,
    updatePaymentLink,
    sendPaymentLink,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    createTenant,
    updateTenant,
    deleteTenant,
    getTenantUsers,
    createTenantUser,
    deleteTenantUser,
  }

  return <PortalCtx.Provider value={value}>{children}</PortalCtx.Provider>
}
