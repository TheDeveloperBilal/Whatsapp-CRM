import { useState, useCallback } from 'react'
import { Zap, Plus, Trash2, X, FlaskConical, Edit2, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePortal } from '@/lib/store'
import type { IntentRule } from '@/types/portal'

const ACTIONS = [
  { value: 'none',         label: 'No action (detect only)' },
  { value: 'add-tag',      label: 'Add tag',            placeholder: 'Tag label, e.g. Sales Inquiry' },
  { value: 'assign-agent', label: 'Assign agent',       placeholder: 'Agent member ID' },
  { value: 'send-message', label: 'Send auto-reply',    placeholder: 'Message to send' },
  { value: 'webhook',      label: 'Webhook',            placeholder: 'https://your-endpoint.com/hook' },
]

const PRESET_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
]

function blank(): Omit<IntentRule, 'id' | 'tenantId' | 'matchCount' | 'createdAt'> {
  return {
    name: '',
    color: PRESET_COLORS[0],
    keywords: [],
    enabled: true,
    action: 'none',
    actionTarget: '',
    priority: 0,
  }
}

function KeywordInput({ keywords, onChange }: { keywords: string[]; onChange: (kws: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (!trimmed || keywords.includes(trimmed)) { setInput(''); return }
    onChange([...keywords, trimmed])
    setInput('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-8 p-2 border rounded-md bg-muted/30">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="flex items-center gap-1 bg-background border text-xs px-2 py-0.5 rounded-full"
          >
            {kw}
            <button
              onClick={() => onChange(keywords.filter((k) => k !== kw))}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-xs text-muted-foreground self-center">No keywords yet</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Type a keyword and press Add"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" onClick={add} className="shrink-0">
          Add
        </Button>
      </div>
    </div>
  )
}

function IntentModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial: ReturnType<typeof blank>
  onSave: (data: ReturnType<typeof blank>) => Promise<void>
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const selectedAction = ACTIONS.find((a) => a.value === form.action)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{initial.name ? 'Edit Intent' : 'New Intent'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Intent name</Label>
            <Input
              placeholder="e.g. Sales Inquiry"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className="size-7 rounded-full border-2 transition-transform"
                  style={{
                    backgroundColor: c,
                    borderColor: form.color === c ? 'white' : 'transparent',
                    boxShadow: form.color === c ? `0 0 0 2px ${c}` : undefined,
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Keywords</Label>
            <p className="text-xs text-muted-foreground">
              If a message contains any of these keywords, this intent fires.
            </p>
            <KeywordInput
              keywords={form.keywords}
              onChange={(kws) => setForm((f) => ({ ...f, keywords: kws }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Priority <span className="text-xs text-muted-foreground">(lower = higher priority)</span></Label>
            <Input
              type="number"
              min={0}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
              className="w-24"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Action</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.action}
              onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as IntentRule['action'], actionTarget: '' }))}
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
                value={form.actionTarget ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, actionTarget: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.name.trim() || form.keywords.length === 0}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function IntentRouting() {
  const { intents, createIntent, updateIntent, deleteIntent, testIntent } = usePortal()
  const [modalMode, setModalMode] = useState<'create' | { edit: IntentRule } | null>(null)
  const [saving, setSaving] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [testResult, setTestResult] = useState<{ matched: IntentRule | null; ran: boolean }>({ matched: null, ran: false })

  const handleSave = useCallback(
    async (data: ReturnType<typeof blank>) => {
      setSaving(true)
      try {
        if (modalMode === 'create') {
          await createIntent(data)
        } else if (modalMode && typeof modalMode === 'object') {
          await updateIntent(modalMode.edit.id, data)
        }
        setModalMode(null)
      } finally {
        setSaving(false)
      }
    },
    [modalMode, createIntent, updateIntent],
  )

  const handleTest = async () => {
    if (!testMsg.trim()) return
    const matched = await testIntent(testMsg)
    setTestResult({ matched, ran: true })
  }

  const sorted = [...intents].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="size-6" /> Intent Routing
          </h2>
          <p className="text-muted-foreground mt-1">
            Define named intents with keywords. When an inbound message matches, the routing action fires automatically.
            The first matching intent by priority wins.
          </p>
        </div>
        <Button onClick={() => setModalMode('create')} className="shrink-0">
          <Plus className="size-4 mr-1" /> New Intent
        </Button>
      </div>

      {/* Test panel */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <FlaskConical className="size-4 text-primary" />
            Test Intent Matching
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Type a sample message to see which intent matches…"
              value={testMsg}
              onChange={(e) => { setTestMsg(e.target.value); setTestResult({ matched: null, ran: false }) }}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            />
            <Button onClick={handleTest} variant="outline" className="shrink-0">
              Test
            </Button>
          </div>
          {testResult.ran && (
            <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${testResult.matched ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-muted text-muted-foreground'}`}>
              {testResult.matched ? (
                <>
                  <Check className="size-4 shrink-0" />
                  <span>
                    Matched <strong>{testResult.matched.name}</strong>
                    {testResult.matched.action !== 'none' && (
                      <> → {ACTIONS.find((a) => a.value === testResult.matched!.action)?.label}
                        {testResult.matched.actionTarget ? `: ${testResult.matched.actionTarget}` : ''}</>
                    )}
                  </span>
                  <span
                    className="ml-auto size-3 rounded-full shrink-0"
                    style={{ backgroundColor: testResult.matched.color }}
                  />
                </>
              ) : (
                <span>No intent matched</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Intent list */}
      <div className="grid gap-3">
        {sorted.map((intent, idx) => {
          const actionMeta = ACTIONS.find((a) => a.value === intent.action)
          return (
            <Card key={intent.id} className={!intent.enabled ? 'opacity-60' : undefined}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  <span className="text-xs text-muted-foreground w-4 text-right">{idx + 1}</span>
                  <div
                    className="size-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: intent.color }}
                  />
                  <Switch
                    checked={intent.enabled}
                    onCheckedChange={(v) => updateIntent(intent.id, { enabled: v })}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{intent.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {intent.matchCount} match{intent.matchCount !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {intent.keywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs font-mono">{kw}</Badge>
                    ))}
                  </div>
                  {intent.action !== 'none' && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>→</span>
                      <Badge variant="outline" className="text-xs">{actionMeta?.label}</Badge>
                      {intent.actionTarget && (
                        <code className="text-xs bg-muted px-1 rounded truncate max-w-48">
                          {intent.actionTarget}
                        </code>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setModalMode({ edit: intent })}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => deleteIntent(intent.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {intents.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Zap className="size-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No intents yet</p>
            <p className="text-sm mt-1">Create an intent to automatically route messages by keyword.</p>
          </div>
        )}
      </div>

      {modalMode && (
        <IntentModal
          initial={
            typeof modalMode === 'object' && 'edit' in modalMode
              ? {
                  name: modalMode.edit.name,
                  color: modalMode.edit.color,
                  keywords: [...modalMode.edit.keywords],
                  enabled: modalMode.edit.enabled,
                  action: modalMode.edit.action,
                  actionTarget: modalMode.edit.actionTarget ?? '',
                  priority: modalMode.edit.priority,
                }
              : blank()
          }
          onSave={handleSave}
          onClose={() => setModalMode(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

