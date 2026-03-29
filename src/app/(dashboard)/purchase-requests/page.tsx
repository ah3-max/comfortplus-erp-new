'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
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
  CheckCircle2, XCircle, FileText, Trash2, Send, ShoppingCart,
} from 'lucide-react'
import { toast } from 'sonner'

type PRStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ORDERED' | 'CANCELLED'

interface PRItem {
  id: string; productId: string; quantity: string; unitPrice: string | null
  subtotal: string | null; specification: string | null; memo: string | null
  product: { id: string; sku: string; name: string; unit: string | null }
}

interface PurchaseRequest {
  id: string; requestNumber: string; date: string; status: PRStatus
  deliveryDate: string | null; currency: string; reference: string | null; notes: string | null
  createdAt: string
  handler: { id: string; name: string }
  warehouse: { id: string; name: string; code: string }
  items: PRItem[]
  createdBy: { id: string; name: string }
}

interface FormItem {
  productId: string; quantity: number; unitPrice: number; specification: string; memo: string
}

interface FormData {
  handlerId: string; warehouseId: string; deliveryDate: string
  reference: string; notes: string; items: FormItem[]
}

const emptyItem: FormItem = { productId: '', quantity: 1, unitPrice: 0, specification: '', memo: '' }
const emptyForm: FormData = {
  handlerId: '', warehouseId: '', deliveryDate: '',
  reference: '', notes: '', items: [{ ...emptyItem }],
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

export default function PurchaseRequestsPage() {
  const { dict } = useI18n()
  const pr = dict.purchaseRequests

  const statusConfig: Record<PRStatus, {
    label: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
    className?: string
  }> = {
    DRAFT:     { label: dict.purchaseRequests.statuses.DRAFT, variant: 'outline' },
    SUBMITTED: { label: dict.purchaseRequests.statuses.SUBMITTED, variant: 'secondary' },
    APPROVED:  { label: dict.purchaseRequests.statuses.APPROVED, variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
    ORDERED:   { label: dict.purchaseRequests.statuses.ORDERED, variant: 'default', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    CANCELLED: { label: dict.purchaseRequests.statuses.CANCELLED, variant: 'destructive' },
  }

  const statusFilters = [
    { value: '', label: dict.common.all },
    { value: 'DRAFT', label: dict.purchaseRequests.statuses.DRAFT },
    { value: 'SUBMITTED', label: dict.purchaseRequests.statuses.SUBMITTED },
    { value: 'APPROVED', label: dict.purchaseRequests.statuses.APPROVED },
    { value: 'ORDERED', label: dict.purchaseRequests.statuses.ORDERED },
  ]

  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PurchaseRequest | null>(null)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; unit: string | null }[]>([])
  const [convertTarget, setConvertTarget] = useState<PurchaseRequest | null>(null)
  const [convertOpen, setConvertOpen] = useState(false)
  const [convertSupplierId, setConvertSupplierId] = useState('')
  const [convertSuppliers, setConvertSuppliers] = useState<{ id: string; name: string; code: string }[]>([])
  const [converting, setConverting] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/purchase-requests?${params}`)
      if (!res.ok) throw new Error(dict.common.loadFailed)
      const result = await res.json()
      setRequests(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error(pr.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, page])

  useEffect(() => {
    const t = setTimeout(fetchRequests, 300)
    return () => clearTimeout(t)
  }, [fetchRequests])

  // Load reference data when form opens
  useEffect(() => {
    if (!formOpen) return
    Promise.all([
      fetch('/api/warehouses?pageSize=100').then(r => r.json()),
      fetch('/api/users?pageSize=100').then(r => r.json()),
      fetch('/api/products?pageSize=500').then(r => r.json()),
    ]).then(([wRes, uRes, pRes]) => {
      setWarehouses((wRes.data ?? wRes) || [])
      setUsers((uRes.data ?? uRes) || [])
      setProducts((pRes.data ?? pRes) || [])
    }).catch(() => toast.error(pr.refLoadFailed))
  }, [formOpen])

  function openCreate() {
    setEditTarget(null)
    setForm({ ...emptyForm })
    setFormOpen(true)
  }

  function openEdit(pr: PurchaseRequest) {
    setEditTarget(pr)
    setForm({
      handlerId: pr.handler.id,
      warehouseId: pr.warehouse.id,
      deliveryDate: pr.deliveryDate ? pr.deliveryDate.slice(0, 10) : '',
      reference: pr.reference ?? '',
      notes: pr.notes ?? '',
      items: pr.items.map(i => ({
        productId: i.productId,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice ?? 0),
        specification: i.specification ?? '',
        memo: i.memo ?? '',
      })),
    })
    setFormOpen(true)
  }

  async function handleSubmit() {
    if (!form.handlerId) { toast.error(pr.handlerRequired); return }
    if (!form.warehouseId) { toast.error(pr.warehouseRequired); return }
    if (form.items.some(i => !i.productId || i.quantity <= 0)) { toast.error(pr.itemsRequired); return }

    setSaving(true)
    try {
      const url = editTarget ? `/api/purchase-requests/${editTarget.id}` : '/api/purchase-requests'
      const method = editTarget ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? dict.common.saveFailed)
      }
      toast.success(editTarget ? pr.savedUpdated : pr.savedCreated)
      setFormOpen(false)
      fetchRequests()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.common.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: string, label: string) {
    const res = await fetch(`/api/purchase-requests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) { toast.success(`${pr.title}${label}`); fetchRequests() }
    else toast.error(dict.common.updateFailed)
  }

  async function handleCancel(id: string, no: string) {
    if (!confirm(`${dict.common.deleteConfirm} (${no})`)) return
    const res = await fetch(`/api/purchase-requests/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(pr.cancelSuccess); fetchRequests() }
    else {
      const data = await res.json()
      toast.error(data.error ?? dict.common.operationFailed)
    }
  }

  function updateItem(idx: number, field: keyof FormItem, value: string | number) {
    setForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      return { ...prev, items }
    })
  }

  function removeItem(idx: number) {
    if (form.items.length <= 1) return
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  async function openConvertDialog(req: PurchaseRequest) {
    setConvertTarget(req)
    setConvertSupplierId('')
    setConvertOpen(true)
    try {
      const res = await fetch('/api/suppliers?showAll=true')
      const data = await res.json()
      setConvertSuppliers(Array.isArray(data) ? data : (data.data ?? []))
    } catch {
      toast.error(pr.supplierLoadFailed)
    }
  }

  async function handleConvertToPurchase() {
    if (!convertTarget) return
    if (!convertSupplierId) { toast.error(pr.supplierRequired); return }
    setConverting(true)
    try {
      // 1. Create purchase order first (so status only changes on success)
      const items = convertTarget.items.map(i => ({
        productId: i.product.id,
        quantity: Number(i.quantity),
        unitCost: Number(i.unitPrice ?? 0),
      }))

      const poRes = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: convertSupplierId,
          orderType: 'FINISHED_GOODS',
          notes: `${pr.convertDialogTitle}: ${convertTarget.requestNumber}`,
          items,
        }),
      })
      if (!poRes.ok) throw new Error(dict.common.createFailed)
      const poData = await poRes.json()

      // 2. Only update PR status after PO is created successfully
      const statusRes = await fetch(`/api/purchase-requests/${convertTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusOnly: true, status: 'ORDERED' }),
      })
      if (!statusRes.ok) throw new Error(dict.common.updateFailed)

      toast.success(`${poData.poNo}`)
      setConvertOpen(false)
      fetchRequests()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : pr.convertFailed)
    } finally {
      setConverting(false)
    }
  }

  const draftCount = requests.filter(r => r.status === 'DRAFT').length
  const submittedCount = requests.filter(r => r.status === 'SUBMITTED').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.purchaseRequests.title}</h1>
          <p className="text-sm text-muted-foreground">
            {pagination ? pagination.total : requests.length}
            {draftCount > 0 && <span className="ml-2 text-amber-600">{draftCount} {pr.draftCount}</span>}
            {submittedCount > 0 && <span className="ml-2 text-blue-600">{submittedCount} {pr.pendingApprovalCount}</span>}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />{dict.purchaseRequests.newRequest}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.purchaseRequests.searchPlaceholder}
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
              <TableHead className="w-40">{dict.purchaseRequests.requestNo}</TableHead>
              <TableHead>{pr.handler}</TableHead>
              <TableHead>{dict.common.warehouse}</TableHead>
              <TableHead className="w-24">{dict.purchaseRequests.requiredDate}</TableHead>
              <TableHead className="w-20 text-center">{pr.itemCount}</TableHead>
              <TableHead className="w-24">{dict.common.status}</TableHead>
              <TableHead className="w-24">{dict.common.date}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {search || filterStatus ? dict.purchaseRequests.noResults : dict.purchaseRequests.noRequests}
                    </p>
                    {!search && !filterStatus && (
                      <Button variant="outline" size="sm" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />{dict.purchaseRequests.newRequest}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              requests.map((pr) => {
                const sc = statusConfig[pr.status] ?? { label: pr.status, variant: 'outline' }
                return (
                  <TableRow key={pr.id} className="group hover:bg-slate-50/80">
                    <TableCell className="font-mono text-sm font-medium">{pr.requestNumber}</TableCell>
                    <TableCell className="font-medium">{pr.handler.name}</TableCell>
                    <TableCell className="text-sm">{pr.warehouse.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {pr.deliveryDate ? formatDate(pr.deliveryDate) : '--'}
                    </TableCell>
                    <TableCell className="text-center">{pr.items.length}</TableCell>
                    <TableCell>
                      <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(pr.createdAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {pr.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => openEdit(pr)}>
                              <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}
                            </DropdownMenuItem>
                          )}
                          {pr.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => updateStatus(pr.id, 'SUBMITTED', dict.purchaseRequests.submitForReview)}>
                              <Send className="mr-2 h-4 w-4" />{dict.purchaseRequests.submitForReview}
                            </DropdownMenuItem>
                          )}
                          {pr.status === 'SUBMITTED' && (
                            <DropdownMenuItem onClick={() => updateStatus(pr.id, 'APPROVED', dict.purchaseRequests.approve)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />{dict.purchaseRequests.approve}
                            </DropdownMenuItem>
                          )}
                          {pr.status === 'APPROVED' && (
                            <DropdownMenuItem onClick={() => openConvertDialog(pr)}>
                              <ShoppingCart className="mr-2 h-4 w-4" />{dict.purchaseRequests.convertToPurchase}
                            </DropdownMenuItem>
                          )}
                          {['DRAFT', 'SUBMITTED'].includes(pr.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleCancel(pr.id, pr.requestNumber)} variant="destructive">
                                <XCircle className="mr-2 h-4 w-4" />{dict.purchaseRequests.cancelRequest}
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
        ) : requests.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {search || filterStatus ? dict.purchaseRequests.noResults : dict.purchaseRequests.noRequests}
              </p>
            </div>
          </div>
        ) : (
          requests.map((pr) => {
            const sc = statusConfig[pr.status] ?? { label: pr.status, variant: 'outline' as const }
            return (
              <div key={pr.id}
                className="rounded-lg border bg-white p-4 space-y-2 active:scale-[0.97] transition-transform">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{pr.requestNumber}</span>
                  <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{pr.handler.name}</span>
                  <span className="text-sm text-muted-foreground">{pr.warehouse.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{pr.items.length} {dict.purchaseRequests.itemCount}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(pr.createdAt)}</span>
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
            {pagination.total} — {dict.common.pagePrefix}{pagination.page}/{pagination.totalPages}{dict.common.pageSuffix}
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
            <DialogTitle>{editTarget ? `${dict.common.edit}${dict.purchaseRequests.title}` : dict.purchaseRequests.newRequest}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{dict.purchaseRequests.handler} *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.handlerId} onChange={e => setForm(f => ({ ...f, handlerId: e.target.value }))}>
                  <option value="">{dict.common.select}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{dict.common.warehouse} *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))}>
                  <option value="">{dict.common.select}</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{dict.purchaseRequests.requiredDate}</Label>
                <Input type="date" value={form.deliveryDate}
                  onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">{dict.purchaseRequests.items}</Label>
                <Button variant="outline" size="sm"
                  onClick={() => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }))}>
                  <Plus className="mr-1 h-3 w-3" />{dict.common.add}
                </Button>
              </div>
              <div className="space-y-3">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-slate-50">
                    <div className="col-span-12 md:col-span-4">
                      <Label className="text-xs">{dict.common.product}</Label>
                      <select className="w-full rounded-md border px-2 py-1.5 text-sm"
                        value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}>
                        <option value="">{dict.common.select}</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-xs">{dict.common.quantity}</Label>
                      <Input type="number" min={1} value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-xs">{pr.estimatedUnitPrice}</Label>
                      <Input type="number" min={0} step={0.01} value={item.unitPrice}
                        onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} />
                    </div>
                    <div className="col-span-3 md:col-span-3">
                      <Label className="text-xs">{pr.specNotes}</Label>
                      <Input value={item.specification}
                        onChange={e => updateItem(idx, 'specification', e.target.value)} placeholder={dict.common.optional} />
                    </div>
                    <div className="col-span-1 flex items-end">
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

      {/* Convert to Purchase Order Dialog */}
      <Dialog open={convertOpen} onOpenChange={o => !o && setConvertOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pr.convertDialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-mono font-medium text-slate-700">{convertTarget?.requestNumber}</span> {pr.convertDialogDesc} {convertTarget?.items.length ?? 0} {pr.convertDialogItems}
            </p>
            <div className="space-y-1.5">
              <Label>{dict.common.supplier} *</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={convertSupplierId}
                onChange={e => setConvertSupplierId(e.target.value)}
              >
                <option value="">{pr.selectSupplier}</option>
                {convertSuppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConvertOpen(false)} disabled={converting}>{dict.common.cancel}</Button>
            <Button onClick={handleConvertToPurchase} disabled={converting}>
              {converting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ShoppingCart className="mr-2 h-4 w-4" />{pr.confirmConvert}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
