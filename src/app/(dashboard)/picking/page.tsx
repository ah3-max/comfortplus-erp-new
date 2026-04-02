'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  Plus, Search, MoreHorizontal, Loader2, CheckCircle2, XCircle,
  ClipboardCheck, PackageCheck, Printer, Edit2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Status = 'PENDING' | 'PICKING' | 'PICKED' | 'CANCELLED'

interface PickingOrder {
  id: string; pickingNumber: string; date: string; status: Status; createdAt: string
  scheduledDate: string | null; shippingAddress: string | null
  customer: { id: string; name: string }
  salesInvoice: { id: string; invoiceNumber: string }
  handler: { id: string; name: string }
  warehouse: { id: string; name: string }
  items: { id: string; productName: string; quantity: string; pickedQuantity: string }[]
  dispatchOrder: { id: string; dispatchNumber: string } | null
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

export default function PickingPage() {
  const { dict } = useI18n()
  const router = useRouter()

  const statusConfig: Record<Status, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
    PENDING:   { label: dict.picking.statuses.PENDING, variant: 'outline' },
    PICKING:   { label: dict.picking.statuses.PICKING, variant: 'default', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    PICKED:    { label: dict.picking.statuses.COMPLETED, variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
    CANCELLED: { label: dict.picking.statuses.CANCELLED, variant: 'destructive' },
  }

  const statusFilters = [
    { value: '', label: dict.common.all },
    { value: 'PENDING', label: dict.picking.statuses.PENDING },
    { value: 'PICKING', label: dict.picking.statuses.PICKING },
    { value: 'PICKED', label: dict.picking.statuses.COMPLETED },
  ]
  const [data, setData] = useState<PickingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/picking-orders?${params}`)
      if (!res.ok) throw new Error()
      const result = await res.json()
      setData(result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [search, filterStatus, page])

  useEffect(() => { const t = setTimeout(fetchData, 300); return () => clearTimeout(t) }, [fetchData])

  async function updateStatus(id: string, status: string, label: string) {
    const res = await fetch(`/api/picking-orders/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) { toast.success(`${dict.picking.statusUpdated}${label}`); fetchData() }
    else toast.error(dict.common.updateFailed)
  }

  async function handleCancel(id: string, no: string) {
    if (!confirm(`${dict.picking.cancelConfirmPrefix} ${no} ${dict.picking.cancelSuffix}`)) return
    const res = await fetch(`/api/picking-orders/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.common.cancelSuccess); fetchData() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.operationFailed) }
  }

  // Picked quantity dialog
  const [pickQtyOrder, setPickQtyOrder] = useState<PickingOrder | null>(null)
  const [pickQtyValues, setPickQtyValues] = useState<Record<string, string>>({})
  const [savingPickQty, setSavingPickQty] = useState(false)

  function openPickQtyDialog(order: PickingOrder) {
    const initial: Record<string, string> = {}
    order.items.forEach(item => {
      initial[item.id] = String(Number(item.pickedQuantity) > 0 ? item.pickedQuantity : item.quantity)
    })
    setPickQtyValues(initial)
    setPickQtyOrder(order)
  }

  async function savePickedQty() {
    if (!pickQtyOrder) return
    setSavingPickQty(true)
    const items = pickQtyOrder.items.map(item => ({
      itemId: item.id,
      pickedQuantity: Number(pickQtyValues[item.id] ?? item.quantity),
    }))
    const res = await fetch(`/api/picking-orders/${pickQtyOrder.id}/short-pick`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    setSavingPickQty(false)
    if (res.ok) {
      toast.success('揀貨數量已更新')
      setPickQtyOrder(null)
      fetchData()
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.updateFailed)
    }
  }

  const pendingCount = data.filter(d => d.status === 'PENDING').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.picking.title}</h1>
          <p className="text-sm text-muted-foreground">
            {dict.ordersExt.totalCount} {pagination?.total ?? data.length} {dict.ordersExt.records}
            {pendingCount > 0 && <span className="ml-2 text-amber-600">{pendingCount} {dict.picking.pendingPicking}</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.picking.searchPlaceholder}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusFilters.map(f => (
            <button key={f.value} onClick={() => { setFilterStatus(f.value); setPage(1) }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === f.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="hidden md:block rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">{dict.picking.pickingNo}</TableHead>
              <TableHead>{dict.salesInvoices.invoiceNo}</TableHead>
              <TableHead>{dict.common.customer}</TableHead>
              <TableHead>{dict.common.warehouse}</TableHead>
              <TableHead className="w-20">{dict.common.status}</TableHead>
              <TableHead className="w-16">{dict.common.pieces}</TableHead>
              <TableHead className="w-24">{dict.ordersExt.shipDate}</TableHead>
              <TableHead className="w-24">{dict.dispatch.dispatchNo}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="py-16 text-center">
                <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">{search || filterStatus ? dict.picking.noResults : dict.picking.noPicking}</p>
              </TableCell></TableRow>
            ) : data.map(d => {
              const sc = statusConfig[d.status] ?? { label: d.status, variant: 'outline' }
              return (
                <TableRow key={d.id} className="group cursor-pointer hover:bg-slate-50/80">
                  <TableCell className="font-mono text-sm font-medium">{d.pickingNumber}</TableCell>
                  <TableCell className="text-sm">{d.salesInvoice.invoiceNumber}</TableCell>
                  <TableCell>{d.customer.name}</TableCell>
                  <TableCell className="text-sm">{d.warehouse.name}</TableCell>
                  <TableCell><Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge></TableCell>
                  <TableCell className="text-center">{d.items.length}</TableCell>
                  <TableCell className="text-sm">{d.scheduledDate ? formatDate(d.scheduledDate) : '—'}</TableCell>
                  <TableCell className="text-sm" onClick={e => e.stopPropagation()}>
                    {d.dispatchOrder ? (
                      <Link href="/dispatch" className="text-blue-600 hover:underline">
                        {d.dispatchOrder.dispatchNumber}
                      </Link>
                    ) : '—'}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {d.status === 'PENDING' && (
                          <DropdownMenuItem onClick={() => updateStatus(d.id, 'PICKING', dict.picking.startPicking)}>
                            <PackageCheck className="mr-2 h-4 w-4" />{dict.picking.startPicking}
                          </DropdownMenuItem>
                        )}
                        {d.status === 'PICKING' && (<>
                          <DropdownMenuItem onClick={() => openPickQtyDialog(d)}>
                            <Edit2 className="mr-2 h-4 w-4" />輸入揀貨數量
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(d.id, 'PICKED', dict.picking.statuses.COMPLETED)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />{dict.picking.completePicking}
                          </DropdownMenuItem>
                        </>)}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => window.open(`/api/picking-orders/${d.id}/print`, '_blank')}>
                          <Printer className="mr-2 h-4 w-4" />列印揀貨單
                        </DropdownMenuItem>
                        {!['PICKED', 'CANCELLED'].includes(d.status) && (
                          <><DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCancel(d.id, d.pickingNumber)} variant="destructive">
                            <XCircle className="mr-2 h-4 w-4" />{dict.common.cancel}
                          </DropdownMenuItem></>
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

      {/* Mobile */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        ) : data.map(d => {
          const sc = statusConfig[d.status] ?? { label: d.status, variant: 'outline' as const }
          return (
            <div key={d.id} className="rounded-lg border bg-white p-4 space-y-2 active:scale-[0.97] transition-transform">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium">{d.pickingNumber}</span>
                <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>{d.customer.name}</span>
                <span className="text-muted-foreground">{d.salesInvoice.invoiceNumber}</span>
              </div>
              <div className="text-xs text-muted-foreground">{d.items.length} {dict.picking.itemsUnit} · {d.warehouse.name}</div>
            </div>
          )
        })}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">{dict.ordersExt.totalCount} {pagination.total} {dict.ordersExt.records}，{dict.common.pagePrefix} {pagination.page}/{pagination.totalPages} {dict.common.pageSuffix}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(p => p - 1)}>{dict.common.prevPage}</Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>{dict.common.nextPage}</Button>
          </div>
        </div>
      )}

      {/* Picked Quantity Dialog */}
      <Dialog open={!!pickQtyOrder} onOpenChange={open => { if (!open) setPickQtyOrder(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" />
              輸入揀貨數量 — {pickQtyOrder?.pickingNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
            {pickQtyOrder?.items.map(item => (
              <div key={item.id} className="grid grid-cols-3 gap-3 items-center">
                <div className="col-span-2 text-sm font-medium truncate">{item.productName}</div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={Number(item.quantity)}
                    className="h-8 text-sm"
                    value={pickQtyValues[item.id] ?? item.quantity}
                    onChange={e => setPickQtyValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">/ {item.quantity}</Label>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickQtyOrder(null)}>取消</Button>
            <Button onClick={savePickedQty} disabled={savingPickQty} className="gap-2">
              {savingPickQty && <Loader2 className="h-4 w-4 animate-spin" />}
              儲存數量
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
