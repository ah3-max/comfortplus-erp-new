'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Loader2, Plus, Trash2, CheckCircle2, TrendingUp, Scale, BookOpen, RotateCcw, ChevronDown, ChevronUp, BarChart2, AlertTriangle, FileDown } from 'lucide-react'
import { toast } from 'sonner'

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`
}

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
interface IncomeStatement {
  period: { year: number; month: number | null }
  revenue: { gross: number; excludeTax: number; taxCollected: number; invoiceCount: number; cashReceived: number; outstandingAR: number }
  cogs: number
  grossProfit: number
  grossMarginPct: number
  expenses: { freight: number; other: number; total: number }
  operatingProfit: number
  netProfit: number
  monthlyData: Array<{ month: number; revenue: number; cashReceived: number; invoiceCount: number }>
}

interface BalanceSheet {
  asOf: string
  assets: {
    current: {
      cash: number
      accountsReceivable: { balance: number; total: number; paid: number; count: number }
      inventory: { value: number; quantity: number; items: number }
      salesInvoicesOutstanding: { amount: number; count: number }
      total: number
    }
    total: number
  }
  liabilities: {
    current: { accountsPayable: { balance: number; count: number }; total: number }
    total: number
  }
  equity: { estimated: number; note: string }
}

interface JournalEntry {
  id: string; entryNo: string; entryDate: string; description: string
  status: string; entryType: string; totalDebit: string; totalCredit: string
  createdAt: string
  createdBy: { id: string; name: string }
  postedBy: { id: string; name: string } | null
  lines: Array<{ id: string; debit: string; credit: string; description: string | null; account: { code: string; name: string } }>
}

interface Account { id: string; code: string; name: string; type: string }

interface TrialBalanceRow {
  id: string; code: string; name: string; type: string; normalBalance: string
  openingDebit: number; openingCredit: number
  periodDebit: number; periodCredit: number
  closingDebit: number; closingCredit: number
}
interface TrialBalanceData {
  rows: TrialBalanceRow[]
  totals: { openingDebit: number; openingCredit: number; periodDebit: number; periodCredit: number; closingDebit: number; closingCredit: number }
  isBalanced: boolean
  period: { startDate: string; endDate: string }
}

const CURRENT_YEAR = new Date().getFullYear()

export default function FinancePage() {
  const { dict, locale } = useI18n()
  const fi = dict.finance
  const fp = dict.financePage
  const [tab, setTab] = useState('income')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [month, setMonth] = useState<number | ''>('')

  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString(locale, { month: 'short' })
  )

  const fmt = (n: number, prefix = '$') =>
    `${prefix}${Math.round(n).toLocaleString(locale)}`

  const incomeKey = fp.incomeKey
  const cashKey = fp.cashKey

  const [incomeStmt, setIncomeStmt] = useState<IncomeStatement | null>(null)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null)
  const [loadingIncome, setLoadingIncome] = useState(false)
  const [loadingBalance, setLoadingBalance] = useState(false)

  // Journal entries
  const [journals, setJournals] = useState<JournalEntry[]>([])
  const [loadingJournals, setLoadingJournals] = useState(false)
  const [journalPage, setJournalPage] = useState(1)
  const [journalPagination, setJournalPagination] = useState<{ total: number; totalPages: number } | null>(null)

  // Journal detail expand
  const [expandedJournal, setExpandedJournal] = useState<string | null>(null)

  // New journal dialog
  const [showJournalDialog, setShowJournalDialog] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [jForm, setJForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    description: '',
    notes: '',
    lines: [
      { accountId: '', debit: '', credit: '', description: '' },
      { accountId: '', debit: '', credit: '', description: '' },
    ],
  })
  const [submitting, setSubmitting] = useState(false)

  // Trial balance
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [trialStart, setTrialStart] = useState(firstOfMonth)
  const [trialEnd, setTrialEnd] = useState(today)
  const [trialData, setTrialData] = useState<TrialBalanceData | null>(null)
  const [loadingTrial, setLoadingTrial] = useState(false)

  const fetchIncome = useCallback(async () => {
    setLoadingIncome(true)
    try {
      const params = new URLSearchParams({ year: String(year) })
      if (month) params.set('month', String(month))
      const res = await fetch(`/api/finance/income-statement?${params}`)
      if (!res.ok) throw new Error()
      setIncomeStmt(await res.json())
    } catch { toast.error(fi.incomeLoadFailed) }
    finally { setLoadingIncome(false) }
  }, [year, month])

  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true)
    try {
      const res = await fetch('/api/finance/balance-sheet')
      if (!res.ok) throw new Error()
      setBalanceSheet(await res.json())
    } catch { toast.error(fi.balanceLoadFailed) }
    finally { setLoadingBalance(false) }
  }, [])

  const fetchJournals = useCallback(async () => {
    setLoadingJournals(true)
    try {
      const res = await fetch(`/api/finance/journal-entries?page=${journalPage}&pageSize=20`)
      const result = await res.json()
      setJournals(result.data ?? [])
      setJournalPagination(result.pagination)
    } catch { toast.error(fi.journalLoadFailed) }
    finally { setLoadingJournals(false) }
  }, [journalPage])

  const fetchTrialBalance = useCallback(async (start = trialStart, end = trialEnd) => {
    setLoadingTrial(true)
    try {
      const res = await fetch(`/api/finance/trial-balance?startDate=${start}&endDate=${end}`)
      if (!res.ok) throw new Error()
      setTrialData(await res.json())
    } catch { toast.error(fi.trialBalanceFailed) }
    finally { setLoadingTrial(false) }
  }, [trialStart, trialEnd])

  useEffect(() => { if (tab === 'income') fetchIncome() }, [tab, fetchIncome])
  useEffect(() => { if (tab === 'balance') fetchBalance() }, [tab, fetchBalance])
  useEffect(() => { if (tab === 'journal') fetchJournals() }, [tab, fetchJournals])
  useEffect(() => { if (tab === 'trial') fetchTrialBalance() }, [tab, fetchTrialBalance])

  useEffect(() => {
    if (!showJournalDialog) return
    fetch('/api/finance/accounts').then(r => r.json()).then(d => setAccounts(d.data ?? [])).catch(() => {})
  }, [showJournalDialog])

  function addLine() {
    setJForm(f => ({ ...f, lines: [...f.lines, { accountId: '', debit: '', credit: '', description: '' }] }))
  }

  function removeLine(idx: number) {
    setJForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))
  }

  function updateLine(idx: number, field: string, value: string) {
    setJForm(f => ({
      ...f,
      lines: f.lines.map((l, i) => i === idx ? { ...l, [field]: value } : l),
    }))
  }

  const totalDebit = jForm.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = jForm.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  async function submitJournal() {
    if (!jForm.description) { toast.error(fi.descriptionRequired); return }
    if (!isBalanced) { toast.error(fi.notBalanced); return }
    setSubmitting(true)
    try {
      const lines = jForm.lines
        .filter(l => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
        .map(l => ({ accountId: l.accountId, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0, description: l.description || null }))
      const res = await fetch('/api/finance/journal-entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...jForm, lines }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      toast.success(fi.journalCreated)
      setShowJournalDialog(false)
      setJForm({ entryDate: new Date().toISOString().slice(0, 10), description: '', notes: '', lines: [{ accountId: '', debit: '', credit: '', description: '' }, { accountId: '', debit: '', credit: '', description: '' }] })
      fetchJournals()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : dict.common.createFailed) }
    finally { setSubmitting(false) }
  }

  async function postEntry(id: string) {
    const res = await fetch(`/api/finance/journal-entries/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'POST' }),
    })
    if (res.ok) { toast.success(fi.postedSuccess); fetchJournals() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.operationFailed) }
  }

  async function deleteEntry(id: string) {
    if (!confirm(fp.confirmDeleteJournal)) return
    const res = await fetch(`/api/finance/journal-entries/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.common.deleteSuccess); fetchJournals() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.deleteFailed) }
  }

  async function reverseEntry(id: string) {
    if (!confirm(fp.confirmReverse)) return
    const res = await fetch(`/api/finance/journal-entries/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REVERSE' }),
    })
    if (res.ok) { toast.success(fi.reversalCreated); fetchJournals() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.operationFailed) }
  }

  const chartData = incomeStmt?.monthlyData.map(d => ({
    name: MONTHS[d.month - 1],
    [incomeKey]: Math.round(d.revenue / 1000),
    [cashKey]: Math.round(d.cashReceived / 1000),
  })) ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.nav.finance}</h1>
        <p className="text-sm text-muted-foreground">{fp.subtitle}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="income"><TrendingUp className="mr-1.5 h-4 w-4" />{fp.tabIncome}</TabsTrigger>
          <TabsTrigger value="balance"><Scale className="mr-1.5 h-4 w-4" />{fp.tabBalance}</TabsTrigger>
          <TabsTrigger value="journal"><BookOpen className="mr-1.5 h-4 w-4" />{fp.tabJournal}</TabsTrigger>
          <TabsTrigger value="trial"><BarChart2 className="mr-1.5 h-4 w-4" />{fp.tabTrial}</TabsTrigger>
        </TabsList>

        {/* ── 損益表 ── */}
        <TabsContent value="income" className="space-y-5 mt-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <select className="rounded-md border px-3 py-2 text-sm"
              value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}{fp.yearSuffix}</option>)}
            </select>
            <select className="rounded-md border px-3 py-2 text-sm"
              value={month} onChange={e => setMonth(e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">{fp.fullYear}</option>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={fetchIncome}>{dict.common.refresh}</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const p = new URLSearchParams({ type: 'income-statement', year: String(year) })
                if (month) p.set('month', String(month))
                window.open(`/api/finance/reports/export?${p}`, '_blank')
              }}
            >
              <FileDown className="w-4 h-4 mr-1" />{fp.exportExcel ?? '匯出 Excel'}
            </Button>
          </div>

          {loadingIncome ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : incomeStmt && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: fp.incomeKpi.salesRevenue, value: fmt(incomeStmt.revenue.excludeTax), sub: `${incomeStmt.revenue.invoiceCount} ${fp.incomeKpi.invoiceCountSub}`, color: 'text-slate-900' },
                  { label: fp.incomeKpi.cogs, value: fmt(incomeStmt.cogs), sub: fp.incomeKpi.cogsSub, color: 'text-slate-700' },
                  { label: fp.incomeKpi.grossProfit, value: fmt(incomeStmt.grossProfit), sub: fmtPct(incomeStmt.grossMarginPct), color: incomeStmt.grossProfit >= 0 ? 'text-green-600' : 'text-red-600' },
                  { label: fp.incomeKpi.opExpenses, value: fmt(incomeStmt.expenses.total), sub: `${fp.incomeKpi.freightSub} ${fmt(incomeStmt.expenses.freight)}`, color: 'text-slate-700' },
                  { label: fp.incomeKpi.netProfit, value: fmt(incomeStmt.netProfit), sub: incomeStmt.netProfit >= 0 ? fp.incomeKpi.profit : fp.incomeKpi.loss, color: incomeStmt.netProfit >= 0 ? 'text-green-700' : 'text-red-700' },
                ].map(card => (
                  <div key={card.label} className="rounded-lg border bg-white p-3">
                    <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                    <p className={`text-base font-bold ${card.color}`}>{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Detailed P&L table */}
              <div className="rounded-lg border bg-white">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      { label: fp.plTable.grossInclTax, value: incomeStmt.revenue.gross, bold: false },
                      { label: fp.plTable.lessTax, value: -incomeStmt.revenue.taxCollected, bold: false, indent: true },
                      { label: fp.plTable.netSales, value: incomeStmt.revenue.excludeTax, bold: true },
                      { label: fp.plTable.lessCogs, value: -incomeStmt.cogs, bold: false, indent: true },
                      { label: fp.plTable.grossProfit, value: incomeStmt.grossProfit, bold: true, highlight: true },
                      { label: fp.plTable.grossMarginRate, value: null, text: fmtPct(incomeStmt.grossMarginPct), indent: true },
                      { label: fp.plTable.freight, value: -incomeStmt.expenses.freight, indent: true },
                      { label: fp.plTable.otherExpenses, value: -incomeStmt.expenses.other, indent: true },
                      { label: fp.plTable.operatingProfit, value: incomeStmt.operatingProfit, bold: true },
                      { label: fp.plTable.netProfit, value: incomeStmt.netProfit, bold: true, highlight: true },
                    ].map((row, i) => (
                      <tr key={i} className={`border-t ${row.highlight ? 'bg-slate-50' : ''}`}>
                        <td className={`py-2 px-4 ${row.indent ? 'pl-8 text-muted-foreground' : ''} ${row.bold ? 'font-semibold' : ''}`}>{row.label}</td>
                        <td className={`py-2 px-4 text-right font-mono ${row.bold ? 'font-bold' : ''} ${row.value != null && row.value < 0 ? 'text-red-600' : row.value != null && row.value > 0 ? 'text-green-700' : ''}`}>
                          {row.text ?? (row.value != null ? fmt(row.value) : '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Monthly chart */}
              {!month && chartData.length > 0 && (
                <div className="rounded-lg border bg-white p-4">
                  <h3 className="text-sm font-semibold mb-3">{fp.monthlyChartTitle}</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v}K`, '']} />
                      <Legend />
                      <Bar dataKey={incomeKey} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey={cashKey} fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── 資產負債表 ── */}
        <TabsContent value="balance" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchBalance}>{dict.common.refresh}</Button>
            {balanceSheet && (
              <p className="text-sm text-muted-foreground">{fp.asOfDate} {new Date(balanceSheet.asOf).toLocaleDateString(locale)}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/api/finance/reports/export?type=balance-sheet', '_blank')}
            >
              <FileDown className="w-4 h-4 mr-1" />{fp.exportExcel ?? '匯出 Excel'}
            </Button>
          </div>

          {loadingBalance ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : balanceSheet && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Assets */}
              <div className="rounded-lg border bg-white">
                <div className="border-b px-4 py-3 bg-blue-50">
                  <h3 className="font-semibold text-blue-800">{fp.assetsTitle}</h3>
                  <p className="text-lg font-bold text-blue-900">{fmt(balanceSheet.assets.total)}</p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b bg-slate-50"><td colSpan={2} className="py-2 px-4 font-medium text-slate-600">{fp.currentAssets}</td></tr>
                    {[
                      { label: fp.cashEquiv, value: balanceSheet.assets.current.cash },
                      { label: `${fp.arLabel}（${balanceSheet.assets.current.accountsReceivable.count} ${fp.arUnit}）`, value: balanceSheet.assets.current.accountsReceivable.balance },
                      { label: `${fp.inventoryLabel} ${balanceSheet.assets.current.inventory.quantity.toLocaleString(locale)} ${fp.inventoryUnit}`, value: balanceSheet.assets.current.inventory.value },
                      { label: `${fp.siOutstanding}（${balanceSheet.assets.current.salesInvoicesOutstanding.count} ${fp.siUnit}）`, value: balanceSheet.assets.current.salesInvoicesOutstanding.amount },
                    ].map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-2 px-4 pl-8 text-muted-foreground">{row.label}</td>
                        <td className="py-2 px-4 text-right font-mono">{fmt(row.value)}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-blue-50/50">
                      <td className="py-2 px-4 font-semibold">{fp.currentAssetsTotal}</td>
                      <td className="py-2 px-4 text-right font-bold font-mono">{fmt(balanceSheet.assets.current.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Liabilities + Equity */}
              <div className="rounded-lg border bg-white">
                <div className="border-b px-4 py-3 bg-amber-50">
                  <h3 className="font-semibold text-amber-800">{fp.liabEquityTitle}</h3>
                  <p className="text-lg font-bold text-amber-900">{fmt(balanceSheet.liabilities.total + Math.max(0, balanceSheet.equity.estimated))}</p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b bg-slate-50"><td colSpan={2} className="py-2 px-4 font-medium text-slate-600">{fp.currentLiabilities}</td></tr>
                    <tr className="border-t">
                      <td className="py-2 px-4 pl-8 text-muted-foreground">{fp.apLabel}（{balanceSheet.liabilities.current.accountsPayable.count} {fp.apUnit}）</td>
                      <td className="py-2 px-4 text-right font-mono">{fmt(balanceSheet.liabilities.current.accountsPayable.balance)}</td>
                    </tr>
                    <tr className="border-t bg-amber-50/50">
                      <td className="py-2 px-4 font-semibold">{fp.liabilitiesTotal}</td>
                      <td className="py-2 px-4 text-right font-bold font-mono">{fmt(balanceSheet.liabilities.total)}</td>
                    </tr>
                    <tr className="border-t bg-slate-50"><td colSpan={2} className="py-2 px-4 font-medium text-slate-600">{fp.equitySection}</td></tr>
                    <tr className="border-t">
                      <td className="py-2 px-4 pl-8 text-muted-foreground">{fp.netWorthEst}</td>
                      <td className={`py-2 px-4 text-right font-mono ${balanceSheet.equity.estimated >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {fmt(balanceSheet.equity.estimated)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="px-4 py-3 bg-slate-50 border-t">
                  <p className="text-xs text-muted-foreground">{balanceSheet.equity.note}</p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── 傳票 ── */}
        <TabsContent value="journal" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowJournalDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />{dict.common.create}{fp.createJournalBtn}
            </Button>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">{fp.colVoucherNo}</TableHead>
                  <TableHead className="w-24">{fp.colDate}</TableHead>
                  <TableHead>{fp.colSummary}</TableHead>
                  <TableHead className="w-20">{fp.colType}</TableHead>
                  <TableHead className="w-20">{fp.colStatus}</TableHead>
                  <TableHead className="text-right w-28">{fp.colDebit}</TableHead>
                  <TableHead className="text-right w-28">{fp.colCredit}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingJournals ? (
                  <TableRow><TableCell colSpan={8} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : journals.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-16 text-center">
                    <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">{fp.noJournals}</p>
                  </TableCell></TableRow>
                ) : journals.map(j => (
                  <React.Fragment key={j.id}>
                  <TableRow className="group cursor-pointer hover:bg-slate-50" onClick={() => setExpandedJournal(expandedJournal === j.id ? null : j.id)}>
                    <TableCell className="font-mono text-sm">{j.entryNo}</TableCell>
                    <TableCell className="text-sm">{new Date(j.entryDate).toLocaleDateString(locale, { month: '2-digit', day: '2-digit' })}</TableCell>
                    <TableCell className="text-sm">{j.description}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{j.entryType}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={j.status === 'POSTED' ? 'bg-green-100 text-green-700' : j.status === 'REVERSED' ? 'bg-slate-100 text-slate-400 line-through' : 'bg-slate-100 text-slate-600'}>
                        {j.status === 'POSTED' ? fp.statusPosted : j.status === 'REVERSED' ? fp.statusReversed : fp.statusDraft}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(Number(j.totalDebit))}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(Number(j.totalCredit))}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => setExpandedJournal(expandedJournal === j.id ? null : j.id)} className="rounded p-1 hover:bg-slate-100 text-slate-400" title={fp.colSummary}>
                          {expandedJournal === j.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {j.status === 'DRAFT' && (
                          <>
                            <button onClick={() => postEntry(j.id)} className="rounded p-1 hover:bg-green-50 text-green-600" title={fp.titlePost}>
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => deleteEntry(j.id)} className="rounded p-1 hover:bg-red-50 text-red-500" title={fp.titleDelete}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {j.status === 'POSTED' && (
                          <button onClick={() => reverseEntry(j.id)} className="rounded p-1 hover:bg-orange-50 text-orange-500" title={fp.titleReverse}>
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedJournal === j.id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-slate-50 px-8 py-2">
                        <div className="text-xs space-y-1">
                          <div className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-2 font-semibold text-slate-500 pb-1 border-b">
                            <span>{fp.colAccount}</span><span className="text-right">{fp.colDebit}</span><span className="text-right">{fp.colCredit}</span><span>{fp.colDescription}</span>
                          </div>
                          {j.lines.map((l, i) => (
                            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-2 text-slate-700">
                              <span className="font-mono">{l.account.code} {l.account.name}</span>
                              <span className="text-right font-mono">{Number(l.debit) > 0 ? fmt(Number(l.debit)) : ''}</span>
                              <span className="text-right font-mono">{Number(l.credit) > 0 ? fmt(Number(l.credit)) : ''}</span>
                              <span className="text-muted-foreground">{l.description ?? ''}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {journalPagination && journalPagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">{fp.totalCountPrefix} {journalPagination.total} {fp.totalCountUnit}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={journalPage <= 1} onClick={() => setJournalPage(p => p - 1)}>{dict.common.prevPage}</Button>
                <Button variant="outline" size="sm" disabled={journalPage >= journalPagination.totalPages} onClick={() => setJournalPage(p => p + 1)}>{dict.common.nextPage}</Button>
              </div>
            </div>
          )}
        </TabsContent>
        {/* ── 餘額試算表 ── */}
        <TabsContent value="trial" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <label className="text-muted-foreground">{dict.reportsExt.period}</label>
              <input type="date" value={trialStart} onChange={e => setTrialStart(e.target.value)}
                className="rounded-md border px-3 py-1.5 text-sm" />
              <span className="text-muted-foreground">{fp.toLabel}</span>
              <input type="date" value={trialEnd} onChange={e => setTrialEnd(e.target.value)}
                className="rounded-md border px-3 py-1.5 text-sm" />
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchTrialBalance(trialStart, trialEnd)}>
              {dict.reportsExt.generate}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const p = new URLSearchParams({ type: 'trial-balance' })
                if (trialStart) p.set('startDate', trialStart)
                if (trialEnd) p.set('endDate', trialEnd)
                window.open(`/api/finance/reports/export?${p}`, '_blank')
              }}
            >
              <FileDown className="w-4 h-4 mr-1" />{fp.exportExcel ?? '匯出 Excel'}
            </Button>
            {trialData && (
              <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${trialData.isBalanced ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {trialData.isBalanced
                  ? <><CheckCircle2 className="h-4 w-4" />{fp.trialBalanced}</>
                  : <><AlertTriangle className="h-4 w-4" />{fp.trialUnbalanced}</>}
              </div>
            )}
          </div>

          {loadingTrial ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : trialData && (
            <div className="rounded-lg border bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-24">{fp.colAccountCode}</TableHead>
                    <TableHead>{fp.colAccountName}</TableHead>
                    <TableHead className="w-20">{fp.colAccountType}</TableHead>
                    <TableHead className="text-right">{fp.colOpeningDebit}</TableHead>
                    <TableHead className="text-right">{fp.colOpeningCredit}</TableHead>
                    <TableHead className="text-right bg-blue-50/60">{fp.colPeriodDebit}</TableHead>
                    <TableHead className="text-right bg-blue-50/60">{fp.colPeriodCredit}</TableHead>
                    <TableHead className="text-right bg-amber-50/60">{fp.colClosingDebit}</TableHead>
                    <TableHead className="text-right bg-amber-50/60">{fp.colClosingCredit}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialData.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                        {fp.noTrialData}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {trialData.rows.map(row => (
                        <TableRow key={row.id} className="hover:bg-slate-50/60">
                          <TableCell className="font-mono text-sm">{row.code}</TableCell>
                          <TableCell className="text-sm">{row.name}</TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${
                              row.type === 'ASSET' ? 'bg-blue-100 text-blue-700' :
                              row.type === 'LIABILITY' ? 'bg-amber-100 text-amber-700' :
                              row.type === 'EQUITY' ? 'bg-purple-100 text-purple-700' :
                              row.type === 'REVENUE' ? 'bg-green-100 text-green-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {fp.accountTypeLabels[row.type as keyof typeof fp.accountTypeLabels] ?? row.type}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{row.openingDebit > 0 ? row.openingDebit.toLocaleString(locale) : '—'}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{row.openingCredit > 0 ? row.openingCredit.toLocaleString(locale) : '—'}</TableCell>
                          <TableCell className="text-right font-mono text-sm bg-blue-50/30">{row.periodDebit > 0 ? row.periodDebit.toLocaleString(locale) : '—'}</TableCell>
                          <TableCell className="text-right font-mono text-sm bg-blue-50/30">{row.periodCredit > 0 ? row.periodCredit.toLocaleString(locale) : '—'}</TableCell>
                          <TableCell className="text-right font-mono text-sm bg-amber-50/30 font-medium">{row.closingDebit > 0 ? row.closingDebit.toLocaleString(locale) : '—'}</TableCell>
                          <TableCell className="text-right font-mono text-sm bg-amber-50/30 font-medium">{row.closingCredit > 0 ? row.closingCredit.toLocaleString(locale) : '—'}</TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="border-t-2 bg-slate-100 font-bold">
                        <TableCell colSpan={3} className="text-sm">{fp.trialTotalPrefix} ({trialData.rows.length} {fp.trialAccountUnit})</TableCell>
                        <TableCell className="text-right font-mono text-sm">{trialData.totals.openingDebit.toLocaleString(locale)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{trialData.totals.openingCredit.toLocaleString(locale)}</TableCell>
                        <TableCell className="text-right font-mono text-sm bg-blue-100/60">{trialData.totals.periodDebit.toLocaleString(locale)}</TableCell>
                        <TableCell className="text-right font-mono text-sm bg-blue-100/60">{trialData.totals.periodCredit.toLocaleString(locale)}</TableCell>
                        <TableCell className="text-right font-mono text-sm bg-amber-100/60">{trialData.totals.closingDebit.toLocaleString(locale)}</TableCell>
                        <TableCell className="text-right font-mono text-sm bg-amber-100/60">{trialData.totals.closingCredit.toLocaleString(locale)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Journal Entry Dialog */}
      <Dialog open={showJournalDialog} onOpenChange={setShowJournalDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dict.common.create}{fp.createJournalBtn}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">{fp.fieldDateRequired}</label>
                <Input type="date" value={jForm.entryDate} onChange={e => setJForm(f => ({ ...f, entryDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{fp.fieldSummaryRequired}</label>
                <Input placeholder={fp.summaryPlaceholder} value={jForm.description} onChange={e => setJForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            {/* Lines */}
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-1 text-xs font-medium text-muted-foreground px-1">
                <div className="col-span-4">{fp.colAccount}</div>
                <div className="col-span-3 text-right">{fp.colDebit}</div>
                <div className="col-span-3 text-right">{fp.colCredit}</div>
                <div className="col-span-1" />
              </div>
              {jForm.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                  <select className="col-span-4 rounded border px-2 py-1.5 text-sm"
                    value={line.accountId} onChange={e => updateLine(idx, 'accountId', e.target.value)}>
                    <option value="">{fp.selectAccount}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                  </select>
                  <Input className="col-span-3 text-right text-sm h-8" type="number" placeholder="0"
                    value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)} />
                  <Input className="col-span-3 text-right text-sm h-8" type="number" placeholder="0"
                    value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)} />
                  <button onClick={() => removeLine(idx)} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addLine}><Plus className="mr-1 h-3 w-3" />{fp.addLine}</Button>
            </div>

            {/* Balance check */}
            <div className={`flex justify-between text-sm px-1 py-2 rounded border ${isBalanced ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              <span>{fp.debitTotal}{fmt(totalDebit)}</span>
              <span>{fp.creditTotal}{fmt(totalCredit)}</span>
              <span className="font-medium">{isBalanced ? fp.balanced : `${fp.diffLabel} ${fmt(Math.abs(totalDebit - totalCredit))}`}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJournalDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={submitJournal} disabled={submitting || !isBalanced}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dict.common.create}{fp.createJournalBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
