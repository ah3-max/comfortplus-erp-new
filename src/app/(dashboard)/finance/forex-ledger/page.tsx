'use client'

import { useState, useCallback, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const CURRENCY_COLORS: Record<string, string> = {
  USD: 'bg-blue-100 text-blue-700',
  EUR: 'bg-indigo-100 text-indigo-700',
  JPY: 'bg-pink-100 text-pink-700',
  CNY: 'bg-red-100 text-red-700',
  THB: 'bg-amber-100 text-amber-700',
  TWD: 'bg-slate-100 text-slate-600',
}

interface ForexRow {
  id: string; paymentNo: string; paymentDate: string; direction: string
  amount: number; paymentMethod: string; bankAccount: string
  partyName: string; notes: string; detectedCurrency: string
}
interface ByCurrency { currency: string; incoming: number; outgoing: number; count: number }
interface ForexData {
  currency: string
  summary: { totalIncoming: number; totalOutgoing: number; netFlow: number; txCount: number }
  byCurrency: ByCurrency[]
  rows: ForexRow[]
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function ForexLedgerPage() {
  const { dict } = useI18n()
  const fp = dict.financePages
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`
  const [currency, setCurrency] = useState('all')
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [data, setData] = useState<ForexData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ currency, startDate, endDate })
      const res = await fetch(`/api/finance/forex-ledger?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [currency, startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{fp.forexTitle}</h1>
          <p className="text-sm text-muted-foreground">{fp.forexDesc}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{fp.forexCurrencyLabel}</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="all">{fp.forexAllCurrencies}</option>
            {['USD', 'EUR', 'JPY', 'CNY', 'THB'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{fp.dateStart}</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{fp.dateEnd}</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.search}
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: fp.forexSummaryIncoming, value: data.summary.totalIncoming, color: 'text-green-600' },
              { label: fp.forexSummaryOutgoing, value: data.summary.totalOutgoing, color: 'text-red-600' },
              { label: fp.forexSummaryNet, value: data.summary.netFlow, color: data.summary.netFlow >= 0 ? 'text-slate-900' : 'text-red-600' },
              { label: fp.forexSummaryCount, value: data.summary.txCount, color: 'text-slate-700', isCount: true },
            ].map(c => (
              <div key={c.label} className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-base font-mono font-semibold ${c.color}`}>
                  {c.isCount ? c.value : `$${fmt(c.value)}`}
                </p>
              </div>
            ))}
          </div>

          {data.byCurrency.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.byCurrency.map(bc => (
                <div key={bc.currency} className="rounded-lg border bg-white px-4 py-2 flex items-center gap-3 text-sm">
                  <Badge className={CURRENCY_COLORS[bc.currency] ?? 'bg-slate-100 text-slate-600'}>{bc.currency}</Badge>
                  <span className="text-green-600">+{fmt(bc.incoming)}</span>
                  <span className="text-red-600">-{fmt(bc.outgoing)}</span>
                  <span className="text-muted-foreground">{bc.count}{fp.forexCountSuffix}</span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">{fp.forexColDate}</TableHead>
                  <TableHead className="w-28">{fp.forexColRef}</TableHead>
                  <TableHead className="w-16">{fp.forexColCurrency}</TableHead>
                  <TableHead>{fp.forexColParty}</TableHead>
                  <TableHead className="w-20">{fp.forexColMethod}</TableHead>
                  <TableHead>{fp.forexColBank}</TableHead>
                  <TableHead className="text-right w-28 text-green-700">{fp.forexColIncoming}</TableHead>
                  <TableHead className="text-right w-28 text-red-600">{fp.forexColOutgoing}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">{fp.forexNoRecords}</TableCell></TableRow>
                ) : (
                  data.rows.map(row => (
                    <TableRow key={row.id} className="text-sm hover:bg-slate-50/40">
                      <TableCell className="text-muted-foreground">{row.paymentDate}</TableCell>
                      <TableCell className="font-mono text-xs">{row.paymentNo}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${CURRENCY_COLORS[row.detectedCurrency] ?? 'bg-slate-100 text-slate-600'}`}>
                          {row.detectedCurrency}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.partyName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.paymentMethod}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{row.bankAccount}</TableCell>
                      <TableCell className="text-right font-mono text-green-700">
                        {row.direction === 'INCOMING' ? (
                          <span className="flex items-center justify-end gap-1">
                            <ArrowDownCircle className="h-3 w-3" />{fmt(row.amount)}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {row.direction === 'OUTGOING' ? (
                          <span className="flex items-center justify-end gap-1">
                            <ArrowUpCircle className="h-3 w-3" />{fmt(row.amount)}
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
