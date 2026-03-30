'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { SortableHead } from '@/components/ui/sortable-head'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { OrderForm } from '@/components/orders/order-form'
import {
  Plus, Search, MoreHorizontal, Pencil, Loader2,
  CheckCircle2, XCircle, Truck, PackageCheck, DollarSign,
  ClipboardList, CheckSquare, Square, Download, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'

interface OrderItem {
  productId: string; quantity: number; unitPrice: number; discount: number
  product: { sku: string; name: string; unit: string; sellingPrice: string }
}
interface Order {
  id: string; orderNo: string; customerId: string; status: OrderStatus
  totalAmount: string; paidAmount: string
  expectedShipDate: string | null; notes: string | null; createdAt: string
  customer: { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
  items: OrderItem[]
  _count: { shipments: number }
}

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(val))
}
function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

export default function OrdersPage() {
  const { dict } = useI18n()
  const router = useRouter()

  const statusConfig: Record<OrderStatus, {
    label: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
    className?: string
  }> = {
    PENDING:    { label: dict.orders.statuses.PENDING,    variant: 'outline' },
    CONFIRMED:  { label: dict.orders.statuses.CONFIRMED,  variant: 'secondary' },
    PROCESSING: { label: dict.orders.statuses.PROCESSING, variant: 'default', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    SHIPPED:    { label: dict.orders.statuses.SHIPPED,    variant: 'default', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    DELIVERED:  { label: dict.orders.statuses.DELIVERED,  variant: 'default', className: 'bg-teal-100 text-teal-700 border-teal-200' },
    COMPLETED:  { label: dict.orders.statuses.COMPLETED,  variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
    CANCELLED:  { label: dict.orders.statuses.CANCELLED,  variant: 'destructive' },
  }

  const statusFilters = [
    { value: '', label: dict.common.all },
    { value: 'PENDING',    label: dict.orders.statuses.PENDING },
    { value: 'CONFIRMED',  label: dict.orders.statuses.CONFIRMED },
    { value: 'PROCESSING', label: dict.orders.statuses.PROCESSING },
    { value: 'SHIPPED',    label: dict.orders.statuses.SHIPPED },
    { value: 'COMPLETED',  label: dict.orders.statuses.COMPLETED },
  ]

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const searchParams = useSearchParams()
  const [formOpen, setFormOpen] = useState(searchParams.get('action') === 'new')
  const [editTarget, setEditTarget] = useState<Order | null>(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{page:number;pageSize:number;total:number;totalPages:number}|null>(null)
  const [orderBy, setOrderBy] = useState('createdAt')
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)

  function setSort(col: string, dir: 'asc' | 'desc') {
    setOrderBy(col)
    setOrderDir(dir)
    setPage(1)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)))
    }
  }

  async function batchConfirm() {
    if (selectedIds.size === 0) return
    const pendingIds = orders.filter(o => o.status === 'PENDING' && selectedIds.has(o.id)).map(o => o.id)
    if (pendingIds.length === 0) { toast.error('所選訂單中沒有可確認的待處理訂單'); return }
    if (!confirm(`確認批次確認 ${pendingIds.length} 筆訂單？`)) return
    setBatchLoading(true)
    try {
      const results = await Promise.allSettled(
        pendingIds.map(id => fetch(`/api/orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statusOnly: true, status: 'CONFIRMED' }),
        }))
      )
      const ok = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length
      toast.success(`已確認 ${ok} 筆訂單`)
      setSelectedIds(new Set())
      fetchOrders()
    } finally {
      setBatchLoading(false)
    }
  }

  function batchExport() {
    const ids = Array.from(selectedIds)
    const params = new URLSearchParams()
    ids.forEach(id => params.append('ids', id))
    window.open(`/api/orders/export?${params}`, '_blank')
  }

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    params.set('page', String(page))
    params.set('pageSize', '50')
    params.set('orderBy', orderBy)
    params.set('orderDir', orderDir)
    try {
      const res = await fetch(`/api/orders?${params}`)
      if (!res.ok) throw new Error(dict.common.loadFailed)
      const result = await res.json()
      setOrders(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error(dict.common.loadFailed)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterStatus, page, orderBy, orderDir])

  // Clear selection on filter/page change
  useEffect(() => { setSelectedIds(new Set()) }, [search, filterStatus, page])

  useEffect(() => {
    const t = setTimeout(fetchOrders, 300)
    return () => clearTimeout(t)
  }, [fetchOrders])

  async function updateStatus(id: string, status: string, label: string) {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) { toast.success(dict.ordersExt.statusUpdated); fetchOrders() }
    else toast.error(dict.common.updateFailed)
  }

  async function handleCancel(id: string, no: string) {
    if (!confirm(`${dict.ordersExt.cancelConfirm} ${no}?`)) return
    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.orders.statuses.CANCELLED); fetchOrders() }
    else {
      const data = await res.json()
      toast.error(data.error ?? dict.common.updateFailed)
    }
  }

  const pendingCount = orders.filter((o) => o.status === 'PENDING').length
  const processingCount = orders.filter((o) => ['CONFIRMED', 'PROCESSING'].includes(o.status)).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.orders.title}</h1>
          <p className="text-sm text-muted-foreground">
            {dict.ordersExt.totalCount} {pagination ? pagination.total : orders.length} {dict.ordersExt.records}
            {pendingCount > 0 && <span className="ml-2 text-amber-600">{pendingCount} {dict.ordersExt.pendingLabel}</span>}
            {processingCount > 0 && <span className="ml-2 text-blue-600">{processingCount} {dict.ordersExt.processingLabel}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"
            onClick={() => window.open(`/api/orders/export?search=${search}&status=${filterStatus}`, '_blank')}>
            {dict.ordersExt.exportExcel}
          </Button>
          <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />{dict.orders.newOrder}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.ordersExt.searchPlaceholder}
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

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-700">已選 {selectedIds.size} 筆</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={batchExport} className="border-blue-300 text-blue-700 hover:bg-blue-100">
              <Download className="mr-1.5 h-3.5 w-3.5" />匯出選取
            </Button>
            <Button size="sm" onClick={batchConfirm} disabled={batchLoading} className="bg-blue-600 hover:bg-blue-700">
              {batchLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
              批次確認
            </Button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-1 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table (desktop) */}
      <div className="hidden md:block rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pr-0">
                <button onClick={toggleAll} className="flex items-center justify-center w-full">
                  {selectedIds.size === orders.length && orders.length > 0
                    ? <CheckSquare className="h-4 w-4 text-blue-600" />
                    : <Square className="h-4 w-4 text-slate-300" />}
                </button>
              </TableHead>
              <SortableHead column="orderNo" label={dict.orders.orderNo} current={orderBy} dir={orderDir} onSort={setSort} className="w-40" />
              <TableHead>{dict.common.customer}</TableHead>
              <TableHead className="w-24">{dict.common.status}</TableHead>
              <TableHead>{dict.ordersExt.productSummary}</TableHead>
              <SortableHead column="totalAmount" label={dict.orders.totalAmount} current={orderBy} dir={orderDir} onSort={setSort} className="text-right w-32" />
              <TableHead className="text-right w-28">{dict.orders.paidAmount}</TableHead>
              <SortableHead column="expectedShipDate" label={dict.ordersExt.expectedShipDate} current={orderBy} dir={orderDir} onSort={setSort} className="w-24" />
              <TableHead className="w-16">{dict.ordersExt.shipmentCount}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {search || filterStatus ? dict.ordersExt.noResults : dict.ordersExt.noOrders}
                    </p>
                    {!search && !filterStatus && (
                      <Button variant="outline" size="sm" onClick={() => { setEditTarget(null); setFormOpen(true) }}>
                        <Plus className="mr-2 h-4 w-4" />{dict.orders.newOrder}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => {
                const sc = statusConfig[o.status] ?? { label: o.status, variant: 'outline' }
                const unpaid = Number(o.totalAmount) - Number(o.paidAmount)
                const isSelected = selectedIds.has(o.id)
                return (
                  <TableRow key={o.id} className={`group cursor-pointer hover:bg-slate-50/80 ${isSelected ? 'bg-blue-50/60' : ''}`}
                    onClick={() => router.push(`/orders/${o.id}`)}>
                    <TableCell className="pr-0" onClick={e => { e.stopPropagation(); toggleSelect(o.id) }}>
                      {isSelected
                        ? <CheckSquare className="h-4 w-4 text-blue-600 mx-auto" />
                        : <Square className="h-4 w-4 text-slate-300 mx-auto opacity-0 group-hover:opacity-100" />}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">{o.orderNo}</TableCell>
                    <TableCell>
                      <div className="font-medium">{o.customer.name}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.items.length > 0
                        ? `${o.items[0].product.name}${o.items.length > 1 ? ` ${dict.common.etcItems} ${o.items.length} ${dict.common.pieces}` : ''}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(o.totalAmount)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {Number(o.paidAmount) > 0 ? (
                        <div>
                          <div className="font-medium text-green-600">{formatCurrency(o.paidAmount)}</div>
                          {unpaid > 0 && <div className="text-xs text-red-500">{dict.ordersExt.owe} {formatCurrency(unpaid)}</div>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.expectedShipDate ? formatDate(o.expectedShipDate) : '—'}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {o._count.shipments > 0 ? (
                        <span className="text-blue-600 font-medium">{o._count.shipments}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {o.status === 'PENDING' && (
                            <DropdownMenuItem onClick={() => { setEditTarget(o); setFormOpen(true) }}>
                              <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}
                            </DropdownMenuItem>
                          )}
                          {o.status === 'PENDING' && (
                            <DropdownMenuItem onClick={() => updateStatus(o.id, 'CONFIRMED', dict.orders.statuses.CONFIRMED)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />{dict.ordersExt.confirmOrder}
                            </DropdownMenuItem>
                          )}
                          {o.status === 'CONFIRMED' && (
                            <DropdownMenuItem onClick={() => updateStatus(o.id, 'PROCESSING', dict.orders.statuses.PROCESSING)}>
                              <PackageCheck className="mr-2 h-4 w-4" />{dict.ordersExt.startProcessing}
                            </DropdownMenuItem>
                          )}
                          {o.status === 'PROCESSING' && (
                            <DropdownMenuItem onClick={() => updateStatus(o.id, 'SHIPPED', dict.orders.statuses.SHIPPED)}>
                              <Truck className="mr-2 h-4 w-4" />{dict.ordersExt.markShipped}
                            </DropdownMenuItem>
                          )}
                          {o.status === 'SHIPPED' && (
                            <DropdownMenuItem onClick={() => updateStatus(o.id, 'DELIVERED', dict.orders.statuses.DELIVERED)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />{dict.ordersExt.markDelivered}
                            </DropdownMenuItem>
                          )}
                          {o.status === 'DELIVERED' && (
                            <DropdownMenuItem onClick={() => updateStatus(o.id, 'COMPLETED', dict.orders.statuses.COMPLETED)}>
                              <DollarSign className="mr-2 h-4 w-4" />{dict.ordersExt.markCompleted}
                            </DropdownMenuItem>
                          )}
                          {!['COMPLETED', 'CANCELLED'].includes(o.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleCancel(o.id, o.orderNo)} variant="destructive">
                                <XCircle className="mr-2 h-4 w-4" />{dict.ordersExt.cancelOrder}
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
        ) : orders.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {search || filterStatus ? dict.ordersExt.noResults : dict.ordersExt.noOrders}
              </p>
              {!search && !filterStatus && (
                <Button variant="outline" size="sm" onClick={() => { setEditTarget(null); setFormOpen(true) }}>
                  <Plus className="mr-2 h-4 w-4" />{dict.orders.newOrder}
                </Button>
              )}
            </div>
          </div>
        ) : (
          orders.map((o) => {
            const sc = statusConfig[o.status] ?? { label: o.status, variant: 'outline' as const }
            const unpaid = Number(o.totalAmount) - Number(o.paidAmount)
            return (
              <div key={o.id}
                className="rounded-lg border bg-white p-4 space-y-2 cursor-pointer active:bg-slate-50"
                onClick={() => router.push(`/orders/${o.id}`)}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{o.orderNo}</span>
                  <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{o.customer.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {o.items.length > 0
                    ? `${o.items[0].product.name}${o.items.length > 1 ? ` ${dict.common.etcItems} ${o.items.length} ${dict.common.pieces}` : ''}`
                    : '—'}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{formatCurrency(o.totalAmount)}</span>
                  {Number(o.paidAmount) > 0 ? (
                    <span>
                      <span className="text-green-600">{formatCurrency(o.paidAmount)}</span>
                      {unpaid > 0 && <span className="ml-1 text-xs text-red-500">{dict.ordersExt.owe} {formatCurrency(unpaid)}</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{dict.orders.unpaid}</span>
                  )}
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
            {dict.ordersExt.totalCount} {pagination.total} {dict.ordersExt.records}，{dict.common.pagePrefix} {pagination.page}/{pagination.totalPages} {dict.common.pageSuffix}
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

      <OrderForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={fetchOrders}
        order={editTarget}
      />
    </div>
  )
}
