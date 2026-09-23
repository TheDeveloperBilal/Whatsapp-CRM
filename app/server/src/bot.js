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
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

// Primary: Google Gemini (uses Google's OpenAI-compatible endpoint)
const GEMINI_KEY  = process.env.GEMINI_API_KEY || ''
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'

// Fallback: Nvidia via OpenRouter
const NVIDIA_KEY   = process.env.AI_API_KEY || ''
const NVIDIA_BASE  = (process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const NVIDIA_MODEL = process.env.AI_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b'

const hasAny = !!(GEMINI_KEY || NVIDIA_KEY)

export const aiStatus = () => ({
  configured: hasAny,
  primary: GEMINI_KEY ? `gemini (${GEMINI_MODEL})` : null,
  fallback: NVIDIA_KEY ? `nvidia via openrouter (${NVIDIA_MODEL})` : null,
})

const HANDOFF_KEYWORDS = [
  'human', 'real person', 'real agent', 'real human', 'real customer service',
  'agent', 'talk to someone', 'speak to someone',
  'customer service', 'representative', 'staff',
  'manager', 'boss', 'supervisor', 'transfer me',
  'manusia', 'orang asli', 'cs', 'admin', 'operator',
]

function isHandoffRequest(text) {
  const lower = text.toLowerCase()
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

async function callOneLLM(apiKey, baseUrl, model, messages) {
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
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 400 }),
    })
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } finally {
    clearTimeout(t)
  }
}

async function callLLM(cfg, history, inboundText) {
  // Build conversation context for the system prompt
  let systemContent = cfg.persona

  // Inject knowledge base articles so the AI can answer factual questions
  const kbArticles = collection('knowledgeBase').filter((a) => a.tenantId === cfg.tenantId)
  if (kbArticles.length > 0) {
    const kbBlock = kbArticles
      .map((a) => `### ${a.title}\n${a.body || a.content || ''}`)
      .join('\n\n')
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
    systemContent += `\n\n--- PRODUCT CATALOG ---\nUse ONLY this data to answer product questions. Never invent products, prices, or stock levels not listed here. If a product is OUT OF STOCK, clearly say so.\n\n${sections.join('\n\n')}\n--- END PRODUCT CATALOG ---`
  }
  if (history.length > 0) {
    const first = new Date(history[0].timestamp)
    const lastHuman = history.filter((m) => !m.fromMe).at(-1)
    const daysSince = Math.round((Date.now() - first.getTime()) / 86_400_000)
    const contextNote = [
      `\n\n--- CONVERSATION MEMORY ---`,
      `This is an ongoing conversation that started ${daysSince === 0 ? 'today' : `${daysSince} day(s) ago`} (${first.toLocaleDateString()}).`,
      `Total messages exchanged: ${history.length}.`,
      lastHuman ? `The customer's last topic: "${lastHuman.body.slice(0, 120)}"` : '',
      `Use the full chat history below to maintain continuity. Never ask for information the customer already gave.`,
      `--- END MEMORY ---`,
    ].filter(Boolean).join('\n')
    systemContent += contextNote
  }

  // Send up to 60 messages — covers multi-day conversations without hitting token limits
  // Slice to -61 so the current inbound message (already in history) is excluded,
  // then append it explicitly as the final user turn (avoids duplicate context)
  const recentHistory = history.slice(-61, -1)
  const messages = [
    { role: 'system', content: systemContent },
    ...recentHistory.map((m) => ({
      role: m.fromMe ? 'assistant' : 'user',
      content: m.body,
    })),
    { role: 'user', content: inboundText },
  ]
  // Try Gemini first, then Nvidia as fallback
  if (GEMINI_KEY) {
    try {
      const reply = await callOneLLM(GEMINI_KEY, GEMINI_BASE, GEMINI_MODEL, messages)
      if (reply) return reply
    } catch (e) {
      console.warn(`[AI] Gemini failed (${e.message}) — trying Nvidia fallback...`)
    }
  }

  if (NVIDIA_KEY) {
    return callOneLLM(NVIDIA_KEY, NVIDIA_BASE, cfg.model || NVIDIA_MODEL, messages)
  }

  return null
}

// returns: string | null | { handoff: true, message: string }
export async function botReply(tenantId, conversation, history, inboundText) {
  const cfg = collection('botConfigs').find((c) => c.tenantId === tenantId)
  if (!cfg) return null

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
    try {
      const reply = await callLLM(cfg, history, inboundText)
      if (reply) return reply
    } catch (e) {
      console.error('[AI] All models failed:', e.message)
    }
  }

  // 3. fallback message
  if (cfg.aiEnabled && !hasAny) {
    return `${cfg.fallbackMessage}\n\n_(AI key not configured — add GEMINI_API_KEY or AI_API_KEY in app/.env)_`
  }
  return cfg.fallback === 'message' ? cfg.fallbackMessage : null
}
