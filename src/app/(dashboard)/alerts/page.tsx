'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle, TrendingDown, Clock, Users, ShieldAlert } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'

// ═══════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════

interface ChurnAlert {
  customerId: string
  customerName: string
  customerCode: string
  salesRepName: string
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  riskScore: number
  riskFactors: string[]
  daysSinceLastOrder: number
  volumeChangePct: number
  lastOrderAmount: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

const LEVEL_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  LOW: 'bg-green-100 text-green-800 border-green-300',
}

const LEVEL_BAR: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-green-500',
}

// ═══════════════════════════════════════════════════════════════════════════
//  Page
// ═══════════════════════════════════════════════════════════════════════════

export default function AlertsPage() {
  const { dict } = useI18n()
  const al = dict.alerts
  const [alerts, setAlerts] = useState<ChurnAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/churn-alerts')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      const list: ChurnAlert[] = Array.isArray(data) ? data : data.alerts ?? []
      list.sort((a, b) => b.riskScore - a.riskScore)
      setAlerts(list)
    } catch {
      toast.error(dict.alerts.loadFailed)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAlerts() }, [])

  const handleCreateTask = async (alert: ChurnAlert) => {
    setActionLoading(alert.customerId)
    try {
      const res = await fetch('/api/crm/churn-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_TASK', customerId: alert.customerId }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`${al.taskCreatedFor} ${alert.customerName} ${al.taskCreatedSuffix}`.trim())
    } catch {
      toast.error(dict.alerts.taskCreateFailed)
    } finally {
      setActionLoading(null)
    }
  }

  // Summary counts
  const total = alerts.length
  const critical = alerts.filter(a => a.riskLevel === 'CRITICAL').length
  const high = alerts.filter(a => a.riskLevel === 'HIGH').length
  const medium = alerts.filter(a => a.riskLevel === 'MEDIUM').length

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-red-600" />
          <h1 className="text-2xl font-bold">{al.centerTitle}</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {al.subtitle}
        </p>
      </div>

      {/* Category Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-red-200">
          <CardContent className="pt-4 pb-3 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-red-600 mb-1" />
            <p className="text-xs text-muted-foreground">{al.churnRiskCard}</p>
            <p className="text-2xl font-bold text-red-600">{loading ? '-' : critical + high}</p>
            <p className="text-xs text-muted-foreground">{al.criticalPlusHigh}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingDown className="mx-auto h-5 w-5 text-orange-500 mb-1" />
            <p className="text-xs text-muted-foreground">{al.orderDropCard}</p>
            <p className="text-2xl font-bold text-orange-600">{loading ? '-' : alerts.filter(a => a.volumeChangePct < -30).length}</p>
            <p className="text-xs text-muted-foreground">{al.dropOver30}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-4 pb-3 text-center">
            <Clock className="mx-auto h-5 w-5 text-amber-500 mb-1" />
            <p className="text-xs text-muted-foreground">{al.noOrderCard}</p>
            <p className="text-2xl font-bold text-amber-600">{loading ? '-' : alerts.filter(a => a.daysSinceLastOrder > 60).length}</p>
            <p className="text-xs text-muted-foreground">{al.noOrderOver60}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">{al.totalCard}</p>
            <p className="text-2xl font-bold">{loading ? '-' : total}</p>
            <p className="text-xs text-muted-foreground">{al.totalCustomers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty */}
      {!loading && alerts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {al.noAlerts}
          </CardContent>
        </Card>
      )}

      {/* Alert List */}
      {!loading && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map(a => (
            <Card key={a.customerId} className="overflow-hidden">
              <CardContent className="p-4">
                {/* Top row */}
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={LEVEL_COLOR[a.riskLevel]}>
                      {al.riskLevels[a.riskLevel as keyof typeof al.riskLevels] ?? a.riskLevel}
                    </Badge>
                    <Link href={`/customers/${a.customerId}`} className="font-semibold hover:underline">{a.customerName}</Link>
                    <span className="text-sm text-muted-foreground">{a.customerCode}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {al.salesRepLabel}: {a.salesRepName}
                  </span>
                </div>

                {/* Risk score bar */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-medium w-20 shrink-0">{al.riskScore}</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${LEVEL_BAR[a.riskLevel]}`}
                      style={{ width: `${a.riskScore}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold w-10 text-right">{a.riskScore}</span>
                </div>

                {/* Risk factors */}
                {a.riskFactors?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {a.riskFactors.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                    ))}
                  </div>
                )}

                {/* Metrics + Action */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {a.daysSinceLastOrder} {al.daysSinceOrder}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {a.volumeChangePct > 0 ? '+' : ''}{a.volumeChangePct}%
                    </span>
                    <span className="flex items-center gap-1">
                      {al.lastOrder} {fmt(a.lastOrderAmount)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading === a.customerId}
                    onClick={() => handleCreateTask(a)}
                  >
                    {actionLoading === a.customerId && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {al.createTrackingTask}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
