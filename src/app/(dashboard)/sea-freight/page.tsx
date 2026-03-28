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
  Plus, Loader2, Ship, Anchor, MapPin, Calendar, ArrowRight,
  Pencil, Container, FileText, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

type FreightStatus = 'PENDING' | 'BOOKED' | 'LOADED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERING' | 'RECEIVED' | 'CANCELLED'
type CustomsStatus = 'NOT_STARTED' | 'SUBMITTED' | 'INSPECTING' | 'CLEARED' | 'HELD'

interface SeaFreight {
  id: string
  freightNo: string
  vesselName: string | null
  containerNo: string | null
  containerSize: string | null
  portOfLoading: string
  portOfDischarge: string
  etd: string | null
  eta: string | null
  atd: string | null
  ata: string | null
  status: FreightStatus
  customsStatus: CustomsStatus
  productionOrderId: string | null
  purchaseOrderId: string | null
  productionOrder?: { id: string; orderNo: string } | null
  purchaseOrder?: { id: string; poNo: string } | null
  shippingCost: number | null
  customsCost: number | null
  notes: string | null
  createdAt: string
}

interface ProductionOrder { id: string; orderNo: string }
interface PurchaseOrder { id: string; poNo: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const FREIGHT_STATUSES: { value: FreightStatus; label: string }[] = [
  { value: 'PENDING',    label: '待處理' },
  { value: 'BOOKED',     label: '已訂艙' },
  { value: 'LOADED',     label: '已裝船' },
  { value: 'IN_TRANSIT', label: '運輸中' },
  { value: 'ARRIVED',    label: '已抵港' },
  { value: 'DELIVERING', label: '配送中' },
  { value: 'RECEIVED',   label: '已簽收' },
  { value: 'CANCELLED',  label: '已取消' },
]

const CUSTOMS_STATUSES: { value: CustomsStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: '未開始' },
  { value: 'SUBMITTED',   label: '已申報' },
  { value: 'INSPECTING',  label: '查驗中' },
  { value: 'CLEARED',     label: '已放行' },
  { value: 'HELD',        label: '扣留中' },
]

const CONTAINER_SIZES = ['20GP', '40GP', '40HQ', '45HQ', 'LCL']

const FREIGHT_STEP_ORDER: FreightStatus[] = [
  'PENDING', 'BOOKED', 'LOADED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERING', 'RECEIVED',
]

function freightBadgeClass(s: FreightStatus): string {
  switch (s) {
    case 'PENDING':    return 'border-slate-400 text-slate-600'
    case 'BOOKED':     return 'border-blue-400 text-blue-600'
    case 'LOADED':     return 'border-indigo-400 text-indigo-600'
    case 'IN_TRANSIT': return 'border-cyan-400 text-cyan-700'
    case 'ARRIVED':    return 'border-emerald-400 text-emerald-700'
    case 'DELIVERING': return 'border-amber-400 text-amber-700'
    case 'RECEIVED':   return 'border-green-500 text-green-700'
    case 'CANCELLED':  return 'border-red-400 text-red-600'
  }
}

function customsBadgeClass(s: CustomsStatus): string {
  switch (s) {
    case 'NOT_STARTED': return 'border-slate-300 text-slate-500'
    case 'SUBMITTED':   return 'border-blue-400 text-blue-600'
    case 'INSPECTING':  return 'border-amber-400 text-amber-700'
    case 'CLEARED':     return 'border-green-500 text-green-700'
    case 'HELD':        return 'border-red-500 text-red-700'
  }
}

function freightLabel(s: FreightStatus) {
  return FREIGHT_STATUSES.find(x => x.value === s)?.label ?? s
}

function customsLabel(s: CustomsStatus) {
  return CUSTOMS_STATUSES.find(x => x.value === s)?.label ?? s
}

function fmtDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

function fmtDateFull(d: string | null) {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

// ── Empty forms ───────────────────────────────────────────────────────────────

const emptyCreateForm = {
  vesselName: '',
  containerNo: '',
  containerSize: '',
  portOfLoading: '',
  portOfDischarge: '',
  etd: '',
  eta: '',
  sourceType: '_none' as '_none' | 'production' | 'purchase',
  productionOrderId: '',
  purchaseOrderId: '',
  notes: '',
}

const emptyEditForm = {
  status: 'PENDING' as FreightStatus,
  customsStatus: 'NOT_STARTED' as CustomsStatus,
  vesselName: '',
  containerNo: '',
  containerSize: '',
  portOfLoading: '',
  portOfDischarge: '',
  etd: '',
  eta: '',
  atd: '',
  ata: '',
  shippingCost: '',
  customsCost: '',
  notes: '',
}

// ── Progress Bar Component ────────────────────────────────────────────────────

function StatusProgress({ status }: { status: FreightStatus }) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-1 mt-3">
        <div className="h-1.5 flex-1 rounded-full bg-red-200" />
        <span className="text-[10px] text-red-500 font-medium">已取消</span>
      </div>
    )
  }
  const idx = FREIGHT_STEP_ORDER.indexOf(status)
  const total = FREIGHT_STEP_ORDER.length
  return (
    <div className="mt-3">
      <div className="flex gap-0.5">
        {FREIGHT_STEP_ORDER.map((step, i) => {
          const active = i <= idx
          return (
            <div key={step} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  active ? 'bg-cyan-500' : 'bg-slate-200'
                }`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-muted-foreground">待處理</span>
        <span className="text-[10px] text-muted-foreground">{idx + 1}/{total}</span>
        <span className="text-[10px] text-muted-foreground">已簽收</span>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SeaFreightPage() {
  const { dict } = useI18n()
  const [records, setRecords]           = useState<SeaFreight[]>([])
  const [loading, setLoading]           = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('_all')
  const [showActive, setShowActive]     = useState(true)

  // dialogs
  const [createOpen, setCreateOpen]     = useState(false)
  const [editOpen, setEditOpen]         = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)

  // form states
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [editForm, setEditForm]     = useState(emptyEditForm)
  const [saving, setSaving]         = useState(false)

  // reference data
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([])
  const [purchaseOrders, setPurchaseOrders]     = useState<PurchaseOrder[]>([])

  // ── Fetch ────────────────────────────────────────────────────────────

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus !== '_all') params.set('status', filterStatus)
    if (showActive) params.set('active', 'true')
    const res = await fetch(`/api/sea-freight?${params}`)
    if (res.ok) setRecords(await res.json())
    else toast.error('載入海運資料失敗')
    setLoading(false)
  }, [filterStatus, showActive])

  const fetchReferenceData = useCallback(async () => {
    const [prodRes, poRes] = await Promise.all([
      fetch('/api/production'),
      fetch('/api/purchases'),
    ])
    if (prodRes.ok) setProductionOrders(await prodRes.json())
    if (poRes.ok) setPurchaseOrders(await poRes.json())
  }, [])

  useEffect(() => { fetchRecords() }, [fetchRecords])
  useEffect(() => { fetchReferenceData() }, [fetchReferenceData])

  // ── Create helpers ───────────────────────────────────────────────────

  function cf(k: keyof typeof emptyCreateForm, v: string) {
    setCreateForm(prev => ({ ...prev, [k]: v }))
  }

  function openCreate() {
    setCreateForm(emptyCreateForm)
    setCreateOpen(true)
  }

  async function handleCreate() {
    if (!createForm.portOfLoading || !createForm.portOfDischarge) {
      toast.error('請填寫裝貨港與卸貨港')
      return
    }
    setSaving(true)
    const body: Record<string, unknown> = {
      vesselName: createForm.vesselName || null,
      containerNo: createForm.containerNo || null,
      containerSize: createForm.containerSize || null,
      portOfLoading: createForm.portOfLoading,
      portOfDischarge: createForm.portOfDischarge,
      etd: createForm.etd || null,
      eta: createForm.eta || null,
      notes: createForm.notes || null,
    }
    if (createForm.sourceType === 'production' && createForm.productionOrderId) {
      body.productionOrderId = createForm.productionOrderId
    }
    if (createForm.sourceType === 'purchase' && createForm.purchaseOrderId) {
      body.purchaseOrderId = createForm.purchaseOrderId
    }
    const res = await fetch('/api/sea-freight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('海運記錄已建立')
      setCreateOpen(false)
      fetchRecords()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? '建立失敗')
    }
  }

  // ── Edit helpers ─────────────────────────────────────────────────────

  function ef(k: keyof typeof emptyEditForm, v: string) {
    setEditForm(prev => ({ ...prev, [k]: v }))
  }

  function openEdit(record: SeaFreight) {
    setEditingId(record.id)
    setEditForm({
      status: record.status,
      customsStatus: record.customsStatus,
      vesselName: record.vesselName ?? '',
      containerNo: record.containerNo ?? '',
      containerSize: record.containerSize ?? '',
      portOfLoading: record.portOfLoading,
      portOfDischarge: record.portOfDischarge,
      etd: fmtDateFull(record.etd),
      eta: fmtDateFull(record.eta),
      atd: fmtDateFull(record.atd),
      ata: fmtDateFull(record.ata),
      shippingCost: record.shippingCost?.toString() ?? '',
      customsCost: record.customsCost?.toString() ?? '',
      notes: record.notes ?? '',
    })
    setEditOpen(true)
  }

  async function handleEdit() {
    if (!editingId) return
    setSaving(true)
    const res = await fetch(`/api/sea-freight/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: editForm.status,
        customsStatus: editForm.customsStatus,
        vesselName: editForm.vesselName || null,
        containerNo: editForm.containerNo || null,
        containerSize: editForm.containerSize || null,
        portOfLoading: editForm.portOfLoading,
        portOfDischarge: editForm.portOfDischarge,
        etd: editForm.etd || null,
        eta: editForm.eta || null,
        atd: editForm.atd || null,
        ata: editForm.ata || null,
        shippingCost: editForm.shippingCost ? Number(editForm.shippingCost) : null,
        customsCost: editForm.customsCost ? Number(editForm.customsCost) : null,
        notes: editForm.notes || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('海運記錄已更新')
      setEditOpen(false)
      fetchRecords()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? '更新失敗')
    }
  }

  // ── Delete helper ────────────────────────────────────────────────────

  async function handleDelete(record: SeaFreight) {
    if (!confirm(`確定要刪除海運記錄 ${record.freightNo}？此操作無法復原。`)) return
    const res = await fetch(`/api/sea-freight/${record.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('海運記錄已刪除')
      fetchRecords()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? '刪除失敗')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────

  const activeCount = records.length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.seaFreight.title}</h1>
          <p className="text-sm text-muted-foreground">共 {activeCount} 筆海運記錄</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />{dict.common.create}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v ?? '_all')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">全部狀態</SelectItem>
            {FREIGHT_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showActive}
            onChange={e => setShowActive(e.target.checked)}
          />
          僅顯示進行中
        </label>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-3 py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.map(r => (
          <Card key={r.id} className="group hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              {/* Top row: freight no + actions */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-cyan-50 p-2.5">
                    <Ship className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 font-mono text-sm">{r.freightNo}</span>
                    {r.vesselName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{r.vesselName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(r)}
                    className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground"
                    title="編輯"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {r.status === 'PENDING' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(r) }}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      title="刪除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className={`text-xs ${freightBadgeClass(r.status)}`}>
                  {freightLabel(r.status)}
                </Badge>
                <Badge variant="outline" className={`text-xs ${customsBadgeClass(r.customsStatus)}`}>
                  通關：{customsLabel(r.customsStatus)}
                </Badge>
              </div>

              {/* Route: loading → discharge */}
              <div className="mt-3 flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-cyan-500" />
                  <span>{r.portOfLoading}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Anchor className="h-3.5 w-3.5 text-cyan-500" />
                  <span>{r.portOfDischarge}</span>
                </div>
              </div>

              {/* Container info */}
              {(r.containerNo || r.containerSize) && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Container className="h-3 w-3" />
                  {r.containerNo && <span className="font-mono">{r.containerNo}</span>}
                  {r.containerSize && (
                    <Badge variant="secondary" className="text-[10px] h-4">{r.containerSize}</Badge>
                  )}
                </div>
              )}

              {/* Timeline: ETD / ETA / ATD / ATA */}
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>ETD：{fmtDate(r.etd)}</span>
                  {r.atd && <span className="text-green-600">(實 {fmtDate(r.atd)})</span>}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>ETA：{fmtDate(r.eta)}</span>
                  {r.ata && <span className="text-green-600">(實 {fmtDate(r.ata)})</span>}
                </div>
              </div>

              {/* Linked order */}
              {(r.productionOrder || r.purchaseOrder) && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {r.productionOrder && <span>生產單：{r.productionOrder.orderNo}</span>}
                  {r.purchaseOrder && <span>採購單：{r.purchaseOrder.poNo}</span>}
                </div>
              )}

              {/* Progress bar */}
              <StatusProgress status={r.status} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {!loading && records.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-16 text-center text-muted-foreground">
          尚無海運記錄，請點擊「新增海運」建立第一筆
        </div>
      )}

      {/* ── Create Dialog ──────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dict.seaFreight.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            {/* Source type */}
            <div className="space-y-1.5">
              <Label>關聯單據</Label>
              <Select
                value={createForm.sourceType}
                onValueChange={v => cf('sourceType', v ?? '_none')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇關聯類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">不關聯</SelectItem>
                  <SelectItem value="production">生產工單</SelectItem>
                  <SelectItem value="purchase">採購單</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Production order selector */}
            {createForm.sourceType === 'production' && (
              <div className="space-y-1.5">
                <Label>生產工單</Label>
                <Select
                  value={createForm.productionOrderId || '_none'}
                  onValueChange={v => cf('productionOrderId', v === '_none' ? '' : (v ?? ''))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="選擇生產工單" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-- 請選擇 --</SelectItem>
                    {productionOrders.map(po => (
                      <SelectItem key={po.id} value={po.id}>{po.orderNo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Purchase order selector */}
            {createForm.sourceType === 'purchase' && (
              <div className="space-y-1.5">
                <Label>採購單</Label>
                <Select
                  value={createForm.purchaseOrderId || '_none'}
                  onValueChange={v => cf('purchaseOrderId', v === '_none' ? '' : (v ?? ''))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="選擇採購單" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-- 請選擇 --</SelectItem>
                    {purchaseOrders.map(po => (
                      <SelectItem key={po.id} value={po.id}>{po.poNo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Vessel & Container */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{dict.seaFreight.vessel}</Label>
                <Input
                  value={createForm.vesselName}
                  onChange={e => cf('vesselName', e.target.value)}
                  placeholder="EVER GIVEN"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.seaFreight.container}</Label>
                <Input
                  value={createForm.containerNo}
                  onChange={e => cf('containerNo', e.target.value.toUpperCase())}
                  placeholder="MSKU1234567"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>櫃型</Label>
              <Select
                value={createForm.containerSize || '_none'}
                onValueChange={v => cf('containerSize', v === '_none' ? '' : (v ?? ''))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇櫃型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">-- 請選擇 --</SelectItem>
                  {CONTAINER_SIZES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ports */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>裝貨港 <span className="text-red-500">*</span></Label>
                <Input
                  value={createForm.portOfLoading}
                  onChange={e => cf('portOfLoading', e.target.value)}
                  placeholder="深圳鹽田"
                />
              </div>
              <div className="space-y-1.5">
                <Label>卸貨港 <span className="text-red-500">*</span></Label>
                <Input
                  value={createForm.portOfDischarge}
                  onChange={e => cf('portOfDischarge', e.target.value)}
                  placeholder="高雄港"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>預計開航 (ETD)</Label>
                <Input
                  type="date"
                  value={createForm.etd}
                  onChange={e => cf('etd', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>預計到港 (ETA)</Label>
                <Input
                  type="date"
                  value={createForm.eta}
                  onChange={e => cf('eta', e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea
                value={createForm.notes}
                onChange={e => cf('notes', e.target.value)}
                rows={2}
                placeholder="特殊說明..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              {dict.common.cancel}
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dict.common.edit}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            {/* Status selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>運輸狀態</Label>
                <Select
                  value={editForm.status}
                  onValueChange={v => ef('status', v ?? 'PENDING')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREIGHT_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>通關狀態</Label>
                <Select
                  value={editForm.customsStatus}
                  onValueChange={v => ef('customsStatus', v ?? 'NOT_STARTED')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMS_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Vessel & Container */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>船名</Label>
                <Input
                  value={editForm.vesselName}
                  onChange={e => ef('vesselName', e.target.value)}
                  placeholder="EVER GIVEN"
                />
              </div>
              <div className="space-y-1.5">
                <Label>櫃號</Label>
                <Input
                  value={editForm.containerNo}
                  onChange={e => ef('containerNo', e.target.value.toUpperCase())}
                  placeholder="MSKU1234567"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>櫃型</Label>
              <Select
                value={editForm.containerSize || '_none'}
                onValueChange={v => ef('containerSize', v === '_none' ? '' : (v ?? ''))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇櫃型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">-- 請選擇 --</SelectItem>
                  {CONTAINER_SIZES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ports */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>裝貨港</Label>
                <Input
                  value={editForm.portOfLoading}
                  onChange={e => ef('portOfLoading', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>卸貨港</Label>
                <Input
                  value={editForm.portOfDischarge}
                  onChange={e => ef('portOfDischarge', e.target.value)}
                />
              </div>
            </div>

            {/* Planned dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>預計開航 (ETD)</Label>
                <Input type="date" value={editForm.etd} onChange={e => ef('etd', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>預計到港 (ETA)</Label>
                <Input type="date" value={editForm.eta} onChange={e => ef('eta', e.target.value)} />
              </div>
            </div>

            {/* Actual dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>實際開航 (ATD)</Label>
                <Input type="date" value={editForm.atd} onChange={e => ef('atd', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>實際到港 (ATA)</Label>
                <Input type="date" value={editForm.ata} onChange={e => ef('ata', e.target.value)} />
              </div>
            </div>

            {/* Costs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>運費</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.shippingCost}
                  onChange={e => ef('shippingCost', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>報關費</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.customsCost}
                  onChange={e => ef('customsCost', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => ef('notes', e.target.value)}
                rows={2}
                placeholder="特殊說明..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              {dict.common.cancel}
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
