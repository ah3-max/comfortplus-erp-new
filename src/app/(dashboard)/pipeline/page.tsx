'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, Loader2, User, TrendingUp, DollarSign,
  ArrowRight, ChevronRight, Calendar, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { customerTypes, devStatusOptions, regionOptions, sourceOptions } from '@/components/customers/customer-form'

/* ── types ── */
interface Customer {
  id: string; code: string; name: string; type: string
  contactPerson: string | null; phone: string | null; lineId: string | null
  email: string | null; address: string | null; region: string | null
  taxId: string | null; paymentTerms: string | null; creditLimit: string | null
  grade: string | null; devStatus: string; source: string | null
  salesRepId: string | null; salesRep: { id: string; name: string } | null
  winRate: number | null; estimatedMonthlyVolume: string | null
  notes: string | null; isActive: boolean; createdAt: string
  _count: { visitRecords: number; callRecords: number; salesOrders: number }
  visitRecords?: { visitDate: string }[]
  callRecords?: { callDate: string }[]
}

interface SalesRep { id: string; name: string }

/* ── constants ── */
const PIPELINE_STAGE_META = [
  { key: 'POTENTIAL',   color: 'bg-slate-500',  lightBg: 'bg-slate-50',  border: 'border-slate-200', icon: '🎯' },
  { key: 'NEGOTIATING', color: 'bg-amber-500',  lightBg: 'bg-amber-50',  border: 'border-amber-200', icon: '🤝' },
  { key: 'CLOSED',      color: 'bg-green-500',  lightBg: 'bg-green-50',  border: 'border-green-200', icon: '✅' },
  { key: 'DORMANT',     color: 'bg-slate-400',  lightBg: 'bg-slate-50',  border: 'border-slate-200', icon: '💤' },
  { key: 'REJECTED',    color: 'bg-red-500',    lightBg: 'bg-red-50',    border: 'border-red-200',   icon: '❌' },
] as const

const typeColors: Record<string, string> = {
  NURSING_HOME: 'bg-blue-100 text-blue-700',
  ELDERLY_HOME: 'bg-purple-100 text-purple-700',
  HOSPITAL:     'bg-red-100 text-red-700',
  DISTRIBUTOR:  'bg-green-100 text-green-700',
  OTHER:        'bg-slate-100 text-slate-600',
}

const gradeColors: Record<string, string> = {
  A: 'bg-amber-400 text-white',
  B: 'bg-blue-400 text-white',
  C: 'bg-green-500 text-white',
  D: 'bg-slate-400 text-white',
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/* ── Create Lead Dialog ── */
function CreateLeadDialog({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const { dict } = useI18n()
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', type: '', region: '', contactPerson: '', phone: '',
    devStatus: 'POTENTIAL', grade: '', source: '', salesRepId: '',
    winRate: '', estimatedMonthlyVolume: '', notes: '',
  })

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then((d: { id: string; name: string; role: string }[]) =>
        setSalesReps(Array.isArray(d)
          ? d.filter(u => ['SALES', 'SALES_MANAGER', 'GM', 'SUPER_ADMIN'].includes(u.role))
               .map(u => ({ id: u.id, name: u.name }))
          : [])
      ).catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) {
      setForm({
        name: '', type: '', region: '', contactPerson: '', phone: '',
        devStatus: 'POTENTIAL', grade: '', source: '', salesRepId: '',
        winRate: '', estimatedMonthlyVolume: '', notes: '',
      })
    }
  }, [open])

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.type) { toast.error(dict.pipelinePage.nameTypeRequired); return }
    setLoading(true)
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) { toast.success(dict.pipelineExt.added); onSuccess(); onClose() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.error) }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{dict.pipelineExt.newOpportunity}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>{dict.customers.name} <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder={dict.pipelinePage.customerNamePlaceholder} required />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.customers.type} <span className="text-red-500">*</span></Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.type} onChange={e => set('type', e.target.value)} required>
                <option value="">{dict.common.select}{dict.common.type}</option>
                {customerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.customers.region}</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.region} onChange={e => set('region', e.target.value)}>
                <option value="">{dict.common.select}{dict.common.region}</option>
                {regionOptions.map(r => <option key={r.value} value={r.value}>{r.value}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.customers.contact}</Label>
              <Input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder={dict.pipelinePage.contactPlaceholder} />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.customers.phone}</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="02-XXXX-XXXX" />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{dict.customers.devStatus}</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.devStatus} onChange={e => set('devStatus', e.target.value)}>
                {devStatusOptions.filter(s => s.value !== 'OTHER').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.customers.grade}</Label>
              <div className="flex gap-1">
                {['A', 'B', 'C', 'D'].map(g => (
                  <button key={g} type="button"
                    onClick={() => set('grade', form.grade === g ? '' : g)}
                    className={`flex-1 rounded-md border py-1.5 text-sm font-bold transition-colors ${
                      form.grade === g
                        ? (gradeColors[g] ?? '') + ' border-transparent'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>{g}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.pipelinePage.sourceLabel}</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="">{dict.common.select}</option>
                {sourceOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.customers.salesRep}</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.salesRepId} onChange={e => set('salesRepId', e.target.value)}>
                <option value="">{dict.common.unassigned}</option>
                {salesReps.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.pipelineExt.probabilityLabel}</Label>
              <Input type="number" value={form.winRate} onChange={e => set('winRate', e.target.value)}
                placeholder="0" min={0} max={100} />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.pipeline.monthlyVolume}（{dict.pipelinePage.monthlyVolumeUnit}）</Label>
              <Input type="number" value={form.estimatedMonthlyVolume}
                onChange={e => set('estimatedMonthlyVolume', e.target.value)} placeholder="0" min={0} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{dict.common.notes}</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={dict.pipelinePage.notesPlaceholder} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{dict.common.cancel}</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.pipelineExt.newOpportunity}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ── Pipeline Card ── */
function PipelineCard({ customer, onStatusChange }: {
  customer: Customer
  onStatusChange: (id: string, newStatus: string) => void
}) {
  const { dict } = useI18n()
  const router = useRouter()
  const tr = dict.pipelinePage.transitions
  const volume = customer.estimatedMonthlyVolume ? Number(customer.estimatedMonthlyVolume) : 0
  const winRate = customer.winRate ?? 0

  // Find latest contact date from visit or call records
  const lastContactDate = useMemo(() => {
    const dates: string[] = []
    if (customer.visitRecords?.length) dates.push(customer.visitRecords[0].visitDate)
    if (customer.callRecords?.length) dates.push(customer.callRecords[0].callDate)
    if (dates.length === 0) return null
    return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
  }, [customer.visitRecords, customer.callRecords])

  const daysSinceContact = daysSince(lastContactDate)

  // Available transitions per status
  const transitions: Record<string, { key: string; label: string; color: string }[]> = {
    POTENTIAL:   [
      { key: 'NEGOTIATING', label: tr.toNegotiating, color: 'text-amber-600 hover:bg-amber-50' },
      { key: 'REJECTED',    label: tr.toRejected,    color: 'text-red-500 hover:bg-red-50' },
    ],
    NEGOTIATING: [
      { key: 'CLOSED',   label: tr.toClosed,   color: 'text-green-600 hover:bg-green-50' },
      { key: 'DORMANT',  label: tr.toDormant,  color: 'text-slate-500 hover:bg-slate-50' },
      { key: 'REJECTED', label: tr.toRejected, color: 'text-red-500 hover:bg-red-50' },
    ],
    CLOSED: [
      { key: 'DORMANT', label: tr.toDormantFromClosed, color: 'text-slate-500 hover:bg-slate-50' },
    ],
    DORMANT: [
      { key: 'NEGOTIATING', label: tr.reactivate, color: 'text-amber-600 hover:bg-amber-50' },
      { key: 'REJECTED',    label: tr.toRejected, color: 'text-red-500 hover:bg-red-50' },
    ],
    REJECTED: [
      { key: 'POTENTIAL', label: tr.reopen, color: 'text-slate-600 hover:bg-slate-50' },
    ],
  }

  return (
    <div
      className="rounded-lg border bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => router.push(`/customers/${customer.id}`)}
    >
      {/* Header: name + type badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-900 leading-tight line-clamp-1 group-hover:text-blue-600 transition-colors">
          {customer.name}
        </h4>
        {customer.grade && (
          <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${gradeColors[customer.grade] ?? ''}`}>
            {customer.grade}
          </span>
        )}
      </div>

      {/* Type badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColors[customer.type] ?? 'bg-slate-100 text-slate-600'}`}>
          {customerTypes.find(t => t.value === customer.type)?.label ?? customer.type}
        </span>
        {customer.region && (
          <span className="text-[10px] text-muted-foreground">{customer.region}</span>
        )}
      </div>

      {/* Sales rep */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
        <User className="h-3 w-3" />
        <span>{customer.salesRep?.name ?? dict.common.unassigned}</span>
      </div>

      {/* Win rate progress bar */}
      {customer.winRate != null && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-muted-foreground">{dict.pipelineExt.probability}</span>
            <span className="font-medium">{winRate}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.min(winRate, 100)}%`,
                backgroundColor: winRate >= 70 ? '#22c55e' : winRate >= 40 ? '#f59e0b' : '#94a3b8',
              }}
            />
          </div>
        </div>
      )}

      {/* Volume */}
      {volume > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <DollarSign className="h-3 w-3" />
          <span>{dict.pipeline.monthlyVolume} ${formatCurrency(volume)}</span>
        </div>
      )}

      {/* Last contact */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
        <Clock className="h-3 w-3" />
        {daysSinceContact != null ? (
          <span className={daysSinceContact > 30 ? 'text-red-500 font-medium' : daysSinceContact > 14 ? 'text-amber-500' : ''}>
            {daysSinceContact === 0 ? dict.pipelineExt.today : `${daysSinceContact} ${dict.pipelinePage.daysSinceContact}`}
          </span>
        ) : (
          <span className="text-red-400">{dict.pipelinePage.noContactRecord}</span>
        )}
      </div>

      {/* Quick status change buttons */}
      {transitions[customer.devStatus] && transitions[customer.devStatus].length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
          {transitions[customer.devStatus].map(t => (
            <button
              key={t.key}
              onClick={() => onStatusChange(customer.id, t.key)}
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${t.color}`}
            >
              <ArrowRight className="h-2.5 w-2.5" />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main Page ── */
export default function PipelinePage() {
  const { dict } = useI18n()
  const router = useRouter()
  const pgDict = dict.pipelinePage
  const PIPELINE_STAGES = PIPELINE_STAGE_META.map(s => ({
    ...s,
    label: pgDict.stages[s.key as keyof typeof pgDict.stages],
  }))
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSalesRep, setFilterSalesRep] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      setCustomers(Array.isArray(data) ? data : (data.data ?? []))
    } catch {
      toast.error(dict.pipelineExt.loadFailed)
    }
    setLoading(false)
  }, [dict])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then((d: { id: string; name: string; role: string }[]) =>
        setSalesReps(Array.isArray(d)
          ? d.filter(u => ['SALES', 'SALES_MANAGER', 'GM', 'SUPER_ADMIN'].includes(u.role))
               .map(u => ({ id: u.id, name: u.name }))
          : [])
      ).catch(() => {})
  }, [])

  // Filter customers
  const filtered = useMemo(() => {
    return customers.filter(c => {
      if (search) {
        const s = search.toLowerCase()
        if (!c.name.toLowerCase().includes(s) &&
            !c.code.toLowerCase().includes(s) &&
            !(c.contactPerson ?? '').toLowerCase().includes(s)) return false
      }
      if (filterSalesRep && c.salesRepId !== filterSalesRep) return false
      if (filterGrade && c.grade !== filterGrade) return false
      return true
    })
  }, [customers, search, filterSalesRep, filterGrade])

  // Group by devStatus
  const grouped = useMemo(() => {
    const map: Record<string, Customer[]> = {}
    for (const stage of PIPELINE_STAGES) map[stage.key] = []
    for (const c of filtered) {
      if (map[c.devStatus]) map[c.devStatus].push(c)
      // OTHER status customers are excluded from pipeline view
    }
    return map
  }, [filtered])

  // Summary stats
  const stats = useMemo(() => {
    const totalLeads = filtered.filter(c => c.devStatus !== 'REJECTED').length
    const closedCount = grouped['CLOSED']?.length ?? 0
    const conversionRate = totalLeads > 0 ? ((closedCount / totalLeads) * 100).toFixed(1) : '0.0'

    let weightedValue = 0
    for (const c of filtered) {
      if (c.devStatus === 'REJECTED' || c.devStatus === 'DORMANT') continue
      const vol = c.estimatedMonthlyVolume ? Number(c.estimatedMonthlyVolume) : 0
      const wr = c.winRate ?? 0
      weightedValue += vol * (wr / 100)
    }

    let totalVolume = 0
    for (const c of filtered) {
      const vol = c.estimatedMonthlyVolume ? Number(c.estimatedMonthlyVolume) : 0
      totalVolume += vol
    }

    return { totalLeads, closedCount, conversionRate, weightedValue, totalVolume }
  }, [filtered, grouped])

  // Handle status change
  async function handleStatusChange(customerId: string, newStatus: string) {
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return

    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customer.name,
        type: customer.type,
        devStatus: newStatus,
      }),
    })

    if (res.ok) {
      toast.success(dict.common.updateSuccess)
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, devStatus: newStatus } : c))
    } else {
      toast.error(dict.common.updateFailed)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.pipeline.title}</h1>
          <p className="text-sm text-muted-foreground">
            {pgDict.subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/customers')}>
            <ChevronRight className="mr-1 h-4 w-4" />{dict.nav.customers}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />{dict.pipelineExt.newOpportunity}
          </Button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{dict.pipeline.totalLeads}</p>
              <p className="text-lg font-bold">{stats.totalLeads}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{dict.customers.devStatuses.CLOSED}</p>
              <p className="text-lg font-bold">{stats.closedCount} <span className="text-xs font-normal text-muted-foreground">({stats.conversionRate}%)</span></p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{dict.pipeline.weightedValue}</p>
              <p className="text-lg font-bold">${formatCurrency(stats.weightedValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{dict.pipeline.monthlyVolume}</p>
              <p className="text-lg font-bold">${formatCurrency(stats.totalVolume)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.pipelineExt.customerPlaceholder}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
          value={filterSalesRep} onChange={e => setFilterSalesRep(e.target.value)}>
          <option value="">{dict.common.all}{dict.common.salesRep}</option>
          {salesReps.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
          value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
          <option value="">{dict.common.all}{dict.customers.grade}</option>
          {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>{g}{pgDict.gradeSuffix}</option>)}
        </select>
        {(search || filterSalesRep || filterGrade) && (
          <button className="text-xs text-muted-foreground hover:text-slate-900 underline"
            onClick={() => { setSearch(''); setFilterSalesRep(''); setFilterGrade('') }}>
            {pgDict.clearFilter}
          </button>
        )}
      </div>

      {/* Kanban Columns */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3 min-h-[60vh]">
          {PIPELINE_STAGES.map(stage => {
            const stageCustomers = grouped[stage.key] ?? []
            const stageVolume = stageCustomers.reduce((sum, c) => {
              return sum + (c.estimatedMonthlyVolume ? Number(c.estimatedMonthlyVolume) : 0)
            }, 0)

            return (
              <div key={stage.key} className={`flex flex-col rounded-lg ${stage.lightBg} ${stage.border} border`}>
                {/* Column header */}
                <div className="p-3 border-b border-inherit">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{stage.icon}</span>
                      <h3 className="text-sm font-semibold text-slate-800">{stage.label}</h3>
                    </div>
                    <Badge variant="outline" className="text-xs font-bold tabular-nums">
                      {stageCustomers.length}
                    </Badge>
                  </div>
                  {stageVolume > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {dict.pipeline.monthlyVolume} ${formatCurrency(stageVolume)}
                    </p>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {stageCustomers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      {dict.pipelineExt.noOpportunitiesInStage}
                    </p>
                  ) : (
                    stageCustomers.map(c => (
                      <PipelineCard
                        key={c.id}
                        customer={c}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Lead Dialog */}
      <CreateLeadDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={fetchCustomers}
      />
    </div>
  )
}
