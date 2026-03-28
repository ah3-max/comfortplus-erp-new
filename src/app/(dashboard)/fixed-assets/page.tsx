'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, CheckCircle2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Depreciation {
  id: string
  periodYear: number
  periodMonth: number
  openingBookValue: number
  depreciationAmt: number
  closingBookValue: number
  isPosted: boolean
  postedAt: string | null
}

interface FixedAsset {
  id: string
  assetNo: string
  name: string
  category: string
  description: string | null
  location: string | null
  serialNo: string | null
  purchaseDate: string
  purchaseAmount: number
  salvageValue: number
  usefulLifeYears: number
  depreciationMethod: string
  status: string
  disposedAt: string | null
  disposalAmount: number | null
  notes: string | null
  createdAt: string
  supplier: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  depreciations: Depreciation[]
}

interface EditForm {
  name: string
  category: string
  description: string
  location: string
  serialNo: string
  purchaseDate: string
  purchaseAmount: string
  salvageValue: string
  usefulLifeYears: string
  depreciationMethod: string
  notes: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, string> = {
  VEHICLE: '車輛', EQUIPMENT: '設備機器', FURNITURE: '辦公家具',
  BUILDING: '房屋建物', IT: 'IT設備', OTHER: '其他',
}
const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE:      { label: '使用中',   color: 'default' },
  DISPOSED:    { label: '已處分',   color: 'secondary' },
  SCRAPPED:    { label: '已報廢',   color: 'destructive' },
  TRANSFERRED: { label: '已移轉',   color: 'outline' },
}

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(n) : '—'

function currentBookValue(asset: FixedAsset): number {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1
  const posted = asset.depreciations
    .filter(d => d.periodYear < yr || (d.periodYear === yr && d.periodMonth <= mo))
  if (posted.length === 0) return Number(asset.purchaseAmount)
  const last = posted[posted.length - 1]
  return Number(last.closingBookValue)
}

// Straight-line monthly depreciation amount (calculated from form fields)
function calcMonthlyDep(cost: number, salvage: number, lifeYears: number): number {
  if (lifeYears <= 0) return 0
  return Math.max(0, (cost - salvage) / (lifeYears * 12))
}

// Build a preview schedule (up to lifeYears * 12 rows) from form fields
function buildDepSchedule(cost: number, salvage: number, lifeYears: number, startDate: string) {
  const monthly = calcMonthlyDep(cost, salvage, lifeYears)
  const totalMonths = lifeYears * 12
  const rows: { period: string; opening: number; dep: number; closing: number }[] = []
  const start = startDate ? new Date(startDate) : new Date()
  let opening = cost

  for (let i = 0; i < totalMonths; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const closing = Math.max(salvage, opening - monthly)
    rows.push({
      period: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      opening,
      dep: opening - closing,
      closing,
    })
    opening = closing
    if (opening <= salvage) break
  }
  return rows
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FixedAssetsPage() {
  const { dict } = useI18n()
  const fa = dict.fixedAssets
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [detail, setDetail] = useState<FixedAsset | null>(null)
  const [detailTab, setDetailTab] = useState('info')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [disposeDialog, setDisposeDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', category: 'EQUIPMENT', description: '', location: '', serialNo: '',
    purchaseDate: '', purchaseAmount: '', salvageValue: '0',
    usefulLifeYears: '5', depreciationMethod: 'SL', notes: '',
  })

  const [editForm, setEditForm] = useState<EditForm>({
    name: '', category: 'EQUIPMENT', description: '', location: '', serialNo: '',
    purchaseDate: '', purchaseAmount: '', salvageValue: '0',
    usefulLifeYears: '5', depreciationMethod: 'SL', notes: '',
  })

  const [disposeForm, setDisposeForm] = useState({ status: 'DISPOSED', disposedAt: '', disposalAmount: '', notes: '' })

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter }),
      ...(categoryFilter && { category: categoryFilter }),
    })
    const res = await fetch(`/api/fixed-assets?${p}`)
    const json = await res.json()
    setAssets(json.data ?? [])
    setLoading(false)
  }, [search, statusFilter, categoryFilter])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  async function refreshDetail(id: string) {
    const res = await fetch(`/api/fixed-assets/${id}`)
    const data = await res.json()
    setDetail(data)
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!form.name || !form.purchaseDate || !form.purchaseAmount) {
      toast.error(fa.requiredFields)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          purchaseAmount: Number(form.purchaseAmount),
          salvageValue: Number(form.salvageValue),
          usefulLifeYears: Number(form.usefulLifeYears),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? dict.common.createFailed)
        return
      }
      toast.success(fa.assetCreated)
      setCreateOpen(false)
      setForm({ name: '', category: 'EQUIPMENT', description: '', location: '', serialNo: '', purchaseDate: '', purchaseAmount: '', salvageValue: '0', usefulLifeYears: '5', depreciationMethod: 'SL', notes: '' })
      fetchAssets()
    } finally {
      setSaving(false)
    }
  }

  // ── Open Edit dialog ─────────────────────────────────────────────────────────
  function openEdit(asset: FixedAsset) {
    setEditForm({
      name: asset.name,
      category: asset.category,
      description: asset.description ?? '',
      location: asset.location ?? '',
      serialNo: asset.serialNo ?? '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : '',
      purchaseAmount: String(Number(asset.purchaseAmount)),
      salvageValue: String(Number(asset.salvageValue)),
      usefulLifeYears: String(asset.usefulLifeYears),
      depreciationMethod: asset.depreciationMethod,
      notes: asset.notes ?? '',
    })
    setEditOpen(true)
  }

  // ── Save Edit ────────────────────────────────────────────────────────────────
  async function handleEdit() {
    if (!detail) return
    if (!editForm.name || !editForm.purchaseDate || !editForm.purchaseAmount) {
      toast.error(fa.requiredFields)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/fixed-assets/${detail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          category: editForm.category,
          description: editForm.description,
          location: editForm.location,
          serialNo: editForm.serialNo,
          purchaseDate: editForm.purchaseDate,
          purchaseAmount: Number(editForm.purchaseAmount),
          salvageValue: Number(editForm.salvageValue),
          usefulLifeYears: Number(editForm.usefulLifeYears),
          depreciationMethod: editForm.depreciationMethod,
          notes: editForm.notes,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? dict.common.updateFailed)
        return
      }
      toast.success(fa.assetUpdated)
      setEditOpen(false)
      await refreshDetail(detail.id)
      fetchAssets()
    } finally {
      setSaving(false)
    }
  }

  // ── Dispose ──────────────────────────────────────────────────────────────────
  async function handleDispose() {
    if (!detail) return
    setSaving(true)
    try {
      const res = await fetch(`/api/fixed-assets/${detail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DISPOSE',
          ...disposeForm,
          disposalAmount: disposeForm.disposalAmount ? Number(disposeForm.disposalAmount) : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? dict.common.operationFailed)
        return
      }
      toast.success(fa.assetDisposed)
      setDisposeDialog(false)
      refreshDetail(detail.id)
      fetchAssets()
    } finally {
      setSaving(false)
    }
  }

  // ── Post Depreciation ────────────────────────────────────────────────────────
  async function handlePostDep(depId: string) {
    if (!detail) return
    const res = await fetch(`/api/fixed-assets/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'POST_DEPRECIATION', depreciationId: depId }),
    })
    if (res.ok) {
      toast.success(fa.journalPosted)
      refreshDetail(detail.id)
    } else {
      toast.error(fa.journalFailed)
    }
  }

  // ── Derived data for depreciation preview in edit dialog ─────────────────────
  const editDepSchedule = editForm.purchaseAmount && editForm.purchaseDate && Number(editForm.usefulLifeYears) > 0
    ? buildDepSchedule(
        Number(editForm.purchaseAmount),
        Number(editForm.salvageValue || '0'),
        Number(editForm.usefulLifeYears),
        editForm.purchaseDate,
      )
    : []

  const totalNBV = assets.filter(a => a.status === 'ACTIVE').reduce((s, a) => s + currentBookValue(a), 0)
  const totalCost = assets.filter(a => a.status === 'ACTIVE').reduce((s, a) => s + Number(a.purchaseAmount), 0)

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{dict.fixedAssets.title}</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />{dict.fixedAssets.newAsset}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">資產總數</p><p className="text-xl font-bold">{assets.filter(a => a.status === 'ACTIVE').length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">原始成本</p><p className="text-lg font-bold">{fmt(totalCost)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{dict.fixedAssets.currentValue}</p><p className="text-lg font-bold text-blue-600">{fmt(totalNBV)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{dict.fixedAssets.depreciation}</p><p className="text-lg font-bold text-orange-600">{fmt(totalCost - totalNBV)}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input placeholder={dict.fixedAssets.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-52" />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? '')}>
          <SelectTrigger className="h-8 w-32"><SelectValue placeholder={dict.common.all + dict.common.status} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.common.all + dict.common.status}</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v ?? '')}>
          <SelectTrigger className="h-8 w-32"><SelectValue placeholder={dict.common.all + dict.fixedAssets.category} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.common.all + dict.fixedAssets.category}</SelectItem>
            {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left">{dict.fixedAssets.assetNo}</th>
                <th className="px-4 py-2 text-left">{dict.fixedAssets.assetName}</th>
                <th className="px-4 py-2 text-left">{dict.fixedAssets.category}</th>
                <th className="px-4 py-2 text-right">原始成本</th>
                <th className="px-4 py-2 text-right">{dict.fixedAssets.currentValue}</th>
                <th className="px-4 py-2 text-left">{dict.fixedAssets.purchaseDate}</th>
                <th className="px-4 py-2 text-center">{dict.common.status}</th>
              </tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{dict.common.loading}</td></tr>
                ) : assets.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{dict.fixedAssets.noAssets}</td></tr>
                ) : assets.map(a => (
                  <tr key={a.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => { setDetail(a); setDetailTab('info') }}>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{a.assetNo}</td>
                    <td className="px-4 py-2 font-medium">{a.name}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{CATEGORIES[a.category] ?? a.category}</Badge></td>
                    <td className="px-4 py-2 text-right">{fmt(Number(a.purchaseAmount))}</td>
                    <td className="px-4 py-2 text-right font-semibold">{fmt(currentBookValue(a))}</td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(a.purchaseDate).toLocaleDateString('zh-TW')}</td>
                    <td className="px-4 py-2 text-center"><Badge variant={STATUS_CONFIG[a.status]?.color ?? 'outline'}>{STATUS_CONFIG[a.status]?.label ?? a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Detail Dialog ── */}
      {detail && (
        <Dialog open onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {detail.assetNo} — {detail.name}
                <Badge variant={STATUS_CONFIG[detail.status]?.color ?? 'outline'}>{STATUS_CONFIG[detail.status]?.label ?? detail.status}</Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(detail)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />{dict.common.edit}
              </Button>
              {detail.status === 'ACTIVE' && (
                <Button variant="outline" size="sm" onClick={() => { setDisposeForm({ status: 'DISPOSED', disposedAt: new Date().toISOString().slice(0, 10), disposalAmount: '', notes: '' }); setDisposeDialog(true) }}>{dict.fixedAssets.statuses.DISPOSED}/報廢</Button>
              )}
            </div>

            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList>
                <TabsTrigger value="info">基本資訊</TabsTrigger>
                <TabsTrigger value="depreciation">折舊明細</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">類別：</span>{CATEGORIES[detail.category] ?? detail.category}</div>
                  <div><span className="text-muted-foreground">耐用年數：</span>{detail.usefulLifeYears} 年</div>
                  <div><span className="text-muted-foreground">購入日期：</span>{new Date(detail.purchaseDate).toLocaleDateString('zh-TW')}</div>
                  <div><span className="text-muted-foreground">購入金額：</span>{fmt(Number(detail.purchaseAmount))}</div>
                  <div><span className="text-muted-foreground">殘值：</span>{fmt(Number(detail.salvageValue))}</div>
                  <div><span className="text-muted-foreground">帳面淨值：</span><span className="font-semibold text-blue-600">{fmt(currentBookValue(detail))}</span></div>
                  <div><span className="text-muted-foreground">月折舊額：</span><span className="text-orange-600">{fmt(calcMonthlyDep(Number(detail.purchaseAmount), Number(detail.salvageValue), detail.usefulLifeYears))}</span></div>
                  <div><span className="text-muted-foreground">折舊法：</span>{detail.depreciationMethod === 'SL' ? '直線法' : detail.depreciationMethod}</div>
                  {detail.location && <div><span className="text-muted-foreground">存放位置：</span>{detail.location}</div>}
                  {detail.serialNo && <div><span className="text-muted-foreground">序號：</span>{detail.serialNo}</div>}
                  {detail.supplier && <div><span className="text-muted-foreground">供應商：</span>{detail.supplier.name}</div>}
                  {detail.assignedTo && <div><span className="text-muted-foreground">使用人：</span>{detail.assignedTo.name}</div>}
                </div>
                {detail.notes && <p className="mt-3 rounded bg-muted/40 p-2 text-sm">{detail.notes}</p>}
              </TabsContent>

              <TabsContent value="depreciation">
                {detail.depreciations.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{dict.common.noRecords}</p>
                ) : (
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background"><tr className="border-b text-xs text-muted-foreground">
                        <th className="py-1 text-left">期間</th>
                        <th className="py-1 text-right">期初帳面</th>
                        <th className="py-1 text-right">折舊金額</th>
                        <th className="py-1 text-right">期末帳面</th>
                        <th className="py-1 text-center">入帳</th>
                      </tr></thead>
                      <tbody>
                        {detail.depreciations.map(d => (
                          <tr key={d.id} className={`border-b ${d.isPosted ? 'text-muted-foreground' : ''}`}>
                            <td className="py-1">{d.periodYear}/{String(d.periodMonth).padStart(2, '0')}</td>
                            <td className="py-1 text-right">{fmt(Number(d.openingBookValue))}</td>
                            <td className="py-1 text-right text-orange-600">{fmt(Number(d.depreciationAmt))}</td>
                            <td className="py-1 text-right font-medium">{fmt(Number(d.closingBookValue))}</td>
                            <td className="py-1 text-center">
                              {d.isPosted ? (
                                <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                              ) : (
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handlePostDep(d.id)}>入帳</Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Edit Dialog ── */}
      {detail && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{dict.common.edit}{dict.fixedAssets.title} — {detail.assetNo}</DialogTitle></DialogHeader>

            <Tabs defaultValue="basic">
              <TabsList>
                <TabsTrigger value="basic">基本資訊</TabsTrigger>
                <TabsTrigger value="schedule">折舊預覽</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>資產名稱 *</Label>
                    <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>類別 *</Label>
                    <Select value={editForm.category} onValueChange={v => setEditForm(f => ({ ...f, category: v ?? 'EQUIPMENT' }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>購入日期 *</Label>
                    <Input type="date" value={editForm.purchaseDate} onChange={e => setEditForm(f => ({ ...f, purchaseDate: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>購入金額 *</Label>
                    <Input type="number" value={editForm.purchaseAmount} onChange={e => setEditForm(f => ({ ...f, purchaseAmount: e.target.value }))} className="mt-1" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>殘值</Label>
                    <Input type="number" value={editForm.salvageValue} onChange={e => setEditForm(f => ({ ...f, salvageValue: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>耐用年數 *</Label>
                    <Input type="number" min="1" value={editForm.usefulLifeYears} onChange={e => setEditForm(f => ({ ...f, usefulLifeYears: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>折舊法</Label>
                    <Select value={editForm.depreciationMethod} onValueChange={v => setEditForm(f => ({ ...f, depreciationMethod: v ?? 'SL' }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="SL">直線法</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>位置</Label>
                    <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>序號</Label>
                    <Input value={editForm.serialNo} onChange={e => setEditForm(f => ({ ...f, serialNo: e.target.value }))} className="mt-1" />
                  </div>
                </div>

                <div>
                  <Label>備註</Label>
                  <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" rows={2} />
                </div>

                {/* Quick summary */}
                {editForm.purchaseAmount && Number(editForm.purchaseAmount) > 0 && Number(editForm.usefulLifeYears) > 0 && (
                  <div className="rounded-md bg-muted/40 p-3 text-sm grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">月折舊額</p>
                      <p className="font-semibold text-orange-600">
                        {fmt(calcMonthlyDep(Number(editForm.purchaseAmount), Number(editForm.salvageValue || '0'), Number(editForm.usefulLifeYears)))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">年折舊額</p>
                      <p className="font-semibold text-orange-600">
                        {fmt(calcMonthlyDep(Number(editForm.purchaseAmount), Number(editForm.salvageValue || '0'), Number(editForm.usefulLifeYears)) * 12)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">耐用期末殘值</p>
                      <p className="font-semibold">{fmt(Number(editForm.salvageValue || '0'))}</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="schedule">
                {editDepSchedule.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">請先填寫購入日期、金額及耐用年數</p>
                ) : (
                  <>
                    <Card className="mb-3">
                      <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-muted-foreground">折舊排程預覽（直線法，共 {editDepSchedule.length} 期）</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-background">
                              <tr className="border-b text-xs text-muted-foreground">
                                <th className="px-3 py-1.5 text-left">期間</th>
                                <th className="px-3 py-1.5 text-right">期初帳面</th>
                                <th className="px-3 py-1.5 text-right">月折舊額</th>
                                <th className="px-3 py-1.5 text-right">期末帳面</th>
                              </tr>
                            </thead>
                            <tbody>
                              {editDepSchedule.map((row, i) => (
                                <tr key={i} className="border-b">
                                  <td className="px-3 py-1">{row.period}</td>
                                  <td className="px-3 py-1 text-right">{fmt(row.opening)}</td>
                                  <td className="px-3 py-1 text-right text-orange-600">{fmt(row.dep)}</td>
                                  <td className="px-3 py-1 text-right font-medium">{fmt(row.closing)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                    <p className="text-xs text-muted-foreground">* 此為預覽。實際折舊排程在儲存後由系統重新計算。</p>
                  </>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>{dict.common.cancel}</Button>
              <Button onClick={handleEdit} disabled={saving || !editForm.name || !editForm.purchaseDate || !editForm.purchaseAmount}>
                {saving ? dict.common.saving : dict.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Dispose Dialog ── */}
      <Dialog open={disposeDialog} onOpenChange={setDisposeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{dict.fixedAssets.statuses.DISPOSED}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>處分方式</Label>
              <Select value={disposeForm.status} onValueChange={v => setDisposeForm(f => ({ ...f, status: v ?? 'DISPOSED' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISPOSED">處分</SelectItem>
                  <SelectItem value="SCRAPPED">報廢</SelectItem>
                  <SelectItem value="TRANSFERRED">移轉</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>處分日期</Label><Input type="date" value={disposeForm.disposedAt} onChange={e => setDisposeForm(f => ({ ...f, disposedAt: e.target.value }))} className="mt-1" /></div>
            <div><Label>處分金額</Label><Input type="number" value={disposeForm.disposalAmount} onChange={e => setDisposeForm(f => ({ ...f, disposalAmount: e.target.value }))} className="mt-1" /></div>
            <div><Label>備註</Label><Textarea value={disposeForm.notes} onChange={e => setDisposeForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisposeDialog(false)}>{dict.common.cancel}</Button>
            <Button variant="destructive" onClick={handleDispose} disabled={saving}>{dict.common.confirm}{dict.fixedAssets.statuses.DISPOSED}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dict.fixedAssets.newAsset}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>資產名稱 *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
              <div><Label>類別 *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v ?? 'EQUIPMENT' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>購入日期 *</Label><Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} className="mt-1" /></div>
              <div><Label>購入金額 *</Label><Input type="number" value={form.purchaseAmount} onChange={e => setForm(f => ({ ...f, purchaseAmount: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>殘值</Label><Input type="number" value={form.salvageValue} onChange={e => setForm(f => ({ ...f, salvageValue: e.target.value }))} className="mt-1" /></div>
              <div><Label>耐用年數 *</Label><Input type="number" value={form.usefulLifeYears} onChange={e => setForm(f => ({ ...f, usefulLifeYears: e.target.value }))} className="mt-1" /></div>
              <div><Label>折舊法</Label>
                <Select value={form.depreciationMethod} onValueChange={v => setForm(f => ({ ...f, depreciationMethod: v ?? 'SL' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="SL">直線法</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>位置</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="mt-1" /></div>
              <div><Label>序號</Label><Input value={form.serialNo} onChange={e => setForm(f => ({ ...f, serialNo: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>備註</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name || !form.purchaseDate || !form.purchaseAmount}>{dict.fixedAssets.newAsset}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
