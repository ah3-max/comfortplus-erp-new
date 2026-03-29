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
  CheckCircle2, XCircle, FileText, Trash2, Send, MessageSquare, ShoppingCart,
} from 'lucide-react'
import { DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

type RFQStatus = 'DRAFT' | 'SENT' | 'RESPONDED' | 'COMPLETED' | 'CANCELLED'

interface RFQItem {
  id: string; productId: string; quantity: string; specification: string | null
  product: { id: string; sku: string; name: string; unit: string | null }
}

interface RFQSupplier {
  id: string; supplierId: string; quotedPrice: string | null; responseDate: string | null; selected: boolean
  supplier: { id: string; name: string; code: string }
}

interface RFQ {
  id: string; rfqNumber: string; date: string; status: RFQStatus
  validUntil: string | null; notes: string | null; createdAt: string
  items: RFQItem[]
  suppliers: RFQSupplier[]
}

interface FormItem {
  productId: string; quantity: number; specification: string
}

interface FormData {
  handlerId: string; validUntil: string; notes: string
  items: FormItem[]; supplierIds: string[]
}

const emptyItem: FormItem = { productId: '', quantity: 1, specification: '' }
const emptyForm: FormData = {
  handlerId: '', validUntil: '', notes: '',
  items: [{ ...emptyItem }], supplierIds: [],
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

export default function RFQPage() {
  const { dict } = useI18n()

  const statusConfig: Record<RFQStatus, {
    label: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
    className?: string
  }> = {
    DRAFT:     { label: dict.rfq.statuses.DRAFT, variant: 'outline' },
    SENT:      { label: dict.rfq.statuses.SENT, variant: 'secondary' },
    RESPONDED: { label: dict.rfq.statuses.RESPONDED, variant: 'default', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    COMPLETED: { label: dict.rfq.statuses.COMPLETED, variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
    CANCELLED: { label: dict.rfq.statuses.CANCELLED, variant: 'destructive' },
  }

  const statusFilters = [
    { value: '', label: dict.common.all },
    { value: 'DRAFT', label: dict.rfq.statuses.DRAFT },
    { value: 'SENT', label: dict.rfq.statuses.SENT },
    { value: 'RESPONDED', label: dict.rfq.statuses.RESPONDED },
    { value: 'COMPLETED', label: dict.rfq.statuses.COMPLETED },
  ]

  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RFQ | null>(null)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; unit: string | null }[]>([])
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; code: string }[]>([])

  // Convert to PO dialog
  const [convertOpen, setConvertOpen] = useState(false)
  const [convertTarget, setConvertTarget] = useState<RFQ | null>(null)
  const [convertSupplierId, setConvertSupplierId] = useState('')
  const [converting, setConverting] = useState(false)

  const fetchRfqs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/rfq?${params}`)
      if (!res.ok) throw new Error(dict.common.loadFailed)
      const result = await res.json()
      setRfqs(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error(dict.rfq.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, page])

  useEffect(() => {
    const t = setTimeout(fetchRfqs, 300)
    return () => clearTimeout(t)
  }, [fetchRfqs])

  // Load reference data when form opens
  useEffect(() => {
    if (!formOpen) return
    Promise.all([
      fetch('/api/users?pageSize=100').then(r => r.json()),
      fetch('/api/products?pageSize=500').then(r => r.json()),
      fetch('/api/suppliers?showAll=true').then(r => r.json()),
    ]).then(([uRes, pRes, sRes]) => {
      setUsers(Array.isArray(uRes) ? uRes : (uRes.data ?? []))
      setProducts(Array.isArray(pRes) ? pRes : (pRes.data ?? []))
      setSuppliers(Array.isArray(sRes) ? sRes : (sRes.data ?? []))
    }).catch(() => toast.error(dict.common.refLoadFailed))
  }, [formOpen])

  function openCreate() {
    setEditTarget(null)
    setForm({ ...emptyForm })
    setFormOpen(true)
  }

  function openEdit(rfq: RFQ) {
    setEditTarget(rfq)
    setForm({
      handlerId: '',
      validUntil: rfq.validUntil ? rfq.validUntil.slice(0, 10) : '',
      notes: rfq.notes ?? '',
      items: rfq.items.map(i => ({
        productId: i.productId,
        quantity: Number(i.quantity),
        specification: i.specification ?? '',
      })),
      supplierIds: rfq.suppliers.map(s => s.supplierId),
    })
    setFormOpen(true)
  }

  async function handleSubmit() {
    if (form.items.some(i => !i.productId || i.quantity <= 0)) { toast.error(dict.common.itemsRequired); return }

    setSaving(true)
    try {
      const url = editTarget ? `/api/rfq/${editTarget.id}` : '/api/rfq'
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
      toast.success(editTarget ? dict.common.updateSuccess : dict.common.createSuccess)
      setFormOpen(false)
      fetchRfqs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.common.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: string, label: string) {
    const res = await fetch(`/api/rfq/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) { toast.success(label); fetchRfqs() }
    else toast.error(dict.common.updateFailed)
  }

  async function handleCancel(id: string, no: string) {
    if (!confirm(`${dict.rfq.cancelConfirm} ${no}?`)) return
    const res = await fetch(`/api/rfq/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.rfq.cancelSuccess); fetchRfqs() }
    else {
      const data = await res.json()
      toast.error(data.error ?? dict.common.operationFailed)
    }
  }

  function openConvert(rfq: RFQ) {
    setConvertTarget(rfq)
    // Pre-select the first selected supplier, or first supplier
    const selected = rfq.suppliers.find(s => s.selected)
    setConvertSupplierId(selected?.supplierId ?? rfq.suppliers[0]?.supplierId ?? '')
    setConvertOpen(true)
  }

  async function handleConvertToPO() {
    if (!convertTarget || !convertSupplierId) { toast.error(dict.rfq.supplierRequired); return }
    setConverting(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: convertSupplierId,
          items: convertTarget.items.map(i => {
            const rfqSupplier = convertTarget.suppliers.find(s => s.supplierId === convertSupplierId)
            return {
              productId: i.productId,
              quantity: Number(i.quantity),
              unitCost: Number(rfqSupplier?.quotedPrice ?? 0),
            }
          }),
          notes: `${dict.rfq.convertedFromPrefix} ${convertTarget.rfqNumber}`,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? dict.common.createFailed)
      }
      const po = await res.json()
      toast.success(`${dict.rfq.poCreated} ${po.poNo}`)
      setConvertOpen(false)
      // Mark RFQ as COMPLETED if not already
      if (convertTarget.status !== 'COMPLETED') {
        await updateStatus(convertTarget.id, 'COMPLETED', dict.common.createSuccess)
      } else {
        fetchRfqs()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.common.createFailed)
    } finally {
      setConverting(false)
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

  function toggleSupplier(supplierId: string) {
    setForm(prev => ({
      ...prev,
      supplierIds: prev.supplierIds.includes(supplierId)
        ? prev.supplierIds.filter(id => id !== supplierId)
        : [...prev.supplierIds, supplierId],
    }))
  }

  const draftCount = rfqs.filter(r => r.status === 'DRAFT').length
  const sentCount = rfqs.filter(r => r.status === 'SENT').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.rfq.title}</h1>
          <p className="text-sm text-muted-foreground">
            {dict.rfq.totalPrefix} {pagination ? pagination.total : rfqs.length} {dict.common.items}
            {draftCount > 0 && <span className="ml-2 text-amber-600">{draftCount} {dict.common.items}{dict.rfq.statuses.DRAFT}</span>}
            {sentCount > 0 && <span className="ml-2 text-blue-600">{sentCount} {dict.common.items}{dict.rfq.statuses.SENT}</span>}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />{dict.rfq.newRfq}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.rfq.searchPlaceholder}
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
              <TableHead className="w-40">{dict.rfq.rfqNo}</TableHead>
              <TableHead className="w-28">{dict.rfq.dueDate}</TableHead>
              <TableHead>{dict.rfq.items}</TableHead>
              <TableHead className="w-20 text-center">{dict.common.supplier}</TableHead>
              <TableHead className="w-24">{dict.common.status}</TableHead>
              <TableHead className="w-24">{dict.common.date}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : rfqs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {search || filterStatus ? dict.rfq.noResults : dict.rfq.noRfqs}
                    </p>
                    {!search && !filterStatus && (
                      <Button variant="outline" size="sm" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />{dict.rfq.newRfq}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rfqs.map((rfq) => {
                const sc = statusConfig[rfq.status] ?? { label: rfq.status, variant: 'outline' }
                return (
                  <TableRow key={rfq.id} className="group hover:bg-slate-50/80">
                    <TableCell className="font-mono text-sm font-medium">{rfq.rfqNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rfq.validUntil ? formatDate(rfq.validUntil) : '--'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rfq.items.length > 0
                        ? `${rfq.items[0].product.name}${rfq.items.length > 1 ? ` ${dict.rfq.itemsEtc.replace('{n}', String(rfq.items.length))}` : ''}`
                        : '--'}
                    </TableCell>
                    <TableCell className="text-center">{rfq.suppliers.length}</TableCell>
                    <TableCell>
                      <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(rfq.createdAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {rfq.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => openEdit(rfq)}>
                              <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}
                            </DropdownMenuItem>
                          )}
                          {rfq.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => updateStatus(rfq.id, 'SENT', dict.rfq.actionSent)}>
                              <Send className="mr-2 h-4 w-4" />{dict.rfq.actionSendRfq}
                            </DropdownMenuItem>
                          )}
                          {rfq.status === 'SENT' && (
                            <DropdownMenuItem onClick={() => updateStatus(rfq.id, 'RESPONDED', dict.rfq.actionResponded)}>
                              <MessageSquare className="mr-2 h-4 w-4" />{dict.rfq.actionMarkResponded}
                            </DropdownMenuItem>
                          )}
                          {rfq.status === 'RESPONDED' && (
                            <DropdownMenuItem onClick={() => updateStatus(rfq.id, 'COMPLETED', dict.rfq.actionCompleted)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />{dict.rfq.actionComplete}
                            </DropdownMenuItem>
                          )}
                          {['RESPONDED', 'COMPLETED'].includes(rfq.status) && rfq.suppliers.length > 0 && (
                            <DropdownMenuItem onClick={() => openConvert(rfq)}>
                              <ShoppingCart className="mr-2 h-4 w-4" />{dict.rfq.convertToPO}
                            </DropdownMenuItem>
                          )}
                          {['DRAFT', 'SENT'].includes(rfq.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleCancel(rfq.id, rfq.rfqNumber)} variant="destructive">
                                <XCircle className="mr-2 h-4 w-4" />{dict.rfq.cancelRfq}
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
        ) : rfqs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {search || filterStatus ? dict.rfq.noResults : dict.rfq.noRfqs}
              </p>
            </div>
          </div>
        ) : (
          rfqs.map((rfq) => {
            const sc = statusConfig[rfq.status] ?? { label: rfq.status, variant: 'outline' as const }
            return (
              <div key={rfq.id}
                className="rounded-lg border bg-white p-4 space-y-2 active:scale-[0.97] transition-transform">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{rfq.rfqNumber}</span>
                  <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {rfq.items.length > 0
                    ? `${rfq.items[0].product.name}${rfq.items.length > 1 ? ` ${dict.rfq.itemsEtc.replace('{n}', String(rfq.items.length))}` : ''}`
                    : '--'}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{rfq.suppliers.length} {dict.rfq.supplierCount}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(rfq.createdAt)}</span>
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
            {dict.rfq.totalPrefix} {pagination.total} {dict.common.items}，{dict.rfq.pageInfo.replace('{page}', String(pagination.page)).replace('{totalPages}', String(pagination.totalPages))}
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
            <DialogTitle>{editTarget ? `${dict.common.edit}${dict.rfq.title}` : dict.rfq.newRfq}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{dict.rfq.handlerLabel}</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.handlerId} onChange={e => setForm(f => ({ ...f, handlerId: e.target.value }))}>
                  <option value="">{dict.common.select}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{dict.rfq.dueDate}</Label>
                <Input type="date" value={form.validUntil}
                  onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
              </div>
            </div>

            {/* Suppliers */}
            <div>
              <Label className="text-base font-semibold">{dict.common.supplier}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {suppliers.map(s => (
                  <button key={s.id} onClick={() => toggleSupplier(s.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      form.supplierIds.includes(s.id)
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}>
                    {s.code} - {s.name}
                  </button>
                ))}
                {suppliers.length === 0 && (
                  <p className="text-sm text-muted-foreground">{dict.common.noRecords}</p>
                )}
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">{dict.rfq.items}</Label>
                <Button variant="outline" size="sm"
                  onClick={() => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }))}>
                  <Plus className="mr-1 h-3 w-3" />{dict.common.add}
                </Button>
              </div>
              <div className="space-y-3">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-slate-50">
                    <div className="col-span-12 md:col-span-5">
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
                    <div className="col-span-7 md:col-span-4">
                      <Label className="text-xs">{dict.rfq.specLabel}</Label>
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

      {/* Convert to PO Dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dict.rfq.convertToPO}</DialogTitle></DialogHeader>
          {convertTarget && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{dict.rfq.rfqNo}：<span className="font-mono font-medium text-slate-800">{convertTarget.rfqNumber}</span></p>
                <p className="text-sm text-muted-foreground">{dict.rfq.items}：{convertTarget.items.length} {dict.common.pieces}</p>
              </div>
              <div>
                <Label>{dict.common.supplier} *</Label>
                <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={convertSupplierId}
                  onChange={e => setConvertSupplierId(e.target.value)}>
                  <option value="">— {dict.common.select} —</option>
                  {convertTarget.suppliers.map(s => (
                    <option key={s.supplierId} value={s.supplierId}>
                      {s.supplier.name} ({s.supplier.code})
                      {s.quotedPrice ? ` — ${dict.rfq.quotedPrice} ${Number(s.quotedPrice).toLocaleString()}` : ''}
                      {s.selected ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600 mb-2">{dict.rfq.items}</p>
                {convertTarget.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm py-0.5">
                    <span>{item.product.name}</span>
                    <span className="text-muted-foreground">× {Number(item.quantity)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{dict.rfq.convertNote}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleConvertToPO} disabled={converting || !convertSupplierId}>
              {converting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ShoppingCart className="mr-2 h-4 w-4" />{dict.rfq.createPO}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
