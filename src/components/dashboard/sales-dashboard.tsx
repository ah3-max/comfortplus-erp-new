'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp, TrendingDown, FileText, ShoppingCart, Users,
  Clock, Phone, MapPin, Award, Target,
  Plus,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import {
  fmt, DashboardLoading, DashboardHeader, QuickAction,
  RankingCard, OrderRow, SectionHeader,
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

interface TargetData {
  targets: { revenue: number; orders: number; visits: number; newCustomers: number }
  actuals: { revenue: number; orders: number; visits: number; newCustomers: number }
  achieveRate: number
  hasTarget: boolean
}

export function SalesDashboard() {
  const [data, setData] = useState<SalesDashboardData | null>(null)
  const [target, setTarget] = useState<TargetData | null>(null)
  const [loading, setLoading] = useState(true)
  const { dict } = useI18n()
  const dOrders = dict.orders
  const rd = dict.roleDashboard

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/sales').then(r => r.json()),
      fetch('/api/sales-targets').then(r => r.json()).then((arr: TargetData[]) => arr[0] ?? null),
    ]).then(([salesData, targetData]) => {
      setData(salesData)
      setTarget(targetData)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLoading />
  if (!data) return null

  const { today, month, activity, myCustomers, myQuotations, myRecentOrders,
    pendingTasks, expiringQuotes, pendingShipmentOrders, mySkuRanking } = data

  // Alert items
  const alertCount = pendingTasks + expiringQuotes + pendingShipmentOrders

  return (
    <div className="space-y-5">
      <DashboardHeader title={rd.salesWorkbench} />

      {/* ── My Performance Banner ── */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-emerald-200 text-sm font-medium">{rd.myPerformance}</p>
            <p className="text-4xl font-bold mt-1">{fmt(month.revenue)}</p>
            {month.revenueGrowth !== null && (
              <p className={`text-sm mt-1 flex items-center gap-1 ${month.revenueGrowth >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {month.revenueGrowth >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {month.revenueGrowth >= 0 ? '+' : ''}{month.revenueGrowth}% {rd.comparedLastMonth}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-emerald-200 text-sm">{rd.monthOrders}</p>
            <p className="text-2xl font-bold">{month.orders} <span className="text-lg text-emerald-200">{rd.orderUnit}</span></p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-emerald-500 pt-3">
          <div>
            <p className="text-emerald-200 text-xs">{rd.todayRevenue}</p>
            <p className="text-lg font-semibold">{fmt(today.revenue)}</p>
            <p className="text-emerald-300 text-xs">{today.orders} {rd.orderCountUnit}</p>
          </div>
          <div>
            <p className="text-emerald-200 text-xs">{rd.visits}</p>
            <p className="text-lg font-semibold">{activity.monthVisits}</p>
            <p className="text-emerald-300 text-xs">{rd.today} {today.visits} {rd.timesUnit}</p>
          </div>
          <div>
            <p className="text-emerald-200 text-xs">{rd.calls}/{rd.quotes}</p>
            <p className="text-lg font-semibold">{activity.monthCalls}/{activity.monthQuotes}</p>
            <p className="text-emerald-300 text-xs">{rd.monthAccum}</p>
          </div>
        </div>
      </div>

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
    </div>
  )
}
