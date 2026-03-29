'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChevronLeft, ChevronRight, RefreshCw, Send, Loader2,
  Phone, Users, FileText, ShoppingCart, Package, CheckCircle2,
  MessageSquare, Truck, TrendingUp, MapPin,
} from 'lucide-react'
import { toast } from 'sonner'
import MobileDailyReport from '@/components/layout/mobile-daily-report'

// ── Types ────────────────────────────────────────────────────────────────────

interface RepSummary {
  rep: { id: string; name: string; role: string }
  logCount: number
  callCount: number
  visitCount: number
  newCustomers: number
  quotations: number
  quotationAmount: number
  orders: number
  orderAmount: number
  samples: number
  completedTasks: number
  logs: FollowUpLogItem[]
}

interface FollowUpLogItem {
  id: string
  logDate: string
  logType: string
  content: string
  result: string | null
  customerReaction: string | null
  customer: { id: string; name: string; code: string; devStatus: string }
  createdBy: { id: string; name: string }
}

interface NewCustomer {
  id: string
  name: string
  code: string
  type: string
  source: string | null
  devStatus: string
  phone: string | null
  salesRep: { id: string; name: string } | null
  createdAt: string
}

interface QuotationItem {
  id: string
  quotationNo: string
  status: string
  totalAmount: string
  customer: { id: string; name: string }
  createdBy: { id: string; name: string }
  createdAt: string
}

interface OrderItem {
  id: string
  orderNo: string
  status: string
  totalAmount: string
  customer: { id: string; name: string }
  createdBy: { id: string; name: string }
  createdAt: string
}

interface ComparisonData {
  yesterdayOrders: number
  yesterdayRevenue: number
  yesterdayVisits: number
  yesterdayCalls: number
  orderChange: number
  revenueChange: number
}

interface DailyReport {
  date: string
  generatedAt: string
  summary: {
    totalLogs: number
    totalCalls: number
    totalVisits: number
    newCustomers: number
    coldCallProspects: number
    quotations: number
    quotationAmount: number
    orders: number
    orderAmount: number
    shipments: number
    samples: number
    completedTasks: number
    incomingPayments: number
    outgoingPayments: number
  }
  comparison?: ComparisonData
  repSummaries: RepSummary[]
  details: {
    followUpLogs: FollowUpLogItem[]
    newCustomers: NewCustomer[]
    quotations: QuotationItem[]
    salesOrders: OrderItem[]
  }
}

// ── Config ───────────────────────────────────────────────────────────────────

const REACTION_COLOR: Record<string, string> = {
  POSITIVE:    'text-green-600',
  NEUTRAL:     'text-slate-500',
  NEGATIVE:    'text-red-500',
  NO_RESPONSE: 'text-slate-400',
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency', currency: 'TWD', maximumFractionDigits: 0,
  }).format(n)
}
function fmtTime(str: string) {
  return new Date(str).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DailyReportPage() {
  const { dict } = useI18n()
  const router = useRouter()
  const dr = dict.dailyReport
  const [date, setDate]         = useState(yesterdayStr())
  const [report, setReport]     = useState<DailyReport | null>(null)
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ logs: true, orders: true })

  const LOG_TYPE_LABEL: Record<string, string> = {
    CALL: dr.logTypeLabels.CALL,
    LINE: dr.logTypeLabels.LINE,
    EMAIL: dr.logTypeLabels.EMAIL,
    MEETING: dr.logTypeLabels.MEETING,
    FIRST_VISIT: dr.logTypeLabels.FIRST_VISIT,
    SECOND_VISIT: dr.logTypeLabels.SECOND_VISIT,
    THIRD_VISIT: dr.logTypeLabels.THIRD_VISIT,
    DELIVERY: dr.logTypeLabels.DELIVERY,
    EXPO: dr.logTypeLabels.EXPO,
    OTHER: dr.logTypeLabels.OTHER,
  }
  const REACTION_LABEL: Record<string, string> = {
    POSITIVE: dr.reactionLabels.POSITIVE,
    NEUTRAL: dr.reactionLabels.NEUTRAL,
    NEGATIVE: dr.reactionLabels.NEGATIVE,
    NO_RESPONSE: dr.reactionLabels.NO_RESPONSE,
  }
  const SOURCE_LABEL: Record<string, string> = {
    COLD_CALL: dr.sourceLabels.COLD_CALL,
    REFERRAL: dr.sourceLabels.REFERRAL,
    EXHIBITION: dr.sourceLabels.EXHIBITION,
    ADVERTISING: dr.sourceLabels.ADVERTISING,
    WEBSITE: dr.sourceLabels.WEBSITE,
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/daily?date=${date}`)
      if (res.ok) setReport(await res.json())
      else toast.error(dict.common.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  async function handleSend() {
    setSending(true)
    try {
      const res = await fetch('/api/reports/daily/send', { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        toast.success(`${dr.pushedToManagers} ${d.notifiedCount} ${dr.pushedSuffix}`)
      } else {
        toast.error(dr.pushFailed)
      }
    } finally {
      setSending(false)
    }
  }

  function toggle(key: string) {
    setExpanded(p => ({ ...p, [key]: !p[key] }))
  }

  const isToday     = date === todayStr()
  const isYesterday = date === yesterdayStr()
  const s = report?.summary

  // Mobile detection for boss view
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Mobile: show smart boss daily report
  if (isMobile && report && !loading) {
    return (
      <div className="-m-3 sm:-m-4">
        <MobileDailyReport report={report} />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dr.title}</h1>
          <p className="text-sm text-muted-foreground">{dr.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick toggle */}
          <div className="flex rounded-lg border overflow-hidden text-sm">
            <button
              onClick={() => setDate(yesterdayStr())}
              className={`px-3 py-1.5 font-medium transition-colors ${isYesterday ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {dr.btnYesterday}
            </button>
            <button
              onClick={() => setDate(todayStr())}
              className={`px-3 py-1.5 font-medium transition-colors border-l ${isToday ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {dr.btnToday}
            </button>
          </div>

          {/* Date navigation */}
          <button onClick={() => setDate(d => addDays(d, -1))} className="p-2 rounded-lg hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={e => setDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          <button
            onClick={() => { if (!isToday) setDate(d => addDays(d, 1)) }}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30"
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
          <Button onClick={handleSend} disabled={sending} size="sm">
            {sending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Send className="mr-2 h-4 w-4" />}
            {dr.submitReport}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/daily-report/export?date=${date}`, '_blank')}
          >
            <FileText className="mr-2 h-4 w-4" />
            {dict.common.exportExcel}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !report ? null : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(() => {
              const cmp = report.comparison
              const items = [
                { label: dr.statInteractions, value: s!.totalLogs,     icon: MessageSquare, color: 'text-blue-600',   bg: 'bg-blue-50',    change: undefined as number | undefined },
                { label: dr.statCalls,        value: s!.totalCalls,   icon: Phone,         color: 'text-indigo-600', bg: 'bg-indigo-50',  change: cmp ? s!.totalCalls - cmp.yesterdayCalls : undefined },
                { label: dr.statVisits,       value: s!.totalVisits,   icon: MapPin,        color: 'text-teal-600',   bg: 'bg-teal-50',    change: cmp ? s!.totalVisits - cmp.yesterdayVisits : undefined },
                { label: dr.statNewCustomers, value: s!.newCustomers,  icon: Users,         color: 'text-amber-600',  bg: 'bg-amber-50',   change: undefined },
                { label: dr.statQuotations,   value: s!.quotations,    icon: FileText,      color: 'text-purple-600', bg: 'bg-purple-50',  change: undefined },
                { label: dr.statOrders,       value: s!.orders,        icon: ShoppingCart,  color: 'text-green-600',  bg: 'bg-green-50',   change: cmp ? cmp.orderChange : undefined },
              ]
              return items.map(item => (
                <div key={item.label} className={`rounded-xl ${item.bg} p-3 text-center`}>
                  <item.icon className={`h-4 w-4 ${item.color} mx-auto mb-1`} />
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  {item.change !== undefined && item.change !== 0 && (
                    <p className={`text-[10px] font-medium mt-0.5 ${item.change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {item.change > 0 ? '\u2191' : '\u2193'}{Math.abs(item.change)} {dr.vsYesterday}
                    </p>
                  )}
                  {item.change !== undefined && item.change === 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">- {dr.vsYesterday}</p>
                  )}
                </div>
              ))
            })()}
          </div>

          {/* Revenue highlight */}
          {(s!.orderAmount > 0 || s!.quotationAmount > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {s!.orderAmount > 0 && (
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{isToday ? dr.todayPrefix : dr.dayPrefix}{dr.dealAmount}</p>
                    <p className="text-xl font-bold text-green-700">{fmtMoney(s!.orderAmount)}</p>
                    {report.comparison && report.comparison.revenueChange !== 0 && (
                      <p className={`text-xs font-medium ${report.comparison.revenueChange > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {report.comparison.revenueChange > 0 ? '\u2191' : '\u2193'}{fmtMoney(Math.abs(report.comparison.revenueChange))} {dr.vsYesterday}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {s!.quotationAmount > 0 && (
                <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-purple-600 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{isToday ? dr.todayPrefix : dr.dayPrefix}{dr.quoteAmount}</p>
                    <p className="text-xl font-bold text-purple-700">{fmtMoney(s!.quotationAmount)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Per-rep table */}
          {report.repSummaries.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{dr.salesRep}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">{dr.colSalesperson}</th>
                        <th className="px-3 py-2.5 text-center font-medium">{dr.colInteractions}</th>
                        <th className="px-3 py-2.5 text-center font-medium">{dr.colCalls}</th>
                        <th className="px-3 py-2.5 text-center font-medium">{dr.colVisits}</th>
                        <th className="px-3 py-2.5 text-center font-medium">{dr.colNewCustomers}</th>
                        <th className="px-3 py-2.5 text-center font-medium">{dr.colQuotations}</th>
                        <th className="px-3 py-2.5 text-center font-medium">{dr.colOrders}</th>
                        <th className="px-3 py-2.5 text-right font-medium">{dr.colOrderAmount}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {report.repSummaries
                        .sort((a, b) => b.logCount - a.logCount)
                        .map(r => (
                          <tr key={r.rep.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-medium">{r.rep.name}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums">
                              <span className={r.logCount > 0 ? 'text-blue-600 font-semibold' : 'text-muted-foreground'}>
                                {r.logCount}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{r.callCount}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{r.visitCount}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums">
                              {r.newCustomers > 0
                                ? <span className="text-amber-600 font-semibold">{r.newCustomers}</span>
                                : <span className="text-muted-foreground">0</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{r.quotations}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums">
                              {r.orders > 0
                                ? <span className="text-green-600 font-semibold">{r.orders}</span>
                                : <span className="text-muted-foreground">0</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                              {r.orderAmount > 0 ? fmtMoney(r.orderAmount) : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detail sections */}
          <div className="space-y-3">
            {/* Follow-up logs */}
            <DetailSection
              title={`${dr.sectionLogs} (${report.details.followUpLogs.length})`}
              expanded={!!expanded['logs']}
              onToggle={() => toggle('logs')}
              empty={report.details.followUpLogs.length === 0}
              emptyText={dr.emptyLogs}
            >
              <div className="space-y-2">
                {report.details.followUpLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg bg-white border p-3 text-sm">
                    <div className="shrink-0 w-16 text-xs text-muted-foreground text-right">
                      {fmtTime(log.logDate)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          {LOG_TYPE_LABEL[log.logType] ?? log.logType}
                        </span>
                        <button
                          onClick={() => router.push(`/customers/${log.customer.id}`)}
                          className="font-medium hover:text-blue-600 hover:underline truncate"
                        >
                          {log.customer.name}
                        </button>
                        {log.customerReaction && (
                          <span className={`text-xs ${REACTION_COLOR[log.customerReaction] ?? ''}`}>
                            {REACTION_LABEL[log.customerReaction] ?? log.customerReaction}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">{log.createdBy.name}</span>
                      </div>
                      <p className="text-slate-600 mt-0.5 line-clamp-2">{log.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>

            {/* New customers */}
            <DetailSection
              title={`${dr.sectionNewCustomers} (${report.details.newCustomers.length})${s!.coldCallProspects > 0 ? ` · ${dr.coldCallNote} ${s!.coldCallProspects}` : ''}`}
              expanded={!!expanded['customers']}
              onToggle={() => toggle('customers')}
              empty={report.details.newCustomers.length === 0}
              emptyText={dr.emptyCustomers}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {report.details.newCustomers.map(c => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/customers/${c.id}`)}
                    className="rounded-lg bg-white border p-3 text-sm cursor-pointer hover:border-blue-300"
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{c.code}</span>
                      {c.source && (
                        <span className="bg-amber-100 text-amber-700 px-1 rounded">
                          {SOURCE_LABEL[c.source] ?? c.source}
                        </span>
                      )}
                      {c.salesRep && <span>{c.salesRep.name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>

            {/* Quotations */}
            <DetailSection
              title={`${dr.sectionQuotations} (${report.details.quotations.length})`}
              expanded={!!expanded['quotations']}
              onToggle={() => toggle('quotations')}
              empty={report.details.quotations.length === 0}
              emptyText={dr.emptyQuotations}
            >
              <div className="space-y-2">
                {report.details.quotations.map(q => (
                  <div
                    key={q.id}
                    onClick={() => router.push(`/quotations/${q.id}`)}
                    className="flex items-center justify-between rounded-lg bg-white border p-3 text-sm cursor-pointer hover:border-blue-300"
                  >
                    <div>
                      <span className="font-mono font-medium text-blue-600">{q.quotationNo}</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span>{q.customer.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{q.createdBy.name}</span>
                    </div>
                    <span className="font-medium">{fmtMoney(Number(q.totalAmount))}</span>
                  </div>
                ))}
              </div>
            </DetailSection>

            {/* Orders */}
            <DetailSection
              title={`${dr.sectionOrders} (${report.details.salesOrders.length})`}
              expanded={!!expanded['orders']}
              onToggle={() => toggle('orders')}
              empty={report.details.salesOrders.length === 0}
              emptyText={dr.emptyOrders}
            >
              <div className="space-y-2">
                {report.details.salesOrders.map(o => (
                  <div
                    key={o.id}
                    onClick={() => router.push(`/orders/${o.id}`)}
                    className="flex items-center justify-between rounded-lg bg-white border p-3 text-sm cursor-pointer hover:border-blue-300"
                  >
                    <div>
                      <span className="font-mono font-medium text-green-600">{o.orderNo}</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span>{o.customer.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{o.createdBy.name}</span>
                    </div>
                    <span className="font-semibold text-green-700">{fmtMoney(Number(o.totalAmount))}</span>
                  </div>
                ))}
              </div>
            </DetailSection>
          </div>

          {/* Sample / Tasks note */}
          {(s!.samples > 0 || s!.completedTasks > 0) && (
            <div className="flex gap-3 text-sm text-muted-foreground">
              {s!.samples > 0 && (
                <span className="flex items-center gap-1">
                  <Package className="h-4 w-4 text-violet-500" />
                  {dr.sampleNote} {s!.samples} {dr.sampleUnit}
                </span>
              )}
              {s!.completedTasks > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {dr.taskNote} {s!.completedTasks} {dr.taskUnit}
                </span>
              )}
            </div>
          )}

          {/* Footer note */}
          <div className="rounded-lg border bg-slate-50 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            {dr.footerNote}
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailSection({
  title, expanded, onToggle, empty, emptyText, children,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  empty: boolean
  emptyText: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-slate-50 transition-colors"
      >
        <span>{title}</span>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      {expanded && (
        <div className="border-t px-4 py-3 bg-slate-50/50">
          {empty ? (
            <p className="text-sm text-muted-foreground text-center py-4">{emptyText}</p>
          ) : children}
        </div>
      )}
    </div>
  )
}
