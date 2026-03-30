'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TrendingUp, TrendingDown, Users, Target,
  FileText, AlertTriangle, Phone, MapPin,
  CheckCircle2, Clock, ListTodo, ShoppingCart, Plus,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import {
  fmt, DashboardLoading, DashboardHeader, RankingCard, SectionHeader, QuickAction,
} from './shared'

interface SalesManagerData {
  team: { memberCount: number; members: { id: string; name: string; role: string }[] }
  today: { orders: number; revenue: number }
  month: { revenue: number; growth: number | null; orders: number }
  salesRanking: { userId: string; name: string; revenue: number; orders: number }[]
  funnel: { quotes: number; converted: number; conversionRate: number }
  pending: { quotations: number; discounts: number }
  customerHealth: { unvisitedCount: number }
  activity: { visits: number; calls: number }
}

interface TeamTargetData {
  userId: string
  user: { id: string; name: string; role: string } | null
  targets: { revenue: number; orders: number; visits: number; newCustomers: number }
  actuals: { revenue: number; orders: number; visits: number; newCustomers: number }
  achieveRate: number
  hasTarget: boolean
}

interface ReportSummary {
  submittedCount: number
  totalCount: number
  reps: { rep: { id: string; name: string; role: string }; report: { visitCount: number; callCount: number; orderCount: number; orderAmount: string; submittedAt: string } | null; submitted: boolean }[]
}

export function SalesManagerDashboard() {
  const [data, setData] = useState<SalesManagerData | null>(null)
  const [targets, setTargets] = useState<TeamTargetData[]>([])
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const { dict } = useI18n()

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/sales-manager').then(r => r.json()),
      fetch('/api/sales-targets?team=true').then(r => r.json()),
      fetch('/api/sales-daily-report/summary').then(r => r.ok ? r.json() : null),
    ]).then(([managerData, targetData, summaryData]) => {
      setData(managerData)
      setTargets(Array.isArray(targetData) ? targetData : [])
      setReportSummary(summaryData)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLoading />
  if (!data) return null

  const { team, today, month, salesRanking, funnel, pending, customerHealth, activity } = data
  const pendingTotal = pending.quotations + pending.discounts

  // Team target stats
  const teamTargetRev = targets.reduce((s, t) => s + t.targets.revenue, 0)
  const teamActualRev = targets.reduce((s, t) => s + t.actuals.revenue, 0)
  const teamAchieve = teamTargetRev > 0 ? Math.round((teamActualRev / teamTargetRev) * 1000) / 10 : 0

  return (
    <div className="space-y-5">
      <DashboardHeader title={dict.roleDashboard.teamDashboard} />

      {/* ── Team Revenue Banner ── */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-indigo-200 text-sm font-medium">{dict.roleDashboard.teamRevenue}</p>
            <p className="text-4xl font-bold mt-1">{fmt(month.revenue)}</p>
            {month.growth !== null && (
              <p className={`text-sm mt-1 flex items-center gap-1 ${month.growth >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {month.growth >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {month.growth >= 0 ? '+' : ''}{month.growth}% {dict.roleDashboard.comparedLastMonth}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-sm">{dict.roleDashboard.teamMembers}</p>
            <p className="text-2xl font-bold">{team.memberCount}</p>
            <p className="text-indigo-300 text-xs">{month.orders} {dict.roleDashboard.orderCountUnit}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-indigo-500 pt-3">
          <div>
            <p className="text-indigo-200 text-xs">{dict.roleDashboard.todayRevenue}</p>
            <p className="text-lg font-semibold">{fmt(today.revenue)}</p>
            <p className="text-indigo-300 text-xs">{today.orders} {dict.roleDashboard.orderCountUnit}</p>
          </div>
          <div>
            <p className="text-indigo-200 text-xs">{dict.roleDashboard.teamVisits}</p>
            <p className="text-lg font-semibold">{activity.visits}</p>
            <p className="text-indigo-300 text-xs">{dict.roleDashboard.monthAccum}</p>
          </div>
          <div>
            <p className="text-indigo-200 text-xs">{dict.roleDashboard.teamCalls}</p>
            <p className="text-lg font-semibold">{activity.calls}</p>
            <p className="text-indigo-300 text-xs">{dict.roleDashboard.monthAccum}</p>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <QuickAction label={dict.roleDashboard.assignTask} href="/tasks?action=new" icon={ListTodo} color="bg-rose-600" />
        <QuickAction label={dict.roleDashboard.quickPlaceOrder} href="/orders?action=new" icon={ShoppingCart} color="bg-emerald-600" />
        <QuickAction label={dict.roleDashboard.newCustomerBtn} href="/customers?action=new" icon={Users} color="bg-cyan-600" />
        <QuickAction label={dict.roleDashboard.newQuotationBtn} href="/quotations?action=new" icon={Plus} color="bg-blue-600" />
        <QuickAction label={dict.roleDashboard.visitLogBtn} href="/quick-input" icon={MapPin} color="bg-violet-600" />
      </div>

      {/* ── Team KPI Target ── */}
      {targets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-500" />
                {dict.roleDashboard.teamTarget}
              </CardTitle>
              <Link href="/kpi" className="text-xs text-blue-600 hover:underline">{dict.roleDashboard.manageTargets} →</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Team overall */}
            <div className="flex items-center gap-3 mb-1">
              <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-3 rounded-full transition-all duration-700 ${
                  teamAchieve >= 100 ? 'bg-green-500' : teamAchieve >= 70 ? 'bg-blue-500' :
                  teamAchieve >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`} style={{ width: `${Math.min(100, teamAchieve)}%` }} />
              </div>
              <span className="text-lg font-bold shrink-0">{teamAchieve}%</span>
            </div>

            {/* Per-person */}
            <div className="space-y-2">
              {targets
                .filter(t => t.hasTarget)
                .sort((a, b) => b.achieveRate - a.achieveRate)
                .map(t => (
                <div key={t.userId} className="flex items-center gap-2">
                  <span className="w-16 text-xs font-medium truncate">{t.user?.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-2 rounded-full ${
                      t.achieveRate >= 100 ? 'bg-green-500' : t.achieveRate >= 70 ? 'bg-blue-500' :
                      t.achieveRate >= 40 ? 'bg-amber-500' : 'bg-red-400'
                    }`} style={{ width: `${Math.min(100, t.achieveRate)}%` }} />
                  </div>
                  <span className={`text-xs font-bold w-12 text-right ${
                    t.achieveRate >= 100 ? 'text-green-600' : t.achieveRate >= 70 ? 'text-blue-600' :
                    t.achieveRate >= 40 ? 'text-amber-600' : 'text-red-600'
                  }`}>{t.achieveRate}%</span>
                </div>
              ))}
              {targets.filter(t => !t.hasTarget).length > 0 && (
                <p className="text-xs text-amber-600">
                  {targets.filter(t => !t.hasTarget).length} {dict.roleDashboard.notSetCount}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Daily Report Summary ── */}
      {reportSummary && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                今日日報
                <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${
                  reportSummary.submittedCount === reportSummary.totalCount
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {reportSummary.submittedCount} / {reportSummary.totalCount} 人已提交
                </span>
              </CardTitle>
              <Link href="/sales-daily-report" className="text-xs text-blue-600 hover:underline">查看全部 →</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {reportSummary.reps.map(({ rep, report, submitted }) => (
                <Link key={rep.id} href={`/sales-daily-report?repId=${rep.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                      {rep.name.slice(0, 1)}
                    </div>
                    <span className="text-sm font-medium">{rep.name}</span>
                    {submitted ? (
                      <span className="flex items-center gap-0.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" />已提交
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" />未提交
                      </span>
                    )}
                  </div>
                  {submitted && report && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{report.visitCount}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{report.callCount}</span>
                      <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" />{report.orderCount}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pending Approvals + Customer Health ── */}
      {(pendingTotal > 0 || customerHealth.unvisitedCount > 0) && (
        <div className="space-y-2">
          <SectionHeader title={dict.roleDashboard.needsAttention} icon={AlertTriangle} iconColor="text-amber-500" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {pending.quotations > 0 && (
              <Link href="/quotations?status=PENDING_APPROVAL"
                className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{pending.quotations} {dict.roleDashboard.pendingApproval}</span>
              </Link>
            )}
            {pending.discounts > 0 && (
              <Link href="/quotations"
                className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 text-orange-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <Target className="h-4 w-4" />
                <span className="text-sm font-medium">{pending.discounts} {dict.roleDashboard.discountApproval}</span>
              </Link>
            )}
            {customerHealth.unvisitedCount > 0 && (
              <Link href="/customers"
                className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 text-red-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">{customerHealth.unvisitedCount} {dict.roleDashboard.unvisitedCustomers}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Funnel + Sales Ranking ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Funnel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" />
              {dict.roleDashboard.funnelAnalysis}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-5xl font-bold text-indigo-600">{funnel.conversionRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">{dict.roleDashboard.quoteToOrderRate}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{dict.roleDashboard.monthQuotes}</span>
                <span className="font-bold">{funnel.quotes}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100">
                <div className="h-3 rounded-full bg-indigo-500" style={{ width: '100%' }} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{dict.roleDashboard.converted}</span>
                <span className="font-bold text-green-600">{funnel.converted}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100">
                <div className="h-3 rounded-full bg-green-500" style={{ width: `${funnel.conversionRate}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Ranking */}
        <div className="lg:col-span-3">
          <RankingCard
            title={dict.roleDashboard.salesRanking}
            icon={<TrendingUp className="h-4 w-4 text-green-500" />}
            items={salesRanking.map(s => ({
              label: s.name,
              value: fmt(s.revenue),
              sub: `${s.orders} ${dict.roleDashboard.orderUnit}`,
              revenue: s.revenue,
            }))}
            color="bg-indigo-500"
            noDataLabel={dict.roleDashboard.noSalesData}
          />
        </div>
      </div>

      {/* ── Team Activity Summary ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            {dict.roleDashboard.teamActivity}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {team.members.map(m => {
              const memberSales = salesRanking.find(s => s.userId === m.id)
              return (
                <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                      {m.name.slice(0, 1)}
                    </div>
                    <div>
                      <span className="text-sm font-medium">{m.name}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {dict.roles[m.role as keyof typeof dict.roles] ?? m.role}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">{fmt(memberSales?.revenue ?? 0)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{memberSales?.orders ?? 0} {dict.roleDashboard.orderUnit}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
