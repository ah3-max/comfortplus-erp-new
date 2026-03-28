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
  items: Array<{ product: { name: string } }>
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
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PurchaseOrder | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
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
  }, [search, filterStatus, page])

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
    if (res.ok) { toast.success(`採購單已${label}`); fetchOrders() }
    else toast.error(dict.common.updateFailed)
  }

  async function handleDelete(id: string, no: string) {
    if (!confirm(`確定要刪除採購單 ${no} 嗎？`)) return
    const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('採購單已刪除'); fetchOrders() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.deleteFailed) }
  }

  const pendingCount = orders.filter(o => o.status === 'CONFIRMED').length

  const purchaseTypeLabels: Record<string, string> = {
    FINISHED_GOODS:     '成品', OEM: 'OEM',
    PACKAGING:          '包材', RAW_MATERIAL: '原物料',
    GIFT_PROMO:         '贈品', LOGISTICS_SUPPLIES: '物流耗材',
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
            共 {pagination ? pagination.total : orders.length} 筆
            {pendingCount > 0 && <span className="ml-2 text-amber-600">{pendingCount} 筆待到貨</span>}
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
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">{dict.purchases.poNo}</TableHead>
              <TableHead>{dict.purchases.supplier}</TableHead>
              <TableHead className="w-20">{dict.common.type}</TableHead>
              <TableHead className="w-24">{dict.common.status}</TableHead>
              <TableHead>商品摘要</TableHead>
              <TableHead className="text-right w-32">{dict.purchasesExt.totalAmount}</TableHead>
              <TableHead className="text-right w-28">{dict.purchasesExt.paidAmount}</TableHead>
              <TableHead className="w-24">{dict.purchasesExt.expectedDate}</TableHead>
              <TableHead className="w-16">{dict.purchases.receive}</TableHead>
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
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-16 text-center text-muted-foreground">
                  {search || filterStatus ? dict.purchasesExt.noResults : dict.purchasesExt.noOrders}
                </TableCell>
              </TableRow>
            ) : orders.map(o => {
              const cls = statusCls[o.status] ?? ''
              const label = dict.purchases.statuses[o.status as PurchaseStatus] ?? o.status
              const unpaid = Number(o.totalAmount) - Number(o.paidAmount)
              return (
                <TableRow key={o.id} className="group cursor-pointer hover:bg-slate-50/80"
                  onClick={() => router.push(`/purchases/${o.id}`)}>
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
                      ? `${o.items[0].product.name}${o.items.length > 1 ? ` 等 ${o.items.length} 項` : ''}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmt(o.totalAmount)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {Number(o.paidAmount) > 0 ? (
                      <div>
                        <div className="font-medium text-green-600">{fmt(o.paidAmount)}</div>
                        {unpaid > 0 && <div className="text-xs text-red-500">欠 {fmt(unpaid)}</div>}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {o.expectedDate ? fmtDate(o.expectedDate) : '—'}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {o._count.receipts > 0
                      ? <span className="text-blue-600 font-medium">{o._count.receipts}</span>
                      : '—'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {['DRAFT','PENDING_APPROVAL','SOURCING'].includes(o.status) && (
                          <DropdownMenuItem onClick={() => { setEditTarget(o); setFormOpen(true) }}>
                            <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}
                          </DropdownMenuItem>
                        )}
                        {o.status === 'DRAFT' && (
                          <DropdownMenuItem onClick={() => updateStatus(o.id, 'PENDING_APPROVAL', '送審')}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />{dict.purchasesExt.submitForApproval}
                          </DropdownMenuItem>
                        )}
                        {o.status === 'PENDING_APPROVAL' && (
                          <DropdownMenuItem onClick={() => updateStatus(o.id, 'SOURCING', '詢價')}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />進入詢價比價
                          </DropdownMenuItem>
                        )}
                        {o.status === 'SOURCING' && (
                          <DropdownMenuItem onClick={() => updateStatus(o.id, 'CONFIRMED', '確認')}>
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

      <PurchaseForm open={formOpen} onClose={() => setFormOpen(false)}
        onSuccess={fetchOrders} order={editTarget as Parameters<typeof PurchaseForm>[0]['order']} />
    </div>
  )
}
