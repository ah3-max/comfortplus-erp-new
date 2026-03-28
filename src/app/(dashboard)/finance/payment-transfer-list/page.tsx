'use client'

import { useState, useCallback } from 'react'
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

const METHOD_LABEL: Record<string, string> = {
  TRANSFER: '匯款', CHECK: '支票', CASH: '現金', ONLINE: '網銀', OTHER: '其他',
}

function fmt(n: number) { return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export default function PaymentTransferListPage() {
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
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [startDate, endDate, bankAccount])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">付款單轉帳清單</h1>
          <p className="text-sm text-muted-foreground">應付帳款匯款及轉帳明細，供銀行批次匯款使用</p>
        </div>
        {data && (
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />列印
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 print:hidden">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">開始</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">結束</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">銀行帳號</label>
          <input
            type="text"
            value={bankAccount}
            onChange={e => setBankAccount(e.target.value)}
            placeholder="搜尋銀行帳號…"
            className="rounded-md border px-3 py-2 text-sm w-44"
          />
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢</Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:gap-2">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">付款筆數</p>
              <p className="text-base font-mono">{data.summary.count}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">付款總額</p>
              <p className="text-base font-mono text-red-600 font-bold">${fmt(data.summary.totalAmount)}</p>
            </div>
            {data.summary.byBank.length > 0 && (
              <div className="rounded-lg border bg-white p-3 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground mb-1">依銀行帳號</p>
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
                  <TableHead className="w-28">付款單號</TableHead>
                  <TableHead className="w-24">付款日期</TableHead>
                  <TableHead>供應商名稱</TableHead>
                  <TableHead className="w-32">銀行帳號</TableHead>
                  <TableHead className="w-20">方式</TableHead>
                  <TableHead className="w-16">幣別</TableHead>
                  <TableHead className="text-right w-28">金額</TableHead>
                  <TableHead className="w-24">發票號</TableHead>
                  <TableHead>備註</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">無付款轉帳記錄</TableCell></TableRow>
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
                            {METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
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
                      <TableCell colSpan={6}>合計 {data.summary.count} 筆</TableCell>
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
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">請點擊查詢載入資料</div>}
    </div>
  )
}
