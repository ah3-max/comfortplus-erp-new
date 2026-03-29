'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Package, Truck, AlertTriangle, Ship,
  ClipboardCheck, ArrowDownToLine, ArrowUpFromLine,
  CheckCircle2, XCircle, ShieldCheck, MapPin,
  ShoppingCart, PlusCircle, Loader2, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import {
  DashboardLoading, DashboardHeader, QuickAction,
  SectionHeader, ProgressBar,
} from './shared'

interface WarehouseDashboardData {
  totalInventory: number
  availableInventory: number
  inTransitInventory: number
  todayShipments: number
  deliveryOnTimeRate: number | null
  signCompletionRate: number | null
  logisticsAnomalyCount: number
}

interface InboundRecord {
  id: string
  inboundNo: string
  qcResult: string | null
  putawayStatus: string
  arrivalDate: string
  warehouse: { code: string; name: string }
  seaFreight: { freightNo: string; purchaseOrder: { poNo: string } | null } | null
  items: { id: string; quantity: number; damageQty: number; locationCode: string | null; product: { name: string; sku: string } }[]
}

interface SeaFreightInTransit {
  id: string
  freightNo: string
  status: string
  customsStatus: string
  eta: string | null
  purchaseOrder: { poNo: string } | null
}

export function WarehouseDashboard() {
  const { dict } = useI18n()
  const [data, setData] = useState<WarehouseDashboardData | null>(null)
  const [extra, setExtra] = useState<{
    pendingShipments: number
    lowStockCount: number
    outOfStockCount: number
  } | null>(null)
  const [inbounds, setInbounds] = useState<InboundRecord[]>([])
  const [seaFreights, setSeaFreights] = useState<SeaFreightInTransit[]>([])
  const [confirmedOrders, setConfirmedOrders] = useState<{ id: string; orderNo: string; customer: { name: string }; items: { quantity: number; product: { name: string } }[]; createdAt: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/warehouse').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/inbound?pageSize=50').then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/sea-freight?pageSize=20').then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/orders?status=CONFIRMED&pageSize=20').then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([warehouseData, mainData, inboundData, freightData, ordersData]) => {
      setData(warehouseData)
      setExtra({
        pendingShipments: mainData.pending?.shipments ?? 0,
        lowStockCount: mainData.lowStock?.count ?? 0,
        outOfStockCount: mainData.outOfStock?.count ?? 0,
      })
      setInbounds(inboundData.data ?? [])
      // Filter in-transit sea freights (not yet RECEIVED)
      const freights = (freightData.data ?? []).filter((f: SeaFreightInTransit) =>
        !['RECEIVED', 'CANCELLED'].includes(f.status)
      )
      setSeaFreights(freights)
      setConfirmedOrders(ordersData.data ?? [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLoading />
  if (!data || !extra) return null

  const pendingQc = inbounds.filter(i => !i.qcResult)
  const pendingPutaway = inbounds.filter(i => i.qcResult === 'PASS' && i.putawayStatus !== 'COMPLETED')
  const alertCount = extra.pendingShipments + extra.outOfStockCount + data.logisticsAnomalyCount

  return (
    <div className="space-y-5">
      <DashboardHeader title={dict.roleDashboard.warehouseWorkbench} />

      {/* ── Inbound Pipeline ── */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-lg">
        <p className="text-emerald-200 text-sm font-medium mb-3">{dict.roleDashboard.inboundPipeline}</p>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <Ship className="h-5 w-5 mx-auto mb-1 text-emerald-200" />
            <p className="text-2xl font-bold">{seaFreights.length}</p>
            <p className="text-emerald-200 text-xs">{dict.roleDashboard.seaTransitLabel}</p>
          </div>
          <div className="text-center">
            <ArrowDownToLine className="h-5 w-5 mx-auto mb-1 text-emerald-200" />
            <p className="text-2xl font-bold">{pendingQc.length}</p>
            <p className="text-emerald-200 text-xs">{dict.roleDashboard.qcPendingLabel}</p>
          </div>
          <div className="text-center">
            <ShieldCheck className="h-5 w-5 mx-auto mb-1 text-emerald-200" />
            <p className="text-2xl font-bold">{pendingPutaway.length}</p>
            <p className="text-emerald-200 text-xs">{dict.roleDashboard.putawayPendingLabel}</p>
          </div>
          <div className="text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-200" />
            <p className="text-2xl font-bold">{inbounds.filter(i => i.putawayStatus === 'COMPLETED').length}</p>
            <p className="text-emerald-200 text-xs">{dict.roleDashboard.completedLabel}</p>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-5 gap-3">
        <QuickAction label={dict.roleDashboard.quickShip} href="/quick-input" icon={PlusCircle} color="bg-rose-600" />
        <QuickAction label={dict.roleDashboard.seaFreightTracking} href="/sea-freight" icon={Ship} color="bg-cyan-600" />
        <QuickAction label={dict.roleDashboard.scanShip} href="/shipments" icon={ArrowUpFromLine} color="bg-blue-600" />
        <QuickAction label={dict.roleDashboard.qcReceiving} href="/qc" icon={ShieldCheck} color="bg-emerald-600" />
        <QuickAction label={dict.roleDashboard.stockCount} href="/inventory" icon={ClipboardCheck} color="bg-violet-600" />
      </div>

      {/* ── Confirmed Orders (待出貨) — 最重要的區塊 ── */}
      <PendingDispatchPanel orders={confirmedOrders} />

      {/* ── Sea Freight In Transit ── */}
      {seaFreights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Ship className="h-4 w-4 text-cyan-500" />
                {dict.roleDashboard.seaTransitStatus}
                <Badge variant="outline" className="text-xs ml-1">{seaFreights.length}</Badge>
              </CardTitle>
              <Link href="/sea-freight" className="text-xs text-blue-600 hover:underline">{`${dict.common.all} →`}</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {seaFreights.slice(0, 5).map(sf => (
                <Link key={sf.id} href="/sea-freight" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div>
                    <span className="font-mono text-xs font-bold">{sf.freightNo}</span>
                    {sf.purchaseOrder && <span className="text-xs text-muted-foreground ml-2">{sf.purchaseOrder.poNo}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {sf.eta && (
                      <span className="text-xs text-muted-foreground">
                        ETA {new Date(sf.eta).toLocaleDateString('zh-TW')}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {sf.status === 'IN_TRANSIT' ? dict.roleDashboard.seaTransitLabel :
                       sf.status === 'ARRIVED' ? dict.roleDashboard.arrivedStatus :
                       sf.status === 'CUSTOMS_DEST' ? dict.roleDashboard.customsClearingStatus :
                       sf.status === 'DELIVERING' ? dict.roleDashboard.truckingStatus :
                       sf.status === 'DEVANNING' ? dict.roleDashboard.devanningStatus :
                       sf.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pending QC ── */}
      {pendingQc.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              {dict.roleDashboard.qcPendingCardTitle}
              <Badge className="bg-amber-100 text-amber-700 text-xs ml-1">{pendingQc.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {pendingQc.map(ib => (
                <div key={ib.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-mono text-xs font-bold">{ib.inboundNo}</span>
                      {ib.seaFreight && <span className="text-xs text-muted-foreground ml-2">{ib.seaFreight.freightNo}</span>}
                    </div>
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">{dict.roleDashboard.awaitingInspection}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ib.items.map(i => `${i.product.name} × ${i.quantity}`).join('、')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pending Putaway ── */}
      {pendingPutaway.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-violet-500" />
              {dict.roleDashboard.putawayCardTitle}
              <Badge className="bg-violet-100 text-violet-700 text-xs ml-1">{pendingPutaway.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {pendingPutaway.map(ib => (
                <div key={ib.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold">{ib.inboundNo}</span>
                    <Badge variant="outline" className="text-xs text-violet-600 border-violet-300">{dict.roleDashboard.qcPassedPutaway}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ib.items.map(i => `${i.product.name} × ${i.quantity}`).join('、')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Today's Operations Banner ── */}
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-orange-200 text-sm font-medium">{dict.roleDashboard.todayShipments}</p>
            <p className="text-4xl font-bold mt-1">{data.todayShipments} <span className="text-2xl text-orange-200">{dict.roleDashboard.shipCountUnit}</span></p>
          </div>
          <div className="text-right">
            <p className="text-orange-200 text-sm">{dict.roleDashboard.pending}</p>
            <p className="text-2xl font-bold">{extra.pendingShipments} <span className="text-lg text-orange-200">{dict.roleDashboard.pendingCountUnit}</span></p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-orange-400 pt-3">
          <div>
            <p className="text-orange-200 text-xs">{dict.roleDashboard.totalInventory}</p>
            <p className="text-lg font-semibold">{data.totalInventory.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-orange-200 text-xs">{dict.roleDashboard.availableInventory}</p>
            <p className="text-lg font-semibold">{data.availableInventory.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-orange-200 text-xs">{dict.roleDashboard.inTransitInventory}</p>
            <p className="text-lg font-semibold">{data.inTransitInventory.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Alerts ── */}
      {alertCount > 0 && (
        <div className="space-y-2">
          <SectionHeader title={dict.roleDashboard.needsAttention} icon={AlertTriangle} iconColor="text-amber-500" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {extra.pendingShipments > 0 && (
              <Link href="/shipments"
                className="flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <Truck className="h-4 w-4" />
                <span className="text-sm font-medium">{extra.pendingShipments} {dict.roleDashboard.pendingShipOrders}</span>
              </Link>
            )}
            {extra.outOfStockCount > 0 && (
              <Link href="/inventory"
                className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 text-red-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{extra.outOfStockCount} {dict.roleDashboard.outOfStockMsg}</span>
              </Link>
            )}
            {data.logisticsAnomalyCount > 0 && (
              <Link href="/shipments"
                className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 text-orange-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">{data.logisticsAnomalyCount} {dict.roleDashboard.logisticsAnomalyMsg}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.onTimeRate}</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">
              {data.deliveryOnTimeRate !== null ? `${data.deliveryOnTimeRate}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.last30Days}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.signRate}</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              {data.signCompletionRate !== null ? `${data.signCompletionRate}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.last30Days}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.lowStockItems}</p>
            <p className={`text-3xl font-bold mt-1 ${extra.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {extra.lowStockCount}
            </p>
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.items}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.outOfStockItems}</p>
            <p className={`text-3xl font-bold mt-1 ${extra.outOfStockCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {extra.outOfStockCount}
            </p>
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.items}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Today's Delivery List ── */}
      <TodayDeliveryList />

      {/* ── Inventory Overview ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-500" />
            {dict.roleDashboard.inventoryOverview}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ProgressBar
            label={dict.roleDashboard.inventoryUsage}
            current={data.availableInventory}
            target={data.totalInventory}
            color="bg-blue-500"
          />
          <ProgressBar
            label={dict.roleDashboard.inTransitRatio}
            current={data.inTransitInventory}
            target={data.totalInventory + data.inTransitInventory}
            color="bg-amber-500"
          />
        </CardContent>
      </Card>
    </div>
  )
}

// ── Sub-component: Pending Dispatch Panel ────────────────────────────────────

interface DispatchOrder {
  id: string; orderNo: string
  customer: { name: string }
  items: { quantity: number; product: { name: string } }[]
  createdAt: string
}

function PendingDispatchPanel({ orders }: { orders: DispatchOrder[] }) {
  const { dict } = useI18n()
  const [dispatching, setDispatching] = useState<string | null>(null)
  const [dispatched, setDispatched] = useState<Set<string>>(new Set())

  async function handleDispatch(order: DispatchOrder) {
    setDispatching(order.id)
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setDispatched(prev => new Set(prev).add(order.id))
      } else {
        toast.error(data.error ?? dict.forms.shipFailed)
      }
    } catch {
      toast.error(dict.common.operationFailed)
    } finally {
      setDispatching(null)
    }
  }

  const pending = orders.filter(o => !dispatched.has(o.id))

  if (pending.length === 0 && orders.length === 0) return null

  return (
    <Card className={pending.length > 0 ? 'ring-2 ring-rose-300 shadow-lg' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-rose-500" />
            {dict.roleDashboard.pendingDispatch}
            {pending.length > 0 && (
              <Badge className="bg-rose-500 text-white text-xs ml-1 animate-pulse">{pending.length} {dict.roleDashboard.newOrdersBadge}</Badge>
            )}
          </CardTitle>
          <Link href="/orders?status=CONFIRMED" className="text-xs text-blue-600 hover:underline">{dict.roleDashboard.viewAllOrders} →</Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {pending.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-300" />
            {dict.roleDashboard.noDispatchOrders}
            {dispatched.size > 0 && <p className="mt-1 text-emerald-600 font-medium">{dict.roleDashboard.processedCount} {dispatched.size}</p>}
          </div>
        ) : (
          <div className="divide-y">
            {pending.slice(0, 10).map(o => (
              <div key={o.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold">{o.orderNo}</span>
                      <span className="text-sm font-medium">{o.customer.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {o.items.map(i => `${i.product.name} × ${i.quantity}`).join('、')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-500"
                      disabled={dispatching === o.id}
                      onClick={() => handleDispatch(o)}
                    >
                      {dispatching === o.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 mr-1" />
                      )}
                      {dict.roleDashboard.oneClickShip}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Sub-component: Today's Delivery List ─────────────────────────────────────

interface PendingShipment {
  id: string
  shipmentNo: string
  status: string
  address: string | null
  order: { orderNo: string; customer: { name: string; address: string | null } }
  items: { quantity: number; product: { name: string } }[]
}

function TodayDeliveryList() {
  const { dict } = useI18n()
  const [shipments, setShipments] = useState<PendingShipment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/shipments?status=PREPARING')
      .then(r => r.json())
      .then((data) => {
        setShipments(Array.isArray(data) ? data.slice(0, 10) : [])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (shipments.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-blue-500" />
            {dict.roleDashboard.pendingShipList}
            <Badge variant="outline" className="text-xs ml-1">{shipments.length}</Badge>
          </CardTitle>
          <Link href="/shipments?status=PREPARING" className="text-xs text-blue-600 hover:underline">{`${dict.common.all} →`}</Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {shipments.map(s => (
            <div key={s.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold">{s.shipmentNo}</span>
                  <span className="text-sm font-medium">{s.order.customer.name}</span>
                </div>
                <Link
                  href={`/shipments/${s.id}/deliver`}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 active:scale-[0.97] transition-all"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {dict.roleDashboard.delivered}
                </Link>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {s.address || s.order.customer.address || dict.delivery.addressNotSet}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {s.items.map(i => `${i.product.name}×${i.quantity}`).join('、')}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
