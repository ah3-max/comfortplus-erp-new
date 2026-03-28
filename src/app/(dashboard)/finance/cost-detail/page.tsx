'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface CostRow {
  key: string; subKey: string
  debitTotal: number; creditTotal: number; netCost: number
  entryCount: number; percentage: number
}
interface CostData {
  period: { startDate: string; endDate: string }
  groupBy: string; totalCost: number; rows: CostRow[]
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function CostDetailPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [groupBy, setGroupBy] = useState('account')
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate, groupBy })
      const res = await fetch(`/api/finance/cost-detail?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [startDate, endDate, groupBy])

  const topRow = data?.rows[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">成本明細表</h1>
          <p className="text-sm text-muted-foreground">各項費用成本明細分析</p>
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
          <label className="text-xs font-medium text-muted-foreground">分組方式</label>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="account">按科目</option>
            <option value="summary">按摘要</option>
            <option value="month">按月份</option>
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">費用總額</p>
              <p className="text-base font-mono font-bold text-red-600">${fmt(data.totalCost)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">最高項目</p>
              <p className="text-sm font-medium truncate">{topRow?.key ?? '—'}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">分類筆數</p>
              <p className="text-base font-mono text-slate-700">{data.rows.length}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>分類</TableHead>
                  <TableHead className="w-32">子分類</TableHead>
                  <TableHead className="text-right w-28">借方</TableHead>
                  <TableHead className="text-right w-28">貸方</TableHead>
                  <TableHead className="text-right w-28">淨成本</TableHead>
                  <TableHead className="w-16 text-right">筆數</TableHead>
                  <TableHead className="w-40">佔比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">無費用記錄</TableCell></TableRow>
                ) : (
                  data.rows.map((row, i) => (
                    <TableRow key={i} className="text-sm hover:bg-slate-50/40">
                      <TableCell className="font-medium">{row.key}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.subKey || '—'}</TableCell>
                      <TableCell className="text-right font-mono">${fmt(row.debitTotal)}</TableCell>
                      <TableCell className="text-right font-mono text-green-700">${fmt(row.creditTotal)}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-red-600">${fmt(row.netCost)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.entryCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                            <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${Math.min(row.percentage, 100)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{row.percentage}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="border-t-2 bg-slate-50 font-semibold text-sm">
                  <TableCell colSpan={4}>合計</TableCell>
                  <TableCell className="text-right font-mono text-red-600">${fmt(data.totalCost)}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">
          請點擊查詢載入資料
        </div>
      )}
    </div>
  )
}
