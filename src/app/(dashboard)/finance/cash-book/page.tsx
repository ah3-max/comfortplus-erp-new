'use client'

import { useState, useCallback, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface CashRow {
  id: string; paymentNo: string; date: string; description: string
  partyName: string; paymentMethod: string; referenceNo: string
  incoming: number; outgoing: number; balance: number
}
interface CashData {
  openingBalance: number; periodIncoming: number; periodOutgoing: number; closingBalance: number
  rows: CashRow[]
  period: { startDate: string; endDate: string }
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function CashBookPage() {
  const { dict } = useI18n()
  const cb = dict.cashBook
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [method, setMethod] = useState('')
  const [data, setData] = useState<CashData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (method) params.set('method', method)
      const res = await fetch(`/api/finance/cash-book?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate, method])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.nav.cashBook}</h1>
          <p className="text-sm text-muted-foreground">{cb.subtitle}</p>
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
          <label className="text-xs font-medium text-muted-foreground">{cb.methodLabel}</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">{cb.methodAll}</option>
            {['銀行轉帳', '支票', '現金', '信用卡', '月結'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.reportsExt.generate}
        </Button>
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: cb.openingBalance, value: data.openingBalance, color: 'text-slate-700' },
              { label: cb.periodIncoming, value: data.periodIncoming, color: 'text-green-600' },
              { label: cb.periodOutgoing, value: data.periodOutgoing, color: 'text-red-600' },
              { label: cb.closingBalance, value: data.closingBalance, color: data.closingBalance >= 0 ? 'text-slate-900' : 'text-red-600', bold: true },
            ].map(c => (
              <div key={c.label} className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-base font-mono ${c.bold ? 'font-bold' : ''} ${c.color}`}>${fmt(c.value)}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">{cb.colDate}</TableHead>
                  <TableHead className="w-28">{cb.colNo}</TableHead>
                  <TableHead>{cb.colSummary}</TableHead>
                  <TableHead>{cb.colParty}</TableHead>
                  <TableHead className="w-20">{cb.colMethod}</TableHead>
                  <TableHead className="text-right w-28 text-green-700">{cb.colIncoming}</TableHead>
                  <TableHead className="text-right w-28 text-red-600">{cb.colOutgoing}</TableHead>
                  <TableHead className="text-right w-32">{cb.colBalance}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening */}
                <TableRow className="bg-slate-50/80 italic text-muted-foreground text-sm">
                  <TableCell>{data.period.startDate}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell colSpan={4}>{cb.openingRow}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono font-semibold text-slate-700">${fmt(data.openingBalance)}</TableCell>
                </TableRow>

                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">{cb.noRecords}</TableCell></TableRow>
                ) : (
                  data.rows.map(row => (
                    <TableRow key={row.id} className="text-sm hover:bg-slate-50/40">
                      <TableCell className="text-muted-foreground">{row.date}</TableCell>
                      <TableCell className="font-mono text-xs">{row.paymentNo}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell className="text-sm">{row.partyName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.paymentMethod}</TableCell>
                      <TableCell className="text-right font-mono text-green-700">
                        {row.incoming > 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            <ArrowDownCircle className="h-3 w-3" />{fmt(row.incoming)}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {row.outgoing > 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            <ArrowUpCircle className="h-3 w-3" />{fmt(row.outgoing)}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${row.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        ${fmt(row.balance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {/* Closing */}
                <TableRow className="border-t-2 bg-slate-100 font-semibold text-sm">
                  <TableCell colSpan={5}>{cb.closingRow.replace('{n}', String(data.rows.length))}</TableCell>
                  <TableCell className="text-right font-mono text-green-700">${fmt(data.periodIncoming)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">${fmt(data.periodOutgoing)}</TableCell>
                  <TableCell className={`text-right font-mono font-bold ${data.closingBalance < 0 ? 'text-red-600' : ''}`}>
                    ${fmt(data.closingBalance)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">
          {dict.reportsExt.noData}
        </div>
      )}
    </div>
  )
}
