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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, PackageCheck, Loader2, DollarSign, Factory } from 'lucide-react'
import { toast } from 'sonner'

type PurchaseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'SOURCING' | 'CONFIRMED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'

const statusConfig: Record<PurchaseStatus, { label: string; cls: string }> = {
  DRAFT:            { label: '草稿',   cls: 'border-slate-300 text-slate-600' },
  PENDING_APPROVAL: { label: '審核中', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  SOURCING:         { label: '詢價中', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  CONFIRMED:        { label: '已確認', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  PARTIAL:          { label: '部分到貨', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  RECEIVED:         { label: '已到貨', cls: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED:        { label: '已取消', cls: 'bg-red-100 text-red-700 border-red-200' },
}

const purchaseTypeLabels: Record<string, string> = {
  FINISHED_GOODS:     '成品採購', OEM: 'OEM代工採購',
  PACKAGING:          '包材採購', RAW_MATERIAL: '原物料採購',
  GIFT_PROMO:         '贈品/活動物料', LOGISTICS_SUPPLIES: '物流耗材採購',
}

interface PurchaseItem {
  id: string; productId: string; quantity: number; receivedQty: number
  unitCost: string; subtotal: string
  product: { id: string; sku: string; name: string; unit: string }
}
interface ReceiptItem { productId: string; quantity: number; product: { name: string; unit: string } }
interface Receipt {
  id: string; receiptNo: string; receiptDate: string; notes: string | null
  items: ReceiptItem[]
}
interface PurchaseOrder {
  id: string; poNo: string; status: PurchaseStatus; orderType: string
  totalAmount: string; paidAmount: string; taxAmount: string | null
  specVersion: string | null; projectNo: string | null; warehouse: string | null
  inspectionCriteria: string | null
  expectedDate: string | null; notes: string | null; createdAt: string
  // OEM fields
  plannedStartDate: string | null; plannedEndDate: string | null
  packagingReadyDate: string | null; productionConfirmedDate: string | null
  factoryShipDate: string | null; inspectionDate: string | null
  defectRate: string | null; defectResponsibility: string | null
  lossRate: string | null; finalUnitCost: string | null
  // OEM 訂單延伸
  oemProjectNo: string | null; factory: string | null
  sampleVersion: string | null; packagingVersion: string | null; productionBatch: string | null
  inspectionRequirements: string | null; shippingLabelRequirements: string | null; customNotes: string | null
  supplier: { name: string; code: string; phone: string | null; paymentTerms: string | null }
  createdBy: { name: string }
  items: PurchaseItem[]
  receipts: Receipt[]
}

function fmt(v: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(v))
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW')
}

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { dict } = useI18n()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)

  // 驗收 Dialog
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveItems, setReceiveItems] = useState<Array<{ productId: string; quantity: number }>>([])
  const [receiveNotes, setReceiveNotes] = useState('')
  const [receiving, setReceiving] = useState(false)

  // 付款 Dialog
  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)

  // OEM 進度更新 Dialog
  const [oemOpen, setOemOpen] = useState(false)
  const [oemForm, setOemForm] = useState({
    oemProjectNo: '', factory: '', sampleVersion: '', packagingVersion: '',
    productionBatch: '', inspectionRequirements: '', shippingLabelRequirements: '', customNotes: '',
    plannedStartDate: '', plannedEndDate: '', packagingReadyDate: '', productionConfirmedDate: '',
    factoryShipDate: '', inspectionDate: '', defectRate: '', defectResponsibility: '', lossRate: '', finalUnitCost: '',
  })
  const [oemSaving, setOemSaving] = useState(false)

  async function fetchOrder() {
    setLoading(true)
    const res = await fetch(`/api/purchases/${id}`)
    if (res.ok) setOrder(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchOrder() }, [id])

  function openOemUpdate() {
    if (!order) return
    setOemForm({
      oemProjectNo:              order.oemProjectNo              ?? '',
      factory:                   order.factory                   ?? '',
      sampleVersion:             order.sampleVersion             ?? '',
      packagingVersion:          order.packagingVersion          ?? '',
      productionBatch:           order.productionBatch           ?? '',
      inspectionRequirements:    order.inspectionRequirements    ?? '',
      shippingLabelRequirements: order.shippingLabelRequirements ?? '',
      customNotes:               order.customNotes               ?? '',
      plannedStartDate:          order.plannedStartDate          ? order.plannedStartDate.slice(0, 10)          : '',
      plannedEndDate:            order.plannedEndDate            ? order.plannedEndDate.slice(0, 10)            : '',
      packagingReadyDate:        order.packagingReadyDate        ? order.packagingReadyDate.slice(0, 10)        : '',
      productionConfirmedDate:   order.productionConfirmedDate   ? order.productionConfirmedDate.slice(0, 10)   : '',
      factoryShipDate:           order.factoryShipDate           ? order.factoryShipDate.slice(0, 10)           : '',
      inspectionDate:            order.inspectionDate            ? order.inspectionDate.slice(0, 10)            : '',
      defectRate:                order.defectRate                ?? '',
      defectResponsibility:      order.defectResponsibility      ?? '',
      lossRate:                  order.lossRate                  ?? '',
      finalUnitCost:             order.finalUnitCost             ?? '',
    })
    setOemOpen(true)
  }

  async function handleOemSave() {
    setOemSaving(true)
    const res = await fetch(`/api/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oemUpdate: true, ...oemForm }),
    })
    setOemSaving(false)
    if (res.ok) { toast.success(dict.purchasesPage.oemUpdated); setOemOpen(false); fetchOrder() }
    else toast.error(dict.common.updateFailed)
  }

  function openReceive() {
    if (!order) return
    setReceiveItems(
      order.items
        .filter(i => i.quantity > i.receivedQty)
        .map(i => ({ productId: i.productId, quantity: i.quantity - i.receivedQty }))
    )
    setReceiveNotes('')
    setReceiveOpen(true)
  }

  async function handleReceive() {
    const valid = receiveItems.filter(i => i.quantity > 0)
    if (valid.length === 0) { toast.error(dict.purchasesPage.receiveQtyRequired); return }
    setReceiving(true)
    const res = await fetch(`/api/purchases/${id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: valid, notes: receiveNotes }),
    })
    setReceiving(false)
    if (res.ok) {
      const data = await res.json()
      toast.success(`驗收完成，已建立 ${data.receiptNo}，庫存已入帳`)
      setReceiveOpen(false)
      fetchOrder()
    } else {
      const data = await res.json()
      toast.error(data.error ?? '驗收失敗')
    }
  }

  async function handlePayment() {
    if (!order) return
    const amount = Number(payAmount)
    const unpaid = Number(order.totalAmount) - Number(order.paidAmount)
    if (isNaN(amount) || amount <= 0) { toast.error(dict.purchasesPage.validAmount); return }
    if (amount > unpaid) { toast.error(`付款金額不可超過欠款 ${fmt(unpaid)}`); return }
    const newPaid = Number(order.paidAmount) + amount
    setPaying(true)
    const res = await fetch(`/api/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentOnly: true, paidAmount: newPaid }),
    })
    setPaying(false)
    if (res.ok) { toast.success(dict.purchasesPage.paymentRecorded); setPayOpen(false); setPayAmount(''); fetchOrder() }
    else toast.error(dict.purchasesPage.paymentFailed)
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
  if (!order) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">{dict.purchasesExt.noOrders}</div>
  )

  const sc = statusConfig[order.status] ?? { label: order.status, cls: '' }
  const unpaid = Number(order.totalAmount) - Number(order.paidAmount)
  const canReceive = ['CONFIRMED', 'PARTIAL'].includes(order.status)
  const canPay = !['CANCELLED'].includes(order.status) && unpaid > 0
  const isOEM = order.orderType === 'OEM'

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()}
          className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono">{order.poNo}</h1>
            <Badge variant="outline" className={sc.cls}>{sc.label}</Badge>
            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600">
              {purchaseTypeLabels[order.orderType] ?? order.orderType}
            </Badge>
            {order.projectNo && (
              <span className="text-xs font-mono text-muted-foreground">專案：{order.projectNo}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            建立於 {fmtDate(order.createdAt)} · {order.createdBy.name}
            {order.warehouse && ` · 收貨：${order.warehouse}`}
          </p>
        </div>
        <div className="flex gap-2">
          {isOEM && (
            <Button variant="outline" onClick={openOemUpdate}>
              <Factory className="mr-2 h-4 w-4" />{dict.common.edit}OEM進度
            </Button>
          )}
          {canPay && (
            <Button variant="outline" onClick={() => { setPayAmount(String(unpaid)); setPayOpen(true) }}>
              <DollarSign className="mr-2 h-4 w-4" />{dict.roleDashboard.registerPayment}
            </Button>
          )}
          {canReceive && (
            <Button onClick={openReceive}>
              <PackageCheck className="mr-2 h-4 w-4" />{dict.purchases.receive}
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-3 gap-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{dict.common.supplier}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="font-semibold">{order.supplier.name}</p>
            <p className="text-sm text-muted-foreground">{order.supplier.code}</p>
            {order.supplier.phone && <p className="text-sm">{order.supplier.phone}</p>}
            {order.supplier.paymentTerms && <p className="text-xs text-muted-foreground">付款：{order.supplier.paymentTerms}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{dict.common.amount}</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{dict.purchasesExt.totalAmount}</span>
              <span className="font-bold">{fmt(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{dict.purchasesExt.paidAmount}</span>
              <span className="font-medium text-green-600">{fmt(order.paidAmount)}</span>
            </div>
            {unpaid > 0 && (
              <div className="flex justify-between text-sm border-t pt-1.5">
                <span className="text-muted-foreground">應付未付</span>
                <span className="font-bold text-red-600">{fmt(unpaid)}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">到貨資訊</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{dict.purchasesExt.expectedDate}</span>
              <span>{order.expectedDate ? fmtDate(order.expectedDate) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">驗收單數</span>
              <span className="font-medium">{order.receipts.length} 筆</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 採購明細 */}
      <Card>
        <CardHeader><CardTitle className="text-base">{dict.common.detail}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.common.product}</TableHead>
                <TableHead className="text-center w-20">{dict.common.quantity}</TableHead>
                <TableHead className="text-center w-20">已到貨</TableHead>
                <TableHead className="text-right w-28">採購單價</TableHead>
                <TableHead className="text-right w-28">小計</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.product.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{item.product.sku}</div>
                  </TableCell>
                  <TableCell className="text-center">{item.quantity} {item.product.unit}</TableCell>
                  <TableCell className="text-center">
                    <span className={
                      item.receivedQty >= item.quantity ? 'text-green-600 font-medium'
                        : item.receivedQty > 0 ? 'text-amber-600' : 'text-muted-foreground'
                    }>
                      {item.receivedQty}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">{fmt(item.unitCost)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <tr className="border-t bg-slate-50">
                <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-medium">{dict.common.total}</td>
                <td className="px-4 py-2.5 text-right font-bold">{fmt(order.totalAmount)}</td>
              </tr>
            </tfoot>
          </Table>
        </CardContent>
      </Card>

      {/* 驗收記錄 */}
      {order.receipts.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">驗收記錄</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>驗收單號</TableHead>
                  <TableHead>{dict.common.product}</TableHead>
                  <TableHead className="w-28">{dict.purchasesExt.receivedDate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.receipts.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.receiptNo}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.items.map(i => `${i.product.name} ×${i.quantity}`).join('、')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(r.receiptDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 附加資訊（規格版本、驗收標準）*/}
      {(order.specVersion || order.inspectionCriteria) && (
        <Card>
          <CardHeader><CardTitle className="text-base">附加資訊</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {order.specVersion && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">規格版本</span>
                <span className="font-medium font-mono">{order.specVersion}</span>
              </div>
            )}
            {order.inspectionCriteria && (
              <div>
                <p className="text-muted-foreground mb-1">驗收標準</p>
                <p className="text-slate-700 whitespace-pre-wrap">{order.inspectionCriteria}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* OEM 生產排程 */}
      {isOEM && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">OEM 生產資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* OEM 基本 */}
            {(order.oemProjectNo || order.factory || order.sampleVersion || order.packagingVersion || order.productionBatch) && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                {order.oemProjectNo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OEM專案編號</span>
                    <span className="font-mono font-medium">{order.oemProjectNo}</span>
                  </div>
                )}
                {order.factory && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">工廠/代工廠</span>
                    <span className="font-medium">{order.factory}</span>
                  </div>
                )}
                {order.sampleVersion && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">樣品版本</span>
                    <span className="font-mono text-xs font-medium">{order.sampleVersion}</span>
                  </div>
                )}
                {order.packagingVersion && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">包裝版本</span>
                    <span className="font-mono text-xs font-medium">{order.packagingVersion}</span>
                  </div>
                )}
                {order.productionBatch && (
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">生產批號</span>
                    <span className="font-mono font-medium">{order.productionBatch}</span>
                  </div>
                )}
              </div>
            )}

            {/* 驗貨/標籤/備註 */}
            {(order.inspectionRequirements || order.shippingLabelRequirements || order.customNotes) && (
              <div className="space-y-2.5 text-sm border-t pt-4">
                {order.inspectionRequirements && (
                  <div>
                    <p className="text-muted-foreground mb-1">驗貨要求</p>
                    <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 rounded p-2">{order.inspectionRequirements}</p>
                  </div>
                )}
                {order.shippingLabelRequirements && (
                  <div>
                    <p className="text-muted-foreground mb-1">出貨標籤要求</p>
                    <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 rounded p-2">{order.shippingLabelRequirements}</p>
                  </div>
                )}
                {order.customNotes && (
                  <div>
                    <p className="text-muted-foreground mb-1">客製化備註</p>
                    <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 rounded p-2">{order.customNotes}</p>
                  </div>
                )}
              </div>
            )}

            {/* 排程里程碑 */}
            <div className={`grid grid-cols-2 gap-x-8 gap-y-3 text-sm ${(order.oemProjectNo || order.factory || order.inspectionRequirements || order.shippingLabelRequirements || order.customNotes) ? 'border-t pt-4' : ''}`}>
              <p className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">生產排程</p>
              {[
                { label: '預計開工日',      value: order.plannedStartDate },
                { label: '預計完工日',      value: order.plannedEndDate },
                { label: '包材到位日',      value: order.packagingReadyDate },
                { label: '生產排程確認日',  value: order.productionConfirmedDate },
                { label: '出廠日',          value: order.factoryShipDate },
                { label: '驗貨日',          value: order.inspectionDate },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={value ? 'font-medium' : 'text-muted-foreground'}>
                    {value ? fmtDate(value) : '—'}
                  </span>
                </div>
              ))}
            </div>

            {/* 品質結算 */}
            {(order.defectRate || order.lossRate || order.defectResponsibility || order.finalUnitCost) && (
              <div className="mt-1 pt-4 border-t grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <p className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">品質結算</p>
                {order.defectRate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">不良率</span>
                    <span className={`font-medium ${Number(order.defectRate) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                      {order.defectRate}%
                    </span>
                  </div>
                )}
                {order.lossRate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">損耗率</span>
                    <span className="font-medium">{order.lossRate}%</span>
                  </div>
                )}
                {order.defectResponsibility && (
                  <div className="col-span-2 flex justify-between">
                    <span className="text-muted-foreground">補貨責任歸屬</span>
                    <span className="font-medium">{order.defectResponsibility}</span>
                  </div>
                )}
                {order.finalUnitCost && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最終結算單價</span>
                    <span className="font-bold text-blue-600">{fmt(order.finalUnitCost)}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {order.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">{dict.common.notes}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{order.notes}</p></CardContent>
        </Card>
      )}

      {/* 驗收 Dialog */}
      <Dialog open={receiveOpen} onOpenChange={(o) => !o && setReceiveOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{dict.purchases.receive}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">商品</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground w-20">待到貨</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground w-28">本次到貨</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receiveItems.map((ri, idx) => {
                    const poi = order.items.find(i => i.productId === ri.productId)
                    if (!poi) return null
                    const remaining = poi.quantity - poi.receivedQty
                    return (
                      <tr key={ri.productId}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{poi.product.name}</div>
                          <div className="text-xs text-muted-foreground">{poi.product.sku}</div>
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{remaining}</td>
                        <td className="px-3 py-2">
                          <Input type="number" className="h-8 text-center" min={0} max={remaining}
                            value={ri.quantity}
                            onChange={(e) => {
                              const v = Math.min(Math.max(0, Number(e.target.value)), remaining)
                              setReceiveItems(prev => prev.map((x, i) => i === idx ? { ...x, quantity: v } : x))
                            }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Input value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} placeholder="驗收備註..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)} disabled={receiving}>{dict.common.cancel}</Button>
            <Button onClick={handleReceive} disabled={receiving}>
              {receiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              確認驗收入庫
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 付款 Dialog */}
      <Dialog open={payOpen} onOpenChange={(o) => !o && setPayOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{dict.roleDashboard.registerPayment}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{dict.purchasesExt.totalAmount}</span>
                <span className="font-medium">{fmt(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{dict.purchasesExt.paidAmount}</span>
                <span className="font-medium text-green-600">{fmt(order.paidAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">尚欠</span>
                <span className="font-bold text-red-600">{fmt(unpaid)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>本次付款金額 <span className="text-red-500">*</span></Label>
              <Input type="number" min={1} max={unpaid} value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)} placeholder="輸入金額" />
              <p className="text-xs text-muted-foreground">最多 {fmt(unpaid)}，可部分付款</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>{dict.common.cancel}</Button>
            <Button onClick={handlePayment} disabled={paying}>
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OEM 進度更新 Dialog */}
      <Dialog open={oemOpen} onOpenChange={(o) => !o && setOemOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>編輯 OEM 進度</DialogTitle></DialogHeader>
          <div className="space-y-5 py-1">
            {/* OEM 基本資訊 */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">基本資訊</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>OEM 專案編號</Label>
                  <Input value={oemForm.oemProjectNo}
                    onChange={e => setOemForm(f => ({ ...f, oemProjectNo: e.target.value }))}
                    placeholder="OEM-2024-001" />
                </div>
                <div className="space-y-1.5">
                  <Label>工廠 / 代工廠</Label>
                  <Input value={oemForm.factory}
                    onChange={e => setOemForm(f => ({ ...f, factory: e.target.value }))}
                    placeholder="廠商名稱" />
                </div>
                <div className="space-y-1.5">
                  <Label>樣品版本</Label>
                  <Input value={oemForm.sampleVersion}
                    onChange={e => setOemForm(f => ({ ...f, sampleVersion: e.target.value }))}
                    placeholder="v1.0" />
                </div>
                <div className="space-y-1.5">
                  <Label>包裝版本</Label>
                  <Input value={oemForm.packagingVersion}
                    onChange={e => setOemForm(f => ({ ...f, packagingVersion: e.target.value }))}
                    placeholder="PKG-v2" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>生產批號</Label>
                  <Input value={oemForm.productionBatch}
                    onChange={e => setOemForm(f => ({ ...f, productionBatch: e.target.value }))}
                    placeholder="BATCH-20240301" />
                </div>
              </div>
            </div>

            <Separator />

            {/* 排程 */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">生產排程</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'plannedStartDate',        label: '預計開工日' },
                  { key: 'plannedEndDate',           label: '預計完工日' },
                  { key: 'packagingReadyDate',       label: '包材到位日' },
                  { key: 'productionConfirmedDate',  label: '生產排程確認日' },
                  { key: 'factoryShipDate',          label: '出廠日' },
                  { key: 'inspectionDate',           label: '驗貨日' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input type="date"
                      value={oemForm[key as keyof typeof oemForm]}
                      onChange={e => setOemForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* 品質結算 */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">品質結算</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>不良率 (%)</Label>
                  <Input type="number" step="0.01" min={0} max={100}
                    value={oemForm.defectRate}
                    onChange={e => setOemForm(f => ({ ...f, defectRate: e.target.value }))}
                    placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>損耗率 (%)</Label>
                  <Input type="number" step="0.01" min={0} max={100}
                    value={oemForm.lossRate}
                    onChange={e => setOemForm(f => ({ ...f, lossRate: e.target.value }))}
                    placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>補貨責任歸屬</Label>
                  <Input value={oemForm.defectResponsibility}
                    onChange={e => setOemForm(f => ({ ...f, defectResponsibility: e.target.value }))}
                    placeholder="工廠負責 / 買方負責" />
                </div>
                <div className="space-y-1.5">
                  <Label>最終結算單價 (TWD)</Label>
                  <Input type="number" step="0.01" min={0}
                    value={oemForm.finalUnitCost}
                    onChange={e => setOemForm(f => ({ ...f, finalUnitCost: e.target.value }))}
                    placeholder="0" />
                </div>
              </div>
            </div>

            <Separator />

            {/* 驗貨/標籤/備註 */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">驗貨要求與備註</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>驗貨要求</Label>
                  <Textarea rows={2} value={oemForm.inspectionRequirements}
                    onChange={e => setOemForm(f => ({ ...f, inspectionRequirements: e.target.value }))}
                    placeholder="驗貨標準、抽樣比例..." />
                </div>
                <div className="space-y-1.5">
                  <Label>出貨標籤要求</Label>
                  <Textarea rows={2} value={oemForm.shippingLabelRequirements}
                    onChange={e => setOemForm(f => ({ ...f, shippingLabelRequirements: e.target.value }))}
                    placeholder="條碼規格、貼標位置..." />
                </div>
                <div className="space-y-1.5">
                  <Label>客製化備註</Label>
                  <Textarea rows={2} value={oemForm.customNotes}
                    onChange={e => setOemForm(f => ({ ...f, customNotes: e.target.value }))}
                    placeholder="其他特殊要求..." />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOemOpen(false)} disabled={oemSaving}>取消</Button>
            <Button onClick={handleOemSave} disabled={oemSaving}>
              {oemSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              儲存 OEM 進度
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
