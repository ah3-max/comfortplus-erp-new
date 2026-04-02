'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts'

interface MonthlyAccount {
  code: string
  name: string
  type: string
  monthly: number[]
  total: number
}

interface MonthlyPLData {
  year: number
  months: number[]
  summary: {
    revenue: number[]
    expense: number[]
    netIncome: number[]
    totalRevenue: number
    totalExpense: number
    totalNetIncome: number
  }
  accounts: MonthlyAccount[]
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function fmt(n: number) {
  return new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function MonthlyPLPageInner() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<MonthlyPLData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/monthly-pl?year=${year}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { fetchData() }, [fetchData])

  const chartData = MONTH_LABELS.map((label, i) => ({
    month: label,
    收入: data?.summary.revenue[i] ?? 0,
    費用: data?.summary.expense[i] ?? 0,
    淨利: data?.summary.netIncome[i] ?? 0,
  }))

  const revenueAccounts = data?.accounts.filter(a => a.type === 'REVENUE' && a.total !== 0) ?? []
  const expenseAccounts = data?.accounts.filter(a => a.type === 'EXPENSE' && a.total !== 0) ?? []

  const netIncome = data?.summary.totalNetIncome ?? 0

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">損益月報</h1>
          <p className="text-sm text-muted-foreground mt-0.5">按月份檢視收入、費用與淨利</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> 載入中…
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">總收入</p>
                    <p className="text-2xl font-bold text-blue-600">NT$ {fmt(data?.summary.totalRevenue ?? 0)}</p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-blue-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">總費用</p>
                    <p className="text-2xl font-bold text-red-600">NT$ {fmt(data?.summary.totalExpense ?? 0)}</p>
                  </div>
                  <TrendingDown className="h-10 w-10 text-red-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">淨利</p>
                    <p className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      NT$ {fmt(netIncome)}
                    </p>
                  </div>
                  {netIncome >= 0
                    ? <TrendingUp className="h-10 w-10 text-green-200" />
                    : <Minus className="h-10 w-10 text-red-200" />
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bar Chart: Revenue vs Expense */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">月度收支對比</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => `NT$ ${fmt(Number(v))}`} />
                  <Legend />
                  <Bar dataKey="收入" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="費用" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Net Income Line */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">月度淨利趨勢</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => `NT$ ${fmt(Number(v))}`} />
                  <Line type="monotone" dataKey="淨利" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Detail Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">月度明細表</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium sticky left-0 bg-muted/50 min-w-32">科目</th>
                    {MONTH_LABELS.map(m => (
                      <th key={m} className="text-right p-3 font-medium min-w-20">{m}</th>
                    ))}
                    <th className="text-right p-3 font-medium min-w-24 bg-muted">全年合計</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Revenue group */}
                  <tr className="bg-blue-50/60">
                    <td colSpan={14} className="p-2 px-3 font-semibold text-blue-700 text-xs">收入</td>
                  </tr>
                  {revenueAccounts.map(a => (
                    <tr key={a.code} className="border-b hover:bg-muted/30">
                      <td className="p-3 sticky left-0 bg-white text-muted-foreground">
                        <span className="font-mono mr-1 text-[10px]">{a.code}</span>{a.name}
                      </td>
                      {a.monthly.map((v, i) => (
                        <td key={i} className="p-3 text-right text-blue-700">{v !== 0 ? fmt(v) : '—'}</td>
                      ))}
                      <td className="p-3 text-right font-semibold text-blue-700 bg-blue-50">{fmt(a.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-100/60 font-semibold">
                    <td className="p-3 sticky left-0 bg-blue-100/60 text-blue-800">收入合計</td>
                    {(data?.summary.revenue ?? Array(12).fill(0)).map((v, i) => (
                      <td key={i} className="p-3 text-right text-blue-800">{v !== 0 ? fmt(v) : '—'}</td>
                    ))}
                    <td className="p-3 text-right text-blue-800 bg-blue-50">{fmt(data?.summary.totalRevenue ?? 0)}</td>
                  </tr>

                  {/* Expense group */}
                  <tr className="bg-red-50/60">
                    <td colSpan={14} className="p-2 px-3 font-semibold text-red-700 text-xs">費用</td>
                  </tr>
                  {expenseAccounts.map(a => (
                    <tr key={a.code} className="border-b hover:bg-muted/30">
                      <td className="p-3 sticky left-0 bg-white text-muted-foreground">
                        <span className="font-mono mr-1 text-[10px]">{a.code}</span>{a.name}
                      </td>
                      {a.monthly.map((v, i) => (
                        <td key={i} className="p-3 text-right text-red-700">{v !== 0 ? fmt(v) : '—'}</td>
                      ))}
                      <td className="p-3 text-right font-semibold text-red-700 bg-red-50">{fmt(a.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-red-100/60 font-semibold">
                    <td className="p-3 sticky left-0 bg-red-100/60 text-red-800">費用合計</td>
                    {(data?.summary.expense ?? Array(12).fill(0)).map((v, i) => (
                      <td key={i} className="p-3 text-right text-red-800">{v !== 0 ? fmt(v) : '—'}</td>
                    ))}
                    <td className="p-3 text-right text-red-800 bg-red-50">{fmt(data?.summary.totalExpense ?? 0)}</td>
                  </tr>

                  {/* Net income */}
                  <tr className="bg-green-50 font-bold border-t-2">
                    <td className="p-3 sticky left-0 bg-green-50 text-green-800">淨利</td>
                    {(data?.summary.netIncome ?? Array(12).fill(0)).map((v, i) => (
                      <td key={i} className={`p-3 text-right ${v >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {v !== 0 ? fmt(v) : '—'}
                      </td>
                    ))}
                    <td className={`p-3 text-right bg-green-100 ${netIncome >= 0 ? 'text-green-800' : 'text-red-700'}`}>
                      {fmt(netIncome)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">資料來源：已過帳傳票</Badge>
            <Badge variant="outline">
              {netIncome >= 0 ? `獲利率 ${data ? ((netIncome / (data.summary.totalRevenue || 1)) * 100).toFixed(1) : 0}%` : '虧損'}
            </Badge>
          </div>
        </>
      )}
    </div>
  )
}

export default function MonthlyPLPage() {
  return (
    <Suspense>
      <MonthlyPLPageInner />
    </Suspense>
  )
}
