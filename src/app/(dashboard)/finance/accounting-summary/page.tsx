'use client'

import { useState, useCallback, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface SummaryRow { type: string; label: string; debitTotal: number; creditTotal: number; net: number; lineCount: number }
interface SummaryData {
  period: { startDate: string; endDate: string }
  entryCount: number; totalDebit: number; totalCredit: number; isBalanced: boolean
  rows: SummaryRow[]
}

function fmt(n: number) { return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

const TYPE_COLORS: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-700', LIABILITY: 'bg-amber-100 text-amber-700',
  EQUITY: 'bg-purple-100 text-purple-700', REVENUE: 'bg-green-100 text-green-700', EXPENSE: 'bg-red-100 text-red-700',
}

export default function AccountingSummaryPage() {
  const { dict } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/accounting-summary?startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">會計合計表</h1>
          <p className="text-sm text-muted-foreground">各科目類型借貸合計彙總</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">開始</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">結束</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.search}</Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">傳票筆數</p>
              <p className="text-base font-mono font-semibold">{data.entryCount}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">借方合計</p>
              <p className="text-base font-mono">${fmt(data.totalDebit)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">貸方合計</p>
              <p className="text-base font-mono">${fmt(data.totalCredit)}</p>
            </div>
            <div className={`rounded-lg border p-3 ${data.isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-muted-foreground mb-1">借貸平衡</p>
              <div className="flex items-center gap-1.5">
                {data.isBalanced
                  ? <><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-green-700 font-semibold text-sm">平衡</span></>
                  : <><AlertTriangle className="h-4 w-4 text-red-600" /><span className="text-red-700 font-semibold text-sm">不平衡</span></>}
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>科目類型</TableHead>
                  <TableHead className="text-right w-32">借方合計</TableHead>
                  <TableHead className="text-right w-32">貸方合計</TableHead>
                  <TableHead className="text-right w-32">淨額</TableHead>
                  <TableHead className="text-right w-20">分錄筆數</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map(row => (
                  <TableRow key={row.type} className="text-sm hover:bg-slate-50/40">
                    <TableCell><Badge className={`text-xs ${TYPE_COLORS[row.type] ?? ''}`}>{row.label}</Badge></TableCell>
                    <TableCell className="text-right font-mono">${fmt(row.debitTotal)}</TableCell>
                    <TableCell className="text-right font-mono">${fmt(row.creditTotal)}</TableCell>
                    <TableCell className={`text-right font-mono font-medium ${row.net < 0 ? 'text-red-600' : ''}`}>
                      {row.net >= 0 ? '' : '-'}${fmt(row.net)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.lineCount}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 bg-slate-50 font-semibold">
                  <TableCell>合計</TableCell>
                  <TableCell className="text-right font-mono">${fmt(data.totalDebit)}</TableCell>
                  <TableCell className="text-right font-mono">${fmt(data.totalCredit)}</TableCell>
                  <TableCell className={`text-right font-mono ${data.isBalanced ? 'text-green-700' : 'text-red-600'}`}>
                    {data.isBalanced ? '平衡 ✓' : `差額 $${fmt(Math.abs(data.totalDebit - data.totalCredit))}`}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{data.rows.reduce((s, r) => s + r.lineCount, 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">{dict.reportsExt.noData}</div>}
    </div>
  )
}
