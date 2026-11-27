// ─── AI auto-responder worker ────────────────────────────────────────────────
// Pipeline per inbound message (when the conversation's bot toggle is ON):
//   1. keyword / regex rules from the Bots page (fast, free)
//   2. generative AI fallback via an OpenAI-compatible endpoint
//      (AI_API_KEY / AI_BASE_URL / AI_MODEL in app/.env — Kimi, OpenAI, …)
//   3. human handoff per the tenant's fallback policy

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collection } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// minimal .env loader (no dependency)
const envFile = path.join(__dirname, '..', '..', '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

// Primary: OpenRouter (paid, routed across many providers — far fewer outages than Gemini's free tier)
const NVIDIA_KEY   = process.env.AI_API_KEY || ''
const NVIDIA_BASE  = (process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const NVIDIA_MODEL = process.env.AI_MODEL || 'openai/gpt-oss-120b'

// Fallback: Google Gemini (native API — newer keys use v3+ models)
const GEMINI_KEY  = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash'

const hasAny = !!(GEMINI_KEY || NVIDIA_KEY)

export const aiStatus = () => ({
  configured: hasAny,
  primary: NVIDIA_KEY ? `openrouter (${NVIDIA_MODEL})` : GEMINI_KEY ? `gemini (${GEMINI_MODEL})` : null,
  fallback: NVIDIA_KEY && GEMINI_KEY ? `gemini (${GEMINI_MODEL})` : null,
})

const HANDOFF_KEYWORDS = [
  'human', 'real person', 'real agent', 'real human', 'real customer service',
  'agent', 'talk to someone', 'speak to someone',
  'customer service', 'representative', 'staff',
  'manager', 'boss', 'supervisor', 'transfer me',
  'manusia', 'orang asli', 'cs', 'admin', 'operator',
]

function isHandoffRequest(text) {
  // Check only the last line — the burst may include old messages with keywords like
  // "admin_kyefn8vu" (credentials), so we only look at what the customer most recently said.
  const lastLine = text.split('\n').filter(Boolean).pop() || text
  const lower = lastLine.toLowerCase()
  return HANDOFF_KEYWORDS.some((kw) => lower.includes(kw))
}

function matchRule(rule, text) {
  const body = text.toLowerCase()
  if (rule.matchType === 'regex') {
    try {
      return new RegExp(rule.pattern, 'i').test(text)
    } catch {
      return false
    }
  }
  // keyword + intent both match comma-separated words/phrases
  return rule.pattern
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .some((k) => body.includes(k))
}

function businessHoursOk(cfg) {
  if (!cfg.businessHoursOnly) return true
  const h = new Date().getHours()
  return h >= 8 && h < 21
}

// Native Gemini API (newer keys only support v3+ models via native endpoint)
async function callGemini(messages) {
  const system = messages.find(m => m.role === 'system')
  const chat = messages.filter(m => m.role !== 'system')
  const contents = chat.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const body = {
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
  }
  if (system) body.systemInstruction = { parts: [{ text: system.content }] }

  const attempt = async () => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25_000)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      )
      if (res.status === 503 || res.status === 429) {
        const err = new Error(`Gemini ${res.status}`)
        err.retryable = true
        throw err
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null
    } finally {
      clearTimeout(t)
    }
  }
  try {
    return await attempt()
  } catch (e) {
    if (e.retryable) {
      await new Promise(r => setTimeout(r, 2000))
      return await attempt()
    }
    throw e
  }
}

// OpenRouter (OpenAI-compatible) for Nvidia fallback
async function callOpenRouter(apiKey, baseUrl, model, messages) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 25_000)
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'WhatsApp Portal',
      },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 800 }),
    })
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } finally {
    clearTimeout(t)
  }
}

const WHATSAPP_STYLE = `--- HOW TO WRITE (most important) ---
You are texting on WhatsApp as a real person. Plain text only.
Never use markdown: no **bold**, no # headings, no bullet symbols.
Never use dashes of any kind (no "-", no em or en dashes) between words or at the start of lines. Use commas, full stops or a new line instead. Write "one time" not "one-time", "on page SEO" not "on-page SEO".
When listing a few prices or packages, put each on its own short line, like "Identity: AED 799, up to 50 products".
Keep it short and warm, like a helpful salesperson texting a customer. Use everyday words. Avoid words that sound like AI: certainly, absolutely, delve, foster, leverage, elevate, seamless, robust, comprehensive, cutting edge, tailored, streamline, empower, unlock, game changer, rest assured, I'd be happy to, great question, feel free to, don't hesitate.`

// Safety net: WhatsApp shows markdown literally, and dashes read as machine written
export function humanize(text) {
  if (!text) return text
  const isLink = (t) => /:\/\/|^www\.|@|\.(com|co|net|org|pk|ae|io)\b/i.test(t)
  return text
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^[ \t]*(?:[-*•▪◦–—]|\d+[.)])[ \t]+/gm, '')
    .replace(/(\d)[‐‑  ](\d{3})(?!\d)/g, '$1,$2')
    .replace(/(\d)\s*[–—‒―‐‑]\s*(\d)/g, '$1 to $2')
    .replace(/\s*[–—‒―]\s*/g, ', ')
    .replace(/(\S)[ \t]+-[ \t]+(?=\S)/g, '$1, ')
    .split(/(\s+)/)
    .map((t) => (isLink(t) ? t : t.replace(/([\p{L}\p{N}])[-‐‑]+(?=[\p{L}\p{N}])/gu, '$1 ')))
    .join('')
    .replace(/[ \t]+([,.!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function buildSystemPrompt(cfg, history = []) {
  let systemContent = cfg.persona

  // Caps only guard against runaway size; at the old 3000 the pricing articles never reached the model
  const kbArticles = collection('knowledgeBase').filter((a) => a.tenantId === cfg.tenantId)
  if (kbArticles.length > 0) {
    let kbBlock = kbArticles
      .map((a) => `### ${a.title}\n${a.body || a.content || ''}`)
      .join('\n\n')
    if (kbBlock.length > 40000) kbBlock = kbBlock.slice(0, 40000) + '\n...[truncated]'
    systemContent += `\n\n--- KNOWLEDGE BASE ---\nUse the information below to answer customer questions accurately. Do not invent facts not present here.\n\n${kbBlock}\n--- END KNOWLEDGE BASE ---`
  }

  // Inject product catalog so the AI knows prices, stock, and variants
  const products = collection('products').filter((p) => p.tenantId === cfg.tenantId && p.active)
  if (products.length > 0) {
    const fmt = (p) => {
      const parts = [`• ${p.name}`]
      parts.push(`  Category: ${p.category}`)
      parts.push(`  Price: ${p.currency} ${p.price.toLocaleString()}${p.pricingModel === 'hourly' ? '/hr' : p.pricingModel === 'quote' ? ' (quote)' : ''}`)
      if (p.description) parts.push(`  Details: ${p.description}`)
      if (p.type === 'physical') {
        if (typeof p.stock === 'number') {
          parts.push(`  Stock: ${p.stock === 0 ? 'OUT OF STOCK' : `${p.stock} units available`}`)
        } else {
          parts.push(`  Stock: Available`)
        }
        if (p.sku) parts.push(`  SKU: ${p.sku}`)
        if (p.variants?.length) {
          const vStr = p.variants.map((v) => `${v.name}: ${v.options.join(', ')}`).join(' | ')
          parts.push(`  Variants: ${vStr}`)
        }
      } else if (p.type === 'digital') {
        parts.push(`  Type: Digital product`)
        if (p.deliveryInfo) parts.push(`  Delivery: ${p.deliveryInfo}`)
      } else if (p.type === 'service') {
        parts.push(`  Type: Service`)
        if (p.availability) parts.push(`  Availability: ${p.availability}`)
      }
      return parts.join('\n')
    }
    const grouped = {}
    for (const p of products) {
      if (!grouped[p.type]) grouped[p.type] = []
      grouped[p.type].push(p)
    }
    const sections = []
    if (grouped.physical) sections.push(`[Physical Products]\n${grouped.physical.map(fmt).join('\n\n')}`)
    if (grouped.digital) sections.push(`[Digital Products]\n${grouped.digital.map(fmt).join('\n\n')}`)
    if (grouped.service) sections.push(`[Services]\n${grouped.service.map(fmt).join('\n\n')}`)
    let catalog = sections.join('\n\n')
    if (catalog.length > 20000) catalog = catalog.slice(0, 20000) + '\n...[truncated]'
    systemContent += `\n\n--- PRODUCT CATALOG ---\nUse ONLY this data to answer product questions. Never invent products, prices, or stock levels not listed here. If a product is OUT OF STOCK, clearly say so.\n\n${catalog}\n--- END PRODUCT CATALOG ---`
  }
  if (history.length > 0) {
    const first = new Date(history[0].timestamp)
    const lastHuman = history.filter((m) => !m.fromMe).at(-1)
    const daysSince = Math.round((Date.now() - first.getTime()) / 86_400_000)
    const contextNote = [
      `\n\n--- CONVERSATION MEMORY ---`,
      `This is an ongoing conversation that started ${daysSince === 0 ? 'today' : `${daysSince} day(s) ago`} (${first.toLocaleDateString()}).`,
      `Total messages exchanged: ${history.length}.`,
      lastHuman?.body ? `The customer's last topic: "${lastHuman.body.slice(0, 120)}"` : '',
      `Use the full chat history below to maintain continuity. Never ask for information the customer already gave.`,
      `--- END MEMORY ---`,
    ].filter(Boolean).join('\n')
    systemContent += contextNote
  }

  // Last, so the style rules outweigh the formatting of the knowledge base above
  return `${systemContent}\n\n${WHATSAPP_STYLE}`
}

async function callLLM(cfg, history, inboundText) {
  // history holds only messages before the customer's current burst, which is
  // appended below as the final user turn
  const recentHistory = history.slice(-60)
  const messages = [
    { role: 'system', content: buildSystemPrompt(cfg, history) },
    ...recentHistory.map((m) => ({
      role: m.fromMe ? 'assistant' : 'user',
      content: m.body || '[media message]',
    })),
    { role: 'user', content: inboundText },
  ]
  if (NVIDIA_KEY) {
    try {
      const reply = await callOpenRouter(NVIDIA_KEY, NVIDIA_BASE, NVIDIA_MODEL, messages)
      if (reply) return humanize(reply)
    } catch (e) {
      console.warn(`[AI] OpenRouter failed (${e.message.slice(0, 160)}), trying Gemini fallback...`)
    }
  }

  if (GEMINI_KEY) {
    return humanize(await callGemini(messages))
  }

  return null
}

// returns: string | null | { handoff: true, message: string }
export async function botReply(tenantId, conversation, history, inboundText) {
  const cfg = collection('botConfigs').find((c) => c.tenantId === tenantId)
  if (!cfg) return null
  // An empty prompt makes the model invent a conversation
  if (!inboundText?.trim()) return null

  if (!businessHoursOk(cfg)) {
    return cfg.fallback === 'message' ? cfg.fallbackMessage : null
  }

  // 0. human handoff detection (highest priority — check before anything else)
  if (isHandoffRequest(inboundText)) {
    // look for a /human canned response, else use default
    const canned = collection('cannedResponses').find(
      (cr) => cr.tenantId === tenantId && cr.shortcut === '/human',
    )
    const message =
      canned?.body ||
      'Sure! Let me connect you with a team member. Please hold on for a moment. 🙏'
    return { handoff: true, message }
  }

  // 1. rules first
  const rules = collection('botRules').filter(
    (r) =>
      r.tenantId === tenantId &&
      r.enabled &&
      (r.sessionIds.length === 0 || r.sessionIds.includes(conversation.sessionId)),
  )
  for (const rule of rules) {
    if (matchRule(rule, inboundText)) return rule.response
  }

  // 2. generative AI (Gemini primary → Nvidia fallback)
  if (cfg.aiEnabled && hasAny) {
    let aiResult = null
    try {
      aiResult = await callLLM(cfg, history, inboundText)
    } catch (e) {
      console.error('[AI] All models failed:', e.message)
    }
    if (aiResult) return aiResult
    // AI produced nothing — signal a transient failure; caller tracks consecutive count
    if (cfg.fallback === 'human') return { handoff: true, aiFailure: true, message: cfg.fallbackMessage }
    if (cfg.fallback === 'message') return cfg.fallbackMessage
    return null
  }

  // 3. no AI keys configured
  if (cfg.aiEnabled) {
    return `${cfg.fallbackMessage}\n\n_(AI key not configured — add GEMINI_API_KEY or AI_API_KEY in app/.env)_`
  }
  return cfg.fallback === 'message' ? cfg.fallbackMessage : null
}
