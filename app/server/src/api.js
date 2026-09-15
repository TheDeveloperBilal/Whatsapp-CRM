// ─── REST API ────────────────────────────────────────────────────────────────
import { Router } from 'express'
import { collection, upsert, remove, uid, save } from './db.js'
import { startSession, stopSession, sendText } from './wa.js'
import { aiStatus } from './bot.js'
import { runAutomations } from './automations.js'
import {
  checkPassword,
  hashPassword,
  createToken,
  requireAuth,
  requireSuperAdmin,
  canAccessTenant,
  getPlanLimits,
} from './auth.js'

export function buildApi(broadcast) {
  const r = Router()

  // ── Public routes (no auth) ──
  r.get('/health', (_req, res) => res.json({ ok: true, ai: aiStatus() }))

  r.post('/auth/login', (req, res) => {
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
      collection('botConfigs').push({ tenantId: tenant.id, aiEnabled: false, persona: '', fallback: 'human', fallbackMessage: '', businessHoursOnly: false, model: '' })
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
      tags: collection('tags'),
      sessions: collection('sessions').filter((s) => s.tenantId === tid),
      contacts: collection('contacts').filter((c) => c.tenantId === tid),
      conversations: convs,
      messagesCount: collection('messages').length,
      botRules: collection('botRules').filter((b) => b.tenantId === tid),
      botConfig: collection('botConfigs').find((b) => b.tenantId === tid) ?? null,
      automations: collection('automations').filter((a) => a.tenantId === tid),
      cannedResponses: collection('cannedResponses').filter((cr) => cr.tenantId === tid),
      knowledgeBase: collection('knowledgeBase').filter((a) => a.tenantId === tid),
      products: collection('products').filter((p) => p.tenantId === tid),
      stats,
    })
  })

  r.get('/conversations/:cid/messages', (req, res) => {
    const msgs = collection('messages')
      .filter((m) => m.conversationId === req.params.cid)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    res.json(msgs)
  })

  r.post('/conversations/:cid/messages', async (req, res) => {
    const conv = collection('conversations').find((c) => c.id === req.params.cid)
    if (!conv) return res.status(404).json({ error: 'conversation not found' })
    const contact = collection('contacts').find((c) => c.id === conv.contactId)
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
    const prevStatus = conv.status
    Object.assign(conv, req.body) // status / botEnabled / assigneeId / unread
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
    Object.assign(c, req.body) // notes / tags / name
    save()
    broadcast({ type: 'contact', contact: c })
    res.json(c)
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

  // ── Broadcast ──
  r.post('/tenants/:tid/broadcast', async (req, res) => {
    const tenant = collection('tenants').find((t) => t.id === req.params.tid)
    if (tenant && !getPlanLimits(tenant.plan).broadcast)
      return res.status(402).json({ error: `plan limit: broadcast is not available on the ${tenant.plan} plan. Upgrade to Pro or Business.` })
    const { message, contactIds } = req.body
    if (!message || !Array.isArray(contactIds) || contactIds.length === 0)
      return res.status(400).json({ error: 'message and contactIds required' })

    const sessions = collection('sessions').filter(
      (s) => s.tenantId === req.params.tid && s.status === 'connected',
    )
    if (sessions.length === 0) return res.status(502).json({ error: 'no connected sessions' })
    const session = sessions[0]

    const results = []
    for (const cid of contactIds) {
      const contact = collection('contacts').find((c) => c.id === cid)
      if (!contact) { results.push({ contactId: cid, ok: false, error: 'not found' }); continue }
      try {
        // small delay between sends to avoid rate-limiting
        await new Promise((r) => setTimeout(r, 800))
        const sent = await sendText(session.id, contact.chatId, message)
        // persist as a conversation message
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
