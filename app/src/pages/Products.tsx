import { useState, useMemo } from 'react'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ShoppingBag,
  Download,
  Briefcase,
  Search,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { usePortal } from '@/lib/store'

// Local type mirrors portal.ts — avoids Vite module issue with verbatimModuleSyntax
type ProductType = 'physical' | 'digital' | 'service'
type PricingModel = 'fixed' | 'hourly' | 'quote'
type PV = { name: string; options: string[] }
type ProductLocal = {
  type: ProductType
  name: string
  category: string
  description: string
  price: number
  currency: string
  sku: string
  stock: string          // stored as string in form, parsed on save
  variants: PV[]
  deliveryInfo: string
  pricingModel: PricingModel
  availability: string
  active: boolean
}

const blankForm = (): ProductLocal => ({
  type: 'physical',
  name: '',
  category: '',
  description: '',
  price: 0,
  currency: 'PKR',
  sku: '',
  stock: '',
  variants: [],
  deliveryInfo: '',
  pricingModel: 'fixed',
  availability: '',
  active: true,
})

const TYPE_ICONS = {
  physical: ShoppingBag,
  digital: Download,
  service: Briefcase,
}

const TYPE_LABELS: Record<ProductType, string> = {
  physical: 'Physical',
  digital: 'Digital',
  service: 'Service',
}

const TYPE_COLORS: Record<ProductType, string> = {
  physical: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  digital: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  service: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
}

function toPayload(f: ProductLocal) {
  const base = {
    type: f.type,
    name: f.name.trim(),
    category: f.category.trim() || 'General',
    description: f.description.trim(),
    price: Number(f.price) || 0,
    currency: f.currency.trim() || 'PKR',
    active: f.active,
  }
  if (f.type === 'physical') {
    return {
      ...base,
      sku: f.sku.trim() || undefined,
      stock: f.stock === '' ? undefined : Number(f.stock),
      variants: f.variants.filter((v) => v.name && v.options.length > 0),
    }
  }
  if (f.type === 'digital') {
    return { ...base, deliveryInfo: f.deliveryInfo.trim() || undefined }
  }
  return {
    ...base,
    pricingModel: f.pricingModel,
    availability: f.availability.trim() || undefined,
  }
}

function stockBadge(stock: number | undefined) {
  if (stock === undefined) return null
  if (stock === 0) return <Badge variant="destructive">Out of stock</Badge>
  if (stock <= 5) return <Badge variant="outline" className="text-amber-600 border-amber-400">{stock} left</Badge>
  return <Badge variant="outline">{stock} in stock</Badge>
}

export default function Products() {
  const { products, saveProduct, updateProduct, deleteProduct } = usePortal()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProductType | 'all'>('all')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<ProductLocal>(blankForm())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [variantInput, setVariantInput] = useState('')   // "Color:Red,Blue,Yellow"

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(
      (p) =>
        (typeFilter === 'all' || p.type === typeFilter) &&
        (p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)),
    )
  }, [products, search, typeFilter])

  const grouped = useMemo(() => {
    const g: Record<string, typeof filtered> = {}
    for (const p of filtered) {
      if (!g[p.category]) g[p.category] = []
      g[p.category].push(p)
    }
    return g
  }, [filtered])

  const addVariant = (f: ProductLocal, setF: (x: ProductLocal) => void) => {
    const [namePart, optsPart] = variantInput.split(':')
    if (!namePart || !optsPart) return
    const opts = optsPart.split(',').map((s) => s.trim()).filter(Boolean)
    if (!opts.length) return
    setF({ ...f, variants: [...f.variants, { name: namePart.trim(), options: opts }] })
    setVariantInput('')
  }

  const removeVariant = (f: ProductLocal, setF: (x: ProductLocal) => void, idx: number) => {
    setF({ ...f, variants: f.variants.filter((_, i) => i !== idx) })
  }

  const submitNew = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await saveProduct(toPayload(form) as Parameters<typeof saveProduct>[0])
      setForm(blankForm())
      setVariantInput('')
      setShowNew(false)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (p: (typeof products)[0]) => {
    setEditId(p.id)
    setForm({
      type: p.type as ProductType,
      name: p.name,
      category: p.category,
      description: p.description ?? '',
      price: p.price,
      currency: p.currency,
      sku: p.sku ?? '',
      stock: p.stock !== undefined ? String(p.stock) : '',
      variants: (p.variants ?? []) as PV[],
      deliveryInfo: p.deliveryInfo ?? '',
      pricingModel: (p.pricingModel as PricingModel) ?? 'fixed',
      availability: p.availability ?? '',
      active: p.active,
    })
    setVariantInput('')
    setShowNew(true)
  }

  const submitEdit = async () => {
    if (!editId || !form.name.trim()) return
    setSaving(true)
    try {
      await updateProduct(editId, toPayload(form) as Parameters<typeof updateProduct>[1])
      setEditId(null)
      setForm(blankForm())
      setVariantInput('')
      setShowNew(false)
    } finally {
      setSaving(false)
    }
  }

  const F = form
  const setF = setForm

  const modal = showNew && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-xl my-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{editId ? 'Edit Product' : 'New Product'}</h3>
          <button onClick={() => { setShowNew(false); setEditId(null); setForm(blankForm()) }} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Type selector */}
        <div className="space-y-1.5">
          <Label>Product type</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['physical', 'digital', 'service'] as ProductType[]).map((t) => {
              const Icon = TYPE_ICONS[t]
              return (
                <button
                  key={t}
                  onClick={() => setF({ ...F, type: t })}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors ${F.type === t ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-accent'}`}
                >
                  <Icon className="size-5" />
                  {TYPE_LABELS[t]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Common fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Product name *</Label>
            <Input placeholder="e.g. Red Racing Car" value={F.name} onChange={(e) => setF({ ...F, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input placeholder="e.g. Toys" value={F.category} onChange={(e) => setF({ ...F, category: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input placeholder="PKR" value={F.currency} onChange={(e) => setF({ ...F, currency: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Price {F.type === 'service' && F.pricingModel === 'hourly' ? '(per hour)' : ''}</Label>
            <Input type="number" min={0} placeholder="0" value={F.price || ''} onChange={(e) => setF({ ...F, price: Number(e.target.value) })} />
          </div>
          {F.type === 'service' && (
            <div className="space-y-1.5">
              <Label>Pricing model</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={F.pricingModel} onChange={(e) => setF({ ...F, pricingModel: e.target.value as PricingModel })}>
                <option value="fixed">Fixed price</option>
                <option value="hourly">Per hour</option>
                <option value="quote">Quote on request</option>
              </select>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none min-h-16" placeholder="Short product description for the AI" value={F.description} onChange={(e) => setF({ ...F, description: e.target.value })} />
        </div>

        {/* Physical-specific */}
        {F.type === 'physical' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input placeholder="TOY-001" value={F.sku} onChange={(e) => setF({ ...F, sku: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock quantity</Label>
                <Input type="number" min={0} placeholder="Leave blank = unlimited" value={F.stock} onChange={(e) => setF({ ...F, stock: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Variants <span className="text-xs text-muted-foreground">(e.g. Color:Red,Blue,Yellow)</span></Label>
              <div className="flex gap-2">
                <Input placeholder="Size:S,M,L,XL" value={variantInput} onChange={(e) => setVariantInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addVariant(F, setF)} />
                <Button size="sm" variant="outline" type="button" onClick={() => addVariant(F, setF)}>Add</Button>
              </div>
              {F.variants.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {F.variants.map((v, i) => (
                    <span key={i} className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
                      <strong>{v.name}:</strong> {v.options.join(', ')}
                      <button onClick={() => removeVariant(F, setF, i)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Digital-specific */}
        {F.type === 'digital' && (
          <div className="space-y-1.5">
            <Label>Delivery info</Label>
            <Input placeholder="e.g. Instant download link via email" value={F.deliveryInfo} onChange={(e) => setF({ ...F, deliveryInfo: e.target.value })} />
          </div>
        )}

        {/* Service-specific */}
        {F.type === 'service' && (
          <div className="space-y-1.5">
            <Label>Availability</Label>
            <Input placeholder="e.g. Mon–Fri, 9am–6pm" value={F.availability} onChange={(e) => setF({ ...F, availability: e.target.value })} />
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Switch checked={F.active} onCheckedChange={(v) => setF({ ...F, active: v })} id="active-switch" />
          <Label htmlFor="active-switch">Active (visible to AI)</Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { setShowNew(false); setEditId(null); setForm(blankForm()) }}>Cancel</Button>
          <Button onClick={editId ? submitEdit : submitNew} disabled={saving || !F.name.trim()}>
            {saving ? 'Saving…' : editId ? <><Check className="size-3.5 mr-1" />Update</> : 'Save Product'}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="size-6" /> Product Catalog
          </h2>
          <p className="text-muted-foreground mt-1">
            Your products, services, and digital goods. The AI reads this catalog to answer customer
            questions about prices, stock, and variants — automatically.
          </p>
        </div>
        <Button onClick={() => { setForm(blankForm()); setEditId(null); setShowNew(true) }} className="shrink-0">
          <Plus className="size-4 mr-1" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'physical', 'digital', 'service'] as const).map((t) => (
            <Button key={t} size="sm" variant={typeFilter === t ? 'default' : 'outline'} onClick={() => setTypeFilter(t)} className="capitalize">
              {t === 'all' ? 'All' : TYPE_LABELS[t as ProductType]}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{products.length} total</span>
        <span>{products.filter((p) => p.type === 'physical').length} physical</span>
        <span>{products.filter((p) => p.type === 'digital').length} digital</span>
        <span>{products.filter((p) => p.type === 'service').length} services</span>
        <span className="text-red-500">{products.filter((p) => p.type === 'physical' && p.stock === 0).length} out of stock</span>
      </div>

      {/* Product list grouped by category */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{cat}</h3>
          <div className="grid gap-2">
            {items.map((p) => {
              const Icon = TYPE_ICONS[p.type as ProductType]
              return (
                <Card key={p.id} className={!p.active ? 'opacity-50' : undefined}>
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className={`mt-0.5 rounded-md p-1.5 ${TYPE_COLORS[p.type as ProductType]}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {!p.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                        {p.sku && <span className="text-xs text-muted-foreground font-mono">{p.sku}</span>}
                        {p.type === 'physical' && stockBadge(p.stock)}
                      </div>
                      {p.description && <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{p.description}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold">{p.currency} {p.price.toLocaleString()}{p.pricingModel === 'hourly' ? '/hr' : p.pricingModel === 'quote' ? ' (quote)' : ''}</span>
                        {p.variants?.map((v) => (
                          <span key={v.name} className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">
                            {v.name}: {v.options.join(', ')}
                          </span>
                        ))}
                        {p.deliveryInfo && <span className="text-xs text-muted-foreground">{p.deliveryInfo}</span>}
                        {p.availability && <span className="text-xs text-muted-foreground">{p.availability}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteProduct(p.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {products.length === 0
            ? 'No products yet — click Add Product to get started.'
            : 'No products match your search.'}
        </p>
      )}

      {modal}
    </div>
  )
}
