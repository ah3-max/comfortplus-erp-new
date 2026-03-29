'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  ClipboardCheck, Plus, Loader2, ChevronRight,
  CheckCircle2, AlertTriangle, Clock, XCircle, Search, PlayCircle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
interface QcRecord {
  id: string
  qcNo: string
  inspectionType: string
  qcStatus: string
  result: string | null
  batchNo: string | null
  inspectionDate: string | null
  sampleSize: number | null
  passedQty: number | null
  failedQty: number | null
  defectRate: string | null
  resultSummary: string | null
  product:         { id: string; sku: string; name: string } | null
  supplier:        { id: string; name: string } | null
  productionOrder: { id: string; productionNo: string } | null
  purchaseOrder:   { id: string; poNo: string } | null
  _count:          { checkItems: number }
}

// ── Label maps (color-only; labels come from dict) ─────────────────────────
const INSPECTION_TYPE_COLOR: Record<string, string> = {
  RAW_MATERIAL:     'bg-slate-100 text-slate-700',
  PACKAGING:        'bg-purple-100 text-purple-700',
  IN_PRODUCTION:    'bg-blue-100 text-blue-700',
  FINISHED_PRODUCT: 'bg-green-100 text-green-700',
  PRE_SHIPMENT:     'bg-teal-100 text-teal-700',
  INCOMING:         'bg-orange-100 text-orange-700',
  COMPLAINT_TRACE:  'bg-red-100 text-red-700',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING:     'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED:   'bg-green-100 text-green-700',
  ON_HOLD:     'bg-amber-100 text-amber-700',
}
const STATUS_ICON: Record<string, ReactNode> = {
  PENDING:     <Clock className="h-3 w-3" />,
  IN_PROGRESS: <Loader2 className="h-3 w-3" />,
  COMPLETED:   <CheckCircle2 className="h-3 w-3" />,
  ON_HOLD:     <AlertTriangle className="h-3 w-3" />,
}
const RESULT_COLOR: Record<string, string> = {
  ACCEPTED:          'bg-green-100 text-green-700',
  CONDITIONAL_ACCEPT:'bg-amber-100 text-amber-700',
  REWORK:            'bg-orange-100 text-orange-700',
  RETURN_TO_SUPPLIER:'bg-red-100 text-red-700',
  SUPPLEMENT:        'bg-blue-100 text-blue-700',
  DEDUCTION:         'bg-rose-100 text-rose-700',
  ANOMALY_CLOSED:    'bg-slate-100 text-slate-600',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

// ── New QC Form ─────────────────────────────────────────────────────────────
function NewQcForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { dict } = useI18n()
  const [inspectionType, setInspectionType] = useState('FINISHED_PRODUCT')
  const [batchNo, setBatchNo] = useState('')
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0])
  const [sampleSize, setSampleSize] = useState('')
  const [notes, setNotes] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<{ id: string; sku: string; name: string }[]>([])
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; sku: string; name: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!productSearch.trim()) { setProducts([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/products?search=${encodeURIComponent(productSearch)}&limit=8`)
      const data = await res.json()
      setProducts(data.products ?? data)
    }, 300)
    return () => clearTimeout(t)
  }, [productSearch])

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch('/api/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionType,
          productId:      selectedProduct?.id || null,
          batchNo:        batchNo || null,
          inspectionDate: inspectionDate || null,
          sampleSize:     sampleSize ? parseInt(sampleSize) : null,
          notes:          notes || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success(dict.common.createSuccess)
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : dict.common.createFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-blue-900 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />{dict.qcExt.newInspection}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inspection type */}
        <div>
          <Label className="text-xs text-slate-600 mb-2 block">{dict.common.type} *</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(dict.qcExt.inspectionTypeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setInspectionType(key)}
                className={`text-xs py-2 px-2 rounded-lg border-2 font-medium transition-all text-left ${
                  inspectionType === key
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Product search */}
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.common.product}（{dict.common.optional}）</Label>
            {selectedProduct ? (
              <div className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm">
                <span><span className="font-mono text-xs text-slate-500 mr-1">{selectedProduct.sku}</span>{selectedProduct.name}</span>
                <button onClick={() => { setSelectedProduct(null); setProductSearch('') }} className="text-xs text-red-500 ml-2">✕</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 text-sm h-9"
                  placeholder={dict.qcExt.productSearchPlaceholder}
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
                {products.length > 0 && (
                  <div className="absolute z-10 w-full border rounded-lg bg-white shadow-lg mt-1 divide-y max-h-40 overflow-y-auto">
                    {products.map(p => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => { setSelectedProduct(p); setProductSearch(''); setProducts([]) }}
                      >
                        <span className="font-mono text-xs text-slate-500 mr-2">{p.sku}</span>{p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Batch No */}
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.qcExt.batchNo}</Label>
            <Input value={batchNo} onChange={e => setBatchNo(e.target.value)} className="text-sm h-9" placeholder="e.g. LOT-20260318" />
          </div>

          {/* Inspection date */}
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.qcExt.inspectionDate}</Label>
            <Input type="date" value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} className="text-sm h-9" />
          </div>

          {/* Sample qty */}
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.qcExt.sampleQty}</Label>
            <Input type="number" min={1} value={sampleSize} onChange={e => setSampleSize(e.target.value)} className="text-sm h-9" placeholder="e.g. 50" />
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.common.notes}</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className="text-sm h-9" placeholder={`（${dict.common.optional}）`} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSubmit} disabled={saving} size="sm">
            {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{dict.common.saving}</> : dict.qcExt.newInspection}
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>{dict.common.cancel}</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function QcPage() {
  const { dict } = useI18n()
  const [records, setRecords] = useState<QcRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Quick complete dialog
  const [completeTarget, setCompleteTarget] = useState<QcRecord | null>(null)
  const [completeForm, setCompleteForm] = useState({
    result: 'ACCEPTED',
    passedQty: '',
    failedQty: '',
    resultSummary: '',
  })
  const [completing, setCompleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter)   params.set('type', typeFilter)
      const res = await fetch(`/api/qc?${params}`)
      const data = await res.json()
      setRecords(data.records ?? data)
      setTotal(data.total ?? (data.records ?? data).length)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  // Stats derived from current list
  const stats = {
    pending:     records.filter(r => r.qcStatus === 'PENDING').length,
    inProgress:  records.filter(r => r.qcStatus === 'IN_PROGRESS').length,
    completed:   records.filter(r => r.qcStatus === 'COMPLETED').length,
    failed:      records.filter(r => r.result === 'RETURN_TO_SUPPLIER' || r.result === 'REWORK').length,
  }

  function openComplete(r: QcRecord) {
    setCompleteTarget(r)
    setCompleteForm({
      result: 'ACCEPTED',
      passedQty: r.passedQty?.toString() ?? '',
      failedQty: r.failedQty?.toString() ?? '',
      resultSummary: '',
    })
  }

  async function handleComplete() {
    if (!completeTarget) return
    setCompleting(true)
    const res = await fetch(`/api/qc/${completeTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qcStatus: 'COMPLETED',
        result: completeForm.result,
        passedQty: completeForm.passedQty ? Number(completeForm.passedQty) : undefined,
        failedQty: completeForm.failedQty ? Number(completeForm.failedQty) : undefined,
        resultSummary: completeForm.resultSummary || undefined,
      }),
    })
    setCompleting(false)
    if (res.ok) {
      toast.success(dict.common.complete)
      setCompleteTarget(null)
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.error)
    }
  }

  async function handleStartQc(r: QcRecord) {
    const res = await fetch(`/api/qc/${r.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qcStatus: 'IN_PROGRESS' }),
    })
    if (res.ok) { toast.success(dict.common.success); load() }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? dict.common.error) }
  }

  return (
    <div className="space-y-4 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
            {dict.qcExt.pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dict.qcExt.pageSubtitle} {total} {dict.qcExt.pageSubtitleSuffix}</p>
        </div>
        <Button onClick={() => setShowForm(s => !s)} className="gap-2">
          <Plus className="h-4 w-4" />{dict.qcExt.newInspection}
        </Button>
      </div>

      {/* New form */}
      {showForm && (
        <NewQcForm
          onCreated={() => { setShowForm(false); load() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: dict.qcExt.statPending,    value: stats.pending,    color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
          { label: dict.qcExt.statInProgress, value: stats.inProgress, color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
          { label: dict.qcExt.statCompleted,  value: stats.completed,  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
          { label: dict.qcExt.statFailed,     value: stats.failed,     color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-3 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          className="border rounded-md px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">{dict.common.all}{dict.common.status}</option>
          {Object.entries(dict.qcExt.statusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          className="border rounded-md px-3 py-1.5 text-sm"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">{dict.common.all}{dict.common.type}</option>
          {Object.entries(dict.qcExt.inspectionTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {(statusFilter || typeFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setTypeFilter('') }}
            className="text-xs text-red-500 hover:text-red-700 px-2"
          >
            {dict.common.reset}
          </button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <XCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{dict.qcExt.noInspections}</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Header row */}
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1.5fr_auto] gap-3 px-4 py-2.5 text-xs font-semibold text-muted-foreground bg-slate-50">
                <span>{dict.qcExt.colQcNoProduct}</span>
                <span>{dict.qcExt.colType}</span>
                <span>{dict.qcExt.colBatchDate}</span>
                <span>{dict.qcExt.colSamplePass}</span>
                <span>{dict.qcExt.colStatus}</span>
                <span>{dict.qcExt.colResult}</span>
                <span></span>
              </div>
              {records.map(r => {
                const statusLabel = dict.qcExt.statusLabels[r.qcStatus as keyof typeof dict.qcExt.statusLabels] ?? r.qcStatus
                const statusColor = STATUS_COLOR[r.qcStatus] ?? ''
                const statusIcon  = STATUS_ICON[r.qcStatus] ?? null
                const resultLabel = r.result ? (dict.qcExt.resultLabels[r.result as keyof typeof dict.qcExt.resultLabels] ?? r.result) : null
                const resultColor = r.result ? (RESULT_COLOR[r.result] ?? '') : ''
                const isPending    = r.qcStatus === 'PENDING'
                const isInProgress = r.qcStatus === 'IN_PROGRESS'
                return (
                  <div key={r.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1.5fr_auto] gap-3 px-4 py-3 hover:bg-slate-50 transition-colors items-center group">
                    <Link href={`/qc/${r.id}`} className="flex flex-col">
                      <p className="font-mono text-sm font-semibold text-slate-800">{r.qcNo}</p>
                      {r.product && <p className="text-xs text-muted-foreground truncate">{r.product.sku} · {r.product.name}</p>}
                      {r.supplier && !r.product && <p className="text-xs text-muted-foreground">{r.supplier.name}</p>}
                      {r._count.checkItems > 0 && (
                        <p className="text-xs text-blue-600">{r._count.checkItems} {dict.qcExt.itemDetails}</p>
                      )}
                    </Link>
                    <div>
                      <Badge className={`text-xs font-normal border-0 ${INSPECTION_TYPE_COLOR[r.inspectionType] ?? 'bg-slate-100'}`}>
                        {dict.qcExt.inspectionTypeLabels[r.inspectionType as keyof typeof dict.qcExt.inspectionTypeLabels] ?? r.inspectionType}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600">
                      <p>{r.batchNo ?? '—'}</p>
                      <p className="text-muted-foreground">{fmtDate(r.inspectionDate)}</p>
                    </div>
                    <div className="text-xs text-slate-600">
                      {r.sampleSize != null ? (
                        <>
                          <p>{dict.qcExt.samplePrefix} {r.sampleSize} {dict.qcExt.sampleUnit}</p>
                          {r.passedQty != null && <p className="text-green-600">{dict.qcExt.passPrefix} {r.passedQty}</p>}
                          {r.defectRate != null && <p className="text-red-600">{dict.qcExt.defectPrefix} {Number(r.defectRate).toFixed(1)}%</p>}
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div>
                      <Badge className={`text-xs font-normal gap-1 border-0 ${statusColor}`}>
                        {statusIcon}{statusLabel}
                      </Badge>
                    </div>
                    <div>
                      {resultLabel
                        ? <Badge className={`text-xs font-normal border-0 ${resultColor}`}>{resultLabel}</Badge>
                        : <span className="text-xs text-muted-foreground">{dict.qcExt.result}</span>}
                      {r.resultSummary && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{r.resultSummary}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {isPending && (
                        <button
                          onClick={() => handleStartQc(r)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-blue-50"
                          title={dict.qcExt.startQcTitle}
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isInProgress && (
                        <button
                          onClick={() => openComplete(r)}
                          className="text-xs text-green-600 hover:text-green-800 flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-green-50"
                          title={dict.qcExt.completeQcTitle}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <Link href={`/qc/${r.id}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-slate-700" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Complete Dialog */}
      <Dialog open={!!completeTarget} onOpenChange={o => !o && setCompleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dict.qcExt.completeDialogTitle} — {completeTarget?.qcNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">{dict.qcExt.result} *</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={completeForm.result}
                onChange={e => setCompleteForm(f => ({ ...f, result: e.target.value }))}
              >
                {Object.entries(dict.qcExt.resultLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">{dict.qcExt.passQty}</label>
                <Input
                  type="number" min={0}
                  value={completeForm.passedQty}
                  onChange={e => setCompleteForm(f => ({ ...f, passedQty: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">{dict.qcExt.failQty}</label>
                <Input
                  type="number" min={0}
                  value={completeForm.failedQty}
                  onChange={e => setCompleteForm(f => ({ ...f, failedQty: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">{dict.common.description}</label>
              <Textarea
                value={completeForm.resultSummary}
                onChange={e => setCompleteForm(f => ({ ...f, resultSummary: e.target.value }))}
                rows={2}
                placeholder={`${dict.common.description}…`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteTarget(null)} disabled={completing}>{dict.common.cancel}</Button>
            <Button onClick={handleComplete} disabled={completing}>
              {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
