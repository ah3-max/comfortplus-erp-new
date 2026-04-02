'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Package, Loader2, Pencil, AlertTriangle, TrendingUp, TrendingDown,
  Factory, Plus, Star, Check, X, ChevronDown, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

// ── 常數 (CSS-only, stays at module level) ──────────────────────────────────

function txColor(type: string): string {
  if (['IN', 'TRANSFER_IN', 'RETURN'].includes(type))   return 'text-green-600'
  if (['OUT', 'TRANSFER_OUT', 'SCRAP'].includes(type))  return 'text-red-600'
  return 'text-blue-600'
}

// ── OEM 廠商狀態 CSS (stays at module level) ─────────────────────────────────
const PS_STATUS_CLS: Record<string, string> = {
  DEVELOPING: 'bg-purple-100 text-purple-700',
  SAMPLING:   'bg-amber-100 text-amber-700',
  APPROVED:   'bg-blue-100 text-blue-700',
  ACTIVE:     'bg-green-100 text-green-700',
  INACTIVE:   'bg-slate-100 text-slate-500',
}

// ── 型別 ─────────────────────────────────────────────────────────────────────

interface InventoryRow {
  id: string
  warehouse: string
  category: string
  quantity: number
  lockedQty: number
  safetyStock: number
}

interface Product {
  id: string
  sku: string
  name: string
  category: string
  series: string | null
  size: string | null
  packagingType: string | null
  piecesPerPack: number | null
  packsPerBox: number | null
  specification: string | null
  unit: string
  barcode: string | null
  sellingPrice: string
  channelPrice?: string | null
  wholesalePrice?: string | null
  costPrice?: string | null
  floorPrice?: string | null
  minSellPrice?: string | null
  oemBasePrice?: string | null
  weight: string | null
  volume: string | null
  storageNotes: string | null
  description: string | null
  isActive: boolean
  inventory: InventoryRow[]
}

interface Transaction {
  id: string
  type: string
  quantity: number
  beforeQty: number
  afterQty: number
  warehouse: string
  category: string
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  createdAt: string
}

interface SalesOrder {
  id: string
  orderNo: string
  status: string
  totalAmount: string
  createdAt: string
}

interface ProductSupplier {
  id: string
  supplierId: string
  factorySku: string | null
  factoryProductName: string | null
  unitCost: string | null
  currency: string
  moq: number | null
  leadTimeDays: number | null
  paymentTerms: string | null
  deliveryTerm: string | null
  originCountry: string | null
  status: string
  isPrimary: boolean
  qualityGrade: string | null
  sampleVersion: string | null
  certifications: string | null
  notes: string | null
  supplier: { id: string; code: string; name: string; country: string | null }
}

interface SupplierOption {
  id: string; code: string; name: string; country: string | null
}

// ── 工具函式 ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: string | number) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency', currency: 'TWD', maximumFractionDigits: 0,
  }).format(Number(v))
}
function fmtNum(v: number) {
  return v.toLocaleString('zh-TW')
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW')
}

// ── 商品資訊 Card ──────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  )
}

// ── Edit Dialog ────────────────────────────────────────────────────────────

interface EditDialogProps {
  open: boolean
  product: Product
  onClose: () => void
  onSuccess: () => void
}

interface EditForm {
  name: string
  category: string
  series: string
  size: string
  sellingPrice: string
  channelPrice: string
  wholesalePrice: string
  description: string
  storageNotes: string
  weight: string
  volume: string
}

function EditDialog({ open, product, onClose, onSuccess }: EditDialogProps) {
  const { dict } = useI18n()
  const [form, setForm] = useState<EditForm>({
    name:           product.name,
    category:       product.category,
    series:         product.series ?? '',
    size:           product.size ?? '',
    sellingPrice:   product.sellingPrice,
    channelPrice:   product.channelPrice ?? '',
    wholesalePrice: product.wholesalePrice ?? '',
    description:    product.description ?? '',
    storageNotes:   product.storageNotes ?? '',
    weight:         product.weight ?? '',
    volume:         product.volume ?? '',
  })
  const [saving, setSaving] = useState(false)

  // Reset form when product changes
  useEffect(() => {
    setForm({
      name:           product.name,
      category:       product.category,
      series:         product.series ?? '',
      size:           product.size ?? '',
      sellingPrice:   product.sellingPrice,
      channelPrice:   product.channelPrice ?? '',
      wholesalePrice: product.wholesalePrice ?? '',
      description:    product.description ?? '',
      storageNotes:   product.storageNotes ?? '',
      weight:         product.weight ?? '',
      volume:         product.volume ?? '',
    })
  }, [product])

  function field(key: keyof EditForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [key]: e.target.value })),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, string | null> = {
        name:           form.name,
        category:       form.category,
        series:         form.series         || null,
        size:           form.size           || null,
        sellingPrice:   form.sellingPrice,
        channelPrice:   form.channelPrice   || null,
        wholesalePrice: form.wholesalePrice || null,
        description:    form.description    || null,
        storageNotes:   form.storageNotes   || null,
        weight:         form.weight         || null,
        volume:         form.volume         || null,
      }
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(dict.productsPage.updated)
        onSuccess()
        onClose()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error ?? dict.common.updateFailed)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dict.productDetail.editProductTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>{dict.productDetail.productName}</Label>
              <Input {...field('name')} required />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.productDetail.productCategory}</Label>
              <Input {...field('category')} required />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.productDetail.series}</Label>
              <Input {...field('series')} placeholder={dict.productDetail.seriesPlaceholder} />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.productDetail.sizeLabel}</Label>
              <Input {...field('size')} placeholder={dict.productDetail.sizePlaceholder} />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.productDetail.weightKg}</Label>
              <Input type="number" step="0.01" {...field('weight')} />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.productDetail.volumeLabel}</Label>
              <Input {...field('volume')} placeholder={dict.productDetail.volumePlaceholder} />
            </div>
          </div>

          <Separator />

          {/* 定價 */}
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dict.productDetail.pricingSection}</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{dict.productDetail.sellingPriceRequired}</Label>
              <Input type="number" step="0.01" {...field('sellingPrice')} required />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.productDetail.channelPriceLabel}</Label>
              <Input type="number" step="0.01" {...field('channelPrice')} />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.productDetail.wholesalePriceLabel}</Label>
              <Input type="number" step="0.01" {...field('wholesalePrice')} />
            </div>
          </div>

          <Separator />

          {/* 說明 */}
          <div className="space-y-1.5">
            <Label>{dict.productDetail.descriptionLabel}</Label>
            <Textarea rows={3} {...field('description')} placeholder={dict.productDetail.descriptionPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.productDetail.storageNotesLabel}</Label>
            <Textarea rows={2} {...field('storageNotes')} placeholder={dict.productDetail.storageNotesPlaceholder} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {dict.common.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.productDetail.saveChanges}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── 廠商表單 ─────────────────────────────────────────────────────────────────
function SupplierForm({ productId, initial, supplierOptions, onSaved, onCancel }: {
  productId: string
  initial?: ProductSupplier
  supplierOptions: SupplierOption[]
  onSaved: () => void
  onCancel: () => void
}) {
  const { dict } = useI18n()
  const isEdit = !!initial
  const [f, setF] = useState({
    supplierId:         initial?.supplierId         || '',
    factorySku:         initial?.factorySku         || '',
    factoryProductName: initial?.factoryProductName || '',
    unitCost:           initial?.unitCost           ?? '',
    currency:           initial?.currency           || 'USD',
    moq:                initial?.moq                ?? '',
    leadTimeDays:       initial?.leadTimeDays        ?? '',
    paymentTerms:       initial?.paymentTerms       || '',
    deliveryTerm:       initial?.deliveryTerm       || '',
    originCountry:      initial?.originCountry      || '',
    status:             initial?.status             || 'ACTIVE',
    isPrimary:          initial?.isPrimary          ?? false,
    qualityGrade:       initial?.qualityGrade       || '',
    sampleVersion:      initial?.sampleVersion      || '',
    certifications:     initial?.certifications     || '',
    notes:              initial?.notes              || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | boolean | number) => setF(prev => ({ ...prev, [k]: v }))

  const psStatusConfig: Record<string, { label: string; color: string }> = {
    DEVELOPING: { label: dict.productDetail.psStatusDeveloping, color: PS_STATUS_CLS.DEVELOPING },
    SAMPLING:   { label: dict.productDetail.psStatusSampling,   color: PS_STATUS_CLS.SAMPLING },
    APPROVED:   { label: dict.productDetail.psStatusApproved,   color: PS_STATUS_CLS.APPROVED },
    ACTIVE:     { label: dict.productDetail.psStatusActive,     color: PS_STATUS_CLS.ACTIVE },
    INACTIVE:   { label: dict.productDetail.psStatusInactive,   color: PS_STATUS_CLS.INACTIVE },
  }

  async function handleSubmit() {
    if (!f.supplierId) { toast.error(dict.productsPage.supplierRequired); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/products/${productId}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? dict.common.saveFailed) }
      toast.success(isEdit ? dict.common.updateSuccess : dict.common.createSuccess)
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : dict.common.saveFailed) }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
        <Factory className="h-4 w-4" />{isEdit ? `${dict.productDetail.editSupplierPrefix}${initial!.supplier.name}` : dict.productDetail.addOemSupplier}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.supplierFieldLabel}</Label>
          <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.supplierId} onChange={e => set('supplierId', e.target.value)} disabled={isEdit}>
            <option value="">{dict.productDetail.selectSupplier}</option>
            {supplierOptions.map(s => <option key={s.id} value={s.id}>{s.name}{s.country ? ` (${s.country})` : ''}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.factorySku}</Label>
          <Input value={f.factorySku} onChange={e => set('factorySku', e.target.value)} className="h-9 text-sm" placeholder={dict.productDetail.factorySkuPlaceholder} />
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.factoryProductName}</Label>
          <Input value={f.factoryProductName} onChange={e => set('factoryProductName', e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.unitCost}</Label>
          <div className="flex gap-1.5">
            <Input type="number" value={String(f.unitCost)} onChange={e => set('unitCost', e.target.value)} className="h-9 text-sm flex-1" placeholder="0.00" />
            <select className="border rounded-md h-9 px-1.5 text-xs w-20" value={f.currency} onChange={e => set('currency', e.target.value)}>
              {['USD', 'TWD', 'CNY', 'VND', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.moq}</Label>
          <Input type="number" value={String(f.moq)} onChange={e => set('moq', e.target.value)} className="h-9 text-sm" placeholder={dict.productDetail.moqPlaceholder} />
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.leadTimeDays}</Label>
          <Input type="number" value={String(f.leadTimeDays)} onChange={e => set('leadTimeDays', e.target.value)} className="h-9 text-sm" placeholder={dict.productDetail.leadTimePlaceholder} />
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.paymentTerms}</Label>
          <Input value={f.paymentTerms} onChange={e => set('paymentTerms', e.target.value)} className="h-9 text-sm" placeholder={dict.productDetail.paymentTermsPlaceholder} />
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.deliveryTerm}</Label>
          <Input value={f.deliveryTerm} onChange={e => set('deliveryTerm', e.target.value)} className="h-9 text-sm" placeholder={dict.productDetail.deliveryTermPlaceholder} />
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.originCountry}</Label>
          <Input value={f.originCountry} onChange={e => set('originCountry', e.target.value)} className="h-9 text-sm" placeholder={dict.productDetail.originCountryPlaceholder} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.statusLabel}</Label>
          <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(psStatusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.sampleVersionLabel}</Label>
          <Input value={f.sampleVersion} onChange={e => set('sampleVersion', e.target.value)} className="h-9 text-sm" placeholder="v1.2" />
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.qualityGradeLabel}</Label>
          <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.qualityGrade} onChange={e => set('qualityGrade', e.target.value)}>
            <option value="">{dict.productDetail.qualityGradeUnset}</option>
            {['A', 'B', 'C'].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={f.isPrimary} onChange={e => set('isPrimary', e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm">{dict.productDetail.setPrimary}</span>
          </label>
        </div>
      </div>
      <div>
        <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.certificationsLabel}</Label>
        <Input value={f.certifications} onChange={e => set('certifications', e.target.value)} className="h-9 text-sm" placeholder={dict.productDetail.certificationsPlaceholder} />
      </div>
      <div>
        <Label className="text-xs text-slate-600 mb-1.5 block">{dict.productDetail.notesLabel}</Label>
        <Input value={f.notes} onChange={e => set('notes', e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
          {isEdit ? dict.productDetail.saveBtn : dict.productDetail.addSupplierBtn}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}><X className="mr-1.5 h-3.5 w-3.5" />{dict.common.cancel}</Button>
      </div>
    </div>
  )
}

// ── 主頁面 ──────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { dict } = useI18n()

  const [product, setProduct]                 = useState<Product | null>(null)
  const [transactions, setTransactions]       = useState<Transaction[]>([])
  const [orders, setOrders]                   = useState<SalesOrder[]>([])
  const [productSuppliers, setProductSuppliers] = useState<ProductSupplier[]>([])
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([])
  const [loading, setLoading]                 = useState(true)
  const [toggling, setToggling]               = useState(false)
  const [editOpen, setEditOpen]               = useState(false)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<ProductSupplier | null>(null)
  const [suppliersExpanded, setSuppliersExpanded] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, tRes, psRes, suppRes] = await Promise.all([
        fetch(`/api/products/${id}`),
        fetch(`/api/inventory/transactions?productId=${id}&limit=20`),
        fetch(`/api/products/${id}/suppliers`),
        fetch('/api/suppliers?limit=200'),
      ])
      if (!pRes.ok) { setProduct(null); setLoading(false); return }
      const p: Product = await pRes.json()
      setProduct(p)

      if (tRes.ok) {
        const tData = await tRes.json()
        setTransactions(Array.isArray(tData) ? tData : (tData.transactions ?? []))
      }
      if (psRes.ok) setProductSuppliers(await psRes.json())
      if (suppRes.ok) {
        const sd = await suppRes.json()
        setSupplierOptions(Array.isArray(sd) ? sd : (sd.suppliers ?? []))
      }

      // Fetch orders by SKU
      const oRes = await fetch(`/api/orders?search=${encodeURIComponent(p.sku)}&limit=10`)
      if (oRes.ok) {
        const oData = await oRes.json()
        setOrders(Array.isArray(oData) ? oData : (oData.orders ?? []))
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleToggleActive() {
    if (!product) return
    setToggling(true)
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      })
      if (res.ok) {
        toast.success(product.isActive ? dict.productDetail.productDisabled : dict.productDetail.productEnabled)
        fetchAll()
      } else {
        toast.error(dict.common.operationFailed)
      }
    } finally {
      setToggling(false)
    }
  }

  // ── Loading / 404 ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!product) {
    return (
      <div className="py-20 text-center text-muted-foreground">{dict.common.noData}</div>
    )
  }

  // ── Text label maps (inside component, uses dict) ──────────────────────

  const INV_CATEGORY_LABELS = (dict.inventoryLots.categoryLabels as Record<string, string>)
  const TX_TYPE_LABELS = (dict.inventoryExt.txTypes as Record<string, string>)
  const ORDER_STATUS_LABELS = (dict.orders.statuses as Record<string, string>)
  const PS_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    DEVELOPING: { label: dict.productDetail.psStatusDeveloping, color: PS_STATUS_CLS.DEVELOPING },
    SAMPLING:   { label: dict.productDetail.psStatusSampling,   color: PS_STATUS_CLS.SAMPLING },
    APPROVED:   { label: dict.productDetail.psStatusApproved,   color: PS_STATUS_CLS.APPROVED },
    ACTIVE:     { label: dict.productDetail.psStatusActive,     color: PS_STATUS_CLS.ACTIVE },
    INACTIVE:   { label: dict.productDetail.psStatusInactive,   color: PS_STATUS_CLS.INACTIVE },
  }

  // ── 庫存統計 ───────────────────────────────────────────────────────────

  const totalQty  = product.inventory.reduce((s, r) => s + r.quantity, 0)
  const lowStockRows = product.inventory.filter(
    r => r.safetyStock > 0 && r.quantity <= r.safetyStock,
  )

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/products')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
              <span className="font-mono rounded bg-slate-100 px-2 py-0.5 text-xs text-muted-foreground">
                {product.sku}
              </span>
              {product.isActive ? (
                <Badge variant="outline" className="text-xs border-green-200 bg-green-50 text-green-700">
                  {dict.productsExt.statusActive}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-red-200 bg-red-50 text-red-600">
                  {dict.productsExt.statusInactive}
                </Badge>
              )}
              {lowStockRows.length > 0 && (
                <Badge variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />{dict.productDetail.lowStockBadge}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {product.category}
              {product.series && <span> · {product.series}</span>}
              {product.size   && <span> · {product.size}</span>}
              {' · '}{dict.productDetail.totalInventory}<span className="font-medium text-slate-700">{fmtNum(totalQty)}</span> {product.unit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}{dict.common.product}
          </Button>
          <Button
            variant={product.isActive ? 'destructive' : 'default'}
            onClick={handleToggleActive}
            disabled={toggling}
          >
            {toggling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {product.isActive ? dict.common.inactive : dict.common.active}
          </Button>
        </div>
      </div>

      {/* ── Section 1：商品資訊 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-muted-foreground" />{dict.products.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <InfoRow label={dict.products.category}  value={product.category} />
            <InfoRow label={dict.products.series}      value={product.series} />
            <InfoRow label={dict.products.size}      value={product.size} />
            <InfoRow label={dict.productDetail.packagingType}  value={product.packagingType} />
            <InfoRow label={dict.productDetail.piecesPerPack}  value={product.piecesPerPack != null ? `${fmtNum(product.piecesPerPack)}${dict.productDetail.piecesPerPackUnit}` : null} />
            <InfoRow label={dict.productDetail.packsPerBox}  value={product.packsPerBox  != null ? `${fmtNum(product.packsPerBox)}${dict.productDetail.packsPerBoxUnit}` : null} />
            <InfoRow label={dict.productsExt.barcode}      value={product.barcode ? <span className="font-mono">{product.barcode}</span> : null} />
            <InfoRow label={dict.productsExt.weight} value={product.weight} />
            <InfoRow label={dict.productDetail.volumeLabel}      value={product.volume} />
          </div>
          {(product.specification || product.storageNotes || product.description) && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {product.specification && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">{dict.productDetail.specificationDisplay}</p>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{product.specification}</p>
                </div>
              )}
              {product.storageNotes && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">{dict.productDetail.storageNotesDisplay}</p>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{product.storageNotes}</p>
                </div>
              )}
              {product.description && (
                <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">{dict.productDetail.descriptionDisplay}</p>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{product.description}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2：定價 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{dict.productDetail.pricingSection}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs text-muted-foreground">{dict.products.sellingPrice}</p>
              <p className="mt-0.5 text-base font-bold text-blue-700">{fmtCurrency(product.sellingPrice)}</p>
            </div>
            {product.channelPrice   != null && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">{dict.productDetail.channelPriceDisplay}</p>
                <p className="mt-0.5 text-sm font-semibold">{fmtCurrency(product.channelPrice)}</p>
              </div>
            )}
            {product.wholesalePrice != null && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">{dict.productDetail.wholesalePriceDisplay}</p>
                <p className="mt-0.5 text-sm font-semibold">{fmtCurrency(product.wholesalePrice)}</p>
              </div>
            )}
            {product.costPrice      != null && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">{dict.products.costPrice}</p>
                <p className="mt-0.5 text-sm font-semibold">{fmtCurrency(product.costPrice)}</p>
              </div>
            )}
            {product.floorPrice     != null && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">{dict.productDetail.floorPrice}</p>
                <p className="mt-0.5 text-sm font-semibold">{fmtCurrency(product.floorPrice)}</p>
              </div>
            )}
            {product.minSellPrice   != null && (
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-muted-foreground">{dict.productDetail.minSellPrice}</p>
                <p className="mt-0.5 text-sm font-semibold text-amber-700">{fmtCurrency(product.minSellPrice)}</p>
              </div>
            )}
            {product.oemBasePrice   != null && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">{dict.productDetail.oemBasePrice}</p>
                <p className="mt-0.5 text-sm font-semibold">{fmtCurrency(product.oemBasePrice)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3：OEM 廠商管理 ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-2 text-base font-semibold"
              onClick={() => setSuppliersExpanded(!suppliersExpanded)}
            >
              <Factory className="h-4 w-4 text-muted-foreground" />{dict.productDetail.oemSupplierMgmt}
              <span className="ml-1 text-xs font-normal text-muted-foreground">({productSuppliers.length}{dict.productDetail.suppliersUnit})</span>
              {suppliersExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {suppliersExpanded && (
              <Button size="sm" variant="outline" onClick={() => { setShowAddSupplier(true); setEditingSupplier(null) }}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />{dict.productDetail.addSupplier}
              </Button>
            )}
          </div>
        </CardHeader>
        {suppliersExpanded && (
          <CardContent className="space-y-3">
            {(showAddSupplier && !editingSupplier) && (
              <SupplierForm
                productId={id}
                supplierOptions={supplierOptions}
                onSaved={() => { setShowAddSupplier(false); fetchAll() }}
                onCancel={() => setShowAddSupplier(false)}
              />
            )}
            {editingSupplier && (
              <SupplierForm
                productId={id}
                initial={editingSupplier}
                supplierOptions={supplierOptions}
                onSaved={() => { setEditingSupplier(null); fetchAll() }}
                onCancel={() => setEditingSupplier(null)}
              />
            )}

            {productSuppliers.length === 0 && !showAddSupplier ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Factory className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>{dict.productDetail.noSuppliersYet}</p>
              </div>
            ) : (
              <div className="divide-y">
                {productSuppliers.map(ps => {
                  const statusCfg = PS_STATUS_CONFIG[ps.status] ?? { label: ps.status, color: 'bg-slate-100 text-slate-600' }
                  return (
                    <div key={ps.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {ps.isPrimary && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              <Star className="h-2.5 w-2.5 fill-current" />{dict.productDetail.primaryBadge}
                            </span>
                          )}
                          <span className="font-medium text-slate-800">{ps.supplier.name}</span>
                          <span className="font-mono text-xs text-slate-400">{ps.supplier.code}</span>
                          {ps.supplier.country && <span className="text-xs text-slate-400">{ps.supplier.country}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                          {ps.qualityGrade && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{dict.productDetail.qualityBadgePrefix}{ps.qualityGrade}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                          {ps.factorySku && <span>{dict.productDetail.factorySkuDisplay}<span className="font-mono text-slate-800">{ps.factorySku}</span></span>}
                          {ps.unitCost   && <span>{dict.productDetail.unitCostDisplay}<span className="font-medium">{ps.currency} {Number(ps.unitCost).toLocaleString()}</span></span>}
                          {ps.moq        && <span>{dict.productDetail.moqDisplay}{ps.moq.toLocaleString()}{dict.productDetail.moqUnit}</span>}
                          {ps.leadTimeDays && <span>{dict.productDetail.leadTimeDisplay}{ps.leadTimeDays}{dict.productDetail.leadTimeUnit}</span>}
                          {ps.paymentTerms && <span>{dict.productDetail.paymentDisplay}{ps.paymentTerms}</span>}
                          {ps.deliveryTerm && <span>{dict.productDetail.deliveryDisplay}{ps.deliveryTerm}</span>}
                        </div>
                        {(ps.sampleVersion || ps.certifications) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            {ps.sampleVersion   && <span>{dict.productDetail.sampleVersionDisplay}{ps.sampleVersion}</span>}
                            {ps.certifications  && <span>{dict.productDetail.certificationsDisplay}{ps.certifications}</span>}
                          </div>
                        )}
                        {ps.notes && <p className="text-xs text-muted-foreground italic">{ps.notes}</p>}
                      </div>
                      <button
                        onClick={() => { setEditingSupplier(ps); setShowAddSupplier(false) }}
                        className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground hover:text-slate-700 shrink-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Section 4：庫存概況 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{dict.productDetail.inventoryCard}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {product.inventory.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{dict.common.noData}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.common.warehouse}</TableHead>
                  <TableHead>{dict.inventory.category}</TableHead>
                  <TableHead className="text-right">{dict.inventory.quantity}</TableHead>
                  <TableHead className="text-right">{dict.inventoryExt.lockedQty}</TableHead>
                  <TableHead className="text-right">{dict.inventoryExt.available}</TableHead>
                  <TableHead className="text-right">{dict.inventory.safetyStock}</TableHead>
                  <TableHead className="text-center">{dict.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.inventory.map(row => {
                  const available = row.quantity - row.lockedQty
                  const isLow     = row.safetyStock > 0 && row.quantity <= row.safetyStock
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.warehouse}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {INV_CATEGORY_LABELS[row.category] ?? row.category}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${isLow ? 'text-red-600' : ''}`}>
                        {fmtNum(row.quantity)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmtNum(row.lockedQty)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${available < 0 ? 'text-red-600' : ''}`}>
                        {fmtNum(available)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.safetyStock > 0 ? fmtNum(row.safetyStock) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                            <AlertTriangle className="h-3 w-3" />{dict.productDetail.lowStock}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            {dict.productDetail.stockNormal}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Section 5：近期異動 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{dict.productDetail.recentTxCard}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{dict.common.noRecords}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.productDetail.txTimeHeader}</TableHead>
                  <TableHead>{dict.productDetail.txTypeHeader}</TableHead>
                  <TableHead className="text-right">{dict.productDetail.txQtyHeader}</TableHead>
                  <TableHead className="text-right">{dict.productDetail.txBeforeHeader}</TableHead>
                  <TableHead className="text-right">{dict.productDetail.txAfterHeader}</TableHead>
                  <TableHead>{dict.common.warehouse}</TableHead>
                  <TableHead>{dict.productDetail.txSourceHeader}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map(tx => {
                  const color = txColor(tx.type)
                  const isPositive = ['IN', 'TRANSFER_IN', 'RETURN'].includes(tx.type)
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDate(tx.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-sm font-medium ${color}`}>
                          {isPositive
                            ? <TrendingUp className="h-3.5 w-3.5" />
                            : tx.type === 'ADJUSTMENT'
                              ? null
                              : <TrendingDown className="h-3.5 w-3.5" />}
                          {TX_TYPE_LABELS[tx.type] ?? tx.type}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${color}`}>
                        {isPositive ? '+' : tx.type === 'ADJUSTMENT' ? (tx.quantity >= 0 ? '+' : '') : '-'}
                        {fmtNum(Math.abs(tx.quantity))}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmtNum(tx.beforeQty)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmtNum(tx.afterQty)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{tx.warehouse}</div>
                        {tx.category && (
                          <div className="text-xs text-muted-foreground">
                            {INV_CATEGORY_LABELS[tx.category] ?? tx.category}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[180px] text-sm text-muted-foreground">
                        {tx.referenceType && (
                          <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                            {tx.referenceType}
                          </span>
                        )}
                        {tx.notes ?? tx.referenceId ?? '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Section 6：近期銷售訂單 ── */}
      {orders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{dict.productDetail.recentOrdersCard}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.orders.orderNo}</TableHead>
                  <TableHead>{dict.common.status}</TableHead>
                  <TableHead className="text-right">{dict.common.amount}</TableHead>
                  <TableHead>{dict.common.date}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(o => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    <TableCell className="font-mono text-sm font-medium">{o.orderNo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {fmtCurrency(o.totalAmount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(o.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Edit Dialog ── */}
      {editOpen && (
        <EditDialog
          open={editOpen}
          product={product}
          onClose={() => setEditOpen(false)}
          onSuccess={fetchAll}
        />
      )}
    </div>
  )
}
