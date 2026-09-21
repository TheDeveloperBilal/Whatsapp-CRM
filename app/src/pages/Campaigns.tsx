import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import {
  Plus, Pencil, Trash2, Copy, QrCode, ExternalLink,
  Loader2, CheckCircle2, AlertTriangle, Flame, Megaphone,
  Users, TrendingUp, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { usePortal } from '@/lib/store'
import type { Campaign, CampaignType } from '@/types/portal'

// local alias to avoid verbatimModuleSyntax issues
type LocalCampaignType = CampaignType

const TYPE_META: Record<LocalCampaignType, { label: string; emoji: string; color: string }> = {
  organic:   { label: 'Organic',    emoji: '🌱', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  meta_ads:  { label: 'Meta Ads',   emoji: '📘', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  qr:        { label: 'QR Code',    emoji: '📷', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  referral:  { label: 'Referral',   emoji: '🤝', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
}

const TYPE_OPTIONS: { value: LocalCampaignType; label: string; desc: string }[] = [
  { value: 'organic',  label: '🌱 Organic',    desc: 'Direct WhatsApp link shared on social / website' },
  { value: 'meta_ads', label: '📘 Meta Ads',   desc: 'Facebook / Instagram ad → WhatsApp' },
  { value: 'qr',       label: '📷 QR Code',    desc: 'Printed QR code at a physical location' },
  { value: 'referral', label: '🤝 Referral',   desc: 'Referred by existing customer' },
]

interface CampaignForm {
  name: string
  type: LocalCampaignType
  phone: string
  welcomeMessage: string
  trackingCode: string
}

const emptyForm: CampaignForm = {
  name: '',
  type: 'organic',
  phone: '',
  welcomeMessage: '',
  trackingCode: '',
}

function waLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  const encoded = encodeURIComponent(message || '')
  return `https://wa.me/${digits}${encoded ? `?text=${encoded}` : ''}`
}

function QrPreview({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvasRef.current || !url) return
    QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(() => {})
  }, [url])
  if (!url) return null
  return <canvas ref={canvasRef} className="rounded-lg border" />
}

export default function Campaigns() {
  const { campaigns, sessions, createCampaign, updateCampaign, deleteCampaign } = usePortal()

  const connectedPhones = sessions
    .filter((s) => s.status === 'connected' && s.phone)
    .map((s) => ({ id: s.id, phone: s.phone!, name: s.name }))

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CampaignForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edit modal
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CampaignForm>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)

  // QR modal
  const [qrCampaign, setQrCampaign] = useState<Campaign | null>(null)

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

  const openCreate = () => {
    setForm({ ...emptyForm, trackingCode: randomCode() })
    setCreateError('')
    setShowCreate(true)
  }

  const openEdit = (c: Campaign) => {
    setEditId(c.id)
    setEditForm({
      name: c.name,
      type: c.type,
      phone: c.phone,
      welcomeMessage: c.welcomeMessage,
      trackingCode: c.trackingCode,
    })
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !form.phone.trim()) return setCreateError('Name and phone number are required.')
    setSaving(true)
    try {
      await createCampaign({ ...form, active: true })
      setShowCreate(false)
      setForm(emptyForm)
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create campaign.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editId) return
    setEditSaving(true)
    try {
      await updateCampaign(editId, editForm)
      setEditId(null)
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteCampaign(deleteId)
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const toggleActive = async (c: Campaign) => {
    await updateCampaign(c.id, { active: !c.active }).catch(() => {})
  }

  const copyLink = (c: Campaign) => {
    const link = waLink(c.phone, c.welcomeMessage)
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(c.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const totalLeads = campaigns.reduce((n, c) => n + c.leads, 0)
  const activeCampaigns = campaigns.filter((c) => c.active).length

  // preview link for the form being edited
  const previewPhone = form.phone || ''
  const previewMsg = form.welcomeMessage || ''
  const previewLink = waLink(previewPhone, previewMsg)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lead Capture & Campaigns</h2>
          <p className="text-muted-foreground">
            Generate wa.me tracking links, QR codes, and capture Meta Lead Ads straight into your CRM.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" /> New Campaign
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Flame className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{campaigns.length}</div>
              <div className="text-xs text-muted-foreground">Total campaigns</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="size-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeCampaigns}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Users className="size-5 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalLeads}</div>
              <div className="text-xs text-muted-foreground">Leads captured</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Megaphone className="size-12 mb-3 opacity-20" />
          <p className="text-sm">No campaigns yet. Create one to start capturing leads.</p>
        </div>
      )}

      {/* Campaign cards */}
      <div className="grid gap-4">
        {campaigns.map((c) => {
          const link = waLink(c.phone, c.welcomeMessage)
          const meta = TYPE_META[c.type]
          const copied = copiedId === c.id
          return (
            <Card key={c.id} className={cn('transition-opacity', !c.active && 'opacity-60')}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{c.name}</span>
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', meta.color)}>
                        {meta.emoji} {meta.label}
                      </span>
                      {!c.active && <Badge variant="outline" className="text-[10px]">paused</Badge>}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{c.trackingCode}</span>
                      <span>·</span>
                      <span>+{c.phone}</span>
                      <span>·</span>
                      <span>{c.leads} lead{c.leads !== 1 ? 's' : ''}</span>
                    </div>

                    {link && (
                      <div className="flex items-center gap-1.5">
                        <code className="text-[11px] text-muted-foreground truncate max-w-xs bg-muted px-2 py-0.5 rounded">
                          {link.length > 60 ? link.slice(0, 57) + '…' : link}
                        </code>
                        <Button size="icon" variant="ghost" className="size-6 shrink-0" onClick={() => copyLink(c)}>
                          {copied
                            ? <CheckCircle2 className="size-3.5 text-emerald-500" />
                            : <Copy className="size-3.5" />}
                        </Button>
                        <a href={link} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost" className="size-6 shrink-0">
                            <ExternalLink className="size-3.5" />
                          </Button>
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon" variant="ghost" className="size-7"
                      title={c.active ? 'Pause campaign' : 'Activate campaign'}
                      onClick={() => toggleActive(c)}
                    >
                      {c.active
                        ? <ToggleRight className="size-4 text-emerald-500" />
                        : <ToggleLeft className="size-4 text-muted-foreground" />}
                    </Button>
                    {(c.type === 'qr' || c.phone) && (
                      <Button size="icon" variant="ghost" className="size-7" title="Show QR code" onClick={() => setQrCampaign(c)}>
                        <QrCode className="size-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(c)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(c.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Meta webhook info */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>📘</span> Meta Lead Ads — Webhook Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Point your Meta Lead Ads webhook to this URL. New leads are automatically added as contacts.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-2 py-1.5 rounded text-xs font-mono break-all">
              POST /api/webhooks/meta
            </code>
          </div>
          <p className="text-xs">Verify token: <code className="bg-muted px-1 rounded">whatsapp-crm-verify</code> (set <code className="bg-muted px-1 rounded">META_WEBHOOK_VERIFY_TOKEN</code> in .env to override)</p>
        </CardContent>
      </Card>

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Campaign Name</Label>
              <Input
                placeholder="Summer Meta Ads"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as LocalCampaignType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp Number</Label>
              <Input
                placeholder="971501234567 (digits only, with country code)"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))}
              />
              {connectedPhones.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {connectedPhones.map((s) => (
                    <button
                      key={s.id}
                      className="text-[11px] border rounded px-2 py-0.5 hover:bg-accent transition-colors"
                      onClick={() => setForm((p) => ({ ...p, phone: s.phone }))}
                    >
                      {s.name} ({s.phone})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Pre-filled Message</Label>
              <Textarea
                placeholder="Hi! I'm interested in your services. [REF:ABC123]"
                rows={3}
                value={form.welcomeMessage}
                onChange={(e) => setForm((p) => ({ ...p, welcomeMessage: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">This message auto-fills when the customer opens the wa.me link.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Tracking Code</Label>
              <div className="flex gap-2">
                <Input
                  className="font-mono"
                  value={form.trackingCode}
                  onChange={(e) => setForm((p) => ({ ...p, trackingCode: e.target.value.toUpperCase() }))}
                />
                <Button variant="outline" size="sm" onClick={() => setForm((p) => ({ ...p, trackingCode: randomCode() }))}>
                  Random
                </Button>
              </div>
            </div>
            {previewLink && (
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">wa.me link preview</p>
                <p className="text-xs font-mono break-all">{previewLink}</p>
              </div>
            )}
            {createError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0" /> {createError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Campaign Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm((p) => ({ ...p, type: v as LocalCampaignType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp Number</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pre-filled Message</Label>
              <Textarea
                rows={3}
                value={editForm.welcomeMessage}
                onChange={(e) => setEditForm((p) => ({ ...p, welcomeMessage: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tracking Code</Label>
              <Input
                className="font-mono"
                value={editForm.trackingCode}
                onChange={(e) => setEditForm((p) => ({ ...p, trackingCode: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR modal */}
      <Dialog open={!!qrCampaign} onOpenChange={(o) => !o && setQrCampaign(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>QR Code — {qrCampaign?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCampaign && <QrPreview url={waLink(qrCampaign.phone, qrCampaign.welcomeMessage)} />}
            <p className="text-xs text-center text-muted-foreground">
              Scan to open WhatsApp with the pre-filled message for <strong>{qrCampaign?.name}</strong>.
            </p>
            <Button
              variant="outline" size="sm"
              onClick={() => {
                if (!qrCampaign) return
                const link = waLink(qrCampaign.phone, qrCampaign.welcomeMessage)
                navigator.clipboard.writeText(link)
              }}
            >
              <Copy className="size-3.5 mr-1.5" /> Copy Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete Campaign?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This removes the campaign and its tracking link. Existing contacts attributed to it are kept.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

