// ─── Portal backend: REST + WebSocket + WhatsApp engine + AI bot ────────────
// Runs locally on :8787. In production this service moves to a persistent host
// (Railway/Render/VPS) and db.js swaps to Supabase Postgres.

import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { WebSocketServer } from 'ws'
import { collection, upsert, save, uid } from './db.js'
import { waEvents, resumeSessions, sendText } from './wa.js'
import { botReply, aiStatus } from './bot.js'
import { buildApi } from './api.js'
import { runAutomations } from './automations.js'
import { runIntentRouting } from './intents.js'
import { verifyToken } from './auth.js'

const PORT = process.env.PORT || process.env.PORTAL_PORT || 8787

// ── Security headers ──────────────────────────────────────────────────────────
function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '0')  // modern browsers rely on CSP, not this
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
}


const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',').map(s => s.trim())

const app = express()
app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (curl, Postman, same-origin)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(securityHeaders)
app.use(express.json({ limit: '2mb' }))

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// Authenticate each WS connection and tag it with the tenant
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  const token = url.searchParams.get('token')
  const payload = verifyToken(token)
  if (!payload) {
    ws.close(4401, 'unauthorized')
    return
  }
  ws._tenantId = payload.tenantId
  ws._role = payload.role
})

// Extract the tenantId embedded in an event payload (best-effort)
function eventTenantId(event) {
  return (
    event.tenantId ??
    event.contact?.tenantId ??
    event.conversation?.tenantId ??
    event.session?.tenantId ??
    event.message?.tenantId ??
    null
  )
}

function broadcast(event) {
  const tid = eventTenantId(event)
  const data = JSON.stringify(event)
  for (const client of wss.clients) {
    if (client.readyState !== 1) continue
    // superadmins receive everything; tenant clients only get their own events
    if (client._role === 'superadmin' || !tid || client._tenantId === tid) {
      client.send(data)
    }
  }
}

app.use('/api', buildApi(broadcast))

// In production, Express serves the built React app as static files.
// Run `npm run build` first, then `npm start`.
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../dist')
  app.use(express.static(distPath))
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ─── ingest inbound/outbound WhatsApp events into the CRM ───────────────────

function conversationFor(session, jid, pushName) {
  const tenantId = session.tenantId
  let contact = collection('contacts').find((c) => c.tenantId === tenantId && c.chatId === jid)
  if (!contact) {
    const phone = jid.split('@')[0]
    contact = {
      id: uid('c'),
      tenantId,
      name: pushName || `+${phone}`,
      phone: `+${phone}`,
      chatId: jid,
      avatarHue: Math.floor(Math.random() * 360),
      tags: ['tag2'],
      notes: '',
      optedIn: true,
      lastMessageAt: new Date().toISOString(),
    }
    upsert('contacts', contact)
    broadcast({ type: 'contact', contact })
    // fire contact.created automation for new contacts
    const session = collection('sessions').find((s) => s.tenantId === tenantId)
    runAutomations('contact.created', { conv: null, contact, session, message: null }, broadcast).catch(
      (err) => console.error('[automation contact.created]:', err.message),
    )
  } else if (pushName && contact.name !== pushName && contact.name.startsWith('+')) {
    contact.name = pushName
    upsert('contacts', contact)
    broadcast({ type: 'contact', contact })
  }

  let conv = collection('conversations').find(
    (c) => c.tenantId === tenantId && c.sessionId === session.id && c.contactId === contact.id,
  )
  if (!conv) {
    conv = {
      id: uid('cv'),
      tenantId,
      sessionId: session.id,
      contactId: contact.id,
      status: 'open',
      botEnabled: true, // AI armed by default on new chats
      unread: 0,
      updatedAt: new Date().toISOString(),
    }
    upsert('conversations', conv)
  }
  return { contact, conv }
}

waEvents.on('message', async (e) => {
  const session = collection('sessions').find((s) => s.id === e.sessionId)
  if (!session) return

  // dedupe (messages we sent via the API also come back as fromMe upserts)
  const existing = collection('messages').find((m) => m.id === e.id)
  if (existing) return

  const { contact, conv } = conversationFor(session, e.jid, e.pushName)
  const msg = {
    id: e.id,
    conversationId: conv.id,
    fromMe: e.fromMe,
    senderName: e.pushName,
    body: e.text,
    type: e.type,
    mediaUrl: e.mediaUrl ?? null,
    status: e.fromMe ? 'sent' : 'delivered',
    byBot: false,
    timestamp: e.timestamp,
  }
  upsert('messages', msg)
  conv.lastMessage = msg
  conv.updatedAt = msg.timestamp
  if (!e.fromMe) conv.unread = (conv.unread || 0) + 1
  if (conv.status === 'resolved' && !e.fromMe) conv.status = 'open'
  save()
  broadcast({ type: 'message', message: msg, conversation: conv, contact })

  // ── Automation engine (message.received + message.first) + Intent routing ──
  if (!e.fromMe) {
    const ctx = { conv, contact, session, message: msg }
    runAutomations('message.received', ctx, broadcast).catch(
      (err) => console.error('[automation message.received]:', err.message),
    )
    // message.first: fires only when this is the first inbound message
    const msgCount = collection('messages').filter(
      (m) => m.conversationId === conv.id && !m.fromMe,
    ).length
    if (msgCount === 1) {
      runAutomations('message.first', ctx, broadcast).catch(
        (err) => console.error('[automation message.first]:', err.message),
      )
    }
    runIntentRouting(ctx, broadcast).catch(
      (err) => console.error('[intent routing]:', err.message),
    )
  }

  // ── AI auto-responder ──
  if (!e.fromMe && conv.botEnabled) {
    try {
      const history = collection('messages')
        .filter((m) => m.conversationId === conv.id)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      const result = await botReply(conv.tenantId, conv, history, e.text)

      if (result) {
        // Human-like typing delay: 2–6 s random, so replies don't look instant/robotic
        await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 4000))
      }

      if (result && typeof result === 'object' && result.handoff) {
        // ── Human handoff ──
        const sent = await sendText(session.id, e.jid, result.message)
        const botMsg = {
          id: sent.id,
          conversationId: conv.id,
          fromMe: true,
          body: result.message,
          type: 'text',
          status: 'sent',
          byBot: true,
          timestamp: sent.timestamp,
        }
        upsert('messages', botMsg)
        conv.botEnabled = false
        conv.status = 'pending'
        conv.lastMessage = botMsg
        conv.updatedAt = botMsg.timestamp
        save()
        broadcast({ type: 'message', message: botMsg, conversation: conv, contact })
        broadcast({ type: 'human.requested', conversation: conv, contact })
        console.log(`[handoff] ${contact.name} requested a human agent`)
      } else if (result) {
        const sent = await sendText(session.id, e.jid, result)
        const botMsg = {
          id: sent.id,
          conversationId: conv.id,
          fromMe: true,
          body: result,
          type: 'text',
          status: 'sent',
          byBot: true,
          timestamp: sent.timestamp,
        }
        upsert('messages', botMsg)
        conv.lastMessage = botMsg
        conv.updatedAt = botMsg.timestamp
        save()
        broadcast({ type: 'message', message: botMsg, conversation: conv, contact })
      }
    } catch (err) {
      console.error('bot pipeline:', err.message)
    }
  }
})

waEvents.on('ack', (e) => {
  const msg = collection('messages').find((m) => m.id === e.id)
  if (!msg) return
  msg.status = e.status
  save()
  broadcast({ type: 'message.status', id: msg.id, conversationId: msg.conversationId, status: e.status })
})

waEvents.on('session', (s) => broadcast({ type: 'session', session: s }))

waEvents.on('history', ({ sessionId, contacts }) => {
  const session = collection('sessions').find((s) => s.id === sessionId)
  if (!session) return
  let n = 0
  for (const c of contacts || []) {
    const jid = c.id
    if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter') || jid.endsWith('@g.us')) continue
    const phone = jid.split('@')[0]
    const existingContact = collection('contacts').find(
      (x) => x.tenantId === session.tenantId && x.chatId === jid,
    )
    if (!existingContact) {
      upsert('contacts', {
        id: uid('c'),
        tenantId: session.tenantId,
        name: c.name || c.notify || `+${phone}`,
        phone: `+${phone}`,
        chatId: jid,
        avatarHue: Math.floor(Math.random() * 360),
        tags: [],
        notes: '',
        optedIn: true,
      })
      n++
    }
  }
  if (n) console.log(`history sync: imported ${n} contacts for ${session.name}`)
  broadcast({ type: 'contacts.synced', tenantId: session.tenantId })
})

// ─── boot ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  const ai = aiStatus()
  console.log(`[portal-backend] http://localhost:${PORT}  (ws: /ws)`)
  console.log(`[portal-backend] AI: ${ai.configured ? `enabled (${ai.model} via ${ai.baseUrl})` : 'NOT configured — set AI_API_KEY in app/.env'}`)
  resumeSessions()
})
