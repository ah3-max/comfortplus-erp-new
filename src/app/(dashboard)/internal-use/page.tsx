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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus, Search, MoreHorizontal, Loader2, CheckCircle2, XCircle,
  PackageX, Wrench, Trash2, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

// ── Internal Use types ──
const purposeLabels: Record<string, string> = {
  SAMPLE: '樣品', STAFF: '員工用', MARKETING: '行銷', TEST: '測試', DISPOSAL: '銷毀', OTHER: '其他',
}
const internalUseStatusConfig: Record<string, { label: string; className: string }> = {
  DRAFT:            { label: '草稿',   className: 'bg-slate-100 text-slate-600' },
  PENDING_APPROVAL: { label: '待審核', className: 'bg-amber-100 text-amber-700' },
  APPROVED:         { label: '已審核', className: 'bg-blue-100 text-blue-700' },
  ISSUED:           { label: '已出庫', className: 'bg-green-100 text-green-700' },
  CANCELLED:        { label: '已取消', className: 'bg-red-100 text-red-700' },
}

// ── Defective Goods types ──
const sourceLabels: Record<string, string> = {
  QC_FAIL: 'QC 不良', CUSTOMER_RETURN: '客退', WAREHOUSE_DAMAGE: '倉庫損壞', PRODUCTION: '生產瑕疵',
}
const severityConfig: Record<string, { label: string; className: string }> = {
  MINOR:    { label: '輕微', className: 'bg-yellow-100 text-yellow-700' },
  MAJOR:    { label: '嚴重', className: 'bg-orange-100 text-orange-700' },
  CRITICAL: { label: '重大', className: 'bg-red-100 text-red-700' },
}
const defectStatusConfig: Record<string, { label: string; className: string }> = {
  PENDING:    { label: '待處置', className: 'bg-amber-100 text-amber-700' },
  PROCESSING: { label: '處理中', className: 'bg-blue-100 text-blue-700' },
  RESOLVED:   { label: '已處置', className: 'bg-green-100 text-green-700' },
  CANCELLED:  { label: '已取消', className: 'bg-slate-100 text-slate-600' },
}
const dispositionLabels: Record<string, string> = {
  SCRAP: '報廢', REWORK: '重工', RETURN_SUPPLIER: '退供應商', DISCOUNT_SALE: '折價出售', QUARANTINE: '隔離',
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

export default function InternalUsePage() {
  const { dict } = useI18n()
  const [tab, setTab] = useState('internal')

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
    } catch { toast.error('載入失敗') }
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
    } catch { toast.error('載入失敗') }
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
      const labels: Record<string, string> = { APPROVE: '已審核', ISSUE: '已出庫', CANCEL: '已取消' }
      toast.success(labels[action] ?? '已更新')
      fetchIU()
    } else {
      const d = await res.json()
      toast.error(d.error ?? '操作失敗')
    }
  }

  async function submitIU() {
    if (!iuForm.warehouseId) { toast.error('請選擇倉庫'); return }
    const validItems = iuForm.items.filter(i => i.productId && i.quantity)
    if (!validItems.length) { toast.error('請至少新增一個品項'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/internal-use', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...iuForm, items: validItems.map(i => ({ productId: i.productId, quantity: parseInt(i.quantity), notes: i.notes || null })) }),
      })
      if (!res.ok) throw new Error()
      toast.success('領用單已建立')
      setShowIuDialog(false)
      setIuForm({ warehouseId: '', purpose: 'SAMPLE', notes: '', items: [{ productId: '', quantity: '', notes: '' }] })
      fetchIU()
    } catch { toast.error('建立失敗') }
    finally { setSubmitting(false) }
  }

  async function submitDG() {
    if (!dgForm.productId || !dgForm.warehouseId || !dgForm.quantity) { toast.error('請填寫必填欄位'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/defective-goods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dgForm, quantity: parseInt(dgForm.quantity) }),
      })
      if (!res.ok) throw new Error()
      toast.success('不良品紀錄已建立')
      setShowDgDialog(false)
      setDgForm({ productId: '', warehouseId: '', source: 'QC_FAIL', quantity: '', defectType: '', severity: 'MINOR', description: '', batchNo: '' })
      fetchDG()
    } catch { toast.error('建立失敗') }
    finally { setSubmitting(false) }
  }

  async function resolveDefect() {
    if (!resolveTarget || !resolveForm.disposition) { toast.error('請選擇處置方式'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/defective-goods/${resolveTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESOLVE', ...resolveForm }),
      })
      if (!res.ok) throw new Error()
      toast.success('已處置')
      setResolveTarget(null)
      fetchDG()
    } catch { toast.error('處置失敗') }
    finally { setSubmitting(false) }
  }

  const dgStatusFilters = [
    { value: '', label: '全部' },
    { value: 'PENDING', label: '待處置' },
    { value: 'PROCESSING', label: '處理中' },
    { value: 'RESOLVED', label: '已處置' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.internalUse.title}管理</h1>
        <p className="text-sm text-muted-foreground">領用管理 · 不良品追蹤與處置</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="internal">內部領用</TabsTrigger>
          <TabsTrigger value="defective">不良品</TabsTrigger>
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
                  <TableHead className="text-right w-24">總成本</TableHead>
                  <TableHead className="w-20">{dict.internalUse.items}</TableHead>
                  <TableHead className="w-24">申請人</TableHead>
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
                  const sc = internalUseStatusConfig[d.status] ?? { label: d.status, className: '' }
                  return (
                    <TableRow key={d.id} className="group">
                      <TableCell className="font-mono text-sm font-medium">{d.useNo}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{purposeLabels[d.purpose] ?? d.purpose}</Badge></TableCell>
                      <TableCell className="text-sm">{d.warehouse.name}</TableCell>
                      <TableCell><Badge variant="outline" className={sc.className}>{sc.label}</Badge></TableCell>
                      <TableCell className="text-right text-sm">{fmt(d.totalCost)}</TableCell>
                      <TableCell className="text-center text-sm">{d.items.length}</TableCell>
                      <TableCell className="text-sm">{d.requestedBy.name}</TableCell>
                      <TableCell className="text-sm">{fmtDate(d.createdAt)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            {d.status === 'PENDING_APPROVAL' && (
                              <DropdownMenuItem onClick={() => iuAction(d.id, 'APPROVE')}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />審核通過
                              </DropdownMenuItem>
                            )}
                            {d.status === 'APPROVED' && (
                              <DropdownMenuItem onClick={() => iuAction(d.id, 'ISSUE')}>
                                <PackageX className="mr-2 h-4 w-4" />確認出庫
                              </DropdownMenuItem>
                            )}
                            {!['ISSUED', 'CANCELLED'].includes(d.status) && (
                              <><DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => iuAction(d.id, 'CANCEL')} variant="destructive">
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

          {/* Mobile cards */}
          <div className="block md:hidden space-y-3">
            {iuData.map(d => {
              const sc = internalUseStatusConfig[d.status] ?? { label: d.status, className: '' }
              return (
                <div key={d.id} className="rounded-lg border bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{d.useNo}</span>
                    <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{purposeLabels[d.purpose]}</span>
                    <span className="text-muted-foreground">{d.warehouse.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{d.items.length} 品項 · {fmt(d.totalCost)}</div>
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
              <Input className="pl-9" placeholder="搜尋品項或批號..." value={dgSearch}
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
              <Plus className="mr-2 h-4 w-4" />新增不良品
            </Button>
          </div>

          <div className="hidden md:block rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">單號</TableHead>
                  <TableHead>{dict.common.product}</TableHead>
                  <TableHead className="w-20">來源</TableHead>
                  <TableHead className="w-16">嚴重度</TableHead>
                  <TableHead className="w-20">{dict.common.status}</TableHead>
                  <TableHead className="text-right w-16">{dict.common.quantity}</TableHead>
                  <TableHead className="text-right w-24">估計損失</TableHead>
                  <TableHead className="w-24">處置</TableHead>
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
                  const st = defectStatusConfig[d.status] ?? { label: d.status, className: '' }
                  return (
                    <TableRow key={d.id} className="group">
                      <TableCell className="font-mono text-sm font-medium">{d.defectNo}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{d.product.name}</div>
                        <div className="text-xs text-muted-foreground">{d.product.sku}{d.batchNo ? ` · ${d.batchNo}` : ''}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{sourceLabels[d.source] ?? d.source}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={sev.className}>{sev.label}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={st.className}>{st.label}</Badge></TableCell>
                      <TableCell className="text-right">{d.quantity} {d.product.unit}</TableCell>
                      <TableCell className={`text-right text-sm ${d.totalLoss ? 'text-red-600' : 'text-muted-foreground'}`}>{fmt(d.totalLoss)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.disposition ? dispositionLabels[d.disposition] : '—'}</TableCell>
                      <TableCell className="text-sm">{fmtDate(d.createdAt)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {d.status !== 'RESOLVED' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => { setResolveTarget(d); setResolveForm({ disposition: '', dispositionNote: '' }) }}>
                                <Wrench className="mr-2 h-4 w-4" />執行處置
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
                <label className="text-sm font-medium">倉庫 *</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={iuForm.warehouseId}
                  onChange={e => setIuForm(f => ({ ...f, warehouseId: e.target.value }))}>
                  <option value="">選擇倉庫...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">用途 *</label>
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
                    <option value="">選品項...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Input className="col-span-3 text-sm h-8" type="number" placeholder="數量"
                    value={item.quantity}
                    onChange={e => setIuForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it) }))} />
                  <button onClick={() => setIuForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                    className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setIuForm(f => ({ ...f, items: [...f.items, { productId: '', quantity: '', notes: '' }] }))}>
                <Plus className="mr-1 h-3 w-3" />新增品項
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
          <DialogHeader><DialogTitle>新增不良品紀錄</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">品項 *</label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={dgForm.productId}
                onChange={e => setDgForm(f => ({ ...f, productId: e.target.value }))}>
                <option value="">選品項...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">倉庫 *</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={dgForm.warehouseId}
                  onChange={e => setDgForm(f => ({ ...f, warehouseId: e.target.value }))}>
                  <option value="">選倉庫...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">數量 *</label>
                <Input type="number" placeholder="0" value={dgForm.quantity}
                  onChange={e => setDgForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">來源 *</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={dgForm.source}
                  onChange={e => setDgForm(f => ({ ...f, source: e.target.value }))}>
                  {Object.entries(sourceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">嚴重度</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={dgForm.severity}
                  onChange={e => setDgForm(f => ({ ...f, severity: e.target.value }))}>
                  <option value="MINOR">輕微</option>
                  <option value="MAJOR">嚴重</option>
                  <option value="CRITICAL">重大</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">缺陷類型</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={dgForm.defectType}
                  onChange={e => setDgForm(f => ({ ...f, defectType: e.target.value }))}>
                  <option value="">選擇...</option>
                  <option value="ABSORPTION">吸收力不足</option>
                  <option value="LEAK">滲漏</option>
                  <option value="PACKAGING">包裝破損</option>
                  <option value="SURFACE">表面瑕疵</option>
                  <option value="OTHER">其他</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">批號</label>
                <Input placeholder="批號..." value={dgForm.batchNo}
                  onChange={e => setDgForm(f => ({ ...f, batchNo: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">描述</label>
              <Input placeholder="說明不良情況..." value={dgForm.description}
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
            <DialogTitle>處置不良品 — {resolveTarget?.defectNo}</DialogTitle>
          </DialogHeader>
          {resolveTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">品項：</span>{resolveTarget.product.name}</div>
                <div><span className="text-muted-foreground">數量：</span>{resolveTarget.quantity} {resolveTarget.product.unit}</div>
                <div><span className="text-muted-foreground">估計損失：</span><span className="text-red-600 font-medium">{fmt(resolveTarget.totalLoss)}</span></div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">處置方式 *</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={resolveForm.disposition}
                  onChange={e => setResolveForm(f => ({ ...f, disposition: e.target.value }))}>
                  <option value="">選擇處置方式...</option>
                  {Object.entries(dispositionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">處置說明</label>
                <Input placeholder="說明處置細節..." value={resolveForm.dispositionNote}
                  onChange={e => setResolveForm(f => ({ ...f, dispositionNote: e.target.value }))} />
              </div>
              {resolveForm.disposition && (
                <div className={`text-xs rounded p-2 ${['SCRAP', 'RETURN_SUPPLIER'].includes(resolveForm.disposition) ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                  {resolveForm.disposition === 'SCRAP' && '⚠️ 報廢將從庫存中扣除該數量'}
                  {resolveForm.disposition === 'REWORK' && '✓ 重工後數量將回到可用庫存'}
                  {resolveForm.disposition === 'RETURN_SUPPLIER' && '⚠️ 退供應商將從庫存中扣除該數量'}
                  {resolveForm.disposition === 'DISCOUNT_SALE' && '✓ 庫存數量維持，另行開銷貨單'}
                  {resolveForm.disposition === 'QUARANTINE' && '✓ 庫存數量維持，需另行追蹤'}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>{dict.common.cancel}</Button>
            <Button onClick={resolveDefect} disabled={submitting || !resolveForm.disposition}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}確認處置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
