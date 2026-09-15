// ─── Automation engine ────────────────────────────────────────────────────────
// Triggers: message.received, message.first, conversation.resolved,
//           contact.created, tag.added
// Conditions: structured (conditions[]) or legacy free-text (condition)
// Actions: add-tag, remove-tag, assign-agent, set-status, send-message,
//          webhook, set-contact-field, resolve-conversation

import { collection, upsert, save } from './db.js'
import { sendText } from './wa.js'

// ── Structured condition evaluator ──────────────────────────────────────────

function evalOne(cond, { contact, message, conv }) {
  const { field, operator, value = '' } = cond
  let actual = ''

  if (field === 'message.body') {
    actual = message?.body || ''
  } else if (field === 'contact.tags') {
    const allTags = collection('tags')
    actual = (contact.tags || [])
      .map((tid) => allTags.find((t) => t.id === tid)?.label?.toLowerCase())
      .filter(Boolean)
      .join(',')
  } else if (field === 'contact.phone') {
    actual = contact.phone || ''
  } else if (field === 'contact.source') {
    actual = contact.source || ''
  } else if (field === 'conversation.assignee') {
    actual = conv.assigneeId || ''
  }

  const val = value.toLowerCase()
  const act = actual.toLowerCase()

  switch (operator) {
    case 'contains':     return act.includes(val)
    case 'not_contains': return !act.includes(val)
    case 'equals':       return act === val
    case 'starts_with':  return act.startsWith(val)
    case 'is_empty':     return !act
    default:             return true
  }
}

function evalStructured(conditions, mode, ctx) {
  if (!conditions?.length) return true
  const results = conditions.map((c) => evalOne(c, ctx))
  return mode === 'or' ? results.some(Boolean) : results.every(Boolean)
}

// ── Legacy free-text condition (backward compat) ─────────────────────────────

function evalLegacy(condition, ctx) {
  if (!condition) return true
  const c = condition.trim().toLowerCase()
  const { contact, message } = ctx

  const tagsMatch = c.match(/^contact\.tags\s+contains\s+"(.+)"$/)
  if (tagsMatch) {
    const label = tagsMatch[1].toLowerCase()
    const allTags = collection('tags')
    const labels = (contact.tags || [])
      .map((tid) => allTags.find((t) => t.id === tid)?.label?.toLowerCase())
      .filter(Boolean)
    return labels.includes(label)
  }

  const bodyMatch = c.match(/^message\.body\s+contains\s+"(.+)"$/)
  if (bodyMatch) return (message?.body || '').toLowerCase().includes(bodyMatch[1])

  const phoneMatch = c.match(/^contact\.phone\s+starts with\s+"(.+)"$/)
  if (phoneMatch) return (contact.phone || '').startsWith(phoneMatch[1])

  return true
}

function evalCondition(rule, ctx) {
  if (rule.conditions?.length) {
    return evalStructured(rule.conditions, rule.conditionsMode ?? 'and', ctx)
  }
  return evalLegacy(rule.condition, ctx)
}

// ── Action executor ─────────────────────────────────────────────────────────

async function execAction(rule, ctx, broadcast) {
  const { conv, contact, session } = ctx

  if (rule.action === 'add-tag' && rule.actionTarget) {
    const tag = collection('tags').find(
      (t) =>
        t.label.toLowerCase() === rule.actionTarget.toLowerCase() ||
        t.id === rule.actionTarget,
    )
    if (tag && !(contact.tags || []).includes(tag.id)) {
      contact.tags = [...(contact.tags || []), tag.id]
      upsert('contacts', contact)
      broadcast({ type: 'contact', contact })
    }
  } else if (rule.action === 'remove-tag' && rule.actionTarget) {
    const tag = collection('tags').find(
      (t) =>
        t.label.toLowerCase() === rule.actionTarget.toLowerCase() ||
        t.id === rule.actionTarget,
    )
    if (tag) {
      contact.tags = (contact.tags || []).filter((tid) => tid !== tag.id)
      upsert('contacts', contact)
      broadcast({ type: 'contact', contact })
    }
  } else if (rule.action === 'assign-agent' && rule.actionTarget) {
    conv.assigneeId = rule.actionTarget
    upsert('conversations', conv)
    broadcast({ type: 'conversation', conversation: conv })
  } else if (rule.action === 'set-status' && rule.actionTarget) {
    conv.status = rule.actionTarget
    upsert('conversations', conv)
    broadcast({ type: 'conversation', conversation: conv })
  } else if (rule.action === 'resolve-conversation') {
    conv.status = 'resolved'
    upsert('conversations', conv)
    broadcast({ type: 'conversation', conversation: conv })
  } else if (rule.action === 'send-message' && rule.actionTarget && session) {
    const sent = await sendText(session.id, contact.chatId, rule.actionTarget)
    const botMsg = {
      id: sent.id,
      conversationId: conv.id,
      fromMe: true,
      body: rule.actionTarget,
      type: 'text',
      status: 'sent',
      byBot: true,
      timestamp: sent.timestamp,
    }
    upsert('messages', botMsg)
    conv.lastMessage = botMsg
    conv.updatedAt = botMsg.timestamp
    broadcast({ type: 'message', message: botMsg, conversation: conv, contact })
  } else if (rule.action === 'set-contact-field' && rule.actionTarget) {
    // format: "field=value", e.g. "notes=VIP customer"
    const sep = rule.actionTarget.indexOf('=')
    if (sep > 0) {
      const field = rule.actionTarget.slice(0, sep).trim()
      const value = rule.actionTarget.slice(sep + 1).trim()
      if (['notes', 'source', 'name'].includes(field)) {
        contact[field] = value
        upsert('contacts', contact)
        broadcast({ type: 'contact', contact })
      }
    }
  } else if (rule.action === 'webhook' && rule.actionTarget) {
    fetch(rule.actionTarget, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: rule.trigger, rule: rule.id, contact, conversation: conv }),
    }).catch((e) => console.error('[automation webhook]', e.message))
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function runAutomations(trigger, ctx, broadcast) {
  const { conv, contact } = ctx
  const rules = collection('automations').filter(
    (a) => a.tenantId === conv.tenantId && a.enabled && a.trigger === trigger,
  )
  if (!rules.length) return

  for (const rule of rules) {
    if (!evalCondition(rule, ctx)) continue
    try {
      await execAction(rule, ctx, broadcast)
      console.log(`[automation] "${rule.name}" fired (${rule.action}) on conv ${conv.id}`)
    } catch (e) {
      console.error(`[automation] "${rule.name}" error:`, e.message)
    }
  }
  save()
}
