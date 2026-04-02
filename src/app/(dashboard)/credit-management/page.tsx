'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { AlertTriangle, XCircle, CheckCircle2, ShieldAlert, TrendingUp, DollarSign, Search, Pencil } from 'lucide-react'
import { toast } from 'sonner'

interface CreditRow {
  id: string
  code: string
  name: string
  creditLimit: number | null
  creditUsed: number
  creditAvailable: number | null
  utilizationPct: number | null
  overdueAmount: number
  creditStatus: 'NO_LIMIT' | 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXCEEDED'
  paymentTerms: string | null
  riskLevel: string | null
  salesRep: string | null
  arCount: number
}

interface Summary {
  total: number
  exceeded: number
  critical: number
  warning: number
  normal: number
  noLimit: number
  totalOutstanding: number
  totalOverdue: number
}

interface CreditDetail {
  id: string
  name: string
  creditLimit: number | null
  creditUsed: number
  creditAvailable: number | null
  utilizationPct: number | null
  overdueAmount: number
  creditStatus: string
  paymentTerms: string | null
  riskLevel: string | null
  isMonthly: boolean
  aging: { current: number; days30: number; days60: number; days90: number; over90: number }
  arItems: {
    id: string
    invoiceNo: string | null
    dueDate: string | null
    amount: number
    paidAmount: number
    balance: number
    overdueDays: number
    status: string
    order: { orderNo: string } | null
  }[]
  recentPayments: {
    amount: number
    paymentDate: string
    paymentMethod: string | null
    referenceNo: string | null
  }[]
}

const STATUS_COLORS: Record<string, string> = {
  EXCEEDED: 'bg-red-100 text-red-700 border-red-200',
  CRITICAL: 'bg-orange-100 text-orange-700 border-orange-200',
  WARNING:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  NORMAL:   'bg-green-100 text-green-700 border-green-200',
  NO_LIMIT: 'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  EXCEEDED: XCircle,
  CRITICAL: ShieldAlert,
  WARNING: AlertTriangle,
  NORMAL: CheckCircle2,
  NO_LIMIT: DollarSign,
}

const STATUS_ICON_COLORS: Record<string, string> = {
  EXCEEDED: 'text-red-500',
  CRITICAL: 'text-orange-500',
  WARNING: 'text-yellow-500',
  NORMAL: 'text-green-500',
  NO_LIMIT: 'text-gray-400',
}

function UtilizationBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-400 text-xs">—</span>
  const capped = Math.min(pct, 100)
  const color = pct >= 100 ? 'bg-red-500' : pct >= 90 ? 'bg-orange-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${capped}%` }} />
      </div>
      <span className="text-xs w-12 text-right tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  )
}

export default function CreditManagementPage() {
  const { data: session } = useSession()
  const { dict } = useI18n()
  const cm = dict.creditManagement
  const STATUS_LABELS = cm.statusLabels as Record<string, string>

  const [rows, setRows] = useState<CreditRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CreditDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editLimit, setEditLimit] = useState<string>('')
  const [editingLimit, setEditingLimit] = useState(false)
  const [saving, setSaving] = useState(false)

  const role = (session?.user as { role?: string })?.role ?? ''
  const canEditLimit = ['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)

  const fmt = (n: number) =>
    new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/customers/credit-summary?${params}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setRows(json.data)
      setSummary(json.summary)
    } catch {
      toast.error(dict.common.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search, dict.common.loadFailed])

  useEffect(() => { load() }, [load])

  const loadDetail = useCallback(async (id: string) => {
    setDetailId(id)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await fetch(`/api/customers/${id}/credit`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setDetail(json)
      setEditLimit(json.creditLimit?.toString() ?? '')
    } catch {
      toast.error(dict.common.loadFailed)
    } finally {
      setDetailLoading(false)
    }
  }, [dict.common.loadFailed])

  const saveLimit = async () => {
    if (!detailId) return
    setSaving(true)
    try {
      const creditLimit = editLimit === '' ? null : Number(editLimit)
      const res = await fetch(`/api/customers/${detailId}/credit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditLimit }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(cm.creditUpdated)
      setEditingLimit(false)
      await loadDetail(detailId)
      load()
    } catch {
      toast.error(dict.common.updateFailed)
    } finally {
      setSaving(false)
    }
  }

  const summaryCards = [
    { label: 'EXCEEDED', value: summary?.exceeded ?? 0, color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
    { label: 'CRITICAL', value: summary?.critical ?? 0, color: 'text-orange-600', bg: 'bg-orange-50', icon: ShieldAlert },
    { label: 'WARNING', value: summary?.warning ?? 0, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle },
    { label: 'outstanding', value: summary ? fmt(summary.totalOutstanding) : '—', color: 'text-blue-600', bg: 'bg-blue-50', icon: TrendingUp },
    { label: 'overdue', value: summary ? fmt(summary.totalOverdue) : '—', color: 'text-red-600', bg: 'bg-red-50', icon: DollarSign },
  ]

  const summaryLabels: Record<string, string> = {
    EXCEEDED: STATUS_LABELS.EXCEEDED ?? 'Exceeded',
    CRITICAL: STATUS_LABELS.CRITICAL ?? 'Critical',
    WARNING: STATUS_LABELS.WARNING ?? 'Warning',
    outstanding: cm.cardTotalCredit,
    overdue: cm.cardOverdue,
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.creditManagement ?? cm.detailTitle}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cm.subtitle}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {summaryCards.map((c, i) => {
          const Icon = c.icon
          return (
            <div key={i} className={`rounded-xl p-3 ${c.bg} flex flex-col gap-1`}>
              <div className="flex items-center gap-1.5">
                <Icon size={14} className={c.color} />
                <span className="text-xs text-gray-600">{summaryLabels[c.label] ?? c.label}</span>
              </div>
              <div className={`text-lg font-bold ${c.color}`}>{typeof c.value === 'number' ? c.value : c.value}</div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={cm.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { if (v) setStatusFilter(v) }}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{cm.allStatuses}</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
            <SelectItem value="NO_LIMIT">{STATUS_LABELS.NO_LIMIT ?? cm.statusLabels.NO_LIMIT}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">{cm.colCustomer}</th>
              <th className="px-4 py-3 text-right">{cm.colCreditLimit}</th>
              <th className="px-4 py-3 text-right">{cm.colUsed}</th>
              <th className="px-4 py-3 text-right">{cm.colAvailable}</th>
              <th className="px-4 py-3 text-center min-w-[140px]">%</th>
              <th className="px-4 py-3 text-right">{cm.colOverdue}</th>
              <th className="px-4 py-3 text-center">{cm.colStatus}</th>
              <th className="px-4 py-3 text-left">{cm.colPaymentTerms}</th>
              <th className="px-4 py-3 text-left">{dict.common.salesRep}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="py-12 text-center text-gray-400">{cm.loading}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="py-12 text-center text-gray-400">{cm.noData}</td></tr>
            ) : rows.map(row => {
              const statusColor = STATUS_COLORS[row.creditStatus] ?? STATUS_COLORS.NORMAL
              const statusLabel = STATUS_LABELS[row.creditStatus] ?? row.creditStatus
              const isAlert = row.creditStatus === 'EXCEEDED' || row.creditStatus === 'CRITICAL'
              return (
                <tr key={row.id} className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${isAlert ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-gray-400">{row.code}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.creditLimit !== null ? fmt(row.creditLimit) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {fmt(row.creditUsed)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.creditAvailable !== null ? fmt(row.creditAvailable) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <UtilizationBar pct={row.utilizationPct} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.overdueAmount > 0
                      ? <span className="text-red-600 font-medium">{fmt(row.overdueAmount)}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={`${statusColor} border text-xs`}>{statusLabel}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.paymentTerms ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{row.salesRep ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => loadDetail(row.id)}>
                      {cm.viewBtn}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={open => { if (!open) { setDetailId(null); setDetail(null); setEditingLimit(false) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail ? `${detail.name} — ${cm.detailTitle}` : cm.loading}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && <div className="py-8 text-center text-gray-400">{cm.loading}</div>}

          {detail && !detailLoading && (
            <div className="space-y-4 text-sm">
              {/* Credit summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: cm.creditLimitLabel, value: detail.creditLimit !== null ? fmt(detail.creditLimit) : (STATUS_LABELS.NO_LIMIT ?? cm.statusLabels.NO_LIMIT) },
                  { label: cm.usedLabel, value: fmt(detail.creditUsed) },
                  { label: cm.availableLabel, value: detail.creditAvailable !== null ? fmt(detail.creditAvailable) : '—' },
                  { label: '%', value: detail.utilizationPct !== null ? `${detail.utilizationPct}%` : '—' },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div className="font-bold mt-0.5">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Edit credit limit */}
              {canEditLimit && (
                <div className="flex items-center gap-2">
                  {editingLimit ? (
                    <>
                      <Input
                        type="number"
                        min={0}
                        value={editLimit}
                        onChange={e => setEditLimit(e.target.value)}
                        placeholder={cm.newLimitPlaceholder}
                        className="h-8 text-sm max-w-[220px]"
                      />
                      <Button size="sm" onClick={saveLimit} disabled={saving} className="h-8">
                        {saving ? dict.common.saving : cm.saveBtn}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingLimit(false)}>{dict.common.cancel}</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEditingLimit(true)}>
                      <Pencil size={12} />{cm.editCreditBtn}
                    </Button>
                  )}
                </div>
              )}

              {/* Aging breakdown */}
              <div>
                <div className="font-semibold mb-2">{cm.agingTitle}</div>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: cm.col0to30, value: detail.aging.current },
                    { label: '1-30', value: detail.aging.days30 },
                    { label: cm.col31to60, value: detail.aging.days60 },
                    { label: cm.col61to90, value: detail.aging.days90 },
                    { label: cm.colOver90, value: detail.aging.over90 },
                  ].map((b, i) => (
                    <div key={i} className={`rounded-lg p-2 ${b.value > 0 && i > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <div className="text-xs text-gray-500">{b.label}</div>
                      <div className={`font-bold text-sm tabular-nums ${b.value > 0 && i > 0 ? 'text-red-600' : ''}`}>
                        {fmt(b.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AR items */}
              {detail.arItems.length > 0 && (
                <div>
                  <div className="font-semibold mb-2">{cm.arTitle}（{detail.arItems.length}）</div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500">
                          <th className="px-3 py-2 text-left">{cm.colInvoiceOrder}</th>
                          <th className="px-3 py-2 text-right">{dict.common.amount}</th>
                          <th className="px-3 py-2 text-right">{cm.colBalance}</th>
                          <th className="px-3 py-2 text-center">{cm.colDueDate}</th>
                          <th className="px-3 py-2 text-center">{cm.colOverdueDays}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.arItems.map(ar => (
                          <tr key={ar.id} className={`border-b last:border-0 ${ar.overdueDays > 0 ? 'bg-red-50/40' : ''}`}>
                            <td className="px-3 py-2">
                              <div>{ar.invoiceNo ?? ar.order?.orderNo ?? '—'}</div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(ar.amount))}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(ar.balance)}</td>
                            <td className="px-3 py-2 text-center">{ar.dueDate ? ar.dueDate.slice(0, 10) : '—'}</td>
                            <td className="px-3 py-2 text-center">
                              {ar.overdueDays > 0
                                ? <span className="text-red-600 font-medium">{ar.overdueDays}{cm.daysUnit}</span>
                                : <span className="text-gray-400">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent payments */}
              {detail.recentPayments.length > 0 && (
                <div>
                  <div className="font-semibold mb-2">{cm.paymentsTitle}</div>
                  <div className="space-y-1">
                    {detail.recentPayments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                        <span className="text-gray-600">{new Date(p.paymentDate).toLocaleDateString('zh-TW')}</span>
                        <span className="text-xs text-gray-400">{p.paymentMethod ?? ''} {p.referenceNo ?? ''}</span>
                        <span className="font-medium text-green-700">{fmt(Number(p.amount))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDetailId(null); setDetail(null); setEditingLimit(false) }}>{cm.closeBtn}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
