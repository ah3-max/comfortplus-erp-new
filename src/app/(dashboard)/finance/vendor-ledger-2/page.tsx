'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface SupplierRow {
  supplierId: string; supplierName: string; supplierCode: string
  invoiceCount: number; totalAmount: number; paidAmount: number
  balance: number; overdueAmount: number; oldestDueDate: string | null
}
interface LedgerData {
  period: { startDate: string; endDate: string }
  summary: { totalOutstanding: number; totalOverdue: number; totalPaid: number; supplierCount: number }
  rows: SupplierRow[]
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function VendorLedger2Page() {
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
      const res = await fetch(`/api/finance/vendor-ledger-2?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [startDate, endDate, status])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">供應商管理帳簿</h1>
          <p className="text-sm text-muted-foreground">應付帳款供應商別彙總</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">開始</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">結束</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">狀態</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">全部</option>
            <option value="NOT_DUE">未到期</option>
            <option value="DUE">已到期</option>
            <option value="PAID">已付</option>
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '應付餘額', value: data.summary.totalOutstanding, color: 'text-slate-900 font-bold' },
              { label: '逾期金額', value: data.summary.totalOverdue, color: 'text-red-600' },
              { label: '已付金額', value: data.summary.totalPaid, color: 'text-green-600' },
              { label: '供應商數', value: data.summary.supplierCount, color: 'text-slate-700', isCount: true },
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
                  <TableHead className="w-24">供應商代碼</TableHead>
                  <TableHead>供應商名稱</TableHead>
                  <TableHead className="text-right w-16">筆數</TableHead>
                  <TableHead className="text-right w-32">應付總額</TableHead>
                  <TableHead className="text-right w-32">已付金額</TableHead>
                  <TableHead className="text-right w-32">未付餘額</TableHead>
                  <TableHead className="text-right w-32 text-red-600">逾期金額</TableHead>
                  <TableHead className="w-28">最舊到期日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">無應付帳款記錄</TableCell></TableRow>
                ) : (
                  data.rows.map(row => (
                    <TableRow key={row.supplierId} className="text-sm hover:bg-slate-50/40">
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.supplierCode}</TableCell>
                      <TableCell>
                        <Link
                          href={`/finance/party-transactions?partyType=SUPPLIER&partyId=${row.supplierId}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {row.supplierName}
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
          請點擊查詢載入資料
        </div>
      )}
    </div>
  )
}
