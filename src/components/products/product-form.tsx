'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

const CAN_SEE_COST    = ['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'FINANCE']
const CAN_SEE_MANAGER = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'PROCUREMENT', 'FINANCE']

interface Product {
  id: string; sku: string; name: string; category: string
  series: string | null; size: string | null; packagingType: string | null
  piecesPerPack: number | null; packsPerBox: number | null
  specification: string | null; unit: string; barcode: string | null
  costPrice?: string; floorPrice?: string | null
  sellingPrice: string; channelPrice?: string | null; wholesalePrice?: string | null
  minSellPrice?: string | null; oemBasePrice?: string | null
  weight: string | null; volume: string | null; storageNotes: string | null
  description: string | null; isActive: boolean
  inventory: { safetyStock: number; quantity: number }[]
}

interface ProductFormProps {
  open: boolean; onClose: () => void; onSuccess: () => void
  product?: Product | null
}

interface FormData {
  sku: string; name: string; category: string
  series: string; size: string; packagingType: string
  piecesPerPack: string; packsPerBox: string
  specification: string; unit: string; barcode: string
  costPrice: string; floorPrice: string
  sellingPrice: string; channelPrice: string; wholesalePrice: string
  minSellPrice: string; oemBasePrice: string
  weight: string; volume: string; storageNotes: string
  description: string; safetyStock: string; initialStock: string
  isActive: boolean
}

const emptyForm = (): FormData => ({
  sku: '', name: '', category: '',
  series: '', size: '', packagingType: '',
  piecesPerPack: '', packsPerBox: '',
  specification: '', unit: '', barcode: '',
  costPrice: '', floorPrice: '',
  sellingPrice: '', channelPrice: '', wholesalePrice: '',
  minSellPrice: '', oemBasePrice: '',
  weight: '', volume: '', storageNotes: '',
  description: '', safetyStock: '0', initialStock: '0',
  isActive: true,
})

function toStr(v: string | number | null | undefined) { return v != null ? String(v) : '' }

export function ProductForm({ open, onClose, onSuccess, product }: ProductFormProps) {
  const { dict } = useI18n()
  const fl = dict.formLabels
  const { data: session } = useSession()
  const role    = (session?.user?.role as string) ?? ''
  const isEdit  = !!product
  const inv     = product?.inventory?.[0]

  const canSeeCost    = CAN_SEE_COST.includes(role)
  const canSeeManager = CAN_SEE_MANAGER.includes(role)

  const pp = dict.productsPage
  const categoryValues   = pp.categoryValues
  const categoryLabels   = pp.categoryLabels
  const unitValues       = pp.unitValues
  const unitLabels       = pp.unitLabels
  const seriesValues     = pp.seriesValues
  const seriesLabels     = pp.seriesLabels
  const sizeValues       = pp.sizeValues
  const sizeLabels       = pp.sizeLabels
  const packagingValues  = pp.packagingValues
  const packagingLabels  = pp.packagingLabels

  const [form, setForm] = useState<FormData>(emptyForm())
  const [loading, setLoading] = useState(false)

  /** 自動產生 SKU: 類別代碼 + 時間戳 */
  function generateSku() {
    const categoryMap: Record<string, string> = {
      '紙尿布': 'ADL', '護墊': 'PAD', '清潔用品': 'CLN',
      '護理用品': 'CRE', '防護用品': 'PRT', '輔具': 'AID', '其他': 'OTH',
    }
    const prefix = categoryMap[form.category] || 'PRD'
    const ts = Date.now().toString(36).toUpperCase().slice(-6)
    set('sku', `${prefix}-${ts}`)
  }

  useEffect(() => {
    if (open && product) {
      setForm({
        sku: product.sku, name: product.name, category: product.category,
        series: product.series ?? '', size: product.size ?? '',
        packagingType: product.packagingType ?? '',
        piecesPerPack: toStr(product.piecesPerPack),
        packsPerBox:   toStr(product.packsPerBox),
        specification: product.specification ?? '', unit: product.unit,
        barcode:       product.barcode ?? '',
        costPrice:     toStr(product.costPrice),
        floorPrice:    toStr(product.floorPrice),
        sellingPrice:  toStr(product.sellingPrice),
        channelPrice:  toStr(product.channelPrice),
        wholesalePrice: toStr(product.wholesalePrice),
        minSellPrice:  toStr(product.minSellPrice),
        oemBasePrice:  toStr(product.oemBasePrice),
        weight:        toStr(product.weight),
        volume:        product.volume ?? '',
        storageNotes:  product.storageNotes ?? '',
        description:   product.description ?? '',
        safetyStock:   toStr(inv?.safetyStock ?? 0),
        initialStock:  '0',
        isActive:      product.isActive,
      })
    } else if (!open) {
      setForm(emptyForm())
    }
  }, [open, product])

  function set(field: keyof FormData, value: string | boolean) {
    setForm(p => ({ ...p, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.sku || !form.name || !form.category || !form.sellingPrice) {
      toast.error(dict.forms.skuRequired)
      return
    }
    if (canSeeCost && !form.costPrice) {
      toast.error(dict.forms.costRequired)
      return
    }
    setLoading(true)
    const url    = isEdit ? `/api/products/${product!.id}` : '/api/products'
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      toast.success(isEdit ? dict.forms.productUpdated : dict.forms.productCreated)
      onSuccess(); onClose()
    } else {
      const data = await res.json()
      toast.error(data.error ?? dict.common.operationFailed)
    }
  }

  const margin = form.costPrice && form.sellingPrice
    ? (((Number(form.sellingPrice) - Number(form.costPrice)) / Number(form.sellingPrice)) * 100).toFixed(1)
    : null

  const sel = (field: keyof FormData, values: readonly string[], labels: readonly string[], placeholder?: string) => (
    <select
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={form[field] as string}
      onChange={e => set(field, e.target.value)}
    >
      <option value="">{placeholder ?? fl.pleaseSelect}</option>
      {values.map((v, i) => <option key={v} value={v}>{labels[i] ?? v}</option>)}
    </select>
  )

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? fl.editProduct : fl.newProduct}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 基本資料 */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionBasic}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>SKU <span className="text-red-500">*</span></Label>
                <div className="flex gap-1.5">
                  <Input value={form.sku} onChange={e => set('sku', e.target.value)}
                    placeholder="ADL-M-001" disabled={isEdit} required className="flex-1" />
                  {!isEdit && (
                    <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs h-9"
                      onClick={generateSku}>
                      自動產生
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{fl.barcode}</Label>
                <Input value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="4711234567890" />
              </div>
              <div className="space-y-1.5">
                <Label>{fl.category}</Label>
                {sel('category', categoryValues, categoryLabels, fl.selectCategory)}
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>{fl.productName}</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder={fl.productNamePlaceholder} required />
              </div>
              <div className="space-y-1.5">
                <Label>{fl.series}</Label>
                {sel('series', seriesValues, seriesLabels)}
              </div>
              <div className="space-y-1.5">
                <Label>{fl.size}</Label>
                {sel('size', sizeValues, sizeLabels)}
              </div>
              <div className="space-y-1.5">
                <Label>{fl.packagingType}</Label>
                {sel('packagingType', packagingValues, packagingLabels)}
              </div>
              <div className="space-y-1.5">
                <Label>{fl.specification}</Label>
                <Input value={form.specification} onChange={e => set('specification', e.target.value)} placeholder="M / 60-90cm" />
              </div>
              <div className="space-y-1.5">
                <Label>{fl.unit}</Label>
                {sel('unit', unitValues, unitLabels)}
              </div>
              <div className="space-y-1.5">
                <Label>{fl.piecesPerPack}</Label>
                <Input type="number" value={form.piecesPerPack} onChange={e => set('piecesPerPack', e.target.value)} placeholder="20" min={1} />
              </div>
              <div className="space-y-1.5">
                <Label>{fl.packsPerBox}</Label>
                <Input type="number" value={form.packsPerBox} onChange={e => set('packsPerBox', e.target.value)} placeholder="6" min={1} />
              </div>
            </div>
          </section>

          <Separator />

          {/* 價格設定 */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionPrice}</p>
              {!canSeeCost && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600 border border-amber-200">
                  <Lock className="h-3 w-3" />{fl.partialPriceHidden}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{fl.sellingPrice}</Label>
                <Input type="number" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)}
                  placeholder="0" min={0} step={0.01} required />
              </div>
              <div className="space-y-1.5">
                <Label>{fl.channelPrice}</Label>
                <Input type="number" value={form.channelPrice} onChange={e => set('channelPrice', e.target.value)}
                  placeholder="0" min={0} step={0.01} />
              </div>
              <div className="space-y-1.5">
                <Label>{fl.wholesalePrice}</Label>
                <Input type="number" value={form.wholesalePrice} onChange={e => set('wholesalePrice', e.target.value)}
                  placeholder="0" min={0} step={0.01} />
              </div>
            </div>

            {canSeeManager && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg bg-amber-50/60 border border-amber-100 p-3">
                <div className="col-span-3 text-xs font-medium text-amber-700 mb-1">{fl.salesManagerLevel}</div>
                <div className="space-y-1.5">
                  <Label>{fl.minSellPrice}</Label>
                  <Input type="number" value={form.minSellPrice} onChange={e => set('minSellPrice', e.target.value)}
                    placeholder="0" min={0} step={0.01} />
                </div>
                {canSeeCost && form.sellingPrice && form.minSellPrice && (
                  <div className="space-y-1.5">
                    <Label>{fl.minGrossMargin}</Label>
                    <div className="flex h-9 items-center rounded-md border border-amber-200 bg-white px-3 text-sm font-medium text-amber-700">
                      {(((Number(form.minSellPrice) - Number(form.costPrice)) / Number(form.minSellPrice)) * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {canSeeCost && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg bg-red-50/60 border border-red-100 p-3">
                <div className="col-span-3 text-xs font-medium text-red-700 mb-1">{fl.financeLevel}</div>
                <div className="space-y-1.5">
                  <Label>{fl.costPrice}</Label>
                  <Input type="number" value={form.costPrice} onChange={e => set('costPrice', e.target.value)}
                    placeholder="0" min={0} step={0.01} />
                </div>
                <div className="space-y-1.5">
                  <Label>{fl.floorPrice}</Label>
                  <Input type="number" value={form.floorPrice} onChange={e => set('floorPrice', e.target.value)}
                    placeholder="0" min={0} step={0.01} />
                </div>
                <div className="space-y-1.5">
                  <Label>{fl.grossMargin}</Label>
                  <div className="flex h-9 items-center rounded-md border border-red-200 bg-white px-3 text-sm font-medium">
                    {margin !== null
                      ? <span className={Number(margin) >= 0 ? 'text-green-600' : 'text-red-600'}>{margin}%</span>
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{fl.oemBasePrice}</Label>
                  <Input type="number" value={form.oemBasePrice} onChange={e => set('oemBasePrice', e.target.value)}
                    placeholder="0" min={0} step={0.01} />
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* 物流資訊 */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionLogistics}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{fl.weight}</Label>
                <Input type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="1.200" min={0} step={0.001} />
              </div>
              <div className="space-y-1.5">
                <Label>{fl.volume}</Label>
                <Input value={form.volume} onChange={e => set('volume', e.target.value)} placeholder="30x20x15 cm" />
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>{fl.storageNotes}</Label>
                <Input value={form.storageNotes} onChange={e => set('storageNotes', e.target.value)} placeholder={fl.storageNotesPlaceholder} />
              </div>
            </div>
          </section>

          <Separator />

          {/* 庫存設定 */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionInventorySettings}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{fl.safetyStock}</Label>
                <Input type="number" value={form.safetyStock} onChange={e => set('safetyStock', e.target.value)} placeholder="0" min={0} />
              </div>
              {!isEdit ? (
                <div className="space-y-1.5">
                  <Label>{fl.initialStock}</Label>
                  <Input type="number" value={form.initialStock} onChange={e => set('initialStock', e.target.value)} placeholder="0" min={0} />
                </div>
              ) : inv && (
                <div className="space-y-1.5">
                  <Label>{fl.currentStock}</Label>
                  <div className="flex h-9 items-center rounded-md border border-input bg-slate-50 px-3 text-sm">
                    {inv.quantity} {form.unit}
                  </div>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* 商品描述 */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionDescription}</p>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder={fl.descriptionPlaceholder}
            />
          </section>

          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{fl.productStatus}</p>
                <p className="text-xs text-muted-foreground">{fl.productStatusDesc}</p>
              </div>
              <button type="button" onClick={() => set('isActive', !form.isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{fl.cancel}</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? fl.saveChanges : fl.newProduct}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
