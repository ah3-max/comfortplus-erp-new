'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  CheckCircle2, XCircle, PackageCheck, FileText, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

type ReceiptStatus = 'DRAFT' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED'

const statusConfig: Record<ReceiptStatus, {
  label: string
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  className?: string
}> = {
  DRAFT:     { label: '草稿', variant: 'outline' },
  CONFIRMED: { label: '已確認', variant: 'secondary' },
  RECEIVED:  { label: '已入庫', variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED: { label: '已取消', variant: 'destructive' },
}

const statusFilters = [
  { value: '', label: '全部' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'CONFIRMED', label: '已確認' },
  { value: 'RECEIVED', label: '已入庫' },
]

interface ReceiptItem {
  id: string; productId: string; productName: string; specification: string | null
  quantity: string; bomVersion: string | null; unit: string | null; memo: string | null
  manufacturedItemId: string | null; resourceInput: string | null; productionTime: string | null
  product: { sku: string; name: string; unit: string | null }
}

interface Receipt {
  id: string; receiptNumber: string; date: string; status: ReceiptStatus
  notes: string | null; createdAt: string
  factoryId: string; receivingWarehouseId: string; handlerId: string
  productionOrderId: string | null
  factory: { id: string; name: string; code: string }
  receivingWarehouse: { id: string; name: string; code: string }
  handler: { id: string; name: string }
  productionOrder: { id: string; productionNo: string } | null
  createdBy: { id: string; name: string }
  items: ReceiptItem[]
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

// ── Form types ──
interface FormItem {
  productId: string; productName: string; specification: string
  quantity: number; bomVersion: string; unit: string; memo: string
}
interface FormData {
  factoryId: string; receivingWarehouseId: string; handlerId: string
  productionOrderId: string; date: string; notes: string
  items: FormItem[]
}

const emptyItem: FormItem = { productId: '', productName: '', specification: '', quantity: 1, bomVersion: '', unit: '', memo: '' }
const emptyForm: FormData = {
  factoryId: '', receivingWarehouseId: '', handlerId: '',
  productionOrderId: '', date: new Date().toISOString().slice(0, 10), notes: '',
  items: [{ ...emptyItem }],
}

export default function ProductionReceiptsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
  const [formOpen, setFormOpen] = useState(searchParams.get('action') === 'new')
  const [editTarget, setEditTarget] = useState<Receipt | null>(null)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; unit: string | null }[]>([])
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; code: string }[]>([])
  const [productionOrders, setProductionOrders] = useState<{ id: string; productionNo: string }[]>([])

  const fetchReceipts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/production-receipts?${params}`)
      if (!res.ok) throw new Error('載入失敗')
      const result = await res.json()
      setReceipts(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error('入庫單載入失敗')
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, page])

  useEffect(() => {
    const t = setTimeout(fetchReceipts, 300)
    return () => clearTimeout(t)
  }, [fetchReceipts])

  // Load reference data when form opens
  useEffect(() => {
    if (!formOpen) return
    Promise.all([
      fetch('/api/warehouses?pageSize=100').then(r => r.json()),
      fetch('/api/users?pageSize=100').then(r => r.json()),
      fetch('/api/products?pageSize=500').then(r => r.json()),
      fetch('/api/suppliers?pageSize=200').then(r => r.json()),
      fetch('/api/production-orders?pageSize=200').then(r => r.json()),
    ]).then(([wRes, uRes, pRes, sRes, poRes]) => {
      setWarehouses((wRes.data ?? wRes) || [])
      setUsers((uRes.data ?? uRes) || [])
      setProducts((pRes.data ?? pRes) || [])
      setSuppliers((sRes.data ?? sRes) || [])
      setProductionOrders((poRes.data ?? poRes) || [])
    }).catch(() => toast.error('載入參考資料失敗'))
  }, [formOpen])

  function openCreate() {
    setEditTarget(null)
    setForm({ ...emptyForm })
    setFormOpen(true)
  }

  function openEdit(rcpt: Receipt) {
    setEditTarget(rcpt)
    setForm({
      factoryId: rcpt.factoryId,
      receivingWarehouseId: rcpt.receivingWarehouseId,
      handlerId: rcpt.handlerId,
      productionOrderId: rcpt.productionOrderId ?? '',
      date: rcpt.date.slice(0, 10),
      notes: rcpt.notes ?? '',
      items: rcpt.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        specification: i.specification ?? '',
        quantity: Number(i.quantity),
        bomVersion: i.bomVersion ?? '',
        unit: i.unit ?? '',
        memo: i.memo ?? '',
      })),
    })
    setFormOpen(true)
  }

  async function handleSubmit() {
    if (!form.factoryId) { toast.error('請選擇工廠'); return }
    if (!form.receivingWarehouseId) { toast.error('請選擇收貨倉庫'); return }
    if (form.items.some(i => !i.productId || i.quantity <= 0)) { toast.error('請確認品項資料'); return }

    setSaving(true)
    try {
      const url = editTarget ? `/api/production-receipts/${editTarget.id}` : '/api/production-receipts'
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
      toast.success(editTarget ? '入庫單已更新' : '入庫單已建立')
      setFormOpen(false)
      fetchReceipts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: string, label: string) {
    const res = await fetch(`/api/production-receipts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) { toast.success(`入庫單已${label}`); fetchReceipts() }
    else toast.error('更新失敗')
  }

  async function handleCancel(id: string, no: string) {
    if (!confirm(`確定要取消入庫單 ${no} 嗎？`)) return
    const res = await fetch(`/api/production-receipts/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('入庫單已取消'); fetchReceipts() }
    else {
      const data = await res.json()
      toast.error(data.error ?? '取消失敗')
    }
  }

  function updateItem(idx: number, field: keyof FormItem, value: string | number) {
    setForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      if (field === 'productId') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          items[idx].productName = prod.name
          items[idx].unit = prod.unit ?? ''
        }
      }
      return { ...prev, items }
    })
  }

  function removeItem(idx: number) {
    if (form.items.length <= 1) return
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  const draftCount = receipts.filter(i => i.status === 'DRAFT').length
  const confirmedCount = receipts.filter(i => i.status === 'CONFIRMED').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">生產入庫管理</h1>
          <p className="text-sm text-muted-foreground">
            共 {pagination ? pagination.total : receipts.length} 筆
            {draftCount > 0 && <span className="ml-2 text-amber-600">{draftCount} 筆草稿</span>}
            {confirmedCount > 0 && <span className="ml-2 text-blue-600">{confirmedCount} 筆已確認</span>}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />新增入庫單
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜尋單號或工廠名稱..."
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
              <TableHead className="w-40">入庫單號</TableHead>
              <TableHead>工廠</TableHead>
              <TableHead>收貨倉</TableHead>
              <TableHead>生產工單</TableHead>
              <TableHead className="w-24">狀態</TableHead>
              <TableHead className="w-20 text-center">品項數</TableHead>
              <TableHead className="w-24">日期</TableHead>
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
            ) : receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {search || filterStatus ? '找不到符合的入庫單' : '尚無入庫單資料'}
                    </p>
                    {!search && !filterStatus && (
                      <Button variant="outline" size="sm" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />新增第一筆入庫單
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((rcpt) => {
                const sc = statusConfig[rcpt.status] ?? { label: rcpt.status, variant: 'outline' }
                return (
                  <TableRow key={rcpt.id} className="group cursor-pointer hover:bg-slate-50/80"
                    onClick={() => router.push(`/production-receipts/${rcpt.id}`)}>
                    <TableCell className="font-mono text-sm font-medium">{rcpt.receiptNumber}</TableCell>
                    <TableCell className="text-sm">{rcpt.factory.name}</TableCell>
                    <TableCell className="text-sm">{rcpt.receivingWarehouse.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rcpt.productionOrder ? rcpt.productionOrder.productionNo : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{rcpt.items.length}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(rcpt.createdAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {rcpt.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => openEdit(rcpt)}>
                              <Pencil className="mr-2 h-4 w-4" />編輯
                            </DropdownMenuItem>
                          )}
                          {rcpt.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => updateStatus(rcpt.id, 'CONFIRMED', '確認')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />確認入庫單
                            </DropdownMenuItem>
                          )}
                          {rcpt.status === 'CONFIRMED' && (
                            <DropdownMenuItem onClick={() => updateStatus(rcpt.id, 'RECEIVED', '入庫')}>
                              <PackageCheck className="mr-2 h-4 w-4" />標記已入庫
                            </DropdownMenuItem>
                          )}
                          {!['RECEIVED', 'CANCELLED'].includes(rcpt.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleCancel(rcpt.id, rcpt.receiptNumber)} variant="destructive">
                                <XCircle className="mr-2 h-4 w-4" />取消入庫單
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
        ) : receipts.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {search || filterStatus ? '找不到符合的入庫單' : '尚無入庫單資料'}
              </p>
            </div>
          </div>
        ) : (
          receipts.map((rcpt) => {
            const sc = statusConfig[rcpt.status] ?? { label: rcpt.status, variant: 'outline' as const }
            return (
              <div key={rcpt.id}
                className="rounded-lg border bg-white p-4 space-y-2 cursor-pointer active:scale-[0.97] transition-transform"
                onClick={() => router.push(`/production-receipts/${rcpt.id}`)}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{rcpt.receiptNumber}</span>
                  <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{rcpt.factory.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(rcpt.createdAt)}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  收貨倉：{rcpt.receivingWarehouse.name}
                  {rcpt.productionOrder && ` | 工單：${rcpt.productionOrder.productionNo}`}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{rcpt.items.length} 項品項</span>
                  <span className="text-muted-foreground">{rcpt.handler.name}</span>
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
              上一頁
            </Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}>
              下一頁
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? '編輯入庫單' : '新增入庫單'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>工廠 *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.factoryId} onChange={e => setForm(f => ({ ...f, factoryId: e.target.value }))}>
                  <option value="">選擇工廠</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>收貨倉庫 *</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.receivingWarehouseId} onChange={e => setForm(f => ({ ...f, receivingWarehouseId: e.target.value }))}>
                  <option value="">選擇收貨倉庫</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                </select>
              </div>
              <div>
                <Label>日期</Label>
                <Input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>生產工單</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.productionOrderId} onChange={e => setForm(f => ({ ...f, productionOrderId: e.target.value }))}>
                  <option value="">選擇生產工單 (選填)</option>
                  {productionOrders.map(po => <option key={po.id} value={po.id}>{po.productionNo}</option>)}
                </select>
              </div>
              <div>
                <Label>承辦人</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.handlerId} onChange={e => setForm(f => ({ ...f, handlerId: e.target.value }))}>
                  <option value="">選擇承辦人</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">明細項目</Label>
                <Button variant="outline" size="sm"
                  onClick={() => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }))}>
                  <Plus className="mr-1 h-3 w-3" />新增品項
                </Button>
              </div>
              <div className="space-y-3">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-slate-50">
                    <div className="col-span-12 md:col-span-4">
                      <Label className="text-xs">品項</Label>
                      <select className="w-full rounded-md border px-2 py-1.5 text-sm"
                        value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}>
                        <option value="">選擇品項</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-xs">數量</Label>
                      <Input type="number" min={1} value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-xs">BOM版本</Label>
                      <Input value={item.bomVersion}
                        onChange={e => updateItem(idx, 'bomVersion', e.target.value)} />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <Label className="text-xs">單位</Label>
                      <Input value={item.unit} readOnly className="bg-slate-100" />
                    </div>
                    <div className="col-span-1 md:col-span-2 flex items-end">
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
            </div>

            <div>
              <Label>備註</Label>
              <Textarea value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>取消</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editTarget ? '更新' : '建立'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
