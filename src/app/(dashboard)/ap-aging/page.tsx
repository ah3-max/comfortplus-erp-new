'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, Search, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface ApItem {
  id: string
  invoiceNo: string | null
  dueDate: string | null
  amount: number
  paidAmount: number
  outstanding: number
  daysOverdue: number
  status: string
  currency: string
}

interface SupplierRow {
  supplierId: string
  supplierName: string
  supplierCode: string | null
  current: number
  days1_30: number
  days31_60: number
  days61_90: number
  days90plus: number
  total: number
  count: number
  items: ApItem[]
}

interface Summary {
  current: number
  days1_30: number
  days31_60: number
  days61_90: number
  days90plus: number
  total: number
  supplierCount: number
  invoiceCount: number
}

const statusLabels: Record<string, { label: string; className: string }> = {
  NOT_DUE:      { label: '未到期', className: 'bg-slate-100 text-slate-600' },
  DUE:          { label: '已逾期', className: 'bg-red-100 text-red-700' },
  PARTIAL_PAID: { label: '部分付款', className: 'bg-amber-100 text-amber-700' },
  PAID:         { label: '已付清', className: 'bg-green-100 text-green-700' },
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(str: string | null) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function AgingCell({ value, highlight }: { value: number; highlight?: boolean }) {
  if (value <= 0) return <TableCell className="text-right text-muted-foreground">—</TableCell>
  return (
    <TableCell className={`text-right font-medium ${highlight ? 'text-red-600' : 'text-slate-700'}`}>
      {fmt(value)}
    </TableCell>
  )
}

export default function ApAgingPage() {
  const { dict } = useI18n()
  const [rows, setRows] = useState<SupplierRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [asOf, setAsOf] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finance/ap-aging')
      if (!res.ok) throw new Error()
      const result = await res.json()
      setRows(result.rows ?? [])
      setSummary(result.summary ?? null)
      setAsOf(result.asOf ?? null)
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = rows.filter(r =>
    !search || r.supplierName.includes(search) || (r.supplierCode?.includes(search) ?? false)
  )

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasOverdue = summary && (summary.days1_30 + summary.days31_60 + summary.days61_90 + summary.days90plus) > 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.finance.apAging}</h1>
          <p className="text-sm text-muted-foreground">
            {summary ? `${summary.supplierCount} 家供應商 · ${summary.invoiceCount} 筆未付帳款` : dict.common.loading}
            {asOf && <span className="ml-2">截至 {fmtDate(asOf)}</span>}
          </p>
        </div>
        {hasOverdue && (
          <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700 font-medium">
              逾期金額 NT$ {fmt((summary?.days1_30 ?? 0) + (summary?.days31_60 ?? 0) + (summary?.days61_90 ?? 0) + (summary?.days90plus ?? 0))}
            </span>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: '未到期', value: summary.current, color: 'text-slate-700' },
            { label: '1–30天', value: summary.days1_30, color: 'text-amber-600' },
            { label: '31–60天', value: summary.days31_60, color: 'text-orange-600' },
            { label: '61–90天', value: summary.days61_90, color: 'text-red-600' },
            { label: '90天以上', value: summary.days90plus, color: 'text-red-700' },
            { label: '合計', value: summary.total, color: 'text-slate-900' },
          ].map(card => (
            <div key={card.label} className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              <p className={`text-base font-bold ${card.color}`}>
                {card.value > 0 ? `$${fmt(card.value)}` : '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={dict.common.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>{dict.common.supplier}</TableHead>
              <TableHead className="text-right">未到期</TableHead>
              <TableHead className="text-right">1–30天</TableHead>
              <TableHead className="text-right">31–60天</TableHead>
              <TableHead className="text-right">61–90天</TableHead>
              <TableHead className="text-right">90天以上</TableHead>
              <TableHead className="text-right">{dict.common.total}</TableHead>
              <TableHead className="text-right w-16">筆數</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                  {search ? dict.common.noResultsFound : dict.common.noData}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filtered.map(row => {
                  const isOpen = expanded.has(row.supplierId)
                  return (
                    <>
                      <TableRow
                        key={row.supplierId}
                        className="group cursor-pointer hover:bg-slate-50/80"
                        onClick={() => toggleExpand(row.supplierId)}
                      >
                        <TableCell>
                          {isOpen
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.supplierName}</div>
                          {row.supplierCode && <div className="text-xs text-muted-foreground">{row.supplierCode}</div>}
                        </TableCell>
                        <AgingCell value={row.current} />
                        <AgingCell value={row.days1_30} highlight />
                        <AgingCell value={row.days31_60} highlight />
                        <AgingCell value={row.days61_90} highlight />
                        <AgingCell value={row.days90plus} highlight />
                        <TableCell className="text-right font-bold">${fmt(row.total)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{row.count}</TableCell>
                      </TableRow>

                      {/* Expanded detail rows */}
                      {isOpen && row.items.map(item => {
                        const st = statusLabels[item.status] ?? { label: item.status, className: '' }
                        return (
                          <TableRow key={item.id} className="bg-slate-50/50 text-sm">
                            <TableCell />
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={st.className}>{st.label}</Badge>
                                <span className="text-muted-foreground font-mono">{item.invoiceNo ?? '—'}</span>
                                {item.dueDate && <span className="text-xs text-muted-foreground">到期 {fmtDate(item.dueDate)}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">${fmt(item.amount)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">${fmt(item.paidAmount)}</TableCell>
                            <TableCell colSpan={3} className="text-right">
                              {item.daysOverdue > 0 && (
                                <span className="text-xs text-red-600">逾期 {item.daysOverdue} 天</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium text-slate-700">${fmt(item.outstanding)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{item.currency}</TableCell>
                          </TableRow>
                        )
                      })}
                    </>
                  )
                })}

                {/* Total row */}
                {summary && filtered.length > 1 && (
                  <TableRow className="bg-slate-50 font-semibold border-t-2">
                    <TableCell />
                    <TableCell className="text-slate-700">{dict.common.total} ({filtered.length} 家)</TableCell>
                    <TableCell className="text-right">{summary.current > 0 ? `$${fmt(filtered.reduce((s, r) => s + r.current, 0))}` : '—'}</TableCell>
                    <TableCell className="text-right text-amber-600">{summary.days1_30 > 0 ? `$${fmt(filtered.reduce((s, r) => s + r.days1_30, 0))}` : '—'}</TableCell>
                    <TableCell className="text-right text-orange-600">{summary.days31_60 > 0 ? `$${fmt(filtered.reduce((s, r) => s + r.days31_60, 0))}` : '—'}</TableCell>
                    <TableCell className="text-right text-red-600">{summary.days61_90 > 0 ? `$${fmt(filtered.reduce((s, r) => s + r.days61_90, 0))}` : '—'}</TableCell>
                    <TableCell className="text-right text-red-700">{summary.days90plus > 0 ? `$${fmt(filtered.reduce((s, r) => s + r.days90plus, 0))}` : '—'}</TableCell>
                    <TableCell className="text-right">${fmt(filtered.reduce((s, r) => s + r.total, 0))}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{filtered.reduce((s, r) => s + r.count, 0)}</TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="block md:hidden space-y-3">
        {!loading && filtered.map(row => (
          <div key={row.supplierId} className="rounded-lg border bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{row.supplierName}</div>
                {row.supplierCode && <div className="text-xs text-muted-foreground">{row.supplierCode}</div>}
              </div>
              <span className="font-bold text-slate-900">${fmt(row.total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {row.current > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">未到期</span><span>${fmt(row.current)}</span></div>
              )}
              {row.days1_30 > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">1–30天</span><span className="text-amber-600">${fmt(row.days1_30)}</span></div>
              )}
              {row.days31_60 > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">31–60天</span><span className="text-orange-600">${fmt(row.days31_60)}</span></div>
              )}
              {row.days61_90 > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">61–90天</span><span className="text-red-600">${fmt(row.days61_90)}</span></div>
              )}
              {row.days90plus > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">90天+</span><span className="text-red-700 font-semibold">${fmt(row.days90plus)}</span></div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{row.count} 筆帳款</div>
          </div>
        ))}
      </div>
    </div>
  )
}
