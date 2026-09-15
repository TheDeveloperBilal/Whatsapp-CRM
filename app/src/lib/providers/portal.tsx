// ─── Live provider: all state backed by the local portal backend ────────────
// (Baileys WhatsApp engine + AI bot worker + JSON persistence).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { playHandoffSound, requestNotificationPermission, showBrowserNotification } from '@/lib/sound'
import { PortalClient, DEFAULT_BACKEND_URL } from '@/lib/backend'
import type { TenantUser } from '@/lib/backend'
import { PortalCtx } from '@/lib/portal-context'
import type { PortalState } from '@/lib/portal-state'
import { getUser, clearToken } from '@/lib/auth'
import { Spinner } from '@/components/ui/spinner'
import type {
  Tenant,
  AuthUser,
  Tag,
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
  Campaign,
  GatewayProfile,
  DashboardStats,
  ConversationStatus,
} from '@/types/portal'

const fallbackConfig = (tenantId: string): BotConfig => ({
  tenantId,
  aiEnabled: false,
  persona: '',
  fallback: 'human',
  fallbackMessage: '',
  businessHoursOnly: false,
  model: '',
})

interface Props {
  children: ReactNode
  profile: GatewayProfile
  updateProfile: (p: GatewayProfile) => void
}

export function LiveProvider({ children, profile, updateProfile }: Props) {
  const client = useMemo(
    () => new PortalClient(profile.baseUrl || DEFAULT_BACKEND_URL),
    [profile.baseUrl],
  )

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getUser)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState<string>('')
  const tenant = useMemo(
    () => tenants.find((t) => t.id === tenantId) ?? tenants[0],
    [tenants, tenantId],
  )

  // Sync currentUser when token changes (e.g. after login from another tab)
  useEffect(() => {
    const onStorage = () => setCurrentUser(getUser())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const [tags, setTags] = useState<Tag[]>([])
  const [sessions, setSessions] = useState<WaSession[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [botRules, setBotRules] = useState<BotRule[]>([])
  const [botConfig, setBotConfig] = useState<BotConfig>(fallbackConfig(''))
  const [automations, setAutomations] = useState<AutomationRule[]>([])
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([])
  const [knowledgeBase, setKnowledgeBase] = useState<KbArticle[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [msgCache, setMsgCache] = useState<Record<string, Message[]>>({})
  const [loading, setLoading] = useState(true)
  const tenantRef = useRef(tenant?.id)
  tenantRef.current = tenant?.id

  // request browser notification permission once on mount
  useEffect(() => { requestNotificationPermission() }, [])

  // initial tenant list + health
  useEffect(() => {
    let alive = true
    client
      .health()
      .then(() => alive && setBackendOnline(true))
      .catch(() => alive && setBackendOnline(false))
    client
      .tenants()
      .then((ts) => {
        if (!alive) return
        setTenants(ts)
        setTenantId((cur) => cur || ts[0]?.id || '')
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [client])

  // bootstrap per tenant
  useEffect(() => {
    if (!tenant?.id) return
    let alive = true
    setLoading(true)
    client
      .bootstrap(tenant.id)
      .then((b) => {
        if (!alive) return
        setTags(b.tags)
        setSessions(b.sessions)
        setContacts(b.contacts)
        setConversations(b.conversations)
        setBotRules(b.botRules)
        setBotConfig(b.botConfig ?? fallbackConfig(tenant.id))
        setAutomations(b.automations)
        setCannedResponses(b.cannedResponses ?? [])
        setKnowledgeBase(b.knowledgeBase ?? [])
        setProducts(b.products ?? [])
        setCampaigns(b.campaigns ?? [])
        setStats(b.stats)
        setMsgCache({})
        setBackendOnline(true)
      })
      .catch(() => setBackendOnline(false))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [client, tenant?.id])

  // realtime events
  useEffect(() => {
    return client.connect((e) => {
      switch (e.type) {
        case 'message': {
          if (e.conversation.tenantId !== tenantRef.current) break
          setConversations((prev) => {
            const rest = prev.filter((c) => c.id !== e.conversation.id)
            return [e.conversation, ...rest]
          })
          setContacts((prev) =>
            prev.some((c) => c.id === e.contact.id) ? prev : [...prev, e.contact],
          )
          setMsgCache((prev) => {
            const list = prev[e.conversation.id]
            if (!list || list.some((m) => m.id === e.message.id)) return prev
            return { ...prev, [e.conversation.id]: [...list, e.message] }
          })
          if (!e.message.fromMe) {
            toast.message(`💬 ${e.contact.name}`, { description: e.message.body })
          }
          break
        }
        case 'message.status':
          setMsgCache((prev) => ({
            ...prev,
            [e.conversationId]: (prev[e.conversationId] ?? []).map((m) =>
              m.id === e.id ? { ...m, status: e.status } : m,
            ),
          }))
          break
        case 'conversation':
          if (e.conversation.tenantId !== tenantRef.current) break
          setConversations((prev) =>
            prev.map((c) => (c.id === e.conversation.id ? e.conversation : c)),
          )
          break
        case 'contact':
          setContacts((prev) => {
            const exists = prev.some((c) => c.id === e.contact.id)
            return exists
              ? prev.map((c) => (c.id === e.contact.id ? e.contact : c))
              : [...prev, e.contact]
          })
          break
        case 'contacts.synced':
          if (e.tenantId === tenantRef.current && tenantRef.current) {
            client.bootstrap(tenantRef.current).then((b) => {
              setContacts(b.contacts)
              setConversations(b.conversations)
            })
          }
          break
        case 'session':
          setSessions((prev) => {
            const exists = prev.some((s) => s.id === e.session.id)
            return exists
              ? prev.map((s) => (s.id === e.session.id ? e.session : s))
              : [...prev, e.session]
          })
          break
        case 'session.deleted':
          setSessions((prev) => prev.filter((s) => s.id !== e.sessionId))
          break
        case 'bot.rule':
          setBotRules((prev) => {
            const exists = prev.some((r) => r.id === e.rule.id)
            return exists ? prev.map((r) => (r.id === e.rule.id ? e.rule : r)) : [...prev, e.rule]
          })
          break
        case 'bot.rule.deleted':
          setBotRules((prev) => prev.filter((r) => r.id !== e.ruleId))
          break
        case 'bot.config':
          if (e.config.tenantId === tenantRef.current) setBotConfig(e.config)
          break
        case 'automation': {
          const incoming = e.automation as AutomationRule
          setAutomations((prev) => {
            const exists = prev.some((a) => a.id === incoming.id)
            return exists ? prev.map((a) => (a.id === incoming.id ? incoming : a)) : [...prev, incoming]
          })
          break
        }
        case 'automation.deleted':
          setAutomations((prev) => prev.filter((a) => a.id !== e.automationId))
          break
        case 'canned.response': {
          const cr = e.cannedResponse as CannedResponse
          setCannedResponses((prev) => {
            const exists = prev.some((x) => x.id === cr.id)
            return exists ? prev.map((x) => (x.id === cr.id ? cr : x)) : [...prev, cr]
          })
          break
        }
        case 'canned.response.deleted':
          setCannedResponses((prev) => prev.filter((x) => x.id !== e.id))
          break
        case 'kb.article': {
          const a = e.article as KbArticle
          setKnowledgeBase((prev) => {
            const exists = prev.some((x) => x.id === a.id)
            return exists ? prev.map((x) => (x.id === a.id ? a : x)) : [...prev, a]
          })
          break
        }
        case 'kb.article.deleted':
          setKnowledgeBase((prev) => prev.filter((x) => x.id !== e.id))
          break
        case 'product': {
          const p = e.product as Product
          setProducts((prev) => {
            const exists = prev.some((x) => x.id === p.id)
            return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p]
          })
          break
        }
        case 'product.deleted':
          setProducts((prev) => prev.filter((x) => x.id !== e.id))
          break
        case 'human.requested': {
          // update conversation status in state
          setConversations((prev) =>
            prev.map((c) => c.id === e.conversation.id ? e.conversation : c),
          )
          // play alert sound (3-tone descending like tawk.to)
          playHandoffSound()
          // browser notification (works even when tab is in background)
          showBrowserNotification(
            '🔴 Human Agent Requested',
            `${e.contact.name} is asking to speak with a real person`,
          )
          // prominent in-app toast — stays for 15 seconds
          toast.error(`🔴 ${e.contact.name} needs a human agent`, {
            description: 'Bot has been paused — conversation moved to Pending',
            duration: 15000,
            action: { label: 'View', onClick: () => { window.location.hash = '' } },
          })
          break
        }
        case 'tenant': {
          const t = e.tenant as Tenant
          setTenants((prev) => {
            const exists = prev.some((x) => x.id === t.id)
            return exists ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t]
          })
          break
        }
        case 'tenant.deleted':
          setTenants((prev) => prev.filter((t) => t.id !== e.tenantId))
          break
        case 'campaign': {
          const camp = e.campaign as Campaign
          setCampaigns((prev) => {
            const exists = prev.some((x) => x.id === camp.id)
            return exists ? prev.map((x) => (x.id === camp.id ? camp : x)) : [...prev, camp]
          })
          break
        }
        case 'campaign.deleted':
          setCampaigns((prev) => prev.filter((x) => x.id !== e.id))
          break
      }
    })
  }, [client])

  // ── actions ────────────────────────────────────────────────────────────────

  const messagesFor = useCallback((cid: string) => msgCache[cid] ?? [], [msgCache])

  const ensureMessages = useCallback(
    async (cid: string) => {
      const msgs = await client.messages(cid).catch(() => [] as Message[])
      setMsgCache((prev) => ({ ...prev, [cid]: msgs }))
    },
    [client],
  )

  const sendMessage = useCallback(
    async (cid: string, text: string) => {
      const msg = await client.sendMessage(cid, text)
      setMsgCache((prev) => {
        const list = prev[cid] ?? []
        if (list.some((m) => m.id === msg.id)) return prev
        return { ...prev, [cid]: [...list, msg] }
      })
    },
    [client],
  )

  const patchConvLocal = useCallback((cid: string, patch: Partial<Conversation>) => {
    setConversations((prev) => prev.map((c) => (c.id === cid ? { ...c, ...patch } : c)))
  }, [])

  const setConversationStatus = useCallback(
    (cid: string, status: ConversationStatus) => {
      patchConvLocal(cid, { status })
      client.patchConversation(cid, { status }).catch(() => {})
    },
    [client, patchConvLocal],
  )

  const toggleConversationBot = useCallback(
    (cid: string) => {
      const cur = conversations.find((c) => c.id === cid)
      if (!cur) return
      patchConvLocal(cid, { botEnabled: !cur.botEnabled })
      client.patchConversation(cid, { botEnabled: !cur.botEnabled }).catch(() => {})
    },
    [client, conversations, patchConvLocal],
  )

  const assignConversation = useCallback(
    (cid: string, memberId: string | undefined) => {
      patchConvLocal(cid, { assigneeId: memberId })
      client.patchConversation(cid, { assigneeId: memberId }).catch(() => {})
    },
    [client, patchConvLocal],
  )

  const markRead = useCallback(
    (cid: string) => {
      patchConvLocal(cid, { unread: 0 })
      client.patchConversation(cid, { unread: 0 }).catch(() => {})
    },
    [client, patchConvLocal],
  )

  const startSession = useCallback(
    async (sid: string) => {
      const s = await client.startSession(sid)
      setSessions((prev) => prev.map((x) => (x.id === sid ? { ...x, ...s, name: x.name } : x)))
      return s
    },
    [client],
  )

  const createSession = useCallback(
    async (name: string) => {
      if (!tenant?.id) throw new Error('no tenant')
      const s = await client.createSession(tenant.id, name)
      setSessions((prev) => [...prev, s])
      return s
    },
    [client, tenant?.id],
  )

  const deleteSession = useCallback(
    async (sid: string) => {
      await client.deleteSession(sid)
      setSessions((prev) => prev.filter((s) => s.id !== sid))
    },
    [client],
  )

  const toggleBotRule = useCallback(
    (ruleId: string) => {
      const rule = botRules.find((r) => r.id === ruleId)
      if (!rule || !tenant?.id) return
      const next = { ...rule, enabled: !rule.enabled }
      setBotRules((prev) => prev.map((r) => (r.id === ruleId ? next : r)))
      client.saveBotRule(tenant.id, next).catch(() => {})
    },
    [client, botRules, tenant?.id],
  )

  const saveBotRule = useCallback(
    (rule: BotRule) => {
      if (!tenant?.id) return
      setBotRules((prev) =>
        prev.some((r) => r.id === rule.id)
          ? prev.map((r) => (r.id === rule.id ? rule : r))
          : [...prev, rule],
      )
      client.saveBotRule(tenant.id, rule).catch(() => {})
    },
    [client, tenant?.id],
  )

  const deleteBotRule = useCallback(
    (ruleId: string) => {
      setBotRules((prev) => prev.filter((r) => r.id !== ruleId))
      client.deleteBotRule(ruleId).catch(() => {})
    },
    [client],
  )

  const updateBotConfig = useCallback(
    (patch: Partial<BotConfig>) => {
      if (!tenant?.id) return
      setBotConfig((prev) => ({ ...prev, ...patch }))
      client.patchBotConfig(tenant.id, patch).catch(() => {})
    },
    [client, tenant?.id],
  )

  const toggleAutomation = useCallback(
    (id: string) => {
      const a = automations.find((x) => x.id === id)
      if (!a) return
      setAutomations((prev) => prev.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)))
      client.patchAutomation(id, { enabled: !a.enabled }).catch(() => {})
    },
    [client, automations],
  )

  const saveAutomation = useCallback(
    async (rule: Omit<AutomationRule, 'id' | 'tenantId'>) => {
      if (!tenant) return
      const created = await client.postAutomation(tenant.id, rule)
      setAutomations((prev) => [...prev, created])
    },
    [client, tenant],
  )

  const deleteAutomation = useCallback(
    async (id: string) => {
      setAutomations((prev) => prev.filter((a) => a.id !== id))
      await client.deleteAutomation(id).catch(() => {})
    },
    [client],
  )

  const saveContactNote = useCallback(
    (contactId: string, notes: string) => {
      setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, notes } : c)))
      client.patchContact(contactId, { notes }).catch(() => {})
    },
    [client],
  )

  const saveCannedResponse = useCallback(
    async (cr: Omit<CannedResponse, 'id' | 'tenantId'>) => {
      if (!tenant) return
      const created = await client.postCannedResponse(tenant.id, cr)
      setCannedResponses((prev) => [...prev, created])
    },
    [client, tenant],
  )

  const updateCannedResponse = useCallback(
    async (id: string, patch: Partial<CannedResponse>) => {
      const updated = await client.patchCannedResponse(id, patch)
      setCannedResponses((prev) => prev.map((x) => (x.id === id ? updated : x)))
    },
    [client],
  )

  const deleteCannedResponse = useCallback(
    async (id: string) => {
      setCannedResponses((prev) => prev.filter((x) => x.id !== id))
      await client.deleteCannedResponse(id).catch(() => {})
    },
    [client],
  )

  const saveKbArticle = useCallback(
    async (article: Omit<KbArticle, 'id' | 'tenantId'>) => {
      if (!tenant) return
      const created = await client.postKbArticle(tenant.id, article)
      setKnowledgeBase((prev) => [...prev, created])
    },
    [client, tenant],
  )

  const updateKbArticle = useCallback(
    async (id: string, patch: Partial<KbArticle>) => {
      const updated = await client.patchKbArticle(id, patch)
      setKnowledgeBase((prev) => prev.map((x) => (x.id === id ? updated : x)))
    },
    [client],
  )

  const deleteKbArticle = useCallback(
    async (id: string) => {
      setKnowledgeBase((prev) => prev.filter((x) => x.id !== id))
      await client.deleteKbArticle(id).catch(() => {})
    },
    [client],
  )

  const sendBroadcast = useCallback(
    async (message: string, contactIds: string[]) => {
      if (!tenant) throw new Error('no tenant')
      const result = await client.broadcast(tenant.id, message, contactIds)
      return { sent: result.sent, failed: result.failed }
    },
    [client, tenant],
  )

  const saveProduct = useCallback(
    async (product: Omit<Product, 'id' | 'tenantId'>) => {
      if (!tenant) return
      const created = await client.postProduct(tenant.id, product)
      setProducts((prev) => [...prev, created])
    },
    [client, tenant],
  )

  const updateProduct = useCallback(
    async (id: string, patch: Partial<Product>) => {
      const updated = await client.patchProduct(id, patch)
      setProducts((prev) => prev.map((x) => (x.id === id ? updated : x)))
    },
    [client],
  )

  const deleteProduct = useCallback(
    async (id: string) => {
      setProducts((prev) => prev.filter((x) => x.id !== id))
      await client.deleteProduct(id).catch(() => {})
    },
    [client],
  )

  const createCampaign = useCallback(
    async (data: Omit<Campaign, 'id' | 'tenantId' | 'leads' | 'createdAt'>) => {
      if (!tenant) throw new Error('no tenant')
      const created = await client.createCampaign(tenant.id, data)
      setCampaigns((prev) => [...prev, created])
      return created
    },
    [client, tenant],
  )

  const updateCampaign = useCallback(
    async (id: string, patch: Partial<Campaign>) => {
      const updated = await client.updateCampaign(id, patch)
      setCampaigns((prev) => prev.map((x) => (x.id === id ? updated : x)))
    },
    [client],
  )

  const deleteCampaign = useCallback(
    async (id: string) => {
      setCampaigns((prev) => prev.filter((x) => x.id !== id))
      await client.deleteCampaign(id).catch(() => {})
    },
    [client],
  )

  const logout = useCallback(() => {
    clearToken()
    window.location.href = '/'
  }, [])

  const createTenant = useCallback(
    async (data: { name: string; slug: string; plan: string; adminUsername: string; adminPassword: string }) => {
      const result = await client.createTenant(data)
      // WS 'tenant' event handles adding to state; avoid double-add here
      setTenants((prev) =>
        prev.some((t) => t.id === result.tenant.id) ? prev : [...prev, result.tenant],
      )
      return result.tenant
    },
    [client],
  )

  const updateTenant = useCallback(
    async (id: string, patch: { name?: string; plan?: string; suspended?: boolean }) => {
      const updated = await client.updateTenant(id, patch)
      setTenants((prev) => prev.map((t) => (t.id === id ? updated : t)))
    },
    [client],
  )

  const deleteTenant = useCallback(
    async (id: string) => {
      await client.deleteTenant(id)
      setTenants((prev) => prev.filter((t) => t.id !== id))
    },
    [client],
  )

  const getTenantUsers = useCallback(
    (tenantId: string) => client.getTenantUsers(tenantId),
    [client],
  )

  const createTenantUser = useCallback(
    async (tenantId: string, data: { username: string; password: string; role?: string }): Promise<TenantUser> => {
      return client.createTenantUser(tenantId, data)
    },
    [client],
  )

  const deleteTenantUser = useCallback(
    async (tenantId: string, userId: string) => {
      await client.deleteTenantUser(tenantId, userId)
    },
    [client],
  )

  if (!tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <Spinner className="size-8 text-primary" />
        <div className="text-center">
          <p className="text-lg font-semibold">
            {backendOnline === false ? 'Backend offline' : 'Connecting to backend…'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {backendOnline === false
              ? 'Make sure the portal backend started. Check the terminal for errors, then refresh.'
              : 'Starting WhatsApp engine at localhost:8787 — this takes a few seconds.'}
          </p>
        </div>
        {backendOnline === false && (
          <button
            className="mt-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  const value: PortalState = {
    currentUser,
    logout,
    tenants,
    tenant,
    setTenantId,
    profile,
    updateProfile,
    gatewayKind: 'portal (baileys)',
    backendOnline,
    tags,
    sessions,
    contacts,
    conversations,
    stats,
    botRules,
    botConfig,
    automations,
    cannedResponses,
    knowledgeBase,
    products,
    campaigns,
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
    createTenant,
    updateTenant,
    deleteTenant,
    getTenantUsers,
    createTenantUser,
    deleteTenantUser,
  }

  return <PortalCtx.Provider value={value}>{children}</PortalCtx.Provider>
}
