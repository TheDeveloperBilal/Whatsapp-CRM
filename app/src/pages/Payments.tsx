import { useState } from 'react'
import { toast } from 'sonner'
import { usePortal } from '@/lib/portal-context'
import type { PaymentGateway, PaymentLink, Invoice, PaymentProvider } from '@/types/portal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  Plus, Pencil, Trash2, Send, CreditCard, FileText, Check,
  AlertCircle, ExternalLink, Eye, EyeOff, ShieldCheck,
} from 'lucide-react'

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

const PROVIDER_META: Record<PaymentProvider, { label: string; color: string; logo: string }> = {
  stripe:  { label: 'Stripe',  color: 'text-purple-600', logo: '💳' },
  paypal:  { label: 'PayPal',  color: 'text-blue-600',   logo: '🅿ï¸' },
}

const LINK_STATUS_BADGE: Record<string, string> = {
  active:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  paid:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  expired:   'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const INVOICE_STATUS_BADGE: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  sent:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  paid:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

// â”€â”€ Gateway Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function GatewayCard({ gw, onEdit, onDelete }: { gw: PaymentGateway; onEdit: () => void; onDelete: () => void }) {
  const meta = PROVIDER_META[gw.provider]
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{meta.logo}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{gw.name}</p>
              <Badge variant={gw.active ? 'default' : 'secondary'} className="text-xs">{gw.active ? 'Active' : 'Inactive'}</Badge>
              {gw.live && <Badge className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0">Live</Badge>}
              {!gw.live && <Badge variant="secondary" className="text-xs">Test</Badge>}
            </div>
            <p className={`text-sm font-medium ${meta.color}`}>{meta.label}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"><Pencil className="h-4 w-4" /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
        {gw.hasSecretKey ? 'Secret key configured' : 'No secret key'}
        {gw.publicKey && ' · Public key set'}
      </div>
    </div>
  )
}

// â”€â”€ Payment Link Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function LinkRow({ link, contacts, onSend, onMarkPaid }: {
  link: PaymentLink
  contacts: ReturnType<typeof usePortal>['contacts']
  onSend: () => void
  onMarkPaid: () => void
}) {
  const contact = contacts.find((c) => c.id === link.contactId)
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <CreditCard className="h-5 w-5 text-purple-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{link.description}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{contact?.name ?? link.contactId} · {new Date(link.createdAt).toLocaleDateString()}</p>
      </div>
      <span className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">{fmt(link.amount, link.currency)}</span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${LINK_STATUS_BADGE[link.status] ?? ''}`}>
        {link.status.charAt(0).toUpperCase() + link.status.slice(1)}
      </span>
      <div className="flex gap-1 flex-shrink-0">
        {link.url && (
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {link.status === 'active' && (
          <>
            <button onClick={onSend} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="Send via WhatsApp">
              <Send className="h-3.5 w-3.5" />
            </button>
            <button onClick={onMarkPaid} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="Mark as paid">
              <Check className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// â”€â”€ Invoice Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function InvoiceRow({ inv, contacts, onEdit, onDelete }: {
  inv: Invoice
  contacts: ReturnType<typeof usePortal>['contacts']
  onEdit: () => void
  onDelete: () => void
}) {
  const contact = contacts.find((c) => c.id === inv.contactId)
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{contact?.name ?? inv.contactId}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''} · {new Date(inv.createdAt).toLocaleDateString()}{inv.dueDate ? ` · Due ${new Date(inv.dueDate).toLocaleDateString()}` : ''}</p>
      </div>
      <span className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">{fmt(inv.total, inv.currency)}</span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${INVOICE_STATUS_BADGE[inv.status] ?? ''}`}>
        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
      </span>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Payments() {
  const {
    paymentGateways, paymentLinks, invoices, contacts, deals,
    createPaymentGateway, updatePaymentGateway, deletePaymentGateway,
    createPaymentLink, updatePaymentLink, sendPaymentLink,
    createInvoice, updateInvoice, deleteInvoice,
  } = usePortal()

  // â”€â”€ Gateway dialog â”€â”€
  const [gwDialog, setGwDialog] = useState<{ open: boolean; gw?: PaymentGateway }>({ open: false })
  const [gwForm, setGwForm] = useState({ provider: 'stripe' as PaymentProvider, name: '', secretKey: '', publicKey: '', webhookSecret: '', live: false })
  const [showSecret, setShowSecret] = useState(false)

  // â”€â”€ Payment link dialog â”€â”€
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkForm, setLinkForm] = useState({ contactId: '', dealId: '', amount: '', currency: 'USD', description: '', gatewayId: '' })
  const [linkLoading, setLinkLoading] = useState(false)

  // â”€â”€ Invoice dialog â”€â”€
  const [invDialog, setInvDialog] = useState<{ open: boolean; inv?: Invoice }>({ open: false })
  const [invForm, setInvForm] = useState({ contactId: '', dealId: '', currency: 'USD', dueDate: '', notes: '', taxPct: '', items: [{ description: '', qty: 1, unitPrice: 0 }] })
  const [invStatus, setInvStatus] = useState<{ id: string; status: string } | null>(null)

  // â”€â”€ Gateway actions â”€â”€
  const openNewGw = () => { setGwForm({ provider: 'stripe', name: '', secretKey: '', publicKey: '', webhookSecret: '', live: false }); setShowSecret(false); setGwDialog({ open: true }) }
  const openEditGw = (gw: PaymentGateway) => { setGwForm({ provider: gw.provider, name: gw.name, secretKey: '', publicKey: gw.publicKey ?? '', webhookSecret: '', live: gw.live }); setShowSecret(false); setGwDialog({ open: true, gw }) }

  const handleSaveGw = async () => {
    if (!gwForm.name.trim() || (!gwDialog.gw && !gwForm.secretKey.trim())) return
    try {
      if (gwDialog.gw) {
        const patch: Record<string, unknown> = { name: gwForm.name, publicKey: gwForm.publicKey, live: gwForm.live }
        if (gwForm.secretKey) patch.secretKey = gwForm.secretKey
        if (gwForm.webhookSecret) patch.webhookSecret = gwForm.webhookSecret
        await updatePaymentGateway(gwDialog.gw.id, patch)
      } else {
        await createPaymentGateway({ ...gwForm })
      }
      setGwDialog({ open: false })
      toast.success('Gateway saved')
    } catch (e) { toast.error('Failed to save gateway') }
  }

  const handleDeleteGw = async (id: string) => {
    if (!confirm('Delete this payment gateway?')) return
    await deletePaymentGateway(id)
    toast.success('Gateway removed')
  }

  // â”€â”€ Payment link actions â”€â”€
  const handleCreateLink = async () => {
    if (!linkForm.contactId || !linkForm.amount || !linkForm.description || !linkForm.gatewayId) return
    setLinkLoading(true)
    try {
      await createPaymentLink({ contactId: linkForm.contactId, dealId: linkForm.dealId || undefined, amount: Number(linkForm.amount), currency: linkForm.currency, description: linkForm.description, gatewayId: linkForm.gatewayId })
      setLinkDialog(false)
      toast.success('Payment link created')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to create link') }
    finally { setLinkLoading(false) }
  }

  const handleSendLink = async (id: string) => {
    try { await sendPaymentLink(id); toast.success('Payment link sent via WhatsApp') }
    catch { toast.error('Failed to send — check WhatsApp session') }
  }

  const handleMarkPaid = async (id: string) => {
    await updatePaymentLink(id, { status: 'paid', paidAt: new Date().toISOString() })
    toast.success('Marked as paid')
  }

  // â”€â”€ Invoice actions â”€â”€
  const openNewInv = () => {
    setInvForm({ contactId: '', dealId: '', currency: 'USD', dueDate: '', notes: '', taxPct: '', items: [{ description: '', qty: 1, unitPrice: 0 }] })
    setInvStatus(null)
    setInvDialog({ open: true })
  }

  const openEditInv = (inv: Invoice) => {
    setInvStatus({ id: inv.id, status: inv.status })
    setInvDialog({ open: true, inv })
  }

  const addItem = () => setInvForm((f) => ({ ...f, items: [...f.items, { description: '', qty: 1, unitPrice: 0 }] }))
  const removeItem = (i: number) => setInvForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))
  const updateItem = (i: number, key: string, val: string | number) => setInvForm((f) => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [key]: val } : it) }))
  const subtotal = invForm.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const tax = invForm.taxPct ? subtotal * (Number(invForm.taxPct) / 100) : 0

  const handleSaveInv = async () => {
    if (!invForm.contactId || !invForm.items.length) return
    if (invDialog.inv) {
      if (invStatus) await updateInvoice(invDialog.inv.id, { status: invStatus.status })
    } else {
      await createInvoice({ contactId: invForm.contactId, dealId: invForm.dealId || undefined, items: invForm.items.map((i) => ({ ...i, qty: Number(i.qty), unitPrice: Number(i.unitPrice) })), currency: invForm.currency, dueDate: invForm.dueDate || undefined, notes: invForm.notes, taxPct: invForm.taxPct ? Number(invForm.taxPct) : undefined })
    }
    setInvDialog({ open: false })
    toast.success(invDialog.inv ? 'Invoice updated' : 'Invoice created')
  }

  const handleDeleteInv = async (id: string) => {
    if (!confirm('Delete this invoice?')) return
    await deleteInvoice(id)
  }

  // â”€â”€ Stats â”€â”€
  const paidLinks = paymentLinks.filter((l) => l.status === 'paid').reduce((s, l) => s + l.amount, 0)
  const paidInvs = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const activeLinks = paymentLinks.filter((l) => l.status === 'active').length
  const currency = paymentLinks[0]?.currency ?? invoices[0]?.currency ?? 'USD'

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Warning banner if no gateway */}
      {paymentGateways.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">Connect a payment gateway (Stripe or PayPal) to start creating payment links.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Revenue Collected', value: fmt(paidLinks + paidInvs, currency), icon: <Check className="h-5 w-5 text-green-500" /> },
          { label: 'Active Links', value: activeLinks, icon: <CreditCard className="h-5 w-5 text-purple-500" /> },
          { label: 'Gateways', value: paymentGateways.length, icon: <ShieldCheck className="h-5 w-5 text-blue-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
            {icon}
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="links">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="links">Payment Links</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="gateways">Gateways</TabsTrigger>
          </TabsList>
          <div>
            <TabsContent value="links" className="mt-0">
              <Button onClick={() => setLinkDialog(true)} size="sm" disabled={paymentGateways.length === 0}><Plus className="h-4 w-4 mr-1" />New Payment Link</Button>
            </TabsContent>
            <TabsContent value="invoices" className="mt-0">
              <Button onClick={openNewInv} size="sm"><Plus className="h-4 w-4 mr-1" />New Invoice</Button>
            </TabsContent>
            <TabsContent value="gateways" className="mt-0">
              <Button onClick={openNewGw} size="sm"><Plus className="h-4 w-4 mr-1" />Connect Gateway</Button>
            </TabsContent>
          </div>
        </div>

        <TabsContent value="links" className="mt-4 space-y-2">
          {paymentLinks.length === 0 && <div className="text-center py-12 text-gray-400"><CreditCard className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium">No payment links yet</p></div>}
          {[...paymentLinks].reverse().map((link) => (
            <LinkRow key={link.id} link={link} contacts={contacts} onSend={() => handleSendLink(link.id)} onMarkPaid={() => handleMarkPaid(link.id)} />
          ))}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-2">
          {invoices.length === 0 && <div className="text-center py-12 text-gray-400"><FileText className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium">No invoices yet</p></div>}
          {[...invoices].reverse().map((inv) => (
            <InvoiceRow key={inv.id} inv={inv} contacts={contacts} onEdit={() => openEditInv(inv)} onDelete={() => handleDeleteInv(inv.id)} />
          ))}
        </TabsContent>

        <TabsContent value="gateways" className="mt-4">
          {paymentGateways.length === 0 && <div className="text-center py-12 text-gray-400"><ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium">No gateways connected</p><p className="text-sm">Add Stripe or PayPal to get started</p></div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paymentGateways.map((gw) => (
              <GatewayCard key={gw.id} gw={gw} onEdit={() => openEditGw(gw)} onDelete={() => handleDeleteGw(gw.id)} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Gateway Dialog */}
      <Dialog open={gwDialog.open} onOpenChange={(o) => !o && setGwDialog({ open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{gwDialog.gw ? 'Edit Gateway' : 'Connect Payment Gateway'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={gwForm.provider} onValueChange={(v) => setGwForm((f) => ({ ...f, provider: v as PaymentProvider }))} disabled={!!gwDialog.gw}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">💳 Stripe</SelectItem>
                  <SelectItem value="paypal">🅿ï¸ PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Display Name *</Label>
              <Input value={gwForm.name} onChange={(e) => setGwForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. My Stripe Account" />
            </div>
            <div className="space-y-1.5">
              <Label>{gwDialog.gw ? 'New Secret Key (leave blank to keep current)' : 'Secret Key *'}</Label>
              <div className="relative">
                <Input type={showSecret ? 'text' : 'password'} value={gwForm.secretKey} onChange={(e) => setGwForm((f) => ({ ...f, secretKey: e.target.value }))} placeholder={gwForm.provider === 'stripe' ? 'sk_test_...' : 'PayPal Client Secret'} className="pr-10" />
                <button type="button" onClick={() => setShowSecret((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{gwForm.provider === 'stripe' ? 'Publishable Key (optional)' : 'Client ID (PayPal)'}</Label>
              <Input value={gwForm.publicKey} onChange={(e) => setGwForm((f) => ({ ...f, publicKey: e.target.value }))} placeholder={gwForm.provider === 'stripe' ? 'pk_test_...' : 'PayPal Client ID'} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Live Mode</Label>
                <p className="text-xs text-gray-500 mt-0.5">Enable for real transactions. Test mode is safe for testing.</p>
              </div>
              <Switch checked={gwForm.live} onCheckedChange={(v) => setGwForm((f) => ({ ...f, live: v }))} />
            </div>
            <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              🔒 Your secret key is stored securely on the server and never exposed to the browser.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGwDialog({ open: false })}>Cancel</Button>
            <Button onClick={handleSaveGw} disabled={!gwForm.name.trim() || (!gwDialog.gw && !gwForm.secretKey.trim())}>
              {gwDialog.gw ? 'Save' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Link Dialog */}
      <Dialog open={linkDialog} onOpenChange={(o) => !o && setLinkDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Payment Link</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Contact *</Label>
              <Select value={linkForm.contactId || 'none'} onValueChange={(v) => setLinkForm((f) => ({ ...f, contactId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select contact —</SelectItem>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input value={linkForm.description} onChange={(e) => setLinkForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Logo Design — Project #42" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input type="number" value={linkForm.amount} onChange={(e) => setLinkForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" min={1} />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={linkForm.currency} onValueChange={(v) => setLinkForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD', 'EUR', 'GBP', 'PKR', 'AED', 'SAR', 'INR'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Gateway *</Label>
              <Select value={linkForm.gatewayId || 'none'} onValueChange={(v) => setLinkForm((f) => ({ ...f, gatewayId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select gateway" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select gateway —</SelectItem>
                  {paymentGateways.filter((g) => g.active).map((g) => <SelectItem key={g.id} value={g.id}>{PROVIDER_META[g.provider].logo} {g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Link to Deal (optional)</Label>
              <Select value={linkForm.dealId || 'none'} onValueChange={(v) => setLinkForm((f) => ({ ...f, dealId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No deal —</SelectItem>
                  {deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateLink} disabled={linkLoading || !linkForm.contactId || !linkForm.amount || !linkForm.description || !linkForm.gatewayId}>
              {linkLoading ? 'Creating…' : 'Create Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={invDialog.open} onOpenChange={(o) => !o && setInvDialog({ open: false })}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{invDialog.inv ? 'Edit Invoice' : 'New Invoice'}</DialogTitle></DialogHeader>
          {invDialog.inv ? (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={invStatus?.status ?? invDialog.inv.status} onValueChange={(v) => setInvStatus({ id: invDialog.inv!.id, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['draft', 'sent', 'paid', 'overdue'].map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Contact *</Label>
                <Select value={invForm.contactId || 'none'} onValueChange={(v) => setInvForm((f) => ({ ...f, contactId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select contact —</SelectItem>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={invForm.currency} onValueChange={(v) => setInvForm((f) => ({ ...f, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['USD', 'EUR', 'GBP', 'PKR', 'AED', 'SAR', 'INR'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input type="date" value={invForm.dueDate} onChange={(e) => setInvForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items *</Label>
                  <button onClick={addItem} className="text-xs text-blue-600 hover:underline">+ Add item</button>
                </div>
                {invForm.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                    <Input className="col-span-6 text-sm" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="Description" />
                    <Input className="col-span-2 text-sm" type="number" value={item.qty} onChange={(e) => updateItem(i, 'qty', Number(e.target.value))} min={1} placeholder="Qty" />
                    <Input className="col-span-3 text-sm" type="number" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} min={0} placeholder="Price" />
                    <button onClick={() => removeItem(i)} className="col-span-1 p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <div className="text-right text-sm text-gray-500 space-y-0.5 pr-6">
                  <p>Subtotal: {fmt(subtotal, invForm.currency)}</p>
                  {tax > 0 && <p>Tax ({invForm.taxPct}%): {fmt(tax, invForm.currency)}</p>}
                  <p className="font-bold text-gray-900 dark:text-gray-100">Total: {fmt(subtotal + tax, invForm.currency)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tax %</Label>
                  <Input type="number" value={invForm.taxPct} onChange={(e) => setInvForm((f) => ({ ...f, taxPct: e.target.value }))} min={0} max={100} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input value={invForm.notes} onChange={(e) => setInvForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvDialog({ open: false })}>Cancel</Button>
            <Button onClick={handleSaveInv} disabled={!invDialog.inv && (!invForm.contactId || !invForm.items.length)}>
              {invDialog.inv ? 'Update' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

