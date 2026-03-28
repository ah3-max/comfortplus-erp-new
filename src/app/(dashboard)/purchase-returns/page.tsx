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

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: '待處理', cls: 'bg-slate-100 text-slate-600' },
  APPROVED:   { label: '已核准', cls: 'bg-blue-100 text-blue-700' },
  RECEIVING:  { label: '退貨中', cls: 'bg-amber-100 text-amber-700' },
  RECEIVED:   { label: '已出貨', cls: 'bg-green-100 text-green-700' },
  INSPECTING: { label: '確認中', cls: 'bg-purple-100 text-purple-700' },
  COMPLETED:  { label: '已完成', cls: 'bg-green-200 text-green-800' },
  CANCELLED:  { label: '已取消', cls: 'bg-red-100 text-red-600' },
}
const TYPE_LABEL: Record<string, string> = { RETURN: '退貨', EXCHANGE: '換貨', PARTIAL: '部分退' }

function fmt(n: string | number | null) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function PurchaseReturnsPage() {
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
    } catch { toast.error('載入失敗') }
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
      toast.success('狀態已更新')
      fetchData(page)
    } catch { toast.error('更新失敗') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">進貨退貨單</h1>
          <p className="text-sm text-muted-foreground">供應商退貨管理、審核、應付帳款沖銷</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />新增退貨單</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end rounded-lg border bg-white p-4">
        <Input placeholder="搜尋退貨單號/供應商…" value={search} onChange={e => setSearch(e.target.value)} className="w-52" />
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
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => fetchData(page - 1)}>上一頁</Button>
              <Button size="sm" variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => fetchData(page + 1)}>下一頁</Button>
            </div>
          </div>
          <div className="rounded-lg border bg-white overflow-hidden">
            {data.data.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">無退貨記錄</div>
            ) : data.data.map(row => {
              const sc = STATUS_CONFIG[row.status] ?? { label: row.status, cls: 'bg-slate-100' }
              const isOpen = expanded.has(row.id)
              return (
                <div key={row.id} className="border-b last:border-0">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 text-sm">
                    <button onClick={() => toggleExpand(row.id)} className="text-muted-foreground">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <span className="font-mono text-xs w-32 flex-shrink-0">{row.returnNo}</span>
                    <Badge className={`text-xs flex-shrink-0 ${sc.cls}`}>{sc.label}</Badge>
                    <Badge className="bg-slate-100 text-slate-600 text-xs flex-shrink-0">{TYPE_LABEL[row.returnType] ?? row.returnType}</Badge>
                    <span className="flex-1 font-medium">{row.supplier.name}</span>
                    <span className="text-xs text-muted-foreground">採購單：{row.purchase.poNo}</span>
                    <span className="font-mono text-xs w-24 text-right text-red-600">{fmt(row.deductAmount)}</span>
                    <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{row.requestDate.slice(0, 10)}</span>
                    <div className="flex gap-1">
                      {row.status === 'PENDING' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'APPROVED')}>核准</Button>
                      )}
                      {row.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'RECEIVED')}>已出貨</Button>
                      )}
                      {row.status === 'RECEIVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(row.id, 'COMPLETED')}>完成</Button>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="bg-slate-50 border-t px-6 py-3 space-y-2">
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {row.reason && <span>退貨原因：{row.reason}</span>}
                        {row.debitNoteNo && <span>扣款通知單：{row.debitNoteNo}</span>}
                        {row.deductStatus && <span>扣款狀態：{row.deductStatus}</span>}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="h-7">品項</TableHead>
                            <TableHead className="h-7 w-16">數量</TableHead>
                            <TableHead className="h-7 w-24 text-right">單價</TableHead>
                            <TableHead className="h-7 w-24 text-right">小計</TableHead>
                            <TableHead className="h-7 w-20">批號</TableHead>
                            <TableHead className="h-7">退貨原因</TableHead>
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
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ purchaseId: '', supplierId: '', returnType: 'RETURN', reason: '', deductAmount: '', debitNoteNo: '', notes: '' })

  async function handleSubmit() {
    if (!form.purchaseId || !form.supplierId) { toast.error('請填寫採購單 ID 與供應商 ID'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/purchase-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, deductAmount: form.deductAmount ? Number(form.deductAmount) : null }),
      })
      if (!res.ok) throw new Error()
      toast.success('進貨退貨單建立成功')
      onCreated()
    } catch { toast.error('建立失敗') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>新增進貨退貨單</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {[
            { label: '採購單 ID', key: 'purchaseId', placeholder: '貼上採購單 ID' },
            { label: '供應商 ID', key: 'supplierId', placeholder: '貼上供應商 ID' },
            { label: '扣款金額', key: 'deductAmount', placeholder: '選填' },
            { label: '扣款通知單號', key: 'debitNoteNo', placeholder: '選填' },
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
            <label className="text-xs font-medium text-muted-foreground">退貨原因</label>
            <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={2} className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}建立</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
