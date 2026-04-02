'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp, TrendingDown, FileText, ShoppingCart, Users,
  Clock, Phone, MapPin, Award, Target,
  Plus, Send, CheckCircle2, AlertTriangle, Calendar,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import {
  fmt, DashboardLoading, DashboardHeader, QuickAction,
  RankingCard, OrderRow,
} from './shared'

interface SalesDashboardData {
  today: { orders: number; revenue: number; visits: number }
  month: { revenue: number; revenueGrowth: number | null; orders: number; lastMonthOrders: number }
  activity: { monthVisits: number; monthCalls: number; monthQuotes: number }
  myCustomers: { id: string; name: string; code: string; type: string; lastContactDate: string | null; _count: { salesOrders: number } }[]
  myQuotations: { id: string; quotationNo: string; status: string; totalAmount: string; validUntil: string | null; createdAt: string; customer: { name: string } }[]
  myRecentOrders: { id: string; orderNo: string; status: string; totalAmount: string; createdAt: string; customer: { name: string } }[]
  pendingTasks: number
  expiringQuotes: number
  pendingShipmentOrders: number
  mySkuRanking: { product: { id: string; name: string; sku: string; unit: string } | null; quantity: number; revenue: number }[]
}

interface VisitDue {
  customerId: string; customerName: string; customerCode: string
  grade: string | null; daysOverdue: number; requiredFrequencyDays: number
  isFirstOrder: boolean; hasAnomaly: boolean; lastVisitDate: string | null
}

interface TargetData {
  targets: { revenue: number; orders: number; visits: number; newCustomers: number }
  actuals: { revenue: number; orders: number; visits: number; newCustomers: number }
  achieveRate: number
  hasTarget: boolean
}

interface ForecastData {
  history: { label: string; revenue: number }[]
  forecast: { label: string; revenue: number; isForecast: true }[]
  confidence: number
  trend: number | null
  slope: number
}

export function SalesDashboard() {
  const [data, setData] = useState<SalesDashboardData | null>(null)
  const [target, setTarget] = useState<TargetData | null>(null)
  const [dailyReport, setDailyReport] = useState<{ status: string; submittedAt: string | null } | null>(null)
  const [visitDue, setVisitDue] = useState<VisitDue[]>([])
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const { dict } = useI18n()
  const dOrders = dict.orders
  const rd = dict.roleDashboard

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/sales').then(r => r.json()),
      fetch('/api/sales-targets').then(r => r.json()).then((arr: TargetData[]) => arr[0] ?? null),
      fetch('/api/sales-daily-report/today').then(r => r.ok ? r.json() : null),
      fetch('/api/customers/visit-schedule').then(r => r.ok ? r.json() : []),
      fetch('/api/dashboard/sales/forecast').then(r => r.ok ? r.json() : null),
    ]).then(([salesData, targetData, reportData, visitData, forecastData]) => {
      if (salesData?.today) setData(salesData)
      setTarget(targetData)
      setDailyReport(reportData)
      setVisitDue(Array.isArray(visitData) ? visitData.slice(0, 8) : [])
      setForecast(forecastData)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLoading />
  if (!data) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <p>儀表板載入失敗，請重新整理</p>
      <button onClick={() => window.location.reload()} className="text-sm underline">重新載入</button>
    </div>
  )

  const { today, month, activity, myCustomers, myQuotations, myRecentOrders,
    pendingTasks, expiringQuotes, pendingShipmentOrders, mySkuRanking } = data

  // Alert items
  const alertCount = pendingTasks + expiringQuotes + pendingShipmentOrders

  // KPI gap calculation
  const revenueTarget = target?.targets.revenue ?? 0
  const revenueGap = revenueTarget > 0 ? revenueTarget - month.revenue : 0
  const gapPercent = revenueTarget > 0 ? (revenueGap / revenueTarget) * 100 : 0
  const bannerColor = !target?.hasTarget
    ? 'from-emerald-600 to-teal-700'
    : revenueGap <= 0
      ? 'from-green-600 to-emerald-700'
      : gapPercent < 20
        ? 'from-amber-500 to-orange-600'
        : 'from-red-600 to-rose-700'

  // Daily report state
  const isDailySubmitted = dailyReport?.status === 'SUBMITTED'
  const currentHour = new Date().getHours()
  const isAfternoon = currentHour >= 17

  return (
    <div className="space-y-5">
      <DashboardHeader title={rd.salesWorkbench} />

      {/* ── My Performance Banner ── */}
      <div className={`rounded-2xl bg-gradient-to-br ${bannerColor} p-5 text-white shadow-lg`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/70 text-sm font-medium">{rd.myPerformance}</p>
            <p className="text-4xl font-bold mt-1">{fmt(month.revenue)}</p>
            {month.revenueGrowth !== null && (
              <p className={`text-sm mt-1 flex items-center gap-1 ${month.revenueGrowth >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {month.revenueGrowth >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {month.revenueGrowth >= 0 ? '+' : ''}{month.revenueGrowth}% {rd.comparedLastMonth}
              </p>
            )}
            {target?.hasTarget && revenueGap > 0 && (
              <p className="text-sm mt-1 text-white/80">
                {rd.revenueLack} <span className="font-bold text-white">{fmt(revenueGap)}</span>
              </p>
            )}
            {target?.hasTarget && revenueGap <= 0 && (
              <p className="text-sm mt-1 text-green-200 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />{rd.targetAchieved}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-white/70 text-sm">{rd.monthOrders}</p>
            <p className="text-2xl font-bold">{month.orders} <span className="text-lg text-white/70">{rd.orderUnit}</span></p>
            {target?.hasTarget && (
              <p className="text-xs text-white/60 mt-0.5">{rd.targetLabel} {fmt(revenueTarget)}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-white/20 pt-3">
          <div>
            <p className="text-white/70 text-xs">{rd.todayRevenue}</p>
            <p className="text-lg font-semibold">{fmt(today.revenue)}</p>
            <p className="text-white/60 text-xs">{today.orders} {rd.orderCountUnit}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs">{rd.visits}</p>
            <p className="text-lg font-semibold">{activity.monthVisits}</p>
            <p className="text-white/60 text-xs">{rd.today} {today.visits} {rd.timesUnit}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs">{rd.calls}/{rd.quotes}</p>
            <p className="text-lg font-semibold">{activity.monthCalls}/{activity.monthQuotes}</p>
            <p className="text-white/60 text-xs">{rd.monthAccum}</p>
          </div>
        </div>
      </div>

      {/* ── Daily Report Reminder ── */}
      {isDailySubmitted ? (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
          <p className="text-sm text-green-700">
            {rd.dailyReportSubmitted}
            {dailyReport?.submittedAt && (
              <span className="text-green-500 ml-1">
                （{new Date(dailyReport.submittedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}）
              </span>
            )}
          </p>
          <Link href="/sales-daily-report" className="ml-auto text-xs text-green-600 hover:underline">{rd.viewReport} →</Link>
        </div>
      ) : isAfternoon ? (
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 flex items-center gap-3">
          <Clock className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm text-amber-800 font-medium">{rd.dailyReportNotSubmitted}</p>
            <p className="text-xs text-amber-600">{rd.dailyReportReminder}</p>
          </div>
          <Link href="/sales-daily-report">
            <span className="flex items-center gap-1 text-xs font-medium bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">
              <Send className="h-3 w-3" />{rd.submitNow}
            </span>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-sm text-slate-500">{rd.rememberDailyReport}</p>
          <Link href="/sales-daily-report" className="ml-auto text-xs text-blue-600 hover:underline">{rd.fillIn} →</Link>
        </div>
      )}

      {/* ── Visit Schedule ── */}
      {visitDue.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-500" />
                {rd.visitSchedule}
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">{visitDue.length}</Badge>
              </CardTitle>
              <Link href="/customers" className="text-xs text-blue-600 hover:underline">{rd.allCustomers} →</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {visitDue.map(v => (
                <Link key={v.customerId} href={`/customers/${v.customerId}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    {v.hasAnomaly && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                    {v.isFirstOrder && !v.hasAnomaly && <span className="text-[10px] font-medium bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shrink-0">{rd.firstOrderCare}</span>}
                    {v.grade && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        v.grade === 'A' ? 'bg-amber-400 text-white' :
                        v.grade === 'B' ? 'bg-blue-400 text-white' :
                        'bg-slate-300 text-white'
                      }`}>{v.grade}</span>
                    )}
                    <span className="text-sm font-medium truncate">{v.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {v.hasAnomaly ? (
                      <span className="text-xs font-medium text-red-600">{rd.visitNow}</span>
                    ) : (
                      <span className={`text-xs ${v.daysOverdue > 7 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                        {rd.overdueNDays.replace('{n}', String(v.daysOverdue))}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Monthly Target Progress ── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-slate-700">{dict.kpi.monthlyTargetAchieve}</span>
            </div>
            {target?.hasTarget ? (
              <Link href="/kpi" className="text-xs text-blue-600 hover:underline">{dict.kpi.detail} →</Link>
            ) : (
              <span className="text-xs text-amber-600">{dict.kpi.notSet}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-3 rounded-full transition-all duration-700 ${
                (target?.achieveRate ?? 0) >= 100 ? 'bg-green-500' :
                (target?.achieveRate ?? 0) >= 70 ? 'bg-emerald-500' :
                (target?.achieveRate ?? 0) >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`} style={{ width: `${Math.min(100, target?.achieveRate ?? 0)}%` }} />
            </div>
            <span className="text-sm font-bold shrink-0">
              {target?.hasTarget ? `${target.achieveRate}%` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{fmt(month.revenue)}</span>
            <span>{target?.hasTarget ? `${rd.targetLabel} ${fmt(target.targets.revenue)}` : ''}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center border-t pt-3">
            <div>
              <p className="text-lg font-bold text-slate-900">{today.orders}</p>
              <p className="text-xs text-muted-foreground">{rd.todayOrders}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{activity.monthVisits}</p>
              <p className="text-xs text-muted-foreground">{rd.monthVisits}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{activity.monthCalls}</p>
              <p className="text-xs text-muted-foreground">{rd.monthCalls}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{activity.monthQuotes}</p>
              <p className="text-xs text-muted-foreground">{rd.monthQuotesLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Today's To-Do ── */}
      {alertCount > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              {rd.todayTodo}
              <Badge variant="outline" className="text-xs ml-1">{alertCount}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {pendingTasks > 0 && (
                <Link href="/tasks"
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-sm">{pendingTasks} {rd.pendingTaskCount}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">→</span>
                </Link>
              )}
              {expiringQuotes > 0 && (
                <Link href="/quotations?status=SENT"
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-sm">{expiringQuotes} {rd.quotesExpiring}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">→</span>
                </Link>
              )}
              {pendingShipmentOrders > 0 && (
                <Link href="/orders?status=CONFIRMED"
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm">{pendingShipmentOrders} {rd.ordersPendingShip}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">→</span>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <QuickAction label={rd.quickPlaceOrder} href="/orders?action=new" icon={ShoppingCart} color="bg-emerald-600" />
        <QuickAction label={rd.newCustomerBtn} href="/customers?action=new" icon={Users} color="bg-rose-600" />
        <QuickAction label={rd.newQuote} href="/quotations?action=new" icon={Plus} color="bg-blue-600" />
        <QuickAction label={rd.visitRecord} href="/quick-input" icon={MapPin} color="bg-violet-600" />
        <QuickAction label={rd.callRecord} href="/quick-input" icon={Phone} color="bg-amber-600" />
      </div>

      {/* ── Quotations + Orders ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* My Quotations */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                {rd.myQuotations}
              </CardTitle>
              <Link href="/quotations" className="text-xs text-blue-600 hover:underline">{dict.common.all} →</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {myQuotations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">{rd.noQuotations}</p>
            ) : (
              <div className="divide-y">
                {myQuotations.map(q => {
                  const isExpiring = q.validUntil && new Date(q.validUntil) < new Date(Date.now() + 7 * 86400000)
                  return (
                    <Link key={q.id} href={`/quotations/${q.id}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/80 transition-colors">
                      <div>
                        <span className="font-mono text-xs font-medium">{q.quotationNo}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{q.customer.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{fmt(Number(q.totalAmount))}</span>
                        {isExpiring && (
                          <Badge variant="outline" className="text-[10px] py-0 border-orange-300 text-orange-600">{rd.expiringSoon}</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] py-0">
                          {q.status === 'DRAFT' ? rd.draft : rd.sent}
                        </Badge>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Recent Orders */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-500" />
                {rd.myRecentOrders}
              </CardTitle>
              <Link href="/orders" className="text-xs text-blue-600 hover:underline">{dict.common.all} →</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {myRecentOrders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">{rd.noOrders}</p>
            ) : (
              <div className="divide-y">
                {myRecentOrders.map(o => {
                  const statusLabel = (dOrders.statuses as Record<string, string>)[o.status] ?? o.status
                  return (
                    <OrderRow key={o.id} id={o.id} orderNo={o.orderNo}
                      customerName={o.customer.name} amount={Number(o.totalAmount)}
                      status={o.status} statusLabel={statusLabel} />
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── My Customers + SKU Ranking ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Customers */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-500" />
                {rd.myCustomers}
              </CardTitle>
              <Link href="/customers" className="text-xs text-blue-600 hover:underline">{dict.common.all} →</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {myCustomers.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">{rd.noCustomers}</p>
            ) : (
              <div className="divide-y">
                {myCustomers.map(c => {
                  const daysSince = c.lastContactDate
                    ? Math.floor((Date.now() - new Date(c.lastContactDate).getTime()) / 86400000)
                    : null
                  return (
                    <Link key={c.id} href={`/customers/${c.id}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/80 transition-colors">
                      <div>
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{c.code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{c._count.salesOrders} {rd.orderCountUnit}</span>
                        {daysSince !== null && daysSince > 30 && (
                          <Badge variant="outline" className="text-[10px] py-0 border-red-300 text-red-600">
                            {daysSince} {rd.daysNoContact}
                          </Badge>
                        )}
                        {daysSince !== null && daysSince <= 30 && (
                          <span className="text-[10px] text-muted-foreground">{daysSince} {rd.daysAgo}</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SKU Ranking */}
        <div className="lg:col-span-2">
          <RankingCard
            title={rd.myTopProducts}
            icon={<Award className="h-4 w-4 text-amber-500" />}
            items={mySkuRanking.map(s => ({
              label: s.product?.name ?? '—',
              value: fmt(s.revenue),
              sub: `${s.quantity}${s.product?.unit ?? ''}`,
              revenue: s.revenue,
            }))}
            color="bg-emerald-500"
            noDataLabel={rd.noSalesData}
          />
        </div>
      </div>

      {/* ── S-19: AI Revenue Forecast ── */}
      {forecast && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-500" />
                業績預測
                <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-slate-100">
                  線性迴歸 · 信心度 {forecast.confidence}%
                </span>
              </CardTitle>
              {forecast.trend !== null && (
                <span className={`text-sm font-medium flex items-center gap-1 ${forecast.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {forecast.trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  趨勢 {forecast.trend >= 0 ? '+' : ''}{forecast.trend}%
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const allPoints = [...forecast.history, ...forecast.forecast]
              const maxRev = Math.max(...allPoints.map(p => p.revenue), 1)
              return (
                <div className="space-y-2">
                  {/* Mini bar chart */}
                  <div className="flex items-end gap-1 h-24">
                    {forecast.history.map((m, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-violet-400 transition-all duration-700"
                          style={{ height: `${Math.round((m.revenue / maxRev) * 80)}px` }} />
                      </div>
                    ))}
                    {/* Separator */}
                    <div className="w-px h-full bg-dashed bg-slate-300 mx-1" />
                    {forecast.forecast.map((m, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-violet-200 border-2 border-dashed border-violet-400 transition-all duration-700"
                          style={{ height: `${Math.round((m.revenue / maxRev) * 80)}px` }} />
                      </div>
                    ))}
                  </div>
                  {/* Labels */}
                  <div className="flex items-center gap-1">
                    {forecast.history.map((m, i) => (
                      <div key={i} className="flex-1 text-center text-[10px] text-muted-foreground">{m.label.slice(5)}</div>
                    ))}
                    <div className="w-px mx-1" />
                    {forecast.forecast.map((m, i) => (
                      <div key={i} className="flex-1 text-center text-[10px] text-violet-600 font-medium">{m.label.slice(5)}*</div>
                    ))}
                  </div>
                  {/* Forecast amounts */}
                  <div className="flex gap-2 pt-1">
                    {forecast.forecast.map((m, i) => (
                      <div key={i} className="flex-1 rounded-lg bg-violet-50 border border-violet-200 p-2 text-center">
                        <p className="text-[10px] text-violet-600 font-medium">{m.label} 預測</p>
                        <p className="text-sm font-bold text-violet-700">{fmt(m.revenue)}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">* 預測值基於過去 6 個月線性趨勢，實際業績受季節、市場等因素影響</p>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
