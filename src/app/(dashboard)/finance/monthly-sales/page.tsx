'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface MonthRow { month: number; count: number; totalAmount: number; avgAmount: number }
interface SalesData { year: number; grandTotal: number; totalOrders: number; rows: MonthRow[] }

const MONTH_LABELS = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
function fmt(n: number) { return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export default function MonthlySalesPage() {
  const { dict } = useI18n()
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(false)
  const currentYear = new Date().getFullYear()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/monthly-sales?year=${year}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [year, dict])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.nav.monthlySales}</h1>
          <p className="text-sm text-muted-foreground">每月銷售訂單金額統計</p>
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
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">全年銷售總額</p>
              <p className="text-base font-mono font-bold text-green-700">${fmt(data.grandTotal)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">全年訂單數</p>
              <p className="text-base font-mono font-semibold">{data.totalOrders}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">月份</TableHead>
                  <TableHead className="text-right w-24">訂單數</TableHead>
                  <TableHead className="text-right w-36">銷售金額</TableHead>
                  <TableHead className="text-right w-32">平均訂單</TableHead>
                  <TableHead>佔比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map(row => {
                  const pct = data.grandTotal > 0 ? row.totalAmount / data.grandTotal * 100 : 0
                  return (
                    <TableRow key={row.month} className={`text-sm ${row.count === 0 ? 'text-muted-foreground' : 'hover:bg-slate-50/40'}`}>
                      <TableCell className="font-medium">{MONTH_LABELS[row.month]}</TableCell>
                      <TableCell className="text-right">{row.count || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-green-700">{row.totalAmount > 0 ? `$${fmt(row.totalAmount)}` : '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{row.avgAmount > 0 ? `$${fmt(row.avgAmount)}` : '—'}</TableCell>
                      <TableCell>
                        {pct > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                              <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-10">{pct.toFixed(1)}%</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                <TableRow className="border-t-2 bg-slate-50 font-semibold text-sm">
                  <TableCell>全年</TableCell>
                  <TableCell className="text-right">{data.totalOrders}</TableCell>
                  <TableCell className="text-right font-mono text-green-700">${fmt(data.grandTotal)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {data.totalOrders > 0 ? `$${fmt(Math.round(data.grandTotal / data.totalOrders))}` : '—'}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">請選擇年度後點擊查詢</div>}
    </div>
  )
}
