import { useState } from 'react'
import { Workflow, ArrowRight, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePortal } from '@/lib/store'
import type { AutomationRule, AutomationCondition } from '@/types/portal'

const TRIGGERS = [
  { value: 'message.received', label: 'Message received', desc: 'Every inbound message' },
  { value: 'message.first',    label: 'First message',    desc: 'First ever message from this contact' },
  { value: 'conversation.resolved', label: 'Conversation resolved', desc: 'When status → resolved' },
  { value: 'contact.created',  label: 'New contact',      desc: 'When a new contact is saved' },
  { value: 'tag.added',        label: 'Tag added',        desc: 'When a tag is applied to a contact' },
]

const CONDITION_FIELDS = [
  { value: 'message.body',         label: 'Message text' },
  { value: 'contact.tags',         label: 'Contact tags' },
  { value: 'contact.phone',        label: 'Contact phone' },
  { value: 'contact.source',       label: 'Contact source' },
  { value: 'conversation.assignee',label: 'Assignee ID' },
]

const OPERATORS = [
  { value: 'contains',     label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals',       label: 'equals' },
  { value: 'starts_with',  label: 'starts with' },
  { value: 'is_empty',     label: 'is empty' },
]

const ACTIONS = [
  { value: 'add-tag',           label: 'Add tag',            placeholder: 'Tag label, e.g. VIP' },
  { value: 'remove-tag',        label: 'Remove tag',         placeholder: 'Tag label, e.g. New Lead' },
  { value: 'assign-agent',      label: 'Assign agent',       placeholder: 'Agent member ID' },
  { value: 'set-status',        label: 'Set status',         placeholder: 'open | resolved | pending' },
  { value: 'resolve-conversation', label: 'Resolve conversation', placeholder: '' },
  { value: 'send-message',      label: 'Send message',       placeholder: 'Message to send' },
  { value: 'set-contact-field', label: 'Set contact field',  placeholder: 'field=value, e.g. notes=VIP customer' },
  { value: 'webhook',           label: 'Webhook',            placeholder: 'https://your-endpoint.com/hook' },
]

const blankCondition = (): AutomationCondition => ({
  field: 'message.body',
  operator: 'contains',
  value: '',
})

const blank = () => ({
  name: '',
  enabled: true,
  trigger: 'message.received',
  conditions: [] as AutomationCondition[],
  conditionsMode: 'and' as 'and' | 'or',
  action: 'add-tag',
  actionTarget: '',
})

function TriggerBadge({ trigger }: { trigger: string }) {
  const t = TRIGGERS.find((x) => x.value === trigger)
  return <Badge variant="secondary">{t?.label ?? trigger}</Badge>
}

function ActionBadge({ action }: { action: string }) {
  const a = ACTIONS.find((x) => x.value === action)
  return <Badge variant="outline">{a?.label ?? action}</Badge>
}

function ConditionRow({
  cond,
  onChange,
  onRemove,
}: {
  cond: AutomationCondition
  onChange: (c: AutomationCondition) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        className="rounded-md border bg-background px-2 py-1.5 text-sm"
        value={cond.field}
        onChange={(e) => onChange({ ...cond, field: e.target.value as AutomationCondition['field'] })}
      >
        {CONDITION_FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <select
        className="rounded-md border bg-background px-2 py-1.5 text-sm"
        value={cond.operator}
        onChange={(e) => onChange({ ...cond, operator: e.target.value as AutomationCondition['operator'] })}
      >
        {OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {cond.operator !== 'is_empty' && (
        <Input
          className="w-40 h-8 text-sm"
          placeholder="value"
          value={cond.value}
          onChange={(e) => onChange({ ...cond, value: e.target.value })}
        />
      )}
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive shrink-0"
        title="Remove condition"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export default function Automation() {
  const { automations, toggleAutomation, saveAutomation, deleteAutomation } = usePortal()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const selectedAction = ACTIONS.find((a) => a.value === form.action)

  const addCondition = () =>
    setForm((f) => ({ ...f, conditions: [...f.conditions, blankCondition()] }))

  const updateCondition = (i: number, c: AutomationCondition) =>
    setForm((f) => ({ ...f, conditions: f.conditions.map((x, idx) => (idx === i ? c : x)) }))

  const removeCondition = (i: number) =>
    setForm((f) => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }))

  const submit = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const rule: Omit<AutomationRule, 'id' | 'tenantId'> = {
        name: form.name.trim(),
        enabled: true,
        trigger: form.trigger,
        conditions: form.conditions.length ? form.conditions : undefined,
        conditionsMode: form.conditionsMode,
        action: form.action,
        actionTarget: form.actionTarget.trim() || undefined,
      }
      await saveAutomation(rule)
      setOpen(false)
      setForm(blank())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Workflow className="size-6" /> Automation Rules
          </h2>
          <p className="text-muted-foreground mt-1">
            Rules that fire when gateway events occur — tag contacts, assign agents, send messages, or call a webhook.
          </p>
        </div>
        <Button onClick={() => { setForm(blank()); setOpen(true) }} className="shrink-0">
          <Plus className="size-4 mr-1" /> New Rule
        </Button>
      </div>

      {/* Trigger legend */}
      <div className="flex flex-wrap gap-2">
        {TRIGGERS.map((t) => (
          <div key={t.value} className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-full px-2.5 py-1">
            <span className="font-medium text-foreground">{t.label}</span>
            <span>— {t.desc}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        {automations.map((a) => (
          <Card key={a.id} className={!a.enabled ? 'opacity-60' : undefined}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Switch checked={a.enabled} onCheckedChange={() => toggleAutomation(a.id)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{a.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <TriggerBadge trigger={a.trigger} />
                    {(a.conditions?.length ?? 0) > 0 ? (
                      <span className="text-xs">
                        {a.conditions!.length} condition{a.conditions!.length > 1 ? 's' : ''} ({a.conditionsMode ?? 'and'})
                      </span>
                    ) : a.condition ? (
                      <span className="font-mono text-xs">if {a.condition}</span>
                    ) : null}
                    <ArrowRight className="size-3.5 shrink-0" />
                    <ActionBadge action={a.action} />
                    {a.actionTarget && (
                      <span className="font-mono text-xs truncate max-w-48">{a.actionTarget}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(a.conditions?.length ?? 0) > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                      title="Show conditions"
                    >
                      {expanded === a.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => deleteAutomation(a.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Expanded conditions */}
              {expanded === a.id && a.conditions?.length && (
                <div className="mt-3 pt-3 border-t space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Conditions ({a.conditionsMode ?? 'and'})</p>
                  {a.conditions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="font-mono text-xs shrink-0">
                        {CONDITION_FIELDS.find((f) => f.value === c.field)?.label ?? c.field}
                      </Badge>
                      <span className="text-muted-foreground">{OPERATORS.find((o) => o.value === c.operator)?.label}</span>
                      {c.operator !== 'is_empty' && <code className="text-xs bg-muted px-1 rounded">{c.value}</code>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {automations.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No automation rules yet — click <strong>New Rule</strong> to create one.
          </p>
        )}
      </div>

      {/* Create modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Automation Rule</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label>Rule name</Label>
                <Input
                  placeholder="e.g. Tag VIP on first message"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Trigger */}
              <div className="space-y-1.5">
                <Label>Trigger</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.trigger}
                  onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
                >
                  {TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                  ))}
                </select>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Conditions <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  {form.conditions.length > 1 && (
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        className={`px-2 py-0.5 rounded border ${form.conditionsMode === 'and' ? 'bg-primary text-primary-foreground' : ''}`}
                        onClick={() => setForm((f) => ({ ...f, conditionsMode: 'and' }))}
                      >
                        AND
                      </button>
                      <button
                        className={`px-2 py-0.5 rounded border ${form.conditionsMode === 'or' ? 'bg-primary text-primary-foreground' : ''}`}
                        onClick={() => setForm((f) => ({ ...f, conditionsMode: 'or' }))}
                      >
                        OR
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {form.conditions.map((c, i) => (
                    <ConditionRow
                      key={i}
                      cond={c}
                      onChange={(updated) => updateCondition(i, updated)}
                      onRemove={() => removeCondition(i)}
                    />
                  ))}
                </div>

                <Button variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="size-3.5 mr-1" /> Add condition
                </Button>
              </div>

              {/* Action */}
              <div className="space-y-1.5">
                <Label>Action</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.action}
                  onChange={(e) => setForm((f) => ({ ...f, action: e.target.value, actionTarget: '' }))}
                >
                  {ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>

              {selectedAction?.placeholder && (
                <div className="space-y-1.5">
                  <Label>Target / value</Label>
                  <Input
                    placeholder={selectedAction.placeholder}
                    value={form.actionTarget}
                    onChange={(e) => setForm((f) => ({ ...f, actionTarget: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : 'Save Rule'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

