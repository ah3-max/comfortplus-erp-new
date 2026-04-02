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

interface CustomerRow {
  customerId: string; customerName: string; customerCode: string
  invoiceCount: number; totalAmount: number; paidAmount: number
  balance: number; overdueAmount: number; oldestDueDate: string | null
}
interface LedgerData {
  period: { startDate: string; endDate: string }
  summary: { totalOutstanding: number; totalOverdue: number; totalPaid: number; customerCount: number }
  rows: CustomerRow[]
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function VendorLedger1Page() {
  const { dict } = useI18n()
  const fp = dict.financePages
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [status, setStatus] = useState('')
  const [data, setData] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (status) params.set('status', status)
      const res = await fetch(`/api/finance/vendor-ledger-1?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate, status])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{fp.vl1Title}</h1>
          <p className="text-sm text-muted-foreground">{fp.vl1Desc}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{fp.dateStart}</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{fp.dateEnd}</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.status}</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">{dict.common.all}</option>
            <option value="NOT_DUE">{fp.statusNotDue}</option>
            <option value="DUE">{fp.statusDue}</option>
            <option value="PAID">{fp.statusPaid}</option>
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.search}
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: fp.vl1SummaryOutstanding, value: data.summary.totalOutstanding, color: 'text-slate-900 font-bold' },
              { label: fp.vl1SummaryOverdue, value: data.summary.totalOverdue, color: 'text-red-600' },
              { label: fp.vl1SummaryPaid, value: data.summary.totalPaid, color: 'text-green-600' },
              { label: fp.vl1SummaryCount, value: data.summary.customerCount, color: 'text-slate-700', isCount: true },
            ].map(c => (
              <div key={c.label} className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-base font-mono ${c.color}`}>
                  {c.isCount ? c.value : `$${fmt(c.value)}`}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">{fp.vl1ColCode}</TableHead>
                  <TableHead>{fp.vl1ColName}</TableHead>
                  <TableHead className="text-right w-16">{fp.vl1ColCount}</TableHead>
                  <TableHead className="text-right w-32">{fp.vl1ColTotal}</TableHead>
                  <TableHead className="text-right w-32">{fp.vl1ColPaid}</TableHead>
                  <TableHead className="text-right w-32">{fp.vl1ColBalance}</TableHead>
                  <TableHead className="text-right w-32 text-red-600">{fp.vl1ColOverdue}</TableHead>
                  <TableHead className="w-28">{fp.vl1ColOldestDue}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">{fp.vl1NoRecords}</TableCell></TableRow>
                ) : (
                  data.rows.map(row => (
                    <TableRow key={row.customerId} className="text-sm hover:bg-slate-50/40">
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.customerCode}</TableCell>
                      <TableCell>
                        <Link
                          href={`/finance/party-transactions?partyType=CUSTOMER&partyId=${row.customerId}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {row.customerName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.invoiceCount}</TableCell>
                      <TableCell className="text-right font-mono">${fmt(row.totalAmount)}</TableCell>
                      <TableCell className="text-right font-mono text-green-700">${fmt(row.paidAmount)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">${fmt(row.balance)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.overdueAmount > 0 ? (
                          <Badge variant="destructive" className="font-mono text-xs">${fmt(row.overdueAmount)}</Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.oldestDueDate ?? '—'}</TableCell>
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
