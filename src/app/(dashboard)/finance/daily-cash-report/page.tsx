'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface DayRow {
  date: string; incoming: number; outgoing: number; net: number
  closingBalance: number; accounts: string
}
interface ReportData {
  period: { startDate: string; endDate: string }
  openingBalance: number; periodIncoming: number; periodOutgoing: number; closingBalance: number
  rows: DayRow[]
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function DailyCashReportPage() {
  const { dict } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/daily-cash-report?startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate, dict])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.nav.dailyCashReport}</h1>
          <p className="text-sm text-muted-foreground">每日現金收支與累計餘額</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.startDate}</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.endDate}</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.reportsExt.generate}</Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '期初餘額', value: data.openingBalance, color: 'text-slate-700' },
              { label: '本期收入', value: data.periodIncoming, color: 'text-green-600' },
              { label: '本期支出', value: data.periodOutgoing, color: 'text-red-600' },
              { label: '期末餘額', value: data.closingBalance, color: data.closingBalance >= 0 ? 'text-slate-900 font-bold' : 'text-red-600 font-bold' },
            ].map(c => (
              <div key={c.label} className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-base font-mono ${c.color}`}>${fmt(c.value)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">{dict.common.date}</TableHead>
                  <TableHead className="text-right w-28 text-green-700">日收入</TableHead>
                  <TableHead className="text-right w-28 text-red-600">日支出</TableHead>
                  <TableHead className="text-right w-24">淨額</TableHead>
                  <TableHead className="text-right w-32">累計餘額</TableHead>
                  <TableHead>涉及帳戶</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-slate-50 text-sm italic text-muted-foreground">
                  <TableCell>{data.period.startDate}</TableCell>
                  <TableCell colSpan={3} />
                  <TableCell className="text-right font-mono font-semibold text-slate-700">${fmt(data.openingBalance)}</TableCell>
                  <TableCell>期初餘額</TableCell>
                </TableRow>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">本期間無交易</TableCell></TableRow>
                ) : data.rows.map(row => (
                  <TableRow key={row.date} className="text-sm hover:bg-slate-50/40">
                    <TableCell className="font-medium">{row.date}</TableCell>
                    <TableCell className="text-right font-mono text-green-700">{row.incoming > 0 ? `$${fmt(row.incoming)}` : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{row.outgoing > 0 ? `$${fmt(row.outgoing)}` : '—'}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-xs flex items-center justify-end gap-1 ${row.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {row.net >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {row.net >= 0 ? '+' : '-'}${fmt(row.net)}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${row.closingBalance < 0 ? 'text-red-600' : ''}`}>${fmt(row.closingBalance)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{row.accounts || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">{dict.reportsExt.noData}</div>}
    </div>
  )
}
