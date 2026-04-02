'use client'

import { useState, useCallback, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface MovementRow {
  id: string; code: string; name: string; type: string; normalBalance: string
  openingBalance: number; increase: number; decrease: number; closingBalance: number; netChange: number
}

const TYPE_COLORS: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-700', LIABILITY: 'bg-amber-100 text-amber-700',
  EQUITY: 'bg-purple-100 text-purple-700', REVENUE: 'bg-green-100 text-green-700', EXPENSE: 'bg-red-100 text-red-700',
}
const TYPE_LABELS: Record<string, string> = {
  ASSET: '資產', LIABILITY: '負債', EQUITY: '權益', REVENUE: '收入', EXPENSE: '費用',
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function AccountMovementPage() {
  const { dict } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`

  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [typeFilter, setTypeFilter] = useState('')
  const [rows, setRows] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<{ startDate: string; endDate: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (typeFilter) params.set('type', typeFilter)
      const res = await fetch(`/api/finance/account-movement?${params}`)
      if (!res.ok) throw new Error()
      const d = await res.json()
      setRows(d.rows)
      setPeriod(d.period)
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate, typeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Group by type
  const grouped = rows.reduce<Record<string, MovementRow[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.nav.accountMovement}</h1>
          <p className="text-sm text-muted-foreground">各科目期初餘額、本期增減、期末餘額</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">科目類型</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">全部類型</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
        {period && (
          <p className="text-xs text-muted-foreground self-end pb-2">
            {period.startDate} ～ {period.endDate}，共 {rows.length} 個科目
          </p>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length > 0 ? (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, typeRows]) => (
            <div key={type} className="rounded-lg border bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[type] ?? ''}`}>
                  {TYPE_LABELS[type] ?? type}
                </span>
                <span className="text-sm text-muted-foreground">{typeRows.length} 個科目</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">科目代碼</TableHead>
                    <TableHead>科目名稱</TableHead>
                    <TableHead className="text-right w-32">期初餘額</TableHead>
                    <TableHead className="text-right w-28 text-green-700">本期增加</TableHead>
                    <TableHead className="text-right w-28 text-red-600">本期減少</TableHead>
                    <TableHead className="text-right w-32">期末餘額</TableHead>
                    <TableHead className="text-right w-28">淨變動</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeRows.map(row => (
                    <TableRow key={row.id} className="text-sm hover:bg-slate-50/40">
                      <TableCell className="font-mono">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(row.openingBalance)}</TableCell>
                      <TableCell className="text-right font-mono text-green-700">
                        {row.increase > 0 ? fmt(row.increase) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {row.decrease > 0 ? fmt(row.decrease) : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${row.closingBalance < 0 ? 'text-red-600' : ''}`}>
                        {fmt(row.closingBalance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`inline-flex items-center gap-1 text-xs font-medium ${row.netChange > 0 ? 'text-green-600' : row.netChange < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {row.netChange > 0 ? <TrendingUp className="h-3 w-3" /> : row.netChange < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                          {row.netChange !== 0 ? fmt(Math.abs(row.netChange)) : '—'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
