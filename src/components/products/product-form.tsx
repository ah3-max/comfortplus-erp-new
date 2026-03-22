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

const categories    = ['紙尿布', '護墊', '清潔用品', '護理用品', '防護用品', '輔具', '其他']
const units         = ['包', '盒', '件', '個', '捲', '瓶', '袋']
const seriesOptions = ['經濟款', '日間型', '夜間型', '透氣型', 'OEM']
const sizeOptions   = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '均一']
const packagingOptions = ['單包', '箱', 'OEM專版', '補充包']

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
  specification: '', unit: '包', barcode: '',
  costPrice: '', floorPrice: '',
  sellingPrice: '', channelPrice: '', wholesalePrice: '',
  minSellPrice: '', oemBasePrice: '',
  weight: '', volume: '', storageNotes: '',
  description: '', safetyStock: '0', initialStock: '0',
  isActive: true,
})

function toStr(v: string | number | null | undefined) { return v != null ? String(v) : '' }

export function ProductForm({ open, onClose, onSuccess, product }: ProductFormProps) {
  const { data: session } = useSession()
  const role    = (session?.user?.role as string) ?? ''
  const isEdit  = !!product
  const inv     = product?.inventory?.[0]

  const canSeeCost    = CAN_SEE_COST.includes(role)
  const canSeeManager = CAN_SEE_MANAGER.includes(role)

  const [form, setForm] = useState<FormData>(emptyForm())
  const [loading, setLoading] = useState(false)

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
      toast.error('請填寫必填欄位（SKU、名稱、分類、建議售價）')
      return
    }
    if (canSeeCost && !form.costPrice) {
      toast.error('請填寫成本價')
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
      toast.success(isEdit ? '商品資料已更新' : '商品新增成功')
      onSuccess(); onClose()
    } else {
      const data = await res.json()
      toast.error(data.error ?? '操作失敗')
    }
  }

  const margin = form.costPrice && form.sellingPrice
    ? (((Number(form.sellingPrice) - Number(form.costPrice)) / Number(form.sellingPrice)) * 100).toFixed(1)
    : null

  const sel = (field: keyof FormData, options: string[], placeholder = '請選擇') => (
    <select
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={form[field] as string}
      onChange={e => set(field, e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯商品' : '新增商品'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── 基本資料 ──────────────────────────────────── */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">基本資料</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>SKU <span className="text-red-500">*</span></Label>
                <Input value={form.sku} onChange={e => set('sku', e.target.value)}
                  placeholder="ADL-M-001" disabled={isEdit} required />
              </div>
              <div className="space-y-1.5">
                <Label>條碼</Label>
                <Input value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="4711234567890" />
              </div>
              <div className="space-y-1.5">
                <Label>分類 <span className="text-red-500">*</span></Label>
                {sel('category', categories, '選擇分類')}
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>商品名稱 <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="成人紙尿布 M 號 20 片裝" required />
              </div>
              <div className="space-y-1.5">
                <Label>系列</Label>
                {sel('series', seriesOptions)}
              </div>
              <div className="space-y-1.5">
                <Label>尺寸</Label>
                {sel('size', sizeOptions)}
              </div>
              <div className="space-y-1.5">
                <Label>包裝型態</Label>
                {sel('packagingType', packagingOptions)}
              </div>
              <div className="space-y-1.5">
                <Label>規格說明</Label>
                <Input value={form.specification} onChange={e => set('specification', e.target.value)} placeholder="M / 60-90cm" />
              </div>
              <div className="space-y-1.5">
                <Label>單位</Label>
                {sel('unit', units)}
              </div>
              <div className="space-y-1.5">
                <Label>每包片數</Label>
                <Input type="number" value={form.piecesPerPack} onChange={e => set('piecesPerPack', e.target.value)} placeholder="20" min={1} />
              </div>
              <div className="space-y-1.5">
                <Label>每箱包數</Label>
                <Input type="number" value={form.packsPerBox} onChange={e => set('packsPerBox', e.target.value)} placeholder="6" min={1} />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── 價格設定 ──────────────────────────────────── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">價格設定</p>
              {!canSeeCost && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600 border border-amber-200">
                  <Lock className="h-3 w-3" />部分價格已隱藏
                </span>
              )}
            </div>

            {/* 一般價格（全員可見） */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>建議售價（元）<span className="text-red-500">*</span></Label>
                <Input type="number" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)}
                  placeholder="0" min={0} step={0.01} required />
              </div>
              <div className="space-y-1.5">
                <Label>通路價（元）</Label>
                <Input type="number" value={form.channelPrice} onChange={e => set('channelPrice', e.target.value)}
                  placeholder="0" min={0} step={0.01} />
              </div>
              <div className="space-y-1.5">
                <Label>批發價（元）</Label>
                <Input type="number" value={form.wholesalePrice} onChange={e => set('wholesalePrice', e.target.value)}
                  placeholder="0" min={0} step={0.01} />
              </div>
            </div>

            {/* 業務主管以上可見 */}
            {canSeeManager && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg bg-amber-50/60 border border-amber-100 p-3">
                <div className="col-span-3 text-xs font-medium text-amber-700 mb-1">業務主管層級</div>
                <div className="space-y-1.5">
                  <Label>最低可售價（元）</Label>
                  <Input type="number" value={form.minSellPrice} onChange={e => set('minSellPrice', e.target.value)}
                    placeholder="0" min={0} step={0.01} />
                </div>
                {canSeeCost && form.sellingPrice && form.minSellPrice && (
                  <div className="space-y-1.5">
                    <Label>最低毛利率</Label>
                    <div className="flex h-9 items-center rounded-md border border-amber-200 bg-white px-3 text-sm font-medium text-amber-700">
                      {(((Number(form.minSellPrice) - Number(form.costPrice)) / Number(form.minSellPrice)) * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 財務/採購層級 */}
            {canSeeCost && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg bg-red-50/60 border border-red-100 p-3">
                <div className="col-span-3 text-xs font-medium text-red-700 mb-1">財務／採購層級（機密）</div>
                <div className="space-y-1.5">
                  <Label>成本價（元）<span className="text-red-500">*</span></Label>
                  <Input type="number" value={form.costPrice} onChange={e => set('costPrice', e.target.value)}
                    placeholder="0" min={0} step={0.01} />
                </div>
                <div className="space-y-1.5">
                  <Label>成本底價（元）</Label>
                  <Input type="number" value={form.floorPrice} onChange={e => set('floorPrice', e.target.value)}
                    placeholder="0" min={0} step={0.01} />
                </div>
                <div className="space-y-1.5">
                  <Label>毛利率（建議售價）</Label>
                  <div className="flex h-9 items-center rounded-md border border-red-200 bg-white px-3 text-sm font-medium">
                    {margin !== null
                      ? <span className={Number(margin) >= 0 ? 'text-green-600' : 'text-red-600'}>{margin}%</span>
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>OEM 報價基準（元）</Label>
                  <Input type="number" value={form.oemBasePrice} onChange={e => set('oemBasePrice', e.target.value)}
                    placeholder="0" min={0} step={0.01} />
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* ── 物流資訊 ──────────────────────────────────── */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">物流資訊</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>重量（kg）</Label>
                <Input type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="1.200" min={0} step={0.001} />
              </div>
              <div className="space-y-1.5">
                <Label>材積</Label>
                <Input value={form.volume} onChange={e => set('volume', e.target.value)} placeholder="30x20x15 cm" />
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>保存／倉儲注意事項</Label>
                <Input value={form.storageNotes} onChange={e => set('storageNotes', e.target.value)} placeholder="避免潮濕、直射日光，請平放保存" />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── 庫存設定 ──────────────────────────────────── */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">庫存設定</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>安全庫存量</Label>
                <Input type="number" value={form.safetyStock} onChange={e => set('safetyStock', e.target.value)} placeholder="0" min={0} />
              </div>
              {!isEdit ? (
                <div className="space-y-1.5">
                  <Label>初始庫存量</Label>
                  <Input type="number" value={form.initialStock} onChange={e => set('initialStock', e.target.value)} placeholder="0" min={0} />
                </div>
              ) : inv && (
                <div className="space-y-1.5">
                  <Label>目前庫存</Label>
                  <div className="flex h-9 items-center rounded-md border border-input bg-slate-50 px-3 text-sm">
                    {inv.quantity} {form.unit}
                  </div>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* ── 商品描述 ──────────────────────────────────── */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">商品描述</p>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="商品特色、適用對象、使用說明..."
            />
          </section>

          {/* 停售切換（編輯模式） */}
          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium">商品狀態</p>
                <p className="text-xs text-muted-foreground">停售後商品不會出現在報價/訂單選品清單</p>
              </div>
              <button type="button" onClick={() => set('isActive', !form.isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>取消</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? '儲存變更' : '新增商品'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
