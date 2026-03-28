'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface InOutRow { key: string; incoming: number; outgoing: number; net: number }
interface InOutData {
  period: { startDate: string; endDate: string }
  groupBy: string
  summary: { totalIncoming: number; totalOutgoing: number; netFlow: number }
  rows: InOutRow[]
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function CashInOutDetailPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [groupBy, setGroupBy] = useState('method')
  const [data, setData] = useState<InOutData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/cash-inout-detail?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [startDate, endDate, groupBy])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">資金收支明細</h1>
          <p className="text-sm text-muted-foreground">按付款方式、類型或月份分類的收支統計</p>
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
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">分組</label>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="method">付款方式</option>
            <option value="type">款項類型</option>
            <option value="month">月份</option>
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢</Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">總收款</p>
              <p className="text-base font-mono font-semibold text-green-600">${fmt(data.summary.totalIncoming)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">總付款</p>
              <p className="text-base font-mono font-semibold text-red-600">${fmt(data.summary.totalOutgoing)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">淨流量</p>
              <p className={`text-base font-mono font-bold ${data.summary.netFlow >= 0 ? 'text-slate-900' : 'text-red-600'}`}>${fmt(data.summary.netFlow)}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{data.groupBy === 'month' ? '月份' : data.groupBy === 'type' ? '款項類型' : '付款方式'}</TableHead>
                  <TableHead className="text-right w-32 text-green-700">收款</TableHead>
                  <TableHead className="text-right w-32 text-red-600">付款</TableHead>
                  <TableHead className="text-right w-32">淨額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">無記錄</TableCell></TableRow>
                ) : (
                  <>
                    {data.rows.map((row, i) => (
                      <TableRow key={i} className="text-sm hover:bg-slate-50/40">
                        <TableCell className="font-medium">{row.key}</TableCell>
                        <TableCell className="text-right font-mono text-green-700">{row.incoming > 0 ? `$${fmt(row.incoming)}` : '—'}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{row.outgoing > 0 ? `$${fmt(row.outgoing)}` : '—'}</TableCell>
                        <TableCell className={`text-right font-mono ${row.net >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                          {row.net >= 0 ? '+' : '-'}${fmt(row.net)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-slate-50 font-semibold text-sm">
                      <TableCell>合計</TableCell>
                      <TableCell className="text-right font-mono text-green-700">${fmt(data.summary.totalIncoming)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">${fmt(data.summary.totalOutgoing)}</TableCell>
                      <TableCell className={`text-right font-mono ${data.summary.netFlow >= 0 ? '' : 'text-red-600'}`}>
                        {data.summary.netFlow >= 0 ? '+' : '-'}${fmt(data.summary.netFlow)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">請點擊查詢載入資料</div>}
    </div>
  )
}
