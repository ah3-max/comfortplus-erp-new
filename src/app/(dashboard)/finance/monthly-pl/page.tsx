'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface MonthlyData {
  year: number; months: number[]
  summary: { revenue: number[]; expense: number[]; netIncome: number[]; totalRevenue: number; totalExpense: number; totalNetIncome: number }
  accounts: Array<{ code: string; name: string; type: string; monthly: number[]; total: number }>
}

function fmt(n: number) {
  if (n === 0) return '—'
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export default function MonthlyPLPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [showAccounts, setShowAccounts] = useState(false)
  const [data, setData] = useState<MonthlyData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/monthly-pl?year=${year}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [year])

  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">月損益報表</h1>
          <p className="text-sm text-muted-foreground">12 個月橫向損益比較</p>
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
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">全年收入</p>
              <p className="text-base font-mono font-semibold text-green-600">${fmt(data.summary.totalRevenue)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">全年費用</p>
              <p className="text-base font-mono font-semibold text-red-600">${fmt(data.summary.totalExpense)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">全年淨利</p>
              <p className={`text-base font-mono font-bold ${data.summary.totalNetIncome >= 0 ? 'text-slate-900' : 'text-red-600'}`}>${fmt(data.summary.totalNetIncome)}</p>
            </div>
          </div>

          {/* 12-month table */}
          <div className="rounded-lg border bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-slate-50 w-36">項目</th>
                  {MONTH_LABELS.map(m => <th key={m} className="text-right px-2 py-3 font-medium text-muted-foreground w-20">{m}</th>)}
                  <th className="text-right px-3 py-3 font-semibold w-24">全年合計</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: '收入合計', data: data.summary.revenue, total: data.summary.totalRevenue, cls: 'text-green-700 bg-green-50/50', totalCls: 'text-green-700 font-bold' },
                  { label: '費用合計', data: data.summary.expense, total: data.summary.totalExpense, cls: 'text-red-600 bg-red-50/50', totalCls: 'text-red-600 font-bold' },
                  { label: '淨利潤', data: data.summary.netIncome, total: data.summary.totalNetIncome, cls: 'bg-slate-50 border-t-2', totalCls: 'font-bold' },
                ].map(row => (
                  <tr key={row.label} className={`border-b ${row.cls}`}>
                    <td className={`px-4 py-2.5 font-semibold sticky left-0 ${row.cls}`}>{row.label}</td>
                    {row.data.map((v, i) => (
                      <td key={i} className={`text-right px-2 py-2.5 font-mono text-xs ${v < 0 ? 'text-red-600' : ''}`}>
                        {v !== 0 ? `$${fmt(v)}` : '—'}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-2.5 font-mono text-xs ${row.totalCls} ${row.total < 0 ? 'text-red-600' : ''}`}>
                      ${fmt(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Account breakdown toggle */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAccounts(!showAccounts)} className="text-sm text-blue-600 hover:underline">
              {showAccounts ? '▲ 收起' : '▼ 顯示科目明細'}
            </button>
          </div>
          {showAccounts && (
            <div className="rounded-lg border bg-white overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-2 font-medium sticky left-0 bg-slate-50 w-48">科目</th>
                    <th className="text-left px-2 py-2 font-medium w-16">類型</th>
                    {MONTH_LABELS.map(m => <th key={m} className="text-right px-2 py-2 text-xs text-muted-foreground w-20">{m}</th>)}
                    <th className="text-right px-3 py-2 font-medium w-24">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map(acc => (
                    <tr key={acc.code} className="border-b hover:bg-slate-50/40">
                      <td className="px-4 py-2 sticky left-0 bg-white">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{acc.code}</span>{acc.name}
                      </td>
                      <td className="px-2 py-2">
                        <Badge className={`text-xs ${acc.type === 'REVENUE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {acc.type === 'REVENUE' ? '收入' : '費用'}
                        </Badge>
                      </td>
                      {acc.monthly.map((v, i) => (
                        <td key={i} className="text-right px-2 py-2 font-mono text-xs text-muted-foreground">{v !== 0 ? `$${fmt(v)}` : ''}</td>
                      ))}
                      <td className="text-right px-3 py-2 font-mono text-xs font-medium">${fmt(acc.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">請選擇年度後點擊查詢</div>}
    </div>
  )
}
