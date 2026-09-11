// MockAdapter — powers the portal UI with realistic local data and a live
// inbound-message simulation, so the whole product is demoable without a
// WhatsApp backend. Implements the exact same contract as the real adapters.

import type { WhatsAppGateway, SendMessageInput, CreateSessionInput, GatewayEvents } from './types'
import type { WaSession, Contact, Conversation, Message, DashboardStats } from '@/types/portal'
import { sessions, contacts, conversations, messages, inboundScript } from './seed'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

export class MockAdapter implements WhatsAppGateway {
  readonly kind = 'mock'
  private sessions = clone(sessions)
  private contacts = clone(contacts)
  private conversations = clone(conversations)
  private messages = clone(messages)
  private timers: ReturnType<typeof setInterval>[] = []

  async listSessions(tenantId: string): Promise<WaSession[]> {
    return this.sessions.filter((s) => s.tenantId === tenantId)
  }

  async createSession(tenantId: string, input: CreateSessionInput): Promise<WaSession> {
    const s: WaSession = {
      id: `s${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      name: input.name,
      engine: (input.engine as WaSession['engine']) ?? 'whatsapp-web.js',
      status: 'disconnected',
      messagesToday: 0,
    }
    this.sessions.push(s)
    return s
  }

  async startSession(sessionId: string): Promise<WaSession> {
    const s = this.mustSession(sessionId)
    s.status = 'qr'
    s.qrCode = `WAPORTAL-DEMO:${s.id}:${Date.now()}`
    // simulate QR scan after a while
    setTimeout(() => {
      s.status = 'connecting'
      setTimeout(() => {
        s.status = 'connected'
        s.phone = `+62 8${Math.floor(100000000 + Math.random() * 899999999)}`
        s.lastSeen = new Date().toISOString()
        this.statusListeners.forEach((fn) => fn(clone(s)))
      }, 4000)
    }, 9000)
    return clone(s)
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== sessionId)
  }

  async listContacts(tenantId: string): Promise<Contact[]> {
    return this.contacts.filter((c) => c.tenantId === tenantId)
  }

  async listConversations(tenantId: string): Promise<Conversation[]> {
    return this.conversations
      .filter((c) => c.tenantId === tenantId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }

  async getStats(tenantId: string): Promise<DashboardStats> {
    const convs = this.conversations.filter((c) => c.tenantId === tenantId)
    const sess = this.sessions.filter((s) => s.tenantId === tenantId)
    const msgs = this.messages.filter((m) =>
      convs.some((c) => c.id === m.conversationId),
    )
    const botMsgs = msgs.filter((m) => m.byBot).length
    return {
      openConversations: convs.filter((c) => c.status === 'open').length,
      messagesToday: sess.reduce((n, s) => n + s.messagesToday, 0),
      responseRatePct: 94,
      avgFirstResponseMin: 1.8,
      activeSessions: sess.filter((s) => s.status === 'connected').length,
      botHandledPct: msgs.length ? Math.round((botMsgs / msgs.length) * 100) : 0,
    }
  }

  async sendMessage(input: SendMessageInput): Promise<Message> {
    const conv = this.conversations.find(
      (c) => c.sessionId === input.sessionId && this.contactOf(c).chatId === input.chatId,
    )
    const msg: Message = {
      id: `m${Math.random().toString(36).slice(2, 9)}`,
      conversationId: conv?.id ?? 'unknown',
      fromMe: true,
      body: input.text,
      type: 'text',
      status: 'sent',
      byBot: false,
      timestamp: new Date().toISOString(),
    }
    this.messages.push(msg)
    if (conv) {
      conv.lastMessage = msg
      conv.updatedAt = msg.timestamp
      conv.unread = 0
      // simulate delivery + read ticks
      setTimeout(() => (msg.status = 'delivered'), 1200)
      setTimeout(() => (msg.status = 'read'), 3500)
    }
    return clone(msg)
  }

  private msgListeners: NonNullable<GatewayEvents['onMessage']>[] = []
  private statusListeners: NonNullable<GatewayEvents['onSessionStatus']>[] = []

  subscribe(events: GatewayEvents): () => void {
    if (events.onMessage) this.msgListeners.push(events.onMessage)
    if (events.onSessionStatus) this.statusListeners.push(events.onSessionStatus)

    // Live simulation: every ~35s a random scripted customer message arrives.
    let i = 0
    const t = setInterval(() => {
      const step = inboundScript[i++ % inboundScript.length]
      const conv = this.conversations.find(
        (c) => c.contactId === step.contactId && c.tenantId === 't1',
      )
      if (!conv) return
      const contact = this.contactOf(conv)
      const msg: Message = {
        id: `m${Math.random().toString(36).slice(2, 9)}`,
        conversationId: conv.id,
        fromMe: false,
        senderName: contact.name,
        body: step.body,
        type: 'text',
        status: 'delivered',
        byBot: false,
        timestamp: new Date().toISOString(),
      }
      this.messages.push(msg)
      conv.lastMessage = msg
      conv.updatedAt = msg.timestamp
      conv.unread += 1
      this.msgListeners.forEach((fn) => fn(clone(msg), clone(conv), clone(contact)))
    }, 35_000)
    this.timers.push(t)

    return () => {
      this.timers.forEach(clearInterval)
      this.timers = []
      this.msgListeners = []
      this.statusListeners = []
    }
  }

  private mustSession(id: string): WaSession {
    const s = this.sessions.find((x) => x.id === id)
    if (!s) throw new Error(`session ${id} not found`)
    return s
  }

  private contactOf(conv: Conversation): Contact {
    return this.contacts.find((c) => c.id === conv.contactId)!
  }
}
