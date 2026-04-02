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

interface TransferRow {
  id: string; paymentNo: string; paymentDate: string
  supplierId: string; supplierName: string; supplierCode: string
  bankAccount: string; paymentMethod: string
  amount: number; currency: string; invoiceNo: string
  referenceNo: string; notes: string
}
interface BankGroup { bankAccount: string; count: number; totalAmount: number }
interface TransferData {
  period: { startDate: string; endDate: string }
  summary: { count: number; totalAmount: number; byBank: BankGroup[] }
  rows: TransferRow[]
}


function fmt(n: number) { return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export default function PaymentTransferListPage() {
  const { dict } = useI18n()
  const fp = dict.financePages
  const methodLabel: Record<string, string> = {
    TRANSFER: fp.ptMethodTransfer, CHECK: fp.ptMethodCheck, CASH: fp.ptMethodCash, ONLINE: fp.ptMethodOnline, OTHER: fp.ptMethodOther,
  }
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [bankAccount, setBankAccount] = useState('')
  const [data, setData] = useState<TransferData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (bankAccount) params.set('bankAccount', bankAccount)
      const res = await fetch(`/api/finance/payment-transfer-list?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate, bankAccount])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{fp.ptTitle}</h1>
          <p className="text-sm text-muted-foreground">{fp.ptDesc}</p>
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
          <label className="text-xs font-medium text-muted-foreground">{fp.ptBankLabel}</label>
          <input
            type="text"
            value={bankAccount}
            onChange={e => setBankAccount(e.target.value)}
            placeholder={fp.ptBankPlaceholder}
            className="rounded-md border px-3 py-2 text-sm w-44"
          />
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.search}</Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:gap-2">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">{fp.ptSummaryCount}</p>
              <p className="text-base font-mono">{data.summary.count}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">{fp.ptSummaryTotal}</p>
              <p className="text-base font-mono text-red-600 font-bold">${fmt(data.summary.totalAmount)}</p>
            </div>
            {data.summary.byBank.length > 0 && (
              <div className="rounded-lg border bg-white p-3 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground mb-1">{fp.ptSummaryByBank}</p>
                <div className="space-y-0.5">
                  {data.summary.byBank.map(b => (
                    <div key={b.bankAccount} className="flex justify-between text-xs">
                      <span className="font-mono text-muted-foreground truncate max-w-[120px]">{b.bankAccount}</span>
                      <span className="font-mono">${fmt(b.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">{fp.ptColPaymentNo}</TableHead>
                  <TableHead className="w-24">{fp.ptColDate}</TableHead>
                  <TableHead>{fp.ptColSupplier}</TableHead>
                  <TableHead className="w-32">{fp.ptColBankAccount}</TableHead>
                  <TableHead className="w-20">{fp.ptColMethod}</TableHead>
                  <TableHead className="w-16">{fp.ptColCurrency}</TableHead>
                  <TableHead className="text-right w-28">{fp.ptColAmount}</TableHead>
                  <TableHead className="w-24">{fp.ptColInvoice}</TableHead>
                  <TableHead>{fp.ptColNotes}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">{fp.ptNoRecords}</TableCell></TableRow>
                ) : (
                  <>
                    {data.rows.map(row => (
                      <TableRow key={row.id} className="text-sm hover:bg-slate-50/40">
                        <TableCell className="font-mono text-xs">{row.paymentNo || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{row.paymentDate}</TableCell>
                        <TableCell>
                          <Link href={`/finance/party-transactions?partyType=SUPPLIER&partyId=${row.supplierId}`} className="text-blue-600 hover:underline">
                            {row.supplierName}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{row.bankAccount || '—'}</TableCell>
                        <TableCell>
                          <Badge className="bg-slate-100 text-slate-700 text-xs">
                            {methodLabel[row.paymentMethod] ?? row.paymentMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.currency !== 'TWD'
                            ? <Badge className="bg-blue-100 text-blue-700 text-xs">{row.currency}</Badge>
                            : <span className="text-muted-foreground">TWD</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">${fmt(row.amount)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{row.invoiceNo || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-slate-50 font-semibold text-sm">
                      <TableCell colSpan={6}>{fp.arTotalLabel.replace('{n}', String(data.summary.count))}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">${fmt(data.summary.totalAmount)}</TableCell>
                      <TableCell colSpan={2} />
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
