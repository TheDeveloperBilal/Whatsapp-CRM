import { useState, useCallback, useRef } from 'react'
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
import { Plus, Pencil, Trash2, Settings2, GripVertical, DollarSign, TrendingUp, Trophy } from 'lucide-react'

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
    createStage,
    updateStage,
    deleteStage,
    createDeal,
    updateDeal,
    deleteDeal,
  } = usePortal()

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
    if (!stageName.trim()) return
    if (stageDialog.stage) {
      await updateStage(stageDialog.stage.id, { name: stageName.trim(), color: stageColor })
    } else {
      await createStage({ name: stageName.trim(), color: stageColor })
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

  // ── Stats ──
  const totalValue = deals.reduce((s, d) => s + d.value, 0)
  const wonDeals = deals.filter((d) => d.outcome === 'won')
  const closedDeals = deals.filter((d) => d.outcome)
  const winRate = closedDeals.length ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0
  const currency = deals[0]?.currency ?? 'USD'

  const sortedStages = [...pipelineStages].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Pipeline</h1>
        <Button onClick={openNewStage} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Stage
        </Button>
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
              deals={deals.filter((d) => d.stageId === stage.id)}
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

          {pipelineStages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <p className="text-lg font-medium mb-2">No stages yet</p>
              <p className="text-sm mb-4">Create your first pipeline stage to get started</p>
              <Button onClick={openNewStage} variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Stage
              </Button>
            </div>
          )}
        </div>
      </div>

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
