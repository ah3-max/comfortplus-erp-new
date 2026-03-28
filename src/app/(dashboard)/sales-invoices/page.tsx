'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
  CheckCircle2, XCircle, Truck, FileText, Trash2, Download,
} from 'lucide-react'
import { toast } from 'sonner'

type InvoiceStatus = 'DRAFT' | 'CONFIRMED' | 'SHIPPED' | 'RETURNED' | 'CANCELLED'

interface InvoiceItem {
  id: string; productId: string; productName: string; specification: string | null
  quantity: string; unitPrice: string; unitPriceTax: string
  subtotal: string; taxAmount: string; totalAmount: string
  unit: string | null; memo: string | null; serialNumber: string | null
  product: { sku: string; name: string; unit: string | null }
}

interface Invoice {
  id: string; invoiceNumber: string; date: string; status: InvoiceStatus
  subtotal: string; taxAmount: string; totalAmount: string
  transactionType: string; notes: string | null; createdAt: string
  customerId: string; salesPersonId: string; handlerId: string; warehouseId: string
  receiverName: string | null; shippingAddress: string | null; phone: string | null; shippingNote: string | null
  sourceOrderId: string | null
  customer: { id: string; name: string; code: string }
  salesPerson: { id: string; name: string }
  handler: { id: string; name: string }
  warehouse: { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
  sourceOrder: { id: string; orderNo: string } | null
  items: InvoiceItem[]
}

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(val))
}
function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

// ── Form types ──
interface FormItem {
  productId: string; productName: string; specification: string
  quantity: number; unitPrice: number; unit: string; memo: string; serialNumber: string
}
interface FormData {
  customerId: string; salesPersonId: string; handlerId: string; warehouseId: string
  transactionType: string; date: string
  receiverName: string; shippingAddress: string; phone: string; shippingNote: string; notes: string
  sourceOrderId: string
  items: FormItem[]
}

const emptyItem: FormItem = { productId: '', productName: '', specification: '', quantity: 1, unitPrice: 0, unit: '', memo: '', serialNumber: '' }
const emptyForm: FormData = {
  customerId: '', salesPersonId: '', handlerId: '', warehouseId: '',
  transactionType: 'TAX', date: new Date().toISOString().slice(0, 10),
  receiverName: '', shippingAddress: '', phone: '', shippingNote: '', notes: '',
  sourceOrderId: '', items: [{ ...emptyItem }],
}

export default function SalesInvoicesPage() {
  const { dict } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()

  const statusConfig: Record<InvoiceStatus, {
    label: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
    className?: string
  }> = {
    DRAFT:     { label: dict.salesInvoices.statuses.DRAFT, variant: 'outline' },
    CONFIRMED: { label: '已確認', variant: 'secondary' },
    SHIPPED:   { label: '已出貨', variant: 'default', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    RETURNED:  { label: '已退貨', variant: 'default', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    CANCELLED: { label: dict.salesInvoices.statuses.CANCELLED, variant: 'destructive' },
  }

  const statusFilters = [
    { value: '', label: dict.common.all },
    { value: 'DRAFT', label: dict.salesInvoices.statuses.DRAFT },
    { value: 'CONFIRMED', label: '已確認' },
    { value: 'SHIPPED', label: '已出貨' },
    { value: 'RETURNED', label: '已退貨' },
  ]
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
  const [formOpen, setFormOpen] = useState(searchParams.get('action') === 'new')
  const [editTarget, setEditTarget] = useState<Invoice | null>(null)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<{ id: string; name: string; code: string }[]>([])
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; unit: string | null; sellingPrice: string | null }[]>([])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/sales-invoices?${params}`)
      if (!res.ok) throw new Error('載入失敗')
      const result = await res.json()
      setInvoices(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error('銷貨單載入失敗')
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, page])

  useEffect(() => {
    const t = setTimeout(fetchInvoices, 300)
    return () => clearTimeout(t)
  }, [fetchInvoices])

  // Load reference data when form opens
  useEffect(() => {
    if (!formOpen) return
    Promise.all([
      fetch('/api/customers?pageSize=500').then(r => r.json()),
      fetch('/api/warehouses?pageSize=100').then(r => r.json()),
      fetch('/api/users?pageSize=100').then(r => r.json()),
      fetch('/api/products?pageSize=500').then(r => r.json()),
    ]).then(([cRes, wRes, uRes, pRes]) => {
      setCustomers((cRes.data ?? cRes) || [])
      setWarehouses((wRes.data ?? wRes) || [])
      setUsers((uRes.data ?? uRes) || [])
      setProducts((pRes.data ?? pRes) || [])
    }).catch(() => toast.error('載入參考資料失敗'))
  }, [formOpen])

  function openCreate() {
    setEditTarget(null)
    setForm({ ...emptyForm })
    setFormOpen(true)
  }

  function openEdit(inv: Invoice) {
    setEditTarget(inv)
    setForm({
      customerId: inv.customerId,
      salesPersonId: inv.salesPersonId,
      handlerId: inv.handlerId,
      warehouseId: inv.warehouseId,
      transactionType: inv.transactionType,
      date: inv.date.slice(0, 10),
      receiverName: inv.receiverName ?? '',
      shippingAddress: inv.shippingAddress ?? '',
      phone: inv.phone ?? '',
      shippingNote: inv.shippingNote ?? '',
      notes: inv.notes ?? '',
      sourceOrderId: inv.sourceOrderId ?? '',
      items: inv.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        specification: i.specification ?? '',
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        unit: i.unit ?? '',
        memo: i.memo ?? '',
        serialNumber: i.serialNumber ?? '',
      })),
    })
    setFormOpen(true)
  }

  async function handleSubmit() {
    if (!form.customerId) { toast.error('請選擇客戶'); return }
    if (!form.warehouseId) { toast.error('請選擇倉庫'); return }
    if (form.items.some(i => !i.productId || i.quantity <= 0)) { toast.error('請確認品項資料'); return }

    setSaving(true)
    try {
      const url = editTarget ? `/api/sales-invoices/${editTarget.id}` : '/api/sales-invoices'
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
      toast.success(editTarget ? '銷貨單已更新' : '銷貨單已建立')
      setFormOpen(false)
      fetchInvoices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: string, label: string) {
    const res = await fetch(`/api/sales-invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) { toast.success(`銷貨單已${label}`); fetchInvoices() }
    else toast.error('更新失敗')
  }

  async function handleCancel(id: string, no: string) {
    if (!confirm(`確定要取消銷貨單 ${no} 嗎？`)) return
    const res = await fetch(`/api/sales-invoices/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('銷貨單已取消'); fetchInvoices() }
    else {
      const data = await res.json()
      toast.error(data.error ?? '取消失敗')
    }
  }

  function updateItem(idx: number, field: keyof FormItem, value: string | number) {
    setForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      // Auto-fill product name when product selected
      if (field === 'productId') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          items[idx].productName = prod.name
          items[idx].unit = prod.unit ?? ''
          if (prod.sellingPrice) items[idx].unitPrice = Number(prod.sellingPrice)
        }
      }
      return { ...prev, items }
    })
  }

  function removeItem(idx: number) {
    if (form.items.length <= 1) return
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  const draftCount = invoices.filter(i => i.status === 'DRAFT').length
  const confirmedCount = invoices.filter(i => i.status === 'CONFIRMED').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.salesInvoices.title}</h1>
          <p className="text-sm text-muted-foreground">
            共 {pagination ? pagination.total : invoices.length} 筆
            {draftCount > 0 && <span className="ml-2 text-amber-600">{draftCount} 筆草稿</span>}
            {confirmedCount > 0 && <span className="ml-2 text-blue-600">{confirmedCount} 筆已確認</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (filterStatus) params.set('status', filterStatus)
            window.open(`/api/sales-invoices/export?${params}`, '_blank')
          }}>
            <Download className="mr-2 h-4 w-4" />{dict.common.exportExcel}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />{dict.salesInvoices.newInvoice}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.salesInvoices.searchPlaceholder}
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
              <TableHead className="w-40">{dict.salesInvoices.invoiceNo}</TableHead>
              <TableHead>{dict.common.customer}</TableHead>
              <TableHead className="w-24">{dict.common.status}</TableHead>
              <TableHead>商品摘要</TableHead>
              <TableHead className="text-right w-28">稅前</TableHead>
              <TableHead className="text-right w-28">含稅金額</TableHead>
              <TableHead className="w-20">{dict.common.salesRep}</TableHead>
              <TableHead className="w-20">來源訂單</TableHead>
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
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {search || filterStatus ? dict.salesInvoices.noResults : dict.salesInvoices.noInvoices}
                    </p>
                    {!search && !filterStatus && (
                      <Button variant="outline" size="sm" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />{dict.salesInvoices.newInvoice}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const sc = statusConfig[inv.status] ?? { label: inv.status, variant: 'outline' }
                return (
                  <TableRow key={inv.id} className="group cursor-pointer hover:bg-slate-50/80"
                    onClick={() => router.push(`/sales-invoices/${inv.id}`)}>
                    <TableCell className="font-mono text-sm font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{inv.customer.name}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.items.length > 0
                        ? `${inv.items[0].product.name}${inv.items.length > 1 ? ` 等 ${inv.items.length} 項` : ''}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.subtotal)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.totalAmount)}</TableCell>
                    <TableCell className="text-sm">{inv.salesPerson.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                      {inv.sourceOrder ? (
                        <Link href={`/orders/${inv.sourceOrder.id}`} className="text-blue-600 hover:underline">
                          {inv.sourceOrder.orderNo}
                        </Link>
                      ) : '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {inv.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => openEdit(inv)}>
                              <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}
                            </DropdownMenuItem>
                          )}
                          {inv.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => updateStatus(inv.id, 'CONFIRMED', '確認')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />確認銷貨單
                            </DropdownMenuItem>
                          )}
                          {inv.status === 'CONFIRMED' && (
                            <DropdownMenuItem onClick={() => updateStatus(inv.id, 'SHIPPED', '出貨')}>
                              <Truck className="mr-2 h-4 w-4" />標記已出貨
                            </DropdownMenuItem>
                          )}
                          {!['SHIPPED', 'CANCELLED', 'RETURNED'].includes(inv.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleCancel(inv.id, inv.invoiceNumber)} variant="destructive">
                                <XCircle className="mr-2 h-4 w-4" />取消銷貨單
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
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {search || filterStatus ? dict.salesInvoices.noResults : dict.salesInvoices.noInvoices}
              </p>
            </div>
          </div>
        ) : (
          invoices.map((inv) => {
            const sc = statusConfig[inv.status] ?? { label: inv.status, variant: 'outline' as const }
            return (
              <div key={inv.id}
                className="rounded-lg border bg-white p-4 space-y-2 cursor-pointer active:scale-[0.97] transition-transform"
                onClick={() => router.push(`/sales-invoices/${inv.id}`)}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{inv.invoiceNumber}</span>
                  <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{inv.customer.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {inv.items.length > 0
                    ? `${inv.items[0].product.name}${inv.items.length > 1 ? ` 等 ${inv.items.length} 項` : ''}`
                    : '—'}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{formatCurrency(inv.totalAmount)}</span>
                  <span className="text-muted-foreground">{inv.salesPerson.name}</span>
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
            <DialogTitle>{editTarget ? `${dict.common.edit}${dict.salesInvoices.title}` : dict.salesInvoices.newInvoice}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{dict.common.customer} *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                  <option value="">{dict.common.select}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
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
                <Label>{dict.common.date}</Label>
                <Input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{dict.common.salesRep}</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.salesPersonId} onChange={e => setForm(f => ({ ...f, salesPersonId: e.target.value }))}>
                  <option value="">{dict.common.select}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <Label>承辦人</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.handlerId} onChange={e => setForm(f => ({ ...f, handlerId: e.target.value }))}>
                  <option value="">{dict.common.select}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <Label>交易類型</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.transactionType} onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))}>
                  <option value="TAX">營業稅</option>
                  <option value="OTHER">其他（寄庫）</option>
                </select>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>收貨人</Label>
                <Input value={form.receiverName}
                  onChange={e => setForm(f => ({ ...f, receiverName: e.target.value }))} />
              </div>
              <div>
                <Label>手機號碼</Label>
                <Input value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>送貨地址</Label>
              <Input value={form.shippingAddress}
                onChange={e => setForm(f => ({ ...f, shippingAddress: e.target.value }))} />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">明細項目</Label>
                <Button variant="outline" size="sm"
                  onClick={() => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }))}>
                  <Plus className="mr-1 h-3 w-3" />{dict.common.add}
                </Button>
              </div>
              <div className="space-y-3">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-slate-50">
                    <div className="col-span-12 md:col-span-4">
                      <Label className="text-xs">品項</Label>
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
                      <Label className="text-xs">單價(未稅)</Label>
                      <Input type="number" min={0} step={0.01} value={item.unitPrice}
                        onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <Label className="text-xs">小計</Label>
                      <div className="text-sm font-medium py-1.5">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </div>
                    </div>
                    <div className="col-span-1 md:col-span-2 flex items-end gap-1">
                      <div className="flex-1">
                        <Label className="text-xs">含稅</Label>
                        <div className="text-sm font-medium py-1.5 text-blue-600">
                          {formatCurrency(Math.round(item.quantity * item.unitPrice * 1.05))}
                        </div>
                      </div>
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
              {/* Totals */}
              <div className="mt-3 text-right space-y-1">
                <div className="text-sm text-muted-foreground">
                  稅前合計：{formatCurrency(form.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0))}
                </div>
                <div className="text-sm text-muted-foreground">
                  營業稅：{formatCurrency(Math.round(form.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 0.05))}
                </div>
                <div className="text-lg font-bold">
                  含稅合計：{formatCurrency(Math.round(form.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 1.05))}
                </div>
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
