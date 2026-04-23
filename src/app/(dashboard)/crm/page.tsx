'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  AlertTriangle, Clock, Package, FileText, RefreshCcw,
  ChevronRight, Phone, MapPin, TrendingDown, CalendarCheck,
  Loader2, CheckCircle2, CalendarDays, Crosshair,
  ShieldCheck, ClipboardList, Calendar, BarChart3,
  Users, Award, Target, Zap, Mail, Video,
  Truck, PartyPopper, Store, MessageCircle,
  LayoutDashboard, TrendingUp, UserPlus, ShoppingCart, CreditCard, ListTodo,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════

interface AlertCustomer {
  id: string; name: string; code: string; phone: string | null
  devStatus: string; lastContactDate: string | null; nextFollowUpDate: string | null
  salesRep: { id: string; name: string } | null
}
interface AlertSample {
  id: string; sentDate: string; items: string; quantity: number | null; purpose: string | null
  customer: { id: string; name: string; code: string }
  sentBy:   { id: string; name: string }
}
interface AlertQuote {
  id: string; quotationNo: string; totalAmount: string | null; updatedAt: string; validUntil: string | null
  customer:  { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
}
interface AlertRepurchase extends AlertCustomer {
  salesOrders: { id: string; orderDate: string; totalAmount: string | null }[]
}
interface AlertSchedule {
  id: string; scheduleType: string; scheduleDate: string; startTime: string | null
  location: string | null; preReminder: string | null
  customer: { id: string; name: string }
  salesRep: { id: string; name: string }
}
interface Alerts {
  uncontacted: AlertCustomer[]; todayFollowups: AlertCustomer[]
  overdueFollowups: AlertCustomer[]; samplesPending: AlertSample[]
  quotesStale: AlertQuote[]; repurchaseWarning: AlertRepurchase[]
  todaySchedules: AlertSchedule[]; generatedAt: string
}

// Analytics types
interface FunnelItem { stage: string; count: number }
interface ActivityItem { logType: string; count: number }
interface AgingStage {
  count: number; avgDays: number
  customers: { id: string; name: string; code: string; devStatus: string
    lastContactDate: string | null; createdAt: string
    salesRep: { id: string; name: string } | null }[]
}
interface TeamMember { userId: string; name: string; weekLogs: number }
interface Analytics {
  funnel: FunnelItem[]; myFunnel: FunnelItem[]
  myMetrics: { weekLogs: number; monthLogs: number; weekVisits: number
    weekSamples: number; weekQuotes: number; monthOrders: number }
  activityBreakdown: ActivityItem[]
  aging: Record<string, AgingStage>
  teamRanking: TeamMember[] | null
  isManager: boolean
}

// Manager Dashboard types
interface ManagerDailyMetrics {
  todayNewCustomers: number; todayFirstVisit: number; todayRevisit: number
  todaySamples: number; todayQuotes: number; todayOrders: number
  todayPayments: number; todayPendingTasks: number
}
interface LeakCustomer { id: string; name: string; code: string; devStatus: string; lastContactDate: string | null; salesRep: { id: string; name: string } | null }
interface LeakSample { id: string; sentDate: string; items: string; customer: { id: string; name: string; code: string }; sentBy: { id: string; name: string } }
interface LeakQuote { id: string; quotationNo: string; status: string; createdAt: string; totalAmount: string | null; customer: { id: string; name: string; code: string }; createdBy: { id: string; name: string } }
interface LeakSchedule { id: string; scheduleDate: string; scheduleType: string; location: string | null; customer: { id: string; name: string; code: string }; salesRep: { id: string; name: string } }
interface LeakRepurchase extends LeakCustomer { lastOrderDate: string | null }
interface RepPerf { userId: string; name: string; role: string; visits: number; totalLogs: number; samples: number; quotes: number; deals: number; repurchases: number }
interface ManagerDashboard {
  daily: ManagerDailyMetrics
  leaks: { noContact: LeakCustomer[]; sampleNoFeedback: LeakSample[]; quoteNotClosed: LeakQuote[]; scheduleNotFilled: LeakSchedule[]; noRepurchase: LeakRepurchase[] }
  repPerformance: RepPerf[]
}

type Tab = 'alerts' | 'performance' | 'pipeline' | 'samples' | 'quotes' | 'schedules' | 'manager' | 'demand'

// ═══════════════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════════════

const DEV_STATUS_COLOR: Record<string, string> = {
  POTENTIAL: 'bg-slate-100 text-slate-600', CONTACTED: 'bg-blue-100 text-blue-700',
  VISITED: 'bg-indigo-100 text-indigo-700', NEGOTIATING: 'bg-amber-100 text-amber-700',
  TRIAL: 'bg-violet-100 text-violet-700', CLOSED: 'bg-green-100 text-green-700',
  STABLE_REPURCHASE: 'bg-teal-100 text-teal-700', DORMANT: 'bg-slate-200 text-slate-500',
}

function daysSince(d: string | null) {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400_000)
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

// ═══════════════════════════════════════════════════════════════════════════
//  Reusable sub-components
// ═══════════════════════════════════════════════════════════════════════════

function CustomerRow({ c, suffix, onQuickLog }: {
  c: AlertCustomer
  suffix?: React.ReactNode
  onQuickLog?: (c: AlertCustomer) => void
}) {
  const { dict } = useI18n()
  const days = daysSince(c.lastContactDate)
  const devStatusLabel: Record<string, string> = {
    POTENTIAL: dict.crmPage.devStatusPotential, CONTACTED: dict.crmPage.devStatusContacted,
    VISITED: dict.crmPage.devStatusVisited, NEGOTIATING: dict.crmPage.devStatusNegotiating,
    TRIAL: dict.crmPage.devStatusTrial, CLOSED: dict.crmPage.devStatusClosed,
    STABLE_REPURCHASE: dict.crmPage.devStatusStableRepurchase, DORMANT: dict.crmPage.devStatusDormant,
    CHURNED: dict.crmPage.devStatusChurned, REJECTED: dict.crmPage.devStatusRejected,
  }
  return (
    <div className="flex items-center border-b last:border-b-0 hover:bg-slate-50 transition-colors group">
      <Link href={`/customers/${c.id}`}
        className="flex-1 flex items-center justify-between px-3 py-2.5 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{c.name}</span>
            <Badge variant="outline" className={`text-xs shrink-0 ${DEV_STATUS_COLOR[c.devStatus] ?? ''}`}>
              {devStatusLabel[c.devStatus] ?? c.devStatus}
            </Badge>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span className="font-mono">{c.code}</span>
            {c.salesRep && <span>{c.salesRep.name}</span>}
            {c.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{c.phone}</span>}
            {days !== null && <span className="text-amber-600">{dict.crmPage.daysNoContact.replace('{days}', String(days))}</span>}
            {suffix}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2 group-hover:text-slate-700" />
      </Link>
      {onQuickLog && (
        <button type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickLog(c) }}
          className="px-3 py-2 min-h-[44px] min-w-[44px] text-blue-600 hover:bg-blue-50 border-l flex items-center justify-center"
          title="快速登錄追蹤">
          <MessageCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Quick Follow-up Dialog — 從 CRM 警示列直接登錄追蹤
// ═══════════════════════════════════════════════════════════════════════════

function QuickFollowUpDialog({ customer, open, onClose, onSaved }: {
  customer: AlertCustomer | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [logType, setLogType] = useState<'CALL' | 'LINE' | 'EMAIL' | 'FIRST_VISIT' | 'SECOND_VISIT'>('CALL')
  const [content, setContent] = useState('')
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset when customer changes
  useEffect(() => {
    if (open) {
      setLogType('CALL')
      setContent('')
      setNextFollowUpDate('')
      setNextAction('')
    }
  }, [open, customer?.id])

  if (!open || !customer) return null

  async function submit() {
    if (!content.trim()) { toast.error('請填寫追蹤內容'); return }
    if (!customer) return
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logType,
          method: logType === 'CALL' ? 'PHONE' : logType === 'LINE' ? 'LINE' : logType === 'EMAIL' ? 'EMAIL' : 'IN_PERSON',
          content: content.trim(),
          nextFollowUpDate: nextFollowUpDate || null,
          nextAction: nextAction.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '登錄失敗')
      }
      const data = await res.json()
      toast.success(`已登錄追蹤${data.taskId ? '，已建立後續任務' : ''}`)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '登錄失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-semibold">快速登錄追蹤</h3>
          <p className="text-sm text-muted-foreground">{customer.name}（{customer.code}）</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">追蹤方式</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {([['CALL', '📞 電話'], ['LINE', '💬 LINE'], ['EMAIL', '📧 Email'], ['FIRST_VISIT', '🚗 拜訪']] as const).map(([v, label]) => (
                <button key={v} type="button"
                  onClick={() => setLogType(v as typeof logType)}
                  className={`px-3 py-1.5 rounded-md text-sm border min-h-[44px] ${logType === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">追蹤內容 *</label>
            <textarea
              className="w-full mt-1 rounded-md border px-3 py-2 text-sm min-h-[80px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="例如：客戶表示有興趣，要求下週提供報價與樣品..."
              autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">下次追蹤日</label>
              <Input type="date" value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">下次動作</label>
              <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)}
                placeholder="例如：送樣品" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>取消</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            儲存
          </Button>
        </div>
      </div>
    </div>
  )
}

function AlertSection({ title, icon, count, color, children, emptyMsg }: {
  title: string; icon: React.ReactNode; count: number; color: string
  children: React.ReactNode; emptyMsg: string
}) {
  const { dict } = useI18n()
  const [open, setOpen] = useState(count > 0)
  return (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader className="pb-0">
        <button className="flex items-center justify-between w-full" onClick={() => setOpen(o => !o)}>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {icon}{title}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              count > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
          </CardTitle>
          <span className="text-xs text-muted-foreground">{open ? dict.crmPage.collapse : dict.crmPage.expand}</span>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="pt-2 pb-1">
          {count === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">{emptyMsg}</p>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">{children}</div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Sample Tracking Tab Component
// ═══════════════════════════════════════════════════════════════════════════

function SampleTrackingTab({ allSamples }: { allSamples: AlertSample[] }) {
  const { dict } = useI18n()
  const [samples, setSamples] = useState<(AlertSample & { feedbackResult?: string })[]>(allSamples)
  const [feedbackId, setFeedbackId] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setSamples(allSamples) }, [allSamples])

  async function submitFeedback(sampleId: string) {
    if (!feedbackText.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/samples/${sampleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpResult: feedbackText, hasFeedback: true }),
      })
      if (!res.ok) throw new Error(dict.common.saveFailed)
      setSamples(prev => prev.filter(s => s.id !== sampleId))
      setFeedbackId(null); setFeedbackText('')
      toast.success(dict.crmPage.feedbackRecorded)
    } catch { toast.error(dict.common.saveFailed) } finally { setSaving(false) }
  }

  const samplePurposeLabel: Record<string, string> = {
    TRIAL: dict.crmPage.sampleTrial, COMPARISON: dict.crmPage.sampleComparison,
    EDUCATION: dict.crmPage.sampleEducation, NEGOTIATION: dict.crmPage.sampleNegotiation,
  }

  if (samples.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
        <p className="text-sm font-medium text-slate-600">{dict.crmPage.allFeedbackDone}</p>
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-600" />
          {dict.crmPage.sampleListTitle.replace('{count}', String(samples.length))}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 divide-y">
        {samples.map(s => {
          const days = daysSince(s.sentDate)
          return (
            <div key={s.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/customers/${s.customer.id}`} className="text-sm font-medium hover:text-blue-600">
                    {s.customer.name}
                  </Link>
                  <span className="text-xs font-mono text-slate-400">{s.customer.code}</span>
                  {s.purpose && (
                    <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700">
                      {samplePurposeLabel[s.purpose] ?? s.purpose}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {days !== null && <span className="text-xs text-violet-600 font-medium">{dict.crmPage.daysAgo.replace('{days}', String(days))}</span>}
                  {feedbackId !== s.id && (
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2"
                      onClick={() => { setFeedbackId(s.id); setFeedbackText('') }}>
                      {dict.crmPage.recordFeedback}
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <span>{s.items}</span>
                {s.quantity && <span> × {s.quantity}</span>}
                <span className="ml-2">{dict.crmPage.sampleSentDate}{fmtDate(s.sentDate)}</span>
                <span className="ml-2">{dict.crmPage.sampleSales}{s.sentBy.name}</span>
              </div>
              {feedbackId === s.id && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1 flex-wrap">
                    {[
                      '✅ 正面回饋，願意採購',
                      '🤔 還在評估',
                      '👀 已試用，待後續',
                      '❌ 不合適',
                      '📞 聯絡不上',
                    ].map(preset => (
                      <button key={preset} type="button"
                        onClick={() => setFeedbackText(preset)}
                        className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100">
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder={dict.crmPage.feedbackPlaceholder} value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)} className="text-sm h-8 flex-1" autoFocus />
                    <Button size="sm" className="h-8 text-xs" disabled={saving || !feedbackText.trim()}
                      onClick={() => submitFeedback(s.id)}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : dict.crmPage.save}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs"
                      onClick={() => setFeedbackId(null)}>{dict.crmPage.cancel}</Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Schedule Management Tab Component
// ═══════════════════════════════════════════════════════════════════════════

function ScheduleManagementTab() {
  const { dict } = useI18n()
  const [schedules, setSchedules] = useState<AlertSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter === 'upcoming') {
        params.set('from', new Date().toISOString().split('T')[0])
        params.set('isCompleted', 'false')
      }
      const res = await fetch(`/api/sales-schedules?${params}`)
      const data = await res.json()
      setSchedules(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function markComplete(id: string) {
    await fetch(`/api/sales-schedules/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted: true }),
    })
    toast.success(dict.crmPage.markedComplete)
    load()
  }

  const scheduleLabel: Record<string, string> = {
    FIRST_VISIT: dict.crmPage.scheduleFirstVisit, SECOND_VISIT: dict.crmPage.scheduleSecondVisit,
    THIRD_VISIT: dict.crmPage.scheduleThirdVisit, PAYMENT_COLLECT: dict.crmPage.schedulePaymentCollect,
    DELIVERY: dict.crmPage.scheduleDelivery, EXPO: dict.crmPage.scheduleExpo,
    SPRING_PARTY: dict.crmPage.scheduleSpringParty, RECONCILE: dict.crmPage.scheduleReconcile,
    OTHER: dict.crmPage.scheduleOther,
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'upcoming' ? 'default' : 'outline'} className="text-xs h-7"
          onClick={() => setFilter('upcoming')}>{dict.crmPage.upcomingFilter}</Button>
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="text-xs h-7"
          onClick={() => setFilter('all')}>{dict.crmPage.allFilter}</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : schedules.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <CalendarDays className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-muted-foreground">{dict.crmPage.noSchedules}</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {schedules.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="text-xs bg-amber-100 text-amber-700 border-0">
                      {scheduleLabel[s.scheduleType] ?? s.scheduleType}
                    </Badge>
                    <span className="text-sm font-medium">{(s.customer as { name: string }).name}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(s.scheduleDate)}</span>
                    {s.startTime && <span className="text-xs text-slate-500">
                      {new Date(s.startTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                    </span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                    {s.location && <span><MapPin className="h-3 w-3 inline" />{s.location}</span>}
                    <span>{(s.salesRep as { name: string }).name}</span>
                  </div>
                  {s.preReminder && <p className="text-xs text-amber-700 mt-0.5 italic">📌 {s.preReminder}</p>}
                </div>
                <Button size="sm" variant="outline" className="text-xs h-7 shrink-0"
                  onClick={() => markComplete(s.id)}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />{dict.crmPage.markDone}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Main CRM Page
// ═══════════════════════════════════════════════════════════════════════════

export default function CRMPage() {
  const { dict } = useI18n()
  const [alerts, setAlerts] = useState<Alerts | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [managerData, setManagerData] = useState<ManagerDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('alerts')
  const [quickLogCustomer, setQuickLogCustomer] = useState<AlertCustomer | null>(null)
  const [devStatusFilter, setDevStatusFilter] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [alertsRes, analyticsRes, managerRes] = await Promise.all([
        fetch('/api/crm/alerts'),
        fetch('/api/crm/analytics'),
        fetch('/api/crm/manager-dashboard').catch(() => null),
      ])
      if (alertsRes.ok) setAlerts(await alertsRes.json())
      if (analyticsRes.ok) {
        const a = await analyticsRes.json()
        setAnalytics(a)
      }
      if (managerRes?.ok) setManagerData(await managerRes.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const totalAlerts = alerts
    ? alerts.overdueFollowups.length + alerts.samplesPending.length +
      alerts.quotesStale.length + alerts.repurchaseWarning.length
    : 0

  const isManager = analytics?.isManager ?? false
  const scheduleLabel: Record<string, string> = {
    FIRST_VISIT: dict.crmPage.scheduleFirstVisit, SECOND_VISIT: dict.crmPage.scheduleSecondVisit,
    THIRD_VISIT: dict.crmPage.scheduleThirdVisit, PAYMENT_COLLECT: dict.crmPage.schedulePaymentCollect,
    DELIVERY: dict.crmPage.scheduleDelivery, EXPO: dict.crmPage.scheduleExpo,
    SPRING_PARTY: dict.crmPage.scheduleSpringParty, RECONCILE: dict.crmPage.scheduleReconcile,
    OTHER: dict.crmPage.scheduleOther,
  }
  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'alerts',      label: dict.crmPage.tabAlerts,      icon: <Crosshair className="h-4 w-4" />,       count: totalAlerts },
    { key: 'performance', label: dict.crmPage.tabPerformance, icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'pipeline',    label: dict.crmPage.tabPipeline,    icon: <Target className="h-4 w-4" /> },
    { key: 'samples',     label: dict.crmPage.tabSamples,     icon: <Package className="h-4 w-4" />,         count: alerts?.samplesPending.length },
    { key: 'quotes',      label: dict.crmPage.tabQuotes,      icon: <FileText className="h-4 w-4" />,        count: alerts?.quotesStale.length },
    { key: 'schedules',   label: dict.crmPage.tabSchedules,   icon: <Calendar className="h-4 w-4" /> },
    ...(isManager ? [
      { key: 'manager' as Tab, label: dict.crmPage.tabManager, icon: <LayoutDashboard className="h-4 w-4" /> },
      { key: 'demand'  as Tab, label: dict.crmPage.tabDemand,  icon: <BarChart3 className="h-4 w-4" /> },
    ] : []),
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{dict.crm.title}</h1>
          <p className="text-xs text-muted-foreground">{dict.crmPage.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading && !alerts && (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      )}

      {alerts && (
        <>
          {/* ═══ Tab: 警示總覽 ═══ */}
          {tab === 'alerts' && (
            <div className="space-y-3">
              {/* Summary chips */}
              <div className="grid grid-cols-4 gap-2">
                <SummaryChip label={dict.crmPage.todayFollowup} value={alerts.todayFollowups.length} color="blue" icon={<Clock className="h-4 w-4" />} />
                <SummaryChip label={dict.crmPage.overdueFollowup} value={alerts.overdueFollowups.length} color="red" icon={<AlertTriangle className="h-4 w-4" />} />
                <SummaryChip label={dict.crmPage.samplePending} value={alerts.samplesPending.length} color="violet" icon={<Package className="h-4 w-4" />} />
                <SummaryChip label={dict.crmPage.quotePending} value={alerts.quotesStale.length} color="amber" icon={<FileText className="h-4 w-4" />} />
              </div>

              {totalAlerts === 0 && alerts.todayFollowups.length === 0 && alerts.todaySchedules.length === 0 && (
                <Card><CardContent className="py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">{dict.crmPage.noPendingItems}</p>
                </CardContent></Card>
              )}

              {/* devStatus filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1">階段篩選：</span>
                {([
                  ['',                  '全部'],
                  ['POTENTIAL',         '潛在'],
                  ['CONTACTED',         '已聯絡'],
                  ['VISITED',           '已拜訪'],
                  ['NEGOTIATING',       '洽談中'],
                  ['TRIAL',             '試用中'],
                  ['CLOSED',            '已成交'],
                  ['STABLE_REPURCHASE', '穩定回購'],
                  ['DORMANT',           '休眠'],
                ] as const).map(([v, label]) => (
                  <button key={v} type="button"
                    onClick={() => setDevStatusFilter(v)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      devStatusFilter === v
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Today schedules */}
              {alerts.todaySchedules.length > 0 && (
                <AlertSection title={dict.crmPage.todayScheduleTitle} icon={<CalendarCheck className="h-4 w-4 text-amber-600" />}
                  count={alerts.todaySchedules.length} color="border-l-amber-400" emptyMsg="">
                  {alerts.todaySchedules.map(s => (
                    <Link key={s.id} href={`/customers/${s.customer.id}`}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 group">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs bg-amber-100 text-amber-700 border-0">{scheduleLabel[s.scheduleType] ?? s.scheduleType}</Badge>
                          <span className="font-medium text-sm">{s.customer.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                          {s.startTime && <span><Clock className="h-3 w-3 inline mr-0.5" />{new Date(s.startTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>}
                          {s.location && <span><MapPin className="h-3 w-3 inline mr-0.5" />{s.location}</span>}
                        </div>
                        {s.preReminder && <p className="text-xs text-amber-700 mt-0.5 italic">📌 {s.preReminder}</p>}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Link>
                  ))}
                </AlertSection>
              )}

              {/* Today follow-ups */}
              <AlertSection title={dict.crmPage.todayFollowupTitle} icon={<Clock className="h-4 w-4 text-blue-600" />}
                count={alerts.todayFollowups.length} color="border-l-blue-400" emptyMsg={dict.crmPage.todayFollowupEmpty}>
                {alerts.todayFollowups.filter(c => !devStatusFilter || c.devStatus === devStatusFilter).map(c => <CustomerRow key={c.id} c={c} onQuickLog={setQuickLogCustomer} suffix={<span className="text-blue-600 font-medium">{dict.crmPage.todayFollowupLabel}</span>} />)}
              </AlertSection>

              {/* Overdue */}
              <AlertSection title={dict.crmPage.overdueTitle} icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                count={alerts.overdueFollowups.length} color="border-l-red-400" emptyMsg={dict.crmPage.overdueEmpty}>
                {alerts.overdueFollowups.filter(c => !devStatusFilter || c.devStatus === devStatusFilter).map(c => {
                  const d = daysSince(c.nextFollowUpDate)
                  return <CustomerRow key={c.id} c={c} onQuickLog={setQuickLogCustomer} suffix={d !== null ? <span className="text-red-600 font-medium">{dict.crmPage.overdueDays.replace('{d}', String(d))}</span> : undefined} />
                })}
              </AlertSection>

              {/* Uncontacted */}
              <AlertSection title={dict.crmPage.uncontactedTitle} icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
                count={alerts.uncontacted.length} color="border-l-orange-400" emptyMsg={dict.crmPage.uncontactedEmpty}>
                {alerts.uncontacted.filter(c => !devStatusFilter || c.devStatus === devStatusFilter).map(c => <CustomerRow key={c.id} c={c} onQuickLog={setQuickLogCustomer} />)}
              </AlertSection>

              {/* Repurchase warning */}
              <AlertSection title={dict.crmPage.repurchaseTitle} icon={<TrendingDown className="h-4 w-4 text-rose-600" />}
                count={alerts.repurchaseWarning.length} color="border-l-rose-400" emptyMsg={dict.crmPage.repurchaseEmpty}>
                {alerts.repurchaseWarning.filter(c => !devStatusFilter || c.devStatus === devStatusFilter).map(c => {
                  const lastOrder = c.salesOrders[0]
                  const d = daysSince(lastOrder?.orderDate ?? null)
                  return <CustomerRow key={c.id} c={c} onQuickLog={setQuickLogCustomer} suffix={d !== null ? <span className="text-rose-600">{dict.crmPage.repurchaseDays.replace('{d}', String(d))}</span> : undefined} />
                })}
              </AlertSection>

              {/* Footer */}
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {dict.crmPage.updatedAt} {new Date(alerts.generatedAt).toLocaleTimeString('zh-TW')}
              </p>
            </div>
          )}

          {/* ═══ Tab: 績效看板 ═══ */}
          {tab === 'performance' && analytics && <PerformanceTab analytics={analytics} />}

          {/* ═══ Tab: 客戶地圖 ═══ */}
          {tab === 'pipeline' && analytics && <PipelineTab analytics={analytics} />}

          {/* ═══ Tab: 樣品追蹤 ═══ */}
          {tab === 'samples' && <SampleTrackingTab allSamples={alerts.samplesPending} />}

          {/* ═══ Tab: 報價追蹤 ═══ */}
          {tab === 'quotes' && (
            <div className="space-y-3">
              {alerts.quotesStale.length === 0 ? (
                <Card><CardContent className="py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium text-slate-600">{dict.crmPage.noStaleQuotes}</p>
                </CardContent></Card>
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-600" />
                      {dict.crmPage.quoteListTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 divide-y">
                    {alerts.quotesStale.map(q => {
                      const days = daysSince(q.updatedAt)
                      return (
                        <Link key={q.id} href={`/customers/${q.customer.id}`}
                          className="block px-4 py-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{q.customer.name}</span>
                              <span className="font-mono text-xs text-slate-400">{q.quotationNo}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {q.totalAmount && <span className="text-xs font-bold">NT$ {Number(q.totalAmount).toLocaleString()}</span>}
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                            <span>{dict.crmPage.quoteSales}{q.createdBy.name}</span>
                            <span>{dict.crmPage.quoteSent}{fmtDate(q.updatedAt)}</span>
                            {q.validUntil && <span>{dict.crmPage.quoteValidUntil}{fmtDate(q.validUntil)}</span>}
                            {days !== null && <span className="text-amber-600 font-medium">{dict.crmPage.quoteDaysNoResult.replace('{days}', String(days))}</span>}
                          </div>
                        </Link>
                      )
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ═══ Tab: 行程管理 ═══ */}
          {tab === 'schedules' && <ScheduleManagementTab />}

          {/* ═══ Tab: 主管看板 ═══ */}
          {tab === 'manager' && isManager && (
            managerData
              ? <ManagerDashboardTab data={managerData} />
              : <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          )}

          {/* ═══ Tab: 需求看板 ═══ */}
          {tab === 'demand' && isManager && <DemandBoardTab />}
        </>
      )}

      <QuickFollowUpDialog
        customer={quickLogCustomer}
        open={quickLogCustomer !== null}
        onClose={() => setQuickLogCustomer(null)}
        onSaved={load}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Performance Tab
// ═══════════════════════════════════════════════════════════════════════════

const LOG_TYPE_ICON: Record<string, React.ReactNode> = {
  CALL: <Phone className="h-3.5 w-3.5" />, LINE: <MessageCircle className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />, MEETING: <Video className="h-3.5 w-3.5" />,
  FIRST_VISIT: <MapPin className="h-3.5 w-3.5" />, SECOND_VISIT: <MapPin className="h-3.5 w-3.5" />,
  THIRD_VISIT: <MapPin className="h-3.5 w-3.5" />, DELIVERY: <Truck className="h-3.5 w-3.5" />,
  SPRING_PARTY: <PartyPopper className="h-3.5 w-3.5" />, EXPO: <Store className="h-3.5 w-3.5" />,
  OTHER: <ClipboardList className="h-3.5 w-3.5" />,
}

function PerformanceTab({ analytics }: { analytics: Analytics }) {
  const { dict } = useI18n()
  const { myMetrics, activityBreakdown, teamRanking, isManager } = analytics
  const maxAct = Math.max(...activityBreakdown.map(a => a.count), 1)
  const logTypeLabel: Record<string, string> = {
    CALL: dict.crmPage.logCall, LINE: dict.crmPage.logLine, EMAIL: dict.crmPage.logEmail,
    MEETING: dict.crmPage.logMeeting, FIRST_VISIT: dict.crmPage.logFirstVisit,
    SECOND_VISIT: dict.crmPage.logSecondVisit, THIRD_VISIT: dict.crmPage.logThirdVisit,
    DELIVERY: dict.crmPage.logDelivery, SPRING_PARTY: dict.crmPage.logSpringParty,
    EXPO: dict.crmPage.logExpo, OTHER: dict.crmPage.logOther,
  }

  return (
    <div className="space-y-4">
      {/* My metrics */}
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        <MetricChip label={dict.crmPage.weekContacts} value={myMetrics.weekLogs} icon={<Phone className="h-4 w-4" />} color="blue" />
        <MetricChip label={dict.crmPage.weekVisits} value={myMetrics.weekVisits} icon={<MapPin className="h-4 w-4" />} color="green" />
        <MetricChip label={dict.crmPage.weekSamples} value={myMetrics.weekSamples} icon={<Package className="h-4 w-4" />} color="violet" />
        <MetricChip label={dict.crmPage.weekQuotes} value={myMetrics.weekQuotes} icon={<FileText className="h-4 w-4" />} color="amber" />
        <MetricChip label={dict.crmPage.monthContacts} value={myMetrics.monthLogs} icon={<Zap className="h-4 w-4" />} color="indigo" />
        <MetricChip label={dict.crmPage.monthOrders} value={myMetrics.monthOrders} icon={<Award className="h-4 w-4" />} color="teal" />
      </div>

      {/* Activity breakdown this week */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{dict.crmPage.weekActivityTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {activityBreakdown.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{dict.crmPage.noActivity}</p>
          ) : (
            <div className="space-y-2">
              {activityBreakdown.sort((a, b) => b.count - a.count).map(a => (
                <div key={a.logType} className="flex items-center gap-3">
                  <div className="w-16 flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
                    {LOG_TYPE_ICON[a.logType]}
                    <span>{logTypeLabel[a.logType] ?? a.logType}</span>
                  </div>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-5 bg-blue-500 rounded-full flex items-center justify-end pr-2 text-[10px] text-white font-bold min-w-[24px]"
                      style={{ width: `${Math.max((a.count / maxAct) * 100, 10)}%` }}>
                      {a.count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team ranking (managers only) */}
      {isManager && teamRanking && teamRanking.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              {dict.crmPage.teamRankingTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {teamRanking.map((m, i) => {
              const maxVal = teamRanking[0]?.weekLogs ?? 1
              return (
                <div key={m.userId} className="flex items-center gap-2.5 px-4 py-2">
                  <span className={`w-5 text-center text-xs font-bold ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{m.name}</span>
                      <span className="text-xs font-bold">{m.weekLogs} {dict.crmPage.timesUnit}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${Math.round((m.weekLogs / maxVal) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetricChip({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string
}) {
  const cls: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    violet: 'bg-violet-50 border-violet-200 text-violet-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    teal: 'bg-teal-50 border-teal-200 text-teal-800',
  }
  return (
    <div className={`rounded-xl border p-2.5 text-center ${cls[color] ?? ''}`}>
      <div className="flex justify-center mb-1 opacity-70">{icon}</div>
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className="text-[10px] mt-0.5 opacity-80">{label}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Pipeline / Customer Map Tab
// ═══════════════════════════════════════════════════════════════════════════

const STAGE_COLOR: Record<string, string> = {
  POTENTIAL: 'bg-slate-400', CONTACTED: 'bg-blue-500', VISITED: 'bg-indigo-500',
  NEGOTIATING: 'bg-amber-500', TRIAL: 'bg-violet-500', CLOSED: 'bg-green-500',
  STABLE_REPURCHASE: 'bg-teal-500', DORMANT: 'bg-slate-300', CHURNED: 'bg-red-400', REJECTED: 'bg-red-300',
}
const STAGE_BG: Record<string, string> = {
  POTENTIAL: 'bg-slate-50', CONTACTED: 'bg-blue-50', VISITED: 'bg-indigo-50',
  NEGOTIATING: 'bg-amber-50', TRIAL: 'bg-violet-50', CLOSED: 'bg-green-50',
  STABLE_REPURCHASE: 'bg-teal-50', DORMANT: 'bg-slate-50', CHURNED: 'bg-red-50', REJECTED: 'bg-red-50',
}

function PipelineTab({ analytics }: { analytics: Analytics }) {
  const { dict } = useI18n()
  const { funnel, myFunnel, aging } = analytics
  const [showMine, setShowMine] = useState(false)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const activeFunnel = showMine ? myFunnel : funnel
  const maxCount = Math.max(...activeFunnel.map(f => f.count), 1)
  const cp = dict.crmPage
  const stageLabel: Record<string, string> = {
    POTENTIAL: cp.stagePotential,
    CONTACTED: cp.stageContacted,
    VISITED: cp.stageVisited,
    NEGOTIATING: cp.stageNegotiating,
    TRIAL: cp.stageTrial,
    CLOSED: cp.stageClosed,
    STABLE_REPURCHASE: cp.stageStableRepurchase,
    DORMANT: cp.stageDormant,
    CHURNED: cp.stageChurned,
    REJECTED: cp.stageRejected,
  }

  return (
    <div className="space-y-4">
      {/* Toggle all vs mine */}
      <div className="flex gap-2">
        <Button size="sm" variant={!showMine ? 'default' : 'outline'} className="text-xs h-7"
          onClick={() => setShowMine(false)}>{cp.allCompany}</Button>
        <Button size="sm" variant={showMine ? 'default' : 'outline'} className="text-xs h-7"
          onClick={() => setShowMine(true)}>{cp.myCustomers}</Button>
      </div>

      {/* Funnel visualization */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            {cp.funnelTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {activeFunnel.map(f => {
            const agingData = aging[f.stage]
            const pct = maxCount > 0 ? Math.round((f.count / maxCount) * 100) : 0
            const isExpanded = expandedStage === f.stage
            return (
              <div key={f.stage}>
                <button
                  onClick={() => setExpandedStage(isExpanded ? null : f.stage)}
                  className={`w-full rounded-lg px-3 py-2 transition-colors ${STAGE_BG[f.stage] ?? 'bg-slate-50'} hover:opacity-90`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${STAGE_COLOR[f.stage] ?? 'bg-slate-400'}`} />
                      <span className="text-sm font-medium text-slate-800">
                        {stageLabel[f.stage] ?? f.stage}
                      </span>
                      {agingData && agingData.avgDays > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {cp.avgDays.replace('{n}', String(agingData.avgDays))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{f.count}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {f.stage !== activeFunnel[0]?.stage ? `↑ ${pct}%` : ''}
                      </span>
                    </div>
                  </div>
                  {/* Bar */}
                  <div className="mt-1.5 h-2 rounded-full bg-white/60">
                    <div className={`h-2 rounded-full transition-all ${STAGE_COLOR[f.stage] ?? 'bg-slate-400'}`}
                      style={{ width: `${Math.max(pct, 4)}%` }} />
                  </div>
                </button>

                {/* Expanded: show customers in this stage (from aging data) */}
                {isExpanded && agingData && agingData.customers.length > 0 && (
                  <div className="mt-1 ml-5 border-l-2 border-slate-200 pl-3 space-y-0.5">
                    {agingData.customers.slice(0, 15).map(c => {
                      const days = c.lastContactDate
                        ? Math.floor((Date.now() - new Date(c.lastContactDate).getTime()) / 86400_000)
                        : Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400_000)
                      return (
                        <Link key={c.id} href={`/customers/${c.id}`}
                          className="flex items-center justify-between py-1 hover:bg-slate-50 rounded px-2 transition-colors text-xs group">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{c.name}</span>
                            <span className="font-mono text-slate-400">{c.code}</span>
                            {c.salesRep && <span className="text-muted-foreground">{c.salesRep.name}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`${days > 14 ? 'text-red-600 font-medium' : days > 7 ? 'text-amber-600' : 'text-slate-500'}`}>
                              {cp.daysAgo.replace('{days}', String(days))}
                            </span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-60 hover:opacity-100" />
                          </div>
                        </Link>
                      )
                    })}
                    {agingData.customers.length > 15 && (
                      <p className="text-[10px] text-muted-foreground px-2 py-1">
                        {cp.moreCustomers.replace('{n}', String(agingData.customers.length - 15))}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Conversion hints */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs font-semibold text-blue-700 mb-1.5">{cp.conversionHints}</p>
          <div className="text-xs text-blue-600 space-y-1">
            {(() => {
              const pot = activeFunnel.find(f => f.stage === 'POTENTIAL')?.count ?? 0
              const contacted = activeFunnel.find(f => f.stage === 'CONTACTED')?.count ?? 0
              const visited = activeFunnel.find(f => f.stage === 'VISITED')?.count ?? 0
              const closed = activeFunnel.find(f => f.stage === 'CLOSED')?.count ?? 0
              const stable = activeFunnel.find(f => f.stage === 'STABLE_REPURCHASE')?.count ?? 0
              const total = activeFunnel.reduce((s, f) => s + f.count, 0)
              const closedRate = total > 0 ? Math.round(((closed + stable) / total) * 100) : 0
              return (
                <>
                  {pot > 5 && <p>{cp.hintPotential.replace('{n}', String(pot))}</p>}
                  {contacted > 3 && <p>{cp.hintContacted.replace('{n}', String(contacted))}</p>}
                  {visited > 3 && <p>{cp.hintVisited.replace('{n}', String(visited))}</p>}
                  <p>{cp.hintClosedRate.replace('{rate}', String(closedRate)).replace('{closed}', String(closed + stable)).replace('{total}', String(total))}</p>
                </>
              )
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  SummaryChip
// ═══════════════════════════════════════════════════════════════════════════

function SummaryChip({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: React.ReactNode
}) {
  const cls: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    violet: 'bg-violet-50 border-violet-200 text-violet-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
  }
  return (
    <div className={`rounded-xl border p-2 text-center ${cls[color] ?? ''}`}>
      <div className="flex justify-center mb-1 opacity-70">{icon}</div>
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className="text-xs mt-0.5 opacity-80 leading-tight">{label}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Manager Dashboard Tab
// ═══════════════════════════════════════════════════════════════════════════

function DailyStatCard({ label, value, icon, color, sub }: {
  label: string; value: number; icon: React.ReactNode; color: string; sub?: string
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    green:  'bg-green-50 border-green-200 text-green-800',
    violet: 'bg-violet-50 border-violet-200 text-violet-800',
    amber:  'bg-amber-50 border-amber-200 text-amber-800',
    teal:   'bg-teal-50 border-teal-200 text-teal-800',
    rose:   'bg-rose-50 border-rose-200 text-rose-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    slate:  'bg-slate-50 border-slate-200 text-slate-700',
  }
  return (
    <div className={`rounded-xl border p-3 ${colors[color] ?? ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="opacity-60">{icon}</div>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-xs font-medium leading-snug">{label}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

function LeakSection({ title, icon, count, color, children }: {
  title: string; icon: React.ReactNode; count: number; color: string; children: React.ReactNode
}) {
  const { dict } = useI18n()
  const [open, setOpen] = useState(count > 0)
  return (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader className="pb-0 pt-3">
        <button className="flex items-center justify-between w-full" onClick={() => setOpen(o => !o)}>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {icon}{title}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${count > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
          </CardTitle>
          <span className="text-xs text-muted-foreground">{open ? dict.crmPage.collapse : dict.crmPage.expand}</span>
        </button>
      </CardHeader>
      {open && count > 0 && (
        <CardContent className="pt-2 pb-1">
          <div className="divide-y border rounded-lg overflow-hidden">{children}</div>
        </CardContent>
      )}
      {open && count === 0 && (
        <CardContent className="pt-2 pb-3">
          <p className="text-xs text-muted-foreground text-center">{dict.crmPage.noAnomalies}</p>
        </CardContent>
      )}
    </Card>
  )
}

function ManagerDashboardTab({ data }: { data: ManagerDashboard }) {
  const { daily, leaks, repPerformance } = data
  const { dict } = useI18n()
  const DEV_STATUS_LABEL: Record<string, string> = {
    POTENTIAL: dict.crmPage.devStatusPotential, CONTACTED: dict.crmPage.devStatusContacted,
    VISITED: dict.crmPage.devStatusVisited, NEGOTIATING: dict.crmPage.devStatusNegotiating,
    TRIAL: dict.crmPage.devStatusTrial, CLOSED: dict.crmPage.devStatusClosed,
    STABLE_REPURCHASE: dict.crmPage.devStatusStableRepurchase, DORMANT: dict.crmPage.devStatusDormant,
    CHURNED: dict.crmPage.devStatusChurned, REJECTED: dict.crmPage.devStatusRejected,
  }
  const SCHEDULE_LABEL: Record<string, string> = {
    FIRST_VISIT: dict.crmPage.scheduleFirstVisit, SECOND_VISIT: dict.crmPage.scheduleSecondVisit,
    THIRD_VISIT: dict.crmPage.scheduleThirdVisit, PAYMENT_COLLECT: dict.crmPage.schedulePaymentCollect,
    DELIVERY: dict.crmPage.scheduleDelivery, EXPO: dict.crmPage.scheduleExpo,
    SPRING_PARTY: dict.crmPage.scheduleSpringParty, RECONCILE: dict.crmPage.scheduleReconcile,
    OTHER: dict.crmPage.scheduleOther,
  }

  const cp = dict.crmPage
  const dailyItems = [
    { label: cp.daily0Label, value: daily.todayNewCustomers, icon: <UserPlus className="h-4 w-4" />, color: 'blue',   sub: cp.daily0Sub },
    { label: cp.daily1Label, value: daily.todayFirstVisit,   icon: <MapPin className="h-4 w-4" />,    color: 'indigo', sub: cp.daily1Sub },
    { label: cp.daily2Label, value: daily.todayRevisit,      icon: <RefreshCcw className="h-4 w-4" />, color: 'teal',  sub: cp.daily2Sub },
    { label: cp.daily3Label, value: daily.todaySamples,      icon: <Package className="h-4 w-4" />,   color: 'violet', sub: cp.daily3Sub },
    { label: cp.daily4Label, value: daily.todayQuotes,       icon: <FileText className="h-4 w-4" />,  color: 'amber',  sub: cp.daily4Sub },
    { label: cp.daily5Label, value: daily.todayOrders,       icon: <ShoppingCart className="h-4 w-4" />, color: 'green', sub: cp.daily5Sub },
    { label: cp.daily6Label, value: daily.todayPayments,     icon: <CreditCard className="h-4 w-4" />, color: 'rose',  sub: cp.daily6Sub },
    { label: cp.daily7Label, value: daily.todayPendingTasks, icon: <ListTodo className="h-4 w-4" />,  color: 'slate',  sub: cp.daily7Sub },
  ]

  return (
    <div className="space-y-5">

      {/* ── Section 1: Daily Metrics ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          {cp.dailyMetricsTitle}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {dailyItems.map(item => (
            <DailyStatCard key={item.label} {...item} />
          ))}
        </div>
      </div>

      {/* ── Section 2: Leak Alerts ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          {cp.leakAlertsTitle}
        </h2>
        <div className="space-y-3">
          <LeakSection
            title={cp.leakNoContact}
            icon={<Clock className="h-4 w-4 text-orange-500" />}
            count={leaks.noContact.length}
            color="border-l-orange-400"
          >
            {leaks.noContact.map(c => {
              const d = c.lastContactDate
                ? Math.floor((Date.now() - new Date(c.lastContactDate).getTime()) / 86400_000)
                : null
              return (
                <Link key={c.id} href={`/customers/${c.id}`}
                  className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="font-mono text-xs text-slate-400">{c.code}</span>
                      <Badge variant="outline" className={`text-xs ${DEV_STATUS_COLOR[c.devStatus] ?? ''}`}>
                        {DEV_STATUS_LABEL[c.devStatus] ?? c.devStatus}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.salesRep?.name ?? cp.unassigned}
                      {d !== null && <span className="text-orange-600 ml-2 font-medium">{cp.daysNoContactManager.replace('{d}', String(d))}</span>}
                      {d === null && <span className="text-red-600 ml-2 font-medium">{cp.neverContacted}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </LeakSection>

          <LeakSection
            title={cp.leakSampleNoFeedback}
            icon={<Package className="h-4 w-4 text-violet-500" />}
            count={leaks.sampleNoFeedback.length}
            color="border-l-violet-400"
          >
            {leaks.sampleNoFeedback.map(s => {
              const d = Math.floor((Date.now() - new Date(s.sentDate).getTime()) / 86400_000)
              return (
                <Link key={s.id} href={`/customers/${s.customer.id}`}
                  className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                  <div>
                    <div className="text-sm font-medium">{s.customer.name}
                      <span className="font-mono text-xs text-slate-400 ml-2">{s.customer.code}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.items} · {cp.salesRepLabel}{s.sentBy.name} · {cp.sampleDaysAgo.replace('{d}', String(d))}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </LeakSection>

          <LeakSection
            title={cp.leakQuoteNotClosed}
            icon={<FileText className="h-4 w-4 text-amber-500" />}
            count={leaks.quoteNotClosed.length}
            color="border-l-amber-400"
          >
            {leaks.quoteNotClosed.map(q => {
              const d = Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 86400_000)
              return (
                <Link key={q.id} href={`/customers/${q.customer.id}`}
                  className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                  <div>
                    <div className="text-sm font-medium">{q.customer.name}
                      <span className="font-mono text-xs text-slate-400 ml-2">{q.quotationNo}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {cp.salesRepLabel}{q.createdBy.name} · {cp.quoteDaysSent.replace('{d}', String(d))}
                      {q.totalAmount && <span className="ml-2 font-semibold text-slate-700">NT$ {Number(q.totalAmount).toLocaleString()}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </LeakSection>

          <LeakSection
            title={cp.leakNoRepurchase}
            icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
            count={leaks.noRepurchase.length}
            color="border-l-rose-400"
          >
            {leaks.noRepurchase.map(c => {
              const d = c.lastOrderDate
                ? Math.floor((Date.now() - new Date(c.lastOrderDate).getTime()) / 86400_000)
                : null
              return (
                <Link key={c.id} href={`/customers/${c.id}`}
                  className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="font-mono text-xs text-slate-400">{c.code}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.salesRep?.name ?? cp.unassigned}
                      {d !== null ? <span className="text-rose-600 ml-2 font-medium">{cp.lastOrderDays.replace('{d}', String(d))}</span>
                        : <span className="text-rose-600 ml-2 font-medium">{cp.noOrders}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </LeakSection>

          <LeakSection
            title={cp.leakScheduleNotFilled}
            icon={<CalendarCheck className="h-4 w-4 text-blue-500" />}
            count={leaks.scheduleNotFilled.length}
            color="border-l-blue-400"
          >
            {leaks.scheduleNotFilled.map(s => {
              const d = Math.floor((Date.now() - new Date(s.scheduleDate).getTime()) / 86400_000)
              return (
                <Link key={s.id} href={`/customers/${s.customer.id}`}
                  className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                        {SCHEDULE_LABEL[s.scheduleType] ?? s.scheduleType}
                      </Badge>
                      <span className="font-medium">{s.customer.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {cp.salesRepLabel}{s.salesRep.name}
                      <span className="text-blue-600 ml-2 font-medium">{cp.notFilledDays.replace('{d}', String(d))}</span>
                      {s.location && <span className="ml-2">{s.location}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </LeakSection>
        </div>
      </div>

      {/* ── Section 3: Per-rep Performance ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-green-600" />
          {cp.repPerfTitle}
        </h2>
        {repPerformance.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">{cp.noReps}</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-xs text-slate-500">
                      <th className="text-left px-4 py-2.5 font-medium">{cp.colSales}</th>
                      <th className="text-center px-3 py-2.5 font-medium">{cp.colVisits}</th>
                      <th className="text-center px-3 py-2.5 font-medium">{cp.colTracking}</th>
                      <th className="text-center px-3 py-2.5 font-medium">{cp.colSamples}</th>
                      <th className="text-center px-3 py-2.5 font-medium">{cp.colQuotes}</th>
                      <th className="text-center px-3 py-2.5 font-medium">{cp.colDeals}</th>
                      <th className="text-center px-3 py-2.5 font-medium">{cp.colRepurchases}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {repPerformance.map((rep, i) => (
                      <tr key={rep.userId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold w-5 text-center ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                              {i + 1}
                            </span>
                            <span className="font-medium">{rep.name}</span>
                          </div>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold ${rep.visits > 0 ? 'text-indigo-700' : 'text-slate-300'}`}>{rep.visits}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold ${rep.totalLogs > 0 ? 'text-blue-700' : 'text-slate-300'}`}>{rep.totalLogs}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold ${rep.samples > 0 ? 'text-violet-700' : 'text-slate-300'}`}>{rep.samples}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold ${rep.quotes > 0 ? 'text-amber-700' : 'text-slate-300'}`}>{rep.quotes}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold ${rep.deals > 0 ? 'text-green-700' : 'text-slate-300'}`}>{rep.deals}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold ${rep.repurchases > 0 ? 'text-teal-700' : 'text-slate-300'}`}>{rep.repurchases}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  DemandBoardTab  需求看板
// ═══════════════════════════════════════════════════════════════════════════

type DemandRow = {
  category: string; categoryLabel: string
  totalForecastQty: number; totalConfirmedOrdersQty: number
  availableStockQty: number; safetyStockQty: number
  projectedShortageQty: number; suggestedReplenishmentQty: number
  coverageRatio: number | null
}
type UpcomingOrder = {
  customerId: string; customerName: string; customerCode: string
  region: string | null; salesRep: string | null
  nextExpectedOrderDate: string | null; predictedNextOrderDate: string | null
  monthlyTotal: number; confidence: string | null
}
type DemandProjection = {
  projectionMonth: string; forecastingCustomers: number; needsForecast: number
  rows: DemandRow[]; upcomingOrders: UpcomingOrder[]
}

const SHORTAGE_COLOR = (qty: number) =>
  qty > 0 ? 'text-red-600 font-semibold' : 'text-green-600'
const COVERAGE_COLOR = (r: number | null) =>
  r === null ? 'text-slate-400' : r >= 100 ? 'text-green-600' : r >= 70 ? 'text-amber-600' : 'text-red-600'

function DemandBoardTab() {
  const { dict } = useI18n()
  const [data, setData]       = useState<DemandProjection | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth]     = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  async function load(m: string) {
    setLoading(true)
    const res = await fetch(`/api/inventory/demand-projection?month=${m}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { load(month) }, [month])

  const cp = dict.crmPage
  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) : '—'
  const confidenceLabel: Record<string, string> = {
    HIGH: cp.confidenceHigh, MEDIUM: cp.confidenceMedium, LOW: cp.confidenceLow,
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">{cp.demandTitle}</h2>
          {data && (
            <span className="text-xs text-muted-foreground">
              {cp.forecastingCount.replace('{n}', String(data.forecastingCustomers))} · {data.needsForecast > 0 && (
                <span className="text-amber-600">{cp.needsForecastCount.replace('{n}', String(data.needsForecast))}</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
          <Button variant="outline" size="sm" onClick={() => load(month)} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !data ? (
        <p className="text-center py-16 text-muted-foreground">{cp.loadFailed}</p>
      ) : (
        <>
          {/* ── SKU 需求 vs 庫存 ── */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">{cp.demandVsInventoryTitle}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50">
                    <tr>
                      {(cp.demandHeaders as unknown as string[]).map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(row => (
                      <tr key={row.category} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{row.categoryLabel}</td>
                        <td className="px-4 py-3">{row.totalForecastQty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-blue-600">{row.totalConfirmedOrdersQty.toLocaleString()}</td>
                        <td className="px-4 py-3">{row.availableStockQty.toLocaleString()}</td>
                        <td className={`px-4 py-3 ${COVERAGE_COLOR(row.coverageRatio)}`}>
                          {row.coverageRatio !== null ? `${row.coverageRatio}%` : '—'}
                        </td>
                        <td className={`px-4 py-3 ${SHORTAGE_COLOR(row.projectedShortageQty)}`}>
                          {row.projectedShortageQty > 0 ? `-${row.projectedShortageQty.toLocaleString()}` : cp.stockSufficient}
                        </td>
                        <td className="px-4 py-3 text-amber-700 font-medium">
                          {row.suggestedReplenishmentQty > 0 ? row.suggestedReplenishmentQty.toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── 近期待下單客戶 ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />{cp.upcomingOrdersTitle.replace('{n}', String(data.upcomingOrders.length))}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.upcomingOrders.length === 0 ? (
                <p className="px-4 py-8 text-center text-muted-foreground text-sm">{cp.noUpcomingOrders}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50">
                      <tr>
                        {(cp.upcomingHeaders as unknown as string[]).map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcomingOrders.map(o => (
                        <tr key={o.customerId} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <a href={`/customers/${o.customerId}`} className="text-blue-600 hover:underline font-medium">
                              {o.customerName}
                            </a>
                            <span className="ml-1.5 text-xs text-muted-foreground">{o.customerCode}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{o.region ?? '—'}</td>
                          <td className="px-4 py-2.5 text-xs">{o.salesRep ?? '—'}</td>
                          <td className="px-4 py-2.5 text-xs font-medium text-amber-700">{fmtDate(o.nextExpectedOrderDate)}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(o.predictedNextOrderDate)}</td>
                          <td className="px-4 py-2.5 font-medium">{o.monthlyTotal.toLocaleString()}</td>
                          <td className="px-4 py-2.5">
                            {o.confidence ? (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                o.confidence === 'HIGH' ? 'bg-green-100 text-green-700' :
                                o.confidence === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {confidenceLabel[o.confidence] ?? o.confidence}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
