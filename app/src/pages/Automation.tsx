import { useState } from 'react'
import { Workflow, ArrowRight, Plus, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePortal } from '@/lib/store'
type AutomationRule = { name: string; enabled: boolean; trigger: string; condition?: string; action: string; actionTarget?: string }

const TRIGGERS = [
  { value: 'message.received', label: 'Message received' },
  { value: 'conversation.resolved', label: 'Conversation resolved' },
]

const ACTIONS = [
  { value: 'add-tag', label: 'Add tag', placeholder: 'Tag label, e.g. VIP' },
  { value: 'remove-tag', label: 'Remove tag', placeholder: 'Tag label, e.g. New Lead' },
  { value: 'assign-agent', label: 'Assign agent', placeholder: 'Agent ID' },
  { value: 'set-status', label: 'Set status', placeholder: 'open | resolved | pending' },
  { value: 'send-message', label: 'Send message', placeholder: 'Message text to send' },
  { value: 'webhook', label: 'Webhook', placeholder: 'https://your-endpoint.com/hook' },
]

const CONDITION_HINTS = [
  'contact.tags contains "VIP"',
  'message.body contains "order"',
  'contact.phone starts with "+62"',
]

const blank = (): Omit<AutomationRule, 'id' | 'tenantId'> => ({
  name: '',
  enabled: true,
  trigger: 'message.received',
  condition: '',
  action: 'add-tag',
  actionTarget: '',
})

export default function Automation() {
  const { automations, toggleAutomation, saveAutomation, deleteAutomation } = usePortal()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const selectedAction = ACTIONS.find((a) => a.value === form.action)

  const submit = async () => {
    if (!form.name.trim() || !form.action) return
    setSaving(true)
    try {
      await saveAutomation({ ...form, condition: form.condition?.trim() || undefined })
      setOpen(false)
      setForm(blank())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Workflow className="size-6" /> Automation Rules
          </h2>
          <p className="text-muted-foreground mt-1">
            Rules that fire automatically when gateway events occur — tag contacts, assign agents, send
            messages, or call a webhook.
          </p>
        </div>
        <Button onClick={() => { setForm(blank()); setOpen(true) }} className="shrink-0">
          <Plus className="size-4 mr-1" /> New Rule
        </Button>
      </div>

      <div className="grid gap-3">
        {automations.map((a) => (
          <Card key={a.id} className={!a.enabled ? 'opacity-60' : undefined}>
            <CardContent className="flex items-center gap-4 p-4">
              <Switch checked={a.enabled} onCheckedChange={() => toggleAutomation(a.id)} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{a.name}</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  <Badge variant="secondary">{a.trigger}</Badge>
                  {a.condition && <span className="font-mono text-xs">if {a.condition}</span>}
                  <ArrowRight className="size-3.5 shrink-0" />
                  <Badge variant="outline">{a.action}</Badge>
                  {a.actionTarget && (
                    <span className="font-mono text-xs truncate max-w-64">{a.actionTarget}</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => deleteAutomation(a.id)}
              >
                <Trash2 className="size-4" />
              </Button>
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
          <div className="bg-background border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Automation Rule</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Rule name</Label>
                <Input
                  placeholder="e.g. Tag VIP on first message"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Trigger</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.trigger}
                  onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
                >
                  {TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Condition <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  placeholder={CONDITION_HINTS[0]}
                  value={form.condition}
                  onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Examples: {CONDITION_HINTS.join(' · ')}
                </p>
              </div>

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

              {selectedAction && (
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
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
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
