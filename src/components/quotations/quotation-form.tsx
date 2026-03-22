'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'

interface Customer {
  id: string
  code: string
  name: string
}

interface Product {
  id: string
  sku: string
  name: string
  unit: string
  sellingPrice: string
}

interface LineItem {
  productId: string
  productName: string
  productSku: string
  unit: string
  quantity: number
  unitPrice: number
  discount: number
}

interface QuotationItem {
  productId: string
  quantity: number
  unitPrice: number
  discount: number
  product: { sku: string; name: string; unit: string; sellingPrice: string }
}

interface Quotation {
  id: string
  customerId: string
  validUntil: string | null
  notes: string | null
  items: QuotationItem[]
}

interface QuotationFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  quotation?: Quotation | null
}

const emptyItem = (): LineItem => ({
  productId: '',
  productName: '',
  productSku: '',
  unit: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
})

export function QuotationForm({ open, onClose, onSuccess, quotation }: QuotationFormProps) {
  const isEdit = !!quotation

  const [customerId, setCustomerId] = useState(quotation?.customerId ?? '')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerList, setShowCustomerList] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null)

  const [validUntil, setValidUntil] = useState(
    quotation?.validUntil ? quotation.validUntil.slice(0, 10) : ''
  )
  const [notes, setNotes] = useState(quotation?.notes ?? '')
  const [items, setItems] = useState<LineItem[]>(
    quotation?.items?.map((i) => ({
      productId: i.productId,
      productName: i.product.name,
      productSku: i.product.sku,
      unit: i.product.unit,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      discount: Number(i.discount),
    })) ?? [emptyItem()]
  )
  const [loading, setLoading] = useState(false)

  // 開關時初始化/清除狀態
  useEffect(() => {
    if (!open) {
      setCustomerId(quotation?.customerId ?? '')
      setCustomerSearch('')
      setSelectedCustomer(null)
      setShowCustomerList(false)
      setActiveItemIndex(null)
      setProductSearch('')
      setValidUntil(quotation?.validUntil ? quotation.validUntil.slice(0, 10) : '')
      setNotes(quotation?.notes ?? '')
      setItems(quotation?.items?.map((i) => ({
        productId: i.productId, productName: i.product.name, productSku: i.product.sku,
        unit: i.product.unit, quantity: i.quantity, unitPrice: Number(i.unitPrice), discount: Number(i.discount),
      })) ?? [emptyItem()])
      return
    }
    fetch('/api/customers').then((r) => r.json()).then(setCustomers)
  }, [open])

  // 載入商品列表
  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams()
    if (productSearch) params.set('search', productSearch)
    const timer = setTimeout(() => {
      fetch(`/api/products?${params}`)
        .then((r) => r.json())
        .then(setProducts)
    }, 200)
    return () => clearTimeout(timer)
  }, [open, productSearch])

  // 編輯時載入客戶資訊
  useEffect(() => {
    if (quotation?.customerId && customers.length > 0) {
      const c = customers.find((c) => c.id === quotation.customerId)
      if (c) {
        setSelectedCustomer(c)
        setCustomerId(c.id)
      }
    }
  }, [quotation, customers])

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.code.toLowerCase().includes(customerSearch.toLowerCase())
  )

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c)
    setCustomerId(c.id)
    setShowCustomerList(false)
    setCustomerSearch('')
  }

  function selectProduct(product: Product, index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              productId: product.id,
              productName: product.name,
              productSku: product.sku,
              unit: product.unit,
              unitPrice: Number(product.sellingPrice),
            }
          : item
      )
    )
    setActiveItemIndex(null)
    setProductSearch('')
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount / 100),
    0
  )

  function formatCurrency(val: number) {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(val)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) { toast.error('請選擇客戶'); return }
    if (items.length === 0) { toast.error('至少需要一項商品'); return }
    if (items.some((i) => !i.productId)) { toast.error('請選擇所有明細的商品'); return }
    if (items.some((i) => i.quantity <= 0)) { toast.error('商品數量必須大於 0'); return }
    if (items.some((i) => i.unitPrice <= 0)) { toast.error('商品單價必須大於 0'); return }

    setLoading(true)
    const url = isEdit ? `/api/quotations/${quotation.id}` : '/api/quotations'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, validUntil: validUntil || null, notes, items }),
    })

    setLoading(false)
    if (res.ok) {
      toast.success(isEdit ? '報價單已更新' : '報價單建立成功')
      onSuccess()
      onClose()
    } else {
      const data = await res.json()
      toast.error(data.error ?? '操作失敗')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯報價單' : '新增報價單'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 客戶與基本資訊 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>客戶 <span className="text-red-500">*</span></Label>
              <div className="relative">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
                    <div>
                      <span className="text-sm font-medium">{selectedCustomer.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{selectedCustomer.code}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedCustomer(null); setCustomerId('') }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      更換
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="搜尋客戶名稱或代碼..."
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerList(true) }}
                      onFocus={() => setShowCustomerList(true)}
                    />
                    {showCustomerList && filteredCustomers.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
                        {filteredCustomers.slice(0, 6).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                            onClick={() => selectCustomer(c)}
                          >
                            <span>{c.name}</span>
                            <span className="text-xs text-muted-foreground">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>報價有效期限</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <Separator />

          {/* 商品明細 */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">商品明細</p>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                新增明細
              </Button>
            </div>

            {/* 商品選擇器 */}
            {activeItemIndex !== null && (
              <div className="mb-3 rounded-lg border bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-8 bg-white"
                    placeholder="搜尋商品名稱或 SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setActiveItemIndex(null); setProductSearch('') }}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    關閉
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {products.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white flex items-center justify-between"
                      onClick={() => selectProduct(p, activeItemIndex)}
                    >
                      <div>
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground font-mono">{p.sku}</span>
                      </div>
                      <span className="text-sm font-medium">
                        {new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(p.sellingPrice))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 明細表格 */}
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '700px' }}>
                <colgroup>
                  <col style={{ width: '36px' }} />
                  <col />
                  <col style={{ width: '88px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '36px' }} />
                </colgroup>
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">商品</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">數量</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">單價（元）</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">折扣%</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">小計</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, index) => {
                    const subtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
                    return (
                      <tr key={index} className="group">
                        <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                        <td className="px-3 py-2">
                          {item.productId ? (
                            <div>
                              <button
                                type="button"
                                className="text-left hover:underline"
                                onClick={() => setActiveItemIndex(index)}
                              >
                                <span className="font-medium">{item.productName}</span>
                              </button>
                              <div className="text-xs text-muted-foreground">
                                {item.productSku} · {item.unit}
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveItemIndex(index)}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              + 選擇商品
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            className="h-8 w-full"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            min={1}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            className="h-8 w-full"
                            value={item.unitPrice === 0 ? '' : item.unitPrice}
                            placeholder="0"
                            onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))}
                            min={0}
                            step={1}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            className="h-8 w-full"
                            value={item.discount === 0 ? '' : item.discount}
                            placeholder="0"
                            onChange={(e) => updateItem(index, 'discount', Number(e.target.value))}
                            min={0}
                            max={100}
                            step={0.1}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {formatCurrency(subtotal)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-right font-medium text-sm">合計</td>
                    <td className="px-3 py-2.5 text-right font-bold text-base tabular-nums">
                      {formatCurrency(totalAmount)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <Separator />

          {/* 備註 */}
          <div className="space-y-1.5">
            <Label>備註</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="報價備註事項..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? '儲存變更' : '建立報價單'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
