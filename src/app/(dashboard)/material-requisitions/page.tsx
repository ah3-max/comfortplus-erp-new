'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Search, MoreHorizontal, Pencil, Loader2,
  CheckCircle2, XCircle, Package, FileText, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

type RequisitionStatus = 'DRAFT' | 'CONFIRMED' | 'ISSUED' | 'COMPLETED' | 'CANCELLED'

interface RequisitionItem {
  id: string; productId: string; productName: string; specification: string | null
  quantity: string; bomVersion: string | null; unit: string | null; memo: string | null
  serialNumber: string | null
  product: { sku: string; name: string; unit: string | null }
}

interface Requisition {
  id: string; requisitionNumber: string; date: string; status: RequisitionStatus
  notes: string | null; createdAt: string
  productionOrderId: string; fromWarehouseId: string; toWarehouseId: string; handlerId: string
  productionOrder: { id: string; productionNo: string }
  fromWarehouse: { id: string; name: string; code: string }
  toWarehouse: { id: string; name: string; code: string }
  handler: { id: string; name: string }
  createdBy: { id: string; name: string }
  items: RequisitionItem[]
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

// ── Form types ──
interface FormItem {
  productId: string; productName: string; specification: string
  quantity: number; bomVersion: string; unit: string; memo: string
}
interface FormData {
  productionOrderId: string; fromWarehouseId: string; toWarehouseId: string
  handlerId: string; date: string; notes: string
  items: FormItem[]
}

const emptyItem: FormItem = { productId: '', productName: '', specification: '', quantity: 1, bomVersion: '', unit: '', memo: '' }
const emptyForm: FormData = {
  productionOrderId: '', fromWarehouseId: '', toWarehouseId: '',
  handlerId: '', date: new Date().toISOString().slice(0, 10), notes: '',
  items: [{ ...emptyItem }],
}

export default function MaterialRequisitionsPage() {
  const { dict } = useI18n()
  const mr = dict.materialRequisitions
  const router = useRouter()
  const searchParams = useSearchParams()

  const statusConfig: Record<RequisitionStatus, {
    label: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
    className?: string
  }> = {
    DRAFT:     { label: dict.materialRequisitions.statuses.DRAFT, variant: 'outline' },
    CONFIRMED: { label: dict.materialRequisitions.statuses.CONFIRMED, variant: 'secondary' },
    ISSUED:    { label: dict.materialRequisitions.statuses.ISSUED, variant: 'default', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    COMPLETED: { label: dict.materialRequisitions.statuses.COMPLETED, variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
    CANCELLED: { label: dict.materialRequisitions.statuses.CANCELLED, variant: 'destructive' },
  }

  const statusFilters = [
    { value: '', label: dict.common.all },
    { value: 'DRAFT', label: dict.materialRequisitions.statuses.DRAFT },
    { value: 'CONFIRMED', label: dict.materialRequisitions.statuses.CONFIRMED },
    { value: 'ISSUED', label: dict.materialRequisitions.statuses.ISSUED },
    { value: 'COMPLETED', label: dict.materialRequisitions.statuses.COMPLETED },
  ]
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
  const [formOpen, setFormOpen] = useState(searchParams.get('action') === 'new')
  const [editTarget, setEditTarget] = useState<Requisition | null>(null)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; unit: string | null }[]>([])
  const [productionOrders, setProductionOrders] = useState<{ id: string; productionNo: string }[]>([])

  const fetchRequisitions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/material-requisitions?${params}`)
      if (!res.ok) throw new Error('載入失敗')
      const result = await res.json()
      setRequisitions(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error(mr.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, page])

  useEffect(() => {
    const t = setTimeout(fetchRequisitions, 300)
    return () => clearTimeout(t)
  }, [fetchRequisitions])

  // Load reference data when form opens
  useEffect(() => {
    if (!formOpen) return
    Promise.all([
      fetch('/api/warehouses?pageSize=100').then(r => r.json()),
      fetch('/api/users?pageSize=100').then(r => r.json()),
      fetch('/api/products?pageSize=500').then(r => r.json()),
      fetch('/api/production').then(r => r.json()),
    ]).then(([wRes, uRes, pRes, poRes]) => {
      setWarehouses((wRes.data ?? wRes) || [])
      setUsers((uRes.data ?? uRes) || [])
      setProducts((pRes.data ?? pRes) || [])
      setProductionOrders((poRes.data ?? poRes) || [])
    }).catch(() => toast.error(mr.refLoadFailed))
  }, [formOpen])

  function openCreate() {
    setEditTarget(null)
    setForm({ ...emptyForm })
    setFormOpen(true)
  }

  function openEdit(req: Requisition) {
    setEditTarget(req)
    setForm({
      productionOrderId: req.productionOrderId,
      fromWarehouseId: req.fromWarehouseId,
      toWarehouseId: req.toWarehouseId,
      handlerId: req.handlerId,
      date: req.date.slice(0, 10),
      notes: req.notes ?? '',
      items: req.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        specification: i.specification ?? '',
        quantity: Number(i.quantity),
        bomVersion: i.bomVersion ?? '',
        unit: i.unit ?? '',
        memo: i.memo ?? '',
      })),
    })
    setFormOpen(true)
  }

  async function handleSubmit() {
    if (!form.productionOrderId) { toast.error(mr.productionOrderRequired); return }
    if (!form.fromWarehouseId) { toast.error(mr.fromWarehouseRequired); return }
    if (!form.toWarehouseId) { toast.error(mr.toWarehouseRequired); return }
    if (form.items.some(i => !i.productId || i.quantity <= 0)) { toast.error(mr.itemsRequired); return }

    setSaving(true)
    try {
      const url = editTarget ? `/api/material-requisitions/${editTarget.id}` : '/api/material-requisitions'
      const method = editTarget ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? '儲存失敗')
      }
      toast.success(editTarget ? mr.savedUpdated : mr.savedCreated)
      setFormOpen(false)
      fetchRequisitions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: string, label: string) {
    const res = await fetch(`/api/material-requisitions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) { toast.success(`${mr.title}${label}`); fetchRequisitions() }
    else toast.error(dict.common.updateFailed)
  }

  async function handleCancel(id: string, no: string) {
    if (!confirm(`確定要取消領料單 ${no} 嗎？`)) return
    const res = await fetch(`/api/material-requisitions/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(mr.cancelSuccess); fetchRequisitions() }
    else {
      const data = await res.json()
      toast.error(data.error ?? '取消失敗')
    }
  }

  function updateItem(idx: number, field: keyof FormItem, value: string | number) {
    setForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      if (field === 'productId') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          items[idx].productName = prod.name
          items[idx].unit = prod.unit ?? ''
        }
      }
      return { ...prev, items }
    })
  }

  function removeItem(idx: number) {
    if (form.items.length <= 1) return
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  const draftCount = requisitions.filter(i => i.status === 'DRAFT').length
  const confirmedCount = requisitions.filter(i => i.status === 'CONFIRMED').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.materialRequisitions.title}管理</h1>
          <p className="text-sm text-muted-foreground">
            共 {pagination ? pagination.total : requisitions.length} 筆
            {draftCount > 0 && <span className="ml-2 text-amber-600">{draftCount} 筆草稿</span>}
            {confirmedCount > 0 && <span className="ml-2 text-blue-600">{confirmedCount} 筆已確認</span>}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />{dict.materialRequisitions.newRequisition}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.materialRequisitions.searchPlaceholder}
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusFilters.map((f) => (
            <button key={f.value} onClick={() => { setFilterStatus(f.value); setPage(1) }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === f.value
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table (desktop) */}
      <div className="hidden md:block rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">{dict.materialRequisitions.requisitionNo}</TableHead>
              <TableHead>{dict.materialRequisitions.productionOrder}</TableHead>
              <TableHead>出料倉</TableHead>
              <TableHead>收料倉</TableHead>
              <TableHead className="w-24">{dict.common.status}</TableHead>
              <TableHead className="w-20 text-center">品項數</TableHead>
              <TableHead className="w-20">{dict.materialRequisitions.requester}</TableHead>
              <TableHead className="w-24">{dict.common.date}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : requisitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {search || filterStatus ? dict.materialRequisitions.noResults : dict.materialRequisitions.noRequisitions}
                    </p>
                    {!search && !filterStatus && (
                      <Button variant="outline" size="sm" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />{dict.materialRequisitions.newRequisition}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              requisitions.map((req) => {
                const sc = statusConfig[req.status] ?? { label: req.status, variant: 'outline' }
                return (
                  <TableRow key={req.id} className="group cursor-pointer hover:bg-slate-50/80"
                    onClick={() => router.push(`/material-requisitions/${req.id}`)}>
                    <TableCell className="font-mono text-sm font-medium">{req.requisitionNumber}</TableCell>
                    <TableCell className="text-sm">{req.productionOrder.productionNo}</TableCell>
                    <TableCell className="text-sm">{req.fromWarehouse.name}</TableCell>
                    <TableCell className="text-sm">{req.toWarehouse.name}</TableCell>
                    <TableCell>
                      <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{req.items.length}</TableCell>
                    <TableCell className="text-sm">{req.handler.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(req.createdAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {req.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => openEdit(req)}>
                              <Pencil className="mr-2 h-4 w-4" />編輯
                            </DropdownMenuItem>
                          )}
                          {req.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => updateStatus(req.id, 'CONFIRMED', '確認')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />確認領料單
                            </DropdownMenuItem>
                          )}
                          {req.status === 'CONFIRMED' && (
                            <DropdownMenuItem onClick={() => updateStatus(req.id, 'ISSUED', '發料')}>
                              <Package className="mr-2 h-4 w-4" />標記已發料
                            </DropdownMenuItem>
                          )}
                          {req.status === 'ISSUED' && (
                            <DropdownMenuItem onClick={() => updateStatus(req.id, 'COMPLETED', '完成')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />標記已完成
                            </DropdownMenuItem>
                          )}
                          {!['ISSUED', 'COMPLETED', 'CANCELLED'].includes(req.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleCancel(req.id, req.requisitionNumber)} variant="destructive">
                                <XCircle className="mr-2 h-4 w-4" />取消領料單
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : requisitions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {search || filterStatus ? dict.materialRequisitions.noResults : dict.materialRequisitions.noRequisitions}
              </p>
            </div>
          </div>
        ) : (
          requisitions.map((req) => {
            const sc = statusConfig[req.status] ?? { label: req.status, variant: 'outline' as const }
            return (
              <div key={req.id}
                className="rounded-lg border bg-white p-4 space-y-2 cursor-pointer active:scale-[0.97] transition-transform"
                onClick={() => router.push(`/material-requisitions/${req.id}`)}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{req.requisitionNumber}</span>
                  <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">工單：{req.productionOrder.productionNo}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(req.createdAt)}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {req.fromWarehouse.name} → {req.toWarehouse.name}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{req.items.length} 項品項</span>
                  <span className="text-muted-foreground">{req.handler.name}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            共 {pagination.total} 筆，第 {pagination.page}/{pagination.totalPages} 頁
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1}
              onClick={() => setPage(p => p - 1)}>
              {dict.common.prevPage}
            </Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}>
              {dict.common.nextPage}
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? `${dict.common.edit}${dict.materialRequisitions.title}` : dict.materialRequisitions.newRequisition}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{dict.materialRequisitions.productionOrder} *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.productionOrderId} onChange={e => setForm(f => ({ ...f, productionOrderId: e.target.value }))}>
                  <option value="">選擇生產工單</option>
                  {productionOrders.map(po => <option key={po.id} value={po.id}>{po.productionNo}</option>)}
                </select>
              </div>
              <div>
                <Label>出料倉庫 *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.fromWarehouseId} onChange={e => setForm(f => ({ ...f, fromWarehouseId: e.target.value }))}>
                  <option value="">選擇出料倉庫</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                </select>
              </div>
              <div>
                <Label>收料倉庫 *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.toWarehouseId} onChange={e => setForm(f => ({ ...f, toWarehouseId: e.target.value }))}>
                  <option value="">選擇收料倉庫</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{dict.materialRequisitions.requester}</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.handlerId} onChange={e => setForm(f => ({ ...f, handlerId: e.target.value }))}>
                  <option value="">選擇承辦人</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{dict.common.date}</Label>
                <Input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">{dict.materialRequisitions.items}</Label>
                <Button variant="outline" size="sm"
                  onClick={() => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }))}>
                  <Plus className="mr-1 h-3 w-3" />新增品項
                </Button>
              </div>
              <div className="space-y-3">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-slate-50">
                    <div className="col-span-12 md:col-span-4">
                      <Label className="text-xs">品項</Label>
                      <select className="w-full rounded-md border px-2 py-1.5 text-sm"
                        value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}>
                        <option value="">選擇品項</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-xs">{dict.common.quantity}</Label>
                      <Input type="number" min={1} value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-xs">BOM版本</Label>
                      <Input value={item.bomVersion}
                        onChange={e => updateItem(idx, 'bomVersion', e.target.value)} />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <Label className="text-xs">{dict.common.unit}</Label>
                      <Input value={item.unit} readOnly className="bg-slate-100" />
                    </div>
                    <div className="col-span-1 md:col-span-2 flex items-end">
                      {form.items.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500"
                          onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>{dict.common.notes}</Label>
              <Textarea value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>{dict.common.cancel}</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editTarget ? dict.common.save : dict.common.create}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
