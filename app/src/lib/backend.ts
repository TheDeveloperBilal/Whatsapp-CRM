// ─── Portal backend client (REST + WebSocket) ───────────────────────────────
// In production Express serves both API and frontend on the same port,
// so we use a relative URL. In dev the backend is on :8787 separately.
export const DEFAULT_BACKEND_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.PROD ? '' : 'http://localhost:8787')
import type {
  Tenant,
  Tag,
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
  AuthUser,
  DashboardStats,
  Workflow,
  WorkflowRun,
} from '@/types/portal'
import { getToken, clearToken } from '@/lib/auth'

export interface Bootstrap {
  tags: Tag[]
  sessions: WaSession[]
  contacts: Contact[]
  conversations: Conversation[]
  botRules: BotRule[]
  botConfig: BotConfig | null
  automations: AutomationRule[]
  cannedResponses: CannedResponse[]
  knowledgeBase: KbArticle[]
  products: Product[]
  campaigns: Campaign[]
  intents: IntentRule[]
  pipelineStages: PipelineStage[]
  deals: Deal[]
  appointmentTypes: AppointmentType[]
  appointments: Appointment[]
  paymentGateways: PaymentGateway[]
  paymentLinks: PaymentLink[]
  invoices: Invoice[]
  stats: DashboardStats
}

export type ServerEvent =
  | { type: 'message'; message: Message; conversation: Conversation; contact: Contact }
  | { type: 'message.status'; id: string; conversationId: string; status: Message['status'] }
  | { type: 'conversation'; conversation: Conversation }
  | { type: 'contact'; contact: Contact }
  | { type: 'contacts.synced'; tenantId: string }
  | { type: 'session'; session: WaSession }
  | { type: 'session.deleted'; sessionId: string }
  | { type: 'bot.rule'; rule: BotRule }
  | { type: 'bot.rule.deleted'; ruleId: string }
  | { type: 'bot.config'; config: BotConfig }
  | { type: 'automation'; automation: AutomationRule }
  | { type: 'automation.deleted'; automationId: string }
  | { type: 'canned.response'; cannedResponse: CannedResponse }
  | { type: 'canned.response.deleted'; id: string }
  | { type: 'kb.article'; article: KbArticle }
  | { type: 'kb.article.deleted'; id: string }
  | { type: 'product'; product: Product }
  | { type: 'product.deleted'; id: string }
  | { type: 'human.requested'; conversation: Conversation; contact: Contact }
  | { type: 'tenant'; tenant: Tenant }
  | { type: 'tenant.deleted'; tenantId: string }
  | { type: 'campaign'; campaign: Campaign }
  | { type: 'campaign.deleted'; id: string }
  | { type: 'intent'; intent: IntentRule }
  | { type: 'intent.deleted'; id: string }
  | { type: 'pipeline.stage'; stage: PipelineStage }
  | { type: 'pipeline.stage.deleted'; id: string }
  | { type: 'deal'; deal: Deal }
  | { type: 'deal.deleted'; id: string }
  | { type: 'appointment.type'; appointmentType: AppointmentType }
  | { type: 'appointment.type.deleted'; id: string }
  | { type: 'appointment'; appointment: Appointment }
  | { type: 'appointment.deleted'; id: string }
  | { type: 'payment.gateway'; gateway: PaymentGateway }
  | { type: 'payment.gateway.deleted'; id: string }
  | { type: 'payment.link'; link: PaymentLink }
  | { type: 'invoice'; invoice: Invoice }
  | { type: 'invoice.deleted'; id: string }

export interface TenantUser {
  id: string
  username: string
  tenantId: string
  role: string
}

export class PortalClient {
  baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const token = getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> ?? {}) }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${this.baseUrl}/api${path}`, { ...init, headers })
    if (res.status === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('portal:unauthorized'))
      throw new Error('unauthorized')
    }
    if (!res.ok) throw new Error(`portal ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return res.json() as Promise<T>
  }

  login(username: string, password: string) {
    return this.req<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  }

  changePassword(oldPassword: string, newPassword: string) {
    return this.req<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    })
  }

  health() {
    return this.req<{ ok: boolean; ai: { configured: boolean; model: string } }>('/health')
  }
  tenants() {
    return this.req<Tenant[]>('/tenants')
  }
  bootstrap(tenantId: string) {
    return this.req<Bootstrap>(`/tenants/${tenantId}/bootstrap`)
  }
  messages(conversationId: string) {
    return this.req<Message[]>(`/conversations/${conversationId}/messages`)
  }
  sendMessage(conversationId: string, text: string) {
    return this.req<Message>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  }
  patchConversation(conversationId: string, patch: Partial<Conversation>) {
    return this.req<Conversation>(`/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  patchContact(contactId: string, patch: Partial<Contact>) {
    return this.req<Contact>(`/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  createSession(tenantId: string, name: string) {
    return this.req<WaSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ tenantId, name }),
    })
  }
  startSession(sessionId: string) {
    return this.req<WaSession>(`/sessions/${sessionId}/start`, { method: 'POST' })
  }
  deleteSession(sessionId: string) {
    return this.req<{ ok: boolean }>(`/sessions/${sessionId}`, { method: 'DELETE' })
  }
  saveBotRule(tenantId: string, rule: BotRule) {
    return this.req<BotRule>(`/tenants/${tenantId}/bot-rules`, {
      method: 'POST',
      body: JSON.stringify(rule),
    })
  }
  deleteBotRule(ruleId: string) {
    return this.req<{ ok: boolean }>(`/bot-rules/${ruleId}`, { method: 'DELETE' })
  }
  patchBotConfig(tenantId: string, patch: Partial<BotConfig>) {
    return this.req<BotConfig>(`/tenants/${tenantId}/bot-config`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  patchAutomation(id: string, patch: Partial<AutomationRule>) {
    return this.req<AutomationRule>(`/automations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  postAutomation(tenantId: string, rule: Omit<AutomationRule, 'id' | 'tenantId'>) {
    return this.req<AutomationRule>(`/tenants/${tenantId}/automations`, {
      method: 'POST',
      body: JSON.stringify(rule),
    })
  }
  deleteAutomation(id: string) {
    return this.req<{ ok: boolean }>(`/automations/${id}`, { method: 'DELETE' })
  }

  // ── Canned responses ──
  postCannedResponse(tenantId: string, cr: Omit<CannedResponse, 'id' | 'tenantId'>) {
    return this.req<CannedResponse>(`/tenants/${tenantId}/canned-responses`, {
      method: 'POST',
      body: JSON.stringify(cr),
    })
  }
  patchCannedResponse(id: string, patch: Partial<CannedResponse>) {
    return this.req<CannedResponse>(`/canned-responses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  deleteCannedResponse(id: string) {
    return this.req<{ ok: boolean }>(`/canned-responses/${id}`, { method: 'DELETE' })
  }

  // ── Knowledge base ──
  postKbArticle(tenantId: string, article: Omit<KbArticle, 'id' | 'tenantId'>) {
    return this.req<KbArticle>(`/tenants/${tenantId}/kb`, {
      method: 'POST',
      body: JSON.stringify(article),
    })
  }
  patchKbArticle(id: string, patch: Partial<KbArticle>) {
    return this.req<KbArticle>(`/kb/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  deleteKbArticle(id: string) {
    return this.req<{ ok: boolean }>(`/kb/${id}`, { method: 'DELETE' })
  }

  // ── Products ──
  postProduct(tenantId: string, product: Omit<Product, 'id' | 'tenantId'>) {
    return this.req<Product>(`/tenants/${tenantId}/products`, {
      method: 'POST',
      body: JSON.stringify(product),
    })
  }
  patchProduct(id: string, patch: Partial<Product>) {
    return this.req<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  deleteProduct(id: string) {
    return this.req<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' })
  }

  // ── Tenant CRUD (superadmin) ──
  createTenant(data: { name: string; slug: string; plan: string; businessType: string; adminUsername: string; adminPassword: string }) {
    return this.req<{ tenant: Tenant; user: TenantUser }>('/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
  updateTenant(id: string, patch: { name?: string; plan?: string; businessType?: string; suspended?: boolean }) {
    return this.req<Tenant>(`/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  deleteTenant(id: string) {
    return this.req<{ ok: boolean }>(`/tenants/${id}`, { method: 'DELETE' })
  }
  getTenantUsers(tenantId: string) {
    return this.req<TenantUser[]>(`/tenants/${tenantId}/users`)
  }
  createTenantUser(tenantId: string, data: { username: string; password: string; role?: string }) {
    return this.req<TenantUser>(`/tenants/${tenantId}/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
  deleteTenantUser(tenantId: string, userId: string) {
    return this.req<{ ok: boolean }>(`/tenants/${tenantId}/users/${userId}`, { method: 'DELETE' })
  }

  // ── Campaigns ──
  listCampaigns(tenantId: string) {
    return this.req<Campaign[]>(`/tenants/${tenantId}/campaigns`)
  }
  createCampaign(tenantId: string, data: Omit<Campaign, 'id' | 'tenantId' | 'leads' | 'createdAt'>) {
    return this.req<Campaign>(`/tenants/${tenantId}/campaigns`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
  updateCampaign(id: string, patch: Partial<Campaign>) {
    return this.req<Campaign>(`/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  deleteCampaign(id: string) {
    return this.req<{ ok: boolean }>(`/campaigns/${id}`, { method: 'DELETE' })
  }

  // ── Intents ──
  listIntents(tenantId: string) {
    return this.req<IntentRule[]>(`/tenants/${tenantId}/intents`)
  }
  createIntent(tenantId: string, data: Omit<IntentRule, 'id' | 'tenantId' | 'matchCount' | 'createdAt'>) {
    return this.req<IntentRule>(`/tenants/${tenantId}/intents`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
  updateIntent(id: string, patch: Partial<IntentRule>) {
    return this.req<IntentRule>(`/intents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  deleteIntent(id: string) {
    return this.req<{ ok: boolean }>(`/intents/${id}`, { method: 'DELETE' })
  }
  testIntent(tenantId: string, message: string) {
    return this.req<{ matched: IntentRule | null }>(`/intents/test`, {
      method: 'POST',
      body: JSON.stringify({ tenantId, message }),
    })
  }

  // ── Pipeline Stages ──
  createStage(tenantId: string, data: { name: string; color: string; pipelineId?: string | null }) {
    return this.req<PipelineStage>(`/tenants/${tenantId}/pipeline-stages`, { method: 'POST', body: JSON.stringify(data) })
  }
  updateStage(id: string, patch: Partial<PipelineStage>) {
    return this.req<PipelineStage>(`/pipeline-stages/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }
  deleteStage(id: string) {
    return this.req<{ ok: boolean }>(`/pipeline-stages/${id}`, { method: 'DELETE' })
  }

  // ── Deals ──
  createDeal(tenantId: string, data: Omit<Deal, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) {
    return this.req<Deal>(`/tenants/${tenantId}/deals`, { method: 'POST', body: JSON.stringify(data) })
  }
  updateDeal(id: string, patch: Partial<Deal>) {
    return this.req<Deal>(`/deals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }
  deleteDeal(id: string) {
    return this.req<{ ok: boolean }>(`/deals/${id}`, { method: 'DELETE' })
  }

  // ── Appointment Types ──
  createAppointmentType(tenantId: string, data: Omit<AppointmentType, 'id' | 'tenantId'>) {
    return this.req<AppointmentType>(`/tenants/${tenantId}/appointment-types`, { method: 'POST', body: JSON.stringify(data) })
  }
  updateAppointmentType(id: string, patch: Partial<AppointmentType>) {
    return this.req<AppointmentType>(`/appointment-types/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }
  deleteAppointmentType(id: string) {
    return this.req<{ ok: boolean }>(`/appointment-types/${id}`, { method: 'DELETE' })
  }

  // ── Appointments ──
  createAppointment(tenantId: string, data: Omit<Appointment, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) {
    return this.req<Appointment>(`/tenants/${tenantId}/appointments`, { method: 'POST', body: JSON.stringify(data) })
  }
  updateAppointment(id: string, patch: Partial<Appointment>) {
    return this.req<Appointment>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }
  deleteAppointment(id: string) {
    return this.req<{ ok: boolean }>(`/appointments/${id}`, { method: 'DELETE' })
  }

  // ── Payment Gateways ──
  createPaymentGateway(tenantId: string, data: { provider: string; name: string; secretKey: string; publicKey?: string; webhookSecret?: string; live?: boolean }) {
    return this.req<PaymentGateway>(`/tenants/${tenantId}/payment-gateways`, { method: 'POST', body: JSON.stringify(data) })
  }
  updatePaymentGateway(id: string, patch: { name?: string; secretKey?: string; publicKey?: string; webhookSecret?: string; live?: boolean; active?: boolean }) {
    return this.req<PaymentGateway>(`/payment-gateways/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }
  deletePaymentGateway(id: string) {
    return this.req<{ ok: boolean }>(`/payment-gateways/${id}`, { method: 'DELETE' })
  }

  // ── Payment Links ──
  createPaymentLink(tenantId: string, data: { contactId: string; dealId?: string; amount: number; currency: string; description: string; gatewayId: string; expiresInHours?: number }) {
    return this.req<PaymentLink>(`/tenants/${tenantId}/payment-links`, { method: 'POST', body: JSON.stringify(data) })
  }
  updatePaymentLink(id: string, patch: { status?: string; paidAt?: string }) {
    return this.req<PaymentLink>(`/payment-links/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }
  sendPaymentLink(id: string, message?: string) {
    return this.req<{ ok: boolean }>(`/payment-links/${id}/send`, { method: 'POST', body: JSON.stringify({ message }) })
  }

  // ── Invoices ──
  createInvoice(tenantId: string, data: { contactId: string; dealId?: string; items: { description: string; qty: number; unitPrice: number }[]; currency?: string; dueDate?: string; notes?: string; taxPct?: number }) {
    return this.req<Invoice>(`/tenants/${tenantId}/invoices`, { method: 'POST', body: JSON.stringify(data) })
  }
  updateInvoice(id: string, patch: { status?: string; paidAt?: string; notes?: string; dueDate?: string }) {
    return this.req<Invoice>(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }
  deleteInvoice(id: string) {
    return this.req<{ ok: boolean }>(`/invoices/${id}`, { method: 'DELETE' })
  }

  // ── Broadcast ──
  broadcast(tenantId: string, message: string, contactIds: string[]) {
    return this.req<{ sent: number; failed: number; results: { contactId: string; ok: boolean; error?: string }[] }>(
      `/tenants/${tenantId}/broadcast`,
      { method: 'POST', body: JSON.stringify({ message, contactIds }) },
    )
  }

  // ── Contact phone normalization ──
  fixContactPhones(tenantId: string) {
    return this.req<{ fixed: number; total: number }>(`/tenants/${tenantId}/contacts/fix-phones`, { method: 'POST' })
  }

  // ── Tenant profile (owner-accessible) ──
  updateTenantProfile(tenantId: string, patch: { name?: string; businessType?: string }) {
    return this.req<{ id: string; name: string; businessType?: string }>(`/tenants/${tenantId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }

  // ── Contacts: bulk CSV import ──
  importContacts(tenantId: string, contacts: { name?: string; phone: string; notes?: string }[]) {
    return this.req<{ created: number; skipped: number }>(`/tenants/${tenantId}/contacts/import`, {
      method: 'POST',
      body: JSON.stringify({ contacts }),
    })
  }

  // ── Named Pipelines ──
  getPipelines(tenantId: string) {
    return this.req<{ id: string; name: string; department: string; tenantId: string; createdAt: string }[]>(
      `/tenants/${tenantId}/pipelines`,
    )
  }
  createPipeline(tenantId: string, data: { name: string; department: string }) {
    return this.req<{ id: string; name: string; department: string; tenantId: string; createdAt: string }>(
      `/tenants/${tenantId}/pipelines`,
      { method: 'POST', body: JSON.stringify(data) },
    )
  }
  updatePipeline(id: string, patch: { name?: string; department?: string }) {
    return this.req<{ id: string; name: string; department: string }>(`/pipelines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
  deletePipeline(id: string) {
    return this.req<{ ok: boolean }>(`/pipelines/${id}`, { method: 'DELETE' })
  }

  // ── Workflows ──
  workflows(tenantId: string) {
    return this.req<Workflow[]>(`/tenants/${tenantId}/workflows`)
  }
  createWorkflow(tenantId: string, data: Partial<Workflow>) {
    return this.req<Workflow>(`/tenants/${tenantId}/workflows`, { method: 'POST', body: JSON.stringify(data) })
  }
  updateWorkflow(tenantId: string, id: string, data: Partial<Workflow>) {
    return this.req<Workflow>(`/tenants/${tenantId}/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  toggleWorkflow(tenantId: string, id: string) {
    return this.req<Workflow>(`/tenants/${tenantId}/workflows/${id}/toggle`, { method: 'PATCH' })
  }
  deleteWorkflow(tenantId: string, id: string) {
    return this.req<{ ok: boolean }>(`/tenants/${tenantId}/workflows/${id}`, { method: 'DELETE' })
  }
  workflowRuns(tenantId: string, workflowId: string) {
    return this.req<WorkflowRun[]>(`/tenants/${tenantId}/workflows/${workflowId}/runs`)
  }
  triggerWorkflow(tenantId: string, workflowId: string, context?: Record<string, any>) {
    return this.req<{ ok: boolean }>(`/tenants/${tenantId}/workflows/${workflowId}/trigger`, { method: 'POST', body: JSON.stringify({ context }) })
  }

  connect(onEvent: (e: ServerEvent) => void): () => void {
    const token = getToken()
    const wsUrl = `${this.baseUrl.replace(/^http/, 'ws')}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`
    let ws: WebSocket | null = null
    let closed = false
    let retry: ReturnType<typeof setTimeout>

    const open = () => {
      ws = new WebSocket(wsUrl)
      ws.onmessage = (ev) => {
        try {
          onEvent(JSON.parse(ev.data) as ServerEvent)
        } catch {
          /* ignore malformed frames */
        }
      }
      ws.onclose = () => {
        if (!closed) retry = setTimeout(open, 3000) // auto-reconnect
      }
    }
    open()

    return () => {
      closed = true
      clearTimeout(retry)
      ws?.close()
    }
  }
}
