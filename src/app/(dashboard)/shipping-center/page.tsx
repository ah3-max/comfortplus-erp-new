'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, Package, ClipboardCheck, Truck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface ShipmentSummary {
  id: string; shipmentNo: string; status: string
  customer?: { name: string }
  order: { orderNo: string; customer?: { name: string } } | null
  createdAt: string
  trackingNo: string | null; carrier: string | null
}

interface PickingSummary {
  id: string; pickingNumber: string; status: string
  customer: { name: string }
  salesInvoice: { invoiceNumber: string }
  scheduledDate: string | null
}

interface DispatchSummary {
  id: string; dispatchNumber: string; status: string
  customer: { name: string }
  vehicleNo: string | null; driverName: string | null
  createdAt: string
}

interface Overview {
  shipments: ShipmentSummary[]
  pickingOrders: PickingSummary[]
  dispatchOrders: DispatchSummary[]
  stats: {
    pendingShipments: number
    pendingPicking: number
    pendingDispatch: number
    shippedToday: number
  }
}

const SHIP_STATUS: Record<string, { label: string; cls: string }> = {
  PREPARING: { label: '備貨中', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  PACKED:    { label: '已裝箱', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  SHIPPED:   { label: '已出貨', cls: 'bg-green-100 text-green-700 border-green-200' },
  DELIVERED: { label: '已送達', cls: 'bg-slate-100 text-slate-600' },
  FAILED:    { label: '失敗',   cls: 'bg-red-100 text-red-600' },
}

const PICK_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: '待揀貨', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  PICKING:   { label: '揀貨中', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  PICKED:    { label: '完成',   cls: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED: { label: '取消',   cls: 'bg-slate-100 text-slate-500' },
}

const DISPATCH_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: '待派車', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  DISPATCHED: { label: '已出車', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  DELIVERED:  { label: '已送達', cls: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED:  { label: '取消',   cls: 'bg-slate-100 text-slate-500' },
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

export default function ShippingCenterPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        fetch('/api/shipments?pageSize=20&status=PREPARING,PACKED').then(r => r.json()),
        fetch('/api/picking-orders?pageSize=20&status=PENDING,PICKING').then(r => r.json()),
        fetch('/api/dispatch-orders?pageSize=20&status=PENDING,DISPATCHED').then(r => r.json()),
        fetch('/api/shipments?pageSize=100&status=SHIPPED').then(r => r.json()),
      ])

      const shipments: ShipmentSummary[] = results[0].status === 'fulfilled' ? (results[0].value.data ?? []) : []
      const pickingOrders: PickingSummary[] = results[1].status === 'fulfilled' ? (results[1].value.data ?? []) : []
      const dispatchOrders: DispatchSummary[] = results[2].status === 'fulfilled' ? (results[2].value.data ?? []) : []

      const todayStr = new Date().toDateString()
      const shippedAll = results[3].status === 'fulfilled' ? (results[3].value.data ?? []) : []
      const shippedToday = shippedAll.filter((s: ShipmentSummary) =>
        new Date(s.createdAt).toDateString() === todayStr
      ).length

      setData({
        shipments,
        pickingOrders,
        dispatchOrders,
        stats: {
          pendingShipments: shipments.length,
          pendingPicking: pickingOrders.length,
          pendingDispatch: dispatchOrders.filter(d => d.status === 'PENDING').length,
          shippedToday,
        },
      })

      const failCount = results.filter(r => r.status === 'rejected').length
      if (failCount > 0) toast.error(`${failCount} 個模組載入失敗`)
    } catch {
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">出貨中心</h1>
          <p className="text-sm text-muted-foreground">出貨單 · 揀貨單 · 派車單 全覽</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          重新整理
        </Button>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">待出貨</p>
                  <p className="text-2xl font-bold text-amber-600">{data.stats.pendingShipments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">待揀貨</p>
                  <p className="text-2xl font-bold text-blue-600">{data.stats.pendingPicking}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">待派車</p>
                  <p className="text-2xl font-bold text-orange-600">{data.stats.pendingDispatch}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">今日出貨</p>
                  <p className="text-2xl font-bold text-green-600">{data.stats.shippedToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading && !data && (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
      )}

      {data && (
        <>
          {/* Pending Shipments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-500" />
                待出貨（備貨中 / 已裝箱）
                {data.stats.pendingShipments > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 text-white text-xs px-2 py-0.5">{data.stats.pendingShipments}</span>
                )}
                <Link href="/shipments" className="ml-auto text-xs text-blue-600 hover:underline font-normal">查看全部</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.shipments.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">無待出貨單</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">出貨單號</TableHead>
                      <TableHead className="text-xs">客戶</TableHead>
                      <TableHead className="text-xs">訂單</TableHead>
                      <TableHead className="text-xs">狀態</TableHead>
                      <TableHead className="text-xs">追蹤單號</TableHead>
                      <TableHead className="text-xs">日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.shipments.map(s => {
                      const sc = SHIP_STATUS[s.status] ?? { label: s.status, cls: '' }
                      return (
                        <TableRow key={s.id} className="hover:bg-slate-50/80">
                          <TableCell className="font-mono text-xs font-medium">{s.shipmentNo}</TableCell>
                          <TableCell className="text-sm">{s.customer?.name ?? s.order?.customer?.name ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.order?.orderNo ?? '—'}</TableCell>
                          <TableCell><Badge variant="outline" className={sc.cls}>{sc.label}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{s.trackingNo ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(s.createdAt)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Picking Orders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-blue-500" />
                待揀貨
                {data.stats.pendingPicking > 0 && (
                  <span className="ml-1 rounded-full bg-blue-500 text-white text-xs px-2 py-0.5">{data.stats.pendingPicking}</span>
                )}
                <Link href="/picking" className="ml-auto text-xs text-blue-600 hover:underline font-normal">查看全部</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.pickingOrders.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">無待揀貨單</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">揀貨單號</TableHead>
                      <TableHead className="text-xs">客戶</TableHead>
                      <TableHead className="text-xs">銷貨單</TableHead>
                      <TableHead className="text-xs">狀態</TableHead>
                      <TableHead className="text-xs">排程日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.pickingOrders.map(p => {
                      const sc = PICK_STATUS[p.status] ?? { label: p.status, cls: '' }
                      return (
                        <TableRow key={p.id} className="hover:bg-slate-50/80">
                          <TableCell className="font-mono text-xs font-medium">{p.pickingNumber}</TableCell>
                          <TableCell className="text-sm">{p.customer.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.salesInvoice.invoiceNumber}</TableCell>
                          <TableCell><Badge variant="outline" className={sc.cls}>{sc.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.scheduledDate ? fmtDate(p.scheduledDate) : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Dispatch Orders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-500" />
                待派車 / 出車中
                {data.stats.pendingDispatch > 0 && (
                  <span className="ml-1 rounded-full bg-orange-500 text-white text-xs px-2 py-0.5">{data.stats.pendingDispatch}</span>
                )}
                <Link href="/dispatch" className="ml-auto text-xs text-blue-600 hover:underline font-normal">查看全部</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.dispatchOrders.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">無待派車單</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">派車單號</TableHead>
                      <TableHead className="text-xs">客戶</TableHead>
                      <TableHead className="text-xs">狀態</TableHead>
                      <TableHead className="text-xs">車牌</TableHead>
                      <TableHead className="text-xs">司機</TableHead>
                      <TableHead className="text-xs">日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dispatchOrders.map(d => {
                      const sc = DISPATCH_STATUS[d.status] ?? { label: d.status, cls: '' }
                      const noVehicle = !d.vehicleNo && !d.driverName
                      return (
                        <TableRow key={d.id} className={`hover:bg-slate-50/80 ${noVehicle && d.status === 'PENDING' ? 'bg-amber-50/50' : ''}`}>
                          <TableCell className="font-mono text-xs font-medium">{d.dispatchNumber}</TableCell>
                          <TableCell className="text-sm">{d.customer.name}</TableCell>
                          <TableCell><Badge variant="outline" className={sc.cls}>{sc.label}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">
                            {d.vehicleNo ?? (
                              <span className="text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />未指派</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{d.driverName ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(d.createdAt)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
