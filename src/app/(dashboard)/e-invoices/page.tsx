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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, Search, MoreHorizontal, Loader2,
  CheckCircle2, XCircle, FileText, Send, Scissors,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

type EInvoiceStatus = 'CREATED' | 'APPROVED' | 'VOIDED' | 'CREDIT_NOTE'
type TransmitStatus = 'PENDING' | 'PROCESSING' | 'TRANSMITTED' | 'FAILED' | 'EMAIL_SENT'

const statusVariant: Record<EInvoiceStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  CREATED:     { variant: 'outline' },
  APPROVED:    { variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
  VOIDED:      { variant: 'destructive' },
  CREDIT_NOTE: { variant: 'secondary' },
}

const transmitCls: Record<TransmitStatus, string> = {
  PENDING:     'bg-slate-100 text-slate-600',
  PROCESSING:  'bg-blue-100 text-blue-600',
  TRANSMITTED: 'bg-green-100 text-green-700',
  FAILED:      'bg-red-100 text-red-600',
  EMAIL_SENT:  'bg-teal-100 text-teal-700',
}

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
  const ei = dict.eInvoices
  type EIS = keyof typeof ei.statuses
  type TRS = keyof typeof ei.transmitStatuses
  const statusFilters = [
    { value: '', label: dict.common.all },
    { value: 'CREATED', label: ei.statuses.CREATED },
    { value: 'APPROVED', label: ei.statuses.APPROVED },
    { value: 'VOIDED', label: ei.statuses.VOIDED },
  ]
  const [invoices, setInvoices] = useState<EInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMonth, setFilterMonth] = useState('')   // YYYY-MM
  const [filterType, setFilterType] = useState('')     // B2B | B2C
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<{ id: string; name: string; code: string }[]>([])
  const [salesInvoices, setSalesInvoices] = useState<{ id: string; invoiceNumber: string; customerId: string; customer: { name: string }; subtotal: string; taxAmount: string; totalAmount: string }[]>([])

  // Void dialog state
  const [voidTarget, setVoidTarget] = useState<{ id: string; no: string } | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  // Credit note dialog state
  const [cnTarget, setCnTarget] = useState<{ id: string; no: string; totalAmount: string } | null>(null)
  const [cnForm, setCnForm] = useState({ creditNoteNumber: '', creditNoteDate: '', creditNoteAmount: '' })
  const [cnSaving, setCnSaving] = useState(false)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    if (filterMonth) params.set('month', filterMonth)
    if (filterType) params.set('invoiceType', filterType)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/e-invoices?${params}`)
      if (!res.ok) throw new Error(dict.common.loadFailed)
      const result = await res.json()
      setInvoices(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error(dict.eInvoicesPage.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, filterMonth, filterType, page])

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
    }).catch(() => toast.error(dict.common.refLoadFailed))
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
    if (!form.customerId) { toast.error(dict.eInvoicesPage.customerRequired); return }
    if (!form.invoiceType) { toast.error(dict.eInvoicesPage.typeRequired); return }

    setSaving(true)
    try {
      const res = await fetch('/api/e-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? dict.common.saveFailed)
      }
      toast.success(dict.eInvoicesPage.created)
      setFormOpen(false)
      fetchInvoices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.common.saveFailed)
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
    if (res.ok) { toast.success(`${ei.invoiceUpdated}${label}`); fetchInvoices() }
    else toast.error(dict.common.updateFailed)
  }

  async function updateTransmit(id: string, transmitStatus: string, label: string) {
    const res = await fetch(`/api/e-invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transmitOnly: true, transmitStatus }),
    })
    if (res.ok) { toast.success(`${ei.invoiceUpdated}${label}`); fetchInvoices() }
    else toast.error(dict.common.updateFailed)
  }

  async function handleVoidSubmit() {
    if (!voidTarget) return
    setVoiding(true)
    try {
      const res = await fetch(`/api/e-invoices/${voidTarget.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason }),
      })
      if (res.ok) {
        toast.success(dict.eInvoicesPage.voided)
        setVoidTarget(null)
        setVoidReason('')
        fetchInvoices()
      } else {
        const data = await res.json()
        toast.error(data.error ?? dict.common.operationFailed)
      }
    } finally {
      setVoiding(false)
    }
  }

  async function handleCreditNoteSubmit() {
    if (!cnTarget) return
    setCnSaving(true)
    try {
      const res = await fetch(`/api/e-invoices/${cnTarget.id}/credit-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cnForm),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(ei.creditNoteIssued ?? '折讓已開立')
        setCnTarget(null)
        setCnForm({ creditNoteNumber: '', creditNoteDate: '', creditNoteAmount: '' })
        fetchInvoices()
      } else {
        toast.error(data.error ?? dict.common.operationFailed)
      }
    } finally {
      setCnSaving(false)
    }
  }

  const createdCount = invoices.filter(i => i.status === 'CREATED').length
  const approvedCount = invoices.filter(i => i.status === 'APPROVED').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ei.titleManagement}</h1>
          <p className="text-sm text-muted-foreground">
            {dict.common.total} {pagination ? pagination.total : invoices.length} {dict.common.items}
            {createdCount > 0 && <span className="ml-2 text-amber-600">{createdCount} {ei.pendingApprovalCount}</span>}
            {approvedCount > 0 && <span className="ml-2 text-green-600">{approvedCount} {ei.approvedCountLabel}</span>}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />{dict.eInvoices.newInvoice}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.eInvoices.searchPlaceholder}
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        {/* Month picker */}
        <Input
          type="month"
          className="w-40"
          value={filterMonth}
          onChange={e => { setFilterMonth(e.target.value); setPage(1) }}
          title="篩選年月"
        />
        {/* Invoice type */}
        <Select value={filterType || '_all'} onValueChange={(v: string | null) => { setFilterType(v === '_all' || !v ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="發票類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">全部類型</SelectItem>
            <SelectItem value="B2B">B2B 統編</SelectItem>
            <SelectItem value="B2C">B2C 個人</SelectItem>
          </SelectContent>
        </Select>
        {/* Status chips */}
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
        {/* Clear filters */}
        {(filterMonth || filterType) && (
          <button onClick={() => { setFilterMonth(''); setFilterType(''); setPage(1) }}
            className="text-xs text-slate-400 hover:text-red-500">
            清除篩選
          </button>
        )}
      </div>

      {/* Table (desktop) */}
      <div className="hidden md:block rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">{dict.eInvoices.invoiceNo}</TableHead>
              <TableHead>{dict.common.customer}</TableHead>
              <TableHead className="w-20">{dict.common.type}</TableHead>
              <TableHead className="text-right w-28">{ei.subtotalLabel}</TableHead>
              <TableHead className="text-right w-28">{ei.totalAmount}</TableHead>
              <TableHead className="w-24">{dict.common.status}</TableHead>
              <TableHead className="w-24">{ei.transmitStatusLabel}</TableHead>
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
                const sv = statusVariant[inv.status] ?? { variant: 'outline' as const }
                const scLabel = ei.statuses[inv.status as EIS] ?? inv.status
                const tcCls = transmitCls[inv.transmitStatus] ?? ''
                const tcLabel = ei.transmitStatuses[inv.transmitStatus as TRS] ?? inv.transmitStatus
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
                      <Badge variant={sv.variant} className={sv.className}>{scLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tcCls}`}>
                        {tcLabel}
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
                            <DropdownMenuItem onClick={() => updateStatus(inv.id, 'APPROVED', ei.statuses.APPROVED)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />{ei.approveInvoice}
                            </DropdownMenuItem>
                          )}
                          {inv.status === 'APPROVED' && inv.transmitStatus === 'PENDING' && (
                            <DropdownMenuItem onClick={() => updateTransmit(inv.id, 'TRANSMITTED', ei.transmitStatuses.TRANSMITTED)}>
                              <Send className="mr-2 h-4 w-4" />{ei.markTransmitted}
                            </DropdownMenuItem>
                          )}
                          {['CREATED', 'APPROVED'].includes(inv.status) && (
                            <DropdownMenuItem onClick={() => {
                              setCnTarget({ id: inv.id, no: inv.invoiceNumber, totalAmount: inv.totalAmount })
                              setCnForm({ creditNoteNumber: '', creditNoteDate: new Date().toISOString().slice(0, 10), creditNoteAmount: '' })
                            }}>
                              <Scissors className="mr-2 h-4 w-4" />{ei.issueCreditNote ?? '開立折讓'}
                            </DropdownMenuItem>
                          )}
                          {inv.status !== 'VOIDED' && inv.status !== 'CREDIT_NOTE' && inv.transmitStatus !== 'TRANSMITTED' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setVoidTarget({ id: inv.id, no: inv.invoiceNumber }); setVoidReason('') }} variant="destructive">
                                <XCircle className="mr-2 h-4 w-4" />{ei.voidInvoice}
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
            const sv2 = statusVariant[inv.status] ?? { variant: 'outline' as const }
            const scLabel2 = ei.statuses[inv.status as EIS] ?? inv.status
            const tcCls2 = transmitCls[inv.transmitStatus] ?? ''
            const tcLabel2 = ei.transmitStatuses[inv.transmitStatus as TRS] ?? inv.transmitStatus
            return (
              <div key={inv.id}
                className="rounded-lg border bg-white p-4 space-y-2 active:scale-[0.97] transition-transform">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{inv.invoiceNumber}</span>
                  <Badge variant={sv2.variant} className={sv2.className}>{scLabel2}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{inv.customer.name}</span>
                  <Badge variant="outline" className={inv.invoiceType === 'B2B' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'}>
                    {inv.invoiceType}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{formatCurrency(inv.totalAmount)}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tcCls2}`}>
                    {tcLabel2}
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
            {dict.common.total} {pagination.total} {dict.common.items}，{pagination.page}/{pagination.totalPages}
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

      {/* Void Dialog */}
      <Dialog open={!!voidTarget} onOpenChange={open => { if (!open) setVoidTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" />{ei.voidInvoice}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {ei.confirmVoid?.replace('{no}', voidTarget?.no ?? '') ?? `確定要作廢發票 ${voidTarget?.no}？`}
            </p>
            <div>
              <Label>{ei.voidReasonLabel ?? '作廢原因（選填）'}</Label>
              <Input
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder={ei.voidReasonPlaceholder ?? '例：重複開立、金額錯誤…'}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoidTarget(null)}>{dict.common.cancel}</Button>
            <Button variant="destructive" onClick={handleVoidSubmit} disabled={voiding}>
              {voiding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              {ei.confirmVoidBtn ?? '確認作廢'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credit Note Dialog */}
      <Dialog open={!!cnTarget} onOpenChange={open => { if (!open) setCnTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5" />{ei.issueCreditNote ?? '開立折讓'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {ei.creditNoteFor ?? '對發票'} <span className="font-mono font-medium">{cnTarget?.no}</span> {ei.creditNoteForSuffix ?? '開立折讓證明'}
            </p>
            <div>
              <Label>{ei.creditNoteNumberLabel ?? '折讓證明單號碼 *'}</Label>
              <Input
                value={cnForm.creditNoteNumber}
                onChange={e => setCnForm(f => ({ ...f, creditNoteNumber: e.target.value }))}
                placeholder="CN-2025-001"
              />
            </div>
            <div>
              <Label>{ei.creditNoteDateLabel ?? '折讓日期 *'}</Label>
              <Input
                type="date"
                value={cnForm.creditNoteDate}
                onChange={e => setCnForm(f => ({ ...f, creditNoteDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>{ei.creditNoteAmountLabel ?? '折讓金額 *'}</Label>
              <Input
                type="number"
                min={0}
                value={cnForm.creditNoteAmount}
                onChange={e => setCnForm(f => ({ ...f, creditNoteAmount: e.target.value }))}
                placeholder={`最高 ${Number(cnTarget?.totalAmount ?? 0).toLocaleString('zh-TW')}`}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCnTarget(null)}>{dict.common.cancel}</Button>
            <Button onClick={handleCreditNoteSubmit} disabled={cnSaving}>
              {cnSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {ei.confirmCreditNoteBtn ?? '開立折讓'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dict.eInvoices.newInvoice}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {/* From Sales Invoice */}
            <div>
              <Label>{ei.salesInvoiceSource}</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.salesInvoiceId} onChange={e => onSalesInvoiceSelect(e.target.value)}>
                <option value="">{ei.noSalesInvoice}</option>
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
                  <option value="">{ei.selectCustomerOption}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{ei.invoiceTypeLabel} *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.invoiceType} onChange={e => setForm(f => ({ ...f, invoiceType: e.target.value }))}>
                  <option value="B2B">{ei.b2bStored}</option>
                  <option value="B2C">{ei.b2cStored}</option>
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
                <Label>{ei.subtotalAmountLabel}</Label>
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
