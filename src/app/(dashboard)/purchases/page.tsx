'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PurchaseForm } from '@/components/purchases/purchase-form'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, CheckCircle2, XCircle, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

type PurchaseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'SOURCING' | 'CONFIRMED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'

const statusCls: Record<PurchaseStatus, string> = {
  DRAFT:            'border-slate-300 text-slate-600',
  PENDING_APPROVAL: 'bg-orange-100 text-orange-700 border-orange-200',
  SOURCING:         'bg-purple-100 text-purple-700 border-purple-200',
  CONFIRMED:        'bg-blue-100 text-blue-700 border-blue-200',
  PARTIAL:          'bg-amber-100 text-amber-700 border-amber-200',
  RECEIVED:         'bg-green-100 text-green-700 border-green-200',
  CANCELLED:        'bg-red-100 text-red-700 border-red-200',
}

interface PurchaseOrder {
  id: string; poNo: string; status: PurchaseStatus; orderType: string
  totalAmount: string; paidAmount: string
  expectedDate: string | null; createdAt: string
  supplier: { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
  items: Array<{ quantity: number; receivedQty: number; product: { name: string } | null }>
  _count: { receipts: number }
}

function fmt(v: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(v))
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

export default function PurchasesPage() {
  const router = useRouter()
  const { dict } = useI18n()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [suppliers, setSuppliers] = useState<{ id: string; code: string; name: string }[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PurchaseOrder | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  function toggleAll() {
    if (selectedIds.size === orders.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(orders.map(o => o.id)))
  }

  async function batchStatus(status: string, label: string) {
    if (selectedIds.size === 0) return
    if (!confirm(`確定將 ${selectedIds.size} 張採購單${label}？`)) return
    const res = await fetch('/api/purchases/batch-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), status }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? '批次失敗'); return }
    toast.success(data.message ?? '批次完成')
    setSelectedIds(new Set())
    fetchOrders()
  }

  // Load supplier list once for filter dropdown
  useEffect(() => {
    fetch('/api/suppliers?showAll=true')
      .then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {})
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    if (filterSupplier) params.set('supplierId', filterSupplier)
    if (filterPayment) params.set('paymentStatus', filterPayment)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/purchases?${params}`)
      const result = await res.json()
      setOrders(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      setOrders([])
    }
    setLoading(false)
  }, [search, filterStatus, filterSupplier, filterPayment, page])

  useEffect(() => {
    const t = setTimeout(fetchOrders, 300)
    return () => clearTimeout(t)
  }, [fetchOrders])

  async function updateStatus(id: string, status: string, label: string) {
    const res = await fetch(`/api/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) { toast.success(`${dict.purchasesPage.statusUpdated}${label}`); fetchOrders() }
    else toast.error(dict.common.updateFailed)
  }

  async function handleDelete(id: string, no: string) {
    if (!confirm(`${dict.purchasesPage.deleteConfirmPrefix} ${no} ${dict.purchasesPage.deleteSuffix}`)) return
    const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.purchasesPage.deleted); fetchOrders() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.deleteFailed) }
  }

  const pendingCount = orders.filter(o => ['CONFIRMED', 'PARTIAL'].includes(o.status)).length

  const purchaseTypeLabels: Record<string, string> = {
    FINISHED_GOODS:     dict.purchases.purchaseTypes.FINISHED_GOODS,
    OEM:                dict.purchases.purchaseTypes.OEM,
    PACKAGING:          dict.purchases.purchaseTypes.PACKAGING,
    RAW_MATERIAL:       dict.purchases.purchaseTypes.RAW_MATERIAL,
    GIFT_PROMO:         dict.purchases.purchaseTypes.GIFT_PROMO,
    LOGISTICS_SUPPLIES: dict.purchases.purchaseTypes.LOGISTICS_SUPPLIES,
  }

  const statusFilters = [
    { value: '', label: dict.common.all },
    { value: 'DRAFT', label: dict.purchases.statuses.DRAFT },
    { value: 'PENDING_APPROVAL', label: dict.purchases.statuses.PENDING_APPROVAL },
    { value: 'SOURCING', label: dict.purchases.statuses.SOURCING },
    { value: 'CONFIRMED', label: dict.purchases.statuses.CONFIRMED },
    { value: 'PARTIAL', label: dict.purchases.statuses.PARTIAL },
    { value: 'RECEIVED', label: dict.purchases.statuses.RECEIVED },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.purchases.title}</h1>
          <p className="text-sm text-muted-foreground">
            {dict.ordersExt.totalCount} {pagination ? pagination.total : orders.length} {dict.ordersExt.records}
            {pendingCount > 0 && <span className="ml-2 text-amber-600">{pendingCount} {dict.purchasesPage.pendingArrivalLabel}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/suppliers')}>
            <Building2 className="mr-2 h-4 w-4" />{dict.suppliers.title}
          </Button>
          <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />{dict.purchases.newPurchase}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.purchasesExt.searchPlaceholder}
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusFilters.map(f => (
            <button key={f.value} onClick={() => { setFilterStatus(f.value); setPage(1) }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === f.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <select className="rounded-md border px-2 py-1 text-sm"
          value={filterSupplier}
          onChange={(e) => { setFilterSupplier(e.target.value); setPage(1) }}>
          <option value="">全部供應商</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
          ))}
        </select>
        <select className="rounded-md border px-2 py-1 text-sm"
          value={filterPayment}
          onChange={(e) => { setFilterPayment(e.target.value); setPage(1) }}>
          <option value="">付款全部</option>
          <option value="UNPAID">未付款</option>
          <option value="PARTIAL">部分付款</option>
          <option value="PAID">已付清</option>
        </select>
      </div>

      {/* Batch action bar (only visible when something selected) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-sm text-blue-800 font-medium">已選 {selectedIds.size} 張</span>
          <Button size="sm" variant="outline" onClick={() => batchStatus('PENDING_APPROVAL', '送出審批')}>送審</Button>
          <Button size="sm" variant="outline" onClick={() => batchStatus('SOURCING', '進入詢價')}>詢價</Button>
          <Button size="sm" variant="outline" onClick={() => batchStatus('ORDERED', '下單')}>下單</Button>
          <Button size="sm" variant="outline" onClick={() => batchStatus('CANCELLED', '作廢')}>作廢</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>取消選取</Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input type="checkbox"
                  checked={orders.length > 0 && selectedIds.size === orders.length}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer" />
              </TableHead>
              <TableHead className="w-36">{dict.purchases.poNo}</TableHead>
              <TableHead>{dict.purchases.supplier}</TableHead>
              <TableHead className="w-20">{dict.common.type}</TableHead>
              <TableHead className="w-24">{dict.common.status}</TableHead>
              <TableHead>{dict.ordersExt.productSummary}</TableHead>
              <TableHead className="text-right w-32">{dict.purchasesExt.totalAmount}</TableHead>
              <TableHead className="text-right w-28">{dict.purchasesExt.paidAmount}</TableHead>
              <TableHead className="w-24">{dict.purchasesExt.expectedDate}</TableHead>
              <TableHead className="w-28">到貨進度</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-16 text-center text-muted-foreground">
                  {search || filterStatus || filterSupplier || filterPayment ? dict.purchasesExt.noResults : dict.purchasesExt.noOrders}
                </TableCell>
              </TableRow>
            ) : orders.map(o => {
              const cls = statusCls[o.status] ?? ''
              const label = dict.purchases.statuses[o.status as PurchaseStatus] ?? o.status
              const unpaid = Number(o.totalAmount) - Number(o.paidAmount)
              return (
                <TableRow key={o.id} className="group cursor-pointer hover:bg-slate-50/80"
                  onClick={() => router.push(`/purchases/${o.id}`)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox"
                      checked={selectedIds.has(o.id)}
                      onChange={() => toggleId(o.id)}
                      className="h-4 w-4 cursor-pointer" />
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">{o.poNo}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.supplier.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {purchaseTypeLabels[o.orderType] ?? o.orderType}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${cls}`}>{label}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {o.items.length > 0
                      ? `${o.items[0].product?.name ?? '—'}${o.items.length > 1 ? ` ${dict.common.etcItems} ${o.items.length} ${dict.common.pieces}` : ''}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmt(o.totalAmount)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {Number(o.paidAmount) > 0 ? (
                      <div>
                        <div className="font-medium text-green-600">{fmt(o.paidAmount)}</div>
                        {unpaid > 0 && <div className="text-xs text-red-500">{dict.ordersExt.owe} {fmt(unpaid)}</div>}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.expectedDate ? (() => {
                      const days = Math.floor((new Date(o.expectedDate).getTime() - Date.now()) / 86400000)
                      const overdue = days < 0 && !['RECEIVED', 'CANCELLED'].includes(o.status)
                      return (
                        <div>
                          <div className={overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                            {fmtDate(o.expectedDate)}
                          </div>
                          {overdue && <div className="text-xs text-red-500">逾期 {Math.abs(days)} 天</div>}
                        </div>
                      )
                    })() : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(() => {
                      const totalQty = o.items.reduce((s, i) => s + Number(i.quantity || 0), 0)
                      const recvQty = o.items.reduce((s, i) => s + Number(i.receivedQty || 0), 0)
                      if (totalQty <= 0) return <span className="text-muted-foreground">—</span>
                      const pct = Math.min(100, Math.round((recvQty / totalQty) * 100))
                      const color = pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300'
                      return (
                        <div className="space-y-0.5">
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {recvQty}/{totalQty} ({pct}%)
                          </div>
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 opacity-60 hover:opacity-100 transition-opacity hover:bg-slate-100">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {['DRAFT','PENDING_APPROVAL','SOURCING'].includes(o.status) && (
                          <DropdownMenuItem onClick={() => { setEditTarget(o); setFormOpen(true) }}>
                            <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}
                          </DropdownMenuItem>
                        )}
                        {o.status === 'DRAFT' && (
                          <DropdownMenuItem onClick={() => updateStatus(o.id, 'PENDING_APPROVAL', dict.purchasesExt.submitForApproval)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />{dict.purchasesExt.submitForApproval}
                          </DropdownMenuItem>
                        )}
                        {o.status === 'PENDING_APPROVAL' && (
                          <DropdownMenuItem onClick={() => updateStatus(o.id, 'SOURCING', dict.purchasesPage.enterSourcing)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />{dict.purchasesPage.enterSourcing}
                          </DropdownMenuItem>
                        )}
                        {o.status === 'SOURCING' && (
                          <DropdownMenuItem onClick={() => updateStatus(o.id, 'CONFIRMED', dict.purchasesExt.confirmPO)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />{dict.purchasesExt.confirmPO}
                          </DropdownMenuItem>
                        )}
                        {!['RECEIVED', 'CANCELLED'].includes(o.status) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(o.id, o.poNo)} variant="destructive">
                              {o.status === 'DRAFT'
                                ? <><Trash2 className="mr-2 h-4 w-4" />{dict.common.delete}</>
                                : <><XCircle className="mr-2 h-4 w-4" />{dict.purchasesExt.cancelPO}</>}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
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

      <PurchaseForm open={formOpen} onClose={() => setFormOpen(false)}
        onSuccess={fetchOrders} order={editTarget as Parameters<typeof PurchaseForm>[0]['order']} />
    </div>
  )
}
