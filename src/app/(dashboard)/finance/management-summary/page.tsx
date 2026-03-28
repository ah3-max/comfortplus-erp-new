'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface KPI { key: string; label: string; value: number; prev: number | null; change: number | null; unit: string; sub?: string }
interface SummaryData { period: { year: number; month: number }; kpis: KPI[] }

function fmt(n: number, unit: string) {
  if (unit === '%') return `${n.toFixed(1)}%`
  return `$${Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function KPICard({ kpi }: { kpi: KPI }) {
  const isPositive = (kpi.change ?? 0) > 0
  const isNegative = (kpi.change ?? 0) < 0
  const goodUp = ['revenue', 'netIncome', 'grossMargin', 'cashReceived', 'orderAmount'].includes(kpi.key)

  return (
    <div className="rounded-lg border bg-white p-4 space-y-2">
      <p className="text-xs text-muted-foreground">{kpi.label}</p>
      <p className={`text-xl font-mono font-bold ${kpi.key === 'expense' || kpi.key === 'apBalance' ? 'text-red-600' : kpi.key === 'arBalance' ? 'text-amber-600' : 'text-slate-900'}`}>
        {fmt(kpi.value, kpi.unit)}
      </p>
      {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
      {kpi.change !== null && (
        <div className={`flex items-center gap-1 text-xs ${isPositive && goodUp ? 'text-green-600' : isNegative && goodUp ? 'text-red-600' : isPositive ? 'text-red-600' : isNegative ? 'text-green-600' : 'text-muted-foreground'}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {kpi.change !== null ? `${kpi.change > 0 ? '+' : ''}${kpi.change}% 環比` : '無上期資料'}
        </div>
      )}
    </div>
  )
}

export default function ManagementSummaryPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const currentYear = now.getFullYear()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/management-summary?year=${year}&month=${month}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [year, month])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">經營概要報告書</h1>
          <p className="text-sm text-muted-foreground">月度 KPI 一覽與環比分析</p>
        </div>
      </div>
      <div className="flex items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">年度</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-md border px-3 py-2 text-sm">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y} 年</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">月份</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-md border px-3 py-2 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢</Button>
      </div>
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.kpis.map(kpi => <KPICard key={kpi.key} kpi={kpi} />)}
        </div>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">請選擇年月後點擊查詢</div>}
    </div>
  )
}
