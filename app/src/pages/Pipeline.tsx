import { useState, useCallback, useRef, useEffect } from 'react'
import { usePortal } from '@/lib/portal-context'
import type { Deal, PipelineStage } from '@/types/portal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2, Settings2, GripVertical, DollarSign, TrendingUp, Trophy, Layers } from 'lucide-react'
import { PortalClient, DEFAULT_BACKEND_URL } from '@/lib/backend'
import { loadProfile } from '@/lib/gateway'

const client = new PortalClient(loadProfile().baseUrl || DEFAULT_BACKEND_URL)

// GHL-style default stages for a new pipeline
const GHL_DEFAULT_STAGES = [
  { name: 'Lead', color: '#3b82f6' },
  { name: 'Contact Made', color: '#f59e0b' },
  { name: 'Demo Scheduled', color: '#8b5cf6' },
  { name: 'Proposal Sent', color: '#ec4899' },
  { name: 'Negotiation', color: '#f97316' },
  { name: 'Won', color: '#10b981' },
  { name: 'Lost', color: '#ef4444' },
]

interface Pipeline {
  id: string
  name: string
  department: string
  tenantId: string
  createdAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

const COLORS = [
  '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#10b981', '#ef4444', '#f97316', '#06b6d4',
  '#84cc16', '#6366f1',
]

// ── Deal Card ─────────────────────────────────────────────────────────────────

interface DealCardProps {
  deal: Deal
  contacts: ReturnType<typeof usePortal>['contacts']
  onEdit: (deal: Deal) => void
  onDelete: (id: string) => void
  onDragStart: (e: React.DragEvent, dealId: string) => void
}

function DealCard({ deal, contacts, onEdit, onDelete, onDragStart }: DealCardProps) {
  const contact = contacts.find((c) => c.id === deal.contactId)
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{deal.title}</p>
          {contact && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{contact.name}</p>
          )}
        </div>
        <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-green-600 dark:text-green-400">
          {fmt(deal.value, deal.currency)}
        </span>
        {deal.outcome && (
          <Badge variant={deal.outcome === 'won' ? 'default' : 'destructive'} className="text-xs py-0">
            {deal.outcome === 'won' ? '🏆 Won' : '❌ Lost'}
          </Badge>
        )}
      </div>
      {deal.notes && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 line-clamp-2">{deal.notes}</p>
      )}
      <div className="mt-2 flex gap-1 justify-end">
        <button
          onClick={() => onEdit(deal)}
          className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(deal.id)}
          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Stage Column ──────────────────────────────────────────────────────────────

interface StageColumnProps {
  stage: PipelineStage
  deals: Deal[]
  contacts: ReturnType<typeof usePortal>['contacts']
  onAddDeal: (stageId: string) => void
  onEditDeal: (deal: Deal) => void
  onDeleteDeal: (id: string) => void
  onDragStart: (e: React.DragEvent, dealId: string) => void
  onDrop: (e: React.DragEvent, stageId: string) => void
  onEditStage: (stage: PipelineStage) => void
  onDeleteStage: (id: string) => void
}

function StageColumn({
  stage, deals, contacts,
  onAddDeal, onEditDeal, onDeleteDeal,
  onDragStart, onDrop, onEditStage, onDeleteStage,
}: StageColumnProps) {
  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)
  const currency = deals[0]?.currency ?? 'USD'

  return (
    <div
      className="flex-shrink-0 w-64 flex flex-col bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: stage.color }} />
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{stage.name}</span>
        <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5 font-medium">
          {deals.length}
        </span>
        <button
          onClick={() => onEditStage(stage)}
          className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDeleteStage(stage.id)}
          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {deals.length > 0 && (
        <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
          {fmt(totalValue, currency)}
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            contacts={contacts}
            onEdit={onEditDeal}
            onDelete={onDeleteDeal}
            onDragStart={onDragStart}
          />
        ))}
      </div>

      {/* Add deal button */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onAddDeal(stage.id)}
          className="w-full flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-1.5 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add deal
        </button>
      </div>
    </div>
  )
}

// ── Empty deal form ────────────────────────────────────────────────────────────

const EMPTY_DEAL_FORM = {
  title: '',
  contactId: '',
  stageId: '',
  value: '',
  currency: 'USD',
  notes: '',
  assigneeId: '',
  outcome: '' as '' | 'won' | 'lost',
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const {
    pipelineStages,
    deals,
    contacts,
    tenant,
    updateStage,
    deleteStage,
    createDeal,
    updateDeal,
    deleteDeal,
  } = usePortal()

  // ── Named pipelines ──
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [pipelineDialog, setPipelineDialog] = useState(false)
  const [newPipelineName, setNewPipelineName] = useState('')
  const [newPipelineDept, setNewPipelineDept] = useState('')
  const [pipelineLoading, setPipelineLoading] = useState(false)

  useEffect(() => {
    if (!tenant?.id) return
    client.getPipelines(tenant.id).then((list) => {
      setPipelines(list)
      if (list.length > 0 && !selectedPipelineId) setSelectedPipelineId(list[0].id)
    }).catch(() => {})
  }, [tenant?.id])

  const handleCreatePipeline = async () => {
    if (!newPipelineName.trim() || !tenant?.id) return
    setPipelineLoading(true)
    try {
      const pl = await client.createPipeline(tenant.id, { name: newPipelineName.trim(), department: newPipelineDept.trim() })
      setPipelines((prev) => [...prev, pl])
      setSelectedPipelineId(pl.id)
      // seed with GHL default stages
      for (let i = 0; i < GHL_DEFAULT_STAGES.length; i++) {
        const s = GHL_DEFAULT_STAGES[i]
        await client.createStage(tenant.id, { name: s.name, color: s.color, pipelineId: pl.id })
      }
      // refresh stages via page reload (simplest approach; store will re-bootstrap)
      window.location.reload()
    } catch (e) {
      console.error(e)
    } finally {
      setPipelineLoading(false)
      setPipelineDialog(false)
      setNewPipelineName('')
      setNewPipelineDept('')
    }
  }

  const handleDeletePipeline = async (id: string) => {
    if (!confirm('Delete this pipeline and all its stages?')) return
    await client.deletePipeline(id)
    setPipelines((prev) => prev.filter((p) => p.id !== id))
    if (selectedPipelineId === id) setSelectedPipelineId(pipelines.find((p) => p.id !== id)?.id ?? null)
  }

  // Stage dialog
  const [stageDialog, setStageDialog] = useState<{ open: boolean; stage?: PipelineStage }>({ open: false })
  const [stageName, setStageName] = useState('')
  const [stageColor, setStageColor] = useState(COLORS[0])

  // Deal dialog
  const [dealDialog, setDealDialog] = useState<{ open: boolean; deal?: Deal; preStageId?: string }>({ open: false })
  const [dealForm, setDealForm] = useState({ ...EMPTY_DEAL_FORM })

  // Drag state
  const dragRef = useRef<string | null>(null)

  // ── Stage actions ──
  const openNewStage = () => {
    setStageName('')
    setStageColor(COLORS[0])
    setStageDialog({ open: true })
  }

  const openEditStage = (stage: PipelineStage) => {
    setStageName(stage.name)
    setStageColor(stage.color)
    setStageDialog({ open: true, stage })
  }

  const handleSaveStage = async () => {
    if (!stageName.trim() || !tenant?.id) return
    if (stageDialog.stage) {
      await updateStage(stageDialog.stage.id, { name: stageName.trim(), color: stageColor })
    } else {
      await client.createStage(tenant.id, { name: stageName.trim(), color: stageColor, pipelineId: selectedPipelineId })
      window.location.reload()
    }
    setStageDialog({ open: false })
  }

  const handleDeleteStage = async (id: string) => {
    const stageDeals = deals.filter((d) => d.stageId === id)
    if (stageDeals.length > 0 && !confirm(`Delete stage and its ${stageDeals.length} deal(s)?`)) return
    await deleteStage(id)
  }

  // ── Deal actions ──
  const openNewDeal = (preStageId: string) => {
    setDealForm({ ...EMPTY_DEAL_FORM, stageId: preStageId })
    setDealDialog({ open: true, preStageId })
  }

  const openEditDeal = (deal: Deal) => {
    setDealForm({
      title: deal.title,
      contactId: deal.contactId,
      stageId: deal.stageId,
      value: String(deal.value),
      currency: deal.currency,
      notes: deal.notes,
      assigneeId: deal.assigneeId ?? '',
      outcome: deal.outcome ?? '',
    })
    setDealDialog({ open: true, deal })
  }

  const handleSaveDeal = async () => {
    if (!dealForm.title.trim() || !dealForm.stageId) return
    const payload = {
      title: dealForm.title.trim(),
      contactId: dealForm.contactId,
      stageId: dealForm.stageId,
      value: parseFloat(dealForm.value) || 0,
      currency: dealForm.currency || 'USD',
      notes: dealForm.notes,
      assigneeId: dealForm.assigneeId || null,
      outcome: (dealForm.outcome || null) as 'won' | 'lost' | null,
      closedAt: dealForm.outcome ? new Date().toISOString() : null,
    }
    if (dealDialog.deal) {
      await updateDeal(dealDialog.deal.id, payload)
    } else {
      await createDeal(payload)
    }
    setDealDialog({ open: false })
  }

  const handleDeleteDeal = async (id: string) => {
    if (!confirm('Delete this deal?')) return
    await deleteDeal(id)
  }

  // ── Drag & drop ──
  const handleDragStart = useCallback((e: React.DragEvent, dealId: string) => {
    dragRef.current = dealId
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    const id = dragRef.current
    if (!id) return
    const deal = deals.find((d) => d.id === id)
    if (deal && deal.stageId !== stageId) {
      await updateDeal(id, { stageId })
    }
    dragRef.current = null
  }, [deals, updateDeal])

  // ── Stats (scoped to selected pipeline's stages) ──
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId)
  const visibleStages = [...pipelineStages]
    .filter((s) => selectedPipelineId ? s.pipelineId === selectedPipelineId : !s.pipelineId)
    .sort((a, b) => a.order - b.order)
  const visibleStageIds = new Set(visibleStages.map((s) => s.id))
  const visibleDeals = deals.filter((d) => visibleStageIds.has(d.stageId))

  const totalValue = visibleDeals.reduce((s, d) => s + d.value, 0)
  const wonDeals = visibleDeals.filter((d) => d.outcome === 'won')
  const closedDeals = visibleDeals.filter((d) => d.outcome)
  const winRate = closedDeals.length ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0
  const currency = visibleDeals[0]?.currency ?? 'USD'

  const sortedStages = visibleStages

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Pipeline</h1>
          {/* Pipeline selector */}
          {pipelines.length > 0 && (
            <div className="flex items-center gap-1">
              <Select value={selectedPipelineId ?? ''} onValueChange={setSelectedPipelineId}>
                <SelectTrigger className="h-8 text-sm w-48">
                  <Layers className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.department ? ` · ${p.department}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPipelineId && (
                <button
                  onClick={() => handleDeletePipeline(selectedPipelineId)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Delete pipeline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setNewPipelineName(''); setNewPipelineDept(''); setPipelineDialog(true) }} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            New Pipeline
          </Button>
          <Button onClick={openNewStage} size="sm" disabled={!selectedPipelineId && pipelines.length > 0}>
            <Plus className="h-4 w-4 mr-1" />
            Add Stage
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4 text-green-500" />
          <span className="text-gray-500 dark:text-gray-400">Total Value</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(totalValue, currency)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <span className="text-gray-500 dark:text-gray-400">Deals</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{deals.length}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="text-gray-500 dark:text-gray-400">Win Rate</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{winRate}%</span>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full" style={{ minHeight: '400px' }}>
          {sortedStages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={visibleDeals.filter((d) => d.stageId === stage.id)}
              contacts={contacts}
              onAddDeal={openNewDeal}
              onEditDeal={openEditDeal}
              onDeleteDeal={handleDeleteDeal}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onEditStage={openEditStage}
              onDeleteStage={handleDeleteStage}
            />
          ))}

          {sortedStages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              {pipelines.length === 0 ? (
                <>
                  <p className="text-lg font-medium mb-2">No pipelines yet</p>
                  <p className="text-sm mb-4">Create your first pipeline to get started</p>
                  <Button onClick={() => setPipelineDialog(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    New Pipeline
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium mb-2">No stages in this pipeline</p>
                  <p className="text-sm mb-4">Add stages to start tracking deals</p>
                  <Button onClick={openNewStage} variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Stage
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Pipeline Dialog */}
      <Dialog open={pipelineDialog} onOpenChange={(o) => !o && setPipelineDialog(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Pipeline Name *</Label>
              <Input
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="e.g. Sales, HR, Support"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Department <span className="text-xs text-gray-400">(optional)</span></Label>
              <Input
                value={newPipelineDept}
                onChange={(e) => setNewPipelineDept(e.target.value)}
                placeholder="e.g. Sales Team"
              />
            </div>
            <p className="text-xs text-gray-500">Default stages (Lead → Contact Made → Demo → Proposal → Negotiation → Won → Lost) will be added automatically.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPipelineDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePipeline} disabled={!newPipelineName.trim() || pipelineLoading}>
              {pipelineLoading ? 'Creating…' : 'Create Pipeline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Dialog */}
      <Dialog open={stageDialog.open} onOpenChange={(o) => !o && setStageDialog({ open: false })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{stageDialog.stage ? 'Edit Stage' : 'New Stage'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Stage Name</Label>
              <Input
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="e.g. Negotiation"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveStage()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStageColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: c,
                      borderColor: stageColor === c ? 'white' : 'transparent',
                      boxShadow: stageColor === c ? `0 0 0 2px ${c}` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog({ open: false })}>Cancel</Button>
            <Button onClick={handleSaveStage} disabled={!stageName.trim()}>
              {stageDialog.stage ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deal Dialog */}
      <Dialog open={dealDialog.open} onOpenChange={(o) => !o && setDealDialog({ open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dealDialog.deal ? 'Edit Deal' : 'New Deal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={dealForm.title}
                onChange={(e) => setDealForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Deal title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Value</Label>
                <Input
                  type="number"
                  value={dealForm.value}
                  onChange={(e) => setDealForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select
                  value={dealForm.currency}
                  onValueChange={(v) => setDealForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD', 'EUR', 'GBP', 'PKR', 'AED', 'SAR', 'INR'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Stage *</Label>
              <Select
                value={dealForm.stageId}
                onValueChange={(v) => setDealForm((f) => ({ ...f, stageId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>
                  {sortedStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Select
                value={dealForm.contactId || 'none'}
                onValueChange={(v) => setDealForm((f) => ({ ...f, contactId: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No contact —</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Select
                value={dealForm.outcome || 'open'}
                onValueChange={(v) => setDealForm((f) => ({ ...f, outcome: v === 'open' ? '' : v as 'won' | 'lost' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">In Progress</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={dealForm.notes}
                onChange={(e) => setDealForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes…"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDealDialog({ open: false })}>Cancel</Button>
            <Button onClick={handleSaveDeal} disabled={!dealForm.title.trim() || !dealForm.stageId}>
              {dealDialog.deal ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
