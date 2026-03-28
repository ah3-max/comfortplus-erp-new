'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
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
import { Loader2, Plus, Search, Receipt, CheckCircle2, XCircle, DollarSign, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface ExpenseItem { id?: string; date: string; category: string; description: string; amount: number; receiptUrl?: string; lineNo: number }
interface ExpenseReport {
  id: string; reportNo: string; title: string; status: string; totalAmount: number; currency: string
  submittedAt: string | null; approvedAt: string | null; paidAt: string | null
  submittedBy: { name: string }; approvedBy?: { name: string } | null
  items: ExpenseItem[]
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: '已提交', color: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: '已核准', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: '已退回', color: 'bg-red-100 text-red-700' },
  PAID: { label: '已付款', color: 'bg-emerald-100 text-emerald-700' },
}

const CATEGORIES = [
  { value: 'TRANSPORT', label: '交通費' },
  { value: 'MEAL', label: '餐飲費' },
  { value: 'HOTEL', label: '住宿費' },
  { value: 'OFFICE', label: '辦公用品' },
  { value: 'COMM', label: '通訊費' },
  { value: 'OTHER', label: '其他' },
]

function fmt(n: number) { return n.toLocaleString('zh-TW') }

export default function ExpensesPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const isFinance = ['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)

  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [showDialog, setShowDialog] = useState(false)
  const [detailReport, setDetailReport] = useState<ExpenseReport | null>(null)
  const [form, setForm] = useState({ title: '', notes: '' })
  const [items, setItems] = useState<ExpenseItem[]>([{ date: new Date().toISOString().slice(0, 10), category: 'TRANSPORT', description: '', amount: 0, lineNo: 1 }])
  const [saving, setSaving] = useState(false)

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
      body: JSON.stringify({ title: form.title, notes: form.notes, items: items.filter(i => i.description && i.amount > 0) }),
    })
    setSaving(false)
    if (res.ok) { toast.success('費用單已建立'); setShowDialog(false); load() }
    else { const d = await res.json(); toast.error(d.error ?? '建立失敗') }
  }

  async function doAction(id: string, action: string) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) { toast.success('操作成功'); load(); setDetailReport(null) }
    else toast.error('操作失敗')
  }

  function addItem() {
    setItems(prev => [...prev, { date: new Date().toISOString().slice(0, 10), category: 'OTHER', description: '', amount: 0, lineNo: prev.length + 1 }])
  }

  const total = items.reduce((s, i) => s + (i.amount || 0), 0)

  const summaryCards = [
    { label: '待審核', value: reports.filter(r => r.status === 'SUBMITTED').length, icon: Clock, color: 'text-blue-600' },
    { label: '已核准', value: reports.filter(r => r.status === 'APPROVED').length, icon: CheckCircle2, color: 'text-green-600' },
    { label: '總金額', value: `$${fmt(reports.reduce((s, r) => s + Number(r.totalAmount), 0))}`, icon: DollarSign, color: 'text-slate-900' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">費用報銷</h1>
          <p className="text-sm text-muted-foreground">管理差旅、辦公等費用報銷單</p>
        </div>
        <Button onClick={() => { setForm({ title: '', notes: '' }); setItems([{ date: new Date().toISOString().slice(0, 10), category: 'TRANSPORT', description: '', amount: 0, lineNo: 1 }]); setShowDialog(true) }}>
          <Plus className="h-4 w-4 mr-1" />新增費用單
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
          <Input className="pl-9" placeholder="搜尋..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter || 'all'} onValueChange={(v: string | null) => setStatusFilter((v ?? '') === 'all' ? '' : (v ?? ''))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">暫無費用單</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map(r => {
            const st = STATUS_MAP[r.status] ?? { label: r.status, color: '' }
            return (
              <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailReport(r)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{r.title}</CardTitle>
                    <Badge variant="outline" className={st.color}>{st.label}</Badge>
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
          <DialogHeader><DialogTitle>新增費用單</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>標題</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="2026/03 出差費用" className="mt-1" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>明細項目</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" />新增</Button>
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-2">
                    <Input type="date" value={item.date} onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                  </div>
                  <div className="col-span-2">
                    <Select value={item.category} onValueChange={(v: string | null) => setItems(prev => prev.map((x, j) => j === i ? { ...x, category: v ?? 'OTHER' } : x))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-5">
                    <Input placeholder="說明" value={item.description} onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="金額" value={item.amount || ''} onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="sm" className="text-red-500 h-9" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="text-right font-bold">合計：${fmt(total)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}建立
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
                  <Badge variant="outline" className={STATUS_MAP[detailReport.status]?.color}>{STATUS_MAP[detailReport.status]?.label}</Badge>
                  <span className="text-xl font-bold">${fmt(Number(detailReport.totalAmount))}</span>
                </div>
                <div className="rounded-md border divide-y">
                  {detailReport.items.map((item, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="text-muted-foreground mr-2">{item.date?.slice(0, 10)}</span>
                        <Badge variant="outline" className="text-xs mr-2">{CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}</Badge>
                        {item.description}
                      </div>
                      <span className="font-medium">${fmt(Number(item.amount))}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end flex-wrap">
                  {detailReport.status === 'DRAFT' && (
                    <Button size="sm" onClick={() => doAction(detailReport.id, 'SUBMIT')}>提交審核</Button>
                  )}
                  {detailReport.status === 'SUBMITTED' && isFinance && (
                    <>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => doAction(detailReport.id, 'REJECT')}>退回</Button>
                      <Button size="sm" onClick={() => doAction(detailReport.id, 'APPROVE')}>核准</Button>
                    </>
                  )}
                  {detailReport.status === 'APPROVED' && isFinance && (
                    <Button size="sm" onClick={() => doAction(detailReport.id, 'PAY')}>確認付款</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
