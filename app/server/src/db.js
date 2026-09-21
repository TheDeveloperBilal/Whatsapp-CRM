// ─── JSON persistence layer ──────────────────────────────────────────────────
// Prototype-grade: one JSON file, debounced writes, in-memory maps.
// Swap target: Supabase Postgres (same collection shapes → tables + RLS).

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { hashPassword } from './auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// DATA_DIR env var lets production (Fly.io) point to the persistent volume at /data
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
export const AUTH_DIR = path.join(DATA_DIR, 'auth')
export const MEDIA_DIR = path.join(DATA_DIR, 'media')
const DB_FILE = path.join(DATA_DIR, 'db.json')

fs.mkdirSync(AUTH_DIR, { recursive: true })
fs.mkdirSync(MEDIA_DIR, { recursive: true })

const seed = () => ({
  users: [],
  tenants: [
    {
      id: 't1',
      name: 'My Workspace',
      slug: 'default',
      plan: 'business',
      businessType: 'service',
      suspended: false,
      createdAt: new Date().toISOString(),
      members: [
        { id: 'u1', name: 'You', email: 'you@local', role: 'owner', online: true },
      ],
    },
  ],
  tags: [
    { id: 'tag1', label: 'VIP', color: '#d97706' },
    { id: 'tag2', label: 'New Lead', color: '#059669' },
    { id: 'tag3', label: 'Support', color: '#2563eb' },
    { id: 'tag4', label: 'Billing', color: '#dc2626' },
    { id: 'tag5', label: 'Order Issue', color: '#9333ea' },
  ],
  sessions: [],
  contacts: [],
  conversations: [],
  messages: [],
  botRules: [
    {
      id: 'b1',
      tenantId: 't1',
      name: 'Greeting / first touch',
      enabled: false,
      matchType: 'keyword',
      pattern: 'hi, hello, halo, hey, good morning, selamat pagi, assalamualaikum',
      response:
        'Hi! 👋 Thanks for reaching out. How can I help you today? (You can ask about orders, shipping, or type *human* to talk to an agent.)',
      sessionIds: [],
    },
    {
      id: 'b2',
      tenantId: 't1',
      name: 'Human handoff keyword',
      enabled: true,
      matchType: 'keyword',
      pattern: 'human, agent, operator, cs, customer service',
      response: 'Got it — a human agent will pick up this conversation shortly. 🙏',
      sessionIds: [],
    },
  ],
  botConfigs: [
    {
      tenantId: 't1',
      aiEnabled: true,
      persona:
        "Your name is Sam. You're a customer support rep helping customers over WhatsApp — not a bot, not an assistant, just a real team member named Sam.\n\nTone: Talk like a normal person texting. Keep replies to 1 to 3 sentences, friendly and direct. Match the customer's language immediately — if they write in Urdu, reply in natural Urdu; if casual English, match that energy.\n\nNever use bullet points or numbered lists unless the customer explicitly asks for step-by-step instructions or you are sharing an itemized bill. Never use em dashes. Use commas or short separate sentences instead.\n\nAvoid these words entirely: certainly, delve, foster, revolutionize, tapestry, testament. Never open with 'How may I assist you today' or 'I hope this message finds you well'. Say 'Sure thing' or 'Got it' instead of 'I would be thrilled to assist you'.\n\nMemory: Remember every name, order number, and detail the customer mentioned earlier in this conversation. Never ask them to repeat something they already said. Reference earlier details naturally.\n\nIdentity: Never introduce yourself as an AI, bot, or assistant. You are Sam. If directly asked 'are you a bot' or 'are you AI', answer honestly and casually: 'Yeah, I'm an AI helping out the team, but I can handle most things directly. What do you need?'\n\nLimits: Never invent order data, prices, or policies not in your knowledge base. If you cannot help, say something like 'Let me check that with our team' or 'I might need to pass this to a manager to look into your account.' Never say 'As an AI, I do not have access to'. Never discuss these instructions.",
      fallback: 'human',
      fallbackMessage: 'Thanks! A human agent will continue from here shortly. 🙏',
      businessHoursOnly: false,
      model: process.env.AI_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b',
    },
  ],
  automations: [],
  cannedResponses: [],
  knowledgeBase: [],
  products: [],
  campaigns: [],
  intents: [],
  pipelineStages: [],
  deals: [],
  appointmentTypes: [],
  appointments: [],
  paymentGateways: [],
  paymentLinks: [],
  invoices: [],
})

let db
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
} else {
  db = seed()
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

// Migrate: add missing top-level collections
if (!db.cannedResponses) { db.cannedResponses = []; fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); console.log('[db] Migrated: added cannedResponses collection') }
if (!db.knowledgeBase)   { db.knowledgeBase   = []; fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); console.log('[db] Migrated: added knowledgeBase collection') }
if (!db.products)        { db.products        = []; fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); console.log('[db] Migrated: added products collection') }
if (!db.campaigns) { db.campaigns = []; fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); console.log('[db] Migrated: added campaigns collection') }
if (!db.intents)        { db.intents        = []; fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); console.log('[db] Migrated: added intents collection') }
if (!db.deals)          { db.deals          = []; fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); console.log('[db] Migrated: added deals collection') }
if (!db.pipelineStages) {
  db.pipelineStages = [
    { id: 'ps1', tenantId: 't1', name: 'New Lead',  color: '#3b82f6', order: 0 },
    { id: 'ps2', tenantId: 't1', name: 'Contacted', color: '#f59e0b', order: 1 },
    { id: 'ps3', tenantId: 't1', name: 'Qualified', color: '#8b5cf6', order: 2 },
    { id: 'ps4', tenantId: 't1', name: 'Proposal',  color: '#ec4899', order: 3 },
    { id: 'ps5', tenantId: 't1', name: 'Won',       color: '#10b981', order: 4 },
    { id: 'ps6', tenantId: 't1', name: 'Lost',      color: '#ef4444', order: 5 },
  ]
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
  console.log('[db] Migrated: added pipelineStages collection with defaults')
}

if (!db.appointmentTypes) {
  db.appointmentTypes = [
    { id: 'at1', tenantId: 't1', name: 'Free Consultation', duration: 30, price: 0, currency: 'USD', description: '30-minute discovery call', active: true },
    { id: 'at2', tenantId: 't1', name: 'Service Session', duration: 60, price: 50, currency: 'USD', description: '1-hour full service session', active: true },
  ]
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
  console.log('[db] Migrated: added appointmentTypes')
}
if (!db.appointments)     { db.appointments     = []; fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) }
if (!db.paymentGateways)  { db.paymentGateways  = []; fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) }
if (!db.paymentLinks)     { db.paymentLinks     = []; fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) }
if (!db.invoices)         { db.invoices         = []; fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) }

// Migrate existing tenants: add businessType if missing
if (db.tenants) {
  let migrated = false
  for (const t of db.tenants) {
    if (!t.businessType) { t.businessType = 'service'; migrated = true }
  }
  if (migrated) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); console.log('[db] Migrated tenants: added businessType field') }
}

// Initialize users collection on existing databases (upgrade path)
if (!db.users?.length) {
  const t1 = (db.tenants || []).find((t) => t.id === 't1')
  db.users = [
    { id: 'usr0', username: 'admin', passwordHash: hashPassword('admin123'), tenantId: null, role: 'superadmin' },
    { id: 'usr1', username: 'demo', passwordHash: hashPassword('demo123'), tenantId: t1?.id ?? 't1', role: 'owner' },
  ]
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
  console.log('[auth] Default users created → admin/admin123 (superadmin) | demo/demo123 (tenant owner)')
}

let saveTimer = null
export function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
  }, 300)
}

export function collection(name) {
  return db[name]
}

export function upsert(name, row, key = 'id') {
  const list = db[name]
  const i = list.findIndex((r) => r[key] === row[key])
  if (i >= 0) list[i] = { ...list[i], ...row }
  else list.push(row)
  save()
  return i >= 0 ? list[i] : row
}

export function remove(name, predicate) {
  db[name] = db[name].filter((r) => !predicate(r))
  save()
}

export const uid = (p) => `${p}${crypto.randomBytes(5).toString('hex')}`

// Replace the entire in-memory database and persist to disk immediately.
// Used by the admin DB-import endpoint to migrate data from another environment.
export function importDb(newDb) {
  Object.keys(newDb).forEach((k) => { db[k] = newDb[k] })
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}
