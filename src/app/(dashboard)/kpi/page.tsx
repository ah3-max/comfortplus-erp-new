'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Target, TrendingUp, Users, MapPin, UserPlus,
  ShoppingCart, Loader2, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface SalesTargetData {
  userId: string
  user: { id: string; name: string; role: string } | null
  month: string
  targets: { revenue: number; orders: number; visits: number; newCustomers: number }
  actuals: { revenue: number; orders: number; visits: number; newCustomers: number; calls?: number; quotes?: number; convertedQuotes?: number; conversionRate?: number }
  achieveRate: number
  hasTarget: boolean
}

const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

function getMonthLabel(m: string) {
  const [y, mo] = m.split('-')
  return `${y}年${mo}月`
}

export default function KpiPage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const role = (session?.user?.role as string) ?? ''
  const isManager = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(role)

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [data, setData] = useState<SalesTargetData[]>([])
  const [loading, setLoading] = useState(true)

  // Set target dialog (single)
  const [editOpen, setEditOpen] = useState(false)
  const [editUser, setEditUser] = useState<SalesTargetData | null>(null)
  const [form, setForm] = useState({ revenue: 0, orders: 0, visits: 0, newCustomers: 0 })
  const [saving, setSaving] = useState(false)

  // Batch set dialog
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchForm, setBatchForm] = useState<Record<string, { revenue: number; orders: number; visits: number; newCustomers: number }>>({})
  const [batchSaving, setBatchSaving] = useState(false)

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ month })
    if (isManager) params.set('team', 'true')
    fetch(`/api/sales-targets?${params}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [month])

  function prevMonth() {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setMonth(d.toISOString().slice(0, 7))
  }
  function nextMonth() {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m, 1)
    setMonth(d.toISOString().slice(0, 7))
  }

  function openEdit(item: SalesTargetData) {
    setEditUser(item)
    setForm({
      revenue: item.targets.revenue,
      orders: item.targets.orders,
      visits: item.targets.visits,
      newCustomers: item.targets.newCustomers,
    })
    setEditOpen(true)
  }

  async function handleSave() {
    if (!editUser) return
    setSaving(true)
    try {
      const res = await fetch('/api/sales-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUser.userId,
          month,
          revenueTarget: form.revenue,
          orderTarget: form.orders || undefined,
          visitTarget: form.visits || undefined,
          newCustTarget: form.newCustomers || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(dict.kpi.targetUpdated)
      setEditOpen(false)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setSaving(false) }
  }

  // Team totals
  const teamTargetRev = data.reduce((s, d) => s + d.targets.revenue, 0)
  const teamActualRev = data.reduce((s, d) => s + d.actuals.revenue, 0)
  const teamAchieve = teamTargetRev > 0 ? Math.round((teamActualRev / teamTargetRev) * 1000) / 10 : 0

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.kpi.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.kpi.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 active:scale-95">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[100px] text-center">{getMonthLabel(month)}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 active:scale-95">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Batch Set Target Button (Manager Only) */}
      {isManager && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBatchOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            {dict.kpi.batchSetTargets}
          </Button>
          {data.filter(d => !d.hasTarget).length > 0 && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              {data.filter(d => !d.hasTarget).length} {dict.kpi.notSetWarning}
            </span>
          )}
        </div>
      )}

      {/* Team Summary (manager only) */}
      {isManager && data.length > 1 && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-lg">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-indigo-200 text-sm">{dict.kpi.teamAchieveRate}</p>
              <p className="text-4xl font-bold mt-1">{teamAchieve}%</p>
            </div>
            <div className="text-right">
              <p className="text-indigo-200 text-sm">{dict.kpi.teamRevenue}</p>
              <p className="text-2xl font-bold">{fmt(teamActualRev)}</p>
              <p className="text-indigo-300 text-xs">{dict.kpi.target} {fmt(teamTargetRev)}</p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-indigo-900/40 overflow-hidden">
            <div className="h-3 rounded-full bg-white/80 transition-all duration-700"
              style={{ width: `${Math.min(100, teamAchieve)}%` }} />
          </div>
        </div>
      )}

      {/* Individual KPI Cards */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{dict.kpi.noKpiData}</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {data.map(item => (
            <Card key={item.userId}>
              <CardContent className="p-4">
                {/* Name + achieve rate */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                      {item.user?.name?.slice(0, 1) ?? '?'}
                    </div>
                    <div>
                      <span className="font-medium text-sm">{item.user?.name ?? '—'}</span>
                      {!item.hasTarget && (
                        <Badge variant="outline" className="text-xs ml-2 text-amber-600 border-amber-300">{dict.kpi.notSet}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${
                      item.achieveRate >= 100 ? 'text-green-600' :
                      item.achieveRate >= 70 ? 'text-blue-600' :
                      item.achieveRate >= 40 ? 'text-amber-600' : 'text-red-600'
                    }`}>{item.achieveRate}%</span>
                    {isManager && (
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Revenue progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{dict.kpi.revenueTarget}</span>
                    <span className="font-medium">{fmt(item.actuals.revenue)} / {item.hasTarget ? fmt(item.targets.revenue) : '—'}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-2.5 rounded-full transition-all duration-700 ${
                      item.achieveRate >= 100 ? 'bg-green-500' :
                      item.achieveRate >= 70 ? 'bg-blue-500' :
                      item.achieveRate >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`} style={{ width: `${Math.min(100, item.achieveRate)}%` }} />
                  </div>
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <KpiMini icon={ShoppingCart} label={dict.kpi.orderCount} actual={item.actuals.orders} target={item.targets.orders} />
                  <KpiMini icon={MapPin} label={dict.kpi.visitCount} actual={item.actuals.visits} target={item.targets.visits} />
                  <KpiMini icon={UserPlus} label={dict.kpi.newCustomerCount} actual={item.actuals.newCustomers} target={item.targets.newCustomers} />
                  <KpiMini icon={Target} label={dict.kpi.callCount} actual={item.actuals.calls ?? 0} target={0} />
                  <KpiMini icon={Target} label={dict.kpi.quoteCount} actual={item.actuals.quotes ?? 0} target={0} />
                  <KpiMini icon={TrendingUp} label={dict.kpi.conversionRate} actual={item.actuals.conversionRate ?? 0} target={0} suffix="%" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Single User Target Dialog */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dict.kpi.setTargetFor} {editUser?.user?.name} — {getMonthLabel(month)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{dict.kpi.revenueTargetTwd}</Label>
              <Input type="number" value={form.revenue}
                onChange={e => setForm(f => ({ ...f, revenue: Number(e.target.value) }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{dict.kpi.orderCount}</Label>
                <Input type="number" value={form.orders}
                  onChange={e => setForm(f => ({ ...f, orders: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.kpi.visitCount}</Label>
                <Input type="number" value={form.visits}
                  onChange={e => setForm(f => ({ ...f, visits: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.kpi.newCustomerCount}</Label>
                <Input type="number" value={form.newCustomers}
                  onChange={e => setForm(f => ({ ...f, newCustomers: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {dict.kpi.saveTarget}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Target Dialog */}
      <Dialog open={batchOpen} onOpenChange={o => {
        if (!o) setBatchOpen(false)
        else {
          // Initialize batch form with current targets
          const init: typeof batchForm = {}
          data.forEach(d => {
            init[d.userId] = {
              revenue: d.targets.revenue,
              orders: d.targets.orders,
              visits: d.targets.visits,
              newCustomers: d.targets.newCustomers,
            }
          })
          setBatchForm(init)
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getMonthLabel(month)} — {dict.kpi.batchSetTargets}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {dict.kpi.batchSetDesc}
            </p>

            {/* Column headers */}
            <div className="hidden sm:grid sm:grid-cols-[140px_1fr_80px_80px_80px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>{dict.kpi.salesPerson}</span>
              <span>{dict.kpi.revenueTargetTwd}</span>
              <span>{dict.kpi.orderCount}</span>
              <span>{dict.kpi.visitCount}</span>
              <span>{dict.kpi.newCustomerCount}</span>
            </div>

            {data.map(item => (
              <div key={item.userId} className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[140px_1fr_80px_80px_80px] gap-2 items-center rounded-xl border p-3 sm:p-2 sm:border-0 sm:rounded-none">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                    {item.user?.name?.slice(0, 1)}
                  </div>
                  <span className="text-sm font-medium">{item.user?.name}</span>
                </div>
                <div>
                  <Label className="sm:hidden text-xs text-muted-foreground">{dict.kpi.revenueTarget}</Label>
                  <Input type="number" placeholder={dict.kpi.revenueTarget}
                    value={batchForm[item.userId]?.revenue ?? ''}
                    onChange={e => setBatchForm(f => ({
                      ...f, [item.userId]: { ...(f[item.userId] ?? { revenue: 0, orders: 0, visits: 0, newCustomers: 0 }), revenue: Number(e.target.value) }
                    }))} />
                </div>
                <div>
                  <Label className="sm:hidden text-xs text-muted-foreground">{dict.kpi.orderCount}</Label>
                  <Input type="number" placeholder="—"
                    value={batchForm[item.userId]?.orders ?? ''}
                    onChange={e => setBatchForm(f => ({
                      ...f, [item.userId]: { ...(f[item.userId] ?? { revenue: 0, orders: 0, visits: 0, newCustomers: 0 }), orders: Number(e.target.value) }
                    }))} />
                </div>
                <div>
                  <Label className="sm:hidden text-xs text-muted-foreground">{dict.kpi.visitCount}</Label>
                  <Input type="number" placeholder="—"
                    value={batchForm[item.userId]?.visits ?? ''}
                    onChange={e => setBatchForm(f => ({
                      ...f, [item.userId]: { ...(f[item.userId] ?? { revenue: 0, orders: 0, visits: 0, newCustomers: 0 }), visits: Number(e.target.value) }
                    }))} />
                </div>
                <div>
                  <Label className="sm:hidden text-xs text-muted-foreground">新客戶</Label>
                  <Input type="number" placeholder="—"
                    value={batchForm[item.userId]?.newCustomers ?? ''}
                    onChange={e => setBatchForm(f => ({
                      ...f, [item.userId]: { ...(f[item.userId] ?? { revenue: 0, orders: 0, visits: 0, newCustomers: 0 }), newCustomers: Number(e.target.value) }
                    }))} />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={async () => {
              setBatchSaving(true)
              try {
                for (const [userId, vals] of Object.entries(batchForm)) {
                  if (vals.revenue > 0) {
                    await fetch('/api/sales-targets', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId, month,
                        revenueTarget: vals.revenue,
                        orderTarget: vals.orders || undefined,
                        visitTarget: vals.visits || undefined,
                        newCustTarget: vals.newCustomers || undefined,
                      }),
                    })
                  }
                }
                toast.success(dict.kpi.allTargetsUpdated)
                setBatchOpen(false)
                load()
              } catch (e) {
                toast.error((e as Error).message)
              } finally { setBatchSaving(false) }
            }} disabled={batchSaving}>
              {batchSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {dict.kpi.saveAll}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KpiMini({ icon: Icon, label, actual, target, suffix }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  actual: number
  target: number
  suffix?: string
}) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
  return (
    <div className="rounded-lg bg-slate-50 p-2 text-center">
      <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-0.5" />
      <p className="text-base font-bold">{actual}{suffix}</p>
      <p className="text-xs text-muted-foreground">
        {target > 0 ? `/ ${target}（${pct}%）` : label}
      </p>
    </div>
  )
}
