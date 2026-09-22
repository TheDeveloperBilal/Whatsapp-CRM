// Shared contract between the two store providers (live backend / demo mock)
// and the pages that consume them via usePortal().

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
import type { TenantUser, PortalClient } from '@/lib/backend'

export interface PortalState {
  // backend client (for workflow and other direct API calls)
  client: PortalClient
  // auth
  currentUser: AuthUser | null
  logout: () => void
  // tenancy
  tenants: Tenant[]
  tenant: Tenant
  setTenantId: (id: string) => void
  // gateway/backend
  profile: GatewayProfile
  updateProfile: (p: GatewayProfile) => void
  gatewayKind: string
  backendOnline: boolean | null
  // data
  tags: Tag[]
  sessions: WaSession[]
  contacts: Contact[]
  conversations: Conversation[]
  stats: DashboardStats | null
  botRules: BotRule[]
  botConfig: BotConfig
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
  loading: boolean
  // actions
  messagesFor: (conversationId: string) => Message[]
  ensureMessages: (conversationId: string) => Promise<void>
  sendMessage: (conversationId: string, text: string) => Promise<void>
  setConversationStatus: (conversationId: string, status: ConversationStatus) => void
  toggleConversationBot: (conversationId: string) => void
  assignConversation: (conversationId: string, memberId: string | undefined) => void
  markRead: (conversationId: string) => void
  startSession: (sessionId: string) => Promise<WaSession>
  createSession: (name: string, engine?: string) => Promise<WaSession>
  deleteSession: (sessionId: string) => Promise<void>
  toggleBotRule: (ruleId: string) => void
  saveBotRule: (rule: BotRule) => void
  deleteBotRule: (ruleId: string) => void
  updateBotConfig: (patch: Partial<BotConfig>) => void
  toggleAutomation: (id: string) => void
  saveAutomation: (rule: Omit<AutomationRule, 'id' | 'tenantId'>) => Promise<void>
  deleteAutomation: (id: string) => Promise<void>
  saveContactNote: (contactId: string, notes: string) => void
  // canned responses
  saveCannedResponse: (cr: Omit<CannedResponse, 'id' | 'tenantId'>) => Promise<void>
  updateCannedResponse: (id: string, patch: Partial<CannedResponse>) => Promise<void>
  deleteCannedResponse: (id: string) => Promise<void>
  // knowledge base
  saveKbArticle: (article: Omit<KbArticle, 'id' | 'tenantId'>) => Promise<void>
  updateKbArticle: (id: string, patch: Partial<KbArticle>) => Promise<void>
  deleteKbArticle: (id: string) => Promise<void>
  // broadcast
  sendBroadcast: (message: string, contactIds: string[]) => Promise<{ sent: number; failed: number }>
  // products
  saveProduct: (product: Omit<Product, 'id' | 'tenantId'>) => Promise<void>
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  // campaigns
  createCampaign: (data: Omit<Campaign, 'id' | 'tenantId' | 'leads' | 'createdAt'>) => Promise<Campaign>
  updateCampaign: (id: string, patch: Partial<Campaign>) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>
  // intents
  createIntent: (data: Omit<IntentRule, 'id' | 'tenantId' | 'matchCount' | 'createdAt'>) => Promise<IntentRule>
  updateIntent: (id: string, patch: Partial<IntentRule>) => Promise<void>
  deleteIntent: (id: string) => Promise<void>
  testIntent: (message: string) => Promise<IntentRule | null>
  // pipeline
  createStage: (data: { name: string; color: string }) => Promise<PipelineStage>
  updateStage: (id: string, patch: Partial<PipelineStage>) => Promise<void>
  deleteStage: (id: string) => Promise<void>
  createDeal: (data: Omit<Deal, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Deal>
  updateDeal: (id: string, patch: Partial<Deal>) => Promise<void>
  deleteDeal: (id: string) => Promise<void>
  // booking
  createAppointmentType: (data: Omit<AppointmentType, 'id' | 'tenantId'>) => Promise<AppointmentType>
  updateAppointmentType: (id: string, patch: Partial<AppointmentType>) => Promise<void>
  deleteAppointmentType: (id: string) => Promise<void>
  createAppointment: (data: Omit<Appointment, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Appointment>
  updateAppointment: (id: string, patch: Partial<Appointment>) => Promise<void>
  deleteAppointment: (id: string) => Promise<void>
  // payments
  createPaymentGateway: (data: { provider: string; name: string; secretKey: string; publicKey?: string; webhookSecret?: string; live?: boolean }) => Promise<PaymentGateway>
  updatePaymentGateway: (id: string, patch: { name?: string; secretKey?: string; publicKey?: string; live?: boolean; active?: boolean }) => Promise<void>
  deletePaymentGateway: (id: string) => Promise<void>
  createPaymentLink: (data: { contactId: string; dealId?: string; amount: number; currency: string; description: string; gatewayId: string }) => Promise<PaymentLink>
  updatePaymentLink: (id: string, patch: { status?: string; paidAt?: string }) => Promise<void>
  sendPaymentLink: (id: string, message?: string) => Promise<void>
  createInvoice: (data: { contactId: string; dealId?: string; items: { description: string; qty: number; unitPrice: number }[]; currency?: string; dueDate?: string; notes?: string; taxPct?: number }) => Promise<Invoice>
  updateInvoice: (id: string, patch: { status?: string; paidAt?: string; notes?: string; dueDate?: string }) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  // tenant management (superadmin)
  createTenant: (data: { name: string; slug: string; plan: string; businessType: string; adminUsername: string; adminPassword: string }) => Promise<Tenant>
  updateTenant: (id: string, patch: { name?: string; plan?: string; businessType?: string; suspended?: boolean }) => Promise<void>
  deleteTenant: (id: string) => Promise<void>
  getTenantUsers: (tenantId: string) => Promise<TenantUser[]>
  createTenantUser: (tenantId: string, data: { username: string; password: string; role?: string }) => Promise<TenantUser>
  deleteTenantUser: (tenantId: string, userId: string) => Promise<void>
}
