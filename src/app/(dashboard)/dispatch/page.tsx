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
  Search, MoreHorizontal, Loader2, CheckCircle2, XCircle, Truck,
} from 'lucide-react'
import { toast } from 'sonner'

type Status = 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'

interface DispatchOrder {
  id: string; dispatchNumber: string; date: string; status: Status; createdAt: string
  customer: { id: string; name: string }
  pickingOrder: { id: string; pickingNumber: string }
  handler: { id: string; name: string }
  warehouse: { id: string; name: string }
  items: { id: string; productName: string; quantity: string }[]
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

export default function DispatchPage() {
  const { dict } = useI18n()

  const statusConfig: Record<Status, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
    PENDING:    { label: '待派貨', variant: 'outline' },
    DISPATCHED: { label: dict.dispatch.statuses.DISPATCHED, variant: 'default', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    DELIVERED:  { label: dict.dispatch.statuses.DELIVERED, variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
    CANCELLED:  { label: dict.dispatch.statuses.CANCELLED, variant: 'destructive' },
  }

  const statusFilters = [
    { value: '', label: dict.common.all },
    { value: 'PENDING', label: '待派貨' },
    { value: 'DISPATCHED', label: dict.dispatch.statuses.DISPATCHED },
    { value: 'DELIVERED', label: dict.dispatch.statuses.DELIVERED },
  ]

  const [data, setData] = useState<DispatchOrder[]>([])
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
      const res = await fetch(`/api/dispatch-orders?${params}`)
      if (!res.ok) throw new Error()
      const result = await res.json()
      setData(result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [search, filterStatus, page])

  useEffect(() => { const t = setTimeout(fetchData, 300); return () => clearTimeout(t) }, [fetchData])

  async function updateStatus(id: string, status: string, label: string) {
    const res = await fetch(`/api/dispatch-orders/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) { toast.success(`派貨單已${label}`); fetchData() }
    else toast.error('更新失敗')
  }

  async function handleCancel(id: string, no: string) {
    if (!confirm(`確定要取消派貨單 ${no} 嗎？`)) return
    const res = await fetch(`/api/dispatch-orders/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('已取消'); fetchData() }
    else { const d = await res.json(); toast.error(d.error ?? '取消失敗') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.dispatch.title}</h1>
          <p className="text-sm text-muted-foreground">共 {pagination?.total ?? data.length} 筆</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.dispatch.searchPlaceholder}
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
              <TableHead className="w-36">{dict.dispatch.dispatchNo}</TableHead>
              <TableHead>{dict.picking.pickingNo}</TableHead>
              <TableHead>{dict.common.customer}</TableHead>
              <TableHead>{dict.common.warehouse}</TableHead>
              <TableHead className="w-20">{dict.common.status}</TableHead>
              <TableHead className="w-16">{dict.common.pieces}</TableHead>
              <TableHead className="w-20">承辦人</TableHead>
              <TableHead className="w-24">{dict.common.date}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="py-16 text-center">
                <Truck className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">{search || filterStatus ? dict.dispatch.noResults : dict.dispatch.noDispatch}</p>
              </TableCell></TableRow>
            ) : data.map(d => {
              const sc = statusConfig[d.status] ?? { label: d.status, variant: 'outline' }
              return (
                <TableRow key={d.id} className="group hover:bg-slate-50/80">
                  <TableCell className="font-mono text-sm font-medium">{d.dispatchNumber}</TableCell>
                  <TableCell className="text-sm">{d.pickingOrder.pickingNumber}</TableCell>
                  <TableCell>{d.customer.name}</TableCell>
                  <TableCell className="text-sm">{d.warehouse.name}</TableCell>
                  <TableCell><Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge></TableCell>
                  <TableCell className="text-center">{d.items.length}</TableCell>
                  <TableCell className="text-sm">{d.handler.name}</TableCell>
                  <TableCell className="text-sm">{formatDate(d.createdAt)}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {d.status === 'PENDING' && (
                          <DropdownMenuItem onClick={() => updateStatus(d.id, 'DISPATCHED', '派貨')}>
                            <Truck className="mr-2 h-4 w-4" />標記已派貨
                          </DropdownMenuItem>
                        )}
                        {d.status === 'DISPATCHED' && (
                          <DropdownMenuItem onClick={() => updateStatus(d.id, 'DELIVERED', '送達')}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />標記已送達
                          </DropdownMenuItem>
                        )}
                        {!['DELIVERED', 'CANCELLED'].includes(d.status) && (
                          <><DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCancel(d.id, d.dispatchNumber)} variant="destructive">
                            <XCircle className="mr-2 h-4 w-4" />取消
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
                <span className="font-mono text-sm font-medium">{d.dispatchNumber}</span>
                <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>{d.customer.name}</span>
                <span className="text-muted-foreground">{d.pickingOrder.pickingNumber}</span>
              </div>
              <div className="text-xs text-muted-foreground">{d.items.length} 項 · {d.warehouse.name}</div>
            </div>
          )
        })}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">共 {pagination.total} 筆，第 {pagination.page}/{pagination.totalPages} 頁</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(p => p - 1)}>{dict.common.prevPage}</Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>{dict.common.nextPage}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
