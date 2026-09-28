import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  ArrowLeft, Clock, MessageSquare, Droplets, GitBranch, Tag, Bot,
  Link2, UserCheck, BellOff, Plus, Save, Play, ChevronUp, ChevronDown,
  X, Trash2, Copy, MoreHorizontal, History, Check, Loader2,
  Zap, Settings2, ClipboardList, Terminal, FileText, Bell,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { usePortal } from '@/lib/store'
import { PortalClient, DEFAULT_BACKEND_URL } from '@/lib/backend'
import { loadProfile } from '@/lib/gateway'
import { formatDistanceToNow } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────
type WfStepType = 'wait' | 'send_message' | 'drip_mode' | 'branch' | 'tag_add'
  | 'tag_remove' | 'bot_toggle' | 'webhook' | 'assign_to' | 'dnd_toggle' | 'notify_team'

interface WfStep {
  id: string
  type: WfStepType
  label: string
  config: Record<string, any>
  notes?: string
  branches?: { condition: WfStep[]; otherwise: WfStep[] }
}

interface WfTrigger {
  type: string
  config: Record<string, any>
}

interface WfVersion {
  v: number
  savedAt: string
  status: string
  trigger: WfTrigger
  steps: WfStep[]
}

// ── Step meta ─────────────────────────────────────────────────────────────────
interface StepMeta { label: string; icon: any; color: string; bg: string; desc: string }
const STEP_META: Record<WfStepType, StepMeta> = {
  wait:        { label: 'Wait',              icon: Clock,        color: '#7c3aed', bg: '#ede9fe', desc: 'Hold contact for a time period or condition' },
  send_message:{ label: 'Send Message',      icon: MessageSquare,color: '#059669', bg: '#d1fae5', desc: 'Send a WhatsApp message to the contact' },
  drip_mode:   { label: 'Drip Mode',         icon: Droplets,     color: '#7c3aed', bg: '#ede9fe', desc: 'Send in batches to reduce spam risk' },
  branch:      { label: 'Branch',            icon: GitBranch,    color: '#7c3aed', bg: '#ede9fe', desc: 'Split the flow based on conditions' },
  tag_add:     { label: 'Add Tag',           icon: Tag,          color: '#2563eb', bg: '#dbeafe', desc: 'Add a tag to the contact' },
  tag_remove:  { label: 'Remove Tag',        icon: Tag,          color: '#ea580c', bg: '#fed7aa', desc: 'Remove a tag from the contact' },
  bot_toggle:  { label: 'Enable/Disable AI', icon: Bot,          color: '#2563eb', bg: '#dbeafe', desc: 'Turn AI auto-reply on or off' },
  webhook:     { label: 'Webhook',           icon: Link2,        color: '#6b7280', bg: '#f3f4f6', desc: 'Call an external webhook URL' },
  assign_to:   { label: 'Assign To',         icon: UserCheck,    color: '#0891b2', bg: '#cffafe', desc: 'Assign conversation to a team member' },
  dnd_toggle:  { label: 'Enable/Disable DND',icon: BellOff,      color: '#6b7280', bg: '#f3f4f6', desc: 'Toggle Do Not Disturb mode' },
  notify_team: { label: 'Notify Team',        icon: Bell,         color: '#d97706', bg: '#fef3c7', desc: 'Send in-app notification to all admins/owners' },
}

interface TriggerOption {
  value: string
  label: string
  desc: string
  group: string
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  { value: 'contact.created',       label: 'Contact Created',        desc: 'Fires when a new contact is created or captured', group: 'Contacts' },
  { value: 'tag.added',             label: 'Tag Added',              desc: 'Fires when a specific tag is added to a contact', group: 'Contacts' },
  { value: 'tag.removed',           label: 'Tag Removed',            desc: 'Fires when a specific tag is removed from a contact', group: 'Contacts' },
  { value: 'message.received',      label: 'Inbound Message',        desc: 'Fires on every inbound WhatsApp message received', group: 'Conversations' },
  { value: 'message.first',         label: 'First Message',          desc: 'Fires only on the very first message from a contact', group: 'Conversations' },
  { value: 'conversation.resolved', label: 'Conversation Resolved',  desc: 'Fires when an agent marks a conversation as resolved', group: 'Conversations' },
  { value: 'conversation.opened',   label: 'Conversation Opened',    desc: 'Fires when a resolved conversation is re-opened', group: 'Conversations' },
  { value: 'appointment.booked',    label: 'Appointment Booked',     desc: 'Fires when a contact books an appointment', group: 'Commerce' },
  { value: 'payment.received',      label: 'Payment Received',       desc: 'Fires when a payment is confirmed via a payment link', group: 'Commerce' },
  { value: 'deal.stage_changed',    label: 'Deal Stage Changed',     desc: 'Fires when a deal is moved to a different pipeline stage', group: 'Pipeline' },
  { value: 'form.submitted',        label: 'Form Submitted',         desc: 'Fires when a contact submits a web form', group: 'Other' },
  { value: 'manual',                label: 'Manual / API Trigger',   desc: 'Triggered manually from the workflow page or via API', group: 'Other' },
]

// ── Step tree helpers ─────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10) }

function updateStepById(steps: WfStep[], id: string, patch: Partial<WfStep>): WfStep[] {
  return steps.map(s => {
    if (s.id === id) return { ...s, ...patch }
    if (!s.branches) return s
    return { ...s, branches: {
      condition: updateStepById(s.branches.condition, id, patch),
      otherwise: updateStepById(s.branches.otherwise, id, patch),
    }}
  })
}

function deleteStepById(steps: WfStep[], id: string): WfStep[] {
  return steps.filter(s => s.id !== id).map(s => {
    if (!s.branches) return s
    return { ...s, branches: {
      condition: deleteStepById(s.branches.condition, id),
      otherwise: deleteStepById(s.branches.otherwise, id),
    }}
  })
}

function deleteFromHere(steps: WfStep[], id: string): WfStep[] {
  const idx = steps.findIndex(s => s.id === id)
  if (idx !== -1) return steps.slice(0, idx)
  return steps.map(s => {
    if (!s.branches) return s
    return { ...s, branches: {
      condition: deleteFromHere(s.branches.condition, id),
      otherwise: deleteFromHere(s.branches.otherwise, id),
    }}
  })
}

function insertStep(
  steps: WfStep[],
  parentId: string | null,
  branch: 'condition' | 'otherwise' | null,
  idx: number,
  newStep: WfStep,
): WfStep[] {
  if (!parentId) {
    const r = [...steps]; r.splice(idx, 0, newStep); return r
  }
  return steps.map(s => {
    if (s.id === parentId && s.branches && branch) {
      const list = [...s.branches[branch]]; list.splice(idx, 0, newStep)
      return { ...s, branches: { ...s.branches, [branch]: list } }
    }
    if (!s.branches) return s
    return { ...s, branches: {
      condition: insertStep(s.branches.condition, parentId, branch, idx, newStep),
      otherwise: insertStep(s.branches.otherwise, parentId, branch, idx, newStep),
    }}
  })
}

// ── Add Step Button ───────────────────────────────────────────────────────────
function AddStepButton({ onAdd }: { onAdd: (type: WfStepType) => void }) {
  const groups = [
    {
      label: 'Messaging',
      items: [
        { type: 'send_message' as WfStepType },
        { type: 'drip_mode' as WfStepType },
      ],
    },
    {
      label: 'Flow Control',
      items: [
        { type: 'wait' as WfStepType },
        { type: 'branch' as WfStepType },
      ],
    },
    {
      label: 'Contact Actions',
      items: [
        { type: 'tag_add' as WfStepType },
        { type: 'tag_remove' as WfStepType },
        { type: 'bot_toggle' as WfStepType },
        { type: 'dnd_toggle' as WfStepType },
        { type: 'assign_to' as WfStepType },
      ],
    },
    {
      label: 'Notifications',
      items: [{ type: 'notify_team' as WfStepType }],
    },
    {
      label: 'Integrations',
      items: [{ type: 'webhook' as WfStepType }],
    },
  ]

  return (
    <div className="flex flex-col items-center my-1">
      <div className="w-0.5 h-4 bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="size-6 rounded-full border-2 border-border bg-background hover:border-primary hover:text-primary flex items-center justify-center transition-colors">
            <Plus className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
          {groups.map(g => (
            <Fragment key={g.label}>
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{g.label}</div>
              {g.items.map(item => {
                const m = STEP_META[item.type]
                const Icon = m.icon
                return (
                  <DropdownMenuItem key={item.type} onClick={() => onAdd(item.type)} className="gap-2 cursor-pointer">
                    <span className="size-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: m.bg }}>
                      <Icon className="size-3.5" style={{ color: m.color }} />
                    </span>
                    <div>
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                    </div>
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="w-0.5 h-4 bg-border" />
    </div>
  )
}

// ── Step Card ─────────────────────────────────────────────────────────────────
function StepCard({
  step, selected, onSelect, onDelete, onDeleteFromHere, onCopy, onUpdate,
}: {
  step: WfStep
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  onDeleteFromHere: () => void
  onCopy: () => void
  onUpdate: (patch: Partial<WfStep>) => void
}) {
  const m = STEP_META[step.type]
  const Icon = m.icon

  const desc = (() => {
    if (step.type === 'wait') {
      const { amount = 5, unit = 'minutes' } = step.config
      return `Wait ${amount} ${unit}`
    }
    if (step.type === 'send_message') return step.config.message?.slice(0, 50) || 'No message set'
    if (step.type === 'drip_mode') {
      const { batchSize = 10, intervalMinutes = 3 } = step.config
      return `Batches of ${batchSize} contacts, every ${intervalMinutes} minutes`
    }
    if (step.type === 'tag_add') return `Add tag: ${step.config.tagName || '—'}`
    if (step.type === 'tag_remove') return `Remove tag: ${step.config.tagName || '—'}`
    if (step.type === 'bot_toggle') return step.config.enable ? 'Enable AI auto-reply' : 'Disable AI auto-reply'
    if (step.type === 'webhook') return step.config.url || 'No URL set'
    if (step.type === 'assign_to') return `Assign to agent`
    if (step.type === 'dnd_toggle') return step.config.enable ? 'Enable DND' : 'Disable DND'
    if (step.type === 'branch') {
      const { field = 'contact.tags', operator = 'contains', value = '' } = step.config
      return `If "${field}" ${operator} "${value}"`
    }
    return ''
  })()

  return (
    <div
      onClick={onSelect}
      className={`group w-64 rounded-lg border-2 bg-background cursor-pointer transition-all hover:shadow-md ${
        selected ? 'border-primary shadow-md' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="size-7 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: m.bg }}>
          <Icon className="size-4" style={{ color: m.color }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{step.label}</div>
          {desc && <div className="text-[11px] text-muted-foreground truncate">{desc}</div>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="size-6 rounded hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100"
              onClick={e => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent onClick={e => e.stopPropagation()}>
            <DropdownMenuItem onClick={onCopy}><Copy className="size-3.5 mr-2" /> Copy action</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="size-3.5 mr-2" /> Delete action</DropdownMenuItem>
            <DropdownMenuItem onClick={onDeleteFromHere} className="text-destructive"><Trash2 className="size-3.5 mr-2" /> Delete all actions from here</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              const notes = prompt('Notes:', step.notes || '')
              if (notes !== null) onUpdate({ notes })
            }}>
              <FileText className="size-3.5 mr-2" /> Notes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {step.notes && (
        <div className="px-3 pb-2 text-[10px] text-muted-foreground italic border-t pt-1.5">{step.notes}</div>
      )}
    </div>
  )
}

// ── Step List (recursive) ─────────────────────────────────────────────────────
function StepList({
  steps, parentId, branchKey, selectedId, onSelect, onAddStep, onDelete, onDeleteFromHere, onCopyStep, onUpdateStep,
}: {
  steps: WfStep[]
  parentId: string | null
  branchKey: 'condition' | 'otherwise' | null
  selectedId: string | null
  onSelect: (id: string) => void
  onAddStep: (parentId: string | null, branch: 'condition' | 'otherwise' | null, idx: number, type: WfStepType) => void
  onDelete: (id: string) => void
  onDeleteFromHere: (id: string) => void
  onCopyStep: (step: WfStep, parentId: string | null, branch: 'condition' | 'otherwise' | null, afterIdx: number) => void
  onUpdateStep: (id: string, patch: Partial<WfStep>) => void
}) {
  return (
    <div className="flex flex-col items-center">
      <AddStepButton onAdd={(t) => onAddStep(parentId, branchKey, 0, t)} />
      {steps.map((step, i) => (
        <Fragment key={step.id}>
          {step.type === 'branch' ? (
            <div className="w-full flex flex-col items-center group">
              <StepCard
                step={step}
                selected={selectedId === step.id}
                onSelect={() => onSelect(step.id)}
                onDelete={() => onDelete(step.id)}
                onDeleteFromHere={() => onDeleteFromHere(step.id)}
                onCopy={() => onCopyStep(step, parentId, branchKey, i + 1)}
                onUpdate={(p) => onUpdateStep(step.id, p)}
              />
              {/* Branch columns */}
              <div className="w-full flex gap-0 mt-0 border border-border rounded-lg overflow-hidden">
                {/* Condition branch */}
                <div className="flex-1 border-r border-border">
                  <div className="px-3 py-2 bg-purple-50 dark:bg-purple-950/20 text-xs font-semibold text-purple-700 dark:text-purple-300 border-b border-border">
                    <GitBranch className="size-3 inline mr-1" />
                    If condition is met
                  </div>
                  <div className="p-2">
                    <StepList
                      steps={step.branches?.condition || []}
                      parentId={step.id}
                      branchKey="condition"
                      selectedId={selectedId}
                      onSelect={onSelect}
                      onAddStep={onAddStep}
                      onDelete={onDelete}
                      onDeleteFromHere={onDeleteFromHere}
                      onCopyStep={onCopyStep}
                      onUpdateStep={onUpdateStep}
                    />
                  </div>
                </div>
                {/* Otherwise branch */}
                <div className="flex-1">
                  <div className="px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground border-b border-border">
                    When none of the conditions are met
                  </div>
                  <div className="p-2">
                    <StepList
                      steps={step.branches?.otherwise || []}
                      parentId={step.id}
                      branchKey="otherwise"
                      selectedId={selectedId}
                      onSelect={onSelect}
                      onAddStep={onAddStep}
                      onDelete={onDelete}
                      onDeleteFromHere={onDeleteFromHere}
                      onCopyStep={onCopyStep}
                      onUpdateStep={onUpdateStep}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="group">
              <StepCard
                step={step}
                selected={selectedId === step.id}
                onSelect={() => onSelect(step.id)}
                onDelete={() => onDelete(step.id)}
                onDeleteFromHere={() => onDeleteFromHere(step.id)}
                onCopy={() => onCopyStep(step, parentId, branchKey, i + 1)}
                onUpdate={(p) => onUpdateStep(step.id, p)}
              />
            </div>
          )}
          <AddStepButton onAdd={(t) => onAddStep(parentId, branchKey, i + 1, t)} />
        </Fragment>
      ))}
    </div>
  )
}

// ── Step Config Panel ─────────────────────────────────────────────────────────
function findStepById(steps: WfStep[], id: string): WfStep | null {
  for (const s of steps) {
    if (s.id === id) return s
    if (s.branches) {
      const r = findStepById(s.branches.condition, id) || findStepById(s.branches.otherwise, id)
      if (r) return r
    }
  }
  return null
}

function StepConfigPanel({
  step, allSteps, onClose, onSave, onDelete, onNavigate, agents, tags,
}: {
  step: WfStep
  allSteps: WfStep[]
  onClose: () => void
  onSave: (id: string, patch: Partial<WfStep>) => void
  onDelete: (id: string) => void
  onNavigate: (dir: 'up' | 'down') => void
  agents: { id: string; username: string; name: string; role: string }[]
  tags: { id: string; label: string; color: string }[]
}) {
  const m = STEP_META[step.type]
  const Icon = m.icon
  const [label, setLabel] = useState(step.label)
  const [config, setConfig] = useState({ ...step.config })

  useEffect(() => {
    setLabel(step.label)
    setConfig({ ...step.config })
  }, [step.id])

  const set = (k: string, v: any) => setConfig(p => ({ ...p, [k]: v }))

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded flex items-center justify-center" style={{ backgroundColor: m.bg }}>
            <Icon className="size-4" style={{ color: m.color }} />
          </div>
          <span className="font-semibold text-sm">{m.label}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onNavigate('up')} className="size-7 hover:bg-muted rounded flex items-center justify-center" title="Previous step"><ChevronUp className="size-4" /></button>
          <button onClick={() => onNavigate('down')} className="size-7 hover:bg-muted rounded flex items-center justify-center" title="Next step"><ChevronDown className="size-4" /></button>
          <button onClick={onClose} className="size-7 hover:bg-muted rounded flex items-center justify-center"><X className="size-4" /></button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {/* Action name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Action name</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} />
        </div>

        {/* ── Wait config ── */}
        {step.type === 'wait' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Selected wait type</Label>
              <Select value={config.waitType || 'duration'} onValueChange={v => set('waitType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="duration">For a set period of time</SelectItem>
                  <SelectItem value="condition">Until a condition exists</SelectItem>
                  <SelectItem value="reply">Until the contact replies</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(!config.waitType || config.waitType === 'duration') && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Time period</Label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => set('amount', Math.max(1, (config.amount || 5) - 1))} className="size-8 border rounded flex items-center justify-center hover:bg-muted">−</button>
                    <Input
                      type="number" min={1}
                      value={config.amount || 5}
                      onChange={e => set('amount', parseInt(e.target.value) || 1)}
                      className="w-16 text-center"
                    />
                    <button onClick={() => set('amount', (config.amount || 5) + 1)} className="size-8 border rounded flex items-center justify-center hover:bg-muted">+</button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Unit</Label>
                  <Select value={config.unit || 'minutes'} onValueChange={v => set('unit', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['minutes','hours','days','weeks'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Advance window</Label>
                  <Switch checked={!!config.advanceWindow} onCheckedChange={v => set('advanceWindow', v)} />
                </div>
                {config.advanceWindow && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Resume on</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS.map((day, i) => {
                          const days = config.resumeDays || [1,2,3,4,5]
                          const on = days.includes(i)
                          return (
                            <button
                              key={day}
                              onClick={() => set('resumeDays', on ? days.filter((d: number) => d !== i) : [...days, i])}
                              className={`px-2 py-1 text-xs rounded border font-medium transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                            >{day}</button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Resume between hours</Label>
                      <div className="flex items-center gap-2">
                        <Select value={config.resumeFrom || '09:00'} onValueChange={v => set('resumeFrom', v)}>
                          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({length: 24}, (_, i) => `${String(i).padStart(2,'0')}:00`).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">to</span>
                        <Select value={config.resumeTo || '17:00'} onValueChange={v => set('resumeTo', v)}>
                          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({length: 24}, (_, i) => `${String(i).padStart(2,'0')}:00`).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── Send Message config ── */}
        {step.type === 'send_message' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Message</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {[['{{contact.name}}','Name'],['{{contact.phone}}','Phone']].map(([v,l]) => (
                <button key={v} type="button"
                  onClick={() => set('message', (config.message || '') + v)}
                  className="text-[10px] border rounded px-1.5 py-0.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                >+ {l}</button>
              ))}
            </div>
            <Textarea
              value={config.message || ''}
              onChange={e => set('message', e.target.value)}
              className="min-h-28 text-sm"
              placeholder="Hello {{contact.name}}, welcome to our service!"
            />
            <p className="text-[10px] text-muted-foreground">Click a variable above to insert it into the message.</p>
          </div>
        )}

        {/* ── Drip Mode config ── */}
        {step.type === 'drip_mode' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Batch size (contacts per batch)</Label>
              <Input type="number" min={1} max={50} value={config.batchSize || 10} onChange={e => set('batchSize', parseInt(e.target.value) || 10)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Interval (minutes between batches)</Label>
              <Input type="number" min={1} value={config.intervalMinutes || 3} onChange={e => set('intervalMinutes', parseInt(e.target.value) || 3)} />
            </div>
          </>
        )}

        {/* ── Branch config ── */}
        {step.type === 'branch' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Field</Label>
              <Select value={config.field || 'contact.tags'} onValueChange={v => set('field', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['contact.name','contact.phone','contact.tags','contact.source','message.body'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Operator</Label>
              <Select value={config.operator || 'contains'} onValueChange={v => set('operator', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[['contains','contains'],['not_contains','does not contain'],['equals','equals'],['starts_with','starts with'],['is_empty','is empty'],['is_not_empty','is not empty']].map(([v,l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {config.operator !== 'is_empty' && config.operator !== 'is_not_empty' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Value</Label>
                <Input value={config.value || ''} onChange={e => set('value', e.target.value)} placeholder="e.g. VIP" />
              </div>
            )}
          </>
        )}

        {/* ── Tag config ── */}
        {(step.type === 'tag_add' || step.type === 'tag_remove') && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tag</Label>
            {tags.length > 0 ? (
              <Select value={config.tagName || ''} onValueChange={v => set('tagName', v)}>
                <SelectTrigger><SelectValue placeholder="Select tag…" /></SelectTrigger>
                <SelectContent>
                  {tags.map(t => (
                    <SelectItem key={t.id} value={t.label}>
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full inline-block" style={{ background: t.color }} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={config.tagName || ''} onChange={e => set('tagName', e.target.value)} placeholder="e.g. VIP" />
            )}
          </div>
        )}

        {/* ── Bot toggle ── */}
        {step.type === 'bot_toggle' && (
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Enable AI auto-reply</Label>
            <Switch checked={config.enable !== false} onCheckedChange={v => set('enable', v)} />
          </div>
        )}

        {/* ── DND toggle ── */}
        {step.type === 'dnd_toggle' && (
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Enable DND</Label>
            <Switch checked={config.enable !== false} onCheckedChange={v => set('enable', v)} />
          </div>
        )}

        {/* ── Assign To ── */}
        {step.type === 'assign_to' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Assign to agent</Label>
            {agents.length > 0 ? (
              <Select
                value={config.agentId || ''}
                onValueChange={v => {
                  const a = agents.find(x => x.id === v)
                  set('agentId', v)
                  set('agentUsername', a?.username || '')
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select agent…" /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <div>
                        <span className="font-medium">{a.name || a.username}</span>
                        <span className="ml-1 text-[10px] text-muted-foreground">@{a.username}</span>
                        <span className="ml-1 text-[10px] text-muted-foreground capitalize">· {a.role}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={config.agentUsername || ''} onChange={e => set('agentUsername', e.target.value)} placeholder="e.g. support_agent" />
            )}
            {config.agentId && (
              <p className="text-[10px] text-muted-foreground">@{config.agentUsername}</p>
            )}
          </div>
        )}

        {/* ── Notify Team ── */}
        {step.type === 'notify_team' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notification message</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {[['{{contact.name}}','Name'],['{{contact.phone}}','Phone']].map(([v,l]) => (
                <button key={v} type="button"
                  onClick={() => set('message', (config.message || '') + v)}
                  className="text-[10px] border rounded px-1.5 py-0.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                >+ {l}</button>
              ))}
            </div>
            <Textarea
              value={config.message || ''}
              onChange={e => set('message', e.target.value)}
              className="min-h-20 text-sm"
              placeholder="New qualified lead from {{contact.name}}"
            />
            <p className="text-[10px] text-muted-foreground">Sends an in-app notification to all admin and owner team members.</p>
          </div>
        )}

        {/* ── Webhook ── */}
        {step.type === 'webhook' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">URL</Label>
              <Input value={config.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Method</Label>
              <Select value={config.method || 'POST'} onValueChange={v => set('method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['POST','GET','PUT','PATCH'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">JSON body (optional)</Label>
              <Textarea value={config.body || ''} onChange={e => set('body', e.target.value)} placeholder='{"key":"value"}' className="font-mono text-xs min-h-20" />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/20 flex-shrink-0">
        <Button variant="destructive" size="sm" onClick={() => onDelete(step.id)}>
          <Trash2 className="size-3.5 mr-1" /> Delete
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => { onSave(step.id, { label, config }); onClose() }}>
          <Check className="size-3.5 mr-1" /> Save action
        </Button>
      </div>
    </div>
  )
}

// ── Trigger Config Panel ──────────────────────────────────────────────────────
function TriggerConfigPanel({ trigger, onClose, onSave, tags }: {
  trigger: WfTrigger
  onClose: () => void
  onSave: (t: WfTrigger) => void
  tags: { id: string; label: string; color: string }[]
}) {
  const [type, setType] = useState(trigger.type)
  const [config, setConfig] = useState({ ...trigger.config })
  const set = (k: string, v: any) => setConfig(p => ({ ...p, [k]: v }))

  const selectedOption = TRIGGER_OPTIONS.find(o => o.value === type)
  const groups = [...new Set(TRIGGER_OPTIONS.map(o => o.group))]

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded bg-blue-100 flex items-center justify-center">
            <Zap className="size-4 text-blue-600" />
          </div>
          <span className="font-semibold text-sm">Trigger</span>
        </div>
        <button onClick={onClose} className="size-7 hover:bg-muted rounded flex items-center justify-center"><X className="size-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Trigger event</Label>
          <Select value={type} onValueChange={v => { setType(v); setConfig({}) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {groups.map(group => (
                <Fragment key={group}>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{group}</div>
                  {TRIGGER_OPTIONS.filter(o => o.group === group).map(o => (
                    <SelectItem key={o.value} value={o.value} className="pl-4">
                      <div>
                        <div className="font-medium">{o.label}</div>
                        <div className="text-[10px] text-muted-foreground">{o.desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </Fragment>
              ))}
            </SelectContent>
          </Select>
          {selectedOption && (
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1.5">{selectedOption.desc}</p>
          )}
        </div>

        {(type === 'tag.added' || type === 'tag.removed') && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tag (leave blank for any tag)</Label>
            <Select value={config.tag || '_any'} onValueChange={v => set('tag', v === '_any' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Any tag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">— Any tag —</SelectItem>
                {tags.map(t => (
                  <SelectItem key={t.id} value={t.label}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full inline-block" style={{ background: t.color }} />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {type === 'message.received' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Keyword filter (optional — leave blank for every message)</Label>
            <Input value={config.keyword || ''} onChange={e => set('keyword', e.target.value)} placeholder="e.g. help, support" />
            <p className="text-[10px] text-muted-foreground">Workflow fires only when the inbound message contains this word.</p>
          </div>
        )}

        {type === 'contact.created' && tags.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Filter by tag (optional)</Label>
            <Select value={config.tagFilter || '_any'} onValueChange={v => set('tagFilter', v === '_any' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Any contact" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">— Any contact —</SelectItem>
                {tags.map(t => (
                  <SelectItem key={t.id} value={t.label}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full inline-block" style={{ background: t.color }} />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Only fires when the created contact has this tag.</p>
          </div>
        )}

        {type === 'deal.stage_changed' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Pipeline stage name (optional)</Label>
            <Input value={config.stage || ''} onChange={e => set('stage', e.target.value)} placeholder="e.g. Won" />
          </div>
        )}

        {type === 'payment.received' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Minimum amount (optional)</Label>
            <Input type="number" value={config.minAmount || ''} onChange={e => set('minAmount', e.target.value)} placeholder="e.g. 100" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/20 flex-shrink-0">
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => { onSave({ type, config }); onClose() }}>
          <Check className="size-3.5 mr-1" /> Save trigger
        </Button>
      </div>
    </div>
  )
}

// ── Version History Panel ─────────────────────────────────────────────────────
function VersionHistoryPanel({ versions, onClose, onRestore }: {
  versions: WfVersion[]
  onClose: () => void
  onRestore: (v: WfVersion) => void
}) {
  const sorted = [...versions].sort((a, b) => b.v - a.v)
  return (
    <div className="w-72 border-l bg-background flex flex-col h-full overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <h3 className="font-semibold text-sm flex items-center gap-2"><History className="size-4" /> Version history</h3>
        <button onClick={onClose} className="size-7 hover:bg-muted rounded flex items-center justify-center"><X className="size-4" /></button>
      </div>
      <p className="px-4 py-2 text-xs text-muted-foreground border-b">Version history is kept for the last 10 saves.</p>
      <div className="flex-1 overflow-y-auto divide-y">
        {sorted.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No saved versions yet.</p>
        )}
        {sorted.map((ver, i) => (
          <div key={ver.v} className={`px-4 py-3 ${i === 0 ? 'bg-muted/30' : ''}`}>
            {i === 0 && <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Current version</p>}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium">v{ver.v}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(ver.savedAt), { addSuffix: true })}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {ver.status === 'published'
                  ? <Badge variant="default" className="text-[9px] h-4">Published</Badge>
                  : <Badge variant="secondary" className="text-[9px] h-4">Draft</Badge>
                }
                {i > 0 && (
                  <button
                    onClick={() => onRestore(ver)}
                    className="text-xs text-primary hover:underline"
                  >Restore</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main WorkflowBuilder ──────────────────────────────────────────────────────
const client = new PortalClient(loadProfile().baseUrl || DEFAULT_BACKEND_URL)

export default function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tenant, agents, tags } = usePortal()

  const [name, setName] = useState('Untitled Workflow')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [trigger, setTrigger] = useState<WfTrigger>({ type: 'contact.created', config: {} })
  const [steps, setSteps] = useState<WfStep[]>([])
  const [versions, setVersions] = useState<WfVersion[]>([])
  const [runs, setRuns] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState<'builder' | 'settings' | 'enrollment' | 'logs'>('builder')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTriggerConfig, setShowTriggerConfig] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load workflow
  useEffect(() => {
    if (!tenant || !id) return
    client.workflows(tenant.id).then((list: any[]) => {
      const wf = list.find((w: any) => w.id === id)
      if (!wf) return
      setName(wf.name || 'Untitled Workflow')
      setStatus(wf.status || 'draft')
      setVersions(wf.versions || [])
      // Support both new format (trigger + steps) and old ReactFlow format (nodes/edges)
      if (wf.trigger) {
        setTrigger(wf.trigger)
      } else if (wf.triggerType) {
        setTrigger({ type: wf.triggerType, config: wf.triggerConfig || {} })
      }
      setSteps(wf.steps || [])
    }).catch(() => {})
  }, [tenant, id])

  // Load runs for Enrollment history / Execution logs
  useEffect(() => {
    if (!tenant || !id || activeTab === 'builder' || activeTab === 'settings') return
    client.workflowRuns(tenant.id, id).then(setRuns).catch(() => {})
  }, [tenant, id, activeTab])

  const handleSave = async (publish = false) => {
    if (!tenant || !id) return
    setSaving(true)
    const newStatus = publish ? 'published' : status
    const nextV = (versions.length > 0 ? Math.max(...versions.map(v => v.v)) : 0) + 1
    const newVersion: WfVersion = { v: nextV, savedAt: new Date().toISOString(), status: newStatus, trigger, steps }
    const newVersions = [newVersion, ...versions].slice(0, 10)
    try {
      await client.updateWorkflow(tenant.id, id, {
        name,
        status: newStatus,
        trigger,
        steps,
        versions: newVersions,
        triggerType: trigger.type,
        triggerConfig: trigger.config,
      } as any)
      setStatus(newStatus)
      setVersions(newVersions)
      toast.success(publish ? 'Workflow published' : 'Workflow saved')
    } catch {
      toast.error('Failed to save workflow')
    }
    setSaving(false)
  }

  const handleTest = async () => {
    if (!tenant || !id) return
    try {
      await client.triggerWorkflow(tenant.id, id, {})
      toast.success('Workflow test triggered')
    } catch { toast.error('Failed to trigger') }
  }

  const handleRestore = (ver: WfVersion) => {
    setTrigger(ver.trigger)
    setSteps(ver.steps)
    setStatus(ver.status as any)
    setShowVersions(false)
    toast.info(`Restored to v${ver.v}`)
  }

  // Step manipulation
  const handleAddStep = useCallback((parentId: string | null, branch: 'condition' | 'otherwise' | null, idx: number, type: WfStepType) => {
    const m = STEP_META[type]
    const newStep: WfStep = {
      id: uid(),
      type,
      label: m.label,
      config: {},
      ...(type === 'branch' ? { branches: { condition: [], otherwise: [] } } : {}),
    }
    if (!parentId) {
      setSteps(prev => { const r = [...prev]; r.splice(idx, 0, newStep); return r })
    } else {
      setSteps(prev => insertStep(prev, parentId, branch, idx, newStep))
    }
    setSelectedId(newStep.id)
  }, [])

  const handleDeleteStep = useCallback((id: string) => {
    setSteps(prev => deleteStepById(prev, id))
    setSelectedId(s => s === id ? null : s)
  }, [])

  const handleDeleteFromHere = useCallback((id: string) => {
    setSteps(prev => deleteFromHere(prev, id))
    setSelectedId(null)
  }, [])

  const handleCopyStep = useCallback((step: WfStep, parentId: string | null, branch: 'condition' | 'otherwise' | null, afterIdx: number) => {
    const copied: WfStep = { ...JSON.parse(JSON.stringify(step)), id: uid(), label: `${step.label} (copy)` }
    if (!parentId) {
      setSteps(prev => { const r = [...prev]; r.splice(afterIdx, 0, copied); return r })
    } else {
      setSteps(prev => insertStep(prev, parentId, branch, afterIdx, copied))
    }
  }, [])

  const handleUpdateStep = useCallback((id: string, patch: Partial<WfStep>) => {
    setSteps(prev => updateStepById(prev, id, patch))
  }, [])

  const handleNavigate = (dir: 'up' | 'down') => {
    const flat: WfStep[] = []
    const flatten = (list: WfStep[]) => { for (const s of list) { flat.push(s); if (s.branches) { flatten(s.branches.condition); flatten(s.branches.otherwise) } } }
    flatten(steps)
    const idx = flat.findIndex(s => s.id === selectedId)
    if (dir === 'up' && idx > 0) setSelectedId(flat[idx - 1].id)
    if (dir === 'down' && idx < flat.length - 1) setSelectedId(flat[idx + 1].id)
  }

  const selectedStep = selectedId ? findStepById(steps, selectedId) : null
  const triggerLabel = TRIGGER_OPTIONS.find(o => o.value === trigger.type)?.label || trigger.type

  const TABS = [
    { id: 'builder',    label: 'Builder',            icon: Zap },
    { id: 'settings',   label: 'Settings',            icon: Settings2 },
    { id: 'enrollment', label: 'Enrollment history',  icon: ClipboardList },
    { id: 'logs',       label: 'Execution logs',      icon: Terminal },
  ] as const

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Top Header ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background z-20 flex-shrink-0">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate('/workflows')}>
          <ArrowLeft className="size-4" />
        </Button>

        {/* Tabs */}
        <div className="flex items-center gap-0 border rounded-md overflow-hidden ml-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Version history */}
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => { setShowVersions(v => !v); setSelectedId(null) }}>
          <History className="size-3.5" /> History
        </Button>

        {/* Test workflow */}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleTest}>
          <Play className="size-3.5" /> Test workflow
        </Button>

        {/* Draft / Publish toggle */}
        <div className="flex items-center gap-2 border rounded-md px-3 py-1.5">
          <span className={`text-xs font-medium ${status === 'draft' ? 'text-foreground' : 'text-muted-foreground'}`}>Draft</span>
          <Switch
            checked={status === 'published'}
            onCheckedChange={async v => {
              setStatus(v ? 'published' : 'draft')
              await handleSave(v)
            }}
          />
          <span className={`text-xs font-medium ${status === 'published' ? 'text-foreground' : 'text-muted-foreground'}`}>Publish</span>
        </div>

        {/* Save */}
        <Button size="sm" onClick={() => handleSave(false)} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save
        </Button>
      </div>

      {/* ── Workflow name (below header) ── */}
      <div className="px-4 py-1.5 border-b bg-muted/20 flex-shrink-0">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-7 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0 w-80"
          placeholder="Workflow name"
        />
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* BUILDER TAB */}
          {activeTab === 'builder' && (
            <div className="flex-1 overflow-y-auto bg-[#f7f8fa] dark:bg-muted/20" style={{ backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
              <div className="flex flex-col items-center py-10 px-4 min-h-full">
                {/* Trigger card */}
                <div className="flex gap-4 items-start">
                  <div
                    onClick={() => { setShowTriggerConfig(true); setSelectedId(null); setShowVersions(false) }}
                    className={`w-64 rounded-lg border-2 bg-background cursor-pointer transition-all hover:shadow-md ${showTriggerConfig ? 'border-primary shadow-md' : 'border-border'}`}
                  >
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      <span className="size-7 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Zap className="size-4 text-blue-600" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">Trigger</div>
                        <div className="text-[11px] text-muted-foreground truncate">{triggerLabel}{trigger.config.tag ? ` · Tag "${trigger.config.tag}"` : ''}</div>
                      </div>
                    </div>
                  </div>
                  {/* Add new trigger placeholder */}
                  <div className="w-40 h-[54px] rounded-lg border-2 border-dashed border-border flex items-center justify-center text-xs text-muted-foreground gap-1 hover:border-primary hover:text-primary cursor-pointer transition-colors"
                    onClick={() => toast.info('Multiple triggers coming soon')}>
                    <Plus className="size-3.5" /> Add new trigger
                  </div>
                </div>

                {/* Steps */}
                <StepList
                  steps={steps}
                  parentId={null}
                  branchKey={null}
                  selectedId={selectedId}
                  onSelect={id => { setSelectedId(id); setShowTriggerConfig(false); setShowVersions(false) }}
                  onAddStep={handleAddStep}
                  onDelete={handleDeleteStep}
                  onDeleteFromHere={handleDeleteFromHere}
                  onCopyStep={handleCopyStep}
                  onUpdateStep={handleUpdateStep}
                />

                {/* END node */}
                <div className="w-0.5 h-4 bg-border" />
                <div className="w-20 h-8 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-xs text-muted-foreground font-medium">
                  END
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-6 max-w-lg">
              <h2 className="text-lg font-semibold mb-4">Workflow Settings</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Workflow name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Trigger event</Label>
                  <Select value={trigger.type} onValueChange={v => setTrigger(t => ({ ...t, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={v => setStatus(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Save className="size-3.5 mr-1" />}
                  Save settings
                </Button>
              </div>
            </div>
          )}

          {/* ENROLLMENT HISTORY TAB */}
          {activeTab === 'enrollment' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-lg font-semibold mb-4">Enrollment History</h2>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workflow runs yet.</p>
              ) : (
                <div className="rounded-md border divide-y">
                  {runs.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-sm font-medium">{r.contactName || r.contactId}</div>
                        <div className="text-xs text-muted-foreground">{new Date(r.startedAt).toLocaleString()}</div>
                      </div>
                      <Badge variant={r.status === 'completed' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>
                        {r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EXECUTION LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-lg font-semibold mb-4">Execution Logs</h2>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No execution logs yet.</p>
              ) : (
                <div className="rounded-md border divide-y font-mono text-xs">
                  {runs.map((r: any) => (
                    <div key={r.id} className="px-4 py-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={r.status === 'completed' ? 'text-emerald-600' : r.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>
                          [{r.status?.toUpperCase()}]
                        </span>
                        <span>{r.contactName || r.contactId}</span>
                        <span className="text-muted-foreground ml-auto">{new Date(r.startedAt).toLocaleString()}</span>
                      </div>
                      {r.log && <div className="text-muted-foreground whitespace-pre-wrap">{r.log}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right panels ── */}
        {activeTab === 'builder' && showTriggerConfig && (
          <TriggerConfigPanel
            trigger={trigger}
            onClose={() => setShowTriggerConfig(false)}
            onSave={setTrigger}
            tags={tags}
          />
        )}
        {activeTab === 'builder' && selectedStep && !showVersions && (
          <StepConfigPanel
            step={selectedStep}
            allSteps={steps}
            onClose={() => setSelectedId(null)}
            onSave={handleUpdateStep}
            onDelete={id => { handleDeleteStep(id); setSelectedId(null) }}
            onNavigate={handleNavigate}
            agents={agents}
            tags={tags}
          />
        )}
        {showVersions && (
          <VersionHistoryPanel
            versions={versions}
            onClose={() => setShowVersions(false)}
            onRestore={handleRestore}
          />
        )}
      </div>
    </div>
  )
}
