'use client'

import { useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface EntryLine {
  lineNo: number; accountCode: string; accountName: string; accountType: string
  description: string; debit: number; credit: number
}
interface Entry {
  id: string; entryNo: string; entryDate: string; description: string
  status: string; entryType: string; referenceType: string | null; referenceId: string | null
  totalDebit: number; totalCredit: number; postedAt: string | null
  createdBy: string; postedBy: string | null; lines: EntryLine[]
}
interface TxData {
  data: Entry[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

const STATUS_COLORS: Record<string, string> = {
  POSTED: 'bg-green-100 text-green-700',
  DRAFT: 'bg-slate-100 text-slate-600',
  REVERSED: 'bg-red-100 text-red-600',
}
const TYPE_COLORS: Record<string, string> = {
  MANUAL: 'bg-blue-100 text-blue-700',
  AUTO: 'bg-purple-100 text-purple-700',
  ADJUSTMENT: 'bg-amber-100 text-amber-700',
  CLOSING: 'bg-slate-100 text-slate-600',
}
const TYPE_LABELS: Record<string, string> = { ASSET: '資產', LIABILITY: '負債', EQUITY: '權益', REVENUE: '收入', EXPENSE: '費用' }

function fmt(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function TransactionDetailPage() {
  const { dict } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [entryType, setEntryType] = useState('')
  const [status, setStatus] = useState('POSTED')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<TxData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate, status, page: String(p), pageSize: '50' })
      if (entryType) params.set('entryType', entryType)
      const res = await fetch(`/api/finance/transaction-detail?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
      setPage(p)
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate, entryType, status])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">會計交易明細</h1>
          <p className="text-sm text-muted-foreground">傳票逐筆明細及分錄展開</p>
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
          <label className="text-xs font-medium text-muted-foreground">{dict.common.status}</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="POSTED">已過帳</option>
            <option value="DRAFT">草稿</option>
            <option value="">{dict.common.all}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.type}</label>
          <select value={entryType} onChange={e => setEntryType(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">{dict.common.all}</option>
            <option value="MANUAL">手動</option>
            <option value="AUTO">自動</option>
            <option value="ADJUSTMENT">調整</option>
            <option value="CLOSING">結帳</option>
          </select>
        </div>
        <Button onClick={() => fetchData(1)} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.search}</Button>
      </div>
      {data && (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {data.pagination.total} 筆 · 第 {data.pagination.page}/{data.pagination.totalPages} 頁</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => fetchData(page - 1)}>{dict.common.prevPage}</Button>
              <Button size="sm" variant="outline" disabled={page >= data.pagination.totalPages || loading} onClick={() => fetchData(page + 1)}>{dict.common.nextPage}</Button>
            </div>
          </div>
          <div className="rounded-lg border bg-white overflow-hidden">
            {data.data.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">無傳票記錄</div>
            ) : data.data.map(entry => {
              const isOpen = expanded.has(entry.id)
              return (
                <div key={entry.id} className="border-b last:border-0">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/60 text-sm"
                    onClick={() => toggleExpand(entry.id)}
                  >
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    <span className="font-mono text-xs text-muted-foreground w-28 flex-shrink-0">{entry.entryDate}</span>
                    <span className="font-mono text-xs font-medium w-32 flex-shrink-0">{entry.entryNo}</span>
                    <Badge className={`text-xs flex-shrink-0 ${STATUS_COLORS[entry.status] ?? ''}`}>{entry.status === 'POSTED' ? '已過帳' : entry.status === 'DRAFT' ? '草稿' : '已沖正'}</Badge>
                    <Badge className={`text-xs flex-shrink-0 ${TYPE_COLORS[entry.entryType] ?? ''}`}>{entry.entryType === 'MANUAL' ? '手動' : entry.entryType === 'AUTO' ? '自動' : entry.entryType === 'ADJUSTMENT' ? '調整' : '結帳'}</Badge>
                    <span className="flex-1 truncate">{entry.description}</span>
                    <span className="font-mono text-xs text-right w-28 flex-shrink-0">${fmt(entry.totalDebit)}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{entry.createdBy}</span>
                  </div>
                  {isOpen && (
                    <div className="bg-slate-50 border-t px-4 py-3">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="h-8 w-8">#</TableHead>
                            <TableHead className="h-8 w-24">科目代碼</TableHead>
                            <TableHead className="h-8">科目名稱</TableHead>
                            <TableHead className="h-8 w-16">類型</TableHead>
                            <TableHead className="h-8">摘要</TableHead>
                            <TableHead className="h-8 text-right w-28">借方</TableHead>
                            <TableHead className="h-8 text-right w-28">貸方</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entry.lines.map(line => (
                            <TableRow key={line.lineNo} className="text-xs hover:bg-white/60">
                              <TableCell className="py-1.5">{line.lineNo}</TableCell>
                              <TableCell className="py-1.5 font-mono">{line.accountCode}</TableCell>
                              <TableCell className="py-1.5">{line.accountName}</TableCell>
                              <TableCell className="py-1.5 text-muted-foreground">{TYPE_LABELS[line.accountType] ?? line.accountType}</TableCell>
                              <TableCell className="py-1.5 text-muted-foreground">{line.description || '—'}</TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{fmt(line.debit)}</TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{fmt(line.credit)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t bg-white font-semibold text-xs">
                            <TableCell colSpan={5} className="py-1.5">合計</TableCell>
                            <TableCell className="py-1.5 text-right font-mono">${fmt(entry.totalDebit)}</TableCell>
                            <TableCell className="py-1.5 text-right font-mono">${fmt(entry.totalCredit)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      {entry.referenceType && (
                        <p className="text-xs text-muted-foreground mt-2">來源：{entry.referenceType} #{entry.referenceId}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">{dict.reportsExt.noData}</div>}
    </div>
  )
}
