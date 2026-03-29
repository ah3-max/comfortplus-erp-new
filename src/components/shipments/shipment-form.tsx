'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Loader2, Search, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface OrderItem {
  id: string
  productId: string
  quantity: number
  shippedQty: number
  product: { sku: string; name: string; unit: string }
}

interface Order {
  id: string
  orderNo: string
  customer: { name: string; code: string }
  items: OrderItem[]
}

interface ShipItem {
  productId: string
  productName: string
  productSku: string
  unit: string
  orderedQty: number
  shippedQty: number
  quantity: number
}

interface ShipmentFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  preselectedOrderId?: string
}

const deliveryMethods = [
  { value: 'OWN_FLEET', label: '自行配送（自有車隊）' },
  { value: 'EXPRESS', label: '宅配' },
  { value: 'FREIGHT', label: '貨運' },
  { value: 'SELF_PICKUP', label: '客戶自取' },
]
const carriers = ['（自行配送）', '黑貓宅急便', '宅配通', '新竹物流', '嘉里大榮', '順豐速運', '其他']

export function ShipmentForm({ open, onClose, onSuccess, preselectedOrderId }: ShipmentFormProps) {
  const { dict } = useI18n()
  const [orderSearch, setOrderSearch] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showOrderList, setShowOrderList] = useState(false)

  const [deliveryMethod, setDeliveryMethod] = useState('OWN_FLEET')
  const [carrier, setCarrier] = useState('（自行配送）')
  const [trackingNo, setTrackingNo] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ShipItem[]>([])
  const [loading, setLoading] = useState(false)

  // 關閉時清除所有狀態
  useEffect(() => {
    if (!open) {
      setOrderSearch('')
      setSelectedOrder(null)
      setShowOrderList(false)
      setDeliveryMethod('OWN_FLEET')
      setCarrier('（自行配送）')
      setTrackingNo('')
      setAddress('')
      setNotes('')
      setItems([])
    }
  }, [open])

  // 載入可出貨訂單（CONFIRMED 或 PROCESSING）
  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams()
    if (orderSearch) params.set('search', orderSearch)
    const timer = setTimeout(() => {
      fetch(`/api/orders?${params}`)
        .then((r) => r.json())
        .then((data: Array<Order & { status: string }>) => {
          setOrders(data.filter((o) => ['CONFIRMED', 'PROCESSING'].includes(o.status)))
        })
    }, 200)
    return () => clearTimeout(timer)
  }, [open, orderSearch])

  // 預選訂單
  useEffect(() => {
    if (preselectedOrderId && orders.length > 0) {
      const o = orders.find((o) => o.id === preselectedOrderId)
      if (o) loadOrder(o)
    }
  }, [preselectedOrderId, orders])

  function loadOrder(order: Order) {
    setSelectedOrder(order)
    setShowOrderList(false)
    setOrderSearch('')
    // 建立出貨明細，預帶未出貨數量
    setItems(
      order.items
        .filter((i) => i.quantity > i.shippedQty)
        .map((i) => ({
          productId: i.productId,
          productName: i.product.name,
          productSku: i.product.sku,
          unit: i.product.unit,
          orderedQty: i.quantity,
          shippedQty: i.shippedQty,
          quantity: i.quantity - i.shippedQty,
        }))
    )
  }

  function updateQty(index: number, value: number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const max = item.orderedQty - item.shippedQty
        return { ...item, quantity: Math.min(Math.max(0, value), max) }
      })
    )
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOrder) { toast.error(dict.forms.selectOrder); return }
    const validItems = items.filter((i) => i.quantity > 0)
    if (validItems.length === 0) { toast.error(dict.forms.setShipQty); return }

    setLoading(true)
    const res = await fetch('/api/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: selectedOrder.id,
        deliveryMethod,
        carrier: carrier || null,
        trackingNo: trackingNo || null,
        address: address || null,
        notes: notes || null,
        items: validItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      }),
    })

    setLoading(false)
    if (res.ok) {
      toast.success(dict.forms.shipmentCreated)
      onSuccess()
      onClose()
    } else {
      const data = await res.json()
      toast.error(data.error ?? dict.common.operationFailed)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>建立出貨單</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 訂單選擇 */}
          <div className="space-y-1.5">
            <Label>出貨訂單 <span className="text-red-500">*</span></Label>
            {selectedOrder ? (
              <div className="rounded-lg border border-input bg-background p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm font-medium">{selectedOrder.orderNo}</span>
                    <span className="ml-3 font-medium">{selectedOrder.customer.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{selectedOrder.customer.code}</span>
                  </div>
                  <button type="button"
                    onClick={() => { setSelectedOrder(null); setItems([]) }}
                    className="text-xs text-muted-foreground hover:text-foreground">
                    更換
                  </button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  共 {selectedOrder.items.length} 項商品
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="搜尋訂單號或客戶名稱..."
                  value={orderSearch}
                  onChange={(e) => { setOrderSearch(e.target.value); setShowOrderList(true) }}
                  onFocus={() => setShowOrderList(true)} />
                {showOrderList && orders.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
                    {orders.slice(0, 6).map((o) => (
                      <button key={o.id} type="button"
                        className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                        onClick={() => loadOrder(o)}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium">{o.orderNo}</span>
                          <span className="text-muted-foreground">{o.customer.name}</span>
                        </div>
                      </button>
                    ))}
                    {orders.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">無可出貨訂單</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 出貨明細 */}
          {items.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-3 text-sm font-medium text-muted-foreground">出貨明細</p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">商品</th>
                        <th className="px-3 py-2 text-center font-medium text-muted-foreground w-20">訂購</th>
                        <th className="px-3 py-2 text-center font-medium text-muted-foreground w-20">已出</th>
                        <th className="px-3 py-2 text-center font-medium text-muted-foreground w-24">本次出貨</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item, index) => {
                        const remaining = item.orderedQty - item.shippedQty
                        return (
                          <tr key={item.productId}>
                            <td className="px-3 py-2">
                              <div className="font-medium">{item.productName}</div>
                              <div className="text-xs text-muted-foreground">{item.productSku} · {item.unit}</div>
                            </td>
                            <td className="px-3 py-2 text-center text-muted-foreground">{item.orderedQty}</td>
                            <td className="px-3 py-2 text-center text-muted-foreground">{item.shippedQty}</td>
                            <td className="px-3 py-2">
                              <Input type="number" className="h-8 text-center"
                                value={item.quantity}
                                onChange={(e) => updateQty(index, Number(e.target.value))}
                                min={0} max={remaining} />
                              <div className="mt-0.5 text-center text-xs text-muted-foreground">
                                最多 {remaining}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {totalItems === 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    請設定出貨數量
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* 配送方式 */}
          <div>
            <p className="mb-3 text-sm font-medium text-muted-foreground">配送方式</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {deliveryMethods.map(m => (
                <button key={m.value} type="button"
                  onClick={() => {
                    setDeliveryMethod(m.value)
                    if (m.value === 'OWN_FLEET') setCarrier('（自行配送）')
                    else if (m.value === 'SELF_PICKUP') setCarrier('（客戶自取）')
                    else setCarrier('')
                  }}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.97] ${
                    deliveryMethod === m.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {deliveryMethod !== 'OWN_FLEET' && deliveryMethod !== 'SELF_PICKUP' && (
                <>
                  <div className="space-y-1.5">
                    <Label>物流商</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                    >
                      <option value="">選擇物流商</option>
                      {carriers.filter(c => !c.startsWith('（')).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>追蹤單號</Label>
                    <Input value={trackingNo}
                      onChange={(e) => setTrackingNo(e.target.value)}
                      placeholder="物流追蹤號碼" />
                  </div>
                </>
              )}
              <div className={deliveryMethod !== 'OWN_FLEET' && deliveryMethod !== 'SELF_PICKUP' ? 'col-span-2 space-y-1.5' : 'col-span-2 space-y-1.5'}>
                <Label>收貨地址</Label>
                <Input value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="若與客戶地址不同請填寫" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>備註</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="出貨備註..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>取消</Button>
            <Button type="submit" disabled={loading || !selectedOrder || totalItems === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              建立出貨單
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
