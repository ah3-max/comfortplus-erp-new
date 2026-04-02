'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface MonthlyCostData {
  year: number; months: number[]
  totalByMonth: number[]; grandTotal: number
  accounts: Array<{ code: string; name: string; subType: string | null; monthly: number[]; total: number }>
}

function fmt(n: number) {
  if (n === 0) return '—'
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export default function MonthlyCostPage() {
  const { dict } = useI18n()
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<MonthlyCostData | null>(null)
  const [loading, setLoading] = useState(false)
  const currentYear = new Date().getFullYear()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/monthly-cost?year=${year}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [year, dict])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.nav.monthlyCost}</h1>
          <p className="text-sm text-muted-foreground">各費用科目每月成本明細</p>
        </div>
      </div>
      <div className="flex items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.reportsExt.period}</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-md border px-3 py-2 text-sm">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y} 年</option>)}
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.reportsExt.generate}</Button>
      </div>
      {data && (
        <>
          <div className="rounded-lg border bg-white p-3">
            <span className="text-xs text-muted-foreground">全年費用合計 </span>
            <span className="font-mono font-bold text-red-600">${fmt(data.grandTotal)}</span>
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-slate-50 w-40">科目</th>
                  {MONTH_LABELS.map(m => <th key={m} className="text-right px-2 py-3 font-medium text-muted-foreground w-20">{m}</th>)}
                  <th className="text-right px-3 py-3 font-semibold w-24">合計</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b bg-red-50/50">
                  <td className="px-4 py-2.5 font-semibold sticky left-0 bg-red-50/50 text-red-700">費用合計</td>
                  {data.totalByMonth.map((v, i) => (
                    <td key={i} className="text-right px-2 py-2.5 font-mono text-xs text-red-600">{v !== 0 ? `$${fmt(v)}` : '—'}</td>
                  ))}
                  <td className="text-right px-3 py-2.5 font-mono text-xs font-bold text-red-600">${fmt(data.grandTotal)}</td>
                </tr>
                {data.accounts.map(acc => (
                  <tr key={acc.code} className="border-b hover:bg-slate-50/40">
                    <td className="px-4 py-2 sticky left-0 bg-white">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{acc.code}</span>
                      <span>{acc.name}</span>
                      {acc.subType && <span className="ml-1 text-xs text-muted-foreground">({acc.subType})</span>}
                    </td>
                    {acc.monthly.map((v, i) => (
                      <td key={i} className="text-right px-2 py-2 font-mono text-xs text-muted-foreground">{v !== 0 ? `$${fmt(v)}` : ''}</td>
                    ))}
                    <td className="text-right px-3 py-2 font-mono text-xs font-medium text-red-600">${fmt(acc.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">{dict.reportsExt.noData}</div>}
    </div>
  )
}
