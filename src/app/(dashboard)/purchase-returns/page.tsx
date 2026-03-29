'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface ReturnItem {
  id: string; productId: string; quantity: number; unitCost: string; subtotal: string
  batchNo: string | null; reason: string | null; condition: string | null
  product: { sku: string; name: string; unit: string | null }
}
interface PurchaseReturn {
  id: string; returnNo: string; returnType: string; status: string
  reason: string | null; deductAmount: string | null; deductStatus: string | null
  debitNoteNo: string | null; requestDate: string; shippedDate: string | null; notes: string | null
  supplier: { id: string; name: string; code: string | null }
  purchase: { id: string; poNo: string }
  items: ReturnItem[]
}

const STATUS_CONFIG: Record<string, { cls: string }> = {
  PENDING:    { cls: 'bg-slate-100 text-slate-600' },
  APPROVED:   { cls: 'bg-blue-100 text-blue-700' },
  RECEIVING:  { cls: 'bg-amber-100 text-amber-700' },
  RECEIVED:   { cls: 'bg-green-100 text-green-700' },
  INSPECTING: { cls: 'bg-purple-100 text-purple-700' },
  COMPLETED:  { cls: 'bg-green-200 text-green-800' },
  CANCELLED:  { cls: 'bg-red-100 text-red-600' },
}
// TYPE_LABEL replaced by dict.purchaseReturns.typeLabels

function fmt(n: string | number | null) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function PurchaseReturnsPage() {
  const { dict } = useI18n()
  const [data, setData] = useState<{ data: PurchaseReturn[]; pagination: { total: number; totalPages: number } } | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showNew, setShowNew] = useState(false)

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: '50' })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res = await fetch(`/api/purchase-returns?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
      setPage(p)
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [search, status])

  useEffect(() => { fetchData(1) }, [fetchData])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      const patch: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'APPROVED') patch.approvedAt = new Date().toISOString()
      if (newStatus === 'RECEIVED') patch.shippedDate = new Date().toISOString()
      const res = await fetch(`/api/purchase-returns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      toast.success(dict.common.statusUpdated)
      fetchData(page)
    } catch { toast.error(dict.common.updateFailed) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.purchaseReturns.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.purchaseReturns.subtitle}</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />{dict.purchaseReturns.newReturn}</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end rounded-lg border bg-white p-4">
        <Input placeholder={dict.purchaseReturns.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} className="w-52" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
          <option value="">{dict.purchaseReturns.allStatuses}</option>
          {Object.keys(STATUS_CONFIG).map(k => <option key={k} value={k}>{dict.purchaseReturns.statusLabels[k as keyof typeof dict.purchaseReturns.statusLabels] ?? k}</option>)}
        </select>
        <Button onClick={() => fetchData(1)} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.confirm}</Button>
      </div>

      {data && (
        <>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>{dict.purchaseReturns.totalPrefix} {data.pagination.total} {dict.common.items}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => fetchData(page - 1)}>{dict.common.prevPage}</Button>
              <Button size="sm" variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => fetchData(page + 1)}>{dict.common.nextPage}</Button>
            </div>
          </div>
          <div className="rounded-lg border bg-white overflow-hidden">
            {data.data.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">{dict.purchaseReturns.noReturns}</div>
            ) : data.data.map(row => {
              const sc = STATUS_CONFIG[row.status] ?? { cls: 'bg-slate-100' }
              const scLabel = (dict.purchaseReturns.statusLabels as Record<string, string>)[row.status] ?? row.status
              const isOpen = expanded.has(row.id)
              return (
                <div key={row.id} className="border-b last:border-0">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 text-sm">
                    <button onClick={() => toggleExpand(row.id)} className="text-muted-foreground">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <span className="font-mono text-xs w-32 flex-shrink-0">{row.returnNo}</span>
                    <Badge className={`text-xs flex-shrink-0 ${sc.cls}`}>{scLabel}</Badge>
                    <Badge className="bg-slate-100 text-slate-600 text-xs flex-shrink-0">{(dict.purchaseReturns.typeLabels as Record<string, string>)[row.returnType] ?? row.returnType}</Badge>
                    <span className="flex-1 font-medium">{row.supplier.name}</span>
                    <span className="text-xs text-muted-foreground">{dict.purchaseReturns.poLabel}：{row.purchase.poNo}</span>
                    <span className="font-mono text-xs w-24 text-right text-red-600">{fmt(row.deductAmount)}</span>
                    <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{row.requestDate.slice(0, 10)}</span>
                    <div className="flex gap-1">
                      {row.status === 'PENDING' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'APPROVED')}>{dict.common.approve}</Button>
                      )}
                      {row.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'RECEIVED')}>{dict.purchaseReturns.statusLabels.RECEIVED}</Button>
                      )}
                      {row.status === 'RECEIVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'COMPLETED')}>{dict.common.complete}</Button>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="bg-slate-50 border-t px-6 py-3 space-y-2">
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {row.reason && <span>{dict.purchaseReturns.reason}：{row.reason}</span>}
                        {row.debitNoteNo && <span>{dict.purchaseReturns.debitNoteLabel}：{row.debitNoteNo}</span>}
                        {row.deductStatus && <span>{dict.purchaseReturns.deductStatusLabel}：{row.deductStatus}</span>}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="h-7">{dict.common.product}</TableHead>
                            <TableHead className="h-7 w-16">{dict.common.quantity}</TableHead>
                            <TableHead className="h-7 w-24 text-right">{dict.common.price}</TableHead>
                            <TableHead className="h-7 w-24 text-right">{dict.common.total}</TableHead>
                            <TableHead className="h-7 w-20">{dict.purchaseReturns.batchNo}</TableHead>
                            <TableHead className="h-7">{dict.purchaseReturns.reason}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {row.items.map(item => (
                            <TableRow key={item.id} className="text-xs">
                              <TableCell className="py-1.5">[{item.product.sku}] {item.product.name}</TableCell>
                              <TableCell className="py-1.5">{item.quantity} {item.product.unit}</TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{fmt(item.unitCost)}</TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{fmt(item.subtotal)}</TableCell>
                              <TableCell className="py-1.5 font-mono">{item.batchNo || '—'}</TableCell>
                              <TableCell className="py-1.5 text-muted-foreground">{item.reason || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <NewPurchaseReturnDialog open={showNew} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); fetchData(1) }} />
    </div>
  )
}

function NewPurchaseReturnDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { dict } = useI18n()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ purchaseId: '', supplierId: '', returnType: 'RETURN', reason: '', deductAmount: '', debitNoteNo: '', notes: '' })
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; code: string | null }[]>([])
  const [purchases, setPurchases] = useState<{ id: string; poNo: string; supplier: { id: string; name: string } }[]>([])

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/suppliers?limit=500').then(r => r.json()),
      fetch('/api/purchases').then(r => r.json()),
    ]).then(([sRes, pRes]) => {
      setSuppliers(Array.isArray(sRes) ? sRes : sRes.data ?? [])
      setPurchases(Array.isArray(pRes) ? pRes : pRes.data ?? [])
    }).catch(() => toast.error(dict.common.refLoadFailed))
  }, [open])

  // When purchase is selected, auto-fill supplier
  function handlePurchaseChange(purchaseId: string) {
    setForm(p => ({ ...p, purchaseId }))
    const po = purchases.find(po => po.id === purchaseId)
    if (po?.supplier) {
      setForm(p => ({ ...p, purchaseId, supplierId: po.supplier.id }))
    }
  }

  async function handleSubmit() {
    if (!form.purchaseId || !form.supplierId) { toast.error(dict.purchaseReturns.poSupplierRequired); return }
    setSaving(true)
    try {
      const res = await fetch('/api/purchase-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, deductAmount: form.deductAmount ? Number(form.deductAmount) : null }),
      })
      if (!res.ok) throw new Error()
      toast.success(dict.purchaseReturns.created)
      onCreated()
    } catch { toast.error(dict.common.createFailed) }
    finally { setSaving(false) }
  }

  // Filter purchases by selected supplier
  const filteredPurchases = form.supplierId
    ? purchases.filter(po => po.supplier?.id === form.supplierId)
    : purchases

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{dict.purchaseReturns.newReturn}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{dict.common.supplier} *</label>
            <select value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value, purchaseId: '' }))} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">{dict.purchaseReturns.selectSupplier}</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.code ? `${s.code} - ` : ''}{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{dict.purchaseReturns.poLabel} *</label>
            <select value={form.purchaseId} onChange={e => handlePurchaseChange(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">{dict.purchaseReturns.selectPo}</option>
              {filteredPurchases.map(po => <option key={po.id} value={po.id}>{po.poNo} — {po.supplier?.name ?? ''}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{dict.purchaseReturns.deductAmount}</label>
            <Input value={form.deductAmount} onChange={e => setForm(p => ({ ...p, deductAmount: e.target.value }))} placeholder={dict.common.optional} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{dict.purchaseReturns.debitNoteLabel}</label>
            <Input value={form.debitNoteNo} onChange={e => setForm(p => ({ ...p, debitNoteNo: e.target.value }))} placeholder={dict.common.optional} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{dict.purchaseReturns.returnTypeLabel}</label>
            <select value={form.returnType} onChange={e => setForm(p => ({ ...p, returnType: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="RETURN">{dict.purchaseReturns.typeLabels.RETURN}</option>
              <option value="EXCHANGE">{dict.purchaseReturns.typeLabels.EXCHANGE}</option>
              <option value="PARTIAL">{dict.purchaseReturns.typeLabels.PARTIAL}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{dict.purchaseReturns.reason}</label>
            <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={2} className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{dict.common.cancel}</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.create}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
