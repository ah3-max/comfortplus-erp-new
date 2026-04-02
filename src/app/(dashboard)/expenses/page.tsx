'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Search, Receipt, CheckCircle2, XCircle, DollarSign, Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface ExpenseItem { id?: string; date: string; category: string; description: string; amount: number; receiptUrl?: string; lineNo: number }
interface ExpenseReport {
  id: string; reportNo: string; title: string; status: string; totalAmount: number; currency: string
  submittedAt: string | null; approvedAt: string | null; paidAt: string | null
  submittedBy: { name: string }; approvedBy?: { name: string } | null
  items: ExpenseItem[]
}

const CATEGORY_VALUES = ['TRANSPORT', 'MEAL', 'HOTEL', 'OFFICE', 'ENTERTAINMENT', 'TRAINING', 'OTHER']

const DEPARTMENT_OPTIONS = [
  { value: 'SALES',       label: '業務部' },
  { value: 'MARKETING',   label: '行銷部' },
  { value: 'FINANCE',     label: '財務部' },
  { value: 'WAREHOUSE',   label: '倉儲物流部' },
  { value: 'PROCUREMENT', label: '採購部' },
  { value: 'HR',          label: '人事行政部' },
  { value: 'IT',          label: '資訊部' },
  { value: 'MANAGEMENT',  label: '經營管理' },
  { value: 'OTHER',       label: '其他' },
]

function fmt(n: number) { return n.toLocaleString('zh-TW') }

export default function ExpensesPage() {
  const { dict } = useI18n()
  const ex = dict.expenses
  type ExSt = keyof typeof ex.statuses
  type ExCat = keyof typeof ex.categories
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const isFinance = ['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)

  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [showDialog, setShowDialog] = useState(false)
  const [detailReport, setDetailReport] = useState<ExpenseReport | null>(null)
  const [form, setForm] = useState({ title: '', department: '', notes: '' })
  const [items, setItems] = useState<ExpenseItem[]>([{ date: new Date().toISOString().slice(0, 10), category: 'TRANSPORT', description: '', amount: 0, lineNo: 1 }])
  const [saving, setSaving] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (search) qs.set('search', search)
    if (statusFilter) qs.set('status', statusFilter)
    fetch(`/api/expenses?${qs}`)
      .then(r => r.json())
      .then(d => setReports(d.data ?? []))
      .finally(() => setLoading(false))
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setSaving(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        department: form.department || null,
        notes: form.notes,
        items: items.filter(i => i.description && i.amount > 0),
      }),
    })
    setSaving(false)
    if (res.ok) { toast.success(ex.createSuccess); setShowDialog(false); load() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.saveFailed) }
  }

  async function doAction(id: string, action: string, extra?: Record<string, string>) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    if (res.ok) { toast.success(ex.actionSuccess); load(); setDetailReport(null); setShowRejectDialog(false) }
    else toast.error(ex.actionFailed)
  }

  async function handleDelete(id: string) {
    if (!confirm(ex.deleteConfirm)) return
    setDeleting(true)
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) { toast.success(ex.deleteSuccess); setDetailReport(null); load() }
    else toast.error(ex.deleteFailed)
  }

  function addItem() {
    setItems(prev => [...prev, { date: new Date().toISOString().slice(0, 10), category: 'OTHER', description: '', amount: 0, lineNo: prev.length + 1 }])
  }

  const total = items.reduce((s, i) => s + (i.amount || 0), 0)

  const summaryCards = [
    { label: ex.pendingReview, value: reports.filter(r => r.status === 'SUBMITTED').length, icon: Clock, color: 'text-blue-600' },
    { label: ex.statuses.APPROVED, value: reports.filter(r => r.status === 'APPROVED').length, icon: CheckCircle2, color: 'text-green-600' },
    { label: ex.totalAmount, value: `$${fmt(reports.reduce((s, r) => s + Number(r.totalAmount), 0))}`, icon: DollarSign, color: 'text-slate-900' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.expenses.title}</h1>
          <p className="text-sm text-muted-foreground">{ex.subtitle}</p>
        </div>
        <Button onClick={() => { setForm({ title: '', department: '', notes: '' }); setItems([{ date: new Date().toISOString().slice(0, 10), category: 'TRANSPORT', description: '', amount: 0, lineNo: 1 }]); setShowDialog(true) }}>
          <Plus className="h-4 w-4 mr-1" />{dict.expenses.newExpense}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map(c => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.common.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter || 'all'} onValueChange={(v: string | null) => setStatusFilter((v ?? '') === 'all' ? '' : (v ?? ''))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{dict.common.all}</SelectItem>
            {Object.entries(ex.statuses).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">{dict.expenses.noExpenses}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map(r => {
            const stLabel = ex.statuses[r.status as ExSt] ?? r.status
            const stColor = ex.statusColors[r.status as keyof typeof ex.statusColors] ?? ''
            return (
              <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailReport(r)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{r.title}</CardTitle>
                    <Badge variant="outline" className={stColor}>{stLabel}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{r.reportNo}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">${fmt(Number(r.totalAmount))}</span>
                    <span className="text-xs text-muted-foreground">{r.submittedBy.name}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dict.expenses.newExpense}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ex.titleLabel} <span className="text-red-500">*</span></Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" placeholder="如：3月出差費用" />
              </div>
              <div>
                <Label>{ex.departmentLabel}</Label>
                <Select value={form.department || '_none'} onValueChange={(v: string | null) => setForm(f => ({ ...f, department: v === '_none' || !v ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="選擇部門" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— 選擇部門 —</SelectItem>
                    {DEPARTMENT_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{ex.itemsLabel}</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" />{dict.common.add}</Button>
              </div>
              {items.map((item, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2 bg-slate-50/60 relative">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">日期</Label>
                      <Input type="date" value={item.date} className="mt-0.5 h-9"
                        onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">費用類別</Label>
                      <Select value={item.category} onValueChange={(v: string | null) => setItems(prev => prev.map((x, j) => j === i ? { ...x, category: v ?? 'OTHER' } : x))}>
                        <SelectTrigger className="h-9 mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORY_VALUES.map(v => <SelectItem key={v} value={v}>{ex.categories[v as ExCat] ?? v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">事由說明（做什麼事、目的）</Label>
                    <Input className="mt-0.5 h-9" placeholder="如：拜訪 XX 客戶交通費" value={item.description}
                      onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">金額（元）</Label>
                      <Input type="number" className="mt-0.5 h-9" placeholder="0" value={item.amount || ''}
                        onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
                    </div>
                    {items.length > 1 && (
                      <Button variant="ghost" size="sm" className="mt-4 text-red-500 hover:text-red-600"
                        onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <span className="text-sm font-bold text-slate-700">{dict.common.total}：<span className="text-lg text-blue-700">${fmt(total)}</span></span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}{dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailReport} onOpenChange={() => setDetailReport(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detailReport && (
            <>
              <DialogHeader>
                <DialogTitle>{detailReport.title}</DialogTitle>
                <p className="text-xs text-muted-foreground font-mono">{detailReport.reportNo}</p>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={ex.statusColors[detailReport.status as keyof typeof ex.statusColors] ?? ''}>{ex.statuses[detailReport.status as ExSt] ?? detailReport.status}</Badge>
                  <span className="text-xl font-bold">${fmt(Number(detailReport.totalAmount))}</span>
                </div>
                <div className="rounded-md border divide-y">
                  {detailReport.items.map((item, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="text-muted-foreground mr-2">{item.date?.slice(0, 10)}</span>
                        <Badge variant="outline" className="text-xs mr-2">{ex.categories[item.category as ExCat] ?? item.category}</Badge>
                        {item.description}
                      </div>
                      <span className="font-medium">${fmt(Number(item.amount))}</span>
                    </div>
                  ))}
                </div>
                {detailReport.approvedBy && (
                  <p className="text-xs text-muted-foreground">{ex.approvedPrefix}{detailReport.approvedBy.name}{detailReport.approvedAt ? ` · ${new Date(detailReport.approvedAt).toLocaleDateString('zh-TW')}` : ''}</p>
                )}
                {detailReport.paidAt && (
                  <p className="text-xs text-muted-foreground">{ex.paidAtPrefix}{new Date(detailReport.paidAt).toLocaleDateString('zh-TW')}</p>
                )}
                <div className="flex gap-2 justify-end flex-wrap">
                  {detailReport.status === 'DRAFT' && (
                    <>
                      <Button size="sm" variant="outline" className="text-red-600 gap-1" disabled={deleting}
                        onClick={() => handleDelete(detailReport.id)}>
                        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}{ex.deleteBtn}
                      </Button>
                      <Button size="sm" onClick={() => doAction(detailReport.id, 'SUBMIT')}>{dict.common.submit}</Button>
                    </>
                  )}
                  {detailReport.status === 'SUBMITTED' && isFinance && (
                    <>
                      <Button size="sm" variant="outline" className="text-red-600"
                        onClick={() => { setRejectReason(''); setShowRejectDialog(true) }}>{dict.common.reject}</Button>
                      <Button size="sm" onClick={() => doAction(detailReport.id, 'APPROVE')}>{dict.common.approve}</Button>
                    </>
                  )}
                  {detailReport.status === 'APPROVED' && isFinance && (
                    <Button size="sm" onClick={() => doAction(detailReport.id, 'PAY')}>{ex.confirmPay}</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Reject reason dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{ex.rejectDialogTitle}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <Label>{ex.rejectReasonLabel}</Label>
            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={ex.rejectReasonPlaceholder} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>{dict.common.cancel}</Button>
            <Button variant="destructive" onClick={() => detailReport && doAction(detailReport.id, 'REJECT', { notes: rejectReason })}>
              {ex.confirmRejectBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
