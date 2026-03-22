'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Loader2, Plus, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'

interface Customer { id: string; code: string; name: string }
interface Product {
  id: string; sku: string; name: string; unit: string; sellingPrice: string
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

interface OrderItem {
  productId: string
  quantity: number
  unitPrice: number
  discount: number
  product: { sku: string; name: string; unit: string; sellingPrice: string }
}

interface Order {
  id: string
  customerId: string
  expectedShipDate: string | null
  notes: string | null
  items: OrderItem[]
}

interface OrderFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  order?: Order | null
}

const emptyItem = (): LineItem => ({
  productId: '', productName: '', productSku: '', unit: '',
  quantity: 1, unitPrice: 0, discount: 0,
})

export function OrderForm({ open, onClose, onSuccess, order }: OrderFormProps) {
  const isEdit = !!order

  const [customerId, setCustomerId] = useState(order?.customerId ?? '')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerList, setShowCustomerList] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null)

  const [expectedShipDate, setExpectedShipDate] = useState(
    order?.expectedShipDate ? order.expectedShipDate.slice(0, 10) : ''
  )
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [items, setItems] = useState<LineItem[]>(
    order?.items?.map((i) => ({
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

  useEffect(() => {
    if (!open) {
      setCustomerId(order?.customerId ?? '')
      setCustomerSearch('')
      setSelectedCustomer(null)
      setShowCustomerList(false)
      setActiveItemIndex(null)
      setProductSearch('')
      setExpectedShipDate(order?.expectedShipDate ? order.expectedShipDate.slice(0, 10) : '')
      setNotes(order?.notes ?? '')
      setItems(order?.items?.map((i) => ({
        productId: i.productId, productName: i.product.name, productSku: i.product.sku,
        unit: i.product.unit, quantity: i.quantity, unitPrice: Number(i.unitPrice), discount: Number(i.discount),
      })) ?? [emptyItem()])
      return
    }
    fetch('/api/customers').then((r) => r.json()).then(setCustomers)
  }, [open])

  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams()
    if (productSearch) params.set('search', productSearch)
    const timer = setTimeout(() => {
      fetch(`/api/products?${params}`).then((r) => r.json()).then(setProducts)
    }, 200)
    return () => clearTimeout(timer)
  }, [open, productSearch])

  useEffect(() => {
    if (order?.customerId && customers.length > 0) {
      const c = customers.find((c) => c.id === order.customerId)
      if (c) { setSelectedCustomer(c); setCustomerId(c.id) }
    }
  }, [order, customers])

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.code.toLowerCase().includes(customerSearch.toLowerCase())
  )

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c); setCustomerId(c.id)
    setShowCustomerList(false); setCustomerSearch('')
  }

  function selectProduct(product: Product, index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, productId: product.id, productName: product.name,
              productSku: product.sku, unit: product.unit,
              unitPrice: Number(product.sellingPrice) }
          : item
      )
    )
    setActiveItemIndex(null); setProductSearch('')
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount / 100), 0
  )

  function formatCurrency(val: number) {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(val)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) { toast.error('請選擇客戶'); return }
    if (items.some((i) => !i.productId)) { toast.error('請選擇所有明細的商品'); return }
    if (items.some((i) => i.quantity <= 0)) { toast.error('商品數量必須大於 0'); return }
    if (items.some((i) => i.unitPrice <= 0)) { toast.error('商品單價必須大於 0'); return }

    setLoading(true)
    const url = isEdit ? `/api/orders/${order.id}` : '/api/orders'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, expectedShipDate: expectedShipDate || null, notes, items }),
    })

    setLoading(false)
    if (res.ok) {
      toast.success(isEdit ? '訂單已更新' : '訂單建立成功')
      onSuccess(); onClose()
    } else {
      const data = await res.json()
      toast.error(data.error ?? '操作失敗')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯訂單' : '新增訂單'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 客戶與交期 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>客戶 <span className="text-red-500">*</span></Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{selectedCustomer.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{selectedCustomer.code}</span>
                  </div>
                  <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerId('') }}
                    className="text-xs text-muted-foreground hover:text-foreground">更換</button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="搜尋客戶..."
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerList(true) }}
                    onFocus={() => setShowCustomerList(true)} />
                  {showCustomerList && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
                      {filteredCustomers.slice(0, 6).map((c) => (
                        <button key={c.id} type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                          onClick={() => selectCustomer(c)}>
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>預計出貨日期</Label>
              <Input type="date" value={expectedShipDate}
                onChange={(e) => setExpectedShipDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>

          <Separator />

          {/* 商品明細 */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">商品明細</p>
              <Button type="button" variant="outline" size="sm"
                onClick={() => setItems((p) => [...p, emptyItem()])}>
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
                  {products.slice(0, 10).map((p) => (
                    <button key={p.id} type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white flex items-center justify-between"
                      onClick={() => selectProduct(p, activeItemIndex)}>
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

            {/* Desktop: 表格 */}
            <div className="hidden sm:block rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">商品</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">數量</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">單價</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">折扣%</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">小計</th>
                    <th className="px-3 py-2 w-8" />
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
                              <button type="button" className="text-left hover:underline"
                                onClick={() => setActiveItemIndex(index)}>
                                <span className="font-medium">{item.productName}</span>
                              </button>
                              <div className="text-xs text-muted-foreground">{item.productSku} · {item.unit}</div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setActiveItemIndex(index)}
                              className="text-blue-600 hover:text-blue-700 text-sm">+ 選擇商品</button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" className="h-8 w-full text-right"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))} min={1} />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" className="h-8 w-full text-right"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))} min={0} step={0.01} />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" className="h-8 w-full text-right"
                            value={item.discount}
                            onChange={(e) => updateItem(index, 'discount', Number(e.target.value))} min={0} max={100} step={0.1} />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(subtotal)}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== index))}
                            className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right font-medium text-sm">合計</td>
                    <td className="px-3 py-2 text-right font-bold text-base">{formatCurrency(totalAmount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile: 卡片式明細 */}
            <div className="sm:hidden space-y-3">
              {items.map((item, index) => {
                const subtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
                return (
                  <div key={index} className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {item.productId ? (
                          <button type="button" onClick={() => setActiveItemIndex(index)} className="text-left">
                            <span className="font-medium text-sm">{item.productName}</span>
                            <div className="text-xs text-muted-foreground">{item.productSku} · {item.unit}</div>
                          </button>
                        ) : (
                          <button type="button" onClick={() => setActiveItemIndex(index)}
                            className="text-blue-600 text-sm font-medium py-1">+ 選擇商品</button>
                        )}
                      </div>
                      <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== index))}
                        className="text-muted-foreground hover:text-red-500 p-2 -m-2">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">數量</label>
                        <Input type="number" className="text-center"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))} min={1} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">單價</label>
                        <Input type="number" className="text-center"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))} min={0} step={0.01} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">折扣%</label>
                        <Input type="number" className="text-center"
                          value={item.discount}
                          onChange={(e) => updateItem(index, 'discount', Number(e.target.value))} min={0} max={100} />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1 border-t">
                      <span className="text-sm font-bold">{formatCurrency(subtotal)}</span>
                    </div>
                  </div>
                )
              })}
              {/* 合計 */}
              <div className="rounded-xl bg-slate-50 p-4 flex items-center justify-between">
                <span className="font-medium text-sm">合計</span>
                <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>備註</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="訂單備註..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>取消</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? '儲存變更' : '建立訂單'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
