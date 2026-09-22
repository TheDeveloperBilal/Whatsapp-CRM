// ─── Multi-tenant WhatsApp CRM — domain model ────────────────────────────────
// Tenant > Sessions (WhatsApp numbers) > Contacts > Conversations > Messages
// This model is gateway-agnostic: the same shapes are produced by the OpenWA,
// Evolution API and Mock adapters in src/lib/gateway/.

export type TenantRole = 'owner' | 'admin' | 'agent' | 'viewer'

export type BusinessType = 'service' | 'digital' | 'physical'

export const BUSINESS_TYPE_META: Record<BusinessType, { label: string; emoji: string; productLabel: string; color: string }> = {
  service:  { label: 'Service Business',   emoji: '🛠️', productLabel: 'Services',         color: 'blue'   },
  digital:  { label: 'Digital Products',   emoji: '💻', productLabel: 'Digital Products',  color: 'purple' },
  physical: { label: 'Physical Products',  emoji: '📦', productLabel: 'Product Catalog',   color: 'orange' },
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: TenantRole
  online: boolean
}

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro' | 'business'
  businessType: BusinessType
  suspended?: boolean
  members: TeamMember[]
  createdAt: string
}

export interface AuthUser {
  userId: string
  username: string
  tenantId: string | null
  role: string
  exp: number
}

export type SessionStatus = 'connected' | 'connecting' | 'qr' | 'disconnected'
export type EngineType = 'whatsapp-web.js' | 'baileys' | 'cloud-api'

export interface WaSession {
  id: string
  tenantId: string
  name: string
  phone?: string
  engine: EngineType
  status: SessionStatus
  qrCode?: string // data-url or raw QR payload while status === 'qr'
  messagesToday: number
  lastSeen?: string
}

export interface Tag {
  id: string
  label: string
  color: string // tailwind-ish hex
}

export interface Contact {
  id: string
  tenantId: string
  name: string
  phone: string
  chatId: string // gateway jid e.g. 62812...@c.us
  avatarHue: number
  tags: string[] // tag ids
  notes: string
  lastMessageAt?: string
  optedIn: boolean
  source?: string       // e.g. 'direct', 'meta_ads', 'qr', campaign tracking code
  campaignId?: string   // campaign that brought this contact in
}

export interface Message {
  id: string
  conversationId: string
  fromMe: boolean
  senderName?: string
  body: string
  type: 'text' | 'image' | 'audio' | 'document' | 'video'
  mediaUrl?: string | null
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  byBot: boolean
  timestamp: string
}

export type ConversationStatus = 'open' | 'pending' | 'resolved'

export interface Conversation {
  id: string
  tenantId: string
  sessionId: string
  contactId: string
  status: ConversationStatus
  assigneeId?: string
  botEnabled: boolean // AI auto-responder armed on this thread
  unread: number
  lastMessage?: Message
  updatedAt: string
}

// ─── AI Auto-Responder ───────────────────────────────────────────────────────
export interface BotRule {
  id: string
  tenantId: string
  name: string
  enabled: boolean
  matchType: 'keyword' | 'regex' | 'intent'
  pattern: string // keyword(s), comma separated, or regex
  response: string
  sessionIds: string[] // empty = all sessions
}

export interface BotConfig {
  tenantId: string
  aiEnabled: boolean
  persona: string
  fallback: 'human' | 'message'
  fallbackMessage: string
  businessHoursOnly: boolean
  model: string
}

// ─── Automation ──────────────────────────────────────────────────────────────
export interface AutomationCondition {
  field: 'message.body' | 'contact.tags' | 'contact.phone' | 'contact.source' | 'conversation.assignee'
  operator: 'contains' | 'not_contains' | 'equals' | 'starts_with' | 'is_empty'
  value: string
}

export interface AutomationRule {
  id: string
  tenantId: string
  name: string
  enabled: boolean
  trigger: string
  conditions?: AutomationCondition[]
  conditionsMode?: 'and' | 'or'
  condition?: string  // legacy free-text (kept for backward compat)
  action: string
  actionTarget?: string
}

// ─── Intent Routing ──────────────────────────────────────────────────────────
export interface IntentRule {
  id: string
  tenantId: string
  name: string
  color: string
  keywords: string[]
  enabled: boolean
  action: 'add-tag' | 'assign-agent' | 'send-message' | 'webhook' | 'none'
  actionTarget?: string
  priority: number
  matchCount: number
  createdAt: string
}

// ─── Canned Responses ────────────────────────────────────────────────────────
export interface CannedResponse {
  id: string
  tenantId: string
  title: string
  shortcut: string // e.g. /refund, /greeting
  body: string
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────
export interface KbArticle {
  id: string
  tenantId: string
  title: string
  category: string
  body: string
  content?: string  // legacy alias — prefer body
}

// ─── Product Catalog ─────────────────────────────────────────────────────────
export type ProductType = 'physical' | 'digital' | 'service'

export interface ProductVariant {
  name: string        // e.g. "Color", "Size"
  options: string[]   // e.g. ["Red", "Blue"]
}

export interface Product {
  id: string
  tenantId: string
  type: ProductType
  name: string
  category: string
  description: string
  price: number
  currency: string    // e.g. "PKR", "USD"
  sku?: string
  // physical only
  stock?: number      // undefined = unlimited; 0 = out of stock
  variants?: ProductVariant[]
  // digital only
  deliveryInfo?: string   // e.g. "Instant download", "Email within 24h"
  // service only
  pricingModel?: 'fixed' | 'hourly' | 'quote'
  availability?: string  // e.g. "Mon–Fri, 9am–6pm"
  active: boolean
}

// ─── Lead Capture Campaigns ──────────────────────────────────────────────────
export type CampaignType = 'organic' | 'meta_ads' | 'qr' | 'referral'

export interface Campaign {
  id: string
  tenantId: string
  name: string
  type: CampaignType
  phone: string           // WhatsApp number digits only (e.g. 971501234567)
  welcomeMessage: string  // pre-filled message for wa.me link
  trackingCode: string    // unique short code embedded in welcome message
  active: boolean
  leads: number           // contacts attributed to this campaign
  createdAt: string
}

// ─── Pipeline / Deal Stages ──────────────────────────────────────────────────
export interface PipelineStage {
  id: string
  tenantId: string
  name: string
  color: string
  order: number
}

export interface Deal {
  id: string
  tenantId: string
  contactId: string
  stageId: string
  title: string
  value: number
  currency: string
  assigneeId?: string | null
  notes: string
  createdAt: string
  updatedAt: string
  closedAt?: string | null
  outcome?: 'won' | 'lost' | null
}

// ─── Booking / Appointments ──────────────────────────────────────────────────
export interface AppointmentType {
  id: string
  tenantId: string
  name: string
  duration: number  // minutes
  price: number
  currency: string
  description: string
  active: boolean
}

export type AppointmentStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed'

export interface Appointment {
  id: string
  tenantId: string
  contactId: string
  appointmentTypeId: string
  date: string       // YYYY-MM-DD
  time: string       // HH:MM
  status: AppointmentStatus
  notes: string
  sessionId?: string | null
  createdAt: string
  updatedAt: string
}

// ─── Payment Gateways ─────────────────────────────────────────────────────────
export type PaymentProvider = 'stripe' | 'paypal'

export interface PaymentGateway {
  id: string
  tenantId: string
  provider: PaymentProvider
  name: string
  publicKey?: string
  hasSecretKey: boolean  // frontend never sees the actual secret
  webhookSecret?: string
  live: boolean
  active: boolean
  createdAt: string
}

export type PaymentLinkStatus = 'active' | 'paid' | 'expired' | 'cancelled' | 'failed'

export interface PaymentLink {
  id: string
  tenantId: string
  contactId: string
  dealId?: string | null
  gatewayId: string
  provider: PaymentProvider
  amount: number
  currency: string
  description: string
  status: PaymentLinkStatus
  url: string | null
  expiresAt: string
  paidAt?: string | null
  createdAt: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface InvoiceItem {
  description: string
  qty: number
  unitPrice: number
}

export interface Invoice {
  id: string
  tenantId: string
  contactId: string
  dealId?: string | null
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  currency: string
  dueDate?: string | null
  notes: string
  status: InvoiceStatus
  paidAt?: string | null
  createdAt: string
}

// ─── Gateway connection profile (per tenant) ─────────────────────────────────
export type GatewayKind = 'portal' | 'mock' | 'openwa' | 'evolution'

export interface GatewayProfile {
  kind: GatewayKind
  baseUrl: string
  apiKey: string
}

export interface VolumeDay {
  day: string
  bot: number
  human: number
}

export interface DashboardStats {
  openConversations: number
  messagesToday: number
  responseRatePct: number
  avgFirstResponseMin: number
  activeSessions: number
  botHandledPct: number
  volume7d: VolumeDay[]
}

// ─── Workflow Builder ──────────────────────────────────────────────────────────
export type WorkflowTriggerType =
  | 'contact.created' | 'tag.added' | 'tag.removed'
  | 'message.received' | 'message.first'
  | 'conversation.resolved' | 'conversation.opened'
  | 'appointment.booked' | 'appointment.cancelled'
  | 'payment.received' | 'deal.stage_changed'
  | 'form.submitted' | 'manual'

export type WorkflowActionType =
  | 'send_message' | 'wait' | 'if_else'
  | 'add_tag' | 'remove_tag'
  | 'assign_agent' | 'unassign_agent'
  | 'set_contact_field' | 'create_note'
  | 'move_deal_stage' | 'create_deal'
  | 'add_to_campaign' | 'remove_from_campaign'
  | 'send_webhook' | 'end'

export interface WorkflowNodeData {
  label: string
  nodeType: 'trigger' | 'action' | 'condition' | 'wait' | 'end'
  actionType?: WorkflowActionType
  triggerType?: WorkflowTriggerType
  config: Record<string, any>
  description?: string
}

export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: WorkflowNodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
}

export interface Workflow {
  id: string
  tenantId: string
  name: string
  description?: string
  enabled: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  triggerType: WorkflowTriggerType
  triggerConfig: Record<string, any>
  createdAt: string
  updatedAt: string
  runCount: number
  lastRunAt?: string
}

export interface WorkflowRun {
  id: string
  workflowId: string
  tenantId: string
  status: 'running' | 'completed' | 'failed' | 'waiting'
  contactId?: string
  conversationId?: string
  currentNodeId?: string
  context: Record<string, any>
  log: { nodeId: string; action: string; at: string; result?: string }[]
  startedAt: string
  completedAt?: string
  error?: string
}
