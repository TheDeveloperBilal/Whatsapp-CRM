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
  CannedResponse,
  KbArticle,
  Product,
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

  const updateTenant = useCallback(async (_id: string, _patch: { name?: string; plan?: string; businessType?: string; suspended?: boolean }) => {}, [])
  const deleteTenant = useCallback(async (_id: string) => {}, [])
  const getTenantUsers = useCallback(async (_tenantId: string): Promise<TenantUser[]> => [], [])
  const createTenantUser = useCallback(async (tenantId: string, data: { username: string; password: string; role?: string }): Promise<TenantUser> => {
    return { id: `usr${Date.now()}`, username: data.username, tenantId, role: data.role ?? 'agent' }
  }, [])
  const deleteTenantUser = useCallback(async (_tenantId: string, _userId: string) => {}, [])

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
    createTenant,
    updateTenant,
    deleteTenant,
    getTenantUsers,
    createTenantUser,
    deleteTenantUser,
  }

  return <PortalCtx.Provider value={value}>{children}</PortalCtx.Provider>
}
