// ─── Gateway adapter contract ────────────────────────────────────────────────
// Every WhatsApp backend (OpenWA, Evolution API, Mock) implements this surface.
// The UI never calls fetch() against a gateway directly — it goes through here,
// so swapping or combining backends later (incl. Meta Cloud API) touches only
// this folder.

import type {
  WaSession,
  Contact,
  Conversation,
  Message,
  DashboardStats,
} from '@/types/portal'

export interface SendMessageInput {
  sessionId: string
  chatId: string
  text: string
}

export interface CreateSessionInput {
  name: string
  engine?: string
}

export interface GatewayEvents {
  onMessage?: (msg: Message, conversation: Conversation, contact: Contact) => void
  onSessionStatus?: (session: WaSession) => void
}

export interface WhatsAppGateway {
  readonly kind: string

  // sessions
  listSessions(tenantId: string): Promise<WaSession[]>
  createSession(tenantId: string, input: CreateSessionInput): Promise<WaSession>
  startSession(sessionId: string): Promise<WaSession> // returns session w/ QR when needed
  deleteSession(sessionId: string): Promise<void>

  // CRM data
  listContacts(tenantId: string): Promise<Contact[]>
  listConversations(tenantId: string): Promise<Conversation[]>
  listMessages(conversationId: string): Promise<Message[]>
  getStats(tenantId: string): Promise<DashboardStats>

  // actions
  sendMessage(input: SendMessageInput): Promise<Message>

  // realtime
  subscribe(events: GatewayEvents): () => void
}
