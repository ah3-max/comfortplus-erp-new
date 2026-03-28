'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface DetailRow {
  date: string; entryNo: string; description: string
  accountCode: string; accountName: string; amount: number
}
interface IEData {
  period: { startDate: string; endDate: string }
  summary: { totalRevenue: number; totalExpense: number; netIncome: number; revenueCount: number; expenseCount: number }
  revenueRows: DetailRow[]
  expenseRows: DetailRow[]
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function DetailTable({ rows, color }: { rows: DetailRow[]; color: string }) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-muted-foreground text-sm">無記錄</div>
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">日期</TableHead>
            <TableHead className="w-28">傳票號</TableHead>
            <TableHead>摘要</TableHead>
            <TableHead className="w-24">科目代碼</TableHead>
            <TableHead>科目名稱</TableHead>
            <TableHead className={`text-right w-28 ${color}`}>金額</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i} className="text-sm hover:bg-slate-50/40">
              <TableCell className="text-muted-foreground">{row.date}</TableCell>
              <TableCell className="font-mono text-xs">{row.entryNo}</TableCell>
              <TableCell>{row.description}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{row.accountCode}</TableCell>
              <TableCell>{row.accountName}</TableCell>
              <TableCell className={`text-right font-mono ${color}`}>${fmt(row.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default function IncomeExpenseDetailPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [activeTab, setActiveTab] = useState<'revenue' | 'expense'>('revenue')
  const [data, setData] = useState<IEData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const res = await fetch(`/api/finance/income-expense-detail?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [startDate, endDate])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">收入支出明細表</h1>
          <p className="text-sm text-muted-foreground">收入與費用逐筆明細</p>
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
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">收入合計</p>
              <p className="text-base font-mono font-semibold text-green-600">${fmt(data.summary.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{data.summary.revenueCount} 筆</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">支出合計</p>
              <p className="text-base font-mono font-semibold text-red-600">${fmt(data.summary.totalExpense)}</p>
              <p className="text-xs text-muted-foreground mt-1">{data.summary.expenseCount} 筆</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">淨利潤</p>
              <p className={`text-base font-mono font-bold ${data.summary.netIncome >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                ${fmt(data.summary.netIncome)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="flex border-b">
              {([
                { key: 'revenue', label: `收入明細 (${data.summary.revenueCount})` },
                { key: 'expense', label: `支出明細 (${data.summary.expenseCount})` },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-muted-foreground hover:text-slate-700'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTab === 'revenue' ? (
              <DetailTable rows={data.revenueRows} color="text-green-600" />
            ) : (
              <DetailTable rows={data.expenseRows} color="text-red-600" />
            )}
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
