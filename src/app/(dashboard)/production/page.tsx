'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Loader2, Factory, Package, Ship, Search, Pencil, Calendar,
  ArrowRight, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────
type ProductionStatus =
  | 'PENDING' | 'SAMPLE_SUBMITTED' | 'SAMPLE_APPROVED' | 'IN_PRODUCTION'
  | 'QC_INSPECTION' | 'READY_TO_SHIP' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED'

interface ProductionOrder {
  id: string
  productionNo: string
  status: ProductionStatus
  orderQty: number
  producedQty: number | null
  passedQty: number | null
  defectQty: number | null
  defectRate: string | null
  sampleSubmitDate: string | null
  sampleApproveDate: string | null
  productionStartDate: string | null
  productionEndDate: string | null
  inspectionDate: string | null
  shipmentDate: string | null
  notes: string | null
  createdAt: string
  factory: { id: string; code: string; name: string }
  purchaseOrder: { id: string; poNo: string; orderType: string; totalAmount: string }
  seaFreights: Array<{ id: string; freightNo: string; status: string; eta: string | null }>
}

interface PurchaseOption {
  id: string; poNo: string; orderType: string
  supplier: { id: string; name: string }
}

interface SupplierOption {
  id: string; code: string; name: string
}

// ── Status config ─────────────────────────────────────────────────────────────
const MILESTONES: { key: ProductionStatus; label: string }[] = [
  { key: 'PENDING',          label: '待排產' },
  { key: 'SAMPLE_SUBMITTED', label: '打樣中' },
  { key: 'SAMPLE_APPROVED',  label: '樣品確認' },
  { key: 'IN_PRODUCTION',    label: '生產中' },
  { key: 'QC_INSPECTION',    label: '驗貨中' },
  { key: 'READY_TO_SHIP',    label: '待出廠' },
  { key: 'SHIPPED',          label: '已出廠' },
  { key: 'COMPLETED',        label: '已完成' },
]

const NEXT_STATUS: Partial<Record<ProductionStatus, ProductionStatus>> = {
  PENDING:          'SAMPLE_SUBMITTED',
  SAMPLE_SUBMITTED: 'SAMPLE_APPROVED',
  SAMPLE_APPROVED:  'IN_PRODUCTION',
  IN_PRODUCTION:    'QC_INSPECTION',
  QC_INSPECTION:    'READY_TO_SHIP',
  READY_TO_SHIP:    'SHIPPED',
  SHIPPED:          'COMPLETED',
}

const NEXT_STATUS_LABEL: Partial<Record<ProductionStatus, string>> = {
  PENDING:          '提交打樣',
  SAMPLE_SUBMITTED: '確認樣品',
  SAMPLE_APPROVED:  '開始生產',
  IN_PRODUCTION:    '送驗',
  QC_INSPECTION:    '待出廠',
  READY_TO_SHIP:    '出廠',
  SHIPPED:          '完成',
}

const statusLabel: Record<ProductionStatus, string> = {
  PENDING:          '待排產',
  SAMPLE_SUBMITTED: '打樣中',
  SAMPLE_APPROVED:  '樣品確認',
  IN_PRODUCTION:    '生產中',
  QC_INSPECTION:    '驗貨中',
  READY_TO_SHIP:    '待出廠',
  SHIPPED:          '已出廠',
  COMPLETED:        '已完成',
  CANCELLED:        '已取消',
}

const statusBadgeCls: Record<ProductionStatus, string> = {
  PENDING:          'border-slate-300 text-slate-600',
  SAMPLE_SUBMITTED: 'bg-purple-100 text-purple-700 border-purple-200',
  SAMPLE_APPROVED:  'bg-indigo-100 text-indigo-700 border-indigo-200',
  IN_PRODUCTION:    'bg-blue-100 text-blue-700 border-blue-200',
  QC_INSPECTION:    'bg-amber-100 text-amber-700 border-amber-200',
  READY_TO_SHIP:    'bg-cyan-100 text-cyan-700 border-cyan-200',
  SHIPPED:          'bg-teal-100 text-teal-700 border-teal-200',
  COMPLETED:        'bg-green-100 text-green-700 border-green-200',
  CANCELLED:        'bg-red-100 text-red-700 border-red-200',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function fmtShortDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

function toInputDate(s: string | null) {
  if (!s) return ''
  return new Date(s).toISOString().slice(0, 10)
}

function milestoneIndex(status: ProductionStatus): number {
  if (status === 'CANCELLED') return -1
  const idx = MILESTONES.findIndex(m => m.key === status)
  return idx
}

// auto-fill date fields when advancing status
function getAutoDateFields(nextStatus: ProductionStatus): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10)
  switch (nextStatus) {
    case 'SAMPLE_SUBMITTED': return { sampleSubmitDate: today }
    case 'SAMPLE_APPROVED':  return { sampleApproveDate: today }
    case 'IN_PRODUCTION':    return { productionStartDate: today }
    case 'QC_INSPECTION':    return { inspectionDate: today }
    case 'SHIPPED':          return { shipmentDate: today }
    case 'COMPLETED':        return { productionEndDate: today }
    default: return {}
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProductionPage() {
  const { dict } = useI18n()
  const [orders, setOrders]         = useState<ProductionOrder[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterFactory, setFilterFactory] = useState('')
  const [advancing, setAdvancing]   = useState<string | null>(null) // order id being advanced

  // Options for dropdowns
  const [purchases, setPurchases]   = useState<PurchaseOption[]>([])
  const [suppliers, setSuppliers]   = useState<SupplierOption[]>([])

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating]     = useState(false)
  const [createForm, setCreateForm] = useState({
    purchaseOrderId: '', factoryId: '', orderQty: '', notes: '',
  })

  // Edit dialog
  const [editOpen, setEditOpen]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [editTarget, setEditTarget] = useState<ProductionOrder | null>(null)
  const [editForm, setEditForm]     = useState({
    status: '' as ProductionStatus | '',
    producedQty: '', passedQty: '', defectQty: '',
    sampleSubmitDate: '', sampleApproveDate: '',
    productionStartDate: '', productionEndDate: '',
    inspectionDate: '', shipmentDate: '', notes: '',
  })

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus)  params.set('status', filterStatus)
    if (filterFactory) params.set('factoryId', filterFactory)
    const res = await fetch(`/api/production?${params}`)
    if (res.ok) setOrders(await res.json())
    setLoading(false)
  }, [filterStatus, filterFactory])

  const fetchOptions = useCallback(async () => {
    const [poRes, supRes] = await Promise.all([
      fetch('/api/purchases'),
      fetch('/api/suppliers'),
    ])
    if (poRes.ok)  setPurchases(await poRes.json())
    if (supRes.ok) setSuppliers(await supRes.json())
  }, [])

  useEffect(() => { fetchOptions() }, [fetchOptions])
  useEffect(() => {
    const t = setTimeout(fetchOrders, 200)
    return () => clearTimeout(t)
  }, [fetchOrders])

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = search
    ? orders.filter(o =>
        o.productionNo.toLowerCase().includes(search.toLowerCase()) ||
        o.factory.name.toLowerCase().includes(search.toLowerCase()) ||
        o.purchaseOrder.poNo.toLowerCase().includes(search.toLowerCase())
      )
    : orders

  // ── Quick advance status ──────────────────────────────────────────────────
  async function handleAdvance(o: ProductionOrder) {
    const next = NEXT_STATUS[o.status]
    if (!next) return
    setAdvancing(o.id)
    const autoFields = getAutoDateFields(next)
    const res = await fetch(`/api/production/${o.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next, ...autoFields }),
    })
    setAdvancing(null)
    if (res.ok) {
      toast.success(`${statusLabel[next]} ✓`)
      fetchOrders()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.error)
    }
  }

  async function handleCancel(o: ProductionOrder) {
    if (!confirm(`確定要取消生產單 ${o.productionNo} 嗎？`)) return
    setAdvancing(o.id)
    const res = await fetch(`/api/production/${o.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    })
    setAdvancing(null)
    if (res.ok) { toast.success(dict.production.statuses.CANCELLED); fetchOrders() }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? dict.common.error) }
  }

  // ── Create handler ────────────────────────────────────────────────────────
  function openCreate() {
    setCreateForm({ purchaseOrderId: '', factoryId: '', orderQty: '', notes: '' })
    setCreateOpen(true)
  }

  async function handleCreate() {
    if (!createForm.purchaseOrderId || !createForm.factoryId || !createForm.orderQty) {
      toast.error(dict.common.required)
      return
    }
    setCreating(true)
    const res = await fetch('/api/production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchaseOrderId: createForm.purchaseOrderId,
        factoryId:       createForm.factoryId,
        orderQty:        Number(createForm.orderQty),
        notes:           createForm.notes || null,
      }),
    })
    setCreating(false)
    if (res.ok) {
      toast.success('生產單已建立')
      setCreateOpen(false)
      fetchOrders()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? '建立失敗')
    }
  }

  // ── Edit handler ──────────────────────────────────────────────────────────
  function openEdit(o: ProductionOrder) {
    setEditTarget(o)
    setEditForm({
      status:              o.status,
      producedQty:         o.producedQty?.toString() ?? '',
      passedQty:           o.passedQty?.toString() ?? '',
      defectQty:           o.defectQty?.toString() ?? '',
      sampleSubmitDate:    toInputDate(o.sampleSubmitDate),
      sampleApproveDate:   toInputDate(o.sampleApproveDate),
      productionStartDate: toInputDate(o.productionStartDate),
      productionEndDate:   toInputDate(o.productionEndDate),
      inspectionDate:      toInputDate(o.inspectionDate),
      shipmentDate:        toInputDate(o.shipmentDate),
      notes:               o.notes ?? '',
    })
    setEditOpen(true)
  }

  async function handleUpdate() {
    if (!editTarget) return
    setSaving(true)
    const body: Record<string, unknown> = {
      status: editForm.status || undefined,
      notes:  editForm.notes  || undefined,
    }
    if (editForm.producedQty) body.producedQty = Number(editForm.producedQty)
    if (editForm.passedQty)   body.passedQty   = Number(editForm.passedQty)
    if (editForm.defectQty)   body.defectQty   = Number(editForm.defectQty)
    if (editForm.sampleSubmitDate)    body.sampleSubmitDate    = editForm.sampleSubmitDate
    if (editForm.sampleApproveDate)   body.sampleApproveDate   = editForm.sampleApproveDate
    if (editForm.productionStartDate) body.productionStartDate = editForm.productionStartDate
    if (editForm.productionEndDate)   body.productionEndDate   = editForm.productionEndDate
    if (editForm.inspectionDate)      body.inspectionDate      = editForm.inspectionDate
    if (editForm.shipmentDate)        body.shipmentDate        = editForm.shipmentDate

    const res = await fetch(`/api/production/${editTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('生產單已更新')
      setEditOpen(false)
      fetchOrders()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? '更新失敗')
    }
  }

  // ── Milestone progress bar ────────────────────────────────────────────────
  function MilestoneBar({ status }: { status: ProductionStatus }) {
    const current = milestoneIndex(status)
    const isCancelled = status === 'CANCELLED'

    return (
      <div className="flex items-center gap-0 w-full mt-3">
        {MILESTONES.map((m, i) => {
          const isActive  = !isCancelled && i <= current
          const isCurrent = !isCancelled && i === current
          return (
            <div key={m.key} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {i > 0 && (
                <div
                  className={`absolute top-[9px] right-1/2 w-full h-[2px] -z-10 ${
                    isActive ? 'bg-blue-500' : 'bg-slate-200'
                  }`}
                />
              )}
              {/* Dot */}
              <div
                className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center text-[8px] font-bold ${
                  isCurrent
                    ? 'bg-blue-500 border-blue-500 text-white ring-2 ring-blue-200'
                    : isActive
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white border-slate-300 text-slate-400'
                }`}
              >
                {isActive ? '✓' : i + 1}
              </div>
              {/* Label */}
              <span
                className={`text-[10px] mt-1 leading-tight text-center ${
                  isCurrent ? 'text-blue-600 font-semibold' : isActive ? 'text-blue-500' : 'text-slate-400'
                }`}
              >
                {m.label}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.production.title}</h1>
          <p className="text-sm text-muted-foreground">共 {filtered.length} 筆生產單</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />{dict.production.newOrder}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜尋生產單號、工廠、採購單..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterStatus || '_none'} onValueChange={v => setFilterStatus(v === '_none' ? '' : (v ?? ''))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{dict.common.all}{dict.common.status}</SelectItem>
            {Object.entries(statusLabel).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterFactory || '_none'} onValueChange={v => setFilterFactory(v === '_none' ? '' : (v ?? ''))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{dict.common.all}{dict.production.factory}</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-16 text-center text-muted-foreground">
          {search || filterStatus || filterFactory
            ? '找不到符合條件的生產單'
            : '尚無生產單，請點擊右上角新增'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map(o => {
            const isTerminal = o.status === 'COMPLETED' || o.status === 'CANCELLED'
            const nextStatus = NEXT_STATUS[o.status]
            const nextLabel  = NEXT_STATUS_LABEL[o.status]
            const isAdvancing = advancing === o.id

            return (
              <Card key={o.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  {/* Top row: production no + badge + edit */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-orange-50 p-2.5">
                        <Factory className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{o.productionNo}</span>
                          <Badge variant="outline" className={`text-xs ${statusBadgeCls[o.status]}`}>
                            {statusLabel[o.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {o.factory.name}
                          <span className="mx-1.5">·</span>
                          PO: {o.purchaseOrder.poNo}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openEdit(o)}
                      className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Milestone bar */}
                  <MilestoneBar status={o.status} />

                  {/* Info row */}
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      訂購 {o.orderQty.toLocaleString()}
                      {o.producedQty != null && (
                        <span className="text-blue-600 font-medium ml-1">
                          / 產出 {o.producedQty.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {o.passedQty != null && (
                      <div className="flex items-center gap-1">
                        良品 {o.passedQty.toLocaleString()}
                        {o.defectRate != null && (
                          <span className="text-red-500">
                            (不良 {Number(o.defectRate).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      建立 {fmtShortDate(o.createdAt)}
                    </div>
                  </div>

                  {/* Milestone dates */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {o.sampleSubmitDate && <span>打樣送出: {fmtShortDate(o.sampleSubmitDate)}</span>}
                    {o.sampleApproveDate && <span>樣品確認: {fmtShortDate(o.sampleApproveDate)}</span>}
                    {o.productionStartDate && <span>開始生產: {fmtShortDate(o.productionStartDate)}</span>}
                    {o.productionEndDate && <span>生產完成: {fmtShortDate(o.productionEndDate)}</span>}
                    {o.inspectionDate && <span>驗貨日: {fmtShortDate(o.inspectionDate)}</span>}
                    {o.shipmentDate && <span>出廠日: {fmtShortDate(o.shipmentDate)}</span>}
                  </div>

                  {/* Sea freight link */}
                  {o.seaFreights.length > 0 && (
                    <div className="mt-3 border-t pt-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Ship className="h-3 w-3" />
                        <span className="font-medium">關聯海運</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {o.seaFreights.map(sf => (
                          <Badge key={sf.id} variant="outline" className="text-xs">
                            {sf.freightNo}
                            <span className="ml-1 text-muted-foreground">
                              ({sf.status})
                            </span>
                            {sf.eta && (
                              <span className="ml-1 text-muted-foreground">
                                ETA {fmtShortDate(sf.eta)}
                              </span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {o.notes && (
                    <p className="mt-2 text-xs text-muted-foreground border-t pt-2 line-clamp-2">
                      備註：{o.notes}
                    </p>
                  )}

                  {/* ── Quick action buttons ── */}
                  {!isTerminal && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-2">
                      {nextStatus && nextLabel && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs gap-1"
                          disabled={isAdvancing}
                          onClick={() => handleAdvance(o)}
                        >
                          {isAdvancing
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <ArrowRight className="h-3 w-3" />}
                          {nextLabel}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
                        disabled={isAdvancing}
                        onClick={() => handleCancel(o)}
                      >
                        <XCircle className="h-3 w-3" />取消
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Create Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dict.production.newOrder}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>採購單 <span className="text-red-500">*</span></Label>
              <Select
                value={createForm.purchaseOrderId || '_none'}
                onValueChange={v => setCreateForm(f => ({ ...f, purchaseOrderId: v === '_none' ? '' : (v ?? '') }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇採購單" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">請選擇採購單</SelectItem>
                  {purchases.map(po => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.poNo} — {po.supplier?.name ?? '未知供應商'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>代工工廠 <span className="text-red-500">*</span></Label>
              <Select
                value={createForm.factoryId || '_none'}
                onValueChange={v => setCreateForm(f => ({ ...f, factoryId: v === '_none' ? '' : (v ?? '') }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇工廠" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">請選擇工廠</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{dict.production.orderQty} <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={1}
                value={createForm.orderQty}
                onChange={e => setCreateForm(f => ({ ...f, orderQty: e.target.value }))}
                placeholder="輸入數量"
              />
            </div>

            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea
                value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="特殊需求、規格說明..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>{dict.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dict.common.edit}{dict.production.productionNo} {editTarget?.productionNo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            {/* Status */}
            <div className="space-y-1.5">
              <Label>生產狀態</Label>
              <Select
                value={editForm.status || '_none'}
                onValueChange={v => setEditForm(f => ({ ...f, status: (v === '_none' ? '' : (v ?? '')) as ProductionStatus | '' }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabel).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity fields */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{dict.production.producedQty}</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.producedQty}
                  onChange={e => setEditForm(f => ({ ...f, producedQty: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>良品數量</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.passedQty}
                  onChange={e => setEditForm(f => ({ ...f, passedQty: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>不良品數量</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.defectQty}
                  onChange={e => setEditForm(f => ({ ...f, defectQty: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Milestone dates */}
            <p className="text-xs font-medium text-slate-500 pt-1">里程碑日期</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>打樣送出日</Label>
                <Input
                  type="date"
                  value={editForm.sampleSubmitDate}
                  onChange={e => setEditForm(f => ({ ...f, sampleSubmitDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>樣品確認日</Label>
                <Input
                  type="date"
                  value={editForm.sampleApproveDate}
                  onChange={e => setEditForm(f => ({ ...f, sampleApproveDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>開始生產日</Label>
                <Input
                  type="date"
                  value={editForm.productionStartDate}
                  onChange={e => setEditForm(f => ({ ...f, productionStartDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>生產完成日</Label>
                <Input
                  type="date"
                  value={editForm.productionEndDate}
                  onChange={e => setEditForm(f => ({ ...f, productionEndDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>驗貨日</Label>
                <Input
                  type="date"
                  value={editForm.inspectionDate}
                  onChange={e => setEditForm(f => ({ ...f, inspectionDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>出廠日</Label>
                <Input
                  type="date"
                  value={editForm.shipmentDate}
                  onChange={e => setEditForm(f => ({ ...f, shipmentDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="生產備註..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
