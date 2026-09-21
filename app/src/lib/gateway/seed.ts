// ─── Demo seed data ──────────────────────────────────────────────────────────
import type {
  Tenant,
  Tag,
  Contact,
  WaSession,
  Conversation,
  Message,
  BotRule,
  BotConfig,
  AutomationRule,
} from '@/types/portal'

const now = Date.now()
const min = (m: number) => new Date(now - m * 60_000).toISOString()

export const tenants: Tenant[] = [
  {
    id: 't1',
    name: 'Acme Retail',
    slug: 'acme',
    plan: 'business',
    businessType: 'retail',
    createdAt: min(60 * 24 * 90),
    members: [
      { id: 'u1', name: 'You', email: 'you@acme.io', role: 'owner', online: true },
      { id: 'u2', name: 'Sarah Chen', email: 'sarah@acme.io', role: 'admin', online: true },
      { id: 'u3', name: 'Diego Ramos', email: 'diego@acme.io', role: 'agent', online: true },
      { id: 'u4', name: 'Priya Nair', email: 'priya@acme.io', role: 'agent', online: false },
    ],
  },
  {
    id: 't2',
    name: 'Klinik Sehat',
    slug: 'klinik',
    plan: 'pro',
    businessType: 'service',
    createdAt: min(60 * 24 * 30),
    members: [
      { id: 'u1', name: 'You', email: 'you@acme.io', role: 'admin', online: true },
      { id: 'u5', name: 'Dr. Amelia', email: 'amelia@klinik.id', role: 'agent', online: false },
    ],
  },
]

export const tags: Tag[] = [
  { id: 'tag1', label: 'VIP', color: '#d97706' },
  { id: 'tag2', label: 'New Lead', color: '#059669' },
  { id: 'tag3', label: 'Support', color: '#2563eb' },
  { id: 'tag4', label: 'Billing', color: '#dc2626' },
  { id: 'tag5', label: 'Order Issue', color: '#9333ea' },
]

export const sessions: WaSession[] = [
  { id: 's1', tenantId: 't1', name: 'support-main', phone: '+62 812-1000-2233', engine: 'whatsapp-web.js', status: 'connected', messagesToday: 184, lastSeen: min(1) },
  { id: 's2', tenantId: 't1', name: 'sales-baileys', phone: '+62 857-9000-1122', engine: 'baileys', status: 'connected', messagesToday: 96, lastSeen: min(3) },
  { id: 's3', tenantId: 't1', name: 'marketing', engine: 'baileys', status: 'disconnected', messagesToday: 0 },
  { id: 's4', tenantId: 't2', name: 'clinic-frontdesk', phone: '+62 811-5500-7788', engine: 'whatsapp-web.js', status: 'connected', messagesToday: 42, lastSeen: min(2) },
]

export const contacts: Contact[] = [
  { id: 'c1', tenantId: 't1', name: 'Budi Santoso', phone: '+62 812-3456-7890', chatId: '6281234567890@c.us', avatarHue: 152, tags: ['tag1', 'tag3'], notes: 'Repeat customer, prefers Indonesian. VIP since 2024.', lastMessageAt: min(4), optedIn: true },
  { id: 'c2', tenantId: 't1', name: 'Maria Gonzalez', phone: '+52 55 1234 8876', chatId: '525512348876@c.us', avatarHue: 280, tags: ['tag2'], notes: 'Asked about wholesale pricing.', lastMessageAt: min(18), optedIn: true },
  { id: 'c3', tenantId: 't1', name: 'James Whitfield', phone: '+44 7700 900123', chatId: '447700900123@c.us', avatarHue: 210, tags: ['tag4'], notes: 'Invoice #INV-2091 dispute.', lastMessageAt: min(47), optedIn: true },
  { id: 'c4', tenantId: 't1', name: 'Anisa Putri', phone: '+62 878-5555-0134', chatId: '6287855550134@c.us', avatarHue: 20, tags: ['tag5'], notes: 'Package arrived damaged, wants replacement.', lastMessageAt: min(75), optedIn: true },
  { id: 'c5', tenantId: 't1', name: 'Kenji Tanaka', phone: '+81 90 1234 5678', chatId: '819012345678@c.us', avatarHue: 340, tags: [], notes: '', lastMessageAt: min(200), optedIn: true },
  { id: 'c6', tenantId: 't1', name: 'Fatima Al-Sayed', phone: '+971 50 987 6543', chatId: '971509876543@c.us', avatarHue: 90, tags: ['tag2', 'tag1'], notes: 'Interested in reseller program.', lastMessageAt: min(310), optedIn: true },
  { id: 'c7', tenantId: 't2', name: 'Rina Marlina', phone: '+62 813-7777-2211', chatId: '6281377772211@c.us', avatarHue: 180, tags: ['tag3'], notes: 'Appointment reschedule request.', lastMessageAt: min(26), optedIn: true },
]

const M = (
  id: string,
  conversationId: string,
  fromMe: boolean,
  body: string,
  minutesAgo: number,
  opts?: Partial<Message>,
): Message => ({
  id,
  conversationId,
  fromMe,
  body,
  type: 'text',
  status: fromMe ? 'read' : 'delivered',
  byBot: opts?.byBot ?? false,
  timestamp: min(minutesAgo),
  ...opts,
})

export const messages: Message[] = [
  // c1 — Budi
  M('m1', 'cv1', false, 'Halo kak, mau tanya status pesanan saya #ORD-5531 sudah sampai mana ya?', 32),
  M('m2', 'cv1', true, 'Halo Budi! 👋 Terima kasih sudah menghubungi Acme Retail. Saya asisten virtual — sebentar saya cek pesanan #ORD-5531 ya.', 31, { byBot: true }),
  M('m3', 'cv1', true, 'Pesanan kamu sudah di gudang Jakarta dan dijadwalkan tiba **besok sebelum jam 5 sore**. Mau saya kirimkan link tracking-nya?', 31, { byBot: true }),
  M('m4', 'cv1', false, 'Ya boleh, kirim linknya kak', 30),
  M('m5', 'cv1', true, 'Siap! Ini link tracking-nya: acme.id/track/ORD-5531 — ada yang bisa saya bantu lagi?', 30, { byBot: true }),
  M('m6', 'cv1', false, 'Kak, sekalian mau tanya, bisa ganti alamat pengiriman gak?', 4),
  // c2 — Maria
  M('m7', 'cv2', false, 'Hi! I saw your catalog on Instagram. Do you offer wholesale pricing for 50+ units?', 18),
  // c3 — James
  M('m8', 'cv3', false, 'Hello, I was charged twice for invoice INV-2091. Can someone check?', 60),
  M('m9', 'cv3', true, 'Hi James, sorry about that. I\'ve flagged it to billing — refund of the duplicate charge is being processed (3–5 business days).', 55),
  M('m10', 'cv3', false, 'Ok thanks. Please email me the confirmation.', 47),
  // c4 — Anisa
  M('m11', 'cv4', false, 'Kak paket saya datang tapi boxnya rusak parah, barangnya penyok 😞', 90),
  M('m12', 'cv4', true, 'Waduh maaf banget Anisa! Bisa kirim foto barangnya? Kami langsung proses penggantian tanpa biaya.', 88),
  M('m13', 'cv4', false, '[image] foto-paket.jpg', 75, { type: 'image' }),
  M('m13b', 'cv4', false, '[voice message]', 73, { type: 'audio' }),
  // c5 — Kenji
  M('m14', 'cv5', false, 'Do you ship to Japan?', 200),
  M('m15', 'cv5', true, 'Hi Kenji! Yes, we ship to Japan via DHL Express (5–7 days). Shipping is free over $120.', 195, { byBot: true }),
  // c6 — Fatima
  M('m16', 'cv6', false, 'Salam! I would like to know more about your reseller program.', 310),
  M('m17', 'cv6', true, 'Waalaikumsalam Fatima! Our reseller program offers 25% margin + marketing kit. Shall I schedule a call with our partnerships team?', 305, { byBot: true }),
  // c7 — Rina (t2)
  M('m18', 'cv7', false, 'Selamat pagi, bisa reschedule appointment saya dari Kamis ke Jumat jam 10?', 26),
  M('m19', 'cv7', true, 'Pagi Rina! Tentu, appointment kamu sudah dipindah ke Jumat 10:00 dengan dr. Amelia. Sampai jumpa! 🌷', 25, { byBot: true }),
]

export const conversations: Conversation[] = [
  { id: 'cv1', tenantId: 't1', sessionId: 's1', contactId: 'c1', status: 'open', assigneeId: 'u3', botEnabled: true, unread: 1, lastMessage: messages.find((m) => m.id === 'm6'), updatedAt: min(4) },
  { id: 'cv2', tenantId: 't1', sessionId: 's2', contactId: 'c2', status: 'open', botEnabled: true, unread: 1, lastMessage: messages.find((m) => m.id === 'm7'), updatedAt: min(18) },
  { id: 'cv3', tenantId: 't1', sessionId: 's1', contactId: 'c3', status: 'pending', assigneeId: 'u2', botEnabled: false, unread: 0, lastMessage: messages.find((m) => m.id === 'm10'), updatedAt: min(47) },
  { id: 'cv4', tenantId: 't1', sessionId: 's1', contactId: 'c4', status: 'open', assigneeId: 'u3', botEnabled: false, unread: 0, lastMessage: messages.find((m) => m.id === 'm13'), updatedAt: min(75) },
  { id: 'cv5', tenantId: 't1', sessionId: 's2', contactId: 'c5', status: 'resolved', botEnabled: true, unread: 0, lastMessage: messages.find((m) => m.id === 'm15'), updatedAt: min(195) },
  { id: 'cv6', tenantId: 't1', sessionId: 's2', contactId: 'c6', status: 'open', botEnabled: true, unread: 0, lastMessage: messages.find((m) => m.id === 'm17'), updatedAt: min(305) },
  { id: 'cv7', tenantId: 't2', sessionId: 's4', contactId: 'c7', status: 'resolved', botEnabled: true, unread: 0, lastMessage: messages.find((m) => m.id === 'm19'), updatedAt: min(25) },
]

export const botRules: BotRule[] = [
  { id: 'b1', tenantId: 't1', name: 'Order status lookup', enabled: true, matchType: 'keyword', pattern: 'status pesanan, order status, tracking, where is my order', response: 'Auto-lookup order via OMS API and reply with courier + ETA.', sessionIds: [] },
  { id: 'b2', tenantId: 't1', name: 'Shipping FAQ', enabled: true, matchType: 'keyword', pattern: 'ship to, shipping, kirim ke, ongkir', response: 'Answer with shipping zones, carriers, free-shipping threshold.', sessionIds: [] },
  { id: 'b3', tenantId: 't1', name: 'Greeting / first touch', enabled: true, matchType: 'intent', pattern: 'greeting', response: 'Welcome message + menu of options.', sessionIds: [] },
  { id: 'b4', tenantId: 't1', name: 'Billing escalation', enabled: false, matchType: 'keyword', pattern: 'charged twice, refund, invoice', response: 'Create billing ticket, tag conversation, assign to finance agent.', sessionIds: ['s1'] },
  { id: 'b5', tenantId: 't2', name: 'Appointment booking', enabled: true, matchType: 'intent', pattern: 'booking, reschedule', response: 'Check calendar availability and confirm slot.', sessionIds: ['s4'] },
]

export const botConfigs: BotConfig[] = [
  {
    tenantId: 't1',
    aiEnabled: true,
    persona: 'You are Acme Retail\'s friendly support assistant. Reply in the customer\'s language (Indonesian or English). Be concise, warm, and never invent order data — use the order lookup tool. Escalate billing disputes to a human.',
    fallback: 'human',
    fallbackMessage: 'Thanks! A human agent will continue from here shortly. 🙏',
    businessHoursOnly: false,
    model: 'kimi-k2 / gpt-4o-mini (via gateway MCP or Dify)',
  },
  {
    tenantId: 't2',
    aiEnabled: true,
    persona: 'You are Klinik Sehat\'s front-desk assistant. Help with appointments and clinic info only. Never give medical advice.',
    fallback: 'message',
    fallbackMessage: 'Mohon tunggu, staf kami akan segera membantu.',
    businessHoursOnly: true,
    model: 'kimi-k2 (via gateway MCP)',
  },
]

export const automationRules: AutomationRule[] = [
  { id: 'a1', tenantId: 't1', name: 'New lead → notify sales', enabled: true, trigger: 'message.received', condition: 'contact.tags contains "New Lead"', action: 'webhook', actionTarget: 'https://n8n.acme.io/hook/new-lead' },
  { id: 'a2', tenantId: 't1', name: 'Resolved → CSAT survey', enabled: true, trigger: 'conversation.resolved', action: 'send-message', actionTarget: 'csat-template' },
  { id: 'a3', tenantId: 't1', name: 'VIP message → priority queue', enabled: true, trigger: 'message.received', condition: 'contact.tags contains "VIP"', action: 'assign-agent', actionTarget: 'u2' },
  { id: 'a4', tenantId: 't1', name: 'No agent reply in 30m → escalate', enabled: false, trigger: 'sla.breach', action: 'webhook', actionTarget: 'https://n8n.acme.io/hook/escalate' },
]

// canned inbound messages for the live demo simulation
export const inboundScript: Array<{ contactId: string; body: string }> = [
  { contactId: 'c2', body: 'Hello? Anyone here? 😅' },
  { contactId: 'c5', body: 'One more question — do you have a size chart?' },
  { contactId: 'c1', body: 'Oke kak, alamat barunya: Jl. Merdeka No. 45, Bandung' },
  { contactId: 'c6', body: 'Also, is there a minimum order for resellers?' },
]
