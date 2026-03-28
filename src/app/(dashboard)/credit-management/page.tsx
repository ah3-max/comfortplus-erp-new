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

const STATUS_CONFIG = {
  EXCEEDED: { label: '超限', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, iconColor: 'text-red-500' },
  CRITICAL: { label: '危險', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: ShieldAlert, iconColor: 'text-orange-500' },
  WARNING:  { label: '警告', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: AlertTriangle, iconColor: 'text-yellow-500' },
  NORMAL:   { label: '正常', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2, iconColor: 'text-green-500' },
  NO_LIMIT: { label: '未設限', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: DollarSign, iconColor: 'text-gray-400' },
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
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

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
      toast.error('載入失敗')
    } finally {
      setDetailLoading(false)
    }
  }, [])

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
      toast.success('信用額度已更新')
      setEditingLimit(false)
      await loadDetail(detailId)
      load()
    } catch {
      toast.error('更新失敗')
    } finally {
      setSaving(false)
    }
  }

  const summaryCards = [
    { label: '超限客戶', value: summary?.exceeded ?? 0, color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
    { label: '危險客戶（90%+）', value: summary?.critical ?? 0, color: 'text-orange-600', bg: 'bg-orange-50', icon: ShieldAlert },
    { label: '警告客戶（70%+）', value: summary?.warning ?? 0, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle },
    { label: '總未收款', value: summary ? fmt(summary.totalOutstanding) : '—', color: 'text-blue-600', bg: 'bg-blue-50', icon: TrendingUp },
    { label: '逾期未收', value: summary ? fmt(summary.totalOverdue) : '—', color: 'text-red-600', bg: 'bg-red-50', icon: DollarSign },
  ]

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.creditManagement ?? '客戶信用管理'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">信用額度監控、帳齡追蹤、逾期預警</p>
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
                <span className="text-xs text-gray-600">{c.label}</span>
              </div>
              <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="搜尋客戶名稱/代號…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { if (v) setStatusFilter(v) }}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部狀態</SelectItem>
            <SelectItem value="EXCEEDED">超限</SelectItem>
            <SelectItem value="CRITICAL">危險</SelectItem>
            <SelectItem value="WARNING">警告</SelectItem>
            <SelectItem value="NORMAL">正常</SelectItem>
            <SelectItem value="NO_LIMIT">未設限</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">客戶</th>
              <th className="px-4 py-3 text-right">信用額度</th>
              <th className="px-4 py-3 text-right">已用</th>
              <th className="px-4 py-3 text-right">可用</th>
              <th className="px-4 py-3 text-center min-w-[140px]">使用率</th>
              <th className="px-4 py-3 text-right">逾期金額</th>
              <th className="px-4 py-3 text-center">狀態</th>
              <th className="px-4 py-3 text-left">付款條件</th>
              <th className="px-4 py-3 text-left">業務</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="py-12 text-center text-gray-400">載入中…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="py-12 text-center text-gray-400">無資料</td></tr>
            ) : rows.map(row => {
              const cfg = STATUS_CONFIG[row.creditStatus]
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
                    <Badge className={`${cfg.color} border text-xs`}>{cfg.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.paymentTerms ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{row.salesRep ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => loadDetail(row.id)}>
                      明細
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
              {detail ? `${detail.name} — 信用明細` : '載入中…'}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && <div className="py-8 text-center text-gray-400">載入中…</div>}

          {detail && !detailLoading && (
            <div className="space-y-4 text-sm">
              {/* Credit summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '信用額度', value: detail.creditLimit !== null ? fmt(detail.creditLimit) : '未設限' },
                  { label: '已用金額', value: fmt(detail.creditUsed) },
                  { label: '可用金額', value: detail.creditAvailable !== null ? fmt(detail.creditAvailable) : '—' },
                  { label: '使用率', value: detail.utilizationPct !== null ? `${detail.utilizationPct}%` : '—' },
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
                        placeholder="輸入信用額度（留空=無限制）"
                        className="h-8 text-sm max-w-[220px]"
                      />
                      <Button size="sm" onClick={saveLimit} disabled={saving} className="h-8">
                        {saving ? '儲存中…' : '儲存'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingLimit(false)}>取消</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEditingLimit(true)}>
                      <Pencil size={12} />調整額度
                    </Button>
                  )}
                </div>
              )}

              {/* Aging breakdown */}
              <div>
                <div className="font-semibold mb-2">帳齡分析</div>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: '未到期', value: detail.aging.current },
                    { label: '1-30天', value: detail.aging.days30 },
                    { label: '31-60天', value: detail.aging.days60 },
                    { label: '61-90天', value: detail.aging.days90 },
                    { label: '90天+', value: detail.aging.over90 },
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
                  <div className="font-semibold mb-2">未收款明細（{detail.arItems.length} 筆）</div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500">
                          <th className="px-3 py-2 text-left">發票/訂單</th>
                          <th className="px-3 py-2 text-right">應收金額</th>
                          <th className="px-3 py-2 text-right">待收餘額</th>
                          <th className="px-3 py-2 text-center">到期日</th>
                          <th className="px-3 py-2 text-center">逾期天數</th>
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
                                ? <span className="text-red-600 font-medium">{ar.overdueDays}天</span>
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
                  <div className="font-semibold mb-2">最近收款紀錄</div>
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
            <Button variant="outline" onClick={() => { setDetailId(null); setDetail(null); setEditingLimit(false) }}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
