'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, MessageSquare, Package, Clock, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessingLog {
  id: string
  logType: string
  content: string
  createdAt: string
  createdBy: { id: string; name: string }
}

interface Consumption {
  id: string
  quantity: number
  unitCost: number | null
  totalCost: number | null
  notes: string | null
  product: { id: string; sku: string; name: string; unit: string }
}

interface AfterSalesOrder {
  id: string
  orderNo: string
  source: string
  status: string
  priority: string
  contactName: string | null
  contactPhone: string | null
  description: string
  totalCost: number | null
  scheduledAt: string | null
  completedAt: string | null
  notes: string | null
  createdAt: string
  customer: { id: string; name: string; code: string } | null
  assignedTo: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  processingLogs: ProcessingLog[]
  consumptions: Consumption[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  WARRANTY: '保固服務', REPAIR: '維修', REPLACEMENT: '換貨', MAINTENANCE: '例行維護',
  TRAINING: '教育訓練', OTHER: '其他',
}
const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  OPEN:          { label: '待處理',   color: 'secondary' },
  IN_PROGRESS:   { label: '處理中',   color: 'default' },
  PENDING_PARTS: { label: '等待零件', color: 'outline' },
  COMPLETED:     { label: '已完成',   color: 'default' },
  CANCELLED:     { label: '已取消',   color: 'destructive' },
}
const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW:    { label: '低',  color: 'text-slate-500' },
  MEDIUM: { label: '中',  color: 'text-blue-600' },
  HIGH:   { label: '高',  color: 'text-orange-600' },
  URGENT: { label: '緊急', color: 'text-red-600 font-bold' },
}
const LOG_TYPE_LABELS: Record<string, string> = {
  CONTACT: '聯繫客戶', VISIT: '到場服務', REPAIR: '維修', REPLACEMENT: '換貨',
  ESCALATION: '升級處理', RESOLVED: '問題解決', NOTE: '備註',
}

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(n) : '—'

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditForm {
  source: string
  priority: string
  description: string
  notes: string
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AfterSalesPage() {
  const { dict } = useI18n()
  const [orders, setOrders] = useState<AfterSalesOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [detail, setDetail] = useState<AfterSalesOrder | null>(null)
  const [detailTab, setDetailTab] = useState('logs')
  const [createOpen, setCreateOpen] = useState(false)
  const [logDialog, setLogDialog] = useState(false)
  const [consumptionDialog, setConsumptionDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ source: 'WARRANTY', priority: 'MEDIUM', description: '', notes: '' })

  const [newOrder, setNewOrder] = useState({ source: 'WARRANTY', priority: 'MEDIUM', contactName: '', contactPhone: '', description: '', scheduledAt: '', notes: '' })
  const [newLog, setNewLog] = useState({ logType: 'NOTE', content: '' })
  const [newConsumption, setNewConsumption] = useState({ productId: '', quantity: '', unitCost: '', notes: '' })

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter }),
      ...(priorityFilter && { priority: priorityFilter }),
    })
    const res = await fetch(`/api/after-sales?${p}`)
    const json = await res.json()
    setOrders(json.data ?? [])
    setLoading(false)
  }, [search, statusFilter, priorityFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function refreshDetail(id: string) {
    const res = await fetch(`/api/after-sales/${id}`)
    setDetail(await res.json())
  }

  async function handleCreate() {
    setSaving(true)
    const res = await fetch('/api/after-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(dict.afterSales.created)
      setCreateOpen(false)
      setNewOrder({ source: 'WARRANTY', priority: 'MEDIUM', contactName: '', contactPhone: '', description: '', scheduledAt: '', notes: '' })
      fetchOrders()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.createFailed)
    }
  }

  function openEdit(order: AfterSalesOrder, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(order.id)
    setEditForm({
      source: order.source,
      priority: order.priority,
      description: order.description,
      notes: order.notes ?? '',
    })
    setEditOpen(true)
  }

  async function handleEdit() {
    if (!editingId) return
    setSaving(true)
    const res = await fetch(`/api/after-sales/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: editForm.source,
        priority: editForm.priority,
        description: editForm.description,
        notes: editForm.notes || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(dict.afterSales.updated)
      setEditOpen(false)
      fetchOrders()
      if (detail?.id === editingId) refreshDetail(editingId)
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.updateFailed)
    }
  }

  async function handleDelete(order: AfterSalesOrder, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`確定要刪除服務單 ${order.orderNo}？此操作無法復原。`)) return
    const res = await fetch(`/api/after-sales/${order.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(dict.afterSales.deleted)
      if (detail?.id === order.id) setDetail(null)
      fetchOrders()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.deleteFailed)
    }
  }

  async function handleAddLog() {
    if (!detail) return
    setSaving(true)
    const res = await fetch(`/api/after-sales/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ADD_LOG', ...newLog }),
    })
    setSaving(false)
    if (res.ok) {
      setLogDialog(false)
      setNewLog({ logType: 'NOTE', content: '' })
      refreshDetail(detail.id)
    } else {
      toast.error(dict.afterSales.recordFailed)
    }
  }

  async function handleAddConsumption() {
    if (!detail || !newConsumption.productId || !newConsumption.quantity) return
    setSaving(true)
    const res = await fetch(`/api/after-sales/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ADD_CONSUMPTION',
        productId: newConsumption.productId,
        quantity: Number(newConsumption.quantity),
        unitCost: newConsumption.unitCost ? Number(newConsumption.unitCost) : null,
        notes: newConsumption.notes || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setConsumptionDialog(false)
      setNewConsumption({ productId: '', quantity: '', unitCost: '', notes: '' })
      refreshDetail(detail.id)
    } else {
      toast.error(dict.afterSales.consumableFailed)
    }
  }

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/after-sales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchOrders()
    if (detail?.id === id) refreshDetail(id)
  }

  const canEdit = (status: string) => ['OPEN', 'IN_PROGRESS'].includes(status)

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{dict.afterSales.title}</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />{dict.afterSales.newCase}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input placeholder={dict.afterSales.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-52" />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? '')}>
          <SelectTrigger className="h-8 w-32"><SelectValue placeholder={dict.common.all} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.common.all}</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v ?? '')}>
          <SelectTrigger className="h-8 w-28"><SelectValue placeholder={dict.common.all} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.common.all}</SelectItem>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <p className="py-8 text-center text-muted-foreground">{dict.common.loading}</p>
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{dict.afterSales.noResults}</p>
        ) : orders.map(o => (
          <div key={o.id} className="group flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer" onClick={() => { setDetail(o); setDetailTab('logs') }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{o.orderNo}</span>
                <Badge variant="outline" className="text-xs">{SOURCE_LABELS[o.source] ?? o.source}</Badge>
                <span className={`text-xs ${PRIORITY_CONFIG[o.priority]?.color ?? ''}`}>{PRIORITY_CONFIG[o.priority]?.label ?? o.priority}</span>
              </div>
              <p className="mt-0.5 truncate font-medium">{o.description}</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {o.customer && <span>客戶：{o.customer.name}</span>}
                {o.assignedTo && <span>負責：{o.assignedTo.name}</span>}
                {o.scheduledAt && <span><Clock className="mr-0.5 inline h-3 w-3" />{new Date(o.scheduledAt).toLocaleDateString('zh-TW')}</span>}
              </div>
            </div>
            <div className="ml-3 flex shrink-0 items-center gap-1.5">
              {/* Edit button (OPEN or IN_PROGRESS) */}
              {canEdit(o.status) && (
                <button
                  className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100 text-muted-foreground"
                  onClick={e => openEdit(o, e)}
                  title="編輯"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {/* Delete button (OPEN only) */}
              {o.status === 'OPEN' && (
                <button
                  className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-red-500"
                  onClick={e => handleDelete(o, e)}
                  title="刪除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <Badge variant={STATUS_CONFIG[o.status]?.color ?? 'outline'}>{STATUS_CONFIG[o.status]?.label ?? o.status}</Badge>
            </div>
          </div>
        ))}
      </div>

      {/* ── Detail Dialog ── */}
      {detail && (
        <Dialog open onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{detail.orderNo}</span>
                <Badge variant={STATUS_CONFIG[detail.status]?.color ?? 'outline'}>{STATUS_CONFIG[detail.status]?.label ?? detail.status}</Badge>
              </DialogTitle>
            </DialogHeader>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {canEdit(detail.status) && (
                <Button size="sm" variant="outline" onClick={e => openEdit(detail, e)}>
                  <Pencil className="mr-1 h-4 w-4" />{dict.common.edit}
                </Button>
              )}
              {Object.entries(STATUS_CONFIG).filter(([k]) => k !== detail.status).map(([k, v]) => (
                <Button key={k} variant="outline" size="sm" onClick={() => handleStatusChange(detail.id, k)}>→ {v.label}</Button>
              ))}
              {detail.status === 'OPEN' && (
                <Button size="sm" variant="destructive" onClick={e => handleDelete(detail, e)}>
                  <Trash2 className="mr-1 h-4 w-4" />{dict.common.delete}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">服務類型：</span>{SOURCE_LABELS[detail.source] ?? detail.source}</div>
              <div><span className="text-muted-foreground">優先級：</span><span className={PRIORITY_CONFIG[detail.priority]?.color ?? ''}>{PRIORITY_CONFIG[detail.priority]?.label ?? detail.priority}</span></div>
              {detail.customer && <div><span className="text-muted-foreground">客戶：</span>{detail.customer.name}</div>}
              {detail.contactName && <div><span className="text-muted-foreground">聯絡人：</span>{detail.contactName}</div>}
              {detail.assignedTo && <div><span className="text-muted-foreground">負責人：</span>{detail.assignedTo.name}</div>}
              {detail.scheduledAt && <div><span className="text-muted-foreground">預約時間：</span>{new Date(detail.scheduledAt).toLocaleString('zh-TW')}</div>}
              <div className="col-span-2"><span className="text-muted-foreground">問題說明：</span>{detail.description}</div>
              <div><span className="text-muted-foreground">消耗成本：</span>{fmt(detail.totalCost)}</div>
            </div>

            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList>
                <TabsTrigger value="logs"><MessageSquare className="mr-1 h-4 w-4" />處理記錄</TabsTrigger>
                <TabsTrigger value="consumptions"><Package className="mr-1 h-4 w-4" />消耗明細</TabsTrigger>
              </TabsList>

              <TabsContent value="logs">
                <div className="mb-2 flex justify-end">
                  <Button size="sm" onClick={() => setLogDialog(true)}><Plus className="mr-1 h-4 w-4" />{dict.common.add}</Button>
                </div>
                {detail.processingLogs.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">尚無處理記錄</p>
                ) : (
                  <div className="space-y-2">
                    {detail.processingLogs.map(log => (
                      <div key={log.id} className="rounded border p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">{LOG_TYPE_LABELS[log.logType] ?? log.logType}</Badge>
                          <span className="text-xs text-muted-foreground">{log.createdBy.name} · {new Date(log.createdAt).toLocaleString('zh-TW')}</span>
                        </div>
                        <p className="mt-1">{log.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="consumptions">
                <div className="mb-2 flex justify-end">
                  <Button size="sm" onClick={() => setConsumptionDialog(true)}><Plus className="mr-1 h-4 w-4" />{dict.common.add}</Button>
                </div>
                {detail.consumptions.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">尚無消耗明細</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-xs text-muted-foreground">
                      <th className="py-1 text-left">品項</th>
                      <th className="py-1 text-right">數量</th>
                      <th className="py-1 text-right">單位成本</th>
                      <th className="py-1 text-right">小計</th>
                    </tr></thead>
                    <tbody>
                      {detail.consumptions.map(c => (
                        <tr key={c.id} className="border-b">
                          <td className="py-1.5"><p className="font-medium">{c.product.name}</p><p className="text-xs text-muted-foreground">{c.product.sku}</p></td>
                          <td className="py-1.5 text-right">{c.quantity} {c.product.unit}</td>
                          <td className="py-1.5 text-right">{fmt(c.unitCost)}</td>
                          <td className="py-1.5 text-right font-semibold">{fmt(c.totalCost)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td colSpan={3} className="py-1.5 text-right">總成本</td>
                        <td className="py-1.5 text-right">{fmt(detail.totalCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </TabsContent>
            </Tabs>

            {detail.status === 'IN_PROGRESS' && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => handleStatusChange(detail.id, 'COMPLETED')}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />{dict.common.complete}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dict.common.edit}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>服務類型 *</Label>
                <Select value={editForm.source} onValueChange={v => setEditForm(f => ({ ...f, source: v ?? 'WARRANTY' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>優先級</Label>
                <Select value={editForm.priority} onValueChange={v => setEditForm(f => ({ ...f, priority: v ?? 'MEDIUM' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>問題說明 *</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="mt-1" rows={3} />
            </div>
            <div><Label>備註</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
            <Button onClick={handleEdit} disabled={saving || !editForm.description}>{dict.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dict.afterSales.newCase}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>服務類型 *</Label>
                <Select value={newOrder.source} onValueChange={v => setNewOrder(o => ({ ...o, source: v ?? 'WARRANTY' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>優先級</Label>
                <Select value={newOrder.priority} onValueChange={v => setNewOrder(o => ({ ...o, priority: v ?? 'MEDIUM' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>聯絡人</Label><Input value={newOrder.contactName} onChange={e => setNewOrder(o => ({ ...o, contactName: e.target.value }))} className="mt-1" /></div>
              <div><Label>聯絡電話</Label><Input value={newOrder.contactPhone} onChange={e => setNewOrder(o => ({ ...o, contactPhone: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>問題說明 *</Label><Textarea value={newOrder.description} onChange={e => setNewOrder(o => ({ ...o, description: e.target.value }))} className="mt-1" rows={3} /></div>
            <div><Label>預約時間</Label><Input type="datetime-local" value={newOrder.scheduledAt} onChange={e => setNewOrder(o => ({ ...o, scheduledAt: e.target.value }))} className="mt-1" /></div>
            <div><Label>備註</Label><Textarea value={newOrder.notes} onChange={e => setNewOrder(o => ({ ...o, notes: e.target.value }))} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={saving || !newOrder.description}>{dict.common.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Log Dialog ── */}
      <Dialog open={logDialog} onOpenChange={setLogDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增處理記錄</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>記錄類型</Label>
              <Select value={newLog.logType} onValueChange={v => setNewLog(l => ({ ...l, logType: v ?? 'NOTE' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LOG_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>處理內容 *</Label><Textarea value={newLog.content} onChange={e => setNewLog(l => ({ ...l, content: e.target.value }))} className="mt-1" rows={4} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleAddLog} disabled={saving || !newLog.content}>{dict.common.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Consumption Dialog ── */}
      <Dialog open={consumptionDialog} onOpenChange={setConsumptionDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>新增消耗品項</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>品項 ID *</Label><Input value={newConsumption.productId} onChange={e => setNewConsumption(c => ({ ...c, productId: e.target.value }))} className="mt-1" placeholder="貼上商品 ID" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>數量 *</Label><Input type="number" value={newConsumption.quantity} onChange={e => setNewConsumption(c => ({ ...c, quantity: e.target.value }))} className="mt-1" /></div>
              <div><Label>單位成本</Label><Input type="number" value={newConsumption.unitCost} onChange={e => setNewConsumption(c => ({ ...c, unitCost: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>備註</Label><Input value={newConsumption.notes} onChange={e => setNewConsumption(c => ({ ...c, notes: e.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsumptionDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleAddConsumption} disabled={saving || !newConsumption.productId || !newConsumption.quantity}>{dict.common.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
