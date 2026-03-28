'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface TurnoverData {
  year: number; revenue: number; expense: number
  ar: { opening: number; closing: number; average: number; turnover: number; dso: number }
  ap: { opening: number; closing: number; average: number; turnover: number; dpo: number }
  cashConversionCycle: number
}

function fmt(n: number) { return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtDays(n: number) { return n > 0 ? `${Math.round(n)} 天` : '—' }
function fmtRatio(n: number) { return n > 0 ? `${n.toFixed(2)} 次` : '—' }

function MetricCard({ label, value, sub, color = '' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-mono font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export default function ARAPTurnoverPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<TurnoverData | null>(null)
  const [loading, setLoading] = useState(false)
  const currentYear = new Date().getFullYear()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/ar-ap-turnover?year=${year}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [year])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">應收/應付回收期間表</h1>
          <p className="text-sm text-muted-foreground">AR/AP 周轉率與收付款天數分析</p>
        </div>
      </div>
      <div className="flex items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">年度</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-md border px-3 py-2 text-sm">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y} 年</option>)}
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢</Button>
      </div>
      {data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* AR Section */}
            <div className="rounded-lg border bg-blue-50 p-4 space-y-3">
              <h3 className="font-semibold text-blue-800">應收帳款（AR）</h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="期初 AR 餘額" value={`$${fmt(data.ar.opening)}`} />
                <MetricCard label="期末 AR 餘額" value={`$${fmt(data.ar.closing)}`} />
                <MetricCard label="平均 AR 餘額" value={`$${fmt(data.ar.average)}`} />
                <MetricCard label="年度收入" value={`$${fmt(data.revenue)}`} color="text-green-600" />
                <MetricCard label="AR 周轉率" value={fmtRatio(data.ar.turnover)} sub="收入 / 平均AR" color="text-blue-700" />
                <MetricCard label="收款天數 (DSO)" value={fmtDays(data.ar.dso)} sub="越低越好" color={data.ar.dso > 60 ? 'text-red-600' : 'text-green-700'} />
              </div>
            </div>
            {/* AP Section */}
            <div className="rounded-lg border bg-amber-50 p-4 space-y-3">
              <h3 className="font-semibold text-amber-800">應付帳款（AP）</h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="期初 AP 餘額" value={`$${fmt(data.ap.opening)}`} />
                <MetricCard label="期末 AP 餘額" value={`$${fmt(data.ap.closing)}`} />
                <MetricCard label="平均 AP 餘額" value={`$${fmt(data.ap.average)}`} />
                <MetricCard label="年度費用" value={`$${fmt(data.expense)}`} color="text-red-600" />
                <MetricCard label="AP 周轉率" value={fmtRatio(data.ap.turnover)} sub="費用 / 平均AP" color="text-amber-700" />
                <MetricCard label="付款天數 (DPO)" value={fmtDays(data.ap.dpo)} sub="越高越有利" color={data.ap.dpo < 30 ? 'text-amber-600' : 'text-green-700'} />
              </div>
            </div>
          </div>
          <div className={`rounded-lg border p-4 ${data.cashConversionCycle <= 0 ? 'bg-green-50 border-green-200' : 'bg-slate-50'}`}>
            <p className="text-sm text-muted-foreground mb-1">現金轉換週期（CCC）= DSO - DPO</p>
            <p className={`text-3xl font-mono font-bold ${data.cashConversionCycle <= 0 ? 'text-green-700' : data.cashConversionCycle > 60 ? 'text-red-600' : 'text-slate-800'}`}>
              {Math.round(data.cashConversionCycle)} 天
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.cashConversionCycle <= 0 ? '公司付款慢於收款，資金效率良好' : data.cashConversionCycle > 60 ? '收款周期過長，建議加強催收' : '收款周期正常'}
            </p>
          </div>
        </div>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">請選擇年度後點擊查詢</div>}
    </div>
  )
}
