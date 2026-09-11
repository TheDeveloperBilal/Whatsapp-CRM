// OpenWA adapter — maps the portal's gateway contract onto OpenWA's REST API.
// Reference: rmyndharis/OpenWA — NestJS, base path /api, auth via X-API-Key,
// Swagger at /api/docs. Chat ids look like 62812...@c.us.

import type { WhatsAppGateway, SendMessageInput, CreateSessionInput, GatewayEvents } from './types'
import type { WaSession, Contact, Conversation, Message, DashboardStats } from '@/types/portal'

export class OpenWAAdapter implements WhatsAppGateway {
  readonly kind = 'openwa'
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) throw new Error(`OpenWA ${res.status}: ${await res.text()}`)
    return res.json() as Promise<T>
  }

  async listSessions(tenantId: string): Promise<WaSession[]> {
    const rows = await this.req<Array<Record<string, unknown>>>('/sessions')
    void tenantId
    return rows.map((s) => ({
      id: String(s.id),
      tenantId,
      name: String(s.name ?? s.id),
      phone: (s.phoneNumber as string) ?? undefined,
      engine: (s.engine as WaSession['engine']) ?? 'whatsapp-web.js',
      status: mapStatus(String(s.status)),
      messagesToday: 0,
    }))
  }

  async createSession(tenantId: string, input: CreateSessionInput): Promise<WaSession> {
    const s = await this.req<Record<string, unknown>>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ name: input.name }),
    })
    return {
      id: String(s.id),
      tenantId,
      name: input.name,
      engine: 'whatsapp-web.js',
      status: 'disconnected',
      messagesToday: 0,
    }
  }

  async startSession(sessionId: string): Promise<WaSession> {
    await this.req(`/sessions/${sessionId}/start`, { method: 'POST' })
    const qr = await this.req<{ qr?: string }>(`/sessions/${sessionId}/qr`).catch(() => ({ qr: undefined }))
    return {
      id: sessionId,
      tenantId: '',
      name: sessionId,
      engine: 'whatsapp-web.js',
      status: qr.qr ? 'qr' : 'connecting',
      qrCode: qr.qr,
      messagesToday: 0,
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.req(`/sessions/${sessionId}`, { method: 'DELETE' })
  }

  async listContacts(tenantId: string): Promise<Contact[]> {
    // OpenWA scopes contacts per session; the portal aggregates across sessions.
    void tenantId
    throw new Error('listContacts: wire to GET /sessions/{id}/contacts per session')
  }

  async listConversations(): Promise<Conversation[]> {
    throw new Error('listConversations: wire to GET /sessions/{id}/chats per session')
  }

  async listMessages(): Promise<Message[]> {
    throw new Error('listMessages: wire to GET /sessions/{id}/messages?chatId=…')
  }

  async getStats(): Promise<DashboardStats> {
    throw new Error('getStats: compose from /modules/stats endpoints')
  }

  async sendMessage(input: SendMessageInput): Promise<Message> {
    const r = await this.req<Record<string, unknown>>(
      `/sessions/${input.sessionId}/messages/send-text`,
      { method: 'POST', body: JSON.stringify({ chatId: input.chatId, text: input.text }) },
    )
    return {
      id: String(r.id ?? crypto.randomUUID()),
      conversationId: input.chatId,
      fromMe: true,
      body: input.text,
      type: 'text',
      status: 'sent',
      byBot: false,
      timestamp: new Date().toISOString(),
    }
  }

  subscribe(_events: GatewayEvents): () => void {
    // Production: point an OpenWA webhook (HMAC-signed) at the portal backend,
    // then fan out to the UI over WebSocket. Kept as a seam here.
    return () => {}
  }
}

function mapStatus(s: string): WaSession['status'] {
  switch (s.toUpperCase()) {
    case 'WORKING':
    case 'CONNECTED':
      return 'connected'
    case 'SCAN_QR_CODE':
    case 'QR':
      return 'qr'
    case 'STARTING':
      return 'connecting'
    default:
      return 'disconnected'
  }
}
