'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Package, Truck, AlertTriangle,
  ClipboardCheck, ArrowDownToLine, ArrowUpFromLine,
  CheckCircle2, XCircle,
} from 'lucide-react'
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

export function WarehouseDashboard() {
  const { dict } = useI18n()
  const [data, setData] = useState<WarehouseDashboardData | null>(null)
  const [extra, setExtra] = useState<{
    pendingShipments: number
    lowStockCount: number
    outOfStockCount: number
    todayReceiving: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/warehouse').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()),
    ]).then(([warehouseData, mainData]) => {
      setData(warehouseData)
      setExtra({
        pendingShipments: mainData.pending?.shipments ?? 0,
        lowStockCount: mainData.lowStock?.count ?? 0,
        outOfStockCount: mainData.outOfStock?.count ?? 0,
        todayReceiving: 0,
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLoading />
  if (!data || !extra) return null

  const alertCount = extra.pendingShipments + extra.outOfStockCount + data.logisticsAnomalyCount

  return (
    <div className="space-y-5">
      <DashboardHeader title={dict.roleDashboard.warehouseWorkbench} />

      {/* ── Today's Operations Banner ── */}
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-orange-200 text-sm font-medium">{dict.roleDashboard.todayShipments}</p>
            <p className="text-4xl font-bold mt-1">{data.todayShipments} <span className="text-2xl text-orange-200">筆</span></p>
          </div>
          <div className="text-right">
            <p className="text-orange-200 text-sm">{dict.roleDashboard.pending}</p>
            <p className="text-2xl font-bold">{extra.pendingShipments} <span className="text-lg text-orange-200">筆</span></p>
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

      {/* ── Quick Actions (Large Buttons) ── */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction label={dict.roleDashboard.scanShip} href="/shipments" icon={ArrowUpFromLine} color="bg-blue-600" />
        <QuickAction label={dict.roleDashboard.scanReceive} href="/inventory" icon={ArrowDownToLine} color="bg-emerald-600" />
        <QuickAction label={dict.roleDashboard.stockCount} href="/inventory" icon={ClipboardCheck} color="bg-violet-600" />
      </div>

      {/* ── Alerts ── */}
      {alertCount > 0 && (
        <div className="space-y-2">
          <SectionHeader title="需要處理" icon={AlertTriangle} iconColor="text-amber-500" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {extra.pendingShipments > 0 && (
              <Link href="/shipments"
                className="flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <Truck className="h-4 w-4" />
                <span className="text-sm font-medium">{extra.pendingShipments} 筆出貨待處理</span>
              </Link>
            )}
            {extra.outOfStockCount > 0 && (
              <Link href="/inventory"
                className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 text-red-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{extra.outOfStockCount} 個商品缺貨</span>
              </Link>
            )}
            {data.logisticsAnomalyCount > 0 && (
              <Link href="/shipments"
                className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 text-orange-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">{data.logisticsAnomalyCount} 件物流異常</span>
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
                📍 {s.address || s.order.customer.address || dict.delivery.addressNotSet}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                📦 {s.items.map(i => `${i.product.name}×${i.quantity}`).join('、')}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
