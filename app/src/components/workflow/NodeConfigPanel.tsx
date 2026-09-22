import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const TRIGGER_OPTIONS = [
  { value: 'contact.created', label: 'Contact Created' },
  { value: 'tag.added', label: 'Tag Added' },
  { value: 'tag.removed', label: 'Tag Removed' },
  { value: 'message.received', label: 'Message Received' },
  { value: 'message.first', label: 'First Message' },
  { value: 'conversation.resolved', label: 'Conversation Resolved' },
  { value: 'conversation.opened', label: 'Conversation Opened' },
  { value: 'appointment.booked', label: 'Appointment Booked' },
  { value: 'appointment.cancelled', label: 'Appointment Cancelled' },
  { value: 'payment.received', label: 'Payment Received' },
  { value: 'deal.stage_changed', label: 'Deal Stage Changed' },
  { value: 'form.submitted', label: 'Form Submitted' },
  { value: 'manual', label: 'Manual Trigger' },
]

export function NodeConfigPanel({ node, onUpdate, onDelete, onClose }: {
  node: any
  onUpdate: (data: any) => void
  onDelete: () => void
  onClose: () => void
}) {
  const { data } = node
  const cfg = data.config || {}

  const setConfig = (key: string, value: any) => {
    onUpdate({ config: { ...cfg, [key]: value } })
  }

  return (
    <div className="w-72 border-l bg-background overflow-y-auto flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">{data.label}</h3>
        <div className="flex gap-1">
          {data.nodeType !== 'trigger' && (
            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Node label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Step Name</Label>
          <Input value={data.label} onChange={e => onUpdate({ label: e.target.value })} className="h-8 text-sm" />
        </div>

        {/* Trigger config */}
        {data.nodeType === 'trigger' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Trigger Event</Label>
            <Select value={data.triggerType} onValueChange={v => onUpdate({ triggerType: v })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {(data.triggerType === 'tag.added' || data.triggerType === 'tag.removed') && (
              <div className="space-y-1.5 mt-2">
                <Label className="text-xs">Tag Name (leave blank for any)</Label>
                <Input value={cfg.tag || ''} onChange={e => setConfig('tag', e.target.value)} className="h-8 text-sm" placeholder="e.g. VIP" />
              </div>
            )}
            {data.triggerType === 'message.received' && (
              <div className="space-y-1.5 mt-2">
                <Label className="text-xs">Keyword Filter (optional)</Label>
                <Input value={cfg.keyword || ''} onChange={e => setConfig('keyword', e.target.value)} className="h-8 text-sm" placeholder="e.g. hello" />
              </div>
            )}
          </div>
        )}

        {/* Action configs */}
        {data.actionType === 'send_message' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea value={cfg.message || ''} onChange={e => setConfig('message', e.target.value)} className="text-sm min-h-[100px]" placeholder="Hello {{contact.name}}, welcome!" />
            <p className="text-[10px] text-muted-foreground">Variables: {'{{contact.name}}'}, {'{{contact.phone}}'}</p>
          </div>
        )}

        {(data.actionType === 'add_tag' || data.actionType === 'remove_tag') && (
          <div className="space-y-1.5">
            <Label className="text-xs">Tag Name</Label>
            <Input value={cfg.tag || ''} onChange={e => setConfig('tag', e.target.value)} className="h-8 text-sm" placeholder="e.g. VIP" />
          </div>
        )}

        {data.actionType === 'assign_agent' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Agent ID</Label>
            <Input value={cfg.agentId || ''} onChange={e => setConfig('agentId', e.target.value)} className="h-8 text-sm" placeholder="Agent member ID" />
          </div>
        )}

        {data.actionType === 'set_contact_field' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Field Name</Label>
              <Select value={cfg.field || ''} onValueChange={v => setConfig('field', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select field" /></SelectTrigger>
                <SelectContent>
                  {['name','email','phone','notes','source','company'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Value</Label>
              <Input value={cfg.value || ''} onChange={e => setConfig('value', e.target.value)} className="h-8 text-sm" />
            </div>
          </>
        )}

        {data.actionType === 'create_note' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Note</Label>
            <Textarea value={cfg.note || ''} onChange={e => setConfig('note', e.target.value)} className="text-sm" placeholder="Note content..." />
          </div>
        )}

        {data.actionType === 'send_webhook' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">URL</Label>
              <Input value={cfg.url || ''} onChange={e => setConfig('url', e.target.value)} className="h-8 text-sm" placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Method</Label>
              <Select value={cfg.method || 'POST'} onValueChange={v => setConfig('method', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['POST','GET','PUT','PATCH'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Condition config */}
        {data.nodeType === 'condition' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Field</Label>
              <Select value={cfg.field || 'contact.tags'} onValueChange={v => setConfig('field', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['contact.name','contact.phone','contact.tags','contact.source','message.body'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operator</Label>
              <Select value={cfg.operator || 'contains'} onValueChange={v => setConfig('operator', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[['contains','contains'],['not_contains','does not contain'],['equals','equals'],['starts_with','starts with'],['is_empty','is empty']].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Value</Label>
              <Input value={cfg.value || ''} onChange={e => setConfig('value', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Branch outputs:</p>
              <p>YES handle (left) connects to the true branch</p>
              <p>NO handle (right) connects to the false branch</p>
            </div>
          </>
        )}

        {/* Wait config */}
        {data.nodeType === 'wait' && (
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Amount</Label>
              <Input type="number" min={1} value={cfg.amount || 1} onChange={e => setConfig('amount', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Unit</Label>
              <Select value={cfg.unit || 'minutes'} onValueChange={v => setConfig('unit', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['minutes','hours','days'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
