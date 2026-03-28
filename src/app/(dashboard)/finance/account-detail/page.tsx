'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Account { id: string; code: string; name: string; type: string; normalBalance: string }

interface LedgerRow {
  id: string; entryNo: string; entryDate: string; description: string
  referenceType: string | null; referenceId: string | null; entryType: string
  debit: number; credit: number; runningBalance: number
}

interface AccountGroup {
  accountId: string; code: string; name: string; normalBalance: string
  periodDebit: number; periodCredit: number
  rows: LedgerRow[]
}

const REF_LABELS: Record<string, string> = {
  SalesInvoice: '銷貨單', AccountsPayable: '應付', PaymentRecord: '收付款',
  AccountsReceivable: '應收', PurchaseOrder: '採購', JournalEntry: '傳票',
}

function fmt(n: number) {
  if (n === 0) return ''
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function AccountDetailPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`

  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [refType, setRefType] = useState('')
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [groups, setGroups] = useState<AccountGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/finance/accounts')
      .then(r => r.json())
      .then(d => setAccounts(d.data ?? []))
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedIds.length) { toast.error('請選擇科目'); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      selectedIds.forEach(id => params.append('accountId', id))
      if (refType) params.set('referenceType', refType)
      const res = await fetch(`/api/finance/account-detail?${params}`)
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      const d = await res.json()
      setGroups(d.groups)
      setExpanded(new Set(d.groups.map((g: AccountGroup) => g.accountId)))
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '載入失敗') }
    finally { setLoading(false) }
  }, [selectedIds, refType, startDate, endDate])

  function toggleAccount(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">科目/往來明細帳</h1>
          <p className="text-sm text-muted-foreground">多科目明細，可依來源類型篩選</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">科目（可多選）</label>
            <div className="max-h-40 overflow-y-auto rounded-md border p-2 min-w-[240px] space-y-1">
              {accounts.map(a => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded text-sm">
                  <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => toggleAccount(a.id)} className="accent-blue-600" />
                  <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                  <span>{a.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">來源類型</label>
            <select value={refType} onChange={e => setRefType(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
              <option value="">全部</option>
              {Object.entries(REF_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">開始</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">結束</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
          </div>
          <Button onClick={fetchData} disabled={!selectedIds.length || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢
          </Button>
        </div>
        {selectedIds.length > 0 && (
          <p className="text-xs text-muted-foreground">已選 {selectedIds.length} 個科目</p>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : groups.length > 0 ? (
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.accountId} className="rounded-lg border bg-white overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100"
                onClick={() => toggleExpand(g.accountId)}
              >
                <div className="flex items-center gap-3">
                  {expanded.has(g.accountId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-mono text-sm text-muted-foreground">{g.code}</span>
                  <span className="font-semibold">{g.name}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">借方：<span className="font-mono text-slate-700">{g.rows.slice(1).reduce((s, r) => s + r.debit, 0).toLocaleString('zh-TW')}</span></span>
                  <span className="text-muted-foreground">貸方：<span className="font-mono text-slate-700">{g.rows.slice(1).reduce((s, r) => s + r.credit, 0).toLocaleString('zh-TW')}</span></span>
                </div>
              </div>

              {expanded.has(g.accountId) && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">日期</TableHead>
                      <TableHead className="w-28">傳票號</TableHead>
                      <TableHead>摘要</TableHead>
                      <TableHead className="w-20">來源</TableHead>
                      <TableHead className="text-right w-28">借方</TableHead>
                      <TableHead className="text-right w-28">貸方</TableHead>
                      <TableHead className="text-right w-32">餘額</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((row, idx) => (
                      <TableRow key={row.id} className={`text-sm ${idx === 0 ? 'bg-slate-50/60 italic text-muted-foreground' : 'hover:bg-slate-50/40'}`}>
                        <TableCell>{row.entryDate}</TableCell>
                        <TableCell className="font-mono text-xs">{row.entryNo || '—'}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell>
                          {row.referenceType && (
                            <span className="text-xs text-muted-foreground">{REF_LABELS[row.referenceType] ?? row.referenceType}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.debit)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.credit)}</TableCell>
                        <TableCell className={`text-right font-mono font-medium ${row.runningBalance < 0 ? 'text-red-600' : ''}`}>
                          {row.runningBalance.toLocaleString('zh-TW')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">
          請選擇科目並點擊查詢
        </div>
      )}
    </div>
  )
}
