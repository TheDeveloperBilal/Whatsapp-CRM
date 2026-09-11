// Evolution API adapter — maps the portal's gateway contract onto Evolution's REST API.
// Reference: evolution-foundation/evolution-api — Express, auth via `apikey` header,
// instances instead of sessions, Baileys or official Meta Cloud API per instance.

import type { WhatsAppGateway, SendMessageInput, CreateSessionInput, GatewayEvents } from './types'
import type { WaSession, Contact, Conversation, Message, DashboardStats } from '@/types/portal'

export class EvolutionAdapter implements WhatsAppGateway {
  readonly kind = 'evolution'
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) throw new Error(`Evolution ${res.status}: ${await res.text()}`)
    return res.json() as Promise<T>
  }

  async listSessions(tenantId: string): Promise<WaSession[]> {
    const rows = await this.req<Array<Record<string, unknown>>>('/instance/fetchInstances')
    void tenantId
    return rows.map((i) => {
      const inst = (i.instance ?? i) as Record<string, unknown>
      return {
        id: String(inst.instanceName ?? inst.name),
        tenantId,
        name: String(inst.instanceName ?? inst.name),
        phone: (inst.number as string) ?? undefined,
        engine: (inst.integration === 'WHATSAPP-BUSINESS' ? 'cloud-api' : 'baileys') as WaSession['engine'],
        status: mapState(String(inst.status ?? inst.connectionStatus)),
        messagesToday: 0,
      }
    })
  }

  async createSession(tenantId: string, input: CreateSessionInput): Promise<WaSession> {
    const r = await this.req<Record<string, unknown>>('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ instanceName: input.name, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
    })
    const inst = (r.instance ?? {}) as Record<string, unknown>
    return {
      id: String(inst.instanceName ?? input.name),
      tenantId,
      name: input.name,
      engine: 'baileys',
      status: 'qr',
      qrCode: (r.qrcode as Record<string, unknown> | undefined)?.base64 as string | undefined,
      messagesToday: 0,
    }
  }

  async startSession(sessionId: string): Promise<WaSession> {
    const r = await this.req<Record<string, unknown>>(`/instance/connect/${sessionId}`)
    return {
      id: sessionId,
      tenantId: '',
      name: sessionId,
      engine: 'baileys',
      status: r.base64 ? 'qr' : 'connecting',
      qrCode: r.base64 as string | undefined,
      messagesToday: 0,
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.req(`/instance/delete/${sessionId}`, { method: 'DELETE' })
  }

  async listContacts(): Promise<Contact[]> {
    throw new Error('listContacts: wire to POST /chat/findContacts/{instance}')
  }

  async listConversations(): Promise<Conversation[]> {
    throw new Error('listConversations: wire to POST /chat/findChats/{instance}')
  }

  async listMessages(): Promise<Message[]> {
    throw new Error('listMessages: wire to POST /chat/findMessages/{instance}')
  }

  async getStats(): Promise<DashboardStats> {
    throw new Error('getStats: compose from /instance + /chat endpoints')
  }

  async sendMessage(input: SendMessageInput): Promise<Message> {
    const r = await this.req<Record<string, unknown>>(`/message/sendText/${input.sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ number: input.chatId.replace('@c.us', ''), text: input.text }),
    })
    const key = (r.key ?? {}) as Record<string, unknown>
    return {
      id: String(key.id ?? crypto.randomUUID()),
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
    // Production: Evolution pushes webhooks / websocket / RabbitMQ events;
    // terminate them in the portal backend and fan out to the UI.
    return () => {}
  }
}

function mapState(s: string): WaSession['status'] {
  switch (s.toLowerCase()) {
    case 'open':
    case 'connected':
      return 'connected'
    case 'connecting':
      return 'connecting'
    default:
      return 'disconnected'
  }
}
