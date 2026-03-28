'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Account { id: string; code: string; name: string }

interface SummaryRow { description: string; referenceType: string | null; count: number; debit: number; credit: number }
interface AccountGroup {
  accountId: string; code: string; name: string; type: string
  totalDebit: number; totalCredit: number
  summaries: SummaryRow[]
}

const TYPE_COLORS: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-700', LIABILITY: 'bg-amber-100 text-amber-700',
  EQUITY: 'bg-purple-100 text-purple-700', REVENUE: 'bg-green-100 text-green-700', EXPENSE: 'bg-red-100 text-red-700',
}
const TYPE_LABELS: Record<string, string> = {
  ASSET: '資產', LIABILITY: '負債', EQUITY: '權益', REVENUE: '收入', EXPENSE: '費用',
}

function fmt(n: number) {
  return n > 0 ? n.toLocaleString('zh-TW') : '—'
}

export default function AccountSummaryPage() {
  const { dict } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`

  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedId, setSelectedId] = useState('')
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
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (selectedId) params.set('accountId', selectedId)
      const res = await fetch(`/api/finance/account-summary?${params}`)
      if (!res.ok) throw new Error()
      const d = await res.json()
      setGroups(d.groups)
      setExpanded(new Set(d.groups.map((g: AccountGroup) => g.accountId)))
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [selectedId, startDate, endDate])

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
          <h1 className="text-2xl font-bold text-slate-900">{dict.nav.accountSummary}</h1>
          <p className="text-sm text-muted-foreground">按科目和摘要分組顯示借貸合計</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">科目（空白 = 全部）</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="rounded-md border px-3 py-2 text-sm min-w-[240px]">
            <option value="">全部科目</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.startDate}</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.endDate}</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.reportsExt.generate}
        </Button>
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[g.type] ?? ''}`}>
                    {TYPE_LABELS[g.type] ?? g.type}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">{g.code}</span>
                  <span className="font-semibold">{g.name}</span>
                  <span className="text-xs text-muted-foreground">{g.summaries.length} 種摘要</span>
                </div>
                <div className="flex gap-4 text-sm font-mono">
                  <span className="text-muted-foreground">借 <span className="text-slate-700">{g.totalDebit.toLocaleString('zh-TW')}</span></span>
                  <span className="text-muted-foreground">貸 <span className="text-slate-700">{g.totalCredit.toLocaleString('zh-TW')}</span></span>
                </div>
              </div>

              {expanded.has(g.accountId) && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>摘要</TableHead>
                      <TableHead className="w-20">來源類型</TableHead>
                      <TableHead className="text-right w-16">筆數</TableHead>
                      <TableHead className="text-right w-28">借方合計</TableHead>
                      <TableHead className="text-right w-28">貸方合計</TableHead>
                      <TableHead className="text-right w-28">淨額</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.summaries.map((s, i) => (
                      <TableRow key={i} className="text-sm hover:bg-slate-50/40">
                        <TableCell>{s.description}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.referenceType ?? '手動'}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{s.count}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(s.debit)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(s.credit)}</TableCell>
                        <TableCell className={`text-right font-mono font-medium ${(s.debit - s.credit) < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                          {(s.debit - s.credit).toLocaleString('zh-TW')}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-semibold text-sm">
                      <TableCell colSpan={3}>合計</TableCell>
                      <TableCell className="text-right font-mono">{g.totalDebit.toLocaleString('zh-TW')}</TableCell>
                      <TableCell className="text-right font-mono">{g.totalCredit.toLocaleString('zh-TW')}</TableCell>
                      <TableCell className="text-right font-mono">{(g.totalDebit - g.totalCredit).toLocaleString('zh-TW')}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">
          {dict.reportsExt.noData}
        </div>
      )}
    </div>
  )
}
