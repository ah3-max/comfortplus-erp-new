'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface REData {
  year: number
  openingBalance: number
  netIncome: number
  dividendsPaid: number
  closingBalance: number
  equityBreakdown: Array<{
    accountCode: string; accountName: string
    debitTotal: number; creditTotal: number; balance: number
  }>
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function RetainedEarningsPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<REData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/retained-earnings?year=${year}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [year])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">盈餘公積金表</h1>
          <p className="text-sm text-muted-foreground">保留盈餘與股東權益變動</p>
        </div>
      </div>

      <div className="flex items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">年度</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-md border px-3 py-2 text-sm">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢
        </Button>
      </div>

      {data && (
        <>
          {/* Flow diagram */}
          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-5">{data.year} 年保留盈餘計算</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-center min-w-[140px]">
                <p className="text-xs text-muted-foreground mb-1">期初保留盈餘</p>
                <p className="text-xl font-mono font-bold text-slate-800">${fmt(data.openingBalance)}</p>
              </div>

              <div className="flex flex-col items-center gap-1">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-green-600 font-medium">+ 淨利潤</span>
              </div>

              <div className={`rounded-lg border-2 p-4 text-center min-w-[140px] ${data.netIncome >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <p className="text-xs text-muted-foreground mb-1">本期淨利潤</p>
                <p className={`text-xl font-mono font-bold ${data.netIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {data.netIncome >= 0 ? '+' : '-'}${fmt(data.netIncome)}
                </p>
              </div>

              <div className="flex flex-col items-center gap-1">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-red-600 font-medium">- 股利發放</span>
              </div>

              <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4 text-center min-w-[140px]">
                <p className="text-xs text-muted-foreground mb-1">股利發放</p>
                <p className="text-xl font-mono font-bold text-amber-700">-${fmt(data.dividendsPaid)}</p>
              </div>

              <div className="flex flex-col items-center gap-1">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-slate-600 font-medium">= 期末</span>
              </div>

              <div className={`rounded-lg border-2 p-4 text-center min-w-[140px] ${data.closingBalance >= 0 ? 'border-blue-300 bg-blue-50' : 'border-red-300 bg-red-50'}`}>
                <p className="text-xs text-muted-foreground mb-1">期末保留盈餘</p>
                <p className={`text-xl font-mono font-bold ${data.closingBalance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  ${fmt(data.closingBalance)}
                </p>
              </div>
            </div>
          </div>

          {/* Equity breakdown */}
          {data.equityBreakdown.length > 0 && (
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="px-4 py-3 bg-purple-50 text-purple-800 font-semibold text-sm border-b border-purple-100">
                權益科目明細
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">科目代碼</TableHead>
                    <TableHead>科目名稱</TableHead>
                    <TableHead className="text-right w-28">借方合計</TableHead>
                    <TableHead className="text-right w-28">貸方合計</TableHead>
                    <TableHead className="text-right w-28">餘額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.equityBreakdown.map(acc => (
                    <TableRow key={acc.accountCode} className="text-sm hover:bg-slate-50/40">
                      <TableCell className="font-mono text-xs">{acc.accountCode}</TableCell>
                      <TableCell>{acc.accountName}</TableCell>
                      <TableCell className="text-right font-mono">${fmt(acc.debitTotal)}</TableCell>
                      <TableCell className="text-right font-mono">${fmt(acc.creditTotal)}</TableCell>
                      <TableCell className={`text-right font-mono font-medium ${acc.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        ${fmt(acc.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">
          請選擇年度後點擊查詢
        </div>
      )}
    </div>
  )
}
