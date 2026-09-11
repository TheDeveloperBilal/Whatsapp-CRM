// ─── Automation engine ────────────────────────────────────────────────────────
// Evaluates enabled automation rules for a given trigger + context object.
// Supported triggers: message.received, conversation.resolved
// Conditions: contact.tags contains "X", message.body contains "X", contact.phone starts with "X"
// Actions: add-tag, remove-tag, assign-agent, set-status, send-message, webhook

import { collection, upsert, save } from './db.js'
import { sendText } from './wa.js'

function evalCondition(condition, ctx) {
  if (!condition) return true
  const c = condition.trim().toLowerCase()
  const { contact, message } = ctx

  const tagsMatch = c.match(/^contact\.tags\s+contains\s+"(.+)"$/)
  if (tagsMatch) {
    const label = tagsMatch[1].toLowerCase()
    const allTags = collection('tags')
    const contactTagLabels = (contact.tags || [])
      .map((tid) => allTags.find((t) => t.id === tid)?.label?.toLowerCase())
      .filter(Boolean)
    return contactTagLabels.includes(label)
  }

  const bodyMatch = c.match(/^message\.body\s+contains\s+"(.+)"$/)
  if (bodyMatch) {
    return (message?.body || '').toLowerCase().includes(bodyMatch[1])
  }

  const phoneMatch = c.match(/^contact\.phone\s+starts with\s+"(.+)"$/)
  if (phoneMatch) {
    return (contact.phone || '').startsWith(phoneMatch[1])
  }

  return true
}

export async function runAutomations(trigger, ctx, broadcast) {
  const { conv, contact, session } = ctx
  const rules = collection('automations').filter(
    (a) => a.tenantId === conv.tenantId && a.enabled && a.trigger === trigger,
  )
  if (!rules.length) return

  for (const rule of rules) {
    if (!evalCondition(rule.condition, ctx)) continue
    try {
      if (rule.action === 'add-tag' && rule.actionTarget) {
        const tag = collection('tags').find(
          (t) => t.label.toLowerCase() === rule.actionTarget.toLowerCase() || t.id === rule.actionTarget,
        )
        if (tag && !contact.tags.includes(tag.id)) {
          contact.tags = [...contact.tags, tag.id]
          upsert('contacts', contact)
          broadcast({ type: 'contact', contact })
        }
      } else if (rule.action === 'remove-tag' && rule.actionTarget) {
        const tag = collection('tags').find(
          (t) => t.label.toLowerCase() === rule.actionTarget.toLowerCase() || t.id === rule.actionTarget,
        )
        if (tag) {
          contact.tags = contact.tags.filter((tid) => tid !== tag.id)
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
      } else if (rule.action === 'webhook' && rule.actionTarget) {
        fetch(rule.actionTarget, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger, rule: rule.id, contact, conversation: conv }),
        }).catch((e) => console.error('automation webhook error:', e.message))
      }
      console.log(`[automation] "${rule.name}" fired (${rule.action}) on conv ${conv.id}`)
    } catch (e) {
      console.error(`[automation] rule "${rule.name}" error:`, e.message)
    }
  }
  save()
}
