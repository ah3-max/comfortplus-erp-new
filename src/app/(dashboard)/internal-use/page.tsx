'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus, Search, MoreHorizontal, Loader2, CheckCircle2, XCircle,
  PackageX, Wrench, Trash2, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

// ── Internal Use types ──
const internalUseStatusCls: Record<string, string> = {
  DRAFT:            'bg-slate-100 text-slate-600',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED:         'bg-blue-100 text-blue-700',
  ISSUED:           'bg-green-100 text-green-700',
  CANCELLED:        'bg-red-100 text-red-700',
}

// ── Defective Goods types ──
const severityCls: Record<string, string> = {
  MINOR:    'bg-yellow-100 text-yellow-700',
  MAJOR:    'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}
const defectStatusCls: Record<string, string> = {
  PENDING:    'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  RESOLVED:   'bg-green-100 text-green-700',
  CANCELLED:  'bg-slate-100 text-slate-600',
}
interface IUItem { id: string; productId: string; quantity: number; unitCost: string | null; totalCost: string | null; product: { id: string; sku: string; name: string; unit: string } }
interface InternalUseRecord {
  id: string; useNo: string; purpose: string; status: string; totalCost: string | null; createdAt: string; notes: string | null
  warehouse: { id: string; name: string; code: string }
  requestedBy: { id: string; name: string }
  approvedBy: { id: string; name: string } | null
  items: IUItem[]
}

interface DefectiveRecord {
  id: string; defectNo: string; source: string; severity: string; status: string
  quantity: number; defectType: string | null; disposition: string | null
  totalLoss: string | null; createdAt: string; batchNo: string | null
  product: { id: string; sku: string; name: string; unit: string }
  warehouse: { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
  resolvedBy: { id: string; name: string } | null
}

interface Warehouse { id: string; name: string; code: string }
interface Product { id: string; sku: string; name: string; unit: string; costPrice: string }

function fmt(n: number | string | null) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`
}

function fmtDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

function InternalUsePageInner() {
  const { dict } = useI18n()
  const iu = dict.internalUse
  type IUStatus = keyof typeof iu.statuses
  type DGStatus = keyof typeof iu.defectStatuses

  const purposeLabels: Record<string, string> = {
    SAMPLE: iu.purposes.SAMPLE, STAFF: iu.purposes.STAFF, MARKETING: iu.purposes.MARKETING,
    TEST: iu.purposes.TEST, DISPOSAL: iu.purposes.DISPOSAL, OTHER: iu.purposes.OTHER,
  }
  const sourceLabels: Record<string, string> = {
    QC_FAIL: iu.sources.QC_FAIL, CUSTOMER_RETURN: iu.sources.CUSTOMER_RETURN,
    WAREHOUSE_DAMAGE: iu.sources.WAREHOUSE_DAMAGE, PRODUCTION: iu.sources.PRODUCTION,
  }
  const severityConfig: Record<string, { label: string; className: string }> = {
    MINOR:    { label: iu.severities.MINOR,    className: severityCls.MINOR },
    MAJOR:    { label: iu.severities.MAJOR,    className: severityCls.MAJOR },
    CRITICAL: { label: iu.severities.CRITICAL, className: severityCls.CRITICAL },
  }
  const dispositionLabels: Record<string, string> = {
    SCRAP: iu.dispositions.SCRAP, REWORK: iu.dispositions.REWORK,
    RETURN_SUPPLIER: iu.dispositions.RETURN_SUPPLIER,
    DISCOUNT_SALE: iu.dispositions.DISCOUNT_SALE, QUARANTINE: iu.dispositions.QUARANTINE,
  }

  const searchParams = useSearchParams()
  const [tab, setTab] = useState(() => searchParams.get('tab') === 'defective' ? 'defective' : 'internal')

  // Internal Use
  const [iuData, setIuData] = useState<InternalUseRecord[]>([])
  const [iuLoading, setIuLoading] = useState(true)
  const [iuSearch, setIuSearch] = useState('')
  const [iuPage, setIuPage] = useState(1)
  const [iuPagination, setIuPagination] = useState<{ total: number; totalPages: number } | null>(null)
  const [showIuDialog, setShowIuDialog] = useState(false)
  const [iuForm, setIuForm] = useState({ warehouseId: '', purpose: 'SAMPLE', notes: '', items: [{ productId: '', quantity: '', notes: '' }] })

  // Defective
  const [dgData, setDgData] = useState<DefectiveRecord[]>([])
  const [dgLoading, setDgLoading] = useState(true)
  const [dgSearch, setDgSearch] = useState('')
  const [dgFilterStatus, setDgFilterStatus] = useState('')
  const [dgPage, setDgPage] = useState(1)
  const [dgPagination, setDgPagination] = useState<{ total: number; totalPages: number } | null>(null)
  const [showDgDialog, setShowDgDialog] = useState(false)
  const [dgForm, setDgForm] = useState({ productId: '', warehouseId: '', source: 'QC_FAIL', quantity: '', defectType: '', severity: 'MINOR', description: '', batchNo: '' })

  // Resolve defective dialog
  const [resolveTarget, setResolveTarget] = useState<DefectiveRecord | null>(null)
  const [resolveForm, setResolveForm] = useState({ disposition: '', dispositionNote: '' })

  // Shared
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [submitting, setSubmitting] = useState(false)

  const fetchIU = useCallback(async () => {
    setIuLoading(true)
    try {
      const params = new URLSearchParams({ page: String(iuPage), pageSize: '50' })
      if (iuSearch) params.set('search', iuSearch)
      const res = await fetch(`/api/internal-use?${params}`)
      const result = await res.json()
      setIuData(result.data ?? [])
      setIuPagination(result.pagination)
    } catch { toast.error(dict.common.loadFailed) }
    finally { setIuLoading(false) }
  }, [iuSearch, iuPage])

  const fetchDG = useCallback(async () => {
    setDgLoading(true)
    try {
      const params = new URLSearchParams({ page: String(dgPage), pageSize: '50' })
      if (dgSearch) params.set('search', dgSearch)
      if (dgFilterStatus) params.set('status', dgFilterStatus)
      const res = await fetch(`/api/defective-goods?${params}`)
      const result = await res.json()
      setDgData(result.data ?? [])
      setDgPagination(result.pagination)
    } catch { toast.error(dict.common.loadFailed) }
    finally { setDgLoading(false) }
  }, [dgSearch, dgFilterStatus, dgPage])

  useEffect(() => { const t = setTimeout(fetchIU, 300); return () => clearTimeout(t) }, [fetchIU])
  useEffect(() => { const t = setTimeout(fetchDG, 300); return () => clearTimeout(t) }, [fetchDG])

  // Load warehouses + products for dialogs
  useEffect(() => {
    if (!showIuDialog && !showDgDialog) return
    Promise.all([
      fetch('/api/warehouses?pageSize=100').then(r => r.json()),
      fetch('/api/products?pageSize=500&activeOnly=true').then(r => r.json()),
    ]).then(([w, p]) => {
      setWarehouses(Array.isArray(w) ? w : (w.data ?? []))
      setProducts(Array.isArray(p) ? p : (p.data ?? []))
    }).catch(() => {})
  }, [showIuDialog, showDgDialog])

  async function iuAction(id: string, action: string) {
    const res = await fetch(`/api/internal-use/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      const labels: Record<string, string> = { APPROVE: iu.statuses.APPROVED, ISSUE: iu.statuses.ISSUED, CANCEL: iu.statuses.CANCELLED }
      toast.success(labels[action] ?? dict.common.updateSuccess)
      fetchIU()
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.operationFailed)
    }
  }

  async function submitIU() {
    if (!iuForm.warehouseId) { toast.error(iu.warehouseRequired); return }
    const validItems = iuForm.items.filter(i => i.productId && i.quantity)
    if (!validItems.length) { toast.error(iu.itemsRequired); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/internal-use', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...iuForm, items: validItems.map(i => ({ productId: i.productId, quantity: parseInt(i.quantity), notes: i.notes || null })) }),
      })
      if (!res.ok) throw new Error()
      toast.success(iu.requestCreated)
      setShowIuDialog(false)
      setIuForm({ warehouseId: '', purpose: 'SAMPLE', notes: '', items: [{ productId: '', quantity: '', notes: '' }] })
      fetchIU()
    } catch { toast.error(dict.common.createFailed) }
    finally { setSubmitting(false) }
  }

  async function submitDG() {
    if (!dgForm.productId || !dgForm.warehouseId || !dgForm.quantity) { toast.error(dict.common.requiredFields); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/defective-goods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dgForm, quantity: parseInt(dgForm.quantity) }),
      })
      if (!res.ok) throw new Error()
      toast.success(iu.defectCreated)
      setShowDgDialog(false)
      setDgForm({ productId: '', warehouseId: '', source: 'QC_FAIL', quantity: '', defectType: '', severity: 'MINOR', description: '', batchNo: '' })
      fetchDG()
    } catch { toast.error(dict.common.createFailed) }
    finally { setSubmitting(false) }
  }

  async function resolveDefect() {
    if (!resolveTarget || !resolveForm.disposition) { toast.error(iu.dispositionRequired); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/defective-goods/${resolveTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESOLVE', ...resolveForm }),
      })
      if (!res.ok) throw new Error()
      toast.success(iu.disposedSuccess)
      setResolveTarget(null)
      fetchDG()
    } catch { toast.error(iu.disposeFailed) }
    finally { setSubmitting(false) }
  }

  const dgStatusFilters = [
    { value: '', label: dict.common.all },
    { value: 'PENDING', label: iu.defectStatuses.PENDING },
    { value: 'PROCESSING', label: iu.defectStatuses.PROCESSING },
    { value: 'RESOLVED', label: iu.defectStatuses.RESOLVED },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{iu.title}{iu.titleManagement}</h1>
        <p className="text-sm text-muted-foreground">{iu.titleSubtitle}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="internal">{iu.tabInternal}</TabsTrigger>
          <TabsTrigger value="defective">{iu.tabDefective}</TabsTrigger>
        </TabsList>

        {/* ── Internal Use ── */}
        <TabsContent value="internal" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder={dict.internalUse.searchPlaceholder} value={iuSearch}
                onChange={e => { setIuSearch(e.target.value); setIuPage(1) }} />
            </div>
            <Button onClick={() => setShowIuDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />{dict.internalUse.newRequest}
            </Button>
          </div>

          <div className="hidden md:block rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">{dict.internalUse.requestNo}</TableHead>
                  <TableHead className="w-20">{dict.internalUse.purpose}</TableHead>
                  <TableHead>{dict.common.warehouse}</TableHead>
                  <TableHead className="w-20">{dict.common.status}</TableHead>
                  <TableHead className="text-right w-24">{iu.colTotalCost}</TableHead>
                  <TableHead className="w-20">{dict.internalUse.items}</TableHead>
                  <TableHead className="w-24">{iu.colRequestedBy}</TableHead>
                  <TableHead className="w-20">{dict.common.date}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {iuLoading ? (
                  <TableRow><TableCell colSpan={9} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : iuData.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-16 text-center text-muted-foreground">{dict.internalUse.noRequests}</TableCell></TableRow>
                ) : iuData.map(d => {
                  const scCls = internalUseStatusCls[d.status] ?? ''
                  const scLabel = iu.statuses[d.status as IUStatus] ?? d.status
                  return (
                    <TableRow key={d.id} className="group">
                      <TableCell className="font-mono text-sm font-medium">{d.useNo}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{purposeLabels[d.purpose] ?? d.purpose}</Badge></TableCell>
                      <TableCell className="text-sm">{d.warehouse.name}</TableCell>
                      <TableCell><Badge variant="outline" className={scCls}>{scLabel}</Badge></TableCell>
                      <TableCell className="text-right text-sm">{fmt(d.totalCost)}</TableCell>
                      <TableCell className="text-center text-sm">{d.items.length}</TableCell>
                      <TableCell className="text-sm">{d.requestedBy.name}</TableCell>
                      <TableCell className="text-sm">{fmtDate(d.createdAt)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded p-1 opacity-60 hover:opacity-100 transition-opacity hover:bg-slate-100">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            {d.status === 'PENDING_APPROVAL' && (
                              <DropdownMenuItem onClick={() => iuAction(d.id, 'APPROVE')}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />{iu.approveAction}
                              </DropdownMenuItem>
                            )}
                            {d.status === 'APPROVED' && (
                              <DropdownMenuItem onClick={() => iuAction(d.id, 'ISSUE')}>
                                <PackageX className="mr-2 h-4 w-4" />{iu.issueAction}
                              </DropdownMenuItem>
                            )}
                            {!['ISSUED', 'CANCELLED'].includes(d.status) && (
                              <><DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => iuAction(d.id, 'CANCEL')} variant="destructive">
                                <XCircle className="mr-2 h-4 w-4" />{iu.cancelAction}
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

          {/* Mobile cards */}
          <div className="block md:hidden space-y-3">
            {iuData.map(d => {
              const scCls2 = internalUseStatusCls[d.status] ?? ''
              const scLabel2 = iu.statuses[d.status as IUStatus] ?? d.status
              return (
                <div key={d.id} className="rounded-lg border bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{d.useNo}</span>
                    <Badge variant="outline" className={scCls2}>{scLabel2}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{purposeLabels[d.purpose]}</span>
                    <span className="text-muted-foreground">{d.warehouse.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{d.items.length} {iu.itemsUnit} · {fmt(d.totalCost)}</div>
                </div>
              )
            })}
          </div>

          {iuPagination && iuPagination.totalPages > 1 && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={iuPage <= 1} onClick={() => setIuPage(p => p - 1)}>{dict.common.prevPage}</Button>
              <Button variant="outline" size="sm" disabled={iuPage >= iuPagination.totalPages} onClick={() => setIuPage(p => p + 1)}>{dict.common.nextPage}</Button>
            </div>
          )}
        </TabsContent>

        {/* ── Defective Goods ── */}
        <TabsContent value="defective" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder={iu.defectSearchPlaceholder} value={dgSearch}
                onChange={e => { setDgSearch(e.target.value); setDgPage(1) }} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {dgStatusFilters.map(f => (
                <button key={f.value} onClick={() => { setDgFilterStatus(f.value); setDgPage(1) }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    dgFilterStatus === f.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>{f.label}</button>
              ))}
            </div>
            <Button onClick={() => setShowDgDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />{iu.newDefect}
            </Button>
          </div>

          <div className="hidden md:block rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">{iu.colDefectNo}</TableHead>
                  <TableHead>{dict.common.product}</TableHead>
                  <TableHead className="w-20">{iu.colSource}</TableHead>
                  <TableHead className="w-16">{iu.colSeverity}</TableHead>
                  <TableHead className="w-20">{dict.common.status}</TableHead>
                  <TableHead className="text-right w-16">{dict.common.quantity}</TableHead>
                  <TableHead className="text-right w-24">{iu.colEstLoss}</TableHead>
                  <TableHead className="w-24">{iu.colDisposition}</TableHead>
                  <TableHead className="w-20">{dict.common.date}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dgLoading ? (
                  <TableRow><TableCell colSpan={10} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : dgData.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-16 text-center">
                    <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">{dgSearch || dgFilterStatus ? dict.internalUse.noResults : dict.internalUse.noRequests}</p>
                  </TableCell></TableRow>
                ) : dgData.map(d => {
                  const sev = severityConfig[d.severity] ?? { label: d.severity, className: '' }
                  const stCls = defectStatusCls[d.status] ?? ''
                  const stLabel = iu.defectStatuses[d.status as DGStatus] ?? d.status
                  return (
                    <TableRow key={d.id} className="group">
                      <TableCell className="font-mono text-sm font-medium">{d.defectNo}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{d.product.name}</div>
                        <div className="text-xs text-muted-foreground">{d.product.sku}{d.batchNo ? ` · ${d.batchNo}` : ''}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{sourceLabels[d.source] ?? d.source}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={sev.className}>{sev.label}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={stCls}>{stLabel}</Badge></TableCell>
                      <TableCell className="text-right">{d.quantity} {d.product.unit}</TableCell>
                      <TableCell className={`text-right text-sm ${d.totalLoss ? 'text-red-600' : 'text-muted-foreground'}`}>{fmt(d.totalLoss)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.disposition ? dispositionLabels[d.disposition] : '—'}</TableCell>
                      <TableCell className="text-sm">{fmtDate(d.createdAt)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {d.status !== 'RESOLVED' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="rounded p-1 opacity-60 hover:opacity-100 transition-opacity hover:bg-slate-100">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => { setResolveTarget(d); setResolveForm({ disposition: '', dispositionNote: '' }) }}>
                                <Wrench className="mr-2 h-4 w-4" />{iu.resolveAction}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {dgPagination && dgPagination.totalPages > 1 && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={dgPage <= 1} onClick={() => setDgPage(p => p - 1)}>{dict.common.prevPage}</Button>
              <Button variant="outline" size="sm" disabled={dgPage >= dgPagination.totalPages} onClick={() => setDgPage(p => p + 1)}>{dict.common.nextPage}</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Internal Use Create Dialog ── */}
      <Dialog open={showIuDialog} onOpenChange={setShowIuDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dict.internalUse.newRequest}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">{iu.warehouseSelectLabel}</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={iuForm.warehouseId}
                  onChange={e => setIuForm(f => ({ ...f, warehouseId: e.target.value }))}>
                  <option value="">{iu.selectWarehouse}</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{iu.purposeSelectLabel}</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={iuForm.purpose}
                  onChange={e => setIuForm(f => ({ ...f, purpose: e.target.value }))}>
                  {Object.entries(purposeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{dict.internalUse.items}</label>
              {iuForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                  <select className="col-span-7 rounded border px-2 py-1.5 text-sm" value={item.productId}
                    onChange={e => setIuForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, productId: e.target.value } : it) }))}>
                    <option value="">{iu.selectProduct}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Input className="col-span-3 text-sm h-8" type="number" placeholder={dict.common.quantity}
                    value={item.quantity}
                    onChange={e => setIuForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it) }))} />
                  <button onClick={() => setIuForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                    className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setIuForm(f => ({ ...f, items: [...f.items, { productId: '', quantity: '', notes: '' }] }))}>
                <Plus className="mr-1 h-3 w-3" />{iu.addItemBtn}
              </Button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{dict.common.notes}</label>
              <Input placeholder="..." value={iuForm.notes} onChange={e => setIuForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIuDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={submitIU} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Defective Goods Create Dialog ── */}
      <Dialog open={showDgDialog} onOpenChange={setShowDgDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{iu.newDefectTitle}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{iu.defectProductLabel}</label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={dgForm.productId}
                onChange={e => setDgForm(f => ({ ...f, productId: e.target.value }))}>
                <option value="">{iu.selectProduct}</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">{iu.warehouseSelectLabel}</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={dgForm.warehouseId}
                  onChange={e => setDgForm(f => ({ ...f, warehouseId: e.target.value }))}>
                  <option value="">{iu.selectWarehouse}</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{iu.defectQtyLabel}</label>
                <Input type="number" placeholder="0" value={dgForm.quantity}
                  onChange={e => setDgForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">{iu.defectSourceLabel}</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={dgForm.source}
                  onChange={e => setDgForm(f => ({ ...f, source: e.target.value }))}>
                  {Object.entries(sourceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{iu.defectSeverityLabel}</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={dgForm.severity}
                  onChange={e => setDgForm(f => ({ ...f, severity: e.target.value }))}>
                  <option value="MINOR">{iu.severities.MINOR}</option>
                  <option value="MAJOR">{iu.severities.MAJOR}</option>
                  <option value="CRITICAL">{iu.severities.CRITICAL}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">{iu.defectTypeLabel}</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={dgForm.defectType}
                  onChange={e => setDgForm(f => ({ ...f, defectType: e.target.value }))}>
                  <option value="">{iu.defectTypeSelect}</option>
                  <option value="ABSORPTION">{iu.defectTypes.ABSORPTION}</option>
                  <option value="LEAK">{iu.defectTypes.LEAK}</option>
                  <option value="PACKAGING">{iu.defectTypes.PACKAGING}</option>
                  <option value="SURFACE">{iu.defectTypes.SURFACE}</option>
                  <option value="OTHER">{iu.defectTypes.OTHER}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{iu.defectBatchNoLabel}</label>
                <Input placeholder={iu.defectBatchNoPH} value={dgForm.batchNo}
                  onChange={e => setDgForm(f => ({ ...f, batchNo: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{iu.defectDescLabel}</label>
              <Input placeholder={iu.defectDescPH} value={dgForm.description}
                onChange={e => setDgForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDgDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={submitDG} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Resolve Defective Dialog ── */}
      <Dialog open={!!resolveTarget} onOpenChange={open => { if (!open) setResolveTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{iu.resolveTitle} — {resolveTarget?.defectNo}</DialogTitle>
          </DialogHeader>
          {resolveTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">{iu.resolveItem}</span>{resolveTarget.product.name}</div>
                <div><span className="text-muted-foreground">{iu.resolveQty}</span>{resolveTarget.quantity} {resolveTarget.product.unit}</div>
                <div><span className="text-muted-foreground">{iu.resolveLoss}</span><span className="text-red-600 font-medium">{fmt(resolveTarget.totalLoss)}</span></div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{iu.resolveDispositionLabel}</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={resolveForm.disposition}
                  onChange={e => setResolveForm(f => ({ ...f, disposition: e.target.value }))}>
                  <option value="">{iu.resolveDispositionSelect}</option>
                  {Object.entries(dispositionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{iu.resolveNoteLabel}</label>
                <Input placeholder={iu.resolveNotePH} value={resolveForm.dispositionNote}
                  onChange={e => setResolveForm(f => ({ ...f, dispositionNote: e.target.value }))} />
              </div>
              {resolveForm.disposition && (
                <div className={`text-xs rounded p-2 ${['SCRAP', 'RETURN_SUPPLIER'].includes(resolveForm.disposition) ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                  {iu.disposeNotes[resolveForm.disposition as keyof typeof iu.disposeNotes]}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>{dict.common.cancel}</Button>
            <Button onClick={resolveDefect} disabled={submitting || !resolveForm.disposition}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{iu.confirmResolve}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function InternalUsePage() {
  return (
    <Suspense>
      <InternalUsePageInner />
    </Suspense>
  )
}
