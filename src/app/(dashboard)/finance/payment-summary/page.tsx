'use client'

import { useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface MonthRow { month: number; count: number; totalAmount: number; avgAmount: number }
interface PayData { year: number; type: string; grandTotal: number; totalCount: number; rows: MonthRow[] }

const MONTH_LABELS = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
function fmt(n: number) { return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

const TYPE_CONFIG: Record<string, { label: string; title: string; color: string; barColor: string }> = {
  OUTGOING: { label: '付款單合計', title: '月付款合計表', color: 'text-red-600', barColor: 'bg-red-400' },
  INCOMING: { label: '收款單合計', title: '月收款合計表', color: 'text-green-600', barColor: 'bg-green-400' },
  ADVANCE:  { label: '暫付款合計', title: '月暫付款合計表', color: 'text-amber-600', barColor: 'bg-amber-400' },
}

export default function PaymentSummaryPage() {
  const { dict } = useI18n()
  const [year, setYear] = useState(new Date().getFullYear())
  const [type, setType] = useState('OUTGOING')
  const [data, setData] = useState<PayData | null>(null)
  const [loading, setLoading] = useState(false)
  const currentYear = new Date().getFullYear()
  const cfg = TYPE_CONFIG[type]

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/payment-summary?year=${year}&type=${type}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [year, type])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{data ? TYPE_CONFIG[data.type]?.title : '收付款合計表'}</h1>
          <p className="text-sm text-muted-foreground">每月收付款金額月度統計</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.type}</label>
          <select value={type} onChange={e => setType(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="OUTGOING">付款單</option>
            <option value="INCOMING">收款單</option>
            <option value="ADVANCE">暫付款單</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">年度</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-md border px-3 py-2 text-sm">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y} 年</option>)}
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.search}</Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">全年{cfg.label}</p>
              <p className={`text-base font-mono font-bold ${cfg.color}`}>${fmt(data.grandTotal)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">全年筆數</p>
              <p className="text-base font-mono font-semibold">{data.totalCount}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">月份</TableHead>
                  <TableHead className="text-right w-20">筆數</TableHead>
                  <TableHead className="text-right w-36">金額</TableHead>
                  <TableHead className="text-right w-32">平均金額</TableHead>
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
                      <TableCell className={`text-right font-mono ${cfg.color}`}>{row.totalAmount > 0 ? `$${fmt(row.totalAmount)}` : '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{row.avgAmount > 0 ? `$${fmt(row.avgAmount)}` : '—'}</TableCell>
                      <TableCell>
                        {pct > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                              <div className={`${cfg.barColor} h-1.5 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
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
                  <TableCell className="text-right">{data.totalCount}</TableCell>
                  <TableCell className={`text-right font-mono ${cfg.color}`}>${fmt(data.grandTotal)}</TableCell>
                  <TableCell />
                  <TableCell />
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
