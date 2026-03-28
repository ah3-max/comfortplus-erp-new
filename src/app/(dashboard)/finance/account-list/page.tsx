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

const TYPE_CONFIG: Record<string, { label: string; badge: string; row: string }> = {
  ASSET:     { label: '資產', badge: 'bg-blue-100 text-blue-700',   row: 'bg-blue-50/30' },
  LIABILITY: { label: '負債', badge: 'bg-amber-100 text-amber-700', row: 'bg-amber-50/30' },
  EQUITY:    { label: '權益', badge: 'bg-purple-100 text-purple-700', row: 'bg-purple-50/30' },
  REVENUE:   { label: '收入', badge: 'bg-green-100 text-green-700', row: 'bg-green-50/30' },
  EXPENSE:   { label: '費用', badge: 'bg-red-100 text-red-700',     row: 'bg-red-50/30' },
}

interface AccountRow {
  id: string; code: string; name: string; type: string; subType: string | null
  normalBalance: string; parentCode: string | null; level: number
  debitTotal?: number; creditTotal?: number; balance?: number
}
interface AccountData {
  summary: { total: number; byType: Record<string, number> }
  accounts: AccountRow[]
}

function fmt(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function AccountListPage() {
  const [type, setType] = useState('all')
  const [includeBalance, setIncludeBalance] = useState(false)
  const [data, setData] = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type, includeBalance: String(includeBalance) })
      const res = await fetch(`/api/finance/account-list?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [type, includeBalance])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">科目明細表</h1>
          <p className="text-sm text-muted-foreground">會計科目表及期間餘額</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">科目類型</label>
          <select value={type} onChange={e => setType(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="all">全部</option>
            <option value="ASSET">資產</option>
            <option value="LIABILITY">負債</option>
            <option value="EQUITY">權益</option>
            <option value="REVENUE">收入</option>
            <option value="EXPENSE">費用</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <input
            type="checkbox" id="inclBal" checked={includeBalance}
            onChange={e => setIncludeBalance(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="inclBal" className="text-sm cursor-pointer">顯示餘額</label>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢
        </Button>
      </div>

      {data && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border bg-white px-4 py-2 text-sm">
              <span className="text-muted-foreground">科目總數 </span>
              <span className="font-semibold">{data.summary.total}</span>
            </div>
            {Object.entries(data.summary.byType).map(([t, count]) => {
              const cfg = TYPE_CONFIG[t]
              return (
                <div key={t} className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-1.5 ${cfg?.row ?? ''}`}>
                  <Badge className={`text-xs ${cfg?.badge ?? ''}`}>{cfg?.label ?? t}</Badge>
                  <span className="font-medium">{count}</span>
                </div>
              )
            })}
          </div>

          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">科目代碼</TableHead>
                  <TableHead>科目名稱</TableHead>
                  <TableHead className="w-20">類型</TableHead>
                  <TableHead className="w-28">正常方向</TableHead>
                  {includeBalance && (
                    <>
                      <TableHead className="text-right w-28">借方合計</TableHead>
                      <TableHead className="text-right w-28">貸方合計</TableHead>
                      <TableHead className="text-right w-28">餘額</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.accounts.length === 0 ? (
                  <TableRow><TableCell colSpan={includeBalance ? 7 : 4} className="py-12 text-center text-muted-foreground">無科目資料</TableCell></TableRow>
                ) : (
                  data.accounts.map(acc => {
                    const cfg = TYPE_CONFIG[acc.type]
                    return (
                      <TableRow key={acc.id} className={`text-sm hover:bg-slate-50/40 ${cfg?.row ?? ''}`}>
                        <TableCell className="font-mono text-xs">{acc.code}</TableCell>
                        <TableCell style={{ paddingLeft: `${(acc.level - 1) * 16 + 16}px` }}>
                          {acc.name}
                          {acc.subType && <span className="ml-2 text-xs text-muted-foreground">({acc.subType})</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${cfg?.badge ?? ''}`}>{cfg?.label ?? acc.type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {acc.normalBalance === 'DEBIT' ? '借方' : '貸方'}
                        </TableCell>
                        {includeBalance && (
                          <>
                            <TableCell className="text-right font-mono text-xs">{fmt(acc.debitTotal ?? 0)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{fmt(acc.creditTotal ?? 0)}</TableCell>
                            <TableCell className={`text-right font-mono text-xs font-medium ${(acc.balance ?? 0) < 0 ? 'text-red-600' : ''}`}>
                              {fmt(acc.balance ?? 0)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">
          請點擊查詢載入科目表
        </div>
      )}
    </div>
  )
}
