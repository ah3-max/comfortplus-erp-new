'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Loader2, Plus, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

export const purchaseTypeOptions = [
  { value: 'FINISHED_GOODS',     label: '成品採購' },
  { value: 'OEM',                label: 'OEM代工採購' },
  { value: 'PACKAGING',          label: '包材採購' },
  { value: 'RAW_MATERIAL',       label: '原物料採購' },
  { value: 'GIFT_PROMO',         label: '贈品/活動物料' },
  { value: 'LOGISTICS_SUPPLIES', label: '物流耗材採購' },
]

interface Supplier { id: string; code: string; name: string }
interface Product  { id: string; sku: string; name: string; unit: string; costPrice: string }

interface LineItem {
  productId: string; productName: string; productSku: string; unit: string
  quantity: number; unitCost: number
}
interface PurchaseItem {
  productId: string; quantity: number; unitCost: string; receivedQty: number
  product: { sku: string; name: string; unit: string }
}
interface PurchaseOrder {
  id: string; supplierId: string; orderType?: string
  specVersion?: string | null; taxRate?: string | null; taxAmount?: string | null
  inspectionCriteria?: string | null; warehouse?: string | null; projectNo?: string | null
  expectedDate: string | null; notes: string | null; items: PurchaseItem[]
  // OEM
  oemProjectNo?: string | null; factory?: string | null
  sampleVersion?: string | null; packagingVersion?: string | null; productionBatch?: string | null
  inspectionRequirements?: string | null; shippingLabelRequirements?: string | null; customNotes?: string | null
}

interface Props {
  open: boolean; onClose: () => void; onSuccess: () => void
  order?: PurchaseOrder | null
}

const emptyItem = (): LineItem => ({
  productId: '', productName: '', productSku: '', unit: '', quantity: 1, unitCost: 0,
})

export function PurchaseForm({ open, onClose, onSuccess, order }: Props) {
  const { dict } = useI18n()
  const isEdit = !!order

  const [supplierId, setSupplierId]               = useState('')
  const [supplierSearch, setSupplierSearch]       = useState('')
  const [suppliers, setSuppliers]                 = useState<Supplier[]>([])
  const [selectedSupplier, setSelectedSupplier]   = useState<Supplier | null>(null)
  const [showSupplierList, setShowSupplierList]   = useState(false)

  const [orderType, setOrderType]                 = useState('FINISHED_GOODS')
  const [specVersion, setSpecVersion]             = useState('')
  const [taxRate, setTaxRate]                     = useState('')
  const [inspectionCriteria, setInspectionCriteria] = useState('')
  const [warehouse, setWarehouse]                 = useState('')
  const [projectNo, setProjectNo]                 = useState('')
  const [expectedDate, setExpectedDate]           = useState('')
  const [notes, setNotes]                         = useState('')
  const [showAdvanced, setShowAdvanced]           = useState(false)
  // OEM fields
  const [oemProjectNo, setOemProjectNo]                       = useState('')
  const [factory, setFactory]                                 = useState('')
  const [sampleVersion, setSampleVersion]                     = useState('')
  const [packagingVersion, setPackagingVersion]               = useState('')
  const [productionBatch, setProductionBatch]                 = useState('')
  const [inspectionReq, setInspectionReq]                     = useState('')
  const [shippingLabelReq, setShippingLabelReq]               = useState('')
  const [customNotes, setCustomNotes]                         = useState('')

  const [products, setProducts]                   = useState<Product[]>([])
  const [productSearch, setProductSearch]         = useState('')
  const [activeItemIndex, setActiveItemIndex]     = useState<number | null>(null)
  const [items, setItems]                         = useState<LineItem[]>([emptyItem()])
  const [loading, setLoading]                     = useState(false)

  function resetOemFields(o?: PurchaseOrder | null) {
    setOemProjectNo(o?.oemProjectNo ?? '')
    setFactory(o?.factory ?? '')
    setSampleVersion(o?.sampleVersion ?? '')
    setPackagingVersion(o?.packagingVersion ?? '')
    setProductionBatch(o?.productionBatch ?? '')
    setInspectionReq(o?.inspectionRequirements ?? '')
    setShippingLabelReq(o?.shippingLabelRequirements ?? '')
    setCustomNotes(o?.customNotes ?? '')
  }

  // 開關重置
  useEffect(() => {
    if (!open) {
      setSupplierId(''); setSupplierSearch(''); setSelectedSupplier(null)
      setShowSupplierList(false); setActiveItemIndex(null); setProductSearch('')
      setOrderType(order?.orderType ?? 'FINISHED_GOODS')
      setSpecVersion(order?.specVersion ?? '')
      setTaxRate(order?.taxRate ?? '')
      setInspectionCriteria(order?.inspectionCriteria ?? '')
      setWarehouse(order?.warehouse ?? '')
      setProjectNo(order?.projectNo ?? '')
      setExpectedDate(order?.expectedDate ? order.expectedDate.slice(0, 10) : '')
      setNotes(order?.notes ?? '')
      resetOemFields(order)
      setItems(order?.items?.map(i => ({
        productId: i.productId, productName: i.product.name,
        productSku: i.product.sku, unit: i.product.unit,
        quantity: i.quantity, unitCost: Number(i.unitCost),
      })) ?? [emptyItem()])
      return
    }
    fetch('/api/suppliers').then(r => r.json()).then(setSuppliers)
    if (order) {
      setOrderType(order.orderType ?? 'FINISHED_GOODS')
      setSpecVersion(order.specVersion ?? '')
      setTaxRate(order.taxRate ?? '')
      setInspectionCriteria(order.inspectionCriteria ?? '')
      resetOemFields(order)
      setWarehouse(order.warehouse ?? '')
      setProjectNo(order.projectNo ?? '')
      setExpectedDate(order.expectedDate ? order.expectedDate.slice(0, 10) : '')
      setNotes(order.notes ?? '')
      setItems(order.items?.map(i => ({
        productId: i.productId, productName: i.product.name,
        productSku: i.product.sku, unit: i.product.unit,
        quantity: i.quantity, unitCost: Number(i.unitCost),
      })) ?? [emptyItem()])
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams()
    if (productSearch) params.set('search', productSearch)
    const t = setTimeout(() => {
      fetch(`/api/products?${params}`).then(r => r.json()).then(setProducts)
    }, 200)
    return () => clearTimeout(t)
  }, [open, productSearch])

  useEffect(() => {
    if (order?.supplierId && suppliers.length > 0) {
      const s = suppliers.find(s => s.id === order.supplierId)
      if (s) { setSelectedSupplier(s); setSupplierId(s.id) }
    }
  }, [order, suppliers])

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  function selectSupplier(s: Supplier) {
    setSelectedSupplier(s); setSupplierId(s.id)
    setShowSupplierList(false); setSupplierSearch('')
  }

  function selectProduct(p: Product, idx: number) {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, productId: p.id, productName: p.name, productSku: p.sku, unit: p.unit, unitCost: Number(p.costPrice) } : item
    ))
    setActiveItemIndex(null); setProductSearch('')
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)
  const taxAmount  = taxRate ? itemsTotal * Number(taxRate) / 100 : 0
  const totalAmount = itemsTotal + taxAmount

  function fmt(n: number) {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId)                          { toast.error(dict.forms.selectSupplier); return }
    if (items.some(i => !i.productId))        { toast.error(dict.forms.selectAllProducts); return }
    if (items.some(i => i.quantity <= 0))     { toast.error(dict.forms.quantityPositive); return }
    if (items.some(i => i.unitCost <= 0))     { toast.error(dict.forms.purchasePricePositive); return }

    setLoading(true)
    const url    = isEdit ? `/api/purchases/${order!.id}` : '/api/purchases'
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId, orderType,
        specVersion:        specVersion        || null,
        taxRate:            taxRate            || null,
        taxAmount:          taxRate ? taxAmount : null,
        inspectionCriteria: inspectionCriteria || null,
        warehouse:          warehouse          || null,
        projectNo:          projectNo          || null,
        expectedDate:       expectedDate       || null,
        notes:              notes              || null,
        // OEM
        oemProjectNo:              oemProjectNo    || null,
        factory:                   factory         || null,
        sampleVersion:             sampleVersion   || null,
        packagingVersion:          packagingVersion || null,
        productionBatch:           productionBatch  || null,
        inspectionRequirements:    inspectionReq   || null,
        shippingLabelRequirements: shippingLabelReq || null,
        customNotes:               customNotes      || null,
        items,
      }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success(isEdit ? dict.forms.purchaseUpdated : dict.forms.purchaseCreated)
      onSuccess(); onClose()
    } else {
      const data = await res.json()
      toast.error(data.error ?? dict.common.operationFailed)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯採購單' : '新增採購單'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* 供應商 + 採購類型 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>供應商 <span className="text-red-500">*</span></Label>
              {selectedSupplier ? (
                <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{selectedSupplier.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{selectedSupplier.code}</span>
                  </div>
                  <button type="button" onClick={() => { setSelectedSupplier(null); setSupplierId('') }}
                    className="text-xs text-muted-foreground hover:text-foreground">更換</button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="搜尋供應商..."
                    value={supplierSearch}
                    onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierList(true) }}
                    onFocus={() => setShowSupplierList(true)} />
                  {showSupplierList && filteredSuppliers.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
                      {filteredSuppliers.slice(0, 6).map(s => (
                        <button key={s.id} type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex justify-between"
                          onClick={() => selectSupplier(s)}>
                          <span>{s.name}</span>
                          <span className="text-xs text-muted-foreground">{s.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>採購類型</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                {purchaseTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* 日期 + 專案 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>預計到貨/交期</Label>
              <Input type="date" value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>收貨倉庫</Label>
              <Input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} placeholder="主倉 / 台北倉..." />
            </div>
            <div className="space-y-1.5">
              <Label>專案號</Label>
              <Input value={projectNo} onChange={(e) => setProjectNo(e.target.value)} placeholder="PROJECT-2026-001" />
            </div>
          </div>

          {/* 進階欄位 (折疊) */}
          <div className="rounded-lg border border-slate-200">
            <button type="button"
              onClick={() => setShowAdvanced(p => !p)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
              <span>進階欄位（規格版本、稅額、驗收標準）</span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showAdvanced && (
              <div className="border-t px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>規格版本</Label>
                  <Input value={specVersion} onChange={(e) => setSpecVersion(e.target.value)} placeholder="v1.0 / Rev.A..." />
                </div>
                <div className="space-y-1.5">
                  <Label>稅率（%）</Label>
                  <div className="relative">
                    <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                      placeholder="0" min={0} max={100} step={0.01} className="pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>驗收標準</Label>
                  <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={2} value={inspectionCriteria} onChange={(e) => setInspectionCriteria(e.target.value)}
                    placeholder="外觀檢驗、尺寸規格、功能測試要求..." />
                </div>
              </div>
            )}
          </div>

          {/* OEM 專屬欄位 */}
          {orderType === 'OEM' && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">OEM 代工資訊</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>OEM 專案號</Label>
                  <Input value={oemProjectNo} onChange={e => setOemProjectNo(e.target.value)} placeholder="OEM-2026-001" />
                </div>
                <div className="space-y-1.5">
                  <Label>對應工廠</Label>
                  <Input value={factory} onChange={e => setFactory(e.target.value)} placeholder="工廠名稱" />
                </div>
                <div className="space-y-1.5">
                  <Label>打樣版本</Label>
                  <Input value={sampleVersion} onChange={e => setSampleVersion(e.target.value)} placeholder="S1 / S2 / Rev.A..." />
                </div>
                <div className="space-y-1.5">
                  <Label>包材版本</Label>
                  <Input value={packagingVersion} onChange={e => setPackagingVersion(e.target.value)} placeholder="PKG-v1.0 / v2..." />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>生產批次</Label>
                  <Input value={productionBatch} onChange={e => setProductionBatch(e.target.value)} placeholder="BATCH-2026-03-A" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>驗貨要求</Label>
                  <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={2} value={inspectionReq} onChange={e => setInspectionReq(e.target.value)}
                    placeholder="外觀抽樣比例、功能測試項目、AQL標準..." />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>出貨標籤要求</Label>
                  <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={2} value={shippingLabelReq} onChange={e => setShippingLabelReq(e.target.value)}
                    placeholder="標籤規格、條碼型式、中文標示要求..." />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>客製備註</Label>
                  <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={2} value={customNotes} onChange={e => setCustomNotes(e.target.value)}
                    placeholder="特殊要求、客戶指定事項..." />
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* 商品明細 */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">採購明細</p>
              <Button type="button" variant="outline" size="sm"
                onClick={() => setItems(p => [...p, emptyItem()])}>
                <Plus className="mr-1 h-3.5 w-3.5" />新增明細
              </Button>
            </div>

            {activeItemIndex !== null && (
              <div className="mb-3 rounded-lg border bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input className="h-8 bg-white" placeholder="搜尋商品名稱或 SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)} autoFocus />
                  <button type="button" onClick={() => { setActiveItemIndex(null); setProductSearch('') }}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0">關閉</button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {products.slice(0, 10).map(p => (
                    <button key={p.id} type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white flex justify-between"
                      onClick={() => selectProduct(p, activeItemIndex)}>
                      <div>
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground font-mono">{p.sku}</span>
                      </div>
                      <span className="text-sm">{fmt(Number(p.costPrice))}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">商品</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">採購數量</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">採購單價</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">小計</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, idx) => (
                    <tr key={idx} className="group">
                      <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                      <td className="px-3 py-2">
                        {item.productId ? (
                          <div>
                            <button type="button" className="text-left hover:underline"
                              onClick={() => setActiveItemIndex(idx)}>
                              <span className="font-medium">{item.productName}</span>
                            </button>
                            <div className="text-xs text-muted-foreground">{item.productSku} · {item.unit}</div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setActiveItemIndex(idx)}
                            className="text-blue-600 hover:text-blue-700 text-sm">+ 選擇商品</button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" className="h-8 w-full text-right"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} min={1} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" className="h-8 w-full text-right"
                          value={item.unitCost}
                          onChange={(e) => updateItem(idx, 'unitCost', Number(e.target.value))} min={0} step={0.01} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(item.quantity * item.unitCost)}</td>
                      <td className="px-3 py-2">
                        <button type="button"
                          onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t">
                  {taxRate && Number(taxRate) > 0 && (
                    <>
                      <tr>
                        <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-muted-foreground">小計</td>
                        <td className="px-3 py-1.5 text-right text-sm">{fmt(itemsTotal)}</td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-muted-foreground">稅額 ({taxRate}%)</td>
                        <td className="px-3 py-1.5 text-right text-sm">{fmt(taxAmount)}</td>
                        <td />
                      </tr>
                    </>
                  )}
                  <tr>
                    <td colSpan={4} className="px-3 py-2.5 text-right font-medium text-sm">採購總額</td>
                    <td className="px-3 py-2.5 text-right font-bold text-base">{fmt(totalAmount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>備註</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="採購備註..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>取消</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? '儲存變更' : '建立採購單'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
