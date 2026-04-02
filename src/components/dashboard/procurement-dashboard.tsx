'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ShoppingBag, Ship, Factory, AlertTriangle,
  Package, ClipboardCheck, CheckCircle2, Clock,
  Plus,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import {
  fmt, DashboardLoading, DashboardHeader, QuickAction, SectionHeader,
} from './shared'

interface ProcurementDashboardData {
  monthPurchaseAmount: number
  monthPurchaseCount: number
  inTransitBatches: number
  factoryOnTimeRate: number | null
  passRate: number | null
  avgDefectRate: number | null
  qcAnomalyCount: number
  materialShortageCount: number
  freightDelayCount: number
}

export function ProcurementDashboard() {
  const { dict } = useI18n()
  const [data, setData] = useState<ProcurementDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/procurement').then(r => r.json())
      .then(d => { if (d?.monthPurchaseCount !== undefined) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLoading />
  if (!data) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <p>儀表板載入失敗，請重新整理</p>
      <button onClick={() => window.location.reload()} className="text-sm underline">重新載入</button>
    </div>
  )

  const alertCount = data.qcAnomalyCount + data.materialShortageCount + data.freightDelayCount

  return (
    <div className="space-y-5">
      <DashboardHeader title={dict.roleDashboard.procurementWorkbench} />

      {/* ── Purchase Banner ── */}
      <div className="rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-cyan-200 text-sm font-medium">{dict.roleDashboard.monthPurchaseAmount}</p>
            <p className="text-4xl font-bold mt-1">{fmt(data.monthPurchaseAmount)}</p>
            <p className="text-cyan-300 text-xs mt-1">{data.monthPurchaseCount} {dict.roleDashboard.purchaseOrders}</p>
          </div>
          <div className="text-right">
            <p className="text-cyan-200 text-sm">{dict.roleDashboard.inTransitBatches}</p>
            <p className="text-2xl font-bold">{data.inTransitBatches} <span className="text-lg text-cyan-200">{dict.roleDashboard.batches}</span></p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-cyan-500 pt-3">
          <div>
            <p className="text-cyan-200 text-xs">{dict.roleDashboard.factoryOnTime}</p>
            <p className="text-lg font-semibold">{data.factoryOnTimeRate !== null ? `${data.factoryOnTimeRate}%` : '—'}</p>
          </div>
          <div>
            <p className="text-cyan-200 text-xs">{dict.roleDashboard.passRate}</p>
            <p className="text-lg font-semibold">{data.passRate !== null ? `${data.passRate}%` : '—'}</p>
          </div>
          <div>
            <p className="text-cyan-200 text-xs">{dict.roleDashboard.avgDefectRate}</p>
            <p className="text-lg font-semibold">{data.avgDefectRate !== null ? `${data.avgDefectRate}%` : '—'}</p>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <QuickAction label={dict.roleDashboard.newPurchase} href="/purchases?action=new" icon={Plus} color="bg-cyan-600" />
        <QuickAction label={dict.roleDashboard.receivingQc} href="/qc" icon={ClipboardCheck} color="bg-emerald-600" />
      </div>

      {/* ── Alerts ── */}
      {alertCount > 0 && (
        <div className="space-y-2">
          <SectionHeader title={dict.roleDashboard.needsAttention} icon={AlertTriangle} iconColor="text-amber-500" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {data.qcAnomalyCount > 0 && (
              <Link href="/qc"
                className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 text-red-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <ClipboardCheck className="h-4 w-4" />
                <span className="text-sm font-medium">{data.qcAnomalyCount} {dict.roleDashboard.qcAnomaly}</span>
              </Link>
            )}
            {data.materialShortageCount > 0 && (
              <Link href="/packaging"
                className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <Package className="h-4 w-4" />
                <span className="text-sm font-medium">{data.materialShortageCount} {dict.roleDashboard.materialShortage}</span>
              </Link>
            )}
            {data.freightDelayCount > 0 && (
              <Link href="/sea-freight"
                className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 text-orange-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <Ship className="h-4 w-4" />
                <span className="text-sm font-medium">{data.freightDelayCount} {dict.roleDashboard.freightDelay}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.factoryOnTime}</p>
            <p className={`text-3xl font-bold mt-1 ${
              data.factoryOnTimeRate !== null && data.factoryOnTimeRate >= 80 ? 'text-emerald-600' :
              data.factoryOnTimeRate !== null && data.factoryOnTimeRate >= 60 ? 'text-amber-600' :
              'text-red-600'
            }`}>
              {data.factoryOnTimeRate !== null ? `${data.factoryOnTimeRate}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.last3Months}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.passRate}</p>
            <p className={`text-3xl font-bold mt-1 ${
              data.passRate !== null && data.passRate >= 95 ? 'text-emerald-600' :
              data.passRate !== null && data.passRate >= 90 ? 'text-amber-600' :
              'text-red-600'
            }`}>
              {data.passRate !== null ? `${data.passRate}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.last3Months}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.qcAnomaly}</p>
            <p className={`text-3xl font-bold mt-1 ${data.qcAnomalyCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {data.qcAnomalyCount}
            </p>
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.thisMonth}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.materialShortage}</p>
            <p className={`text-3xl font-bold mt-1 ${data.materialShortageCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {data.materialShortageCount}
            </p>
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.items}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── In-transit Tracking ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Ship className="h-4 w-4 text-blue-500" />
            {dict.roleDashboard.inTransitTracking}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-cyan-600">{data.inTransitBatches}</p>
              <p className="text-xs text-muted-foreground">{dict.roleDashboard.inTransitBatches}</p>
            </div>
            <div className="text-center flex-1">
              <p className={`text-2xl font-bold ${data.freightDelayCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {data.freightDelayCount}
              </p>
              <p className="text-xs text-muted-foreground">{dict.roleDashboard.delayedBatches}</p>
            </div>
            <div className="flex-1 text-center">
              <Link href="/sea-freight" className="text-sm text-blue-600 hover:underline">
                {`${dict.common.all} →`}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
