'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Ship, DollarSign, FileText, Landmark } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CostItem {
  id: string
  category: string
  description: string
  currency: string
  amount: number
  amountTWD: number | null
  invoiceNo: string | null
  invoiceDate: string | null
  notes: string | null
  supplier: { id: string; name: string } | null
}

interface Payment {
  id: string
  paymentType: string
  currency: string
  amount: number
  amountTWD: number | null
  exchangeRate: number | null
  paymentDate: string
  remittanceRef: string | null
}

interface Customs {
  id: string
  declarationNo: string | null
  declaredAt: string | null
  customsValue: number | null
  dutyRate: number | null
  dutyAmount: number | null
  vatAmount: number | null
  status: string
  clearedAt: string | null
  notes: string | null
}

interface ImportProjectBase {
  id: string
  projectNo: string
  name: string
  description: string | null
  status: string
  currency: string
  exchangeRate: number | null
  etd: string | null
  eta: string | null
  actualArrival: string | null
  totalCost: number | null
  notes: string | null
  createdAt: string
  supplier: { id: string; name: string; code: string } | null
  createdBy: { id: string; name: string }
  costItems: CostItem[]
  payments: Payment[]
  customs: Customs[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  OPEN: '開案', IN_PROGRESS: '進行中', CUSTOMS: '清關中',
  RECEIVED: '已到倉', CLOSED: '已結案', CANCELLED: '已取消',
}
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'secondary', IN_PROGRESS: 'default', CUSTOMS: 'outline',
  RECEIVED: 'default', CLOSED: 'secondary', CANCELLED: 'destructive',
}
const COST_CATEGORIES: Record<string, string> = {
  GOODS: '貨款', FREIGHT: '運費', INSURANCE: '保險費',
  CUSTOMS_DUTY: '關稅', VAT: '營業稅', INSPECTION: '驗貨費',
  AGENT_FEE: '代理費', OTHER: '其他',
}
const PAYMENT_TYPES: Record<string, string> = {
  DEPOSIT: '訂金', PROGRESS: '期款', FINAL: '尾款', FULL: '全額',
}
const CUSTOMS_STATUS_LABELS: Record<string, string> = {
  PENDING: '待報關', SUBMITTED: '已申報', CLEARED: '已放行', HELD: '扣留中',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ImportProjectsPage() {
  const [projects, setProjects] = useState<ImportProjectBase[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detail, setDetail] = useState<ImportProjectBase | null>(null)
  const [detailTab, setDetailTab] = useState('costs')
  const [createOpen, setCreateOpen] = useState(false)
  const [costDialog, setCostDialog] = useState(false)
  const [paymentDialog, setPaymentDialog] = useState(false)
  const [customsDialog, setCustomsDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newProject, setNewProject] = useState({ name: '', description: '', currency: 'USD', exchangeRate: '', etd: '', eta: '', notes: '' })
  const [newCost, setNewCost] = useState({ category: 'GOODS', description: '', currency: 'USD', amount: '', amountTWD: '', invoiceNo: '', invoiceDate: '' })
  const [newPayment, setNewPayment] = useState({ paymentType: 'FULL', currency: 'USD', amount: '', amountTWD: '', exchangeRate: '', paymentDate: '', remittanceRef: '' })
  const [newCustoms, setNewCustoms] = useState({ declarationNo: '', declaredAt: '', customsValue: '', dutyRate: '', dutyAmount: '', vatAmount: '', status: 'PENDING', clearedAt: '', notes: '' })

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ ...(search && { search }), ...(statusFilter && { status: statusFilter }) })
    const res = await fetch(`/api/import-projects?${p}`)
    const json = await res.json()
    setProjects(json.data ?? [])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  async function refreshDetail(id: string) {
    const res = await fetch(`/api/import-projects/${id}`)
    const json = await res.json()
    setDetail(json)
  }

  async function handleCreate() {
    setSaving(true)
    await fetch('/api/import-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newProject, exchangeRate: newProject.exchangeRate ? Number(newProject.exchangeRate) : null }),
    })
    setSaving(false)
    setCreateOpen(false)
    setNewProject({ name: '', description: '', currency: 'USD', exchangeRate: '', etd: '', eta: '', notes: '' })
    fetchProjects()
  }

  async function handleAddCost() {
    if (!detail) return
    setSaving(true)
    await fetch(`/api/import-projects/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ADD_COST', ...newCost, amount: Number(newCost.amount), amountTWD: newCost.amountTWD ? Number(newCost.amountTWD) : null }),
    })
    setSaving(false)
    setCostDialog(false)
    setNewCost({ category: 'GOODS', description: '', currency: 'USD', amount: '', amountTWD: '', invoiceNo: '', invoiceDate: '' })
    refreshDetail(detail.id)
  }

  async function handleAddPayment() {
    if (!detail) return
    setSaving(true)
    await fetch(`/api/import-projects/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ADD_PAYMENT', ...newPayment, amount: Number(newPayment.amount), amountTWD: newPayment.amountTWD ? Number(newPayment.amountTWD) : null, exchangeRate: newPayment.exchangeRate ? Number(newPayment.exchangeRate) : null }),
    })
    setSaving(false)
    setPaymentDialog(false)
    setNewPayment({ paymentType: 'FULL', currency: 'USD', amount: '', amountTWD: '', exchangeRate: '', paymentDate: '', remittanceRef: '' })
    refreshDetail(detail.id)
  }

  async function handleSetCustoms() {
    if (!detail) return
    setSaving(true)
    await fetch(`/api/import-projects/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SET_CUSTOMS', ...newCustoms,
        customsValue: newCustoms.customsValue ? Number(newCustoms.customsValue) : null,
        dutyRate: newCustoms.dutyRate ? Number(newCustoms.dutyRate) : null,
        dutyAmount: newCustoms.dutyAmount ? Number(newCustoms.dutyAmount) : null,
        vatAmount: newCustoms.vatAmount ? Number(newCustoms.vatAmount) : null,
      }),
    })
    setSaving(false)
    setCustomsDialog(false)
    refreshDetail(detail.id)
  }

  async function handleStatusChange(projectId: string, status: string) {
    await fetch(`/api/import-projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchProjects()
    if (detail?.id === projectId) refreshDetail(projectId)
  }

  const fmt = (n: number | null | undefined, currency = 'TWD') =>
    n != null ? new Intl.NumberFormat('zh-TW', { style: 'currency', currency, minimumFractionDigits: 0 }).format(n) : '—'

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">進口費用管理</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />新增專案
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input placeholder="搜尋專案號/名稱…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-52" />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? '')}>
          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="全部狀態" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部狀態</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <p className="col-span-full py-8 text-center text-muted-foreground">載入中…</p>
        ) : projects.length === 0 ? (
          <p className="col-span-full py-8 text-center text-muted-foreground">沒有符合的進口專案</p>
        ) : projects.map(p => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setDetail(p); setDetailTab('costs') }}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">{p.projectNo}</p>
                  <CardTitle className="mt-0.5 text-base">{p.name}</CardTitle>
                </div>
                <Badge variant={(STATUS_COLORS[p.status] ?? 'outline') as 'default' | 'secondary' | 'destructive' | 'outline'}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1 text-sm">
                {p.supplier && <p className="text-muted-foreground truncate">供應商：{p.supplier.name}</p>}
                {p.eta && <p className="text-muted-foreground">預計到港：{new Date(p.eta).toLocaleDateString('zh-TW')}</p>}
                <p className="text-muted-foreground">費用項目：{p.costItems.length} 筆</p>
                <p className="font-medium">{fmt(p.totalCost)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Detail Dialog ── */}
      {detail && (
        <Dialog open onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                {detail.projectNo} — {detail.name}
                <Badge variant={(STATUS_COLORS[detail.status] ?? 'outline') as 'default' | 'secondary' | 'destructive' | 'outline'}>
                  {STATUS_LABELS[detail.status] ?? detail.status}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            {/* Status controls */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).filter(([k]) => k !== detail.status && k !== 'CANCELLED').map(([k, v]) => (
                <Button key={k} variant="outline" size="sm" onClick={() => handleStatusChange(detail.id, k)}>→ {v}</Button>
              ))}
            </div>

            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList>
                <TabsTrigger value="costs"><DollarSign className="mr-1 h-4 w-4" />費用明細</TabsTrigger>
                <TabsTrigger value="payments"><FileText className="mr-1 h-4 w-4" />貨款付款</TabsTrigger>
                <TabsTrigger value="customs"><Landmark className="mr-1 h-4 w-4" />清關資料</TabsTrigger>
              </TabsList>

              {/* Cost Items */}
              <TabsContent value="costs">
                <div className="flex justify-end mb-2">
                  <Button size="sm" onClick={() => setCostDialog(true)}><Plus className="mr-1 h-4 w-4" />新增費用</Button>
                </div>
                {detail.costItems.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">尚無費用明細</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="py-1 text-left">類別</th><th className="py-1 text-left">說明</th>
                        <th className="py-1 text-right">金額</th><th className="py-1 text-right">台幣</th>
                      </tr></thead>
                      <tbody>
                        {detail.costItems.map(item => (
                          <tr key={item.id} className="border-b">
                            <td className="py-1.5"><Badge variant="outline" className="text-xs">{COST_CATEGORIES[item.category] ?? item.category}</Badge></td>
                            <td className="py-1.5">{item.description}</td>
                            <td className="py-1.5 text-right font-mono">{item.amount.toLocaleString()} {item.currency}</td>
                            <td className="py-1.5 text-right font-mono">{item.amountTWD ? fmt(item.amountTWD) : '—'}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td colSpan={3} className="py-1.5 text-right">總計</td>
                          <td className="py-1.5 text-right">{fmt(detail.totalCost)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* Payments */}
              <TabsContent value="payments">
                <div className="flex justify-end mb-2">
                  <Button size="sm" onClick={() => setPaymentDialog(true)}><Plus className="mr-1 h-4 w-4" />新增付款</Button>
                </div>
                {detail.payments.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">尚無付款紀錄</p>
                ) : (
                  <div className="space-y-2">
                    {detail.payments.map(pay => (
                      <div key={pay.id} className="rounded border p-2 text-sm">
                        <div className="flex justify-between">
                          <span><Badge variant="outline" className="mr-2 text-xs">{PAYMENT_TYPES[pay.paymentType] ?? pay.paymentType}</Badge>{new Date(pay.paymentDate).toLocaleDateString('zh-TW')}</span>
                          <span className="font-mono font-semibold">{pay.amount.toLocaleString()} {pay.currency}</span>
                        </div>
                        {pay.amountTWD && <p className="text-muted-foreground">台幣：{fmt(pay.amountTWD)}{pay.exchangeRate ? `（匯率 ${pay.exchangeRate}）` : ''}</p>}
                        {pay.remittanceRef && <p className="text-muted-foreground">匯款單：{pay.remittanceRef}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Customs */}
              <TabsContent value="customs">
                <div className="flex justify-end mb-2">
                  <Button size="sm" onClick={() => {
                    const c = detail.customs[0]
                    if (c) setNewCustoms({ declarationNo: c.declarationNo ?? '', declaredAt: c.declaredAt?.slice(0, 10) ?? '', customsValue: c.customsValue?.toString() ?? '', dutyRate: c.dutyRate?.toString() ?? '', dutyAmount: c.dutyAmount?.toString() ?? '', vatAmount: c.vatAmount?.toString() ?? '', status: c.status, clearedAt: c.clearedAt?.slice(0, 10) ?? '', notes: c.notes ?? '' })
                    setCustomsDialog(true)
                  }}>{detail.customs[0] ? '更新清關' : '新增清關'}</Button>
                </div>
                {detail.customs.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">尚無清關資料</p>
                ) : detail.customs.map(c => (
                  <div key={c.id} className="rounded border p-3 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{CUSTOMS_STATUS_LABELS[c.status] ?? c.status}</Badge>
                      {c.declarationNo && <span className="font-mono text-muted-foreground">{c.declarationNo}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {c.declaredAt && <p>申報日：{new Date(c.declaredAt).toLocaleDateString('zh-TW')}</p>}
                      {c.clearedAt && <p>放行日：{new Date(c.clearedAt).toLocaleDateString('zh-TW')}</p>}
                      {c.customsValue && <p>完稅價格：{fmt(c.customsValue)}</p>}
                      {c.dutyAmount && <p>關稅：{fmt(c.dutyAmount)}</p>}
                      {c.vatAmount && <p>營業稅：{fmt(c.vatAmount)}</p>}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Create Project Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增進口專案</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>專案名稱 *</Label><Input value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} className="mt-1" /></div>
            <div><Label>說明</Label><Textarea value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} className="mt-1" rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>幣別</Label>
                <Select value={newProject.currency} onValueChange={v => setNewProject(p => ({ ...p, currency: v ?? 'USD' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD', 'EUR', 'CNY', 'JPY', 'TWD'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>匯率</Label><Input type="number" value={newProject.exchangeRate} onChange={e => setNewProject(p => ({ ...p, exchangeRate: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>預計出港 (ETD)</Label><Input type="date" value={newProject.etd} onChange={e => setNewProject(p => ({ ...p, etd: e.target.value }))} className="mt-1" /></div>
              <div><Label>預計到港 (ETA)</Label><Input type="date" value={newProject.eta} onChange={e => setNewProject(p => ({ ...p, eta: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>備註</Label><Textarea value={newProject.notes} onChange={e => setNewProject(p => ({ ...p, notes: e.target.value }))} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={saving || !newProject.name}>建立專案</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Cost Dialog ── */}
      <Dialog open={costDialog} onOpenChange={setCostDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增費用明細</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>費用類別 *</Label>
              <Select value={newCost.category} onValueChange={v => setNewCost(c => ({ ...c, category: v ?? 'GOODS' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(COST_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>說明 *</Label><Input value={newCost.description} onChange={e => setNewCost(c => ({ ...c, description: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>幣別</Label>
                <Select value={newCost.currency} onValueChange={v => setNewCost(c => ({ ...c, currency: v ?? 'USD' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{['USD', 'EUR', 'CNY', 'TWD'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>金額 *</Label><Input type="number" value={newCost.amount} onChange={e => setNewCost(c => ({ ...c, amount: e.target.value }))} className="mt-1" /></div>
              <div><Label>台幣金額</Label><Input type="number" value={newCost.amountTWD} onChange={e => setNewCost(c => ({ ...c, amountTWD: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>發票號碼</Label><Input value={newCost.invoiceNo} onChange={e => setNewCost(c => ({ ...c, invoiceNo: e.target.value }))} className="mt-1" /></div>
              <div><Label>發票日期</Label><Input type="date" value={newCost.invoiceDate} onChange={e => setNewCost(c => ({ ...c, invoiceDate: e.target.value }))} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCostDialog(false)}>取消</Button>
            <Button onClick={handleAddCost} disabled={saving || !newCost.description || !newCost.amount}>新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Payment Dialog ── */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增付款紀錄</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>付款類型 *</Label>
              <Select value={newPayment.paymentType} onValueChange={v => setNewPayment(p => ({ ...p, paymentType: v ?? 'FULL' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PAYMENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>幣別</Label>
                <Select value={newPayment.currency} onValueChange={v => setNewPayment(p => ({ ...p, currency: v ?? 'USD' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{['USD', 'EUR', 'CNY', 'TWD'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>金額 *</Label><Input type="number" value={newPayment.amount} onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))} className="mt-1" /></div>
              <div><Label>台幣金額</Label><Input type="number" value={newPayment.amountTWD} onChange={e => setNewPayment(p => ({ ...p, amountTWD: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>付款日期 *</Label><Input type="date" value={newPayment.paymentDate} onChange={e => setNewPayment(p => ({ ...p, paymentDate: e.target.value }))} className="mt-1" /></div>
              <div><Label>匯率</Label><Input type="number" value={newPayment.exchangeRate} onChange={e => setNewPayment(p => ({ ...p, exchangeRate: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>匯款單號</Label><Input value={newPayment.remittanceRef} onChange={e => setNewPayment(p => ({ ...p, remittanceRef: e.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>取消</Button>
            <Button onClick={handleAddPayment} disabled={saving || !newPayment.amount || !newPayment.paymentDate}>新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Customs Dialog ── */}
      <Dialog open={customsDialog} onOpenChange={setCustomsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>清關資料</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>報關單號</Label><Input value={newCustoms.declarationNo} onChange={e => setNewCustoms(c => ({ ...c, declarationNo: e.target.value }))} className="mt-1" /></div>
              <div><Label>狀態</Label>
                <Select value={newCustoms.status} onValueChange={v => setNewCustoms(c => ({ ...c, status: v ?? 'PENDING' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CUSTOMS_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>申報日期</Label><Input type="date" value={newCustoms.declaredAt} onChange={e => setNewCustoms(c => ({ ...c, declaredAt: e.target.value }))} className="mt-1" /></div>
              <div><Label>放行日期</Label><Input type="date" value={newCustoms.clearedAt} onChange={e => setNewCustoms(c => ({ ...c, clearedAt: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>完稅價格 (TWD)</Label><Input type="number" value={newCustoms.customsValue} onChange={e => setNewCustoms(c => ({ ...c, customsValue: e.target.value }))} className="mt-1" /></div>
              <div><Label>稅率 (%)</Label><Input type="number" step="0.01" value={newCustoms.dutyRate} onChange={e => setNewCustoms(c => ({ ...c, dutyRate: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>關稅 (TWD)</Label><Input type="number" value={newCustoms.dutyAmount} onChange={e => setNewCustoms(c => ({ ...c, dutyAmount: e.target.value }))} className="mt-1" /></div>
              <div><Label>營業稅 (TWD)</Label><Input type="number" value={newCustoms.vatAmount} onChange={e => setNewCustoms(c => ({ ...c, vatAmount: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>備註</Label><Textarea value={newCustoms.notes} onChange={e => setNewCustoms(c => ({ ...c, notes: e.target.value }))} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomsDialog(false)}>取消</Button>
            <Button onClick={handleSetCustoms} disabled={saving}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
