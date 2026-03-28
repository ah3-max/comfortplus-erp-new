'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  ArrowLeft, ClipboardCheck, Plus, Loader2,
  CheckCircle2, AlertTriangle, Trash2, Save,
  Package, Factory, ShoppingBag,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
interface CheckItem {
  id: string
  itemName: string
  standardValue: string | null
  actualValue: string | null
  isQualified: boolean | null
  defectType: string | null
  defectQty: number | null
  judgment: string | null
  notes: string | null
}

interface QcDetail {
  id: string
  qcNo: string
  inspectionType: string
  qcStatus: string
  result: string | null
  batchNo: string | null
  inspectionDate: string | null
  inspectedById: string | null
  sampleSize: number | null
  passedQty: number | null
  failedQty: number | null
  passRate: string | null
  defectRate: string | null
  resultSummary: string | null
  notes: string | null
  createdAt: string
  product:         { id: string; sku: string; name: string } | null
  supplier:        { id: string; name: string; code: string } | null
  productionOrder: { id: string; productionNo: string; status: string } | null
  purchaseOrder:   { id: string; poNo: string } | null
  checkItems:      CheckItem[]
}

// ── Label maps ─────────────────────────────────────────────────────────────
const INSPECTION_TYPE_LABEL: Record<string, string> = {
  RAW_MATERIAL: '原物料 QC', PACKAGING: '包材 QC', IN_PRODUCTION: '生產中 QC',
  FINISHED_PRODUCT: '成品 QC', PRE_SHIPMENT: '出貨前 QC',
  INCOMING: '到貨驗收', COMPLAINT_TRACE: '客訴反查',
}
const STATUS_OPTIONS = [
  { value: 'PENDING',     label: '待檢驗' },
  { value: 'IN_PROGRESS', label: '檢驗中' },
  { value: 'COMPLETED',   label: '已完成' },
  { value: 'ON_HOLD',     label: '暫停' },
]
const RESULT_OPTIONS = [
  { value: 'ACCEPTED',           label: '✅ 允收' },
  { value: 'CONDITIONAL_ACCEPT', label: '⚠️ 條件允收' },
  { value: 'REWORK',             label: '🔧 重工' },
  { value: 'RETURN_TO_SUPPLIER', label: '↩️ 退供應商' },
  { value: 'SUPPLEMENT',         label: '➕ 補貨' },
  { value: 'DEDUCTION',          label: '💲 扣款' },
  { value: 'ANOMALY_CLOSED',     label: '📁 異常結案' },
]
const JUDGMENT_OPTIONS = ['PASS', 'FAIL', 'WARNING']
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700', ON_HOLD: 'bg-amber-100 text-amber-700',
}
const RESULT_COLOR: Record<string, string> = {
  ACCEPTED: 'bg-green-100 text-green-700', CONDITIONAL_ACCEPT: 'bg-amber-100 text-amber-700',
  REWORK: 'bg-orange-100 text-orange-700', RETURN_TO_SUPPLIER: 'bg-red-100 text-red-700',
  SUPPLEMENT: 'bg-blue-100 text-blue-700', DEDUCTION: 'bg-rose-100 text-rose-700',
  ANOMALY_CLOSED: 'bg-slate-100 text-slate-600',
}

// ── Common preset check items by inspection type ───────────────────────────
const PRESET_ITEMS: Record<string, string[]> = {
  FINISHED_PRODUCT: ['外觀／包裝完整性', '尺寸規格', '吸收量（ml）', '回滲量（ml）', '腰貼黏性', '透氣性', '條碼可讀性', '標示正確性'],
  PACKAGING:        ['外觀完整性', '尺寸規格', '印刷品質', '條碼可讀性', '材質厚度（μm）', '耐壓強度'],
  INCOMING:         ['數量核對', '外觀完整性', '規格確認', '批次號確認', '保存期限確認', '包裝完整性'],
  PRE_SHIPMENT:     ['出貨數量核對', '外觀完整性', '標示正確性', '包裝完整性', '裝箱明細核對'],
  RAW_MATERIAL:     ['外觀品質', '尺寸規格', '材質確認', '批次號確認'],
  IN_PRODUCTION:    ['尺寸規格', '吸收量抽測', '外觀品質', '包裝完整性'],
  COMPLAINT_TRACE:  ['客訴描述確認', '不良品檢視', '批次號比對', '根因分析'],
}

// ── Check Item Row (inline editable) ──────────────────────────────────────
function CheckItemRow({
  item, onUpdate, onDelete,
}: {
  item: CheckItem
  onUpdate: (id: string, data: Partial<CheckItem>) => void
  onDelete: (id: string) => void
}) {
  const [actualValue, setActualValue] = useState(item.actualValue ?? '')
  const [isQualified, setIsQualified] = useState<boolean | null>(item.isQualified ?? null)
  const [defectType, setDefectType] = useState(item.defectType ?? '')
  const [defectQty, setDefectQty] = useState(item.defectQty != null ? String(item.defectQty) : '')
  const [judgment, setJudgment] = useState(item.judgment ?? '')
  const [dirty, setDirty] = useState(false)

  function markDirty() { setDirty(true) }

  async function save() {
    await onUpdate(item.id, {
      actualValue:  actualValue  || null,
      isQualified:  isQualified,
      defectType:   defectType   || null,
      defectQty:    defectQty ? parseInt(defectQty) : null,
      judgment:     judgment     || null,
    })
    setDirty(false)
  }

  const qualifiedClass = isQualified === true
    ? 'border-green-400 bg-green-50 text-green-700'
    : isQualified === false
    ? 'border-red-400 bg-red-50 text-red-700'
    : 'border-slate-200 text-slate-500'

  return (
    <div className="px-4 py-3 border-b last:border-0 hover:bg-slate-50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Item name + standard */}
        <div className="w-40 shrink-0">
          <p className="text-sm font-medium text-slate-800">{item.itemName}</p>
          {item.standardValue && (
            <p className="text-xs text-muted-foreground mt-0.5">標準：{item.standardValue}</p>
          )}
        </div>

        {/* Actual value */}
        <div className="w-28">
          <Input
            value={actualValue}
            onChange={e => { setActualValue(e.target.value); markDirty() }}
            className="h-8 text-xs"
            placeholder="實測值"
          />
        </div>

        {/* Qualified toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => { setIsQualified(true); markDirty() }}
            className={`text-xs px-2.5 py-1 rounded-md border-2 font-medium transition-all ${
              isQualified === true ? 'border-green-400 bg-green-100 text-green-700' : 'border-slate-200 text-slate-400'
            }`}
          >✓ 合格</button>
          <button
            onClick={() => { setIsQualified(false); markDirty() }}
            className={`text-xs px-2.5 py-1 rounded-md border-2 font-medium transition-all ${
              isQualified === false ? 'border-red-400 bg-red-100 text-red-700' : 'border-slate-200 text-slate-400'
            }`}
          >✗ 不合格</button>
        </div>

        {/* Judgment */}
        <select
          value={judgment}
          onChange={e => { setJudgment(e.target.value); markDirty() }}
          className="border rounded-md px-2 py-1 text-xs w-24 h-8"
        >
          <option value="">判定</option>
          {JUDGMENT_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
        </select>

        {/* Defect info */}
        {isQualified === false && (
          <div className="flex gap-1.5">
            <Input
              value={defectType}
              onChange={e => { setDefectType(e.target.value); markDirty() }}
              className="h-8 text-xs w-28"
              placeholder="缺陷描述"
            />
            <Input
              type="number"
              min={0}
              value={defectQty}
              onChange={e => { setDefectQty(e.target.value); markDirty() }}
              className="h-8 text-xs w-20"
              placeholder="缺陷數"
            />
          </div>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {dirty && (
            <button
              onClick={save}
              className="text-xs px-2.5 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
            >
              <Save className="h-3 w-3" />{dict.common.save}
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="text-slate-300 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Detail Page ───────────────────────────────────────────────────────
export default function QcDetailPage() {
  const { dict } = useI18n()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [qc, setQc] = useState<QcDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit state
  const [editStatus, setEditStatus] = useState('')
  const [editResult, setEditResult] = useState('')
  const [editPassedQty, setEditPassedQty] = useState('')
  const [editFailedQty, setEditFailedQty] = useState('')
  const [editResultSummary, setEditResultSummary] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Add check item
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemStandard, setNewItemStandard] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/qc/${id}`)
      if (!res.ok) { router.push('/qc'); return }
      const data: QcDetail = await res.json()
      setQc(data)
      setEditStatus(data.qcStatus)
      setEditResult(data.result ?? '')
      setEditPassedQty(data.passedQty != null ? String(data.passedQty) : '')
      setEditFailedQty(data.failedQty != null ? String(data.failedQty) : '')
      setEditResultSummary(data.resultSummary ?? '')
      setEditNotes(data.notes ?? '')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/qc/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qcStatus:      editStatus || undefined,
          result:        editResult || undefined,
          passedQty:     editPassedQty ? parseInt(editPassedQty) : undefined,
          failedQty:     editFailedQty ? parseInt(editFailedQty) : undefined,
          resultSummary: editResultSummary || undefined,
          notes:         editNotes || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('已更新')
      await load()
    } catch {
      toast.error('更新失敗')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateItem(itemId: string, data: Partial<CheckItem>) {
    await fetch(`/api/qc/${id}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, ...data }),
    })
    await load()
  }

  async function handleDeleteItem(itemId: string) {
    await fetch(`/api/qc/${id}/items?itemId=${itemId}`, { method: 'DELETE' })
    await load()
  }

  async function handleAddItem() {
    if (!newItemName.trim()) return
    setAddingItem(true)
    try {
      await fetch(`/api/qc/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: newItemName, standardValue: newItemStandard || null }),
      })
      setNewItemName('')
      setNewItemStandard('')
      setShowAddItem(false)
      await load()
    } finally {
      setAddingItem(false)
    }
  }

  async function applyPreset() {
    if (!qc) return
    const presets = PRESET_ITEMS[qc.inspectionType] ?? []
    if (!presets.length) return
    setAddingItem(true)
    try {
      await fetch(`/api/qc/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presets.map(name => ({ itemName: name }))),
      })
      toast.success(`已套用 ${presets.length} 個預設檢驗項目`)
      await load()
    } finally {
      setAddingItem(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!qc) return null

  // Calculate pass rate from edit fields
  const p = parseInt(editPassedQty) || 0
  const f = parseInt(editFailedQty) || 0
  const total = p + f
  const livePassRate   = total > 0 ? ((p / total) * 100).toFixed(1) : null
  const liveDefectRate = total > 0 ? ((f / total) * 100).toFixed(1) : null

  const passedItems  = qc.checkItems.filter(i => i.isQualified === true).length
  const failedItems  = qc.checkItems.filter(i => i.isQualified === false).length
  const pendingItems = qc.checkItems.filter(i => i.isQualified === null).length

  return (
    <div className="space-y-4 p-6 max-w-5xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/qc" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-slate-700 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" />{dict.common.back}
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 font-mono">{qc.qcNo}</h1>
            <Badge className={`border-0 ${STATUS_COLOR[qc.qcStatus] ?? ''}`}>
              {STATUS_OPTIONS.find(s => s.value === qc.qcStatus)?.label ?? qc.qcStatus}
            </Badge>
            {qc.result && (
              <Badge className={`border-0 ${RESULT_COLOR[qc.result] ?? ''}`}>
                {RESULT_OPTIONS.find(r => r.value === qc.result)?.label ?? qc.result}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {INSPECTION_TYPE_LABEL[qc.inspectionType] ?? qc.inspectionType}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            建立日期：{new Date(qc.createdAt).toLocaleDateString('zh-TW')}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{dict.common.saving}</> : <><Save className="mr-1.5 h-3.5 w-3.5" />{dict.common.save}</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Info + Controls */}
        <div className="space-y-4 lg:col-span-1">
          {/* Related entities */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">關聯資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {qc.product && (
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{dict.common.product}</p>
                    <p className="font-medium">{qc.product.name}</p>
                    <p className="text-xs font-mono text-slate-500">{qc.product.sku}</p>
                  </div>
                </div>
              )}
              {qc.supplier && (
                <div className="flex items-start gap-2">
                  <Factory className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{dict.common.supplier}</p>
                    <p className="font-medium">{qc.supplier.name}</p>
                  </div>
                </div>
              )}
              {qc.productionOrder && (
                <div className="flex items-start gap-2">
                  <Factory className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">生產單</p>
                    <p className="font-mono text-sm">{qc.productionOrder.productionNo}</p>
                  </div>
                </div>
              )}
              {qc.purchaseOrder && (
                <div className="flex items-start gap-2">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{dict.nav.purchases}</p>
                    <p className="font-mono text-sm">{qc.purchaseOrder.poNo}</p>
                  </div>
                </div>
              )}
              <div className="pt-1 border-t space-y-1 text-xs text-slate-600">
                {qc.batchNo && <p><span className="text-muted-foreground">批次：</span>{qc.batchNo}</p>}
                {qc.inspectionDate && <p><span className="text-muted-foreground">檢驗日：</span>{new Date(qc.inspectionDate).toLocaleDateString('zh-TW')}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Inspection result controls */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">檢驗結果登錄</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">{dict.common.status}</Label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full border rounded-md px-3 py-1.5 text-sm"
                >
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">良品數</Label>
                  <Input type="number" min={0} value={editPassedQty}
                    onChange={e => setEditPassedQty(e.target.value)} className="text-sm h-9" placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">不良數</Label>
                  <Input type="number" min={0} value={editFailedQty}
                    onChange={e => setEditFailedQty(e.target.value)} className="text-sm h-9" placeholder="0" />
                </div>
              </div>

              {total > 0 && (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-green-50 border border-green-200 py-1.5">
                    <p className="text-sm font-bold text-green-700">{livePassRate}%</p>
                    <p className="text-xs text-green-600">良品率</p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 py-1.5">
                    <p className="text-sm font-bold text-red-700">{liveDefectRate}%</p>
                    <p className="text-xs text-red-600">{dict.qcExt.defectRate}</p>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">最終判定</Label>
                <select
                  value={editResult}
                  onChange={e => setEditResult(e.target.value)}
                  className="w-full border rounded-md px-3 py-1.5 text-sm"
                >
                  <option value="">待判定</option>
                  {RESULT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">結果摘要</Label>
                <Textarea
                  value={editResultSummary}
                  onChange={e => setEditResultSummary(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                  placeholder="例：腰貼黏性不足，建議重工後再驗…"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">{dict.common.notes}</Label>
                <Input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  className="text-sm h-9" placeholder="（選填）" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Check Items */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  逐項檢驗明細
                  <span className="font-normal text-xs text-muted-foreground">({qc.checkItems.length} 項)</span>
                </CardTitle>
                <div className="flex gap-2">
                  {qc.checkItems.length === 0 && PRESET_ITEMS[qc.inspectionType] && (
                    <Button variant="outline" size="sm" onClick={applyPreset} disabled={addingItem} className="text-xs">
                      {addingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '套用預設項目'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setShowAddItem(s => !s)} className="gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" />{dict.common.add}
                  </Button>
                </div>
              </div>

              {/* Summary pills */}
              {qc.checkItems.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    <CheckCircle2 className="h-3 w-3 inline mr-0.5" />合格 {passedItems}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    <AlertTriangle className="h-3 w-3 inline mr-0.5" />不合格 {failedItems}
                  </span>
                  {pendingItems > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      待判定 {pendingItems}
                    </span>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {/* Add item form */}
              {showAddItem && (
                <div className="border-b px-4 py-3 bg-blue-50/50">
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-40">
                      <Label className="text-xs text-slate-600 mb-1 block">項目名稱 *</Label>
                      <Input
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                        className="h-8 text-sm"
                        placeholder="例：吸收量（ml）"
                        autoFocus
                      />
                    </div>
                    <div className="flex-1 min-w-32">
                      <Label className="text-xs text-slate-600 mb-1 block">標準值（選填）</Label>
                      <Input
                        value={newItemStandard}
                        onChange={e => setNewItemStandard(e.target.value)}
                        className="h-8 text-sm"
                        placeholder="例：≥ 300ml"
                      />
                    </div>
                    <Button size="sm" onClick={handleAddItem} disabled={addingItem || !newItemName.trim()}>
                      {addingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : dict.common.add}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddItem(false)}>{dict.common.cancel}</Button>
                  </div>
                </div>
              )}

              {qc.checkItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm">尚未新增檢驗項目</p>
                  <p className="text-xs mt-1">點擊「套用預設項目」快速帶入常用檢驗項目</p>
                </div>
              ) : (
                <>
                  {/* Column headers */}
                  <div className="grid grid-cols-[10rem_7rem_auto_6rem_auto_auto] gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground bg-slate-50 border-b">
                    <span>項目名稱</span><span>實測值</span><span>合格</span><span>判定</span><span>缺陷</span><span></span>
                  </div>
                  {qc.checkItems.map(item => (
                    <CheckItemRow
                      key={item.id}
                      item={item}
                      onUpdate={handleUpdateItem}
                      onDelete={handleDeleteItem}
                    />
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
