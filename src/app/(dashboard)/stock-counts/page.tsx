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
import { useI18n } from '@/lib/i18n/context'

type StockCountStatus = 'DRAFT' | 'COUNTING' | 'REVIEWING' | 'COMPLETED' | 'CANCELLED'

const STATUS_COLORS: Record<StockCountStatus, string> = {
  DRAFT:      'bg-slate-100 text-slate-600',
  COUNTING:   'bg-amber-100 text-amber-700',
  REVIEWING:  'bg-blue-100 text-blue-700',
  COMPLETED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
}

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
  const { dict } = useI18n()
  const sc = dict.stockCounts
  const STATUS_LABELS = sc.statusLabels as Record<string, string>
  const STATUS_UPDATE_LABELS = sc.statusUpdateLabels as Record<string, string>

  const statusFilters = [
    { value: '', label: sc.filterAll },
    { value: 'DRAFT', label: STATUS_LABELS.DRAFT },
    { value: 'COUNTING', label: STATUS_LABELS.COUNTING },
    { value: 'REVIEWING', label: STATUS_LABELS.REVIEWING },
    { value: 'COMPLETED', label: STATUS_LABELS.COMPLETED },
  ]

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
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [search, filterStatus, page])

  useEffect(() => { const t = setTimeout(fetchData, 300); return () => clearTimeout(t) }, [fetchData])

  // Load warehouses for create dialog
  useEffect(() => {
    if (!showCreate) return
    fetch('/api/warehouses?pageSize=100').then(r => r.json())
      .then(d => setWarehouses(Array.isArray(d) ? d : (d.data ?? [])))
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
      .catch(() => toast.error(dict.common.loadFailed))
      .finally(() => setLoadingDetail(false))
  }, [selectedId])

  async function createCount() {
    if (!createForm.warehouseId) { toast.error(sc.warehouseRequired); return }
    setCreating(true)
    try {
      const res = await fetch('/api/stock-counts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) throw new Error()
      const result = await res.json()
      toast.success(sc.createdMsg.replace('{no}', result.countNo))
      setShowCreate(false)
      setCreateForm({ warehouseId: '', countType: 'FULL', plannedDate: '', notes: '' })
      fetchData()
      setSelectedId(result.id)
    } catch { toast.error(dict.common.createFailed) }
    finally { setCreating(false) }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/stock-counts/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    if (res.ok) {
      toast.success(STATUS_UPDATE_LABELS[status] ?? dict.common.updateSuccess)
      fetchData()
      if (selectedId) setSelectedId(selectedId) // refresh detail
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.updateFailed)
    }
  }

  async function saveItemCounts() {
    if (!countDetail) return
    const items = Object.entries(itemEdits).map(([itemId, vals]) => ({
      id: itemId,
      countedQty: parseInt(vals.countedQty) || 0,
      varianceReason: vals.varianceReason || undefined,
    }))
    if (!items.length) { toast.info(sc.noChanges); return }
    setSavingItems(true)
    try {
      const res = await fetch(`/api/stock-counts/${countDetail.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error()
      toast.success(sc.quantitySaved)
      setSelectedId(countDetail.id) // refresh
    } catch { toast.error(dict.common.saveFailed) }
    finally { setSavingItems(false) }
  }

  async function handleCancel(id: string, no: string) {
    if (!confirm(sc.cancelConfirm.replace('{no}', no))) return
    const res = await fetch(`/api/stock-counts/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.common.cancelSuccess); fetchData() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.operationFailed) }
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
          <h1 className="text-2xl font-bold text-slate-900">{sc.title}</h1>
          <p className="text-sm text-muted-foreground">
            {sc.totalCountText.replace('{n}', String(pagination?.total ?? data.length))}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />{sc.newCount}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={sc.searchPlaceholder}
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
              <TableHead className="w-36">{sc.countNo}</TableHead>
              <TableHead>{dict.common.warehouse}</TableHead>
              <TableHead className="w-20">{dict.common.type}</TableHead>
              <TableHead className="w-20">{dict.common.status}</TableHead>
              <TableHead className="text-right w-16">{sc.colItems}</TableHead>
              <TableHead className="text-right w-16">{sc.colVariance}</TableHead>
              <TableHead className="w-24">{sc.colPlannedDate}</TableHead>
              <TableHead className="w-24">{dict.common.createdAt}</TableHead>
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
                <p className="text-muted-foreground">{search || filterStatus ? sc.noResults : sc.noCounts}</p>
              </TableCell></TableRow>
            ) : data.map(d => {
              const statusClass = STATUS_COLORS[d.status]
              const statusLabel = STATUS_LABELS[d.status] ?? d.status
              return (
                <TableRow key={d.id} className="group cursor-pointer hover:bg-slate-50/80"
                  onClick={() => setSelectedId(d.id)}>
                  <TableCell className="font-mono text-sm font-medium">{d.countNo}</TableCell>
                  <TableCell className="text-sm">{d.warehouse.name}</TableCell>
                  <TableCell className="text-sm">
                    {d.countType === 'FULL' ? sc.countTypeFull : sc.countTypeCycle}
                  </TableCell>
                  <TableCell><Badge variant="outline" className={statusClass}>{statusLabel}</Badge></TableCell>
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
                          <ChevronRight className="mr-2 h-4 w-4" />{sc.actionViewDetail}
                        </DropdownMenuItem>
                        {d.status === 'DRAFT' && (
                          <DropdownMenuItem onClick={() => updateStatus(d.id, 'COUNTING')}>
                            <ClipboardList className="mr-2 h-4 w-4" />{sc.actionStartCount}
                          </DropdownMenuItem>
                        )}
                        {d.status === 'COUNTING' && (
                          <DropdownMenuItem onClick={() => updateStatus(d.id, 'REVIEWING')}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />{sc.actionSubmitReview}
                          </DropdownMenuItem>
                        )}
                        {d.status === 'REVIEWING' && (
                          <>
                            <DropdownMenuItem onClick={() => updateStatus(d.id, 'COMPLETED')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />{sc.actionConfirmComplete}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(d.id, 'COUNTING')}>
                              <RotateCcw className="mr-2 h-4 w-4" />{sc.actionReturnCount}
                            </DropdownMenuItem>
                          </>
                        )}
                        {!['COMPLETED', 'CANCELLED'].includes(d.status) && (
                          <><DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCancel(d.id, d.countNo)} variant="destructive">
                            <XCircle className="mr-2 h-4 w-4" />{sc.actionCancel}
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
          <p className="text-sm text-muted-foreground">
            {sc.paginationText
              .replace('{total}', String(pagination.total))
              .replace('{page}', String(pagination.page))
              .replace('{totalPages}', String(pagination.totalPages))}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(p => p - 1)}>{dict.common.prevPage}</Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>{dict.common.nextPage}</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{sc.newCount}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{sc.warehouseLabel} *</label>
              <select className="w-full rounded-md border px-3 py-2 text-sm"
                value={createForm.warehouseId}
                onChange={e => setCreateForm(f => ({ ...f, warehouseId: e.target.value }))}>
                <option value="">{sc.selectWarehousePlaceholder}</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{sc.countTypeLabel}</label>
              <select className="w-full rounded-md border px-3 py-2 text-sm"
                value={createForm.countType}
                onChange={e => setCreateForm(f => ({ ...f, countType: e.target.value }))}>
                <option value="FULL">{sc.countTypeFullOption}</option>
                <option value="CYCLE">{sc.countTypeCycleOption}</option>
                <option value="SPOT">{sc.countTypeSpotOption}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{sc.countDate}</label>
              <Input type="date" value={createForm.plannedDate}
                onChange={e => setCreateForm(f => ({ ...f, plannedDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{dict.common.notes}</label>
              <Input placeholder="..." value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">{sc.autoNoteText}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{dict.common.cancel}</Button>
            <Button onClick={createCount} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={open => { if (!open) setSelectedId(null) }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {countDetail?.countNo ?? '...'} — {countDetail ? (STATUS_LABELS[countDetail.status] ?? countDetail.status) : ''}
            </DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : countDetail && (
            <div className="space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">{sc.detailWarehouse}</span>{countDetail.warehouse.name}</div>
                <div><span className="text-muted-foreground">{sc.detailType}</span>{countDetail.countType}</div>
                <div><span className="text-muted-foreground">{sc.detailPlannedDate}</span>{formatDate(countDetail.plannedDate)}</div>
                <div><span className="text-muted-foreground">{sc.detailCreatedBy}</span>{countDetail.createdBy.name}</div>
              </div>

              {/* Variance summary (when reviewing/completed) */}
              {['REVIEWING', 'COMPLETED'].includes(countDetail.status) && (
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{sc.summaryItems}</p>
                      <p className="text-lg font-bold">{countDetail.items.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{sc.summaryVarianceItems}</p>
                      <p className="text-lg font-bold text-amber-600">
                        {countDetail.items.filter(i => i.variance !== 0).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{sc.summaryTotalVariance}</p>
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
                  <p className="text-sm text-muted-foreground">{sc.editHint}</p>
                  <Button size="sm" onClick={saveItemCounts} disabled={savingItems || !Object.keys(itemEdits).length}>
                    {savingItems ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {sc.saveCount} {Object.keys(itemEdits).length > 0 && `(${Object.keys(itemEdits).length})`}
                  </Button>
                </div>
              )}

              {/* Items table */}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{sc.colProductName}</TableHead>
                      <TableHead className="text-right w-24">{sc.colSystemQty}</TableHead>
                      <TableHead className="text-right w-28">{sc.colCountedQty}</TableHead>
                      <TableHead className="text-right w-20">{sc.colVarianceDiff}</TableHead>
                      <TableHead className="w-32">{sc.colVarianceReason}</TableHead>
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
                                placeholder={sc.varianceReasonPlaceholder}
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
                    <ClipboardList className="mr-2 h-4 w-4" />{sc.actionStartCount}
                  </Button>
                )}
                {countDetail.status === 'COUNTING' && (
                  <Button onClick={() => updateStatus(countDetail.id, 'REVIEWING')}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />{sc.actionSubmitReview}
                  </Button>
                )}
                {countDetail.status === 'REVIEWING' && (
                  <>
                    <Button variant="outline" onClick={() => updateStatus(countDetail.id, 'COUNTING')}>
                      <RotateCcw className="mr-2 h-4 w-4" />{sc.actionReturnCount}
                    </Button>
                    <Button onClick={() => updateStatus(countDetail.id, 'COMPLETED')}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />{sc.actionConfirmCompleteAdj}
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
