'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

const orderStatusConfig: Record<OrderStatus, { label: string; className: string }> = {
  PENDING:    { label: '待確認', className: 'border-slate-300 text-slate-600' },
  CONFIRMED:  { label: '已確認', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  PROCESSING: { label: '處理中', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  SHIPPED:    { label: '已出貨', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  DELIVERED:  { label: '已送達', className: 'bg-teal-100 text-teal-700 border-teal-200' },
  COMPLETED:  { label: '已完成', className: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED:  { label: '已取消', className: 'bg-red-100 text-red-700 border-red-200' },
}

const shipStatusConfig: Record<ShipmentStatus, { label: string; className: string }> = {
  PREPARING: { label: '備貨中', className: '' },
  PACKED:    { label: '已打包', className: 'bg-amber-100 text-amber-700' },
  SHIPPED:   { label: '已出貨', className: 'bg-blue-100 text-blue-700' },
  DELIVERED: { label: '已送達', className: 'bg-green-100 text-green-700' },
  FAILED:    { label: '失敗',   className: 'bg-red-100 text-red-700' },
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
    if (isNaN(amount) || amount <= 0) { toast.error('請輸入有效金額'); return }
    if (amount > unpaid) { toast.error(`本次收款不可超過欠款金額 ${formatCurrency(unpaid)}`); return }
    const newPaidAmount = Number(order.paidAmount) + amount
    setPaying(true)
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentOnly: true, paidAmount: newPaidAmount }),
    })
    setPaying(false)
    if (res.ok) {
      toast.success('付款已登錄')
      setPayFormOpen(false)
      setPayAmount('')
      fetchOrder()
    } else {
      toast.error('登錄失敗')
    }
  }

  useEffect(() => { fetchOrder() }, [id])

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  if (!order) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">找不到此訂單</div>
  )

  const sc = orderStatusConfig[order.status] ?? { label: order.status, className: '' }
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
          <p className="text-sm text-muted-foreground">建立於 {formatDate(order.createdAt)} · {order.createdBy.name}</p>
        </div>
        <div className="flex gap-2">
          {canPay && (
            <Button variant="outline" onClick={() => {
              setPayAmount(String(unpaid))
              setPayFormOpen(true)
            }}>
              <DollarSign className="mr-2 h-4 w-4" />登錄付款
            </Button>
          )}
          {canShip && (
            <Button onClick={() => setShipFormOpen(true)}>
              <Truck className="mr-2 h-4 w-4" />建立出貨單
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* 客戶資訊 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">客戶資訊</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="font-semibold">{order.customer.name}</p>
            <p className="text-sm text-muted-foreground">{order.customer.code}</p>
            {order.customer.phone && <p className="text-sm">{order.customer.phone}</p>}
            {order.customer.address && <p className="text-xs text-muted-foreground">{order.customer.address}</p>}
          </CardContent>
        </Card>

        {/* 金額資訊 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">金額資訊</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">訂單金額</span>
              <span className="font-bold">{formatCurrency(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">已收款</span>
              <span className="font-medium text-green-600">{formatCurrency(order.paidAmount)}</span>
            </div>
            {unpaid > 0 && (
              <div className="flex justify-between text-sm border-t pt-1.5">
                <span className="text-muted-foreground">應收帳款</span>
                <span className="font-bold text-red-600">{formatCurrency(unpaid)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 出貨資訊 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">出貨資訊</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">預計出貨</span>
              <span>{order.expectedShipDate ? formatDate(order.expectedShipDate) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">出貨單數</span>
              <span className="font-medium">{order.shipments.length} 筆</span>
            </div>
            {order.quotation && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">來源報價</span>
                <span className="font-mono text-xs">{order.quotation.quotationNo}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 訂單明細 */}
      <Card>
        <CardHeader><CardTitle className="text-base">訂單明細</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead className="text-center w-20">訂購數</TableHead>
                <TableHead className="text-center w-20">已出貨</TableHead>
                <TableHead className="text-right w-28">單價</TableHead>
                <TableHead className="text-right w-20">折扣</TableHead>
                <TableHead className="text-right w-28">小計</TableHead>
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
                <td colSpan={5} className="px-4 py-2.5 text-right text-sm font-medium">合計</td>
                <td className="px-4 py-2.5 text-right font-bold">{formatCurrency(order.totalAmount)}</td>
              </tr>
            </tfoot>
          </Table>
        </CardContent>
      </Card>

      {/* 出貨記錄 */}
      {order.shipments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">出貨記錄</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>出貨單號</TableHead>
                  <TableHead className="w-24">狀態</TableHead>
                  <TableHead>出貨商品</TableHead>
                  <TableHead className="w-24">物流商</TableHead>
                  <TableHead className="w-32">追蹤單號</TableHead>
                  <TableHead className="w-24">出貨日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.shipments.map((s) => {
                  const ss = shipStatusConfig[s.status] ?? { label: s.status, className: '' }
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.shipmentNo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ss.className}>{ss.label}</Badge>
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
          <CardHeader><CardTitle className="text-base">備註</CardTitle></CardHeader>
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
            <DialogTitle>登錄付款</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">訂單總額</span>
                <span className="font-medium">{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">已收款</span>
                <span className="font-medium text-green-600">{formatCurrency(order.paidAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">尚欠</span>
                <span className="font-bold text-red-600">{formatCurrency(unpaid)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>本次收款金額 <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={1}
                max={unpaid}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="輸入金額"
              />
              <p className="text-xs text-muted-foreground">輸入本次實際收到的金額（最多 {formatCurrency(unpaid)}，可部分付款）</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFormOpen(false)} disabled={paying}>取消</Button>
            <Button onClick={handlePayment} disabled={paying}>
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              確認收款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
