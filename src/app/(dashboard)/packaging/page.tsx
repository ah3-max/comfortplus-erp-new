'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import {
  Layers, Plus, Loader2, XCircle, AlertTriangle, Pencil, X, Check,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
interface PackagingMaterial {
  id:               string
  code:             string
  name:             string
  materialType:     string
  stockQty:         number
  inTransitQty:     number
  sentToFactoryQty: number
  wastageRate:      string | null
  unit:             string
  safetyStock:      number
  notes:            string | null
  supplier:         { id: string; name: string } | null
  updatedAt:        string
}

// ── Config ─────────────────────────────────────────────────────────────────
const MATERIAL_TYPE_COLOR: Record<string, string> = {
  WAISTBAND: 'bg-purple-100 text-purple-700',
  BAG:       'bg-blue-100 text-blue-700',
  BOX:       'bg-amber-100 text-amber-700',
  LABEL:     'bg-green-100 text-green-700',
  OTHER:     'bg-slate-100 text-slate-600',
}

// ── Form ───────────────────────────────────────────────────────────────────
function MaterialForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Partial<PackagingMaterial>
  onSaved: () => void
  onCancel: () => void
}) {
  const { dict } = useI18n()
  const materialTypeLabel: Record<string, string> = dict.packaging.materialTypes as unknown as Record<string, string>
  const isEdit = !!initial?.id
  const [code,             setCode]             = useState(initial?.code             ?? '')
  const [name,             setName]             = useState(initial?.name             ?? '')
  const [materialType,     setMaterialType]     = useState(initial?.materialType     ?? 'OTHER')
  const [unit,             setUnit]             = useState(initial?.unit             ?? '')
  const [stockQty,         setStockQty]         = useState(String(initial?.stockQty         ?? 0))
  const [inTransitQty,     setInTransitQty]     = useState(String(initial?.inTransitQty     ?? 0))
  const [sentToFactoryQty, setSentToFactoryQty] = useState(String(initial?.sentToFactoryQty ?? 0))
  const [safetyStock,      setSafetyStock]      = useState(String(initial?.safetyStock      ?? 0))
  const [wastageRate,      setWastageRate]      = useState(initial?.wastageRate ? String(initial.wastageRate) : '')
  const [notes,            setNotes]            = useState(initial?.notes ?? '')
  const [saving,           setSaving]           = useState(false)

  async function handleSubmit() {
    if (!code.trim() || !name.trim()) {
      toast.error(dict.packagingPage.codeNameRequired)
      return
    }
    setSaving(true)
    try {
      const url    = isEdit ? `/api/packaging/${initial!.id}` : '/api/packaging'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code, name, materialType, unit,
          stockQty:         Number(stockQty),
          inTransitQty:     Number(inTransitQty),
          sentToFactoryQty: Number(sentToFactoryQty),
          safetyStock:      Number(safetyStock),
          wastageRate:      wastageRate ? Number(wastageRate) : null,
          notes:            notes || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? dict.common.saveFailed)
      }
      toast.success(isEdit ? dict.common.updateSuccess : dict.common.createSuccess)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : dict.common.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-blue-900 flex items-center gap-2">
          <Layers className="h-4 w-4" />
          {isEdit ? `${dict.common.edit}：${initial?.name}` : dict.packaging.newPackaging}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* type selector */}
        <div>
          <Label className="text-xs text-slate-600 mb-2 block">{dict.packaging.typeLabel} *</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(materialTypeLabel).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMaterialType(key)}
                className={`text-xs py-1.5 px-3 rounded-lg border-2 font-medium transition-all ${
                  materialType === key
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
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.packaging.packagingCode} *</Label>
            <Input
              value={code}
              onChange={e => setCode(e.target.value)}
              className="text-sm h-9"
              placeholder="PKG-WB-001"
              disabled={isEdit}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.packaging.packagingName} *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="text-sm h-9" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.common.unit}</Label>
            <Input value={unit} onChange={e => setUnit(e.target.value)} className="text-sm h-9" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.packaging.wastageRate} %</Label>
            <Input type="number" min={0} step={0.1} value={wastageRate} onChange={e => setWastageRate(e.target.value)} className="text-sm h-9" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.packaging.stockQty}</Label>
            <Input type="number" min={0} value={stockQty} onChange={e => setStockQty(e.target.value)} className="text-sm h-9" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.packaging.inTransitQty}</Label>
            <Input type="number" min={0} value={inTransitQty} onChange={e => setInTransitQty(e.target.value)} className="text-sm h-9" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.packaging.sentToFactoryQty}</Label>
            <Input type="number" min={0} value={sentToFactoryQty} onChange={e => setSentToFactoryQty(e.target.value)} className="text-sm h-9" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{dict.packaging.safetyStock}</Label>
            <Input type="number" min={0} value={safetyStock} onChange={e => setSafetyStock(e.target.value)} className="text-sm h-9" />
          </div>
        </div>

        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{dict.common.notes}</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} className="text-sm h-9" placeholder={dict.common.optional} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSubmit} disabled={saving} size="sm">
            {saving
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{dict.common.saving}</>
              : <><Check className="mr-1.5 h-3.5 w-3.5" />{isEdit ? dict.common.save : dict.packaging.newPackaging}</>
            }
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>{dict.common.cancel}</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PackagingPage() {
  const { dict } = useI18n()
  const [materials, setMaterials] = useState<PackagingMaterial[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState<PackagingMaterial | null>(null)
  const [typeFilter, setTypeFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/packaging')
      const data = await res.json()
      setMaterials(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = typeFilter
    ? materials.filter(m => m.materialType === typeFilter)
    : materials

  // Stats
  const lowStock = materials.filter(m => m.safetyStock > 0 && m.stockQty < m.safetyStock).length

  const stats = [
    { label: dict.packaging.statsTypes,       value: materials.length, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
    { label: dict.packaging.statsBelowSafety, value: lowStock,         color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200' },
    { label: dict.packaging.statsInTransit,   value: materials.reduce((s, m) => s + m.inTransitQty, 0),     color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
    { label: dict.packaging.statsSentToFactory, value: materials.reduce((s, m) => s + m.sentToFactoryQty, 0), color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  ]

  function handleSaved() {
    setShowForm(false)
    setEditing(null)
    load()
  }

  return (
    <div className="space-y-4 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-purple-600" />
            {dict.packaging.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Packaging Materials — {materials.length}</p>
        </div>
        {!showForm && !editing && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />{dict.packaging.newPackaging}
          </Button>
        )}
      </div>

      {/* New form */}
      {showForm && (
        <MaterialForm
          onSaved={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Edit form */}
      {editing && (
        <MaterialForm
          initial={editing}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-3 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="border rounded-md px-3 py-1.5 text-sm"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">{dict.packaging.allTypes}</option>
          {Object.entries(dict.packaging.materialTypes as unknown as Record<string, string>).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {typeFilter && (
          <button onClick={() => setTypeFilter('')} className="text-xs text-red-500 hover:text-red-700 px-2">
            {dict.packaging.clearFilter}
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
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <XCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{dict.packaging.noPackaging}</p>
              <p className="text-xs mt-1">{dict.packaging.noResults2.replace('{btn}', dict.packaging.newPackaging)}</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 text-xs font-semibold text-muted-foreground bg-slate-50">
                <span>{dict.packaging.packagingCode} / {dict.packaging.packagingName}</span>
                <span>{dict.common.type}</span>
                <span>{dict.packaging.currentStock}</span>
                <span>{dict.packaging.inTransit}</span>
                <span>{dict.packaging.sentToFactory}</span>
                <span>{dict.packaging.safetyStock}</span>
                <span>{dict.packaging.wastageRate}</span>
                <span></span>
              </div>
              {filtered.map(m => {
                const isLow = m.safetyStock > 0 && m.stockQty < m.safetyStock
                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 hover:bg-slate-50 transition-colors items-center"
                  >
                    <div>
                      <p className="font-mono text-sm font-semibold text-slate-800">{m.code}</p>
                      <p className="text-xs text-slate-600">{m.name}</p>
                      {m.supplier && (
                        <p className="text-xs text-muted-foreground">{m.supplier.name}</p>
                      )}
                    </div>
                    <div>
                      <Badge className={`text-xs font-normal border-0 ${MATERIAL_TYPE_COLOR[m.materialType] ?? 'bg-slate-100 text-slate-600'}`}>
                        {(dict.packaging.materialTypes as unknown as Record<string, string>)[m.materialType] ?? m.materialType}
                      </Badge>
                    </div>
                    <div className={`text-sm font-medium ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                      {m.stockQty.toLocaleString()}
                      <span className="text-xs text-muted-foreground ml-1">{m.unit}</span>
                      {isLow && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-red-500" />}
                    </div>
                    <div className="text-sm text-blue-600">
                      {m.inTransitQty > 0 ? m.inTransitQty.toLocaleString() : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="text-sm text-amber-600">
                      {m.sentToFactoryQty > 0 ? m.sentToFactoryQty.toLocaleString() : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="text-sm text-slate-600">
                      {m.safetyStock > 0 ? m.safetyStock.toLocaleString() : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="text-sm text-slate-600">
                      {m.wastageRate != null
                        ? `${Number(m.wastageRate).toFixed(1)}%`
                        : <span className="text-muted-foreground">—</span>
                      }
                    </div>
                    <button
                      onClick={() => { setEditing(m); setShowForm(false) }}
                      className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground hover:text-slate-700 transition-colors"
                      title={dict.common.edit}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
