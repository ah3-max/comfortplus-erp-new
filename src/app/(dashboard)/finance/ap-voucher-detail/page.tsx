'use client'

import { useState, useCallback, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, Printer } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface VoucherRow {
  id: string; invoiceNo: string; invoiceDate: string; dueDate: string | null
  supplierId: string; supplierName: string; supplierCode: string; poNo: string
  amount: number; paidAmount: number; balance: number; status: string; currency: string
}
interface VoucherData {
  period: { startDate: string; endDate: string }
  summary: { count: number; totalAmount: number; totalPaid: number; totalBalance: number }
  rows: VoucherRow[]
}

const STATUS_CLS: Record<string, string> = {
  NOT_DUE:     'bg-green-100 text-green-700',
  DUE:         'bg-red-100 text-red-700',
  PARTIAL_PAID:'bg-amber-100 text-amber-700',
  PAID:        'bg-slate-100 text-slate-600',
}

function fmt(n: number) { return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export default function APVoucherDetailPage() {
  const { dict } = useI18n()
  const fp = dict.financePages
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [status, setStatus] = useState('')
  const [data, setData] = useState<VoucherData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (status) params.set('status', status)
      const res = await fetch(`/api/finance/ap-voucher-detail?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate, status])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{fp.apVoucherTitle}</h1>
          <p className="text-sm text-muted-foreground">{fp.apVoucherDesc}</p>
        </div>
        {data && (
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />{dict.common.print}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 print:hidden">
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
            <option value="PARTIAL_PAID">{fp.apStatusPartialPaid}</option>
            <option value="PAID">{fp.apStatusPaid}</option>
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.search}</Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: fp.apSummaryCount, value: String(data.summary.count) },
              { label: fp.apSummaryTotal, value: `$${fmt(data.summary.totalAmount)}`, color: 'text-slate-900' },
              { label: fp.apSummaryPaid, value: `$${fmt(data.summary.totalPaid)}`, color: 'text-green-600' },
              { label: fp.apSummaryBalance, value: `$${fmt(data.summary.totalBalance)}`, color: data.summary.totalBalance > 0 ? 'text-red-600 font-bold' : 'text-slate-700' },
            ].map(c => (
              <div key={c.label} className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-base font-mono ${c.color ?? ''}`}>{c.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">{fp.arColInvoice}</TableHead>
                  <TableHead className="w-24">{fp.arColIssueDate}</TableHead>
                  <TableHead className="w-24">{fp.arColDueDate}</TableHead>
                  <TableHead>{fp.apColSupplier}</TableHead>
                  <TableHead className="w-24">{fp.apColPoNo}</TableHead>
                  <TableHead className="w-16">{fp.apColCurrency}</TableHead>
                  <TableHead className="text-right w-28">{fp.apColAmount}</TableHead>
                  <TableHead className="text-right w-28 text-green-700">{fp.apColPaid}</TableHead>
                  <TableHead className="text-right w-28">{fp.apColBalance}</TableHead>
                  <TableHead className="w-24">{fp.arColStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-12 text-center text-muted-foreground">{fp.apNoRecords}</TableCell></TableRow>
                ) : (
                  <>
                    {data.rows.map(row => {
                      const apStatusLabels: Record<string, string> = { NOT_DUE: fp.statusNotDue, DUE: fp.statusDue, PARTIAL_PAID: fp.apStatusPartialPaid, PAID: fp.apStatusPaid }
                      const sc = { label: apStatusLabels[row.status] ?? row.status, cls: STATUS_CLS[row.status] ?? 'bg-slate-100 text-slate-600' }
                      return (
                        <TableRow key={row.id} className={`text-sm hover:bg-slate-50/40 ${row.status === 'PAID' ? 'opacity-60' : ''}`}>
                          <TableCell className="font-mono text-xs">{row.invoiceNo || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{row.invoiceDate}</TableCell>
                          <TableCell className={`text-sm ${row.dueDate && row.dueDate < new Date().toISOString().slice(0, 10) && row.status !== 'PAID' ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                            {row.dueDate ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Link href={`/finance/party-transactions?partyType=SUPPLIER&partyId=${row.supplierId}`} className="text-blue-600 hover:underline">
                              {row.supplierName}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{row.poNo || '—'}</TableCell>
                          <TableCell className="text-xs">
                            {row.currency !== 'TWD' ? <Badge className="bg-blue-100 text-blue-700 text-xs">{row.currency}</Badge> : <span className="text-muted-foreground">TWD</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono">${fmt(row.amount)}</TableCell>
                          <TableCell className="text-right font-mono text-green-700">{row.paidAmount > 0 ? `$${fmt(row.paidAmount)}` : '—'}</TableCell>
                          <TableCell className={`text-right font-mono font-medium ${row.balance > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {row.balance > 0 ? `$${fmt(row.balance)}` : '—'}
                          </TableCell>
                          <TableCell><Badge className={`text-xs ${sc.cls}`}>{sc.label}</Badge></TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="border-t-2 bg-slate-50 font-semibold text-sm">
                      <TableCell colSpan={6}>{fp.arTotalLabel.replace('{n}', String(data.summary.count))}</TableCell>
                      <TableCell className="text-right font-mono">${fmt(data.summary.totalAmount)}</TableCell>
                      <TableCell className="text-right font-mono text-green-700">${fmt(data.summary.totalPaid)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">${fmt(data.summary.totalBalance)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">{dict.reportsExt.noData}</div>}
    </div>
  )
}
