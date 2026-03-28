'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface PayRow {
  id: string; paymentNo: string; date: string; direction: string; amount: number
  paymentMethod: string; bankAccount: string; referenceNo: string; partyName: string; notes: string
}
interface ByMethod { method: string; incoming: number; outgoing: number; count: number }
interface MoveData {
  period: { startDate: string; endDate: string }
  summary: { totalIncoming: number; totalOutgoing: number; netFlow: number; count: number }
  byMethod: ByMethod[]
  rows: PayRow[]
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function CashMovementPage() {
  const { dict } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [direction, setDirection] = useState('all')
  const [method, setMethod] = useState('')
  const [data, setData] = useState<MoveData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate, direction })
      if (method) params.set('method', method)
      const res = await fetch(`/api/finance/cash-movement?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate, direction, method, dict])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.nav.cashMovement}</h1>
          <p className="text-sm text-muted-foreground">收付款明細流水帳</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.startDate}</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.endDate}</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">方向</label>
          <select value={direction} onChange={e => setDirection(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="all">全部</option>
            <option value="INCOMING">收款</option>
            <option value="OUTGOING">付款</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">付款方式</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">全部</option>
            {['銀行轉帳', '支票', '現金', '信用卡', '月結'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.reportsExt.generate}</Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '總收款', value: data.summary.totalIncoming, color: 'text-green-600' },
              { label: '總付款', value: data.summary.totalOutgoing, color: 'text-red-600' },
              { label: '淨流量', value: data.summary.netFlow, color: data.summary.netFlow >= 0 ? 'text-slate-900' : 'text-red-600' },
              { label: '筆數', value: data.summary.count, color: 'text-slate-700', isCount: true },
            ].map(c => (
              <div key={c.label} className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-base font-mono font-semibold ${c.color}`}>{c.isCount ? c.value : `$${fmt(c.value)}`}</p>
              </div>
            ))}
          </div>
          {data.byMethod.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.byMethod.map(m => (
                <div key={m.method} className="rounded-lg border bg-white px-4 py-2 flex items-center gap-3 text-sm">
                  <span className="font-medium text-slate-700">{m.method}</span>
                  <span className="text-green-600">+{fmt(m.incoming)}</span>
                  <span className="text-red-600">-{fmt(m.outgoing)}</span>
                  <span className="text-muted-foreground text-xs">{m.count}筆</span>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">{dict.common.date}</TableHead>
                  <TableHead className="w-28">單號</TableHead>
                  <TableHead className="w-16">方向</TableHead>
                  <TableHead>往來對象</TableHead>
                  <TableHead className="w-20">方式</TableHead>
                  <TableHead className="text-right w-28">{dict.common.amount}</TableHead>
                  <TableHead>{dict.common.notes}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">無記錄</TableCell></TableRow>
                ) : data.rows.map(row => (
                  <TableRow key={row.id} className="text-sm hover:bg-slate-50/40">
                    <TableCell className="text-muted-foreground">{row.date}</TableCell>
                    <TableCell className="font-mono text-xs">{row.paymentNo}</TableCell>
                    <TableCell>
                      {row.direction === 'INCOMING'
                        ? <Badge className="bg-green-100 text-green-700 text-xs"><ArrowDownCircle className="h-3 w-3 mr-1" />收</Badge>
                        : <Badge className="bg-red-100 text-red-700 text-xs"><ArrowUpCircle className="h-3 w-3 mr-1" />付</Badge>}
                    </TableCell>
                    <TableCell>{row.partyName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.paymentMethod}</TableCell>
                    <TableCell className={`text-right font-mono font-medium ${row.direction === 'INCOMING' ? 'text-green-700' : 'text-red-600'}`}>
                      {row.direction === 'INCOMING' ? '+' : '-'}${fmt(row.amount)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.notes || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">請點擊查詢載入資料</div>}
    </div>
  )
}
