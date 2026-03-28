'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Search, Loader2, TrendingUp, DollarSign, Target, Users, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

/* ── Types ── */
interface Opportunity {
  id: string
  title: string
  stage: string
  probability: number
  expectedAmount: string | null
  expectedCloseDate: string | null
  productInterest: string | null
  competitorInfo: string | null
  lostReason: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string; code: string }
  owner: { id: string; name: string } | null
  _count: { followUpLogs: number }
}

interface Customer { id: string; name: string; code: string }
interface User { id: string; name: string }

/* ── Stage config (colors only, labels come from i18n) ── */
const STAGE_CONFIG: Record<string, { color: string; prob: number }> = {
  PROSPECTING:    { color: 'bg-slate-100 text-slate-600',    prob: 10 },
  CONTACTED:      { color: 'bg-blue-100 text-blue-700',      prob: 20 },
  VISITED:        { color: 'bg-indigo-100 text-indigo-700',  prob: 35 },
  NEEDS_ANALYSIS: { color: 'bg-purple-100 text-purple-700',  prob: 50 },
  SAMPLING:       { color: 'bg-teal-100 text-teal-700',      prob: 60 },
  QUOTED:         { color: 'bg-amber-100 text-amber-700',    prob: 70 },
  NEGOTIATING:    { color: 'bg-orange-100 text-orange-700',  prob: 80 },
  REGULAR_ORDER:  { color: 'bg-green-100 text-green-700',    prob: 95 },
  LOST:           { color: 'bg-red-100 text-red-600',        prob: 0  },
  INACTIVE:       { color: 'bg-slate-100 text-slate-400',    prob: 0  },
}

const STAGES_ACTIVE = ['PROSPECTING','CONTACTED','VISITED','NEEDS_ANALYSIS','SAMPLING','QUOTED','NEGOTIATING','REGULAR_ORDER']
const STAGES_ALL = [...STAGES_ACTIVE, 'LOST', 'INACTIVE']

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

/* ── Form Dialog ── */
function OpportunityFormDialog({
  open, onClose, onSuccess,
  editOpp, customers, users,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editOpp: Opportunity | null
  customers: Customer[]
  users: User[]
}) {
  const { dict } = useI18n()
  const d = dict.pipelineExt
  const c = dict.common
  const isEdit = !!editOpp
  const [loading, setLoading] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [form, setForm] = useState({
    customerId: '',
    customerName: '',
    title: '',
    stage: 'PROSPECTING',
    probability: 10,
    expectedAmount: '',
    expectedCloseDate: '',
    ownerId: '',
    productInterest: '',
    competitorInfo: '',
    notes: '',
  })

  useEffect(() => {
    if (open && editOpp) {
      setForm({
        customerId: editOpp.customer.id,
        customerName: editOpp.customer.name,
        title: editOpp.title,
        stage: editOpp.stage,
        probability: editOpp.probability,
        expectedAmount: editOpp.expectedAmount ?? '',
        expectedCloseDate: editOpp.expectedCloseDate ? editOpp.expectedCloseDate.slice(0, 10) : '',
        ownerId: editOpp.owner?.id ?? '',
        productInterest: editOpp.productInterest ?? '',
        competitorInfo: editOpp.competitorInfo ?? '',
        notes: editOpp.notes ?? '',
      })
      setCustomerSearch(editOpp.customer.name)
    } else if (open && !editOpp) {
      setForm({
        customerId: '', customerName: '', title: '', stage: 'PROSPECTING', probability: 10,
        expectedAmount: '', expectedCloseDate: '', ownerId: '',
        productInterest: '', competitorInfo: '', notes: '',
      })
      setCustomerSearch('')
    }
  }, [open, editOpp])

  function set(field: string, value: string | number) {
    setForm(p => ({ ...p, [field]: value }))
  }

  const filteredCustomers = customers.filter(cu =>
    cu.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    cu.code.toLowerCase().includes(customerSearch.toLowerCase())
  ).slice(0, 10)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customerId || !form.title) {
      toast.error(`${c.select} ${d.customer} ${c.required}`)
      return
    }
    setLoading(true)
    const payload = {
      customerId: form.customerId,
      title: form.title,
      stage: form.stage,
      probability: Number(form.probability),
      expectedAmount: form.expectedAmount || null,
      expectedCloseDate: form.expectedCloseDate || null,
      ownerId: form.ownerId || null,
      productInterest: form.productInterest || null,
      competitorInfo: form.competitorInfo || null,
      notes: form.notes || null,
    }
    const url = isEdit ? `/api/sales-opportunities/${editOpp!.id}` : '/api/sales-opportunities'
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setLoading(false)
    if (res.ok) {
      toast.success(isEdit ? d.updated : d.added)
      onSuccess()
      onClose()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? c.saveFailed)
    }
  }

  const stageLabel = (s: string) => (d.stages as Record<string, string>)[s] ?? s

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? d.editOpportunity : d.newOpportunity}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer selector */}
          <div className="space-y-1.5">
            <Label>{d.customer} <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                value={customerSearch}
                onChange={e => {
                  setCustomerSearch(e.target.value)
                  setShowCustomerDropdown(true)
                  if (!e.target.value) set('customerId', '')
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                placeholder={d.customerPlaceholder}
              />
              {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.map(cu => (
                    <button
                      key={cu.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      onClick={() => {
                        setForm(p => ({ ...p, customerId: cu.id, customerName: cu.name }))
                        setCustomerSearch(cu.name)
                        setShowCustomerDropdown(false)
                      }}
                    >
                      <span className="font-mono text-xs text-muted-foreground">{cu.code}</span>
                      <span>{cu.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>{d.opportunityTitle} <span className="text-red-500">*</span></Label>
            <Input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder={d.titlePlaceholder}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Stage */}
            <div className="space-y-1.5">
              <Label>{d.stage}</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.stage}
                onChange={e => {
                  const stage = e.target.value
                  set('stage', stage)
                  set('probability', STAGE_CONFIG[stage]?.prob ?? 10)
                }}
              >
                {STAGES_ALL.map(s => (
                  <option key={s} value={s}>{stageLabel(s)}</option>
                ))}
              </select>
            </div>
            {/* Probability */}
            <div className="space-y-1.5">
              <Label>{d.probabilityLabel}</Label>
              <Input
                type="number" min={0} max={100}
                value={form.probability}
                onChange={e => set('probability', Number(e.target.value))}
              />
            </div>
            {/* Expected amount */}
            <div className="space-y-1.5">
              <Label>{d.expectedAmountLabel}</Label>
              <Input
                type="number" min={0}
                value={form.expectedAmount}
                onChange={e => set('expectedAmount', e.target.value)}
                placeholder="0"
              />
            </div>
            {/* Expected close date */}
            <div className="space-y-1.5">
              <Label>{d.expectedCloseDate}</Label>
              <Input
                type="date"
                value={form.expectedCloseDate}
                onChange={e => set('expectedCloseDate', e.target.value)}
              />
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label>{d.owner}</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={form.ownerId}
              onChange={e => set('ownerId', e.target.value)}
            >
              <option value="">-- {c.unassigned} --</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Product interest */}
          <div className="space-y-1.5">
            <Label>{d.productInterestLabel}</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              rows={2}
              value={form.productInterest}
              onChange={e => set('productInterest', e.target.value)}
              placeholder={d.productInterestPlaceholder}
            />
          </div>

          {/* Competitor info */}
          <div className="space-y-1.5">
            <Label>{d.competitorInfoLabel}</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              rows={2}
              value={form.competitorInfo}
              onChange={e => set('competitorInfo', e.target.value)}
              placeholder={d.competitorInfoPlaceholder}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>{c.remark}</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              rows={2}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder={d.notesPlaceholder}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{c.cancel}</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? c.save : d.newOpportunity}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ── Main Page ── */
export default function SalesOpportunitiesPage() {
  const router = useRouter()
  const { dict } = useI18n()
  const d = dict.pipelineExt
  const c = dict.common

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [formOpen, setFormOpen] = useState(false)
  const [editOpp, setEditOpp] = useState<Opportunity | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const stageLabel = (s: string) => (d.stages as Record<string, string>)[s] ?? s

  const fetchOpportunities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (showActiveOnly) params.set('isActive', 'true')
      const res = await fetch(`/api/sales-opportunities?${params}`)
      const data = await res.json()
      setOpportunities(Array.isArray(data) ? data : [])
    } catch {
      toast.error(d.loadFailed)
    }
    setLoading(false)
  }, [showActiveOnly, d.loadFailed])

  useEffect(() => { fetchOpportunities() }, [fetchOpportunities])

  useEffect(() => {
    fetch('/api/customers?limit=500')
      .then(r => r.json())
      .then(data => setCustomers(Array.isArray(data) ? data : (data.customers ?? [])))
      .catch(() => {})
    fetch('/api/users?limit=100')
      .then(r => r.json())
      .then(data => setUsers(Array.isArray(data) ? data : (data.users ?? [])))
      .catch(() => {})
  }, [])

  // Filter
  const filtered = opportunities.filter(o => {
    if (search) {
      const s = search.toLowerCase()
      if (!o.title.toLowerCase().includes(s) &&
          !o.customer.name.toLowerCase().includes(s) &&
          !o.customer.code.toLowerCase().includes(s)) return false
    }
    if (filterStage && o.stage !== filterStage) return false
    return true
  })

  // Stats
  const activeOpps = filtered.filter(o => o.isActive && !['LOST', 'INACTIVE'].includes(o.stage))
  const weightedValue = activeOpps.reduce((sum, o) => {
    return sum + (o.expectedAmount ? Number(o.expectedAmount) * o.probability / 100 : 0)
  }, 0)
  const avgProb = activeOpps.length > 0
    ? Math.round(activeOpps.reduce((s, o) => s + o.probability, 0) / activeOpps.length)
    : 0
  const closingThisMonth = activeOpps.filter(o =>
    o.expectedCloseDate && isThisMonth(o.expectedCloseDate)
  ).length

  function openCreate() { setEditOpp(null); setFormOpen(true) }
  function openEdit(o: Opportunity) { setEditOpp(o); setFormOpen(true) }

  async function handleDelete(o: Opportunity) {
    const allowed = ['PROSPECTING', 'LOST']
    if (!allowed.includes(o.stage)) {
      toast.error(d.deleteRestriction)
      return
    }
    if (!confirm(`${c.deleteConfirm}\n"${o.title}"`)) return
    setDeletingId(o.id)
    try {
      const res = await fetch(`/api/sales-opportunities/${o.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(d.deleted)
        fetchOpportunities()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? c.deleteFailed)
      }
    } catch {
      toast.error(c.deleteFailed)
    } finally {
      setDeletingId(null)
    }
  }

  function renderDaysLabel(days: number) {
    if (days < 0) return d.daysOverdue.replace('{n}', String(Math.abs(days)))
    if (days === 0) return d.today
    return d.daysUntilClose.replace('{n}', String(days))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{d.title}</h1>
          <p className="text-sm text-muted-foreground">
            {activeOpps.length} {d.noOpportunities !== '暫無商機資料' ? 'active' : '個進行中商機'} · {d.weightedValue} ${formatCurrency(weightedValue)}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />{d.newOpportunity}
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Target className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{d.totalOpps}</p>
              <p className="text-lg font-bold">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{d.weightedValue}</p>
              <p className="text-lg font-bold">${formatCurrency(weightedValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{d.avgProbability}</p>
              <p className="text-lg font-bold">{avgProb}%</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{d.closingThisMonth}</p>
              <p className="text-lg font-bold">{closingThisMonth}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={d.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilterStage('')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterStage === '' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {d.allStages}
          </button>
          {STAGES_ALL.map(s => (
            <button
              key={s}
              onClick={() => setFilterStage(filterStage === s ? '' : s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterStage === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {stageLabel(s)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={e => setShowActiveOnly(e.target.checked)}
            className="rounded"
          />
          {d.activeOnly}
        </label>
        <div className="ml-auto flex gap-1">
          <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>{d.listView}</Button>
          <Button variant={view === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setView('kanban')}>{d.kanbanView}</Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : view === 'list' ? (
        /* ── List View ── */
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{d.customer}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{d.opportunityTitle}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{d.stage}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{d.probability}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{d.dealValue}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{d.expectedCloseDate}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{d.owner}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{d.interactions}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{c.actions ?? d.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">{d.noOpportunities}</td></tr>
              ) : filtered.map(o => {
                const stageCfg = STAGE_CONFIG[o.stage]
                const closeDate = o.expectedCloseDate
                const days = closeDate ? daysUntil(closeDate) : null
                return (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        className="text-blue-600 hover:underline font-medium"
                        onClick={() => router.push(`/customers/${o.customer.id}`)}
                      >
                        {o.customer.name}
                      </button>
                      <p className="text-xs text-muted-foreground font-mono">{o.customer.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{o.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stageCfg?.color ?? 'bg-slate-100 text-slate-600'}`}>
                        {stageLabel(o.stage)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${o.probability}%`,
                              backgroundColor: o.probability >= 70 ? '#22c55e' : o.probability >= 40 ? '#f59e0b' : '#94a3b8',
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium">{o.probability}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {o.expectedAmount ? `$${formatCurrency(Number(o.expectedAmount))}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {closeDate ? (
                        <div>
                          <p>{new Date(closeDate).toLocaleDateString()}</p>
                          {days != null && (
                            <p className={days < 0 ? 'text-red-500 font-medium' : days <= 7 ? 'text-amber-500' : 'text-muted-foreground'}>
                              {renderDaysLabel(days)}
                            </p>
                          )}
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{o.owner?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{o._count.followUpLogs}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(o)}
                          className="rounded p-1 hover:bg-slate-100 text-muted-foreground hover:text-slate-700 transition-colors"
                          title={c.edit}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {['PROSPECTING', 'LOST'].includes(o.stage) && (
                          <button
                            onClick={() => handleDelete(o)}
                            disabled={deletingId === o.id}
                            className="rounded p-1 hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
                            title={c.delete}
                          >
                            {deletingId === o.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Kanban View ── */
        <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${STAGES_ACTIVE.length}, minmax(200px, 1fr))` }}>
          {STAGES_ACTIVE.map(stage => {
            const stageCfg = STAGE_CONFIG[stage]
            const stageOpps = filtered.filter(o => o.stage === stage)
            return (
              <div key={stage} className="flex flex-col rounded-lg border bg-slate-50 min-h-[300px]">
                <div className="p-3 border-b bg-white rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stageCfg?.color ?? ''}`}>
                      {stageLabel(stage)}
                    </span>
                    <Badge variant="outline" className="text-xs font-bold">{stageOpps.length}</Badge>
                  </div>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {stageOpps.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">{d.noOpportunitiesInStage}</p>
                  ) : stageOpps.map(o => {
                    const closeDate = o.expectedCloseDate
                    const days = closeDate ? daysUntil(closeDate) : null
                    return (
                      <div
                        key={o.id}
                        className="rounded-lg border bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => openEdit(o)}
                      >
                        <div className="flex items-start justify-between gap-1 mb-0.5">
                          <p className="text-xs text-muted-foreground font-mono">{o.customer.code}</p>
                          {['PROSPECTING', 'LOST'].includes(o.stage) && (
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(o) }}
                              disabled={deletingId === o.id}
                              className="shrink-0 rounded p-0.5 hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
                              title={c.delete}
                            >
                              {deletingId === o.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Trash2 className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                        <p
                          className="text-xs font-semibold text-blue-600 hover:underline mb-1"
                          onClick={e => { e.stopPropagation(); router.push(`/customers/${o.customer.id}`) }}
                        >
                          {o.customer.name}
                        </p>
                        <p className="text-sm font-medium text-slate-800 line-clamp-2 mb-2">{o.title}</p>
                        <div className="flex items-center justify-between">
                          {o.expectedAmount ? (
                            <span className="text-xs text-green-600 font-medium">${formatCurrency(Number(o.expectedAmount))}</span>
                          ) : <span />}
                          <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${o.probability >= 70 ? 'bg-green-100 text-green-700' : o.probability >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            {o.probability}%
                          </span>
                        </div>
                        {days != null && (
                          <p className={`text-xs mt-1 ${days < 0 ? 'text-red-500 font-medium' : days <= 7 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {days === 0 ? d.closingToday : renderDaysLabel(days)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form dialog */}
      <OpportunityFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={fetchOpportunities}
        editOpp={editOpp}
        customers={customers}
        users={users}
      />
    </div>
  )
}
