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

// Static carriers (not translated — these are proper nouns)
const carriers = ['（自行配送）', '黑貓宅急便', '宅配通', '新竹物流', '嘉里大榮', '順豐速運', '其他']

export function ShipmentForm({ open, onClose, onSuccess, preselectedOrderId }: ShipmentFormProps) {
  const { dict } = useI18n()
  const fl = dict.formLabels

  const deliveryMethods = [
    { value: 'OWN_FLEET',    label: fl.deliveryOwnFleet },
    { value: 'EXPRESS',      label: fl.deliveryExpress },
    { value: 'FREIGHT',      label: fl.deliveryFreight },
    { value: 'SELF_PICKUP',  label: fl.deliverySelfPickup },
  ]

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
          <DialogTitle>{fl.createShipment}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 訂單選擇 */}
          <div className="space-y-1.5">
            <Label>{fl.shipmentOrder}</Label>
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
                    {fl.changeOrder}
                  </button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {selectedOrder.items.length} {fl.productCount}
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder={fl.searchOrderPlaceholder}
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
                      <div className="px-3 py-2 text-sm text-muted-foreground">{fl.noShippableOrders}</div>
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
                <p className="mb-3 text-sm font-medium text-muted-foreground">{fl.shipmentItems}</p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">{fl.colProduct}</th>
                        <th className="px-3 py-2 text-center font-medium text-muted-foreground w-20">{fl.colOrdered}</th>
                        <th className="px-3 py-2 text-center font-medium text-muted-foreground w-20">{fl.colShipped}</th>
                        <th className="px-3 py-2 text-center font-medium text-muted-foreground w-24">{fl.colThisShipment}</th>
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
                                {fl.maxQtyPrefix} {remaining}
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
                    {fl.setShipQtyWarning}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* 配送方式 */}
          <div>
            <p className="mb-3 text-sm font-medium text-muted-foreground">{fl.deliveryMethodLabel}</p>
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
                    <Label>{fl.carrier}</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                    >
                      <option value="">{fl.selectCarrier}</option>
                      {carriers.filter(c => !c.startsWith('（')).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{fl.trackingNo}</Label>
                    <Input value={trackingNo}
                      onChange={(e) => setTrackingNo(e.target.value)}
                      placeholder={fl.trackingNoPlaceholder} />
                  </div>
                </>
              )}
              <div className="col-span-2 space-y-1.5">
                <Label>{fl.deliveryAddress}</Label>
                <Input value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={fl.deliveryAddressPlaceholder} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{fl.notes}</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={fl.shipmentNotesPlaceholder} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{fl.cancel}</Button>
            <Button type="submit" disabled={loading || !selectedOrder || totalItems === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {fl.createShipment}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
