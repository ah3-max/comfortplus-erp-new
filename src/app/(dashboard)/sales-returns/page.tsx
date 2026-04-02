'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Plus, RotateCcw, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface ReturnItem {
  id: string; productId: string; quantity: number
  batchNo: string | null; reason: string | null; condition: string | null
  product: { sku: string; name: string; unit: string | null }
}
interface ReturnOrder {
  id: string; returnNo: string; returnType: string; status: string
  reason: string | null; refundAmount: string | null; refundStatus: string | null
  requestDate: string; receivedDate: string | null; notes: string | null
  customer: { id: string; name: string; code: string | null }
  order: { id: string; orderNo: string }
  items: ReturnItem[]
}

const STATUS_CLS: Record<string, string> = {
  PENDING:    'bg-slate-100 text-slate-600',
  APPROVED:   'bg-blue-100 text-blue-700',
  RECEIVING:  'bg-amber-100 text-amber-700',
  RECEIVED:   'bg-green-100 text-green-700',
  INSPECTING: 'bg-purple-100 text-purple-700',
  COMPLETED:  'bg-green-200 text-green-800',
  CANCELLED:  'bg-red-100 text-red-600',
}

function fmt(n: string | number | null) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function SalesReturnsPage() {
  const { dict } = useI18n()
  const sr = dict.salesReturns
  const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    PENDING:    { label: sr.statuses.PENDING,    cls: STATUS_CLS.PENDING },
    APPROVED:   { label: sr.statuses.APPROVED,   cls: STATUS_CLS.APPROVED },
    RECEIVING:  { label: sr.statuses.RECEIVING,  cls: STATUS_CLS.RECEIVING },
    RECEIVED:   { label: sr.statuses.RECEIVED,   cls: STATUS_CLS.RECEIVED },
    INSPECTING: { label: sr.statuses.INSPECTING, cls: STATUS_CLS.INSPECTING },
    COMPLETED:  { label: sr.statuses.COMPLETED,  cls: STATUS_CLS.COMPLETED },
    CANCELLED:  { label: sr.statuses.CANCELLED,  cls: STATUS_CLS.CANCELLED },
  }
  const TYPE_LABEL: Record<string, string> = { RETURN: sr.typeLabels.RETURN, EXCHANGE: sr.typeLabels.EXCHANGE, PARTIAL: sr.typeLabels.PARTIAL }
  const CONDITION_LABEL: Record<string, string> = { GOOD: sr.conditionLabels.GOOD, DAMAGED: sr.conditionLabels.DAMAGED, DEFECTIVE: sr.conditionLabels.DEFECTIVE }
  const [data, setData] = useState<{ data: ReturnOrder[]; pagination: { total: number; totalPages: number } } | null>(null)
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
      const res = await fetch(`/api/sales-returns?${params}`)
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
      const res = await fetch(`/api/sales-returns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...(newStatus === 'APPROVED' ? { approvedAt: new Date().toISOString() } : {}) }),
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
          <h1 className="text-2xl font-bold text-slate-900">{dict.salesReturns.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.salesReturns.title}</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />{dict.salesReturns.newReturn}</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end rounded-lg border bg-white p-4">
        <Input placeholder={dict.salesReturns.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} className="w-52" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
          <option value="">{sr.allStatuses}</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button onClick={() => fetchData(1)} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{sr.query}</Button>
      </div>

      {data && (
        <>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>{data.pagination.total}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => fetchData(page - 1)}>{dict.common.prevPage}</Button>
              <Button size="sm" variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => fetchData(page + 1)}>{dict.common.nextPage}</Button>
            </div>
          </div>
          <div className="rounded-lg border bg-white overflow-hidden">
            {data.data.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">{dict.salesReturns.noReturns}</div>
            ) : data.data.map(row => {
              const sc = STATUS_CONFIG[row.status] ?? { label: row.status, cls: 'bg-slate-100' }
              const isOpen = expanded.has(row.id)
              return (
                <div key={row.id} className="border-b last:border-0">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 text-sm">
                    <button onClick={() => toggleExpand(row.id)} className="text-muted-foreground">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <span className="font-mono text-xs w-28 flex-shrink-0">{row.returnNo}</span>
                    <Badge className={`text-xs flex-shrink-0 ${sc.cls}`}>{sc.label}</Badge>
                    <Badge className="bg-slate-100 text-slate-600 text-xs flex-shrink-0">{TYPE_LABEL[row.returnType] ?? row.returnType}</Badge>
                    <span className="flex-1 font-medium">{row.customer.name}</span>
                    <span className="text-xs text-muted-foreground">{sr.orderLabel}：{row.order.orderNo}</span>
                    <span className="font-mono text-xs w-24 text-right">{fmt(row.refundAmount)}</span>
                    <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{row.requestDate.slice(0, 10)}</span>
                    <div className="flex gap-1">
                      {row.status === 'PENDING' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'APPROVED')}>{sr.actionApprove}</Button>
                      )}
                      {row.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'RECEIVED')}>{sr.actionReceive}</Button>
                      )}
                      {row.status === 'RECEIVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'COMPLETED')}>{sr.actionComplete}</Button>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="bg-slate-50 border-t px-6 py-3 space-y-2">
                      {row.reason && <p className="text-sm text-muted-foreground">{dict.salesReturns.reason}：{row.reason}</p>}
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="h-7">{sr.colProduct}</TableHead>
                            <TableHead className="h-7 w-16">{sr.colQty}</TableHead>
                            <TableHead className="h-7 w-20">{sr.colBatchNo}</TableHead>
                            <TableHead className="h-7 w-16">{sr.colCondition}</TableHead>
                            <TableHead className="h-7">{sr.colReason}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {row.items.map(item => (
                            <TableRow key={item.id} className="text-xs">
                              <TableCell className="py-1.5">[{item.product.sku}] {item.product.name}</TableCell>
                              <TableCell className="py-1.5">{item.quantity} {item.product.unit}</TableCell>
                              <TableCell className="py-1.5 font-mono">{item.batchNo || '—'}</TableCell>
                              <TableCell className="py-1.5">{item.condition ? (CONDITION_LABEL[item.condition] ?? item.condition) : '—'}</TableCell>
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

      <NewReturnDialog open={showNew} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); fetchData(1) }} />
    </div>
  )
}

interface Customer { id: string; name: string; code: string }
interface SalesOrder { id: string; orderNo: string; customerId: string; customer: { name: string } }
interface Product { id: string; sku: string; name: string; unit: string | null }
interface ReturnLineItem { productId: string; productName: string; quantity: number; condition: string; reason: string }

function NewReturnDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { dict } = useI18n()
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({
    customerId: '', orderId: '', returnType: 'RETURN',
    reason: '', refundAmount: '', notes: '', warehouseId: '',
  })
  const [items, setItems] = useState<ReturnLineItem[]>([
    { productId: '', productName: '', quantity: 1, condition: 'GOOD', reason: '' },
  ])

  // Load customers + products on open
  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/customers?pageSize=200').then(r => r.json()),
      fetch('/api/products?pageSize=300&isActive=true').then(r => r.json()),
    ]).then(([c, p]) => {
      setCustomers(Array.isArray(c) ? c : (c.data ?? []))
      setProducts(Array.isArray(p) ? p : (p.data ?? []))
    })
  }, [open])

  // Load orders when customer changes
  useEffect(() => {
    if (!form.customerId) { setOrders([]); return }
    fetch(`/api/orders?customerId=${form.customerId}&pageSize=100&status=CONFIRMED,SHIPPED,COMPLETED`)
      .then(r => r.json())
      .then(d => setOrders(Array.isArray(d) ? d : (d.data ?? [])))
  }, [form.customerId])

  function setField(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function addItem() {
    setItems(prev => [...prev, { productId: '', productName: '', quantity: 1, condition: 'GOOD', reason: '' }])
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, j) => j !== i))
  }

  function setItemField<K extends keyof ReturnLineItem>(i: number, k: K, v: ReturnLineItem[K]) {
    setItems(prev => prev.map((item, j) => j === i ? { ...item, [k]: v } : item))
  }

  async function handleSubmit() {
    if (!form.customerId) { toast.error('請選擇客戶'); return }
    if (!form.orderId) { toast.error('請選擇來源訂單'); return }
    const validItems = items.filter(i => i.productId && i.quantity > 0)
    setSaving(true)
    try {
      const res = await fetch('/api/sales-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          orderId: form.orderId,
          returnType: form.returnType,
          reason: form.reason || null,
          refundAmount: form.refundAmount ? Number(form.refundAmount) : null,
          notes: form.notes || null,
          warehouseId: form.warehouseId || null,
          items: validItems.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            condition: i.condition,
            reason: i.reason || null,
          })),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? dict.common.createFailed)
      }
      toast.success(dict.salesReturns.created)
      // Reset
      setForm({ customerId: '', orderId: '', returnType: 'RETURN', reason: '', refundAmount: '', notes: '', warehouseId: '' })
      setItems([{ productId: '', productName: '', quantity: 1, condition: 'GOOD', reason: '' }])
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.common.createFailed)
    } finally { setSaving(false) }
  }

  const CONDITION_OPTIONS = [
    { value: 'GOOD', label: '良品可再銷售' },
    { value: 'DAMAGED', label: '損壞' },
    { value: 'DEFECTIVE', label: '瑕疵品' },
  ]

  return (
    <Dialog open={open} onOpenChange={v => { if (!saving) onClose(); if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{dict.salesReturns.newReturn}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">

          {/* Customer + Order */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>客戶 <span className="text-red-500">*</span></Label>
              <Select value={form.customerId || '_none'} onValueChange={(v: string | null) => {
                const val = v === '_none' || !v ? '' : v
                setField('customerId', val)
                setField('orderId', '')
              }}>
                <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
                <SelectContent className="max-h-56 w-[300px]">
                  <SelectItem value="_none">— 選擇客戶 —</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>來源訂單 <span className="text-red-500">*</span></Label>
              <Select value={form.orderId || '_none'} onValueChange={(v: string | null) => setField('orderId', v === '_none' || !v ? '' : v)}
                disabled={!form.customerId}>
                <SelectTrigger><SelectValue placeholder={form.customerId ? '選擇訂單' : '請先選客戶'} /></SelectTrigger>
                <SelectContent className="max-h-56 w-[300px]">
                  <SelectItem value="_none">— 選擇訂單 —</SelectItem>
                  {orders.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.orderNo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Return type + Refund amount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{dict.salesReturns.returnTypeLabel}</Label>
              <Select value={form.returnType} onValueChange={(v: string | null) => setField('returnType', v ?? 'RETURN')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETURN">{dict.salesReturns.typeLabels.RETURN}</SelectItem>
                  <SelectItem value="EXCHANGE">{dict.salesReturns.typeLabels.EXCHANGE}</SelectItem>
                  <SelectItem value="PARTIAL">{dict.salesReturns.typeLabels.PARTIAL}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.salesReturns.refundAmount}（退款金額）</Label>
              <Input type="number" min={0} placeholder="0"
                value={form.refundAmount} onChange={e => setField('refundAmount', e.target.value)} />
            </div>
          </div>

          {/* Return Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>退貨品項</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />新增品項
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">商品</Label>
                    <Select value={item.productId || '_none'}
                      onValueChange={(v: string | null) => {
                        const pid = v === '_none' || !v ? '' : v
                        const prod = products.find(p => p.id === pid)
                        setItemField(i, 'productId', pid)
                        setItemField(i, 'productName', prod?.name ?? '')
                      }}>
                      <SelectTrigger className="h-9 mt-0.5"><SelectValue placeholder="選擇商品" /></SelectTrigger>
                      <SelectContent className="max-h-48 w-[280px]">
                        <SelectItem value="_none">— 選擇商品 —</SelectItem>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>[{p.sku}] {p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">品項狀況</Label>
                    <Select value={item.condition}
                      onValueChange={(v: string | null) => setItemField(i, 'condition', v ?? 'GOOD')}>
                      <SelectTrigger className="h-9 mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24">
                    <Label className="text-xs text-muted-foreground">數量</Label>
                    <Input type="number" min={1} className="h-9 mt-0.5"
                      value={item.quantity}
                      onChange={e => setItemField(i, 'quantity', Math.max(1, Number(e.target.value)))} />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">退貨原因</Label>
                    <Input className="h-9 mt-0.5" placeholder="如：品質瑕疵、尺寸不符..."
                      value={item.reason}
                      onChange={e => setItemField(i, 'reason', e.target.value)} />
                  </div>
                  {items.length > 1 && (
                    <Button variant="ghost" size="sm" className="mt-4 text-red-500" onClick={() => removeItem(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Reason + Notes */}
          <div className="space-y-1.5">
            <Label>{dict.salesReturns.reason}（整體說明）</Label>
            <Textarea value={form.reason} onChange={e => setField('reason', e.target.value)}
              rows={2} placeholder="整批退貨原因..." />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.common.notes}</Label>
            <Textarea value={form.notes} onChange={e => setField('notes', e.target.value)}
              rows={2} placeholder="備注..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{dict.common.cancel}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
