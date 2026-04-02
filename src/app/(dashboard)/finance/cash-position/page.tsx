'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, Wallet } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface AccountRow {
  account: string; incoming: number; outgoing: number; balance: number; lastTx: string
}
interface PositionData {
  asOf: string; totalIncoming: number; totalOutgoing: number; totalBalance: number
  accounts: AccountRow[]
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function CashPositionPage() {
  const { dict } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const [asOf, setAsOf] = useState(today)
  const [data, setData] = useState<PositionData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/cash-position?asOf=${asOf}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [asOf, dict])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.nav.cashPosition}</h1>
          <p className="text-sm text-muted-foreground">各帳戶當前餘額一覽</p>
        </div>
      </div>
      <div className="flex items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">截止日期</label>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.reportsExt.generate}</Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-muted-foreground mb-1">累計收入</p>
              <p className="text-lg font-mono font-semibold text-green-600">${fmt(data.totalIncoming)}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-muted-foreground mb-1">累計支出</p>
              <p className="text-lg font-mono font-semibold text-red-600">${fmt(data.totalOutgoing)}</p>
            </div>
            <div className={`rounded-lg border p-4 ${data.totalBalance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Wallet className="h-3 w-3" />總資金餘額</p>
              <p className={`text-2xl font-mono font-bold ${data.totalBalance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>${fmt(data.totalBalance)}</p>
              <p className="text-xs text-muted-foreground mt-1">截至 {data.asOf}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>帳戶 / 付款方式</TableHead>
                  <TableHead className="text-right w-32 text-green-700">累計收入</TableHead>
                  <TableHead className="text-right w-32 text-red-600">累計支出</TableHead>
                  <TableHead className="text-right w-32">餘額</TableHead>
                  <TableHead className="w-24">最後交易</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.accounts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">無資料</TableCell></TableRow>
                ) : data.accounts.map(acc => (
                  <TableRow key={acc.account} className="text-sm hover:bg-slate-50/40">
                    <TableCell className="font-medium">{acc.account}</TableCell>
                    <TableCell className="text-right font-mono text-green-700">${fmt(acc.incoming)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">${fmt(acc.outgoing)}</TableCell>
                    <TableCell className={`text-right font-mono font-bold ${acc.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>${fmt(acc.balance)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{acc.lastTx || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {!data && !loading && <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">{dict.reportsExt.noData}</div>}
    </div>
  )
}
