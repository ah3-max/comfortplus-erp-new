'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { QuotationForm } from '@/components/quotations/quotation-form'
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'

type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'

interface QuotationItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  discount: number
  product: { sku: string; name: string; unit: string; sellingPrice: string }
}

interface Quotation {
  id: string
  quotationNo: string
  customerId: string
  status: QuotationStatus
  totalAmount: string
  validUntil: string | null
  notes: string | null
  createdAt: string
  customer: { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
  items: QuotationItem[]
}

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(val))
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function QuotationsPage() {
  const { dict } = useI18n()
  const router = useRouter()

  const statusConfig: Record<QuotationStatus, {
    label: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
    className?: string
  }> = {
    DRAFT:     { label: dict.quotations.statuses.DRAFT,     variant: 'outline' },
    SENT:      { label: dict.quotations.statuses.SENT,      variant: 'secondary' },
    ACCEPTED:  { label: dict.quotations.statuses.ACCEPTED,  variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
    REJECTED:  { label: dict.quotations.statuses.REJECTED,  variant: 'destructive' },
    EXPIRED:   { label: dict.quotations.statuses.EXPIRED,   variant: 'outline', className: 'text-muted-foreground' },
    CONVERTED: { label: dict.quotations.statuses.CONVERTED, variant: 'default', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  }

  const statusFilters: { value: string; label: string }[] = [
    { value: '', label: dict.common.all },
    { value: 'DRAFT',     label: dict.quotations.statuses.DRAFT },
    { value: 'SENT',      label: dict.quotations.statuses.SENT },
    { value: 'ACCEPTED',  label: dict.quotations.statuses.ACCEPTED },
    { value: 'REJECTED',  label: dict.quotations.statuses.REJECTED },
    { value: 'EXPIRED',   label: dict.quotations.statuses.EXPIRED },
    { value: 'CONVERTED', label: dict.quotations.statuses.CONVERTED },
  ]

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{page:number;pageSize:number;total:number;totalPages:number}|null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Quotation | null>(null)
  const [converting, setConverting] = useState<string | null>(null)

  const fetchQuotations = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/quotations?${params}`)
      if (!res.ok) throw new Error(dict.common.loadFailed)
      const result = await res.json()
      setQuotations(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error(dict.common.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, page])

  useEffect(() => {
    const timer = setTimeout(fetchQuotations, 300)
    return () => clearTimeout(timer)
  }, [fetchQuotations])

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/quotations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) {
      toast.success(dict.common.updateSuccess)
      fetchQuotations()
    } else {
      toast.error(dict.common.updateFailed)
    }
  }

  async function handleConvert(id: string, no: string) {
    if (!confirm(`${dict.quotations.convertConfirmPrefix} ${no} ${dict.quotations.convertConfirmSuffix}`)) return
    setConverting(id)
    const res = await fetch(`/api/quotations/${id}/convert`, { method: 'POST' })
    setConverting(null)
    if (res.ok) {
      const data = await res.json()
      toast.success(`${dict.quotations.orderCreatedPrefix} ${data.orderNo}`)
      router.push(`/orders/${data.orderId}`)
    } else {
      const data = await res.json()
      toast.error(data.error ?? dict.common.updateFailed)
    }
  }

  async function handleSend(id: string) {
    const res = await fetch(`/api/quotations/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: ['email', 'line'] }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`報價單已發送（${data.sentChannels?.join('、') ?? ''}）`)
      fetchQuotations()
    } else {
      toast.error(data.error ?? dict.common.operationFailed)
    }
  }

  async function handleDelete(id: string, no: string) {
    if (!confirm(`${dict.common.deleteConfirm}`)) return
    const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(dict.common.deleteSuccess)
      fetchQuotations()
    } else {
      const data = await res.json()
      toast.error(data.error ?? dict.common.deleteFailed)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.quotations.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.quotations.subtitle.replace('{n}', String(quotations.length))}</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          {dict.quotations.newQuotation}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={dict.ordersExt.searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex gap-1.5">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilterStatus(f.value); setPage(1) }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === f.value
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {!loading && quotations.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{dict.common.noData}</p>
        </div>
      )}

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {loading && (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && quotations.map(q => {
          const sc = statusConfig[q.status] ?? { label: q.status, variant: 'outline' as const }
          return (
            <Link key={q.id} href={`/quotations/${q.id}`}>
              <Card className="active:scale-[0.99] transition-transform">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-bold">{q.quotationNo}</span>
                    <Badge variant={sc.variant} className={`text-xs ${sc.className ?? ''}`}>{sc.label}</Badge>
                  </div>
                  <div className="text-sm mb-2">{q.customer.name}</div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{q.createdBy.name}</span>
                    <span className="font-medium text-sm text-foreground">{formatCurrency(q.totalAmount)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Table */}
      <div className="hidden md:block rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">{dict.quotations.quotationNo}</TableHead>
              <TableHead>{dict.common.customer}</TableHead>
              <TableHead className="w-24">{dict.common.status}</TableHead>
              <TableHead>{dict.ordersExt.productSummary}</TableHead>
              <TableHead className="text-right w-32">{dict.quotations.totalAmount}</TableHead>
              <TableHead className="w-28">{dict.quotations.validUntil}</TableHead>
              <TableHead className="w-24">{dict.common.createdAt}</TableHead>
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
            ) : quotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                  {search || filterStatus ? dict.common.noResultsFound : dict.common.noData}
                </TableCell>
              </TableRow>
            ) : (
              quotations.map((q) => {
                const sc = statusConfig[q.status] ?? { label: q.status, variant: 'outline' }
                const isExpired = q.validUntil && new Date(q.validUntil) < new Date()
                return (
                  <TableRow key={q.id} className="group cursor-pointer hover:bg-slate-50/50"
                    onClick={() => router.push(`/quotations/${q.id}`)}>
                    <TableCell className="font-mono text-sm font-medium">{q.quotationNo}</TableCell>
                    <TableCell>
                      <div className="font-medium">{q.customer.name}</div>
                      <div className="text-xs text-muted-foreground">{q.customer.code}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sc.variant}
                        className={sc.className}
                      >
                        {sc.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {q.items.length > 0
                        ? `${q.items[0].product.name}${q.items.length > 1 ? ` ${dict.common.etcItems} ${q.items.length} ${dict.common.pieces}` : ''}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(q.totalAmount)}</TableCell>
                    <TableCell className={`text-sm ${isExpired ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {q.validUntil ? formatDate(q.validUntil) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(q.createdAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 opacity-60 hover:opacity-100 transition-opacity hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {q.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => { setEditTarget(q); setFormOpen(true) }}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {dict.common.edit}
                            </DropdownMenuItem>
                          )}
                          {['DRAFT', 'APPROVED'].includes(q.status) && (
                            <DropdownMenuItem onClick={() => handleSend(q.id)}>
                              <Send className="mr-2 h-4 w-4" />
                              發送報價給客戶（Email / LINE）
                            </DropdownMenuItem>
                          )}
                          {q.status === 'SENT' && (
                            <DropdownMenuItem onClick={() => updateStatus(q.id, 'ACCEPTED')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              {dict.quotations.markAs}{dict.quotations.statuses.ACCEPTED}
                            </DropdownMenuItem>
                          )}
                          {q.status === 'SENT' && (
                            <DropdownMenuItem onClick={() => updateStatus(q.id, 'REJECTED')}>
                              <XCircle className="mr-2 h-4 w-4" />
                              {dict.quotations.markAs}{dict.quotations.statuses.REJECTED}
                            </DropdownMenuItem>
                          )}
                          {q.status === 'ACCEPTED' && (
                            <DropdownMenuItem
                              onClick={() => handleConvert(q.id, q.quotationNo)}
                              disabled={converting === q.id}
                            >
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              {converting === q.id ? dict.common.loading : dict.quotations.convertToOrder}
                            </DropdownMenuItem>
                          )}
                          {q.status === 'DRAFT' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(q.id, q.quotationNo)}
                                variant="destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {dict.common.delete}
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

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            {dict.ordersExt.totalCount} {pagination.total} {dict.ordersExt.records}，{dict.common.pagePrefix} {pagination.page}/{pagination.totalPages} {dict.common.pageSuffix}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1}
              onClick={() => setPage(p => p - 1)}>{dict.common.prevPage}</Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}>{dict.common.nextPage}</Button>
          </div>
        </div>
      )}

      <QuotationForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={fetchQuotations}
        quotation={editTarget}
      />
    </div>
  )
}
