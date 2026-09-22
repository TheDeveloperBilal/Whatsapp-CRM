import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Play, Trash2, Pencil, Zap, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { usePortal } from '@/lib/store'
import type { Workflow } from '@/types/portal'
import { formatDistanceToNow } from 'date-fns'

const TRIGGER_LABELS: Record<string, string> = {
  'contact.created': 'Contact Created',
  'tag.added': 'Tag Added',
  'tag.removed': 'Tag Removed',
  'message.received': 'Message Received',
  'message.first': 'First Message',
  'conversation.resolved': 'Conversation Resolved',
  'conversation.opened': 'Conversation Opened',
  'appointment.booked': 'Appointment Booked',
  'appointment.cancelled': 'Appointment Cancelled',
  'payment.received': 'Payment Received',
  'deal.stage_changed': 'Deal Stage Changed',
  'form.submitted': 'Form Submitted',
  'manual': 'Manual Trigger',
}

export default function Workflows() {
  const { tenant, client } = usePortal()
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!tenant) return
    try {
      const data = await client.workflows(tenant.id)
      setWorkflows(data)
    } catch {}
    setLoading(false)
  }, [tenant, client])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!tenant) return
    const wf = await client.createWorkflow(tenant.id, {
      name: 'Untitled Workflow',
      triggerType: 'contact.created',
    })
    navigate(`/workflows/${wf.id}`)
  }

  const handleToggle = async (wf: Workflow) => {
    const updated = await client.toggleWorkflow(tenant!.id, wf.id)
    setWorkflows(prev => prev.map(w => w.id === wf.id ? updated : w))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workflow?')) return
    await client.deleteWorkflow(tenant!.id, id)
    setWorkflows(prev => prev.filter(w => w.id !== id))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-sm text-muted-foreground mt-1">Automate your contact journey with visual workflows</p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="size-4" /> New Workflow
        </Button>
      </div>

      {loading && <div className="text-muted-foreground text-sm">Loading...</div>}

      {!loading && workflows.length === 0 && (
        <div className="border-2 border-dashed rounded-xl p-16 text-center">
          <Zap className="size-12 mx-auto mb-4 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold mb-2">No workflows yet</h2>
          <p className="text-sm text-muted-foreground mb-6">Create your first workflow to automate contact journeys</p>
          <Button onClick={handleCreate} className="gap-2"><Plus className="size-4" /> Create Workflow</Button>
        </div>
      )}

      <div className="grid gap-4">
        {workflows.map(wf => (
          <Card key={wf.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-base truncate">{wf.name}</h3>
                    <Badge variant={wf.enabled ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                      {wf.enabled ? 'Active' : 'Draft'}
                    </Badge>
                  </div>
                  {wf.description && <p className="text-sm text-muted-foreground mb-2 truncate">{wf.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="size-3" />
                      {TRIGGER_LABELS[wf.triggerType] ?? wf.triggerType}
                    </span>
                    <span className="flex items-center gap-1">
                      <Play className="size-3" />
                      {wf.runCount || 0} runs
                    </span>
                    {wf.lastRunAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDistanceToNow(new Date(wf.lastRunAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={wf.enabled} onCheckedChange={() => handleToggle(wf)} />
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/workflows/${wf.id}`)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(wf.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
