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
import { Loader2, Plus, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
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

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: '待處理', cls: 'bg-slate-100 text-slate-600' },
  APPROVED:   { label: '已核准', cls: 'bg-blue-100 text-blue-700' },
  RECEIVING:  { label: '收貨中', cls: 'bg-amber-100 text-amber-700' },
  RECEIVED:   { label: '已收貨', cls: 'bg-green-100 text-green-700' },
  INSPECTING: { label: '檢驗中', cls: 'bg-purple-100 text-purple-700' },
  COMPLETED:  { label: '已完成', cls: 'bg-green-200 text-green-800' },
  CANCELLED:  { label: '已取消', cls: 'bg-red-100 text-red-600' },
}
const TYPE_LABEL: Record<string, string> = { RETURN: '退貨', EXCHANGE: '換貨', PARTIAL: '部分退' }
const CONDITION_LABEL: Record<string, string> = { GOOD: '良品', DAMAGED: '損壞', DEFECTIVE: '瑕疵' }

function fmt(n: string | number | null) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function SalesReturnsPage() {
  const { dict } = useI18n()
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
          <p className="text-sm text-muted-foreground">客戶退貨申請管理、審核、庫存回沖</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />{dict.salesReturns.newReturn}</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end rounded-lg border bg-white p-4">
        <Input placeholder={dict.salesReturns.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} className="w-52" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
          <option value="">全部狀態</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button onClick={() => fetchData(1)} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢</Button>
      </div>

      {data && (
        <>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>共 {data.pagination.total} 筆</span>
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
                    <span className="text-xs text-muted-foreground">訂單：{row.order.orderNo}</span>
                    <span className="font-mono text-xs w-24 text-right">{fmt(row.refundAmount)}</span>
                    <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{row.requestDate.slice(0, 10)}</span>
                    <div className="flex gap-1">
                      {row.status === 'PENDING' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'APPROVED')}>核准</Button>
                      )}
                      {row.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'RECEIVED')}>確認收貨</Button>
                      )}
                      {row.status === 'RECEIVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'COMPLETED')}>完成</Button>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="bg-slate-50 border-t px-6 py-3 space-y-2">
                      {row.reason && <p className="text-sm text-muted-foreground">{dict.salesReturns.reason}：{row.reason}</p>}
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="h-7">品項</TableHead>
                            <TableHead className="h-7 w-16">數量</TableHead>
                            <TableHead className="h-7 w-20">批號</TableHead>
                            <TableHead className="h-7 w-16">品況</TableHead>
                            <TableHead className="h-7">退貨原因</TableHead>
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

function NewReturnDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { dict } = useI18n()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ orderId: '', customerId: '', returnType: 'RETURN', reason: '', refundAmount: '', notes: '' })

  async function handleSubmit() {
    if (!form.orderId || !form.customerId) { toast.error(dict.salesReturns.orderCustomerRequired); return }
    setSaving(true)
    try {
      const res = await fetch('/api/sales-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, refundAmount: form.refundAmount ? Number(form.refundAmount) : null }),
      })
      if (!res.ok) throw new Error()
      toast.success(dict.salesReturns.created)
      onCreated()
    } catch { toast.error(dict.common.createFailed) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{dict.salesReturns.newReturn}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {[
            { label: '訂單 ID', key: 'orderId', placeholder: '貼上訂單 ID' },
            { label: '客戶 ID', key: 'customerId', placeholder: '貼上客戶 ID' },
            { label: '退款金額', key: 'refundAmount', placeholder: '選填' },
          ].map(f => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <Input value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">退貨類型</label>
            <select value={form.returnType} onChange={e => setForm(p => ({ ...p, returnType: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="RETURN">退貨</option>
              <option value="EXCHANGE">換貨</option>
              <option value="PARTIAL">部分退貨</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{dict.salesReturns.reason}</label>
            <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={2} className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{dict.common.notes}</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-md border px-3 py-2 text-sm" />
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
