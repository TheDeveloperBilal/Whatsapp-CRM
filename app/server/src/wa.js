// ─── WhatsApp engine (Baileys multi-session manager) ────────────────────────
// Each WaSession = one linked WhatsApp number. Auth state lives under
// server/data/auth/<sessionId> so sessions survive restarts.
// Emits events consumed by index.js: qr, status, message, ack, history.

import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import pino from 'pino'
import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  jidNormalizedUser,
} from '@whiskeysockets/baileys'
import { AUTH_DIR, collection, upsert, save } from './db.js'

const logger = pino({ level: 'warn' })

export const waEvents = new EventEmitter()
const sockets = new Map() // sessionId -> sock
const starting = new Set()

function extractText(msg) {
  const m = msg.message || {}
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    (m.imageMessage ? '[image]' : null) ||
    (m.audioMessage ? '[voice message]' : null) ||
    (m.documentMessage ? `[document] ${m.documentMessage.fileName || ''}`.trim() : null) ||
    (m.stickerMessage ? '[sticker]' : null) ||
    ''
  )
}

function msgType(msg) {
  const m = msg.message || {}
  if (m.imageMessage) return 'image'
  if (m.audioMessage) return 'audio'
  if (m.videoMessage) return 'video'
  if (m.documentMessage) return 'document'
  return 'text'
}

const ackMap = { 2: 'sent', 3: 'delivered', 4: 'read', 5: 'read' }

function setSessionStatus(sessionId, status, extra = {}) {
  const s = collection('sessions').find((x) => x.id === sessionId)
  if (!s) return
  Object.assign(s, { status, ...extra })
  if (status !== 'qr') s.qrCode = undefined
  save()
  waEvents.emit('session', { ...s })
}

export async function startSession(sessionId) {
  const record = collection('sessions').find((x) => x.id === sessionId)
  if (!record) throw new Error(`session ${sessionId} not found`)
  if (sockets.has(sessionId) || starting.has(sessionId)) return record
  starting.add(sessionId)

  const dir = path.join(AUTH_DIR, sessionId)
  fs.mkdirSync(dir, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(dir)
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    browser: Browsers.windows('Chrome'),
    printQRInTerminal: false,
    syncFullHistory: false,
  })
  sockets.set(sessionId, sock)
  setSessionStatus(sessionId, 'connecting')

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (u) => {
    if (u.qr) setSessionStatus(sessionId, 'qr', { qrCode: u.qr })
    if (u.connection === 'open') {
      const phone = sock.user?.id?.split(':')[0] ?? ''
      setSessionStatus(sessionId, 'connected', {
        phone: phone ? `+${phone}` : undefined,
        lastSeen: new Date().toISOString(),
      })
    }
    if (u.connection === 'close') {
      const code = u.lastDisconnect?.error?.output?.statusCode
      sockets.delete(sessionId)
      if (code === DisconnectReason.loggedOut) {
        fs.rmSync(dir, { recursive: true, force: true })
        setSessionStatus(sessionId, 'disconnected', { phone: undefined })
      } else {
        setSessionStatus(sessionId, 'disconnected')
        // auto-retry with backoff
        setTimeout(() => startSession(sessionId).catch(() => {}), 5000)
      }
    }
  })

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return
    for (const m of messages) {
      const jid = m.key.remoteJid
      if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue
      const text = extractText(m)
      if (!text) continue
      waEvents.emit('message', {
        sessionId,
        jid: jidNormalizedUser(jid),
        fromMe: !!m.key.fromMe,
        id: m.key.id,
        pushName: m.pushName,
        text,
        type: msgType(m),
        timestamp: new Date(Number(m.messageTimestamp) * 1000).toISOString(),
      })
    }
  })

  sock.ev.on('messages.update', (updates) => {
    for (const u of updates) {
      const status = ackMap[u.update?.status]
      if (status && u.key?.id) {
        waEvents.emit('ack', { sessionId, id: u.key.id, status })
      }
    }
  })

  sock.ev.on('messaging-history.set', ({ contacts, chats }) => {
    waEvents.emit('history', { sessionId, contacts, chats })
  })

  starting.delete(sessionId)
  return collection('sessions').find((x) => x.id === sessionId)
}

export async function stopSession(sessionId) {
  const sock = sockets.get(sessionId)
  if (sock) {
    try {
      await sock.logout()
    } catch {
      /* already closed */
    }
    try {
      sock.end(undefined)
    } catch {
      /* noop */
    }
    sockets.delete(sessionId)
  }
  fs.rmSync(path.join(AUTH_DIR, sessionId), { recursive: true, force: true })
  setSessionStatus(sessionId, 'disconnected', { phone: undefined })
}

export async function sendText(sessionId, jid, text) {
  const sock = sockets.get(sessionId)
  if (!sock) throw new Error(`session ${sessionId} is not connected`)
  const sent = await sock.sendMessage(jid, { text })
  return {
    id: sent?.key?.id ?? `local-${Date.now()}`,
    timestamp: new Date().toISOString(),
  }
}

// reconnect sessions that were linked before a server restart
export async function resumeSessions() {
  for (const s of collection('sessions')) {
    if (fs.existsSync(path.join(AUTH_DIR, s.id, 'creds.json'))) {
      startSession(s.id).catch((e) => console.error(`resume ${s.id}:`, e.message))
    }
  }
}
