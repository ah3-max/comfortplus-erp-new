'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, Search, AlertTriangle, PackageX, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

const SOURCE_COLORS: Record<string, string> = {
  QC_FAIL: 'bg-red-100 text-red-700', CUSTOMER_RETURN: 'bg-orange-100 text-orange-700',
  WAREHOUSE_DAMAGE: 'bg-yellow-100 text-yellow-700', PRODUCTION: 'bg-purple-100 text-purple-700',
}
const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-yellow-100 text-yellow-700', MAJOR: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
}
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', PROCESSING: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-gray-100 text-gray-500',
}

interface DefectiveRecord {
  id: string; defectNo: string; source: string; status: string; severity: string
  quantity: number; defectType: string | null; description: string | null
  batchNo: string | null; disposition: string | null; dispositionNote: string | null
  unitCost: number | null; totalLoss: number | null; discoveredAt: string
  resolvedAt: string | null
  product: { id: string; sku: string; name: string; unit: string | null }
  warehouse: { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
  resolvedBy: { id: string; name: string } | null
}

interface Product { id: string; sku: string; name: string }
interface Warehouse { id: string; name: string; code: string }

export default function DefectiveGoodsPage() {
  const { dict } = useI18n()
  const [records, setRecords] = useState<DefectiveRecord[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<DefectiveRecord | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    productId: '', warehouseId: '', source: 'QC_FAIL', quantity: '',
    defectType: '', severity: 'MINOR', description: '', batchNo: '',
  })
  const [dispForm, setDispForm] = useState({ disposition: '', dispositionNote: '' })

  const SOURCE_LABELS: Record<string, string> = {
    QC_FAIL: dict.defectiveGoodsPage.sourceLabels.QC_FAIL,
    CUSTOMER_RETURN: dict.defectiveGoodsPage.sourceLabels.CUSTOMER_RETURN,
    WAREHOUSE_DAMAGE: dict.defectiveGoodsPage.sourceLabels.WAREHOUSE_DAMAGE,
    PRODUCTION: dict.defectiveGoodsPage.sourceLabels.PRODUCTION,
  }
  const SEVERITY_LABELS: Record<string, string> = {
    MINOR: dict.defectiveGoodsPage.severityLabels.MINOR,
    MAJOR: dict.defectiveGoodsPage.severityLabels.MAJOR,
    CRITICAL: dict.defectiveGoodsPage.severityLabels.CRITICAL,
  }
  const STATUS_LABELS: Record<string, string> = {
    PENDING: dict.defectiveGoodsPage.statusLabels.PENDING,
    PROCESSING: dict.defectiveGoodsPage.statusLabels.PROCESSING,
    RESOLVED: dict.defectiveGoodsPage.statusLabels.RESOLVED,
    CANCELLED: dict.defectiveGoodsPage.statusLabels.CANCELLED,
  }
  const DISPOSITION_LABELS: Record<string, string> = {
    SCRAP: dict.defectiveGoodsPage.dispositionLabels.SCRAP,
    REWORK: dict.defectiveGoodsPage.dispositionLabels.REWORK,
    RETURN_SUPPLIER: dict.defectiveGoodsPage.dispositionLabels.RETURN_SUPPLIER,
    DISCOUNT_SALE: dict.defectiveGoodsPage.dispositionLabels.DISCOUNT_SALE,
    QUARANTINE: dict.defectiveGoodsPage.dispositionLabels.QUARANTINE,
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: '20',
        ...(search && { search }),
        ...(filterStatus && { status: filterStatus }),
        ...(filterSource && { source: filterSource }),
      })
      const res = await fetch(`/api/defective-goods?${params}`)
      if (!res.ok) throw new Error()
      const d = await res.json()
      setRecords(d.data)
      setTotal(d.pagination.total)
      setTotalPages(d.pagination.totalPages)
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [page, search, filterStatus, filterSource])

  useEffect(() => {
    const [prodP, whP] = [fetch('/api/products?pageSize=500'), fetch('/api/warehouses')]
    Promise.all([prodP, whP]).then(async ([p, w]) => {
      if (p.ok) { const d = await p.json(); setProducts(d.data ?? d) }
      if (w.ok) { const d = await w.json(); setWarehouses(d.data ?? d) }
    })
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.productId || !form.warehouseId || !form.quantity) {
      toast.error(dict.defectiveGoodsPage.fieldsRequired)
      return
    }
    try {
      const res = await fetch('/api/defective-goods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? dict.common.createFailed)
      toast.success(dict.defectiveGoodsPage.registered)
      setShowCreate(false)
      setForm({ productId: '', warehouseId: '', source: 'QC_FAIL', quantity: '', defectType: '', severity: 'MINOR', description: '', batchNo: '' })
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : dict.common.createFailed) }
  }

  const handleDispose = async () => {
    if (!selected || !dispForm.disposition) return
    try {
      const res = await fetch(`/api/defective-goods/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dispForm, status: 'RESOLVED' }),
      })
      if (!res.ok) throw new Error()
      toast.success(dict.defectiveGoodsPage.dispositionUpdated)
      setSelected(null)
      load()
    } catch { toast.error(dict.common.updateFailed) }
  }

  const totalLossSum = records.reduce((s, r) => s + Number(r.totalLoss ?? 0), 0)
  const pendingCount = records.filter(r => r.status === 'PENDING').length

  const colHeaders = [
    dict.defectiveGoodsPage.colNo,
    dict.defectiveGoodsPage.colSource,
    dict.defectiveGoodsPage.colProduct,
    dict.defectiveGoodsPage.colQty,
    dict.defectiveGoodsPage.colSeverity,
    dict.defectiveGoodsPage.colLoss,
    dict.defectiveGoodsPage.colStatus,
    dict.defectiveGoodsPage.colDisposition,
    dict.defectiveGoodsPage.colDate,
  ]

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.defectiveGoods ?? dict.defectiveGoodsPage.addRecord}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dict.defectiveGoodsPage.subtitle}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus size={16} />{dict.defectiveGoodsPage.addRecord}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">{dict.defectiveGoodsPage.cardTotal}</div>
          <div className="text-2xl font-bold">{total}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={13} className="text-yellow-500" />
            <span className="text-xs text-gray-400">{dict.defectiveGoodsPage.cardPending}</span>
          </div>
          <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">{dict.defectiveGoodsPage.cardLoss}</div>
          <div className="text-xl font-bold text-red-600">NT${totalLossSum.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span className="text-xs text-gray-400">{dict.defectiveGoodsPage.cardResolved}</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{records.filter(r => r.status === 'RESOLVED').length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={dict.defectiveGoodsPage.searchPlaceholder} className="pl-8 h-9" />
        </div>
        <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1) }}
          className="border rounded-md px-3 h-9 text-sm bg-white">
          <option value="">{dict.defectiveGoodsPage.filterAllSource}</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="border rounded-md px-3 h-9 text-sm bg-white">
          <option value="">{dict.defectiveGoodsPage.filterAllStatus}</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {colHeaders.map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">{dict.defectiveGoodsPage.loading}</td></tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-gray-400">
                    <PackageX size={36} className="mx-auto mb-2 opacity-30" />
                    <p>{dict.defectiveGoodsPage.empty}</p>
                  </td>
                </tr>
              ) : records.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(r)}>
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-700">{r.defectNo}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={SOURCE_COLORS[r.source] ?? 'bg-gray-100'}>{SOURCE_LABELS[r.source] ?? r.source}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.product.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{r.product.sku}</div>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{r.quantity} {r.product.unit ?? ''}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={SEVERITY_COLORS[r.severity] ?? ''}>{SEVERITY_LABELS[r.severity] ?? r.severity}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-red-600">
                    {r.totalLoss ? `NT$${Number(r.totalLoss).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={STATUS_COLORS[r.status] ?? ''}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {r.disposition ? DISPOSITION_LABELS[r.disposition] ?? r.disposition : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {new Date(r.discoveredAt).toLocaleDateString('zh-TW')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
            <span>{dict.defectiveGoodsPage.paginationTotal} {total} {dict.common.items}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 w-7 p-0">
                <ChevronLeft size={14} />
              </Button>
              <span className="px-2 py-1">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 w-7 p-0">
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dict.defectiveGoodsPage.createTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">{dict.defectiveGoodsPage.fieldProduct}</div>
              <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                className="w-full border rounded-md px-3 h-9 text-sm bg-white">
                <option value="">{dict.common.select}</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.defectiveGoodsPage.fieldWarehouse}</div>
                <select value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))}
                  className="w-full border rounded-md px-3 h-9 text-sm bg-white">
                  <option value="">{dict.common.select}</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.defectiveGoodsPage.fieldQty}</div>
                <Input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.defectiveGoodsPage.fieldSource}</div>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  className="w-full border rounded-md px-3 h-9 text-sm bg-white">
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.defectiveGoodsPage.fieldSeverity}</div>
                <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                  className="w-full border rounded-md px-3 h-9 text-sm bg-white">
                  {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.defectiveGoodsPage.fieldDefectType}</div>
                <Input value={form.defectType} onChange={e => setForm(f => ({ ...f, defectType: e.target.value }))}
                  placeholder="LEAK / PACKAGING…" className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.defectiveGoodsPage.fieldBatchNo}</div>
                <Input value={form.batchNo} onChange={e => setForm(f => ({ ...f, batchNo: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{dict.defectiveGoodsPage.fieldDescription}</div>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="h-9" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} className="flex-1" disabled={!form.productId || !form.warehouseId || !form.quantity}>
                {dict.defectiveGoodsPage.btnRegister}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>{dict.common.cancel}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail / Disposition Dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PackageX size={16} />{selected.defectNo}
                  <Badge className={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    [dict.defectiveGoodsPage.detailProduct, selected.product.name],
                    ['SKU', selected.product.sku],
                    [dict.defectiveGoodsPage.detailWarehouse, selected.warehouse.name],
                    [dict.defectiveGoodsPage.detailQty, `${selected.quantity} ${selected.product.unit ?? ''}`],
                    [dict.defectiveGoodsPage.detailSource, SOURCE_LABELS[selected.source] ?? selected.source],
                    [dict.defectiveGoodsPage.detailSeverity, SEVERITY_LABELS[selected.severity] ?? selected.severity],
                    [dict.defectiveGoodsPage.detailBatchNo, selected.batchNo ?? '-'],
                    [dict.defectiveGoodsPage.detailLoss, selected.totalLoss ? `NT$${Number(selected.totalLoss).toLocaleString()}` : '-'],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">{k}</div>
                      <div className="font-medium">{v}</div>
                    </div>
                  ))}
                </div>
                {selected.description && (
                  <div className="text-xs bg-gray-50 rounded p-2">
                    <div className="text-gray-400 mb-0.5">{dict.defectiveGoodsPage.detailDescription}</div>
                    <div>{selected.description}</div>
                  </div>
                )}
                {selected.resolvedBy && (
                  <div className="text-xs text-emerald-700 bg-emerald-50 rounded p-2">
                    {dict.defectiveGoodsPage.resolvedByPrefix} {selected.resolvedBy.name}
                    {selected.resolvedAt && ` — ${new Date(selected.resolvedAt).toLocaleDateString('zh-TW')}`}
                  </div>
                )}

                {/* Disposition */}
                {selected.status === 'PENDING' || selected.status === 'PROCESSING' ? (
                  <div className="border-t pt-3">
                    <div className="text-xs font-medium text-gray-500 mb-2">{dict.defectiveGoodsPage.sectionDispose}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">{dict.defectiveGoodsPage.fieldDisposition}</div>
                        <select value={dispForm.disposition}
                          onChange={e => setDispForm(f => ({ ...f, disposition: e.target.value }))}
                          className="w-full border rounded-md px-3 h-9 text-xs bg-white">
                          <option value="">{dict.common.select}</option>
                          {Object.entries(DISPOSITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">{dict.defectiveGoodsPage.fieldDispNote}</div>
                        <Input value={dispForm.dispositionNote}
                          onChange={e => setDispForm(f => ({ ...f, dispositionNote: e.target.value }))}
                          className="h-9 text-xs" />
                      </div>
                    </div>
                    <Button onClick={handleDispose} className="mt-2 w-full" size="sm"
                      disabled={!dispForm.disposition}>
                      {dict.defectiveGoodsPage.btnMarkResolved}
                    </Button>
                  </div>
                ) : selected.disposition ? (
                  <div className="text-xs bg-blue-50 text-blue-700 rounded p-2">
                    {dict.defectiveGoodsPage.dispositionLabel}：{DISPOSITION_LABELS[selected.disposition] ?? selected.disposition}
                    {selected.dispositionNote && ` — ${selected.dispositionNote}`}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
