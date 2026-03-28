'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, CalendarDays, Calendar } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import Link from 'next/link'
import { toast } from 'sonner'

interface SummaryRow { key: string; label: string; debit: number; credit: number; count: number; net: number }
interface SummaryData {
  mode: string; rows: SummaryRow[]
  totals: { debit: number; credit: number; count: number }
  period: { startDate: string; endDate: string }
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function DailyMonthlySummaryPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`
  const [mode, setMode] = useState<'DAILY' | 'MONTHLY'>('MONTHLY')
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ mode, startDate, endDate })
      const res = await fetch(`/api/finance/daily-monthly-summary?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [mode, startDate, endDate])

  const chartData = data?.rows.map(r => ({
    name: r.label,
    借方: Math.round(r.debit / 1000),
    貸方: Math.round(r.credit / 1000),
  })) ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">日/月合計表</h1>
          <p className="text-sm text-muted-foreground">傳票借貸按日或月彙總</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">模式</label>
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setMode('MONTHLY')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${mode === 'MONTHLY' ? 'bg-slate-800 text-white' : 'hover:bg-slate-50'}`}
            >
              <Calendar className="h-4 w-4" />月合計
            </button>
            <button
              onClick={() => setMode('DAILY')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-l ${mode === 'DAILY' ? 'bg-slate-800 text-white' : 'hover:bg-slate-50'}`}
            >
              <CalendarDays className="h-4 w-4" />日合計
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">開始</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">結束</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢
        </Button>
        {data && (
          <p className="text-xs text-muted-foreground self-end pb-2">
            共 {data.rows.length} {mode === 'MONTHLY' ? '個月' : '天'}，{data.totals.count} 筆傳票
          </p>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data ? (
        <>
          {/* Chart */}
          {chartData.length > 0 && (
            <div className="rounded-lg border bg-white p-4">
              <h3 className="text-sm font-semibold mb-3 text-slate-700">借貸趨勢（千元）</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}K`, '']} />
                  <Legend />
                  <Bar dataKey="借方" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="貸方" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{mode === 'MONTHLY' ? '月份' : '日期'}</TableHead>
                  <TableHead className="text-right w-28">借方合計</TableHead>
                  <TableHead className="text-right w-28">貸方合計</TableHead>
                  <TableHead className="text-right w-24">傳票筆數</TableHead>
                  <TableHead className="text-right w-28">差額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map(row => (
                  <TableRow key={row.key} className="text-sm hover:bg-slate-50/40">
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(row.debit)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(row.credit)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.count}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${Math.abs(row.net) > 0.01 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {Math.abs(row.net) > 0.01 ? fmt(row.net) : '平衡'}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-100 font-semibold border-t-2 text-sm">
                  <TableCell>合計</TableCell>
                  <TableCell className="text-right font-mono">{fmt(data.totals.debit)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(data.totals.credit)}</TableCell>
                  <TableCell className="text-right">{data.totals.count}</TableCell>
                  <TableCell className={`text-right font-mono text-xs ${Math.abs(data.totals.debit - data.totals.credit) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                    {Math.abs(data.totals.debit - data.totals.credit) < 0.01 ? '借貸平衡' : fmt(data.totals.debit - data.totals.credit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">
          請點擊查詢載入資料
        </div>
      )}
    </div>
  )
}
