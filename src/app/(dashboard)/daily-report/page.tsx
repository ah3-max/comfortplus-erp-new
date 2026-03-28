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

const LOG_TYPE_LABEL: Record<string, string> = {
  CALL: '電話', LINE: 'LINE', EMAIL: 'Email', MEETING: '會議',
  FIRST_VISIT: '初訪', SECOND_VISIT: '二訪', THIRD_VISIT: '三訪+',
  DELIVERY: '送貨', EXPO: '展覽', OTHER: '其他',
}
const REACTION_COLOR: Record<string, string> = {
  POSITIVE:    'text-green-600',
  NEUTRAL:     'text-slate-500',
  NEGATIVE:    'text-red-500',
  NO_RESPONSE: 'text-slate-400',
}
const REACTION_LABEL: Record<string, string> = {
  POSITIVE: '正面', NEUTRAL: '普通', NEGATIVE: '拒絕', NO_RESPONSE: '未接',
}
const SOURCE_LABEL: Record<string, string> = {
  COLD_CALL:   '陌生開發',
  REFERRAL:    '轉介紹',
  EXHIBITION:  '展覽',
  ADVERTISING: '廣告',
  WEBSITE:     '官網',
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
  const [date, setDate]         = useState(yesterdayStr())
  const [report, setReport]     = useState<DailyReport | null>(null)
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ logs: true, orders: true })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/daily?date=${date}`)
      if (res.ok) setReport(await res.json())
      else toast.error('載入失敗')
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
        toast.success(`日報已推送給 ${d.notifiedCount} 位主管`)
      } else {
        toast.error('推送失敗')
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
          <h1 className="text-2xl font-bold text-slate-900">{dict.dailyReport.title}</h1>
          <p className="text-sm text-muted-foreground">所有數據自動從系統彙整，無需手動填寫</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick toggle: 昨天 / 今天 */}
          <div className="flex rounded-lg border overflow-hidden text-sm">
            <button
              onClick={() => setDate(yesterdayStr())}
              className={`px-3 py-1.5 font-medium transition-colors ${isYesterday ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              昨天
            </button>
            <button
              onClick={() => setDate(todayStr())}
              className={`px-3 py-1.5 font-medium transition-colors border-l ${isToday ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              今天
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
            {dict.dailyReport.submitReport}
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
          {/* Stats row — 6 key sales metrics */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(() => {
              const cmp = report.comparison
              const items = [
                { label: '互動記錄', value: s!.totalLogs,     icon: MessageSquare, color: 'text-blue-600',   bg: 'bg-blue-50',    change: undefined as number | undefined },
                { label: '電話/LINE', value: s!.totalCalls,   icon: Phone,         color: 'text-indigo-600', bg: 'bg-indigo-50',  change: cmp ? s!.totalCalls - cmp.yesterdayCalls : undefined },
                { label: '拜訪客戶', value: s!.totalVisits,   icon: MapPin,        color: 'text-teal-600',   bg: 'bg-teal-50',    change: cmp ? s!.totalVisits - cmp.yesterdayVisits : undefined },
                { label: '新客戶',   value: s!.newCustomers,  icon: Users,         color: 'text-amber-600',  bg: 'bg-amber-50',   change: undefined },
                { label: '報價單',   value: s!.quotations,    icon: FileText,      color: 'text-purple-600', bg: 'bg-purple-50',  change: undefined },
                { label: '訂單',     value: s!.orders,        icon: ShoppingCart,  color: 'text-green-600',  bg: 'bg-green-50',   change: cmp ? cmp.orderChange : undefined },
              ]
              return items.map(item => (
                <div key={item.label} className={`rounded-xl ${item.bg} p-3 text-center`}>
                  <item.icon className={`h-4 w-4 ${item.color} mx-auto mb-1`} />
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  {item.change !== undefined && item.change !== 0 && (
                    <p className={`text-[10px] font-medium mt-0.5 ${item.change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {item.change > 0 ? '\u2191' : '\u2193'}{Math.abs(item.change)} vs 昨日
                    </p>
                  )}
                  {item.change !== undefined && item.change === 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">- vs 昨日</p>
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
                    <p className="text-xs text-muted-foreground">{isToday ? '今日' : '當日'}成交金額</p>
                    <p className="text-xl font-bold text-green-700">{fmtMoney(s!.orderAmount)}</p>
                    {report.comparison && report.comparison.revenueChange !== 0 && (
                      <p className={`text-xs font-medium ${report.comparison.revenueChange > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {report.comparison.revenueChange > 0 ? '\u2191' : '\u2193'}{fmtMoney(Math.abs(report.comparison.revenueChange))} vs 昨日
                      </p>
                    )}
                  </div>
                </div>
              )}
              {s!.quotationAmount > 0 && (
                <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-purple-600 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{isToday ? '今日' : '當日'}報價金額</p>
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
                <CardTitle className="text-base">{dict.dailyReport.salesRep}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">業務員</th>
                        <th className="px-3 py-2.5 text-center font-medium">互動</th>
                        <th className="px-3 py-2.5 text-center font-medium">電話</th>
                        <th className="px-3 py-2.5 text-center font-medium">拜訪</th>
                        <th className="px-3 py-2.5 text-center font-medium">新客戶</th>
                        <th className="px-3 py-2.5 text-center font-medium">報價</th>
                        <th className="px-3 py-2.5 text-center font-medium">訂單</th>
                        <th className="px-3 py-2.5 text-right font-medium">訂單金額</th>
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
              title={`互動記錄 (${report.details.followUpLogs.length})`}
              expanded={!!expanded['logs']}
              onToggle={() => toggle('logs')}
              empty={report.details.followUpLogs.length === 0}
              emptyText="今天尚無互動記錄"
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
              title={`新增客戶 (${report.details.newCustomers.length})${s!.coldCallProspects > 0 ? ` · 陌生開發 ${s!.coldCallProspects} 個` : ''}`}
              expanded={!!expanded['customers']}
              onToggle={() => toggle('customers')}
              empty={report.details.newCustomers.length === 0}
              emptyText="今天尚無新增客戶"
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
              title={`報價單 (${report.details.quotations.length})`}
              expanded={!!expanded['quotations']}
              onToggle={() => toggle('quotations')}
              empty={report.details.quotations.length === 0}
              emptyText="今天尚無新增報價單"
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
              title={`訂單 (${report.details.salesOrders.length})`}
              expanded={!!expanded['orders']}
              onToggle={() => toggle('orders')}
              empty={report.details.salesOrders.length === 0}
              emptyText="今天尚無新增訂單"
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

          {/* Sample / Tasks note for completeness */}
          {(s!.samples > 0 || s!.completedTasks > 0) && (
            <div className="flex gap-3 text-sm text-muted-foreground">
              {s!.samples > 0 && (
                <span className="flex items-center gap-1">
                  <Package className="h-4 w-4 text-violet-500" />
                  今日送樣 {s!.samples} 件
                </span>
              )}
              {s!.completedTasks > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  完成任務 {s!.completedTasks} 項
                </span>
              )}
            </div>
          )}

          {/* Footer note */}
          <div className="rounded-lg border bg-slate-50 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            資料自動從系統彙整，業務員在系統中的任何操作（記錄互動、開報價、建訂單、新增客戶）都會自動反映在此報表。無需手動填寫。
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
