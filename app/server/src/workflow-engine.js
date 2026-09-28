import { collection, upsert, save, uid } from './db.js'

// Injected at startup from index.js
let _sendText = null
let _broadcast = null

export function initWorkflowEngine({ sendText, broadcast }) {
  _sendText = sendText
  _broadcast = broadcast
}

function evaluate(condition, ctx) {
  const { field, operator, value } = condition
  const actual = String(ctx[field] ?? '')
  switch (operator) {
    case 'contains':     return actual.toLowerCase().includes(String(value).toLowerCase())
    case 'not_contains': return !actual.toLowerCase().includes(String(value).toLowerCase())
    case 'equals':       return actual === String(value)
    case 'starts_with':  return actual.startsWith(String(value))
    case 'is_empty':     return !actual
    case 'is_not_empty': return !!actual
    default:             return false
  }
}

function resolveField(field, run) {
  const contact = collection('contacts').find(c => c.id === run.context.contactId)
  if (field === 'contact.name') return contact?.name || ''
  if (field === 'contact.phone') return contact?.phone || ''
  if (field === 'contact.tags') {
    const tagIds = contact?.tags || []
    const tags = collection('tags') || []
    return tagIds.map(tid => tags.find(t => t.id === tid)?.label || tid).join(',')
  }
  if (field === 'message.body') return run.context.messageBody || ''
  return String(run.context[field] ?? '')
}

// ── V1 runner (legacy ReactFlow nodes/edges format) ───────────────────────────
export async function runWorkflow(workflow, triggerContext = {}) {
  const runId = uid('wfr')
  const run = {
    id: runId,
    workflowId: workflow.id,
    tenantId: workflow.tenantId,
    status: 'running',
    contactId: triggerContext.contactId,
    conversationId: triggerContext.conversationId,
    currentNodeId: null,
    context: { ...triggerContext },
    log: [],
    startedAt: new Date().toISOString(),
  }
  upsert('workflowRuns', run)

  const wf = collection('workflows').find(w => w.id === workflow.id)
  if (wf) { wf.runCount = (wf.runCount || 0) + 1; wf.lastRunAt = new Date().toISOString(); save() }

  const nodes = workflow.nodes
  const edges = workflow.edges
  const triggerNode = nodes.find(n => n.data.nodeType === 'trigger')
  if (!triggerNode) { run.status = 'failed'; run.error = 'No trigger node'; upsert('workflowRuns', run); save(); return }

  await executeFrom(triggerNode.id, nodes, edges, run, workflow)
}

// ── V2 runner (new step array format from WorkflowBuilder) ───────────────────
export async function runWorkflowV2(workflow, triggerContext = {}) {
  const runId = uid('wfr')
  const run = {
    id: runId,
    workflowId: workflow.id,
    tenantId: workflow.tenantId,
    status: 'running',
    contactId: triggerContext.contactId,
    conversationId: triggerContext.conversationId,
    context: { ...triggerContext },
    log: [],
    startedAt: new Date().toISOString(),
  }
  upsert('workflowRuns', run)
  save()

  const wf = collection('workflows').find(w => w.id === workflow.id)
  if (wf) { wf.runCount = (wf.runCount || 0) + 1; wf.lastRunAt = new Date().toISOString(); save() }

  try {
    await executeSteps(workflow.steps || [], run)
    run.status = 'completed'
    run.completedAt = new Date().toISOString()
  } catch (e) {
    run.status = 'failed'
    run.error = e.message
    run.log.push({ action: `Error: ${e.message}`, at: new Date().toISOString() })
  }
  upsert('workflowRuns', run)
  save()
}

async function executeSteps(steps, run) {
  for (const step of steps) {
    run.log.push({ stepId: step.id, action: step.label || step.type, at: new Date().toISOString() })
    upsert('workflowRuns', run)
    save()

    if (step.type === 'wait') {
      const { amount = 5, unit = 'minutes', waitType = 'duration' } = step.config
      if (waitType === 'duration') {
        const delayMs = parseDelay(amount, unit)
        run.status = 'waiting'
        upsert('workflowRuns', run)
        save()
        await new Promise(r => setTimeout(r, delayMs))
        run.status = 'running'
      }
    } else if (step.type === 'branch') {
      const { field = 'contact.tags', operator = 'contains', value = '' } = step.config
      const fieldVal = resolveField(field, run)
      const met = evaluate({ field, operator, value }, { ...run.context, [field]: fieldVal })
      run.log.push({ action: `Branch: ${met ? 'condition met' : 'otherwise'}`, at: new Date().toISOString() })
      if (met) {
        if (step.branches?.condition?.length) await executeSteps(step.branches.condition, run)
      } else {
        if (step.branches?.otherwise?.length) await executeSteps(step.branches.otherwise, run)
      }
    } else {
      await executeStepAction(step, run)
    }
  }
}

async function executeStepAction(step, run) {
  const contacts = collection('contacts')
  const conversations = collection('conversations')
  const contact = contacts.find(c => c.id === run.context.contactId)
  const conv = conversations.find(c => c.id === run.context.conversationId)
  const allTags = collection('tags') || []
  const users = collection('users') || []

  switch (step.type) {
    case 'tag_add': {
      if (contact && step.config.tagName) {
        const tag = allTags.find(t => t.label === step.config.tagName)
        if (tag) {
          if (!contact.tags) contact.tags = []
          if (!contact.tags.includes(tag.id)) {
            contact.tags.push(tag.id)
            upsert('contacts', contact)
            save()
            if (_broadcast) _broadcast({ type: 'contact', contact })
          }
        }
      }
      break
    }
    case 'tag_remove': {
      if (contact && step.config.tagName) {
        const tag = allTags.find(t => t.label === step.config.tagName)
        if (tag && contact.tags) {
          contact.tags = contact.tags.filter(id => id !== tag.id)
          upsert('contacts', contact)
          save()
          if (_broadcast) _broadcast({ type: 'contact', contact })
        }
      }
      break
    }
    case 'send_message': {
      if (conv && step.config.message && _sendText) {
        const session = collection('sessions').find(s => s.id === conv.sessionId)
        if (session && conv._jid) {
          try {
            const msgText = step.config.message
              .replace(/\{\{contact\.name\}\}/g, contact?.name || '')
              .replace(/\{\{contact\.phone\}\}/g, contact?.phone || '')
            const sent = await _sendText(session.id, conv._jid, msgText)
            if (sent) {
              const msg = {
                id: sent.id,
                conversationId: conv.id,
                fromMe: true,
                body: msgText,
                type: 'text',
                status: 'sent',
                byBot: true,
                byWorkflow: true,
                timestamp: sent.timestamp,
              }
              upsert('messages', msg)
              conv.lastMessage = msg
              conv.updatedAt = msg.timestamp
              upsert('conversations', conv)
              save()
              if (_broadcast) _broadcast({ type: 'message', message: msg, conversation: conv, contact })
            }
          } catch (e) {
            console.error('[workflow send_message]:', e.message)
          }
        }
      }
      break
    }
    case 'assign_to': {
      if (conv) {
        let agent = null
        if (step.config.agentId) agent = users.find(u => u.id === step.config.agentId)
        if (!agent && step.config.agentUsername) agent = users.find(u => u.username === step.config.agentUsername)
        if (agent) {
          conv.assigneeId = agent.id
          upsert('conversations', conv)
          const notif = {
            id: uid('notif'),
            tenantId: conv.tenantId,
            userId: agent.id,
            type: 'assignment',
            message: `Chat from ${contact?.name || 'a contact'} assigned by workflow`,
            conversationId: conv.id,
            read: false,
            createdAt: new Date().toISOString(),
          }
          upsert('notifications', notif)
          save()
          if (_broadcast) {
            _broadcast({ type: 'notification', notification: notif })
            _broadcast({ type: 'conversation', conversation: conv })
          }
        }
      }
      break
    }
    case 'bot_toggle': {
      if (conv) {
        conv.botEnabled = step.config.enable !== false
        upsert('conversations', conv)
        save()
        if (_broadcast) _broadcast({ type: 'conversation', conversation: conv })
      }
      break
    }
    case 'dnd_toggle': {
      if (conv) {
        conv.dnd = !!step.config.enable
        upsert('conversations', conv)
        save()
        if (_broadcast) _broadcast({ type: 'conversation', conversation: conv })
      }
      break
    }
    case 'notify_team': {
      const msg = (step.config?.message || 'Workflow notification')
        .replace(/\{\{contact\.name\}\}/g, contact?.name || '')
        .replace(/\{\{contact\.phone\}\}/g, contact?.phone || '')
      const allUsers = collection('users') || []
      const tenantUsers = allUsers.filter(u => u.tenantId === run.tenantId && ['owner','admin'].includes(u.role))
      for (const u of tenantUsers) {
        const notif = {
          id: uid('notif'),
          tenantId: run.tenantId,
          userId: u.id,
          type: 'workflow',
          message: msg,
          conversationId: run.context.conversationId || null,
          read: false,
          createdAt: new Date().toISOString(),
        }
        upsert('notifications', notif)
        if (_broadcast) _broadcast({ type: 'notification', notification: notif })
      }
      save()
      break
    }
    case 'webhook': {
      if (step.config.url) {
        let body
        try { body = step.config.body ? JSON.parse(step.config.body) : {} } catch { body = {} }
        await fetch(step.config.url, {
          method: step.config.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, context: run.context, workflowId: run.workflowId }),
        }).catch(() => {})
      }
      break
    }
    default:
      break
  }
}

// ── V1 internals ──────────────────────────────────────────────────────────────

async function executeFrom(nodeId, nodes, edges, run, workflow) {
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return

  run.currentNodeId = nodeId
  run.log.push({ nodeId, action: node.data.label, at: new Date().toISOString() })
  upsert('workflowRuns', run)
  save()

  const { nodeType, actionType, config } = node.data

  if (nodeType === 'trigger') {
    await followEdge(nodeId, null, nodes, edges, run, workflow)
    return
  }

  if (nodeType === 'end') {
    run.status = 'completed'
    run.completedAt = new Date().toISOString()
    upsert('workflowRuns', run)
    save()
    return
  }

  if (nodeType === 'wait') {
    const delayMs = parseDelay(config.amount, config.unit)
    run.status = 'waiting'
    upsert('workflowRuns', run)
    save()
    setTimeout(async () => {
      run.status = 'running'
      run.log.push({ nodeId, action: `Wait done`, at: new Date().toISOString() })
      await followEdge(nodeId, null, nodes, edges, run, workflow)
    }, delayMs)
    return
  }

  if (nodeType === 'condition') {
    const field = config.field || ''
    const operator = config.operator || 'contains'
    const value = config.value || ''
    const result = evaluate({ field, operator, value }, run.context)
    run.log.push({ nodeId, action: `Condition: ${result ? 'YES' : 'NO'}`, at: new Date().toISOString() })
    await followEdge(nodeId, result ? 'yes' : 'no', nodes, edges, run, workflow)
    return
  }

  // Execute action
  try {
    await executeAction(actionType, config, run)
    run.log.push({ nodeId, action: `${actionType} done`, at: new Date().toISOString(), result: 'ok' })
  } catch (e) {
    run.log.push({ nodeId, action: `${actionType} error: ${e.message}`, at: new Date().toISOString(), result: 'error' })
  }

  await followEdge(nodeId, null, nodes, edges, run, workflow)
}

async function followEdge(fromId, sourceHandle, nodes, edges, run, workflow) {
  const edge = edges.find(e => e.source === fromId && (sourceHandle === null || e.sourceHandle === sourceHandle || (!e.sourceHandle && sourceHandle === null)))
  if (!edge) {
    run.status = 'completed'
    run.completedAt = new Date().toISOString()
    upsert('workflowRuns', run)
    save()
    return
  }
  await executeFrom(edge.target, nodes, edges, run, workflow)
}

async function executeAction(actionType, config, run) {
  const contacts = collection('contacts')
  const conversations = collection('conversations')
  const contact = contacts.find(c => c.id === run.context.contactId)

  switch (actionType) {
    case 'add_tag': {
      if (contact && config.tag) {
        if (!contact.tags) contact.tags = []
        if (!contact.tags.includes(config.tag)) contact.tags.push(config.tag)
        save()
      }
      break
    }
    case 'remove_tag': {
      if (contact && config.tag) {
        contact.tags = (contact.tags || []).filter(t => t !== config.tag)
        save()
      }
      break
    }
    case 'set_contact_field': {
      if (contact && config.field && config.value !== undefined) {
        contact[config.field] = config.value
        save()
      }
      break
    }
    case 'create_note': {
      if (contact && config.note) {
        if (!contact.notes) contact.notes = []
        contact.notes.push({ text: config.note, at: new Date().toISOString() })
        save()
      }
      break
    }
    case 'assign_agent': {
      const conv = conversations.find(c => c.id === run.context.conversationId)
      if (conv && config.agentId) { conv.assigneeId = config.agentId; save() }
      break
    }
    case 'send_webhook': {
      if (config.url) {
        await fetch(config.url, {
          method: config.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: run.context, workflowId: run.workflowId }),
        }).catch(() => {})
      }
      break
    }
    case 'move_deal_stage': {
      if (config.dealId && config.stageId) {
        const deals = collection('deals')
        const deal = deals.find(d => d.id === config.dealId)
        if (deal) { deal.stageId = config.stageId; save() }
      }
      break
    }
    default:
      break
  }
}

function parseDelay(amount, unit) {
  const n = parseInt(amount) || 1
  switch (unit) {
    case 'minutes': return n * 60 * 1000
    case 'hours':   return n * 3600 * 1000
    case 'days':    return n * 86400 * 1000
    case 'weeks':   return n * 7 * 86400 * 1000
    default:        return n * 60 * 1000
  }
}

// ── Check trigger filters before running ──────────────────────────────────────
function passesTriggerFilters(wf, triggerType, context) {
  const cfg = wf.trigger?.config || {}

  if (triggerType === 'tag.added' || triggerType === 'tag.removed') {
    if (cfg.tag && context.tagLabel && cfg.tag.toLowerCase() !== context.tagLabel.toLowerCase()) return false
  }

  if (triggerType === 'message.received') {
    if (cfg.keyword) {
      const body = (context.messageBody || '').toLowerCase()
      if (!body.includes(cfg.keyword.toLowerCase())) return false
    }
  }

  if (triggerType === 'contact.created') {
    if (cfg.tagFilter) {
      const contact = collection('contacts').find(c => c.id === context.contactId)
      const tagIds = contact?.tags || []
      const allTags = collection('tags') || []
      const tagLabels = tagIds.map(tid => (allTags.find(t => t.id === tid)?.label || '').toLowerCase())
      if (!tagLabels.includes(cfg.tagFilter.toLowerCase())) return false
    }
  }

  return true
}

// ── Fire trigger: dispatches to V1 or V2 based on workflow format ─────────────
export function fireTrigger(tenantId, triggerType, context = {}) {
  const workflows = collection('workflows').filter(
    w => w.tenantId === tenantId
      && (w.enabled || w.status === 'published')
      && (w.triggerType === triggerType || w.trigger?.type === triggerType)
  )
  for (const wf of workflows) {
    if (!passesTriggerFilters(wf, triggerType, context)) continue
    if (Array.isArray(wf.steps)) {
      runWorkflowV2(wf, context).catch(console.error)
    } else if (wf.nodes) {
      runWorkflow(wf, context).catch(console.error)
    }
  }
}
