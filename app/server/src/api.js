// ─── REST API ────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { collection, upsert, remove, uid, save, importDb, MEDIA_DIR } from './db.js'
import { startSession, stopSession, sendText } from './wa.js'
import { aiStatus } from './bot.js'
import { runAutomations } from './automations.js'
import { runIntentRouting } from './intents.js'
import { fireTrigger, runWorkflow } from './workflow-engine.js'
import {
  checkPassword,
  hashPassword,
  createToken,
  requireAuth,
  requireSuperAdmin,
  canAccessTenant,
  getPlanLimits,
  loginRateLimit,
} from './auth.js'

// Strip secret key before sending to frontend
function safeGateway(gw) {
  const { secretKey, webhookSecret, ...safe } = gw
  safe.hasSecretKey = !!secretKey
  return safe
}

// Generate a hosted checkout URL via Stripe or PayPal
async function generatePaymentUrl(gw, { amount, currency, description }) {
  if (gw.provider === 'stripe') {
    const body = new URLSearchParams()
    body.append('payment_method_types[]', 'card')
    body.append('mode', 'payment')
    body.append('success_url', 'https://example.com/success')
    body.append('cancel_url', 'https://example.com/cancel')
    body.append('line_items[0][price_data][currency]', currency.toLowerCase())
    body.append('line_items[0][price_data][product_data][name]', description)
    body.append('line_items[0][price_data][unit_amount]', String(Math.round(amount * 100)))
    body.append('line_items[0][quantity]', '1')
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${gw.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || 'Stripe error') }
    const data = await r.json()
    return data.url
  }
  if (gw.provider === 'paypal') {
    // Get access token
    const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${gw.publicKey}:${gw.secretKey}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    })
    if (!tokenRes.ok) throw new Error('PayPal auth failed')
    const { access_token } = await tokenRes.json()
    const orderRes = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: currency.toUpperCase(), value: String(amount) }, description }],
        application_context: { return_url: 'https://example.com/success', cancel_url: 'https://example.com/cancel' },
      }),
    })
    if (!orderRes.ok) throw new Error('PayPal order creation failed')
    const order = await orderRes.json()
    return order.links?.find((l) => l.rel === 'approve')?.href || null
  }
  return null
}

export function buildApi(broadcast) {
  const r = Router()

  // ── Public routes (no auth) ──
  r.get('/health', (_req, res) => res.json({ ok: true, ai: aiStatus() }))

  r.post('/auth/login', loginRateLimit, (req, res) => {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'username and password required' })
    const user = collection('users').find((u) => u.username === username)
    if (!user || !checkPassword(password, user.passwordHash))
      return res.status(401).json({ error: 'invalid credentials' })
    const token = createToken(user)
    res.json({ token, user: { userId: user.id, username: user.username, tenantId: user.tenantId, role: user.role } })
  })

  // All routes below require auth
  r.use(requireAuth)

  // ── Admin DB import (superadmin only) ────────────────────────────────────────
  r.post('/admin/db-import', (req, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'superadmin only' })
    const { db } = req.body
    if (!db || typeof db !== 'object') return res.status(400).json({ error: 'body.db required' })
    try {
      importDb(db)
      res.json({ ok: true, message: 'Database imported. Reload the page.' })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/tenants', (req, res) => {
    const tenants = collection('tenants')
    if (req.user.role === 'superadmin') return res.json(tenants)
    res.json(tenants.filter((t) => t.id === req.user.tenantId))
  })

  // ── Tenant CRUD (superadmin only) ──
  r.post('/tenants', requireSuperAdmin, (req, res) => {
    const { name, slug, plan = 'free', businessType = 'service', adminUsername, adminPassword } = req.body
    if (!name || !slug || !adminUsername || !adminPassword)
      return res.status(400).json({ error: 'name, slug, adminUsername, adminPassword required' })
    if (collection('tenants').find((t) => t.slug === slug))
      return res.status(409).json({ error: 'slug already taken' })
    if (collection('users').find((u) => u.username === adminUsername))
      return res.status(409).json({ error: 'username already taken' })
    const tenant = {
      id: uid('t'),
      name,
      slug,
      plan,
      businessType,
      suspended: false,
      createdAt: new Date().toISOString(),
      members: [],
    }
    upsert('tenants', tenant)
    const user = {
      id: uid('usr'),
      username: adminUsername,
      passwordHash: hashPassword(adminPassword),
      tenantId: tenant.id,
      role: 'owner',
    }
    upsert('users', user)
    // seed required sub-collections
    if (!collection('botConfigs')) collection('botConfigs', [])
    if (!collection('botConfigs').find((c) => c.tenantId === tenant.id)) {
      collection('botConfigs').push({
        tenantId: tenant.id,
        aiEnabled: true,
        persona: "Your name is Sam. You are a customer support rep — a real team member chatting on WhatsApp, not a bot.\n\nTONE: Text like a normal person. Keep replies to 1-3 sentences, friendly and direct. Match the customer's language immediately — if they write in Urdu or Arabic, reply in that language. If casual, match that energy.\n\nNever use bullet points unless they ask for a list. No em-dashes. No corporate jargon. Avoid: certainly, delve, foster, revolutionize, tapestry, testament. Don't open with 'How may I assist' or 'I hope this message finds you well'.\n\nNON-WORK CONVERSATION: If a customer talks about something casual, respond like a real person — warm, brief, and human. You don't have to redirect every message to business.\n\nNEGOTIATION: If a customer asks for a discount, first sell the value and quality of the service. Only if they keep pushing, offer up to 10% discount — never more, and never offer it immediately.\n\nMEMORY: Remember every detail the customer shares. Never ask them to repeat themselves.\n\nIDENTITY: If asked 'are you a bot?': 'Yeah, I'm an AI helping the team — but I can handle most things directly. What do you need?'\n\nLIMITS: Never invent prices or policies not in your knowledge base. For refund terms, payment methods, custom quotes, or contracts — say: 'Let me connect you with our team on that.' Never say 'As an AI I don't have access to'.",
        fallback: 'human',
        fallbackMessage: 'Thanks! A team member will follow up with you shortly. 🙏',
        businessHoursOnly: false,
        model: 'nvidia/nemotron-3-ultra-550b-a55b',
      })
    }
    save()
    broadcast({ type: 'tenant', tenant })
    res.json({ tenant, user: { id: user.id, username: user.username, tenantId: user.tenantId, role: user.role } })
  })

  r.patch('/tenants/:id', requireSuperAdmin, (req, res) => {
    const t = collection('tenants').find((x) => x.id === req.params.id)
    if (!t) return res.status(404).json({ error: 'not found' })
    const { name, plan, businessType, suspended } = req.body
    if (name !== undefined) t.name = name
    if (plan !== undefined) t.plan = plan
    if (businessType !== undefined) t.businessType = businessType
    if (suspended !== undefined) t.suspended = suspended
    save()
    broadcast({ type: 'tenant', tenant: t })
    res.json(t)
  })

  // Owner-level: update own tenant's name / businessType
  r.patch('/tenants/:tid/profile', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const t = collection('tenants').find((x) => x.id === req.params.tid)
    if (!t) return res.status(404).json({ error: 'not found' })
    const { name, businessType } = req.body
    if (name !== undefined) t.name = name.trim()
    if (businessType !== undefined) t.businessType = businessType
    save()
    broadcast({ type: 'tenant', tenant: t })
    res.json(t)
  })

  r.delete('/tenants/:id', requireSuperAdmin, (req, res) => {
    const tid = req.params.id
    if (tid === 't1') return res.status(400).json({ error: 'cannot delete the default tenant' })
    remove('tenants', (t) => t.id === tid)
    remove('users', (u) => u.tenantId === tid)
    save()
    broadcast({ type: 'tenant.deleted', tenantId: tid })
    res.json({ ok: true })
  })

  r.get('/tenants/:tid/users', requireSuperAdmin, (req, res) => {
    const users = collection('users')
      .filter((u) => u.tenantId === req.params.tid)
      .map((u) => ({ id: u.id, username: u.username, tenantId: u.tenantId, role: u.role }))
    res.json(users)
  })

  r.post('/tenants/:tid/users', requireSuperAdmin, (req, res) => {
    const { username, password, role = 'agent' } = req.body
    if (!username || !password) return res.status(400).json({ error: 'username and password required' })
    if (collection('users').find((u) => u.username === username))
      return res.status(409).json({ error: 'username already taken' })
    const user = {
      id: uid('usr'),
      username,
      passwordHash: hashPassword(password),
      tenantId: req.params.tid,
      role,
    }
    upsert('users', user)
    save()
    res.json({ id: user.id, username: user.username, tenantId: user.tenantId, role: user.role })
  })

  r.delete('/tenants/:tid/users/:uid', requireSuperAdmin, (req, res) => {
    const user = collection('users').find((u) => u.id === req.params.uid && u.tenantId === req.params.tid)
    if (!user) return res.status(404).json({ error: 'not found' })
    remove('users', (u) => u.id === req.params.uid)
    save()
    res.json({ ok: true })
  })

  r.patch('/tenants/:tid/users/:uid/password', requireSuperAdmin, (req, res) => {
    const { newPassword } = req.body
    if (!newPassword) return res.status(400).json({ error: 'newPassword required' })
    const user = collection('users').find((u) => u.id === req.params.uid && u.tenantId === req.params.tid)
    if (!user) return res.status(404).json({ error: 'not found' })
    user.passwordHash = hashPassword(newPassword)
    save()
    res.json({ ok: true })
  })

  r.post('/auth/change-password', (req, res) => {
    const { oldPassword, newPassword } = req.body
    const user = collection('users').find((u) => u.id === req.user.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })
    if (!checkPassword(oldPassword, user.passwordHash))
      return res.status(401).json({ error: 'wrong current password' })
    user.passwordHash = hashPassword(newPassword)
    save()
    res.json({ ok: true })
  })

  r.get('/tenants/:tid/bootstrap', (req, res) => {
    const tid = req.params.tid
    if (!canAccessTenant(req.user, tid))
      return res.status(403).json({ error: 'forbidden' })
    const convs = collection('conversations')
      .filter((c) => c.tenantId === tid)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const stats = computeStats(tid)
    res.json({
      tags: collection('tags') || [],
      sessions: (collection('sessions') || []).filter((s) => s.tenantId === tid),
      contacts: (collection('contacts') || []).filter((c) => c.tenantId === tid),
      conversations: convs,
      messagesCount: (collection('messages') || []).length,
      botRules: (collection('botRules') || []).filter((b) => b.tenantId === tid),
      botConfig: (collection('botConfigs') || []).find((b) => b.tenantId === tid) ?? null,
      automations: (collection('automations') || []).filter((a) => a.tenantId === tid),
      cannedResponses: (collection('cannedResponses') || []).filter((cr) => cr.tenantId === tid),
      knowledgeBase: (collection('knowledgeBase') || []).filter((a) => a.tenantId === tid),
      products: (collection('products') || []).filter((p) => p.tenantId === tid),
      campaigns: (collection('campaigns') || []).filter((c) => c.tenantId === tid),
      intents: (collection('intents') || []).filter((i) => i.tenantId === tid),
      pipelineStages: (collection('pipelineStages') || []).filter((s) => s.tenantId === tid).sort((a, b) => a.order - b.order),
      deals: (collection('deals') || []).filter((d) => d.tenantId === tid),
      appointmentTypes: (collection('appointmentTypes') || []).filter((a) => a.tenantId === tid),
      appointments: (collection('appointments') || []).filter((a) => a.tenantId === tid),
      paymentGateways: (collection('paymentGateways') || []).filter((g) => g.tenantId === tid).map(safeGateway),
      paymentLinks: (collection('paymentLinks') || []).filter((p) => p.tenantId === tid),
      invoices: (collection('invoices') || []).filter((i) => i.tenantId === tid),
      stats,
    })
  })

  // ── Media files (voice notes, etc.) ──
  r.get('/media/:msgId', (req, res) => {
    const msgId = req.params.msgId.replace(/[^a-zA-Z0-9_-]/g, '')
    let found
    try {
      found = fs.readdirSync(MEDIA_DIR).find((f) => f.startsWith(msgId + '.'))
    } catch { /* media dir missing */ }
    if (!found) return res.status(404).json({ error: 'not found' })
    const ext = found.split('.').pop()
    const mime = ext === 'mp4' ? 'audio/mp4' : 'audio/ogg; codecs=opus'
    res.setHeader('Content-Type', mime)
    res.setHeader('Accept-Ranges', 'bytes')
    res.sendFile(path.resolve(MEDIA_DIR, found))
  })

  r.get('/conversations/:cid/messages', (req, res) => {
    const conv = collection('conversations').find((c) => c.id === req.params.cid)
    if (!conv) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, conv.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const msgs = collection('messages')
      .filter((m) => m.conversationId === req.params.cid)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    res.json(msgs)
  })

  r.post('/conversations/:cid/messages', async (req, res) => {
    const conv = collection('conversations').find((c) => c.id === req.params.cid)
    if (!conv) return res.status(404).json({ error: 'conversation not found' })
    if (!canAccessTenant(req.user, conv.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const contact = collection('contacts').find((c) => c.id === conv.contactId)
    if (!contact) return res.status(404).json({ error: 'contact not found' })
    try {
      const sent = await sendText(conv.sessionId, contact.chatId, req.body.text)
      const msg = {
        id: sent.id,
        conversationId: conv.id,
        fromMe: true,
        body: req.body.text,
        type: 'text',
        status: 'sent',
        byBot: !!req.body.byBot,
        timestamp: sent.timestamp,
      }
      upsert('messages', msg)
      conv.lastMessage = msg
      conv.updatedAt = msg.timestamp
      save()
      broadcast({ type: 'message', message: msg, conversation: conv, contact })
      res.json(msg)
    } catch (e) {
      res.status(502).json({ error: e.message })
    }
  })

  r.patch('/conversations/:cid', (req, res) => {
    const conv = collection('conversations').find((c) => c.id === req.params.cid)
    if (!conv) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, conv.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const prevStatus = conv.status
    // Whitelist — never allow tenantId, contactId, sessionId to be overwritten
    const { status, botEnabled, assigneeId, unread } = req.body
    if (status !== undefined) conv.status = status
    if (botEnabled !== undefined) conv.botEnabled = botEnabled
    if (assigneeId !== undefined) conv.assigneeId = assigneeId
    if (unread !== undefined) conv.unread = unread
    save()
    broadcast({ type: 'conversation', conversation: conv })
    if (conv.status === 'resolved' && prevStatus !== 'resolved') {
      const contact = collection('contacts').find((c) => c.id === conv.contactId)
      const session = collection('sessions').find((s) => s.id === conv.sessionId)
      if (contact) {
        runAutomations('conversation.resolved', { conv, contact, session }, broadcast).catch(
          (e) => console.error('automation resolved:', e.message),
        )
      }
    }
    res.json(conv)
  })

  r.patch('/contacts/:id', (req, res) => {
    const c = collection('contacts').find((x) => x.id === req.params.id)
    if (!c) return res.status(404).json({ error: 'not found' })
    const prevTags = [...(c.tags || [])]
    Object.assign(c, req.body) // notes / tags / name
    save()
    broadcast({ type: 'contact', contact: c })
    // fire tag.added automation when new tags were added
    const newTags = (c.tags || []).filter((t) => !prevTags.includes(t))
    if (newTags.length) {
      const conv = collection('conversations').find((cv) => cv.contactId === c.id && cv.status === 'open')
      if (conv) {
        const session = collection('sessions').find((s) => s.id === conv.sessionId)
        runAutomations('tag.added', { conv, contact: c, session, message: null }, broadcast).catch(
          (e) => console.error('[automation tag.added]', e.message),
        )
      }
    }
    res.json(c)
  })

  // ── Bulk contact import via CSV rows ──────────────────────────────────────
  r.post('/tenants/:tid/contacts/import', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const rows = req.body.contacts // [{ name, phone, notes?, tags? }]
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'contacts array required' })
    const created = []; const skipped = []
    for (const row of rows) {
      const phone = String(row.phone || '').trim().replace(/\s+/g, '')
      if (!phone) { skipped.push(row); continue }
      const existing = collection('contacts').find((c) => c.tenantId === req.params.tid && c.phone === phone)
      if (existing) { skipped.push(row); continue }
      const contact = {
        id: uid('c'), tenantId: req.params.tid,
        name: String(row.name || phone).trim(),
        phone,
        notes: String(row.notes || '').trim(),
        tags: [],
        avatarHue: Math.floor(Math.random() * 360),
        createdAt: new Date().toISOString(),
      }
      upsert('contacts', contact)
      created.push(contact)
    }
    save()
    created.forEach((c) => broadcast({ type: 'contact', contact: c }))
    res.json({ created: created.length, skipped: skipped.length })
  })

  // ── Pipelines (named pipeline views, each with its own stages) ────────────
  r.get('/tenants/:tid/pipelines', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json(collection('pipelines').filter((p) => p.tenantId === req.params.tid))
  })

  r.post('/tenants/:tid/pipelines', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const { name, department = '' } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const pipeline = { id: uid('pl'), tenantId: req.params.tid, name, department, createdAt: new Date().toISOString() }
    upsert('pipelines', pipeline)
    save()
    res.json(pipeline)
  })

  r.patch('/pipelines/:id', (req, res) => {
    const p = collection('pipelines').find((x) => x.id === req.params.id)
    if (!p) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, p.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const { name, department } = req.body
    if (name !== undefined) p.name = name
    if (department !== undefined) p.department = department
    save()
    res.json(p)
  })

  r.delete('/pipelines/:id', (req, res) => {
    const p = collection('pipelines').find((x) => x.id === req.params.id)
    if (!p) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, p.tenantId)) return res.status(403).json({ error: 'forbidden' })
    remove('pipelines', (x) => x.id === req.params.id)
    // also remove stages that belonged to this pipeline
    remove('pipelineStages', (s) => s.pipelineId === req.params.id)
    save()
    res.json({ ok: true })
  })

  r.post('/sessions', (req, res) => {
    const tenantId = req.body.tenantId
    const tenant = collection('tenants').find((t) => t.id === tenantId)
    if (tenant) {
      const limits = getPlanLimits(tenant.plan)
      const existing = collection('sessions').filter((s) => s.tenantId === tenantId).length
      if (existing >= limits.maxSessions) {
        return res.status(402).json({ error: `plan limit: ${tenant.plan} allows max ${limits.maxSessions} session(s). Upgrade to add more.` })
      }
    }
    const s = {
      id: uid('s'),
      tenantId,
      name: req.body.name,
      engine: 'baileys',
      status: 'disconnected',
      messagesToday: 0,
    }
    upsert('sessions', s)
    broadcast({ type: 'session', session: s })
    res.json(s)
  })

  r.post('/sessions/:sid/start', async (req, res) => {
    try {
      const s = await startSession(req.params.sid)
      res.json(s)
    } catch (e) {
      res.status(502).json({ error: e.message })
    }
  })

  r.delete('/sessions/:sid', async (req, res) => {
    await stopSession(req.params.sid).catch(() => {})
    remove('sessions', (s) => s.id === req.params.sid)
    broadcast({ type: 'session.deleted', sessionId: req.params.sid })
    res.json({ ok: true })
  })

  r.post('/tenants/:tid/bot-rules', (req, res) => {
    const rule = { ...req.body, tenantId: req.params.tid }
    if (!rule.id) rule.id = uid('b')
    upsert('botRules', rule)
    broadcast({ type: 'bot.rule', rule })
    res.json(rule)
  })

  r.delete('/bot-rules/:id', (req, res) => {
    remove('botRules', (b) => b.id === req.params.id)
    broadcast({ type: 'bot.rule.deleted', ruleId: req.params.id })
    res.json({ ok: true })
  })

  r.patch('/tenants/:tid/bot-config', (req, res) => {
    const tid = req.params.tid
    let cfg = collection('botConfigs').find((c) => c.tenantId === tid)
    if (!cfg) {
      cfg = { tenantId: tid }
      collection('botConfigs').push(cfg)
    }
    Object.assign(cfg, req.body)
    save()
    broadcast({ type: 'bot.config', config: cfg })
    res.json(cfg)
  })

  r.post('/tenants/:tid/automations', (req, res) => {
    const rule = { ...req.body, tenantId: req.params.tid }
    if (!rule.id) rule.id = uid('a')
    if (typeof rule.enabled !== 'boolean') rule.enabled = true
    upsert('automations', rule)
    save()
    broadcast({ type: 'automation', automation: rule })
    res.json(rule)
  })

  r.patch('/automations/:id', (req, res) => {
    const a = collection('automations').find((x) => x.id === req.params.id)
    if (!a) return res.status(404).json({ error: 'not found' })
    Object.assign(a, req.body)
    save()
    broadcast({ type: 'automation', automation: a })
    res.json(a)
  })

  r.delete('/automations/:id', (req, res) => {
    remove('automations', (a) => a.id === req.params.id)
    save()
    broadcast({ type: 'automation.deleted', automationId: req.params.id })
    res.json({ ok: true })
  })

  // ── Canned responses ──
  r.post('/tenants/:tid/canned-responses', (req, res) => {
    const cr = { ...req.body, tenantId: req.params.tid }
    if (!cr.id) cr.id = uid('cr')
    upsert('cannedResponses', cr)
    save()
    broadcast({ type: 'canned.response', cannedResponse: cr })
    res.json(cr)
  })

  r.patch('/canned-responses/:id', (req, res) => {
    const cr = collection('cannedResponses').find((x) => x.id === req.params.id)
    if (!cr) return res.status(404).json({ error: 'not found' })
    Object.assign(cr, req.body)
    save()
    broadcast({ type: 'canned.response', cannedResponse: cr })
    res.json(cr)
  })

  r.delete('/canned-responses/:id', (req, res) => {
    remove('cannedResponses', (cr) => cr.id === req.params.id)
    save()
    broadcast({ type: 'canned.response.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // ── Knowledge base ──
  r.post('/tenants/:tid/kb', (req, res) => {
    const article = { ...req.body, tenantId: req.params.tid }
    if (!article.id) article.id = uid('kb')
    upsert('knowledgeBase', article)
    save()
    broadcast({ type: 'kb.article', article })
    res.json(article)
  })

  r.patch('/kb/:id', (req, res) => {
    const a = collection('knowledgeBase').find((x) => x.id === req.params.id)
    if (!a) return res.status(404).json({ error: 'not found' })
    Object.assign(a, req.body)
    save()
    broadcast({ type: 'kb.article', article: a })
    res.json(a)
  })

  r.delete('/kb/:id', (req, res) => {
    remove('knowledgeBase', (a) => a.id === req.params.id)
    save()
    broadcast({ type: 'kb.article.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // ── Products ──
  r.post('/tenants/:tid/products', (req, res) => {
    const p = { ...req.body, tenantId: req.params.tid }
    if (!p.id) p.id = uid('p')
    if (typeof p.active !== 'boolean') p.active = true
    upsert('products', p)
    save()
    broadcast({ type: 'product', product: p })
    res.json(p)
  })

  r.patch('/products/:id', (req, res) => {
    const p = collection('products').find((x) => x.id === req.params.id)
    if (!p) return res.status(404).json({ error: 'not found' })
    Object.assign(p, req.body)
    save()
    broadcast({ type: 'product', product: p })
    res.json(p)
  })

  r.delete('/products/:id', (req, res) => {
    remove('products', (p) => p.id === req.params.id)
    save()
    broadcast({ type: 'product.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // ── Campaigns ──
  r.get('/tenants/:tid/campaigns', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json(collection('campaigns').filter((c) => c.tenantId === req.params.tid))
  })

  r.post('/tenants/:tid/campaigns', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const { name, type = 'organic', phone, welcomeMessage, trackingCode } = req.body
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' })
    const campaign = {
      id: uid('camp'),
      tenantId: req.params.tid,
      name,
      type,
      phone: phone.replace(/\D/g, ''),
      welcomeMessage: welcomeMessage || '',
      trackingCode: trackingCode || uid('ref'),
      active: true,
      leads: 0,
      createdAt: new Date().toISOString(),
    }
    upsert('campaigns', campaign)
    save()
    broadcast({ type: 'campaign', campaign })
    res.json(campaign)
  })

  r.patch('/campaigns/:id', (req, res) => {
    const c = collection('campaigns').find((x) => x.id === req.params.id)
    if (!c) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, c.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const { name, type, phone, welcomeMessage, trackingCode, active } = req.body
    if (name !== undefined) c.name = name
    if (type !== undefined) c.type = type
    if (phone !== undefined) c.phone = phone.replace(/\D/g, '')
    if (welcomeMessage !== undefined) c.welcomeMessage = welcomeMessage
    if (trackingCode !== undefined) c.trackingCode = trackingCode
    if (active !== undefined) c.active = active
    save()
    broadcast({ type: 'campaign', campaign: c })
    res.json(c)
  })

  r.delete('/campaigns/:id', (req, res) => {
    const c = collection('campaigns').find((x) => x.id === req.params.id)
    if (!c) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, c.tenantId)) return res.status(403).json({ error: 'forbidden' })
    remove('campaigns', (x) => x.id === req.params.id)
    save()
    broadcast({ type: 'campaign.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // ── Intent Routing ──
  r.get('/tenants/:tid/intents', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json(collection('intents').filter((i) => i.tenantId === req.params.tid))
  })

  r.post('/tenants/:tid/intents', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const { name, color = '#6366f1', keywords = [], action = 'none', actionTarget, priority = 0 } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const intent = {
      id: uid('int'),
      tenantId: req.params.tid,
      name,
      color,
      keywords: Array.isArray(keywords) ? keywords : keywords.split(',').map((k) => k.trim()).filter(Boolean),
      enabled: true,
      action,
      actionTarget: actionTarget || '',
      priority,
      matchCount: 0,
      createdAt: new Date().toISOString(),
    }
    upsert('intents', intent)
    save()
    broadcast({ type: 'intent', intent })
    res.json(intent)
  })

  r.patch('/intents/:id', (req, res) => {
    const intent = collection('intents').find((x) => x.id === req.params.id)
    if (!intent) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, intent.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const { name, color, keywords, enabled, action, actionTarget, priority } = req.body
    if (name !== undefined) intent.name = name
    if (color !== undefined) intent.color = color
    if (keywords !== undefined) intent.keywords = Array.isArray(keywords) ? keywords : keywords.split(',').map((k) => k.trim()).filter(Boolean)
    if (enabled !== undefined) intent.enabled = enabled
    if (action !== undefined) intent.action = action
    if (actionTarget !== undefined) intent.actionTarget = actionTarget
    if (priority !== undefined) intent.priority = priority
    save()
    broadcast({ type: 'intent', intent })
    res.json(intent)
  })

  r.delete('/intents/:id', (req, res) => {
    const intent = collection('intents').find((x) => x.id === req.params.id)
    if (!intent) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, intent.tenantId)) return res.status(403).json({ error: 'forbidden' })
    remove('intents', (x) => x.id === req.params.id)
    save()
    broadcast({ type: 'intent.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // Test intent matching (POST body: { message, tenantId })
  r.post('/intents/test', (req, res) => {
    const { message, tenantId } = req.body
    if (!message || !tenantId) return res.status(400).json({ error: 'message and tenantId required' })
    if (!canAccessTenant(req.user, tenantId)) return res.status(403).json({ error: 'forbidden' })
    const intents = collection('intents')
      .filter((i) => i.tenantId === tenantId && i.enabled)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    const lower = message.toLowerCase()
    const matched = intents.find((i) =>
      i.keywords?.some((kw) => kw && lower.includes(kw.trim().toLowerCase()))
    )
    res.json({ matched: matched ?? null })
  })

  // ── Meta Lead Ads webhook (public — no auth, verified by hub.verify.token) ──
  r.get('/webhooks/meta', (req, res) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN || 'whatsapp-crm-verify'
    if (mode === 'subscribe' && token === expected) {
      res.status(200).send(challenge)
    } else {
      res.status(403).json({ error: 'verification failed' })
    }
  })

  r.post('/webhooks/meta', (req, res) => {
    res.sendStatus(200) // acknowledge immediately
    try {
      const body = req.body
      if (body.object !== 'page' && body.object !== 'ad_leadgen') return
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'leadgen') continue
          const leadData = change.value || {}
          const formId = leadData.form_id || ''
          // find campaign by trackingCode = formId or just use first active campaign
          const campaigns = collection('campaigns')
          const campaign = campaigns.find((c) => c.trackingCode === formId) || campaigns[0]
          if (!campaign) continue
          // build contact
          const fieldData = leadData.field_data || []
          const get = (n) => (fieldData.find((f) => f.name === n)?.values || [])[0] || ''
          const phone = get('phone_number') || get('phone') || `meta-${leadData.leadgen_id}`
          const name = [get('first_name'), get('last_name')].filter(Boolean).join(' ') || get('full_name') || 'Meta Lead'
          const chatId = phone.replace(/\D/g, '') + '@c.us'
          const existing = collection('contacts').find((c) => c.chatId === chatId && c.tenantId === campaign.tenantId)
          if (!existing) {
            const contact = {
              id: uid('c'),
              tenantId: campaign.tenantId,
              name,
              phone: phone.replace(/\D/g, ''),
              chatId,
              avatarHue: Math.floor(Math.random() * 360),
              tags: [],
              notes: get('email') ? `Email: ${get('email')}` : '',
              optedIn: true,
              source: 'meta_ads',
              campaignId: campaign.id,
              createdAt: new Date().toISOString(),
            }
            collection('contacts').push(contact)
            campaign.leads = (campaign.leads || 0) + 1
            save()
            broadcast({ type: 'contact', contact })
            fireTrigger(campaign.tenantId, 'contact.created', { contactId: contact.id })
          }
        }
      }
    } catch (e) {
      console.error('[meta webhook]', e)
    }
  })

  // ── Pipeline Stages ──
  r.get('/tenants/:tid/pipeline-stages', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json(collection('pipelineStages').filter((s) => s.tenantId === req.params.tid).sort((a, b) => a.order - b.order))
  })

  r.post('/tenants/:tid/pipeline-stages', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const { name, color = '#6366f1', pipelineId = null } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const existing = collection('pipelineStages').filter(
      (s) => s.tenantId === req.params.tid && s.pipelineId === pipelineId
    )
    const stage = { id: uid('ps'), tenantId: req.params.tid, name, color, order: existing.length, pipelineId }
    upsert('pipelineStages', stage)
    save()
    broadcast({ type: 'pipeline.stage', stage })
    res.json(stage)
  })

  r.patch('/pipeline-stages/:id', (req, res) => {
    const stage = collection('pipelineStages').find((s) => s.id === req.params.id)
    if (!stage) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, stage.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const { name, color, order } = req.body
    if (name  !== undefined) stage.name  = name
    if (color !== undefined) stage.color = color
    if (order !== undefined) stage.order = order
    save()
    broadcast({ type: 'pipeline.stage', stage })
    res.json(stage)
  })

  r.delete('/pipeline-stages/:id', (req, res) => {
    const stage = collection('pipelineStages').find((s) => s.id === req.params.id)
    if (!stage) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, stage.tenantId)) return res.status(403).json({ error: 'forbidden' })
    remove('pipelineStages', (s) => s.id === req.params.id)
    save()
    broadcast({ type: 'pipeline.stage.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // ── Deals ──
  r.get('/tenants/:tid/deals', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json(collection('deals').filter((d) => d.tenantId === req.params.tid))
  })

  r.post('/tenants/:tid/deals', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const { contactId, stageId, title, value = 0, currency = 'USD', assigneeId, notes = '' } = req.body
    if (!contactId || !stageId || !title) return res.status(400).json({ error: 'contactId, stageId, title required' })
    const now = new Date().toISOString()
    const deal = { id: uid('deal'), tenantId: req.params.tid, contactId, stageId, title, value: Number(value), currency, assigneeId: assigneeId || null, notes, createdAt: now, updatedAt: now, outcome: null }
    upsert('deals', deal)
    save()
    broadcast({ type: 'deal', deal })
    res.json(deal)
  })

  r.patch('/deals/:id', (req, res) => {
    const deal = collection('deals').find((d) => d.id === req.params.id)
    if (!deal) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, deal.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const { stageId, title, value, currency, assigneeId, notes, outcome } = req.body
    if (stageId    !== undefined) deal.stageId    = stageId
    if (title      !== undefined) deal.title      = title
    if (value      !== undefined) deal.value      = Number(value)
    if (currency   !== undefined) deal.currency   = currency
    if (assigneeId !== undefined) deal.assigneeId = assigneeId
    if (notes      !== undefined) deal.notes      = notes
    if (outcome    !== undefined) { deal.outcome  = outcome; deal.closedAt = outcome ? new Date().toISOString() : null }
    deal.updatedAt = new Date().toISOString()
    save()
    broadcast({ type: 'deal', deal })
    res.json(deal)
  })

  r.delete('/deals/:id', (req, res) => {
    const deal = collection('deals').find((d) => d.id === req.params.id)
    if (!deal) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, deal.tenantId)) return res.status(403).json({ error: 'forbidden' })
    remove('deals', (d) => d.id === req.params.id)
    save()
    broadcast({ type: 'deal.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // ── Appointment Types ──
  r.get('/tenants/:tid/appointment-types', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json((collection('appointmentTypes') || []).filter((a) => a.tenantId === req.params.tid))
  })
  r.post('/tenants/:tid/appointment-types', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const { name, duration = 60, price = 0, currency = 'USD', description = '', active = true } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const at = { id: uid('at'), tenantId: req.params.tid, name, duration: Number(duration), price: Number(price), currency, description, active }
    upsert('appointmentTypes', at)
    save()
    broadcast({ type: 'appointment.type', appointmentType: at })
    res.json(at)
  })
  r.patch('/appointment-types/:id', (req, res) => {
    const at = (collection('appointmentTypes') || []).find((a) => a.id === req.params.id)
    if (!at) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, at.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const { name, duration, price, currency, description, active } = req.body
    if (name        !== undefined) at.name        = name
    if (duration    !== undefined) at.duration    = Number(duration)
    if (price       !== undefined) at.price       = Number(price)
    if (currency    !== undefined) at.currency    = currency
    if (description !== undefined) at.description = description
    if (active      !== undefined) at.active      = active
    save()
    broadcast({ type: 'appointment.type', appointmentType: at })
    res.json(at)
  })
  r.delete('/appointment-types/:id', (req, res) => {
    const at = (collection('appointmentTypes') || []).find((a) => a.id === req.params.id)
    if (!at) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, at.tenantId)) return res.status(403).json({ error: 'forbidden' })
    remove('appointmentTypes', (a) => a.id === req.params.id)
    save()
    broadcast({ type: 'appointment.type.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // ── Appointments ──
  r.get('/tenants/:tid/appointments', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json((collection('appointments') || []).filter((a) => a.tenantId === req.params.tid).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)))
  })
  r.post('/tenants/:tid/appointments', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const { contactId, appointmentTypeId, date, time, notes = '', sessionId } = req.body
    if (!contactId || !appointmentTypeId || !date || !time) return res.status(400).json({ error: 'contactId, appointmentTypeId, date, time required' })
    const now = new Date().toISOString()
    const appt = { id: uid('appt'), tenantId: req.params.tid, contactId, appointmentTypeId, date, time, status: 'confirmed', notes, sessionId: sessionId || null, createdAt: now, updatedAt: now }
    upsert('appointments', appt)
    save()
    broadcast({ type: 'appointment', appointment: appt })
    res.json(appt)
  })
  r.patch('/appointments/:id', (req, res) => {
    const appt = (collection('appointments') || []).find((a) => a.id === req.params.id)
    if (!appt) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, appt.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const { date, time, status, notes, appointmentTypeId } = req.body
    if (date              !== undefined) appt.date              = date
    if (time              !== undefined) appt.time              = time
    if (status            !== undefined) appt.status            = status
    if (notes             !== undefined) appt.notes             = notes
    if (appointmentTypeId !== undefined) appt.appointmentTypeId = appointmentTypeId
    appt.updatedAt = new Date().toISOString()
    save()
    broadcast({ type: 'appointment', appointment: appt })
    res.json(appt)
  })
  r.delete('/appointments/:id', (req, res) => {
    const appt = (collection('appointments') || []).find((a) => a.id === req.params.id)
    if (!appt) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, appt.tenantId)) return res.status(403).json({ error: 'forbidden' })
    remove('appointments', (a) => a.id === req.params.id)
    save()
    broadcast({ type: 'appointment.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // ── Payment Gateways ──
  r.get('/tenants/:tid/payment-gateways', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json((collection('paymentGateways') || []).filter((g) => g.tenantId === req.params.tid).map(safeGateway))
  })
  r.post('/tenants/:tid/payment-gateways', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const { provider, name, secretKey, publicKey = '', webhookSecret = '', live = false, active = true } = req.body
    if (!provider || !name || !secretKey) return res.status(400).json({ error: 'provider, name, secretKey required' })
    const gw = { id: uid('gw'), tenantId: req.params.tid, provider, name, secretKey, publicKey, webhookSecret, live, active, createdAt: new Date().toISOString() }
    upsert('paymentGateways', gw)
    save()
    broadcast({ type: 'payment.gateway', gateway: safeGateway(gw) })
    res.json(safeGateway(gw))
  })
  r.patch('/payment-gateways/:id', (req, res) => {
    const gw = (collection('paymentGateways') || []).find((g) => g.id === req.params.id)
    if (!gw) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, gw.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const { name, secretKey, publicKey, webhookSecret, live, active } = req.body
    if (name          !== undefined) gw.name          = name
    if (secretKey     !== undefined) gw.secretKey     = secretKey
    if (publicKey     !== undefined) gw.publicKey     = publicKey
    if (webhookSecret !== undefined) gw.webhookSecret = webhookSecret
    if (live          !== undefined) gw.live          = live
    if (active        !== undefined) gw.active        = active
    save()
    broadcast({ type: 'payment.gateway', gateway: safeGateway(gw) })
    res.json(safeGateway(gw))
  })
  r.delete('/payment-gateways/:id', (req, res) => {
    const gw = (collection('paymentGateways') || []).find((g) => g.id === req.params.id)
    if (!gw) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, gw.tenantId)) return res.status(403).json({ error: 'forbidden' })
    remove('paymentGateways', (g) => g.id === req.params.id)
    save()
    broadcast({ type: 'payment.gateway.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // ── Payment Links ──
  r.get('/tenants/:tid/payment-links', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json((collection('paymentLinks') || []).filter((p) => p.tenantId === req.params.tid))
  })
  r.post('/tenants/:tid/payment-links', async (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const { contactId, dealId, amount, currency = 'USD', description, gatewayId, expiresInHours = 24 } = req.body
    if (!contactId || !amount || !description || !gatewayId) return res.status(400).json({ error: 'contactId, amount, description, gatewayId required' })
    const gw = (collection('paymentGateways') || []).find((g) => g.id === gatewayId)
    if (!gw) return res.status(404).json({ error: 'gateway not found' })
    let url = null
    try { url = await generatePaymentUrl(gw, { amount: Number(amount), currency, description }) } catch (e) { console.error('[payment]', e.message) }
    const expiresAt = new Date(Date.now() + expiresInHours * 3600_000).toISOString()
    const link = { id: uid('pl'), tenantId: req.params.tid, contactId, dealId: dealId || null, gatewayId, provider: gw.provider, amount: Number(amount), currency, description, status: url ? 'active' : 'failed', url, expiresAt, paidAt: null, createdAt: new Date().toISOString() }
    upsert('paymentLinks', link)
    save()
    broadcast({ type: 'payment.link', link })
    res.json(link)
  })
  r.patch('/payment-links/:id', (req, res) => {
    const link = (collection('paymentLinks') || []).find((p) => p.id === req.params.id)
    if (!link) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, link.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const { status, paidAt } = req.body
    if (status !== undefined) link.status = status
    if (paidAt !== undefined) link.paidAt = paidAt
    save()
    broadcast({ type: 'payment.link', link })
    res.json(link)
  })

  // ── Send payment link via WhatsApp ──
  r.post('/payment-links/:id/send', async (req, res) => {
    const link = (collection('paymentLinks') || []).find((p) => p.id === req.params.id)
    if (!link) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, link.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const contact = collection('contacts').find((c) => c.id === link.contactId)
    if (!contact) return res.status(404).json({ error: 'contact not found' })
    const sessions = collection('sessions').filter((s) => s.tenantId === link.tenantId && s.status === 'connected')
    if (!sessions.length) return res.status(502).json({ error: 'no connected session' })
    const session = sessions[0]
    const msg = req.body.message || `💳 *Payment Request*\n\nAmount: ${link.currency} ${link.amount}\n${link.description}\n\nPay here: ${link.url || '(link pending)'}\n\nThis link expires in 24 hours.`
    try {
      const sent = await sendText(session.id, contact.chatId, msg)
      const conv = collection('conversations').find((c) => c.tenantId === link.tenantId && c.contactId === link.contactId) || null
      if (conv) {
        const m = { id: sent.id, conversationId: conv.id, fromMe: true, body: msg, type: 'text', status: 'sent', byBot: false, timestamp: sent.timestamp }
        upsert('messages', m)
        conv.lastMessage = m; conv.updatedAt = m.timestamp; save()
        broadcast({ type: 'message', message: m, conversation: conv, contact })
      }
      res.json({ ok: true })
    } catch (e) { res.status(502).json({ error: e.message }) }
  })

  // ── Invoices ──
  r.get('/tenants/:tid/invoices', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json((collection('invoices') || []).filter((i) => i.tenantId === req.params.tid))
  })
  r.post('/tenants/:tid/invoices', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const { contactId, dealId, items = [], currency = 'USD', dueDate, notes = '' } = req.body
    if (!contactId || !items.length) return res.status(400).json({ error: 'contactId and items required' })
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
    const tax = req.body.taxPct ? Math.round(subtotal * (req.body.taxPct / 100) * 100) / 100 : 0
    const inv = { id: uid('inv'), tenantId: req.params.tid, contactId, dealId: dealId || null, items, subtotal, tax, total: subtotal + tax, currency, dueDate: dueDate || null, notes, status: 'draft', paidAt: null, createdAt: new Date().toISOString() }
    upsert('invoices', inv)
    save()
    broadcast({ type: 'invoice', invoice: inv })
    res.json(inv)
  })
  r.patch('/invoices/:id', (req, res) => {
    const inv = (collection('invoices') || []).find((i) => i.id === req.params.id)
    if (!inv) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, inv.tenantId)) return res.status(403).json({ error: 'forbidden' })
    const { status, paidAt, notes, dueDate } = req.body
    if (status  !== undefined) inv.status  = status
    if (paidAt  !== undefined) inv.paidAt  = paidAt
    if (notes   !== undefined) inv.notes   = notes
    if (dueDate !== undefined) inv.dueDate = dueDate
    save()
    broadcast({ type: 'invoice', invoice: inv })
    res.json(inv)
  })
  r.delete('/invoices/:id', (req, res) => {
    const inv = (collection('invoices') || []).find((i) => i.id === req.params.id)
    if (!inv) return res.status(404).json({ error: 'not found' })
    if (!canAccessTenant(req.user, inv.tenantId)) return res.status(403).json({ error: 'forbidden' })
    remove('invoices', (i) => i.id === req.params.id)
    save()
    broadcast({ type: 'invoice.deleted', id: req.params.id })
    res.json({ ok: true })
  })

  // ── Broadcast ──
  r.post('/tenants/:tid/broadcast', async (req, res) => {
    const tenant = collection('tenants').find((t) => t.id === req.params.tid)
    if (tenant && !getPlanLimits(tenant.plan).broadcast)
      return res.status(402).json({ error: `plan limit: broadcast is not available on the ${tenant.plan} plan. Upgrade to Pro or Business.` })
    const { message, contactIds } = req.body
    if (!message || !Array.isArray(contactIds) || contactIds.length === 0)
      return res.status(400).json({ error: 'message and contactIds required' })

    // Hard cap: sending to more than 200 contacts in one blast is high ban risk
    const BATCH_LIMIT = 200
    if (contactIds.length > BATCH_LIMIT)
      return res.status(400).json({
        error: `Broadcast limited to ${BATCH_LIMIT} contacts per send to reduce WhatsApp ban risk. Split into smaller batches.`,
      })

    const sessions = collection('sessions').filter(
      (s) => s.tenantId === req.params.tid && s.status === 'connected',
    )
    if (sessions.length === 0) return res.status(502).json({ error: 'no connected sessions' })
    const session = sessions[0]

    const results = []
    for (let i = 0; i < contactIds.length; i++) {
      const cid = contactIds[i]
      const contact = collection('contacts').find((c) => c.id === cid)
      if (!contact) { results.push({ contactId: cid, ok: false, error: 'not found' }); continue }
      try {
        // Random 3–8 s delay between every send — mimics a human typing and sending
        await new Promise((resolve) => setTimeout(resolve, 3000 + Math.random() * 5000))
        // Extra 30 s cooldown every 20 messages — avoids sustained sending patterns
        if (i > 0 && i % 20 === 0) {
          console.log(`[broadcast] 20-message cooldown pause (sent ${i}/${contactIds.length})`)
          await new Promise((resolve) => setTimeout(resolve, 30_000))
        }
        const sent = await sendText(session.id, contact.chatId, message)
        let conv = collection('conversations').find(
          (c) => c.tenantId === req.params.tid && c.sessionId === session.id && c.contactId === cid,
        )
        if (!conv) {
          conv = { id: uid('cv'), tenantId: req.params.tid, sessionId: session.id, contactId: cid, status: 'open', botEnabled: false, unread: 0, updatedAt: new Date().toISOString() }
          upsert('conversations', conv)
        }
        const msg = { id: sent.id, conversationId: conv.id, fromMe: true, body: message, type: 'text', status: 'sent', byBot: false, timestamp: sent.timestamp }
        upsert('messages', msg)
        conv.lastMessage = msg; conv.updatedAt = msg.timestamp
        save()
        broadcast({ type: 'message', message: msg, conversation: conv, contact })
        results.push({ contactId: cid, ok: true })
      } catch (e) {
        results.push({ contactId: cid, ok: false, error: e.message })
      }
    }
    res.json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results })
  })

  // ── Workflows ──────────────────────────────────────────────────────────────
  r.get('/tenants/:tid/workflows', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    res.json(collection('workflows').filter(w => w.tenantId === req.params.tid))
  })

  r.post('/tenants/:tid/workflows', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const wf = {
      id: uid('wf'),
      tenantId: req.params.tid,
      name: req.body.name || 'Untitled Workflow',
      description: req.body.description || '',
      enabled: false,
      nodes: req.body.nodes || [],
      edges: req.body.edges || [],
      triggerType: req.body.triggerType || 'manual',
      triggerConfig: req.body.triggerConfig || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
    }
    upsert('workflows', wf)
    save()
    broadcast({ type: 'workflow', workflow: wf })
    res.json(wf)
  })

  r.put('/tenants/:tid/workflows/:wid', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const wf = collection('workflows').find(w => w.id === req.params.wid && w.tenantId === req.params.tid)
    if (!wf) return res.status(404).json({ error: 'not found' })
    Object.assign(wf, { ...req.body, id: wf.id, tenantId: wf.tenantId, updatedAt: new Date().toISOString() })
    save()
    broadcast({ type: 'workflow', workflow: wf })
    res.json(wf)
  })

  r.patch('/tenants/:tid/workflows/:wid/toggle', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const wf = collection('workflows').find(w => w.id === req.params.wid && w.tenantId === req.params.tid)
    if (!wf) return res.status(404).json({ error: 'not found' })
    wf.enabled = !wf.enabled
    wf.updatedAt = new Date().toISOString()
    save()
    broadcast({ type: 'workflow', workflow: wf })
    res.json(wf)
  })

  r.delete('/tenants/:tid/workflows/:wid', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    remove('workflows', w => w.id === req.params.wid && w.tenantId === req.params.tid)
    save()
    broadcast({ type: 'workflow.deleted', id: req.params.wid })
    res.json({ ok: true })
  })

  r.get('/tenants/:tid/workflows/:wid/runs', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const runs = collection('workflowRuns')
      .filter(r => r.workflowId === req.params.wid)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, 50)
    res.json(runs)
  })

  r.post('/tenants/:tid/workflows/:wid/trigger', (req, res) => {
    if (!canAccessTenant(req.user, req.params.tid)) return res.status(403).json({ error: 'forbidden' })
    const wf = collection('workflows').find(w => w.id === req.params.wid && w.tenantId === req.params.tid)
    if (!wf) return res.status(404).json({ error: 'not found' })
    runWorkflow(wf, req.body.context || {}).catch(console.error)
    res.json({ ok: true, message: 'Workflow triggered' })
  })

  return r
}

export function computeStats(tid) {
  const convs = collection('conversations').filter((c) => c.tenantId === tid)
  const convIds = new Set(convs.map((c) => c.id))
  const msgs = collection('messages').filter((m) => convIds.has(m.conversationId))
  const today = new Date().toDateString()
  const sessions = collection('sessions').filter((s) => s.tenantId === tid)

  const fromMe = msgs.filter((m) => m.fromMe)
  const botMsgs = fromMe.filter((m) => m.byBot)

  // avg first response (min) across conversations that got a reply
  let rtSum = 0
  let rtN = 0
  for (const c of convs) {
    const cmsgs = msgs
      .filter((m) => m.conversationId === c.id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    const firstIn = cmsgs.find((m) => !m.fromMe)
    const firstOut = cmsgs.find((m) => m.fromMe && (!firstIn || m.timestamp > firstIn.timestamp))
    if (firstIn && firstOut) {
      rtSum += (new Date(firstOut.timestamp) - new Date(firstIn.timestamp)) / 60000
      rtN++
    }
  }

  // 7-day message volume split bot vs human (drives the Overview chart)
  const volume7d = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const key = d.toDateString()
    const dayMsgs = msgs.filter((m) => new Date(m.timestamp).toDateString() === key && m.fromMe)
    volume7d.push({
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      bot: dayMsgs.filter((m) => m.byBot).length,
      human: dayMsgs.filter((m) => !m.byBot).length,
    })
  }

  return {
    openConversations: convs.filter((c) => c.status === 'open').length,
    messagesToday: msgs.filter((m) => new Date(m.timestamp).toDateString() === today).length,
    responseRatePct: convs.length
      ? Math.round((convs.filter((c) => fromMe.some((m) => m.conversationId === c.id)).length / convs.length) * 100)
      : 0,
    avgFirstResponseMin: rtN ? Math.round((rtSum / rtN) * 10) / 10 : 0,
    activeSessions: sessions.filter((s) => s.status === 'connected').length,
    botHandledPct: fromMe.length ? Math.round((botMsgs.length / fromMe.length) * 100) : 0,
    volume7d,
  }
}
