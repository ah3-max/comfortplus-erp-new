'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, Search, MoreHorizontal, Loader2, ClipboardList,
  ChevronRight, CheckCircle2, XCircle, RotateCcw, Save,
} from 'lucide-react'
import { toast } from 'sonner'

type StockCountStatus = 'DRAFT' | 'COUNTING' | 'REVIEWING' | 'COMPLETED' | 'CANCELLED'

const statusConfig: Record<StockCountStatus, { label: string; className: string }> = {
  DRAFT:      { label: '草稿',   className: 'bg-slate-100 text-slate-600' },
  COUNTING:   { label: '盤點中', className: 'bg-amber-100 text-amber-700' },
  REVIEWING:  { label: '複核中', className: 'bg-blue-100 text-blue-700' },
  COMPLETED:  { label: '已完成', className: 'bg-green-100 text-green-700' },
  CANCELLED:  { label: '已取消', className: 'bg-red-100 text-red-700' },
}

const statusFilters = [
  { value: '', label: '全部' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'COUNTING', label: '盤點中' },
  { value: 'REVIEWING', label: '複核中' },
  { value: 'COMPLETED', label: '已完成' },
]

interface StockCountBase {
  id: string; countNo: string; status: StockCountStatus; countType: string
  plannedDate: string | null; countDate: string | null; completedAt: string | null
  totalItems: number | null; totalVariance: number | null; varianceRate: string | null
  notes: string | null; createdAt: string
  warehouse: { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
}

interface StockCount extends StockCountBase {
  items: { id: string }[]
}

interface StockCountDetail extends StockCountBase {
  items: CountItem[]
}

interface CountItem {
  id: string; systemQty: number; countedQty: number; variance: number
  varianceReason: string | null; notes: string | null
  product: { id: string; sku: string; name: string; unit: string; category: string }
  lot: { id: string; lotNo: string } | null
}

interface Warehouse { id: string; name: string; code: string }

function formatDate(str: string | null) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

export default function StockCountsPage() {
  const [data, setData] = useState<StockCount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [createForm, setCreateForm] = useState({ warehouseId: '', countType: 'FULL', plannedDate: '', notes: '' })
  const [creating, setCreating] = useState(false)

  // Count detail dialog
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [countDetail, setCountDetail] = useState<StockCountDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [itemEdits, setItemEdits] = useState<Record<string, { countedQty: string; varianceReason: string }>>({})
  const [savingItems, setSavingItems] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    params.set('page', String(page))
    params.set('pageSize', '50')
    try {
      const res = await fetch(`/api/stock-counts?${params}`)
      if (!res.ok) throw new Error()
      const result = await res.json()
      setData(result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [search, filterStatus, page])

  useEffect(() => { const t = setTimeout(fetchData, 300); return () => clearTimeout(t) }, [fetchData])

  // Load warehouses for create dialog
  useEffect(() => {
    if (!showCreate) return
    fetch('/api/warehouses?pageSize=100').then(r => r.json())
      .then(d => setWarehouses(d.data ?? []))
      .catch(() => {})
  }, [showCreate])

  // Load count detail
  useEffect(() => {
    if (!selectedId) { setCountDetail(null); return }
    setLoadingDetail(true)
    setItemEdits({})
    fetch(`/api/stock-counts/${selectedId}`)
      .then(r => r.json())
      .then(d => setCountDetail(d))
      .catch(() => toast.error('載入失敗'))
      .finally(() => setLoadingDetail(false))
  }, [selectedId])

  async function createCount() {
    if (!createForm.warehouseId) { toast.error('請選擇倉庫'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/stock-counts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) throw new Error()
      const result = await res.json()
      toast.success(`盤點單 ${result.countNo} 已建立`)
      setShowCreate(false)
      setCreateForm({ warehouseId: '', countType: 'FULL', plannedDate: '', notes: '' })
      fetchData()
      setSelectedId(result.id)
    } catch { toast.error('建立失敗') }
    finally { setCreating(false) }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/stock-counts/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) {
      const labels: Record<string, string> = { COUNTING: '開始盤點', REVIEWING: '送交複核', COMPLETED: '盤點完成', CANCELLED: '已取消' }
      toast.success(labels[status] ?? '已更新')
      fetchData()
      if (selectedId) setSelectedId(selectedId) // refresh detail
    } else {
      const d = await res.json()
      toast.error(d.error ?? '更新失敗')
    }
  }

  async function saveItemCounts() {
    if (!countDetail) return
    const items = Object.entries(itemEdits).map(([itemId, vals]) => ({
      id: itemId,
      countedQty: parseInt(vals.countedQty) || 0,
      varianceReason: vals.varianceReason || undefined,
    }))
    if (!items.length) { toast.info('無變更'); return }
    setSavingItems(true)
    try {
      const res = await fetch(`/api/stock-counts/${countDetail.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error()
      toast.success('已儲存盤點數量')
      setSelectedId(countDetail.id) // refresh
    } catch { toast.error('儲存失敗') }
    finally { setSavingItems(false) }
  }

  async function handleCancel(id: string, no: string) {
    if (!confirm(`確定要取消盤點單 ${no} 嗎？`)) return
    const res = await fetch(`/api/stock-counts/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('已取消'); fetchData() }
    else { const d = await res.json(); toast.error(d.error ?? '取消失敗') }
  }

  function getItemCountedQty(item: CountItem): string {
    return itemEdits[item.id]?.countedQty ?? String(item.countedQty)
  }

  function getVariance(item: CountItem): number {
    const counted = parseInt(itemEdits[item.id]?.countedQty ?? String(item.countedQty)) || 0
    return counted - item.systemQty
  }

  const canEdit = countDetail && ['COUNTING'].includes(countDetail.status)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">庫存盤點</h1>
          <p className="text-sm text-muted-foreground">
            共 {pagination?.total ?? data.length} 筆
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />新增盤點
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜尋單號或倉庫..."
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

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">盤點單號</TableHead>
              <TableHead>倉庫</TableHead>
              <TableHead className="w-20">類型</TableHead>
              <TableHead className="w-20">狀態</TableHead>
              <TableHead className="text-right w-16">品項</TableHead>
              <TableHead className="text-right w-16">差異數</TableHead>
              <TableHead className="w-24">計畫日</TableHead>
              <TableHead className="w-24">建立</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="py-16 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              </TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="py-16 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">{search || filterStatus ? '找不到符合的盤點單' : '尚無盤點單'}</p>
              </TableCell></TableRow>
            ) : data.map(d => {
              const sc = statusConfig[d.status]
              return (
                <TableRow key={d.id} className="group cursor-pointer hover:bg-slate-50/80"
                  onClick={() => setSelectedId(d.id)}>
                  <TableCell className="font-mono text-sm font-medium">{d.countNo}</TableCell>
                  <TableCell className="text-sm">{d.warehouse.name}</TableCell>
                  <TableCell className="text-sm">{d.countType === 'FULL' ? '全盤' : '循環'}</TableCell>
                  <TableCell><Badge variant="outline" className={sc.className}>{sc.label}</Badge></TableCell>
                  <TableCell className="text-right text-sm">{d.items.length}</TableCell>
                  <TableCell className={`text-right text-sm ${(d.totalVariance ?? 0) !== 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                    {d.totalVariance != null ? (d.totalVariance > 0 ? `+${d.totalVariance}` : d.totalVariance) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(d.plannedDate)}</TableCell>
                  <TableCell className="text-sm">{formatDate(d.createdAt)}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setSelectedId(d.id)}>
                          <ChevronRight className="mr-2 h-4 w-4" />查看明細
                        </DropdownMenuItem>
                        {d.status === 'DRAFT' && (
                          <DropdownMenuItem onClick={() => updateStatus(d.id, 'COUNTING')}>
                            <ClipboardList className="mr-2 h-4 w-4" />開始盤點
                          </DropdownMenuItem>
                        )}
                        {d.status === 'COUNTING' && (
                          <DropdownMenuItem onClick={() => updateStatus(d.id, 'REVIEWING')}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />送交複核
                          </DropdownMenuItem>
                        )}
                        {d.status === 'REVIEWING' && (
                          <>
                            <DropdownMenuItem onClick={() => updateStatus(d.id, 'COMPLETED')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />確認完成
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(d.id, 'COUNTING')}>
                              <RotateCcw className="mr-2 h-4 w-4" />退回重盤
                            </DropdownMenuItem>
                          </>
                        )}
                        {!['COMPLETED', 'CANCELLED'].includes(d.status) && (
                          <><DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCancel(d.id, d.countNo)} variant="destructive">
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

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">共 {pagination.total} 筆，第 {pagination.page}/{pagination.totalPages} 頁</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>下一頁</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增盤點單</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">倉庫 *</label>
              <select className="w-full rounded-md border px-3 py-2 text-sm"
                value={createForm.warehouseId}
                onChange={e => setCreateForm(f => ({ ...f, warehouseId: e.target.value }))}>
                <option value="">選擇倉庫...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">盤點類型</label>
              <select className="w-full rounded-md border px-3 py-2 text-sm"
                value={createForm.countType}
                onChange={e => setCreateForm(f => ({ ...f, countType: e.target.value }))}>
                <option value="FULL">全盤（所有品項）</option>
                <option value="CYCLE">循環盤點（部分品項）</option>
                <option value="SPOT">抽盤</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">計畫盤點日</label>
              <Input type="date" value={createForm.plannedDate}
                onChange={e => setCreateForm(f => ({ ...f, plannedDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">備註</label>
              <Input placeholder="..." value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">建立時將自動從庫存系統帶入所有品項的帳面數量。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={createCount} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={open => { if (!open) setSelectedId(null) }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {countDetail?.countNo ?? '...'} — {countDetail ? statusConfig[countDetail.status].label : ''}
            </DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : countDetail && (
            <div className="space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">倉庫：</span>{countDetail.warehouse.name}</div>
                <div><span className="text-muted-foreground">類型：</span>{countDetail.countType}</div>
                <div><span className="text-muted-foreground">計畫日：</span>{formatDate(countDetail.plannedDate)}</div>
                <div><span className="text-muted-foreground">建立者：</span>{countDetail.createdBy.name}</div>
              </div>

              {/* Variance summary (when reviewing/completed) */}
              {['REVIEWING', 'COMPLETED'].includes(countDetail.status) && (
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">盤點品項</p>
                      <p className="text-lg font-bold">{countDetail.items.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">有差異品項</p>
                      <p className="text-lg font-bold text-amber-600">
                        {countDetail.items.filter(i => i.variance !== 0).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">總差異數量</p>
                      <p className="text-lg font-bold text-red-600">
                        {countDetail.items.reduce((s, i) => s + Math.abs(i.variance), 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {canEdit && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">輸入實際盤點數量，系統自動計算差異。</p>
                  <Button size="sm" onClick={saveItemCounts} disabled={savingItems || !Object.keys(itemEdits).length}>
                    {savingItems ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    儲存 {Object.keys(itemEdits).length > 0 && `(${Object.keys(itemEdits).length})`}
                  </Button>
                </div>
              )}

              {/* Items table */}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>品項</TableHead>
                      <TableHead className="text-right w-24">帳面數量</TableHead>
                      <TableHead className="text-right w-28">實際盤點</TableHead>
                      <TableHead className="text-right w-20">差異</TableHead>
                      <TableHead className="w-32">差異原因</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {countDetail.items.map(item => {
                      const variance = getVariance(item)
                      return (
                        <TableRow key={item.id} className={variance !== 0 ? 'bg-amber-50/50' : ''}>
                          <TableCell>
                            <div className="text-sm font-medium">{item.product.name}</div>
                            <div className="text-xs text-muted-foreground">{item.product.sku} · {item.product.unit}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{item.systemQty}</TableCell>
                          <TableCell className="p-1">
                            {canEdit ? (
                              <Input
                                type="number"
                                className="h-8 text-right w-24 ml-auto"
                                value={getItemCountedQty(item)}
                                onChange={e => setItemEdits(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], countedQty: e.target.value, varianceReason: prev[item.id]?.varianceReason ?? '' },
                                }))}
                              />
                            ) : (
                              <span className="block text-right pr-2">{item.countedQty}</span>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {variance === 0 ? '—' : variance > 0 ? `+${variance}` : variance}
                          </TableCell>
                          <TableCell className="p-1">
                            {canEdit && variance !== 0 ? (
                              <Input
                                className="h-8 text-sm w-full"
                                placeholder="原因..."
                                value={itemEdits[item.id]?.varianceReason ?? item.varianceReason ?? ''}
                                onChange={e => setItemEdits(prev => ({
                                  ...prev,
                                  [item.id]: { countedQty: prev[item.id]?.countedQty ?? String(item.countedQty), varianceReason: e.target.value },
                                }))}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">{item.varianceReason ?? '—'}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Status action buttons */}
              <div className="flex justify-end gap-2 pt-2">
                {countDetail.status === 'DRAFT' && (
                  <Button onClick={() => updateStatus(countDetail.id, 'COUNTING')}>
                    <ClipboardList className="mr-2 h-4 w-4" />開始盤點
                  </Button>
                )}
                {countDetail.status === 'COUNTING' && (
                  <Button onClick={() => updateStatus(countDetail.id, 'REVIEWING')}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />送交複核
                  </Button>
                )}
                {countDetail.status === 'REVIEWING' && (
                  <>
                    <Button variant="outline" onClick={() => updateStatus(countDetail.id, 'COUNTING')}>
                      <RotateCcw className="mr-2 h-4 w-4" />退回重盤
                    </Button>
                    <Button onClick={() => updateStatus(countDetail.id, 'COMPLETED')}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />確認完成並調整庫存
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
