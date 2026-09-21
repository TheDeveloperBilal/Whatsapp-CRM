// ─── Intent routing engine ────────────────────────────────────────────────────
// Keyword-based intent detection runs on every inbound message.
// First matching intent (by priority) fires its action and stops.

import { collection, upsert, save } from './db.js'
import { sendText } from './wa.js'

function matches(intent, body) {
  if (!intent.enabled || !intent.keywords?.length) return false
  const lower = body.toLowerCase()
  return intent.keywords.some((kw) => kw && lower.includes(kw.trim().toLowerCase()))
}

export async function runIntentRouting(ctx, broadcast) {
  const { conv, contact, session, message } = ctx
  if (!message?.body) return

  const intents = collection('intents')
    .filter((i) => i.tenantId === conv.tenantId && i.enabled)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

  for (const intent of intents) {
    if (!matches(intent, message.body)) continue

    intent.matchCount = (intent.matchCount || 0) + 1
    upsert('intents', intent)
    broadcast({ type: 'intent', intent })

    try {
      if (intent.action === 'add-tag' && intent.actionTarget) {
        const tag = collection('tags').find(
          (t) =>
            t.label.toLowerCase() === intent.actionTarget.toLowerCase() ||
            t.id === intent.actionTarget,
        )
        if (tag && !(contact.tags || []).includes(tag.id)) {
          contact.tags = [...(contact.tags || []), tag.id]
          upsert('contacts', contact)
          broadcast({ type: 'contact', contact })
        }
      } else if (intent.action === 'assign-agent' && intent.actionTarget) {
        if (conv.assigneeId !== intent.actionTarget) {
          conv.assigneeId = intent.actionTarget
          upsert('conversations', conv)
          broadcast({ type: 'conversation', conversation: conv })
        }
      } else if (intent.action === 'send-message' && intent.actionTarget && session) {
        const sent = await sendText(session.id, contact.chatId, intent.actionTarget)
        const botMsg = {
          id: sent.id,
          conversationId: conv.id,
          fromMe: true,
          body: intent.actionTarget,
          type: 'text',
          status: 'sent',
          byBot: true,
          timestamp: sent.timestamp,
        }
        upsert('messages', botMsg)
        conv.lastMessage = botMsg
        conv.updatedAt = botMsg.timestamp
        broadcast({ type: 'message', message: botMsg, conversation: conv, contact })
      } else if (intent.action === 'webhook' && intent.actionTarget) {
        fetch(intent.actionTarget, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: intent.id, contact, conversation: conv, message }),
        }).catch((e) => console.error('[intent webhook]', e.message))
      }
    } catch (e) {
      console.error(`[intent] "${intent.name}" action error:`, e.message)
    }

    console.log(`[intent] "${intent.name}" matched on conv ${conv.id}`)
    save()
    break // first match wins
  }
}
