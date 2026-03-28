'use client'

import { useEffect, useState, useCallback } from 'react'
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
import {
  Plus, Search, MoreHorizontal, Loader2,
  CheckCircle2, XCircle, FileText, Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

type EInvoiceStatus = 'CREATED' | 'APPROVED' | 'VOIDED' | 'CREDIT_NOTE'
type TransmitStatus = 'PENDING' | 'PROCESSING' | 'TRANSMITTED' | 'FAILED' | 'EMAIL_SENT'

const statusConfig: Record<EInvoiceStatus, {
  label: string
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  className?: string
}> = {
  CREATED:     { label: '已建立', variant: 'outline' },
  APPROVED:    { label: '已核准', variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
  VOIDED:      { label: '已作廢', variant: 'destructive' },
  CREDIT_NOTE: { label: '折讓', variant: 'secondary' },
}

const transmitConfig: Record<TransmitStatus, {
  label: string
  className: string
}> = {
  PENDING:     { label: '待傳送', className: 'bg-slate-100 text-slate-600' },
  PROCESSING:  { label: '傳送中', className: 'bg-blue-100 text-blue-600' },
  TRANSMITTED: { label: '已傳送', className: 'bg-green-100 text-green-700' },
  FAILED:      { label: '傳送失敗', className: 'bg-red-100 text-red-600' },
  EMAIL_SENT:  { label: 'Email已寄', className: 'bg-teal-100 text-teal-700' },
}

const statusFilters = [
  { value: '', label: '全部' },
  { value: 'CREATED', label: '已建立' },
  { value: 'APPROVED', label: '已核准' },
  { value: 'VOIDED', label: '已作廢' },
]

interface EInvoice {
  id: string; invoiceNumber: string; date: string; status: EInvoiceStatus
  invoiceType: string; subtotal: string; taxAmount: string; totalAmount: string
  transmitStatus: TransmitStatus; transmittedAt: string | null
  customerName: string; buyerTaxId: string | null; buyerName: string | null
  salesInvoiceId: string | null; createdAt: string
  salesInvoice: { id: string; invoiceNumber: string } | null
  customer: { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
}

interface FormData {
  salesInvoiceId: string
  customerId: string
  customerName: string
  invoiceType: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  buyerTaxId: string
  buyerName: string
}

const emptyForm: FormData = {
  salesInvoiceId: '', customerId: '', customerName: '',
  invoiceType: 'B2B', subtotal: 0, taxAmount: 0, totalAmount: 0,
  buyerTaxId: '', buyerName: '',
}

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(val))
}
function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

export default function EInvoicesPage() {
  const { dict } = useI18n()
  const [invoices, setInvoices] = useState<EInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<{ id: string; name: string; code: string }[]>([])
  const [salesInvoices, setSalesInvoices] = useState<{ id: string; invoiceNumber: string; customerId: string; customer: { name: string }; subtotal: string; taxAmount: string; totalAmount: string }[]>([])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/e-invoices?${params}`)
      if (!res.ok) throw new Error('載入失敗')
      const result = await res.json()
      setInvoices(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error('電子發票載入失敗')
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
      fetch('/api/sales-invoices?pageSize=200&status=CONFIRMED').then(r => r.json()),
    ]).then(([cRes, siRes]) => {
      setCustomers((cRes.data ?? cRes) || [])
      setSalesInvoices((siRes.data ?? siRes) || [])
    }).catch(() => toast.error('載入參考資料失敗'))
  }, [formOpen])

  function openCreate() {
    setForm({ ...emptyForm })
    setFormOpen(true)
  }

  function onSalesInvoiceSelect(siId: string) {
    const si = salesInvoices.find(s => s.id === siId)
    if (si) {
      setForm(f => ({
        ...f,
        salesInvoiceId: siId,
        customerId: si.customerId,
        customerName: si.customer.name,
        subtotal: Number(si.subtotal),
        taxAmount: Number(si.taxAmount),
        totalAmount: Number(si.totalAmount),
      }))
    }
  }

  async function handleSubmit() {
    if (!form.customerId) { toast.error('請選擇客戶'); return }
    if (!form.invoiceType) { toast.error('請選擇發票類型'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/e-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? '儲存失敗')
      }
      toast.success('電子發票已建立')
      setFormOpen(false)
      fetchInvoices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: string, label: string) {
    const res = await fetch(`/api/e-invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) { toast.success(`發票已${label}`); fetchInvoices() }
    else toast.error('更新失敗')
  }

  async function updateTransmit(id: string, transmitStatus: string, label: string) {
    const res = await fetch(`/api/e-invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transmitOnly: true, transmitStatus }),
    })
    if (res.ok) { toast.success(`發票已${label}`); fetchInvoices() }
    else toast.error('更新失敗')
  }

  async function handleVoid(id: string, no: string) {
    if (!confirm(`確定要作廢發票 ${no} 嗎？`)) return
    const res = await fetch(`/api/e-invoices/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('發票已作廢'); fetchInvoices() }
    else {
      const data = await res.json()
      toast.error(data.error ?? '作廢失敗')
    }
  }

  const createdCount = invoices.filter(i => i.status === 'CREATED').length
  const approvedCount = invoices.filter(i => i.status === 'APPROVED').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.eInvoices.title}管理</h1>
          <p className="text-sm text-muted-foreground">
            共 {pagination ? pagination.total : invoices.length} 筆
            {createdCount > 0 && <span className="ml-2 text-amber-600">{createdCount} 筆待核准</span>}
            {approvedCount > 0 && <span className="ml-2 text-green-600">{approvedCount} 筆已核准</span>}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />{dict.eInvoices.newInvoice}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.eInvoices.searchPlaceholder}
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
              <TableHead className="w-40">{dict.eInvoices.invoiceNo}</TableHead>
              <TableHead>{dict.common.customer}</TableHead>
              <TableHead className="w-20">{dict.common.type}</TableHead>
              <TableHead className="text-right w-28">稅前</TableHead>
              <TableHead className="text-right w-28">{dict.eInvoices.totalAmount}</TableHead>
              <TableHead className="w-24">{dict.common.status}</TableHead>
              <TableHead className="w-24">傳送狀態</TableHead>
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
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {search || filterStatus ? dict.eInvoices.noResults : dict.eInvoices.noInvoices}
                    </p>
                    {!search && !filterStatus && (
                      <Button variant="outline" size="sm" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />{dict.eInvoices.newInvoice}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const sc = statusConfig[inv.status] ?? { label: inv.status, variant: 'outline' }
                const tc = transmitConfig[inv.transmitStatus] ?? { label: inv.transmitStatus, className: '' }
                return (
                  <TableRow key={inv.id} className="group hover:bg-slate-50/80">
                    <TableCell className="font-mono text-sm font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{inv.customer.name}</div>
                      {inv.buyerTaxId && <div className="text-xs text-muted-foreground">{dict.eInvoices.buyerTaxId}: {inv.buyerTaxId}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={inv.invoiceType === 'B2B' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'}>
                        {inv.invoiceType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.subtotal)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tc.className}`}>
                        {tc.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {inv.status === 'CREATED' && (
                            <DropdownMenuItem onClick={() => updateStatus(inv.id, 'APPROVED', '核准')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />核准發票
                            </DropdownMenuItem>
                          )}
                          {inv.status === 'APPROVED' && inv.transmitStatus === 'PENDING' && (
                            <DropdownMenuItem onClick={() => updateTransmit(inv.id, 'TRANSMITTED', '傳送')}>
                              <Send className="mr-2 h-4 w-4" />標記已傳送
                            </DropdownMenuItem>
                          )}
                          {inv.status !== 'VOIDED' && inv.transmitStatus !== 'TRANSMITTED' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleVoid(inv.id, inv.invoiceNumber)} variant="destructive">
                                <XCircle className="mr-2 h-4 w-4" />作廢發票
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
                {search || filterStatus ? dict.eInvoices.noResults : dict.eInvoices.noInvoices}
              </p>
            </div>
          </div>
        ) : (
          invoices.map((inv) => {
            const sc = statusConfig[inv.status] ?? { label: inv.status, variant: 'outline' as const }
            const tc = transmitConfig[inv.transmitStatus] ?? { label: inv.transmitStatus, className: '' }
            return (
              <div key={inv.id}
                className="rounded-lg border bg-white p-4 space-y-2 active:scale-[0.97] transition-transform">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{inv.invoiceNumber}</span>
                  <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{inv.customer.name}</span>
                  <Badge variant="outline" className={inv.invoiceType === 'B2B' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'}>
                    {inv.invoiceType}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{formatCurrency(inv.totalAmount)}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tc.className}`}>
                    {tc.label}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground text-right">{formatDate(inv.createdAt)}</div>
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

      {/* Create Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dict.eInvoices.newInvoice}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {/* From Sales Invoice */}
            <div>
              <Label>來源銷貨單（選填，可自動帶入金額）</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.salesInvoiceId} onChange={e => onSalesInvoiceSelect(e.target.value)}>
                <option value="">不選擇</option>
                {salesInvoices.map(si => <option key={si.id} value={si.id}>{si.invoiceNumber} - {si.customer.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{dict.common.customer} *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.customerId} onChange={e => {
                    const c = customers.find(c => c.id === e.target.value)
                    setForm(f => ({ ...f, customerId: e.target.value, customerName: c?.name ?? '' }))
                  }}>
                  <option value="">選擇客戶</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>發票類型 *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.invoiceType} onChange={e => setForm(f => ({ ...f, invoiceType: e.target.value }))}>
                  <option value="B2B">B2B（存證）</option>
                  <option value="B2C">B2C（存證）</option>
                </select>
              </div>
            </div>

            {form.invoiceType === 'B2B' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{dict.eInvoices.buyerTaxId}</Label>
                  <Input value={form.buyerTaxId}
                    onChange={e => setForm(f => ({ ...f, buyerTaxId: e.target.value }))} placeholder="12345678" />
                </div>
                <div>
                  <Label>{dict.eInvoices.buyerName}</Label>
                  <Input value={form.buyerName}
                    onChange={e => setForm(f => ({ ...f, buyerName: e.target.value }))} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>稅前金額</Label>
                <Input type="number" min={0} value={form.subtotal}
                  onChange={e => {
                    const sub = Number(e.target.value)
                    setForm(f => ({ ...f, subtotal: sub, taxAmount: Math.round(sub * 0.05), totalAmount: Math.round(sub * 1.05) }))
                  }} />
              </div>
              <div>
                <Label>{dict.eInvoices.taxAmount}</Label>
                <Input type="number" min={0} value={form.taxAmount}
                  onChange={e => setForm(f => ({ ...f, taxAmount: Number(e.target.value), totalAmount: f.subtotal + Number(e.target.value) }))} />
              </div>
              <div>
                <Label>{dict.eInvoices.totalAmount}</Label>
                <Input type="number" min={0} value={form.totalAmount}
                  onChange={e => setForm(f => ({ ...f, totalAmount: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>{dict.common.cancel}</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {dict.common.create}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
