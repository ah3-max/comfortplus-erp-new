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
import { Plus, TrendingUp, TrendingDown, Pencil, Trash2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetRow {
  id: string
  budgetYear: number
  budgetMonth: number | null
  department: string | null
  category: string
  description: string
  budgetAmount: number
  actualAmount: number
  notes: string | null
}

interface CashFlowRow {
  id: string
  planYear: number
  planMonth: number
  flowType: string
  category: string
  description: string
  plannedAmount: number
  actualAmount: number
}

interface MonthlySummary {
  month: number
  plannedInflow: number
  plannedOutflow: number
  plannedNet: number
  actualInflow: number
  actualOutflow: number
  actualNet: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUDGET_CATEGORIES: Record<string, string> = {
  REVENUE: '營業收入', COGS: '銷貨成本', OPEX: '營業費用',
  CAPEX: '資本支出', HR: '人員費用', MARKETING: '行銷費用',
  LOGISTICS: '物流費用', OTHER: '其他',
}

const CASHFLOW_INFLOW_CATS: Record<string, string> = {
  SALES_RECEIPT: '銷貨收款', AR_COLLECTION: '應收收回',
  LOAN: '借款', EQUITY: '增資', OTHER: '其他流入',
}
const CASHFLOW_OUTFLOW_CATS: Record<string, string> = {
  PAYMENT: '採購付款', SALARY: '薪資', RENT: '租金',
  TAX: '稅款', INVESTMENT: '投資支出', OTHER: '其他支出',
}

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(n)

function varianceColor(variance: number) {
  if (variance > 0) return 'text-red-600'
  if (variance < 0) return 'text-green-600'
  return ''
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { dict } = useI18n()
  const [tab, setTab] = useState('budget')
  const [year, setYear] = useState(new Date().getFullYear())
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [budgetSummary, setBudgetSummary] = useState({ totalBudget: 0, totalActual: 0, variance: 0 })
  const [cashFlows, setCashFlows] = useState<CashFlowRow[]>([])
  const [monthly, setMonthly] = useState<MonthlySummary[]>([])
  const [loading, setLoading] = useState(false)

  // Dialogs
  const [budgetDialog, setBudgetDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [cfDialog, setCfDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // Selected budget for edit/delete
  const [selectedBudget, setSelectedBudget] = useState<BudgetRow | null>(null)

  // New budget form
  const [newBudget, setNewBudget] = useState({ budgetMonth: '', department: '', category: 'REVENUE', description: '', budgetAmount: '', notes: '' })

  // Edit budget form
  const [editBudget, setEditBudget] = useState({ description: '', budgetAmount: '', actualAmount: '', notes: '' })

  // New cash flow form
  const [newCf, setNewCf] = useState({ planMonth: '1', flowType: 'INFLOW', category: 'SALES_RECEIPT', description: '', plannedAmount: '', actualAmount: '' })

  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/budget?year=${year}`)
    const json = await res.json()
    setBudgets(json.data ?? [])
    setBudgetSummary(json.summary ?? { totalBudget: 0, totalActual: 0, variance: 0 })
    setLoading(false)
  }, [year])

  const fetchCashFlow = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/cash-flow?year=${year}`)
    const json = await res.json()
    setCashFlows(json.data ?? [])
    setMonthly(json.monthly ?? [])
    setLoading(false)
  }, [year])

  useEffect(() => { if (tab === 'budget') fetchBudgets() }, [tab, fetchBudgets])
  useEffect(() => { if (tab === 'cashflow') fetchCashFlow() }, [tab, fetchCashFlow])

  // ── Create Budget ──────────────────────────────────────────────────────────
  async function handleSaveBudget() {
    if (!newBudget.description || !newBudget.budgetAmount) {
      toast.error('請填寫說明及預算金額')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgetYear: year,
          budgetMonth: newBudget.budgetMonth ? Number(newBudget.budgetMonth) : null,
          department: newBudget.department || null,
          category: newBudget.category,
          description: newBudget.description,
          budgetAmount: Number(newBudget.budgetAmount),
          notes: newBudget.notes || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? '建立失敗')
        return
      }
      toast.success('預算項目已建立')
      setBudgetDialog(false)
      setNewBudget({ budgetMonth: '', department: '', category: 'REVENUE', description: '', budgetAmount: '', notes: '' })
      fetchBudgets()
    } finally {
      setSaving(false)
    }
  }

  // ── Open Edit ──────────────────────────────────────────────────────────────
  function openEdit(b: BudgetRow, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedBudget(b)
    setEditBudget({
      description: b.description,
      budgetAmount: String(Number(b.budgetAmount)),
      actualAmount: String(Number(b.actualAmount)),
      notes: b.notes ?? '',
    })
    setEditDialog(true)
  }

  // ── Save Edit ──────────────────────────────────────────────────────────────
  async function handleEdit() {
    if (!selectedBudget) return
    if (!editBudget.description || !editBudget.budgetAmount) {
      toast.error('請填寫說明及預算金額')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/budget/${selectedBudget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editBudget.description,
          budgetAmount: Number(editBudget.budgetAmount),
          actualAmount: editBudget.actualAmount !== '' ? Number(editBudget.actualAmount) : undefined,
          notes: editBudget.notes || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? '更新失敗')
        return
      }
      toast.success('預算已更新')
      setEditDialog(false)
      setSelectedBudget(null)
      fetchBudgets()
    } finally {
      setSaving(false)
    }
  }

  // ── Open Delete ────────────────────────────────────────────────────────────
  function openDelete(b: BudgetRow, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedBudget(b)
    setDeleteDialog(true)
  }

  // ── Confirm Delete ─────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selectedBudget) return
    setSaving(true)
    try {
      const res = await fetch(`/api/budget/${selectedBudget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? '刪除失敗')
        return
      }
      toast.success('預算項目已刪除')
      setDeleteDialog(false)
      setSelectedBudget(null)
      fetchBudgets()
    } finally {
      setSaving(false)
    }
  }

  // ── Create Cash Flow ────────────────────────────────────────────────────────
  async function handleSaveCf() {
    if (!newCf.description || !newCf.plannedAmount) {
      toast.error('請填寫說明及計畫金額')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/cash-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planYear: year,
          planMonth: Number(newCf.planMonth),
          flowType: newCf.flowType,
          category: newCf.category,
          description: newCf.description,
          plannedAmount: Number(newCf.plannedAmount),
          actualAmount: newCf.actualAmount ? Number(newCf.actualAmount) : 0,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? '建立失敗')
        return
      }
      toast.success('資金計畫已建立')
      setCfDialog(false)
      setNewCf({ planMonth: '1', flowType: 'INFLOW', category: 'SALES_RECEIPT', description: '', plannedAmount: '', actualAmount: '' })
      fetchCashFlow()
    } finally {
      setSaving(false)
    }
  }

  // Chart data
  const chartData = monthly.map(m => ({
    name: MONTHS[m.month - 1],
    計畫流入: Math.round(m.plannedInflow / 1000),
    計畫流出: Math.round(m.plannedOutflow / 1000),
    實際流入: Math.round(m.actualInflow / 1000),
    實際流出: Math.round(m.actualOutflow / 1000),
  }))

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{dict.budget.title}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear(y => y - 1)}>{'<'}</Button>
          <span className="font-semibold">{year} 年</span>
          <Button variant="outline" size="sm" onClick={() => setYear(y => y + 1)}>{'>'}</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="budget">預算管理</TabsTrigger>
          <TabsTrigger value="cashflow">資金計畫</TabsTrigger>
        </TabsList>

        {/* ── Budget Tab ── */}
        <TabsContent value="budget">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{dict.budget.period}</p>
              <p className="text-lg font-bold">{fmt(budgetSummary.totalBudget)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{dict.budget.actualAmount}</p>
              <p className="text-lg font-bold">{fmt(budgetSummary.totalActual)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{dict.budget.variance}</p>
              <p className={`text-lg font-bold ${varianceColor(budgetSummary.variance)}`}>
                {budgetSummary.variance >= 0 ? '+' : ''}{fmt(budgetSummary.variance)}
              </p>
            </CardContent></Card>
          </div>

          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => setBudgetDialog(true)}><Plus className="mr-1 h-4 w-4" />{dict.budget.newBudget}</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left">月份</th>
                    <th className="px-4 py-2 text-left">{dict.budget.category}</th>
                    <th className="px-4 py-2 text-left">{dict.common.description}</th>
                    <th className="px-4 py-2 text-right">{dict.budget.budgetAmount}</th>
                    <th className="px-4 py-2 text-right">{dict.budget.actualAmount}</th>
                    <th className="px-4 py-2 text-right">{dict.budget.variance}</th>
                    <th className="px-4 py-2 text-right">達成率</th>
                    <th className="px-4 py-2 text-center">{dict.common.actions}</th>
                  </tr></thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">{dict.common.loading}</td></tr>
                    ) : budgets.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">{dict.budget.noBudgets}</td></tr>
                    ) : budgets.map(b => {
                      const variance = Number(b.actualAmount) - Number(b.budgetAmount)
                      const pct = Number(b.budgetAmount) > 0 ? (Number(b.actualAmount) / Number(b.budgetAmount) * 100) : 0
                      return (
                        <tr key={b.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-2">{b.budgetMonth ? MONTHS[b.budgetMonth - 1] : '年度'}</td>
                          <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{BUDGET_CATEGORIES[b.category] ?? b.category}</Badge></td>
                          <td className="px-4 py-2 max-w-[180px] truncate" title={b.description}>{b.description}</td>
                          <td className="px-4 py-2 text-right">{fmt(Number(b.budgetAmount))}</td>
                          <td className="px-4 py-2 text-right">{fmt(Number(b.actualAmount))}</td>
                          <td className={`px-4 py-2 text-right ${varianceColor(variance)}`}>{variance >= 0 ? '+' : ''}{fmt(variance)}</td>
                          <td className="px-4 py-2 text-right">
                            <span className={pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-orange-600' : 'text-green-600'}>
                              {pct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={e => openEdit(b, e)}
                                title="編輯"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={e => openDelete(b, e)}
                                title="刪除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Cash Flow Tab ── */}
        <TabsContent value="cashflow">
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => setCfDialog(true)}><Plus className="mr-1 h-4 w-4" />新增資金計畫</Button>
          </div>

          {/* Chart */}
          <Card className="mb-4">
            <CardHeader className="pb-2"><CardTitle className="text-sm">月度現金流（千元）</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v ?? 0}K`, '']} />
                  <Legend />
                  <Bar dataKey="計畫流入" fill="#22c55e" />
                  <Bar dataKey="計畫流出" fill="#f97316" />
                  <Bar dataKey="實際流入" fill="#16a34a" opacity={0.6} />
                  <Bar dataKey="實際流出" fill="#ea580c" opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly summary table */}
          <Card className="mb-4">
            <CardHeader className="pb-2"><CardTitle className="text-sm">月度摘要</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">月份</th>
                    <th className="px-3 py-2 text-right">計畫流入</th>
                    <th className="px-3 py-2 text-right">計畫流出</th>
                    <th className="px-3 py-2 text-right">計畫淨額</th>
                    <th className="px-3 py-2 text-right">實際流入</th>
                    <th className="px-3 py-2 text-right">實際流出</th>
                    <th className="px-3 py-2 text-right">實際淨額</th>
                  </tr></thead>
                  <tbody>
                    {monthly.map(m => (
                      <tr key={m.month} className="border-b">
                        <td className="px-3 py-1.5">{MONTHS[m.month - 1]}</td>
                        <td className="px-3 py-1.5 text-right text-green-600">{fmt(m.plannedInflow)}</td>
                        <td className="px-3 py-1.5 text-right text-orange-600">{fmt(m.plannedOutflow)}</td>
                        <td className={`px-3 py-1.5 text-right font-semibold ${m.plannedNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {m.plannedNet >= 0 ? <TrendingUp className="inline mr-1 h-3.5 w-3.5" /> : <TrendingDown className="inline mr-1 h-3.5 w-3.5" />}
                          {fmt(m.plannedNet)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-green-600">{fmt(m.actualInflow)}</td>
                        <td className="px-3 py-1.5 text-right text-orange-600">{fmt(m.actualOutflow)}</td>
                        <td className={`px-3 py-1.5 text-right font-semibold ${m.actualNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(m.actualNet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Cash flow detail table */}
          {cashFlows.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">明細</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left">月份</th>
                      <th className="px-3 py-2 text-left">流向</th>
                      <th className="px-3 py-2 text-left">類別</th>
                      <th className="px-3 py-2 text-left">說明</th>
                      <th className="px-3 py-2 text-right">計畫金額</th>
                      <th className="px-3 py-2 text-right">實際金額</th>
                    </tr></thead>
                    <tbody>
                      {cashFlows.map(cf => (
                        <tr key={cf.id} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-1.5">{MONTHS[cf.planMonth - 1]}</td>
                          <td className="px-3 py-1.5">
                            <Badge variant={cf.flowType === 'INFLOW' ? 'default' : 'secondary'} className="text-xs">
                              {cf.flowType === 'INFLOW' ? '流入' : '流出'}
                            </Badge>
                          </td>
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">
                            {(cf.flowType === 'INFLOW' ? CASHFLOW_INFLOW_CATS : CASHFLOW_OUTFLOW_CATS)[cf.category] ?? cf.category}
                          </td>
                          <td className="px-3 py-1.5 max-w-[160px] truncate" title={cf.description}>{cf.description}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(Number(cf.plannedAmount))}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(Number(cf.actualAmount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create Budget Dialog ── */}
      <Dialog open={budgetDialog} onOpenChange={setBudgetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dict.budget.newBudget}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>月份（留空=年度）</Label>
                <Select value={newBudget.budgetMonth || 'annual'} onValueChange={v => setNewBudget(b => ({ ...b, budgetMonth: v === 'annual' ? '' : (v ?? '') }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="年度預算" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">年度預算</SelectItem>
                    {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>類別 *</Label>
                <Select value={newBudget.category} onValueChange={v => setNewBudget(b => ({ ...b, category: v ?? 'REVENUE' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(BUDGET_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>說明 *</Label><Input value={newBudget.description} onChange={e => setNewBudget(b => ({ ...b, description: e.target.value }))} className="mt-1" /></div>
            <div><Label>預算金額 *</Label><Input type="number" value={newBudget.budgetAmount} onChange={e => setNewBudget(b => ({ ...b, budgetAmount: e.target.value }))} className="mt-1" /></div>
            <div><Label>備註</Label><Textarea value={newBudget.notes} onChange={e => setNewBudget(b => ({ ...b, notes: e.target.value }))} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleSaveBudget} disabled={saving || !newBudget.description || !newBudget.budgetAmount}>{dict.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Budget Dialog ── */}
      <Dialog open={editDialog} onOpenChange={open => { setEditDialog(open); if (!open) setSelectedBudget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              編輯預算 — {selectedBudget ? (selectedBudget.budgetMonth ? MONTHS[selectedBudget.budgetMonth - 1] : '年度') : ''} {selectedBudget ? (BUDGET_CATEGORIES[selectedBudget.category] ?? selectedBudget.category) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>說明 *</Label>
              <Input value={editBudget.description} onChange={e => setEditBudget(b => ({ ...b, description: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>預算金額 *</Label>
                <Input type="number" value={editBudget.budgetAmount} onChange={e => setEditBudget(b => ({ ...b, budgetAmount: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>實際金額</Label>
                <Input type="number" value={editBudget.actualAmount} onChange={e => setEditBudget(b => ({ ...b, actualAmount: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>備註</Label>
              <Textarea value={editBudget.notes} onChange={e => setEditBudget(b => ({ ...b, notes: e.target.value }))} className="mt-1" rows={2} />
            </div>
            {/* Preview variance */}
            {editBudget.budgetAmount && editBudget.actualAmount !== '' && (
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">差異：</span>
                <span className={`font-semibold ml-1 ${varianceColor(Number(editBudget.actualAmount) - Number(editBudget.budgetAmount))}`}>
                  {(Number(editBudget.actualAmount) - Number(editBudget.budgetAmount)) >= 0 ? '+' : ''}
                  {fmt(Number(editBudget.actualAmount) - Number(editBudget.budgetAmount))}
                </span>
                <span className="text-muted-foreground ml-3">達成率：</span>
                <span className="font-semibold ml-1">
                  {Number(editBudget.budgetAmount) > 0
                    ? `${(Number(editBudget.actualAmount) / Number(editBudget.budgetAmount) * 100).toFixed(1)}%`
                    : '—'}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialog(false); setSelectedBudget(null) }}>{dict.common.cancel}</Button>
            <Button onClick={handleEdit} disabled={saving || !editBudget.description || !editBudget.budgetAmount}>
              {saving ? dict.common.saving : dict.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={deleteDialog} onOpenChange={open => { setDeleteDialog(open); if (!open) setSelectedBudget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{dict.common.confirm}{dict.common.delete}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            確定要刪除預算項目「{selectedBudget?.description}」嗎？此操作無法復原。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialog(false); setSelectedBudget(null) }}>{dict.common.cancel}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? dict.common.loading : dict.common.confirm + dict.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cash Flow Dialog ── */}
      <Dialog open={cfDialog} onOpenChange={setCfDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增資金計畫</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div><Label>月份 *</Label>
                <Select value={newCf.planMonth} onValueChange={v => setNewCf(c => ({ ...c, planMonth: v ?? '1' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>流向 *</Label>
                <Select value={newCf.flowType} onValueChange={v => {
                  const cat = v === 'INFLOW' ? 'SALES_RECEIPT' : 'PAYMENT'
                  setNewCf(c => ({ ...c, flowType: v ?? 'INFLOW', category: cat }))
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFLOW">流入</SelectItem>
                    <SelectItem value="OUTFLOW">流出</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>類別 *</Label>
                <Select value={newCf.category} onValueChange={v => setNewCf(c => ({ ...c, category: v ?? 'SALES_RECEIPT' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(newCf.flowType === 'INFLOW' ? CASHFLOW_INFLOW_CATS : CASHFLOW_OUTFLOW_CATS).map(([k, v]) =>
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>說明 *</Label><Input value={newCf.description} onChange={e => setNewCf(c => ({ ...c, description: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>計畫金額 *</Label><Input type="number" value={newCf.plannedAmount} onChange={e => setNewCf(c => ({ ...c, plannedAmount: e.target.value }))} className="mt-1" /></div>
              <div><Label>實際金額</Label><Input type="number" value={newCf.actualAmount} onChange={e => setNewCf(c => ({ ...c, actualAmount: e.target.value }))} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCfDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleSaveCf} disabled={saving || !newCf.description || !newCf.plannedAmount}>{dict.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
