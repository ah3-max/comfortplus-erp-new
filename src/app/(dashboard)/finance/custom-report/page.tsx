'use client'

import { useState, useCallback, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface ReportRow { [key: string]: string | number }

const PRESET_REPORTS = [
  {
    id: 'revenue-by-month',
    label: '月收入統計',
    desc: '本年度每月收入合計',
    endpoint: `/api/finance/monthly-pl`,
    buildParams: (year: number) => `year=${year}`,
    transform: (d: { summary: { revenue: number[] }; months: number[] }) =>
      d.months.map((m: number, i: number) => ({ '月份': `${m}月`, '收入': d.summary.revenue[i] })),
  },
  {
    id: 'expense-by-account',
    label: '費用科目分析',
    desc: '年度費用按科目分類',
    endpoint: `/api/finance/cost-detail`,
    buildParams: (year: number) => `startDate=${year}-01-01&endDate=${year}-12-31&groupBy=account`,
    transform: (d: { rows: Array<{ key: string; netCost: number; percentage: number }> }) =>
      d.rows.map((r) => ({ '科目': r.key, '費用': r.netCost, '佔比(%)': r.percentage })),
  },
  {
    id: 'payment-by-method',
    label: '付款方式統計',
    desc: '年度收付款按方式分類',
    endpoint: `/api/finance/cash-inout-detail`,
    buildParams: (year: number) => `startDate=${year}-01-01&endDate=${year}-12-31&groupBy=method`,
    transform: (d: { rows: Array<{ key: string; incoming: number; outgoing: number }> }) =>
      d.rows.map((r) => ({ '方式': r.key, '收款': r.incoming, '付款': r.outgoing })),
  },
  {
    id: 'ar-balance',
    label: '應收帳款排行',
    desc: '未付應收帳款客戶排行',
    endpoint: `/api/finance/vendor-ledger-1`,
    buildParams: (year: number) => `startDate=${year}-01-01&endDate=${year}-12-31`,
    transform: (d: { rows: Array<{ customerName: string; balance: number; overdueAmount: number }> }) =>
      d.rows.slice(0, 20).map((r) => ({ '客戶': r.customerName, '未付餘額': r.balance, '逾期金額': r.overdueAmount })),
  },
]

function fmt(v: string | number): string {
  if (typeof v === 'number') return v.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return String(v)
}

export default function CustomReportPage() {
  const { dict } = useI18n()
  const [preset, setPreset] = useState(PRESET_REPORTS[0].id)
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const currentYear = new Date().getFullYear()

  const selectedPreset = PRESET_REPORTS.find(p => p.id === preset) ?? PRESET_REPORTS[0]

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const url = `${selectedPreset.endpoint}?${selectedPreset.buildParams(year)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(selectedPreset.transform(data))
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [preset, year, selectedPreset])

  useEffect(() => { fetchData() }, [fetchData])

  const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">使用者指定報表</h1>
          <p className="text-sm text-muted-foreground">選擇預設報表模板快速產出</p>
        </div>
      </div>
      <div className="rounded-lg border bg-white p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRESET_REPORTS.map(p => (
            <button
              key={p.id}
              onClick={() => { setPreset(p.id); setRows(null) }}
              className={`rounded-lg border p-3 text-left transition-colors ${preset === p.id ? 'border-slate-900 bg-slate-50' : 'hover:border-slate-300'}`}
            >
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
        <div className="flex items-end gap-3 pt-2 border-t">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">年度</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-md border px-3 py-2 text-sm">
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y} 年</option>)}
            </select>
          </div>
          <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.reportsExt.generate}</Button>
        </div>
      </div>
      {rows && (
        <>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-100 text-slate-700">{selectedPreset.label}</Badge>
            <span className="text-xs text-muted-foreground">{year} 年 · {rows.length} 筆</span>
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => <TableHead key={col}>{col}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">無資料</TableCell></TableRow>
                ) : rows.map((row, i) => (
                  <TableRow key={i} className="text-sm hover:bg-slate-50/40">
                    {columns.map(col => (
                      <TableCell key={col} className={typeof row[col] === 'number' ? 'text-right font-mono' : ''}>
                        {fmt(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {!rows && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">{dict.reportsExt.noData}</div>}
    </div>
  )
}
