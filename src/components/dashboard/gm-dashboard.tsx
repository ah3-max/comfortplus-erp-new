'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TrendingUp, TrendingDown, AlertTriangle,
  Package, Factory, Truck, Clock, Users, Award, Ban,
  ChevronDown, ChevronUp, AlertOctagon, ArrowRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useI18n } from '@/lib/i18n/context'
import {
  fmt, fmtShort, COLORS,
  DashboardLoading, DashboardHeader, RankingCard, OrderRow, AlertBanner,
} from './shared'

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  today:    { orders: number; revenue: number }
  month:    { revenue: number; revenueGrowth: number | null; orders: number; orderGrowth: number | null; grossProfit: number; grossMargin: number }
  receivable: { total: number; count: number }
  payable:    { total: number; count: number }
  lowStock:   { count: number; items: { productId: string; name: string; sku: string; unit: string; quantity: number; safetyStock: number }[] }
  outOfStock: { count: number; items: { productId: string; name: string; sku: string; unit: string; safetyStock: number }[] }
  complaints: { count: number; rate: number }
  returns:    { count: number; rate: number }
  deliveryAnomalies: { count: number }
  oemAnomalies:      { count: number }
  pending:    { orders: number; shipments: number; serviceReqs: number; tasks: number }
  skuRanking:       { product: { id: string; sku: string; name: string; unit: string } | null; quantity: number; revenue: number }[]
  customerRanking:  { customer: { id: string; name: string; code: string; type: string } | null; revenue: number; orders: number }[]
  salesRanking:     { userId: string; name: string; revenue: number; orders: number }[]
  channelBreakdown: { type: string; amount: number; pct: number }[]
  revenueTrend:     { month: string; revenue: number; orders: number }[]
  recentOrders:     { id: string; orderNo: string; status: string; totalAmount: string; createdAt: string; customer: { name: string } }[]
  salesMix:         { b2b: { revenue: number; pct: number }; b2c: { revenue: number; pct: number } }
  platformSales:    { platform: string; revenue: number; orders: number }[]
  regionSales:      { region: string; revenue: number; orders: number }[]
  purchaseTrend:    { month: string; cost: number; count: number }[]
  repurchaseRate:   number
}

// ── Component ────────────────────────────────────────────────────────────────

interface TeamKpi {
  userId: string
  user: { name: string } | null
  achieveRate: number
  hasTarget: boolean
  actuals: { revenue: number }
  targets: { revenue: number }
}

export function GmDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [teamKpi, setTeamKpi] = useState<TeamKpi[]>([])
  const [loading, setLoading] = useState(true)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const { dict } = useI18n()
  const d = dict.dashboard
  const dOrders = dict.orders

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/sales-targets?team=true').then(r => r.json()).catch(() => []),
    ]).then(([dashData, kpiData]) => {
      setData(dashData)
      setTeamKpi(Array.isArray(kpiData) ? kpiData : [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLoading />
  if (!data) return null

  const kpiWithTarget = teamKpi.filter(k => k.hasTarget)
  const companyTarget = kpiWithTarget.reduce((s, k) => s + k.targets.revenue, 0)
  const companyActual = kpiWithTarget.reduce((s, k) => s + k.actuals.revenue, 0)
  const companyAchieve = companyTarget > 0 ? Math.round((companyActual / companyTarget) * 1000) / 10 : 0

  const { today, month, receivable, payable, lowStock, outOfStock,
    complaints, deliveryAnomalies, oemAnomalies, pending,
    skuRanking, customerRanking, salesRanking, channelBreakdown,
    revenueTrend, recentOrders, salesMix, platformSales, regionSales,
    purchaseTrend, repurchaseRate } = data

  const alertItems = [
    pending.orders    > 0 && { label: `${pending.orders} ${dict.roleDashboard.pendingOrdersAlert}`,   href: '/orders?status=PENDING',   icon: Clock,         cls: 'border-amber-300 bg-amber-50 text-amber-700' },
    pending.shipments > 0 && { label: `${pending.shipments} ${dict.roleDashboard.pendingShipmentsAlert}`, href: '/shipments',               icon: Truck,         cls: 'border-blue-300 bg-blue-50 text-blue-700' },
    complaints.count  > 0 && { label: `${complaints.count} ${dict.roleDashboard.complaintsAlert}`,  href: '/incidents',               icon: AlertOctagon,  cls: 'border-red-300 bg-red-50 text-red-700' },
    outOfStock.count  > 0 && { label: `${outOfStock.count} ${dict.roleDashboard.outOfStockAlert}`,    href: '/inventory',               icon: Ban,           cls: 'border-red-300 bg-red-50 text-red-700' },
    lowStock.count    > 0 && { label: `${lowStock.count} ${dict.roleDashboard.lowStockAlert}`,    href: '/inventory',               icon: AlertTriangle, cls: 'border-amber-300 bg-amber-50 text-amber-700' },
    deliveryAnomalies.count > 0 && { label: `${deliveryAnomalies.count} ${dict.roleDashboard.deliveryAnomalyAlert}`, href: '/shipments',    icon: Truck,         cls: 'border-orange-300 bg-orange-50 text-orange-700' },
    oemAnomalies.count > 0 && { label: `${oemAnomalies.count} ${dict.roleDashboard.oemAnomalyAlert}`, href: '/production',              icon: Factory,       cls: 'border-orange-300 bg-orange-50 text-orange-700' },
  ].filter(Boolean) as { label: string; href: string; icon: typeof Clock; cls: string }[]

  return (
    <div className="space-y-5">
      <DashboardHeader title={d.title} />

      {/* Monthly Progress */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-blue-200 text-sm font-medium">{dict.roleDashboard.monthRevenue}</p>
            <p className="text-4xl font-bold mt-1">{fmt(month.revenue)}</p>
            {month.revenueGrowth !== null && (
              <p className={`text-sm mt-1 flex items-center gap-1 ${month.revenueGrowth >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {month.revenueGrowth >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {month.revenueGrowth >= 0 ? '+' : ''}{month.revenueGrowth}% {dict.roleDashboard.vsLastMonthLabel}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-blue-200 text-sm">{dict.roleDashboard.monthOrdersLabel}</p>
            <p className="text-2xl font-bold">{month.orders} <span className="text-lg text-blue-200">{dict.roleDashboard.monthOrderUnit}</span></p>
            {month.orderGrowth !== null && (
              <p className={`text-xs ${month.orderGrowth >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {month.orderGrowth >= 0 ? '+' : ''}{month.orderGrowth}%
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-blue-500 pt-4">
          <div>
            <p className="text-blue-200 text-xs">{dict.roleDashboard.grossProfitLabel}</p>
            <p className="text-lg font-semibold">{fmt(month.grossProfit)}</p>
            <p className="text-blue-300 text-xs">{dict.roleDashboard.marginRateLabel} {month.grossMargin}%</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs">{dict.roleDashboard.todayLabel}</p>
            <p className="text-lg font-semibold">{fmt(today.revenue)}</p>
            <p className="text-blue-300 text-xs">{today.orders} {dict.roleDashboard.todayOrderUnit}</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alertItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {dict.roleDashboard.needsAttention}
          </h2>
          <AlertBanner items={alertItems} />
        </div>
      )}

      {/* Finance */}
      {(receivable.total > 0 || payable.total > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {receivable.total > 0 && (
            <Link href="/payments">
              <Card className="border-amber-200 hover:border-amber-400 transition-colors">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{d.receivable}</p>
                  <p className="text-lg font-bold text-amber-700 mt-0.5">{fmt(receivable.total)}</p>
                  <p className="text-xs text-muted-foreground">{receivable.count} {dict.roleDashboard.unpaidCount}</p>
                </CardContent>
              </Card>
            </Link>
          )}
          {payable.total > 0 && (
            <Link href="/payments">
              <Card className="hover:border-slate-400 transition-colors">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{d.payable}</p>
                  <p className="text-lg font-bold text-slate-800 mt-0.5">{fmt(payable.total)}</p>
                  <p className="text-xs text-muted-foreground">{payable.count} {dict.roleDashboard.unpaidPayCount}</p>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* ── Company KPI ── */}
      {kpiWithTarget.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{dict.kpi.monthlyTargetAchieve}</CardTitle>
              <Link href="/kpi" className="text-xs text-blue-600 hover:underline">{dict.kpi.detail} →</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-3 rounded-full transition-all duration-700 ${
                  companyAchieve >= 100 ? 'bg-green-500' : companyAchieve >= 70 ? 'bg-blue-500' :
                  companyAchieve >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`} style={{ width: `${Math.min(100, companyAchieve)}%` }} />
              </div>
              <span className="text-xl font-bold">{companyAchieve}%</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mb-3">
              <span>{dict.kpi.actual} {fmt(companyActual)}</span>
              <span>{dict.kpi.target} {fmt(companyTarget)}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {kpiWithTarget
                .sort((a, b) => b.achieveRate - a.achieveRate)
                .slice(0, 5)
                .map(k => (
                <div key={k.userId} className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-xs font-medium truncate">{k.user?.name}</p>
                  <p className={`text-lg font-bold ${
                    k.achieveRate >= 100 ? 'text-green-600' : k.achieveRate >= 70 ? 'text-blue-600' :
                    k.achieveRate >= 40 ? 'text-amber-600' : 'text-red-600'
                  }`}>{k.achieveRate}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Trend + Recent Orders */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{d.revenueTrend}</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueTrend.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{d.noHistory}</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} />
                  <Tooltip
                    formatter={(v) => [fmt(Number(v ?? 0)), d.salesAmount]}
                    labelFormatter={(l) => `${l}`}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{d.recentOrders}</CardTitle>
              <Link href="/orders" className="text-xs text-blue-600 hover:underline">{d.viewAll} →</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">{d.noSalesData}</p>
            ) : (
              <div className="divide-y">
                {recentOrders.slice(0, 6).map((o) => {
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

      {/* Stock Alerts */}
      {(lowStock.items.length > 0 || outOfStock.items.length > 0) && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />{d.stockAlert}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
              {outOfStock.items.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 bg-red-50 border-b border-red-100">
                    <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                      <Ban className="h-3 w-3" />{d.stockZero}（{outOfStock.items.length}）
                    </p>
                  </div>
                  {outOfStock.items.slice(0, 5).map(item => (
                    <div key={item.productId} className="flex items-center justify-between px-4 py-1.5 border-b text-sm">
                      <span className="font-medium text-xs">{item.name}</span>
                      <span className="text-[10px] text-red-600 font-bold">{d.outOfStock}</span>
                    </div>
                  ))}
                </div>
              )}
              {lowStock.items.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />{d.belowSafety}（{lowStock.items.length}）
                    </p>
                  </div>
                  {lowStock.items.slice(0, 5).map(item => (
                    <div key={item.productId} className="flex items-center justify-between px-4 py-1.5 border-b text-sm">
                      <span className="font-medium text-xs">{item.name}</span>
                      <span className="text-xs font-bold text-amber-600">{item.quantity}/{item.safetyStock}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t">
              <Link href="/inventory" className="text-xs text-blue-600 hover:underline">{d.viewAllInventory} →</Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Panel */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowAnalytics(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors w-full"
        >
          {showAnalytics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {d.analyticsPanel}
          <span className="text-xs text-muted-foreground font-normal ml-1">{dict.roleDashboard.analyticsPanelSub}</span>
        </button>
      </div>

      {showAnalytics && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{d.b2bB2cMix}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { label: d.b2bInstitution, pct: salesMix.b2b.pct, color: 'bg-blue-500' },
                    { label: d.b2cEcommerce,   pct: salesMix.b2c.pct, color: 'bg-violet-500' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium">{item.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{d.repurchaseRate}</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                <p className="text-3xl font-bold text-slate-900">{repurchaseRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">{d.repurchaseDesc}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{d.platformSales}</CardTitle></CardHeader>
              <CardContent>
                {platformSales.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">{d.noPlatformOrders}</p>
                ) : (
                  <div className="space-y-1">
                    {platformSales.map((p, i) => {
                      const pLabel = (dict.channels.platforms as Record<string, string>)[p.platform] ?? p.platform
                      return (
                        <div key={p.platform} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span>{pLabel}</span>
                          </div>
                          <span className="font-medium">{fmtShort(p.revenue)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{d.regionSales}</CardTitle></CardHeader>
              <CardContent>
                {regionSales.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">{dict.common.noData}</p>
                ) : (
                  <div className="space-y-1">
                    {regionSales.slice(0, 6).map(r => {
                      const maxRev = regionSales[0]?.revenue ?? 1
                      return (
                        <div key={r.region}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-muted-foreground">{r.region}</span>
                            <span className="font-medium">{fmtShort(r.revenue)}</span>
                          </div>
                          <div className="h-1 rounded-full bg-slate-100">
                            <div className="h-1 rounded-full bg-teal-500" style={{ width: `${Math.round((r.revenue / maxRev) * 100)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RankingCard
              title={d.topSku} icon={<Award className="h-4 w-4 text-amber-500" />}
              items={skuRanking.map(s => ({ label: s.product?.name ?? '—', value: fmt(s.revenue), sub: `${s.quantity}${s.product?.unit ?? ''}`, revenue: s.revenue }))}
              color="bg-blue-500" noDataLabel={d.noData}
            />
            <RankingCard
              title={d.topCustomers} icon={<Users className="h-4 w-4 text-blue-500" />}
              items={customerRanking.map(c => ({ label: c.customer?.name ?? '—', value: fmt(c.revenue), sub: `${c.orders} ${d.orders}`, revenue: c.revenue }))}
              color="bg-indigo-500" noDataLabel={d.noData}
            />
            <div className="space-y-4">
              <RankingCard
                title={d.salesRanking} icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                items={salesRanking.map(s => ({ label: s.name, value: fmt(s.revenue), sub: `${s.orders} ${d.orders}`, revenue: s.revenue }))}
                color="bg-green-500" noDataLabel={d.noData}
              />
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{d.channelMix}</CardTitle></CardHeader>
                <CardContent>
                  {channelBreakdown.length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">{dict.common.noData}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {channelBreakdown.map((c, i) => {
                        const cLabel = (dict.customers.types as Record<string, string>)[c.type] ?? c.type
                        return (
                          <div key={c.type}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-muted-foreground">{cLabel}</span>
                              <span className="font-medium">{c.pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100">
                              <div className="h-1.5 rounded-full" style={{ width: `${c.pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {purchaseTrend.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{d.purchaseTrend}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={purchaseTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip formatter={(v) => [fmt(Number(v ?? 0)), d.purchaseAmount]} />
                    <Bar dataKey="cost" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
