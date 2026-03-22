'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  ClipboardCheck, Plus, Loader2, ChevronRight,
  CheckCircle2, AlertTriangle, Clock, XCircle, Search,
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

// ── Label maps ─────────────────────────────────────────────────────────────
const INSPECTION_TYPE_LABEL: Record<string, string> = {
  RAW_MATERIAL:     '原物料 QC',
  PACKAGING:        '包材 QC',
  IN_PRODUCTION:    '生產中 QC',
  FINISHED_PRODUCT: '成品 QC',
  PRE_SHIPMENT:     '出貨前 QC',
  INCOMING:         '到貨驗收',
  COMPLAINT_TRACE:  '客訴反查',
}
const INSPECTION_TYPE_COLOR: Record<string, string> = {
  RAW_MATERIAL:     'bg-slate-100 text-slate-700',
  PACKAGING:        'bg-purple-100 text-purple-700',
  IN_PRODUCTION:    'bg-blue-100 text-blue-700',
  FINISHED_PRODUCT: 'bg-green-100 text-green-700',
  PRE_SHIPMENT:     'bg-teal-100 text-teal-700',
  INCOMING:         'bg-orange-100 text-orange-700',
  COMPLAINT_TRACE:  'bg-red-100 text-red-700',
}
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:     { label: '待檢驗', color: 'bg-slate-100 text-slate-600',  icon: <Clock className="h-3 w-3" /> },
  IN_PROGRESS: { label: '檢驗中', color: 'bg-blue-100 text-blue-700',    icon: <Loader2 className="h-3 w-3" /> },
  COMPLETED:   { label: '已完成', color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="h-3 w-3" /> },
  ON_HOLD:     { label: '暫停',   color: 'bg-amber-100 text-amber-700',  icon: <AlertTriangle className="h-3 w-3" /> },
}
const RESULT_CONFIG: Record<string, { label: string; color: string }> = {
  ACCEPTED:          { label: '✅ 允收',    color: 'bg-green-100 text-green-700' },
  CONDITIONAL_ACCEPT:{ label: '⚠️ 條件允收', color: 'bg-amber-100 text-amber-700' },
  REWORK:            { label: '🔧 重工',    color: 'bg-orange-100 text-orange-700' },
  RETURN_TO_SUPPLIER:{ label: '↩️ 退供應商', color: 'bg-red-100 text-red-700' },
  SUPPLEMENT:        { label: '➕ 補貨',    color: 'bg-blue-100 text-blue-700' },
  DEDUCTION:         { label: '💲 扣款',    color: 'bg-rose-100 text-rose-700' },
  ANOMALY_CLOSED:    { label: '📁 異常結案', color: 'bg-slate-100 text-slate-600' },
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

// ── New QC Form ─────────────────────────────────────────────────────────────
function NewQcForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
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
      toast.success('QC 單已建立')
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '建立失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-blue-900 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />新建 QC 檢驗單
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 檢驗類型 */}
        <div>
          <Label className="text-xs text-slate-600 mb-2 block">檢驗類型 *</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(INSPECTION_TYPE_LABEL).map(([key, label]) => (
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
          {/* 商品搜尋 */}
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">關聯商品（選填）</Label>
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
                  placeholder="搜尋 SKU 或商品名稱…"
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

          {/* 批次號 */}
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">批次號 / Lot No.</Label>
            <Input value={batchNo} onChange={e => setBatchNo(e.target.value)} className="text-sm h-9" placeholder="例：LOT-20260318" />
          </div>

          {/* 檢驗日期 */}
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">檢驗日期</Label>
            <Input type="date" value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} className="text-sm h-9" />
          </div>

          {/* 抽樣數 */}
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">抽樣數量</Label>
            <Input type="number" min={1} value={sampleSize} onChange={e => setSampleSize(e.target.value)} className="text-sm h-9" placeholder="例：50" />
          </div>
        </div>

        {/* 備註 */}
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">備註</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className="text-sm h-9" placeholder="（選填）" />
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSubmit} disabled={saving} size="sm">
            {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />建立中…</> : '建立 QC 單'}
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function QcPage() {
  const [records, setRecords] = useState<QcRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

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

  return (
    <div className="space-y-4 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
            品質檢驗管理
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">QC Quality Control — 共 {total} 筆</p>
        </div>
        <Button onClick={() => setShowForm(s => !s)} className="gap-2">
          <Plus className="h-4 w-4" />新增 QC 單
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
          { label: '待檢驗',  value: stats.pending,    color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
          { label: '檢驗中',  value: stats.inProgress, color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
          { label: '已完成',  value: stats.completed,  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
          { label: '退/重工', value: stats.failed,     color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
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
          <option value="">全部狀態</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          className="border rounded-md px-3 py-1.5 text-sm"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">全部類型</option>
          {Object.entries(INSPECTION_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {(statusFilter || typeFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setTypeFilter('') }}
            className="text-xs text-red-500 hover:text-red-700 px-2"
          >
            清除篩選
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
              <p>目前無 QC 紀錄</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Header row */}
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1.5fr_auto] gap-3 px-4 py-2.5 text-xs font-semibold text-muted-foreground bg-slate-50">
                <span>QC 單號 / 商品</span>
                <span>類型</span>
                <span>批次 / 日期</span>
                <span>抽樣 / 良品</span>
                <span>狀態</span>
                <span>結果</span>
                <span></span>
              </div>
              {records.map(r => {
                const statusCfg = STATUS_CONFIG[r.qcStatus] ?? { label: r.qcStatus, color: '', icon: null }
                const resultCfg = r.result ? RESULT_CONFIG[r.result] : null
                return (
                  <Link
                    key={r.id}
                    href={`/qc/${r.id}`}
                    className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1.5fr_auto] gap-3 px-4 py-3 hover:bg-slate-50 transition-colors items-center group"
                  >
                    <div>
                      <p className="font-mono text-sm font-semibold text-slate-800">{r.qcNo}</p>
                      {r.product && <p className="text-xs text-muted-foreground truncate">{r.product.sku} · {r.product.name}</p>}
                      {r.supplier && !r.product && <p className="text-xs text-muted-foreground">{r.supplier.name}</p>}
                      {r._count.checkItems > 0 && (
                        <p className="text-xs text-blue-600">{r._count.checkItems} 項明細</p>
                      )}
                    </div>
                    <div>
                      <Badge className={`text-xs font-normal border-0 ${INSPECTION_TYPE_COLOR[r.inspectionType] ?? 'bg-slate-100'}`}>
                        {INSPECTION_TYPE_LABEL[r.inspectionType] ?? r.inspectionType}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600">
                      <p>{r.batchNo ?? '—'}</p>
                      <p className="text-muted-foreground">{fmtDate(r.inspectionDate)}</p>
                    </div>
                    <div className="text-xs text-slate-600">
                      {r.sampleSize != null ? (
                        <>
                          <p>抽 {r.sampleSize} 件</p>
                          {r.passedQty != null && <p className="text-green-600">良品 {r.passedQty}</p>}
                          {r.defectRate != null && <p className="text-red-600">不良 {Number(r.defectRate).toFixed(1)}%</p>}
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div>
                      <Badge className={`text-xs font-normal gap-1 border-0 ${statusCfg.color}`}>
                        {statusCfg.icon}{statusCfg.label}
                      </Badge>
                    </div>
                    <div>
                      {resultCfg
                        ? <Badge className={`text-xs font-normal border-0 ${resultCfg.color}`}>{resultCfg.label}</Badge>
                        : <span className="text-xs text-muted-foreground">待判定</span>}
                      {r.resultSummary && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{r.resultSummary}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-slate-700" />
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
