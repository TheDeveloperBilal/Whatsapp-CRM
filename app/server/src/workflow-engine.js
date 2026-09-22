import { collection, upsert, save, uid } from './db.js'

function evaluate(condition, ctx) {
  const { field, operator, value } = condition
  const actual = String(ctx[field] ?? '')
  switch (operator) {
    case 'contains':     return actual.toLowerCase().includes(value.toLowerCase())
    case 'not_contains': return !actual.toLowerCase().includes(value.toLowerCase())
    case 'equals':       return actual === value
    case 'starts_with':  return actual.startsWith(value)
    case 'is_empty':     return !actual
    default:             return false
  }
}

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

  // Update workflow stats
  const wf = collection('workflows').find(w => w.id === workflow.id)
  if (wf) { wf.runCount = (wf.runCount || 0) + 1; wf.lastRunAt = new Date().toISOString(); save() }

  // Find trigger node → first action node
  const nodes = workflow.nodes
  const edges = workflow.edges
  const triggerNode = nodes.find(n => n.data.nodeType === 'trigger')
  if (!triggerNode) { run.status = 'failed'; run.error = 'No trigger node'; upsert('workflowRuns', run); save(); return }

  await executeFrom(triggerNode.id, nodes, edges, run, workflow)
}

async function executeFrom(nodeId, nodes, edges, run, workflow) {
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return

  run.currentNodeId = nodeId
  run.log.push({ nodeId, action: node.data.label, at: new Date().toISOString() })
  upsert('workflowRuns', run)
  save()

  const { nodeType, actionType, config } = node.data

  if (nodeType === 'trigger') {
    // Just move to next node
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
    default:        return n * 60 * 1000
  }
}

export function fireTrigger(tenantId, triggerType, context = {}) {
  const workflows = collection('workflows').filter(
    w => w.tenantId === tenantId && w.enabled && w.triggerType === triggerType
  )
  for (const wf of workflows) {
    runWorkflow(wf, context).catch(console.error)
  }
}
