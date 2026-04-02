'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Account { id: string; code: string; name: string; type: string; normalBalance: string }

interface LedgerRow {
  id: string
  entryId: string
  entryNo: string
  entryDate: string
  description: string
  entryType: string
  referenceType: string | null
  referenceId: string | null
  debit: number
  credit: number
  balance: number
}

interface LedgerData {
  account: Account
  period: { startDate: string; endDate: string }
  openingBalance: number
  periodDebitTotal: number
  periodCreditTotal: number
  closingBalance: number
  rows: LedgerRow[]
}

const typeColors: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-700',
  LIABILITY: 'bg-amber-100 text-amber-700',
  EQUITY: 'bg-purple-100 text-purple-700',
  REVENUE: 'bg-green-100 text-green-700',
  EXPENSE: 'bg-red-100 text-red-700',
}
// Account type labels provided via dict.generalLedgerExt.typeLabels

function fmt(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtBalance(n: number) {
  if (n === 0) return <span className="text-muted-foreground">0</span>
  return <span className={n > 0 ? 'text-slate-800' : 'text-red-600'}>{n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
}

export default function GeneralLedgerPage() {
  const { dict } = useI18n()
  const gl = dict.generalLedgerExt
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`

  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [data, setData] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(true)

  useEffect(() => {
    fetch('/api/finance/accounts')
      .then(r => r.json())
      .then(d => { setAccounts(d.data ?? []); setLoadingAccounts(false) })
      .catch(() => setLoadingAccounts(false))
  }, [])

  const fetchLedger = useCallback(async () => {
    if (!selectedId) { toast.error(dict.generalLedger.selectAccount); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ accountId: selectedId, startDate, endDate })
      const res = await fetch(`/api/finance/general-ledger?${params}`)
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setData(await res.json())
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [selectedId, startDate, endDate])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.nav.generalLedger}</h1>
          <p className="text-sm text-muted-foreground">{gl.subtitle}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{gl.accountLabel}</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm min-w-[260px]"
            disabled={loadingAccounts}
          >
            <option value="">{dict.common.select}{gl.accountPlaceholder}</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.code} {a.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.startDate}</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.common.endDate}</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <Button onClick={fetchLedger} disabled={!selectedId || loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dict.reportsExt.generate}
        </Button>
      </div>

      {/* Account info + summary */}
      {data && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-3">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[data.account.type] ?? ''}`}>
              {(gl.typeLabels as Record<string, string>)[data.account.type] ?? data.account.type}
            </span>
            <span className="font-mono font-semibold">{data.account.code}</span>
            <span className="font-medium">{data.account.name}</span>
          </div>
          {[
            { label: gl.openingBalance, value: data.openingBalance },
            { label: gl.periodDebit, value: data.periodDebitTotal },
            { label: gl.periodCredit, value: data.periodCreditTotal },
            { label: gl.closingBalance, value: data.closingBalance, bold: true },
          ].map(card => (
            <div key={card.label} className="rounded-lg border bg-white px-4 py-3 min-w-[120px]">
              <p className="text-xs text-muted-foreground mb-0.5">{card.label}</p>
              <p className={`text-base font-mono ${card.bold ? 'font-bold' : ''} ${card.value < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {card.value.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Ledger table */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-24">{gl.colDate}</TableHead>
                <TableHead className="w-32">{gl.colVoucherNo}</TableHead>
                <TableHead>{gl.colSummary}</TableHead>
                <TableHead className="w-20 text-center">{gl.colType}</TableHead>
                <TableHead className="text-right w-32">{gl.colDebit}</TableHead>
                <TableHead className="text-right w-32">{gl.colCredit}</TableHead>
                <TableHead className="text-right w-36">{gl.colRunningBalance}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Opening balance row */}
              <TableRow className="bg-slate-50/80 italic text-muted-foreground text-sm">
                <TableCell>{data.period.startDate}</TableCell>
                <TableCell>—</TableCell>
                <TableCell>{gl.openingBalanceRow}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-mono font-semibold text-slate-700">
                  {data.openingBalance.toLocaleString('zh-TW')}
                </TableCell>
              </TableRow>

              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    {gl.noRecords}
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map(row => (
                  <TableRow key={row.id} className="hover:bg-slate-50/60 text-sm">
                    <TableCell className="text-muted-foreground">{row.entryDate}</TableCell>
                    <TableCell>
                      <Link href={`/finance#journal`} className="font-mono text-blue-600 hover:underline text-xs">
                        {row.entryNo}
                      </Link>
                    </TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-muted-foreground">{row.entryType}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.debit > 0 ? fmt(row.debit) : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.credit > 0 ? fmt(row.credit) : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {fmtBalance(row.balance)}
                    </TableCell>
                  </TableRow>
                ))
              )}

              {/* Closing row */}
              {data.rows.length > 0 && (
                <TableRow className="border-t-2 bg-slate-100 font-semibold text-sm">
                  <TableCell colSpan={3} className="text-slate-700">
                    {gl.closingRow.replace('{n}', String(data.rows.length))}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono">{fmt(data.periodDebitTotal)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(data.periodCreditTotal)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {data.closingBalance.toLocaleString('zh-TW')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">
          {gl.prompt} {dict.reportsExt.generate}
        </div>
      )}
    </div>
  )
}
