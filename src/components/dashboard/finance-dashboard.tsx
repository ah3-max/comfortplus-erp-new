'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DollarSign, TrendingUp, AlertTriangle, CreditCard,
  Receipt, FileText, Clock, ArrowRight,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import {
  fmt, fmtShort, COLORS,
  DashboardLoading, DashboardHeader, QuickAction, SectionHeader,
} from './shared'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface FinanceDashboardData {
  receivable: { total: number; count: number }
  payable: { total: number; count: number }
  arAging: { current: number; days30: number; days60: number; days90: number; over90: number }
  todayCollections: { collected: number; paid: number }
  monthSummary: { revenue: number; cost: number; grossProfit: number; grossMargin: number; purchaseCost: number }
  overdueCustomers: { customerId: string; name: string; overdue: number }[]
  pendingReconciliation: number
}

export function FinanceDashboard() {
  const { dict } = useI18n()
  const [data, setData] = useState<FinanceDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/finance').then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLoading />
  if (!data) return null

  const { receivable, payable, arAging, todayCollections, monthSummary, overdueCustomers, pendingReconciliation } = data

  const rd = dict.roleDashboard
  const agingData = [
    { name: rd.aging30, amount: arAging.current },
    { name: rd.aging31to60, amount: arAging.days30 },
    { name: rd.aging61to90, amount: arAging.days60 },
    { name: rd.agingOver90, amount: arAging.over90 },
  ]

  const hasOverdue = arAging.days60 + arAging.over90 > 0

  return (
    <div className="space-y-5">
      <DashboardHeader title={dict.roleDashboard.financeWorkbench} />

      {/* ── AR / AP Banner ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-lg">
          <p className="text-amber-100 text-sm font-medium">{dict.roleDashboard.accountsReceivable}</p>
          <p className="text-3xl font-bold mt-1">{fmt(receivable.total)}</p>
          <p className="text-amber-200 text-xs mt-1">{receivable.count} {dict.roleDashboard.unpaidCount}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 p-5 text-white shadow-lg">
          <p className="text-slate-300 text-sm font-medium">{dict.roleDashboard.accountsPayable}</p>
          <p className="text-3xl font-bold mt-1">{fmt(payable.total)}</p>
          <p className="text-slate-400 text-xs mt-1">{payable.count} {dict.roleDashboard.unpaidPayable}</p>
        </div>
      </div>

      {/* ── Today's Collections ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-green-200">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.todayCollection}</p>
            <p className="text-2xl font-bold text-green-600 mt-0.5">{fmt(todayCollections.collected)}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{dict.roleDashboard.todayPayment}</p>
            <p className="text-2xl font-bold text-blue-600 mt-0.5">{fmt(todayCollections.paid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-3 gap-2">
        <QuickAction label={dict.roleDashboard.registerPayment} href="/payments" icon={CreditCard} color="bg-green-600" />
        <QuickAction label={dict.roleDashboard.exportStatement} href="/payments" icon={FileText} color="bg-blue-600" />
        <QuickAction label={dict.roleDashboard.issueInvoice} href="/payments" icon={Receipt} color="bg-violet-600" />
      </div>

      {/* ── Alerts ── */}
      {(hasOverdue || pendingReconciliation > 0) && (
        <div className="space-y-2">
          <SectionHeader title={dict.roleDashboard.needsAttention} icon={AlertTriangle} iconColor="text-amber-500" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {hasOverdue && (
              <Link href="/ar-aging"
                className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 text-red-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {fmt(arAging.days60 + arAging.over90)} {dict.roleDashboard.overdueAmount}
                </span>
              </Link>
            )}
            {pendingReconciliation > 0 && (
              <Link href="/payments"
                className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 px-4 py-3 hover:opacity-90 transition-opacity">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{pendingReconciliation} {dict.roleDashboard.pendingReconciliation}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── AR Aging + P&L ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* AR Aging Chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              {dict.roleDashboard.agingDistribution}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={agingData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} />
                <Tooltip formatter={(v) => [fmt(Number(v ?? 0)), dict.roleDashboard.revenue]} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly P&L */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              {dict.roleDashboard.monthPnl}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-sm text-muted-foreground">{dict.roleDashboard.revenue}</span>
              <span className="text-sm font-bold">{fmt(monthSummary.revenue)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-sm text-muted-foreground">{dict.roleDashboard.cost}</span>
              <span className="text-sm font-bold text-red-600">-{fmt(monthSummary.cost)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-sm font-medium">{dict.roleDashboard.grossProfit}</span>
              <span className="text-sm font-bold text-green-600">{fmt(monthSummary.grossProfit)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-sm text-muted-foreground">{dict.roleDashboard.grossMarginRate}</span>
              <span className="text-sm font-bold">{monthSummary.grossMargin}%</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm text-muted-foreground">{dict.roleDashboard.purchaseSpend}</span>
              <span className="text-sm font-bold text-slate-600">{fmt(monthSummary.purchaseCost)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Overdue Customers ── */}
      {overdueCustomers.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                {dict.roleDashboard.overdueCustomers}
              </CardTitle>
              <Link href="/ar-aging" className="text-xs text-blue-600 hover:underline">{`${dict.common.all} →`}</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {overdueCustomers.map(c => (
                <Link key={c.customerId} href={`/customers/${c.customerId}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/80 transition-colors">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-sm font-bold text-red-600">{fmt(c.overdue)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
