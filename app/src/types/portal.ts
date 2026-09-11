// ─── Multi-tenant WhatsApp CRM — domain model ────────────────────────────────
// Tenant > Sessions (WhatsApp numbers) > Contacts > Conversations > Messages
// This model is gateway-agnostic: the same shapes are produced by the OpenWA,
// Evolution API and Mock adapters in src/lib/gateway/.

export type TenantRole = 'owner' | 'admin' | 'agent' | 'viewer'

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
}

export interface Message {
  id: string
  conversationId: string
  fromMe: boolean
  senderName?: string
  body: string
  type: 'text' | 'image' | 'audio' | 'document' | 'video'
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

// ─── Automation (foundation for the future workflow hub, option E) ───────────
export interface AutomationRule {
  id: string
  tenantId: string
  name: string
  enabled: boolean
  trigger: string // e.g. 'message.received', 'conversation.resolved'
  condition?: string
  action: string // e.g. 'webhook', 'add-tag', 'assign-agent', 'n8n'
  actionTarget?: string
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
  content: string
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
