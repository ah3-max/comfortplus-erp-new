'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Truck, Loader2, DollarSign } from 'lucide-react'
import { ShipmentForm } from '@/components/shipments/shipment-form'
import { toast } from 'sonner'

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'
type ShipmentStatus = 'PREPARING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'FAILED'

const orderStatusCls: Record<OrderStatus, string> = {
  PENDING:    'border-slate-300 text-slate-600',
  CONFIRMED:  'bg-blue-100 text-blue-700 border-blue-200',
  PROCESSING: 'bg-amber-100 text-amber-700 border-amber-200',
  SHIPPED:    'bg-blue-100 text-blue-700 border-blue-200',
  DELIVERED:  'bg-teal-100 text-teal-700 border-teal-200',
  COMPLETED:  'bg-green-100 text-green-700 border-green-200',
  CANCELLED:  'bg-red-100 text-red-700 border-red-200',
}

const shipStatusCls: Record<ShipmentStatus, string> = {
  PREPARING: '',
  PACKED:    'bg-amber-100 text-amber-700',
  SHIPPED:   'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  FAILED:    'bg-red-100 text-red-700',
}

interface OrderItem {
  id: string; productId: string; quantity: number; shippedQty: number
  unitPrice: string; discount: string; subtotal: string
  product: { sku: string; name: string; unit: string }
}
interface ShipItem { productId: string; quantity: number; product: { name: string; unit: string } }
interface Shipment {
  id: string; shipmentNo: string; status: ShipmentStatus
  carrier: string | null; trackingNo: string | null
  shipDate: string | null; createdAt: string; items: ShipItem[]
}
interface Order {
  id: string; orderNo: string; status: OrderStatus
  totalAmount: string; paidAmount: string
  expectedShipDate: string | null; notes: string | null; createdAt: string
  customer: { name: string; code: string; phone: string | null; address: string | null }
  createdBy: { name: string }
  quotation: { quotationNo: string } | null
  items: OrderItem[]
  shipments: Shipment[]
}

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(val))
}
function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW')
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { dict } = useI18n()
  const oe = dict.ordersExt
  const os = dict.orders.statuses
  const ss = dict.shipments.statuses
  type OrdSt = keyof typeof os
  type ShpSt = keyof typeof ss
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [shipFormOpen, setShipFormOpen] = useState(false)
  const [payFormOpen, setPayFormOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)

  async function fetchOrder() {
    setLoading(true)
    const res = await fetch(`/api/orders/${id}`)
    if (res.ok) setOrder(await res.json())
    setLoading(false)
  }

  async function handlePayment() {
    if (!order) return
    const amount = Number(payAmount)
    if (isNaN(amount) || amount <= 0) { toast.error(oe.invalidAmount); return }
    if (amount > unpaid) { toast.error(`${oe.overPayment} ${formatCurrency(unpaid)}`); return }
    const newPaidAmount = Number(order.paidAmount) + amount
    setPaying(true)
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentOnly: true, paidAmount: newPaidAmount }),
    })
    setPaying(false)
    if (res.ok) {
      toast.success(oe.paymentSuccess)
      setPayFormOpen(false)
      setPayAmount('')
      fetchOrder()
    } else {
      toast.error(oe.paymentFailed)
    }
  }

  useEffect(() => { fetchOrder() }, [id])

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  if (!order) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">{oe.noOrders}</div>
  )

  const sc = { label: os[order.status as OrdSt] ?? order.status, className: orderStatusCls[order.status] ?? '' }
  const unpaid = Number(order.totalAmount) - Number(order.paidAmount)
  const canShip = ['CONFIRMED', 'PROCESSING'].includes(order.status)
  const canPay = !['CANCELLED'].includes(order.status) && unpaid > 0

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()}
          className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono">{order.orderNo}</h1>
            <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{oe.createdAtPrefix} {formatDate(order.createdAt)} · {order.createdBy.name}</p>
        </div>
        <div className="flex gap-2">
          {canPay && (
            <Button variant="outline" onClick={() => {
              setPayAmount(String(unpaid))
              setPayFormOpen(true)
            }}>
              <DollarSign className="mr-2 h-4 w-4" />{dict.roleDashboard.registerPayment}
            </Button>
          )}
          {canShip && (
            <Button onClick={() => setShipFormOpen(true)}>
              <Truck className="mr-2 h-4 w-4" />{dict.shipmentsExt.newShipment}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* 客戶資訊 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{dict.common.customer}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="font-semibold">{order.customer.name}</p>
            <p className="text-sm text-muted-foreground">{order.customer.code}</p>
            {order.customer.phone && <p className="text-sm">{order.customer.phone}</p>}
            {order.customer.address && <p className="text-xs text-muted-foreground">{order.customer.address}</p>}
          </CardContent>
        </Card>

        {/* 金額資訊 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{dict.common.amount}</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{dict.orders.totalAmount}</span>
              <span className="font-bold">{formatCurrency(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{dict.orders.paidAmount}</span>
              <span className="font-medium text-green-600">{formatCurrency(order.paidAmount)}</span>
            </div>
            {unpaid > 0 && (
              <div className="flex justify-between text-sm border-t pt-1.5">
                <span className="text-muted-foreground">{dict.orders.unpaid}</span>
                <span className="font-bold text-red-600">{formatCurrency(unpaid)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 出貨資訊 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{dict.nav.shipments}</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{oe.expectedShipDate}</span>
              <span>{order.expectedShipDate ? formatDate(order.expectedShipDate) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{oe.shipmentCount}</span>
              <span className="font-medium">{order.shipments.length} {oe.records}</span>
            </div>
            {order.quotation && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{dict.quotations.title}</span>
                <span className="font-mono text-xs">{order.quotation.quotationNo}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 訂單明細 */}
      <Card>
        <CardHeader><CardTitle className="text-base">{dict.common.detail}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.common.product}</TableHead>
                <TableHead className="text-center w-20">{dict.common.quantity}</TableHead>
                <TableHead className="text-center w-20">{oe.shippedQty}</TableHead>
                <TableHead className="text-right w-28">{dict.common.price}</TableHead>
                <TableHead className="text-right w-20">{oe.discount}</TableHead>
                <TableHead className="text-right w-28">{oe.subtotal}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.product.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{item.product.sku}</div>
                  </TableCell>
                  <TableCell className="text-center">{item.quantity} {item.product.unit}</TableCell>
                  <TableCell className="text-center">
                    <span className={item.shippedQty >= item.quantity ? 'text-green-600 font-medium' : item.shippedQty > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                      {item.shippedQty}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {Number(item.discount) > 0 ? `${item.discount}%` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <tr className="border-t bg-slate-50">
                <td colSpan={5} className="px-4 py-2.5 text-right text-sm font-medium">{dict.common.total}</td>
                <td className="px-4 py-2.5 text-right font-bold">{formatCurrency(order.totalAmount)}</td>
              </tr>
            </tfoot>
          </Table>
        </CardContent>
      </Card>

      {/* 出貨記錄 */}
      {order.shipments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{dict.nav.shipments}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.shipments.shipmentNo}</TableHead>
                  <TableHead className="w-24">{dict.common.status}</TableHead>
                  <TableHead>{oe.shipmentItems}</TableHead>
                  <TableHead className="w-24">{dict.shipments.carrier}</TableHead>
                  <TableHead className="w-32">{dict.shipments.trackingNo}</TableHead>
                  <TableHead className="w-24">{oe.shipDate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.shipments.map((s) => {
                  const shipCls = shipStatusCls[s.status] ?? ''
                  const shipLabel = ss[s.status as ShpSt] ?? s.status
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.shipmentNo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={shipCls}>{shipLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.items.map((i) => `${i.product.name} ×${i.quantity}`).join('、')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(s as Shipment & { carrier?: string }).carrier ?? '—'}
                      </TableCell>
                      <TableCell>
                        {s.trackingNo
                          ? <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{s.trackingNo}</span>
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.shipDate ? formatDate(s.shipDate) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 備註 */}
      {order.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">{dict.common.notes}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{order.notes}</p></CardContent>
        </Card>
      )}

      <ShipmentForm
        open={shipFormOpen}
        onClose={() => setShipFormOpen(false)}
        onSuccess={fetchOrder}
        preselectedOrderId={order.id}
      />

      {/* 付款登錄 Dialog */}
      <Dialog open={payFormOpen} onOpenChange={(o) => !o && setPayFormOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dict.roleDashboard.registerPayment}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{dict.orders.totalAmount}</span>
                <span className="font-medium">{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{dict.orders.paidAmount}</span>
                <span className="font-medium text-green-600">{formatCurrency(order.paidAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">{oe.owe}</span>
                <span className="font-bold text-red-600">{formatCurrency(unpaid)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{oe.paymentAmount} <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={1}
                max={unpaid}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder={oe.enterAmount}
              />
              <p className="text-xs text-muted-foreground">{oe.paymentHint}（max: {formatCurrency(unpaid)}）</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFormOpen(false)} disabled={paying}>{dict.common.cancel}</Button>
            <Button onClick={handlePayment} disabled={paying}>
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
