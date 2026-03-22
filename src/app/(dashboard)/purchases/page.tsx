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

type PurchaseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'SOURCING' | 'CONFIRMED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'

const statusConfig: Record<PurchaseStatus, { label: string; cls: string }> = {
  DRAFT:            { label: '草稿',   cls: 'border-slate-300 text-slate-600' },
  PENDING_APPROVAL: { label: '審核中', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  SOURCING:         { label: '詢價中', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  CONFIRMED:        { label: '已確認', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  PARTIAL:          { label: '部分到貨', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  RECEIVED:         { label: '已到貨', cls: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED:        { label: '已取消', cls: 'bg-red-100 text-red-700 border-red-200' },
}

const purchaseTypeLabels: Record<string, string> = {
  FINISHED_GOODS:     '成品', OEM: 'OEM',
  PACKAGING:          '包材', RAW_MATERIAL: '原物料',
  GIFT_PROMO:         '贈品', LOGISTICS_SUPPLIES: '物流耗材',
}

const statusFilters = [
  { value: '', label: '全部' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING_APPROVAL', label: '審核中' },
  { value: 'SOURCING', label: '詢價中' },
  { value: 'CONFIRMED', label: '已確認' },
  { value: 'PARTIAL', label: '部分到貨' },
  { value: 'RECEIVED', label: '已到貨' },
]

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
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PurchaseOrder | null>(null)


  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    const res = await fetch(`/api/purchases?${params}`)
    setOrders(await res.json())
    setLoading(false)
  }, [search, filterStatus])

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
    else toast.error('更新失敗')
  }

  async function handleDelete(id: string, no: string) {
    if (!confirm(`確定要刪除採購單 ${no} 嗎？`)) return
    const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('採購單已刪除'); fetchOrders() }
    else { const d = await res.json(); toast.error(d.error ?? '刪除失敗') }
  }

  const pendingCount = orders.filter(o => o.status === 'CONFIRMED').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">採購管理</h1>
          <p className="text-sm text-muted-foreground">
            共 {orders.length} 筆
            {pendingCount > 0 && <span className="ml-2 text-amber-600">{pendingCount} 筆待到貨</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/suppliers')}>
            <Building2 className="mr-2 h-4 w-4" />管理供應商
          </Button>
          <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />新增採購單
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜尋採購單號或供應商..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusFilters.map(f => (
            <button key={f.value} onClick={() => setFilterStatus(f.value)}
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
              <TableHead className="w-36">採購單號</TableHead>
              <TableHead>供應商</TableHead>
              <TableHead className="w-20">類型</TableHead>
              <TableHead className="w-24">狀態</TableHead>
              <TableHead>商品摘要</TableHead>
              <TableHead className="text-right w-32">採購金額</TableHead>
              <TableHead className="text-right w-28">已付款</TableHead>
              <TableHead className="w-24">預計到貨</TableHead>
              <TableHead className="w-16">驗收單</TableHead>
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
                  {search || filterStatus ? '找不到符合的採購單' : '尚無採購單，點擊右上角新增'}
                </TableCell>
              </TableRow>
            ) : orders.map(o => {
              const sc = statusConfig[o.status] ?? { label: o.status, cls: '' }
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
                    <Badge variant="outline" className={`text-xs ${sc.cls}`}>{sc.label}</Badge>
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
                            <Pencil className="mr-2 h-4 w-4" />編輯
                          </DropdownMenuItem>
                        )}
                        {o.status === 'DRAFT' && (
                          <DropdownMenuItem onClick={() => updateStatus(o.id, 'PENDING_APPROVAL', '送審')}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />送採購審核
                          </DropdownMenuItem>
                        )}
                        {o.status === 'PENDING_APPROVAL' && (
                          <DropdownMenuItem onClick={() => updateStatus(o.id, 'SOURCING', '詢價')}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />進入詢價比價
                          </DropdownMenuItem>
                        )}
                        {o.status === 'SOURCING' && (
                          <DropdownMenuItem onClick={() => updateStatus(o.id, 'CONFIRMED', '確認')}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />確認採購單
                          </DropdownMenuItem>
                        )}
                        {!['RECEIVED', 'CANCELLED'].includes(o.status) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(o.id, o.poNo)} variant="destructive">
                              {o.status === 'DRAFT'
                                ? <><Trash2 className="mr-2 h-4 w-4" />刪除</>
                                : <><XCircle className="mr-2 h-4 w-4" />取消採購單</>}
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

      <PurchaseForm open={formOpen} onClose={() => setFormOpen(false)}
        onSuccess={fetchOrders} order={editTarget as Parameters<typeof PurchaseForm>[0]['order']} />
    </div>
  )
}
