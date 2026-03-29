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
  ArrowRight, XCircle, ClipboardList, PackageCheck,
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
const NEXT_STATUS: Partial<Record<ProductionStatus, ProductionStatus>> = {
  PENDING:          'SAMPLE_SUBMITTED',
  SAMPLE_SUBMITTED: 'SAMPLE_APPROVED',
  SAMPLE_APPROVED:  'IN_PRODUCTION',
  IN_PRODUCTION:    'QC_INSPECTION',
  QC_INSPECTION:    'READY_TO_SHIP',
  READY_TO_SHIP:    'SHIPPED',
  SHIPPED:          'COMPLETED',
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

const MILESTONE_ORDER: ProductionStatus[] = [
  'PENDING', 'SAMPLE_SUBMITTED', 'SAMPLE_APPROVED', 'IN_PRODUCTION',
  'QC_INSPECTION', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED',
]

function milestoneIndex(status: ProductionStatus): number {
  if (status === 'CANCELLED') return -1
  return MILESTONE_ORDER.indexOf(status)
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
  const po = dict.production

  const MILESTONES: { key: ProductionStatus; label: string }[] = [
    { key: 'PENDING',          label: po.milestones.PENDING },
    { key: 'SAMPLE_SUBMITTED', label: po.milestones.SAMPLE_SUBMITTED },
    { key: 'SAMPLE_APPROVED',  label: po.milestones.SAMPLE_APPROVED },
    { key: 'IN_PRODUCTION',    label: po.milestones.IN_PRODUCTION },
    { key: 'QC_INSPECTION',    label: po.milestones.QC_INSPECTION },
    { key: 'READY_TO_SHIP',    label: po.milestones.READY_TO_SHIP },
    { key: 'SHIPPED',          label: po.milestones.SHIPPED },
    { key: 'COMPLETED',        label: po.milestones.COMPLETED },
  ]

  const NEXT_STATUS_LABEL: Partial<Record<ProductionStatus, string>> = {
    PENDING:          po.nextStatusLabels.PENDING,
    SAMPLE_SUBMITTED: po.nextStatusLabels.SAMPLE_SUBMITTED,
    SAMPLE_APPROVED:  po.nextStatusLabels.SAMPLE_APPROVED,
    IN_PRODUCTION:    po.nextStatusLabels.IN_PRODUCTION,
    QC_INSPECTION:    po.nextStatusLabels.QC_INSPECTION,
    READY_TO_SHIP:    po.nextStatusLabels.READY_TO_SHIP,
    SHIPPED:          po.nextStatusLabels.SHIPPED,
  }

  const statusLabel: Record<ProductionStatus, string> = {
    PENDING:          po.statuses.PENDING,
    SAMPLE_SUBMITTED: po.statuses.SAMPLE_SUBMITTED,
    SAMPLE_APPROVED:  po.statuses.SAMPLE_APPROVED,
    IN_PRODUCTION:    po.statuses.IN_PRODUCTION,
    QC_INSPECTION:    po.statuses.QC_INSPECTION,
    READY_TO_SHIP:    po.statuses.READY_TO_SHIP,
    SHIPPED:          po.statuses.SHIPPED,
    COMPLETED:        po.statuses.COMPLETED,
    CANCELLED:        po.statuses.CANCELLED,
  }

  const [orders, setOrders]         = useState<ProductionOrder[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterFactory, setFilterFactory] = useState('')
  const [advancing, setAdvancing]   = useState<string | null>(null) // order id being advanced

  // Options for dropdowns
  const [purchases, setPurchases]   = useState<PurchaseOption[]>([])
  const [suppliers, setSuppliers]   = useState<SupplierOption[]>([])

  // Create requisition/receipt
  const [creatingRequisition, setCreatingRequisition] = useState<string | null>(null)
  const [creatingReceipt, setCreatingReceipt] = useState<string | null>(null)

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
    if (res.ok) {
      const d = await res.json()
      setOrders(Array.isArray(d) ? d : (d.data ?? []))
    }
    setLoading(false)
  }, [filterStatus, filterFactory])

  const fetchOptions = useCallback(async () => {
    const [poRes, supRes] = await Promise.all([
      fetch('/api/purchases'),
      fetch('/api/suppliers'),
    ])
    if (poRes.ok)  { const d = await poRes.json();  setPurchases(Array.isArray(d) ? d : (d.data ?? [])) }
    if (supRes.ok) { const d = await supRes.json(); setSuppliers(Array.isArray(d) ? d : (d.data ?? [])) }
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
    if (!confirm(`${po.cancelConfirm} ${o.productionNo} ${po.cancelConfirmSuffix}`)) return
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

  // ── Create Requisition / Receipt handlers ──────────────────────────────
  async function handleCreateRequisition(o: ProductionOrder) {
    setCreatingRequisition(o.id)
    try {
      // Need warehouses for from/to - use first two available
      const wRes = await fetch('/api/warehouses?pageSize=10')
      const wData = await wRes.json()
      const warehouses = wData.data ?? wData ?? []
      if (warehouses.length < 1) { toast.error(po.warehouseRequired); return }

      // Get products from purchase order items
      const poRes = await fetch(`/api/purchases/${o.purchaseOrder.id}`)
      if (!poRes.ok) { toast.error(po.purchaseDataFailed); return }
      const poData = await poRes.json()
      const items = (poData.items ?? []).map((item: { productId: string; product?: { name: string }; quantity: number }) => ({
        productId: item.productId,
        productName: item.product?.name ?? '',
        quantity: Number(item.quantity),
        unit: '',
        bomVersion: '',
        specification: '',
        memo: '',
      }))

      if (items.length === 0) { toast.error(po.noItems); return }

      const res = await fetch('/api/material-requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productionOrderId: o.id,
          fromWarehouseId: warehouses[0].id,
          toWarehouseId: warehouses.length > 1 ? warehouses[1].id : warehouses[0].id,
          date: new Date().toISOString().slice(0, 10),
          notes: `${po.autoCreatedNote} ${o.productionNo} ${po.autoCreatedNoteSuffix}`,
          items,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? dict.common.createFailed)
      }
      const data = await res.json()
      toast.success(`${po.requisitionCreated} ${data.requisitionNumber ?? ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : po.requisitionFailed)
    } finally {
      setCreatingRequisition(null)
    }
  }

  async function handleCreateReceipt(o: ProductionOrder) {
    setCreatingReceipt(o.id)
    try {
      // Need a receiving warehouse
      const wRes = await fetch('/api/warehouses?pageSize=10')
      const wData = await wRes.json()
      const warehouses = wData.data ?? wData ?? []
      if (warehouses.length < 1) { toast.error(po.warehouseRequired); return }

      // Get products from purchase order items
      const poRes = await fetch(`/api/purchases/${o.purchaseOrder.id}`)
      if (!poRes.ok) { toast.error(po.purchaseDataFailed); return }
      const poData = await poRes.json()
      const items = (poData.items ?? []).map((item: { productId: string; product?: { name: string }; quantity: number }) => ({
        productId: item.productId,
        productName: item.product?.name ?? '',
        quantity: Number(item.quantity),
        unit: '',
        bomVersion: '',
        specification: '',
        memo: '',
      }))

      if (items.length === 0) { toast.error(po.noItems); return }

      const res = await fetch('/api/production-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factoryId: o.factory.id,
          receivingWarehouseId: warehouses[0].id,
          productionOrderId: o.id,
          date: new Date().toISOString().slice(0, 10),
          notes: `${po.autoCreatedNote} ${o.productionNo} ${po.autoCreatedNoteSuffix}`,
          items,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? dict.common.createFailed)
      }
      const data = await res.json()
      toast.success(`${po.receiptCreated} ${data.receiptNumber ?? ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : po.receiptFailed)
    } finally {
      setCreatingReceipt(null)
    }
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
      toast.success(dict.common.createSuccess)
      setCreateOpen(false)
      fetchOrders()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.saveFailed)
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
      toast.success(dict.common.updateSuccess)
      setEditOpen(false)
      fetchOrders()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.updateFailed)
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
          <p className="text-sm text-muted-foreground">{dict.common.total} {filtered.length} {po.totalCount}</p>
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
            placeholder={po.searchPlaceholder}
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
            ? dict.common.noResultsFound
            : dict.common.noRecords}
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
                      {po.orderQtyLabel} {o.orderQty.toLocaleString()}
                      {o.producedQty != null && (
                        <span className="text-blue-600 font-medium ml-1">
                          {po.producedQtyLabel} {o.producedQty.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {o.passedQty != null && (
                      <div className="flex items-center gap-1">
                        {po.passedQtyLabel} {o.passedQty.toLocaleString()}
                        {o.defectRate != null && (
                          <span className="text-red-500">
                            {po.defectLabel} {Number(o.defectRate).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {po.createdLabel} {fmtShortDate(o.createdAt)}
                    </div>
                  </div>

                  {/* Milestone dates */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {o.sampleSubmitDate && <span>{po.sampleSubmitDateLabel}: {fmtShortDate(o.sampleSubmitDate)}</span>}
                    {o.sampleApproveDate && <span>{po.sampleApproveDateLabel}: {fmtShortDate(o.sampleApproveDate)}</span>}
                    {o.productionStartDate && <span>{po.productionStartDateLabel}: {fmtShortDate(o.productionStartDate)}</span>}
                    {o.productionEndDate && <span>{po.productionEndDateLabel}: {fmtShortDate(o.productionEndDate)}</span>}
                    {o.inspectionDate && <span>{po.inspectionDateLabel}: {fmtShortDate(o.inspectionDate)}</span>}
                    {o.shipmentDate && <span>{po.shipmentDateLabel}: {fmtShortDate(o.shipmentDate)}</span>}
                  </div>

                  {/* Sea freight link */}
                  {o.seaFreights.length > 0 && (
                    <div className="mt-3 border-t pt-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Ship className="h-3 w-3" />
                        <span className="font-medium">{po.relatedFreight}</span>
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
                      {po.notesPrefix}{o.notes}
                    </p>
                  )}

                  {/* ── Quick action buttons ── */}
                  {!isTerminal && (
                    <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2">
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
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        disabled={creatingRequisition === o.id}
                        onClick={() => handleCreateRequisition(o)}
                      >
                        {creatingRequisition === o.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <ClipboardList className="h-3 w-3" />}
                        {po.buildRequisition}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        disabled={creatingReceipt === o.id}
                        onClick={() => handleCreateReceipt(o)}
                      >
                        {creatingReceipt === o.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <PackageCheck className="h-3 w-3" />}
                        {po.buildReceipt}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
                        disabled={isAdvancing}
                        onClick={() => handleCancel(o)}
                      >
                        <XCircle className="h-3 w-3" />{po.cancelText}
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
              <Label>{po.purchaseOrderLabel} <span className="text-red-500">*</span></Label>
              <Select
                value={createForm.purchaseOrderId || '_none'}
                onValueChange={v => setCreateForm(f => ({ ...f, purchaseOrderId: v === '_none' ? '' : (v ?? '') }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={po.selectPOPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{po.selectPOOption}</SelectItem>
                  {purchases.map(purch => (
                    <SelectItem key={purch.id} value={purch.id}>
                      {purch.poNo} — {purch.supplier?.name ?? po.unknownSupplier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{dict.production.factory} <span className="text-red-500">*</span></Label>
              <Select
                value={createForm.factoryId || '_none'}
                onValueChange={v => setCreateForm(f => ({ ...f, factoryId: v === '_none' ? '' : (v ?? '') }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={po.selectFactoryPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{po.selectFactoryOption}</SelectItem>
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
                placeholder={po.enterQtyPH}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{dict.common.notes}</Label>
              <Textarea
                value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder={po.specialReqPH}
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
              <Label>{dict.common.status}</Label>
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
                <Label>{dict.qcExt.passQty}</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.passedQty}
                  onChange={e => setEditForm(f => ({ ...f, passedQty: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.qcExt.failQty}</Label>
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
            <p className="text-xs font-medium text-slate-500 pt-1">{dict.common.date}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{po.sampleSubmitDateField}</Label>
                <Input
                  type="date"
                  value={editForm.sampleSubmitDate}
                  onChange={e => setEditForm(f => ({ ...f, sampleSubmitDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{po.sampleApproveDateField}</Label>
                <Input
                  type="date"
                  value={editForm.sampleApproveDate}
                  onChange={e => setEditForm(f => ({ ...f, sampleApproveDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{po.productionStartDateField}</Label>
                <Input
                  type="date"
                  value={editForm.productionStartDate}
                  onChange={e => setEditForm(f => ({ ...f, productionStartDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{po.productionEndDateField}</Label>
                <Input
                  type="date"
                  value={editForm.productionEndDate}
                  onChange={e => setEditForm(f => ({ ...f, productionEndDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{po.inspectionDateField}</Label>
                <Input
                  type="date"
                  value={editForm.inspectionDate}
                  onChange={e => setEditForm(f => ({ ...f, inspectionDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{po.shipmentDateField}</Label>
                <Input
                  type="date"
                  value={editForm.shipmentDate}
                  onChange={e => setEditForm(f => ({ ...f, shipmentDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>{dict.common.notes}</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder={po.productionNotesPH}
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
