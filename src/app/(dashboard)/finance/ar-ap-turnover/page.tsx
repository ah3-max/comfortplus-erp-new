'use client'

import { useState, useCallback, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
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
  const { dict } = useI18n()
  const fp = dict.financePages
  const fmtDays = (n: number) => n > 0 ? `${Math.round(n)}${fp.ararDaySuffix}` : '—'
  const fmtRatio = (n: number) => n > 0 ? `${n.toFixed(2)}${fp.ararRatioSuffix}` : '—'
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
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [year])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{fp.ararTitle}</h1>
          <p className="text-sm text-muted-foreground">{fp.ararDesc}</p>
        </div>
      </div>
      <div className="flex items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{fp.ararYearLabel}</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-md border px-3 py-2 text-sm">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y}{fp.ararYearSuffix}</option>)}
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.search}</Button>
      </div>
      {data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* AR Section */}
            <div className="rounded-lg border bg-blue-50 p-4 space-y-3">
              <h3 className="font-semibold text-blue-800">{fp.ararArSection}</h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label={fp.ararOpeningAr} value={`$${fmt(data.ar.opening)}`} />
                <MetricCard label={fp.ararClosingAr} value={`$${fmt(data.ar.closing)}`} />
                <MetricCard label={fp.ararAvgAr} value={`$${fmt(data.ar.average)}`} />
                <MetricCard label={fp.ararRevenue} value={`$${fmt(data.revenue)}`} color="text-green-600" />
                <MetricCard label={fp.ararArTurnover} value={fmtRatio(data.ar.turnover)} sub={fp.ararArTurnoverSub} color="text-blue-700" />
                <MetricCard label={fp.ararDso} value={fmtDays(data.ar.dso)} sub={fp.ararDsoSub} color={data.ar.dso > 60 ? 'text-red-600' : 'text-green-700'} />
              </div>
            </div>
            {/* AP Section */}
            <div className="rounded-lg border bg-amber-50 p-4 space-y-3">
              <h3 className="font-semibold text-amber-800">{fp.ararApSection}</h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label={fp.ararOpeningAp} value={`$${fmt(data.ap.opening)}`} />
                <MetricCard label={fp.ararClosingAp} value={`$${fmt(data.ap.closing)}`} />
                <MetricCard label={fp.ararAvgAp} value={`$${fmt(data.ap.average)}`} />
                <MetricCard label={fp.ararExpense} value={`$${fmt(data.expense)}`} color="text-red-600" />
                <MetricCard label={fp.ararApTurnover} value={fmtRatio(data.ap.turnover)} sub={fp.ararApTurnoverSub} color="text-amber-700" />
                <MetricCard label={fp.ararDpo} value={fmtDays(data.ap.dpo)} sub={fp.ararDpoSub} color={data.ap.dpo < 30 ? 'text-amber-600' : 'text-green-700'} />
              </div>
            </div>
          </div>
          <div className={`rounded-lg border p-4 ${data.cashConversionCycle <= 0 ? 'bg-green-50 border-green-200' : 'bg-slate-50'}`}>
            <p className="text-sm text-muted-foreground mb-1">{fp.ararCccLabel}</p>
            <p className={`text-3xl font-mono font-bold ${data.cashConversionCycle <= 0 ? 'text-green-700' : data.cashConversionCycle > 60 ? 'text-red-600' : 'text-slate-800'}`}>
              {Math.round(data.cashConversionCycle)}{fp.ararDaySuffix}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.cashConversionCycle <= 0 ? fp.ararCccGood : data.cashConversionCycle > 60 ? fp.ararCccBad : fp.ararCccNormal}
            </p>
          </div>
        </div>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">{dict.reportsExt.noData}</div>}
    </div>
  )
}
