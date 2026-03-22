'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  DollarSign,
  Handshake,
  UserPlus,
  AlertTriangle,
  Activity,
  ShoppingCart,
  FileText,
  MessageSquareWarning,
  Phone,
  MapPin,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MobileDailyReportProps {
  report: {
    date: string
    summary: {
      totalLogs: number
      totalCalls: number
      totalVisits: number
      newCustomers: number
      quotations: number
      quotationAmount: number
      orders: number
      orderAmount: number
      shipments: number
      completedTasks: number
    }
    repSummaries: {
      rep: { id: string; name: string }
      logCount: number
      callCount: number
      visitCount: number
      newCustomers: number
      quotations: number
      orders: number
      orderAmount: number
    }[]
    details: {
      followUpLogs: {
        id: string
        logType: string
        content: string
        customerReaction: string | null
        customer: { id: string; name: string }
        createdBy: { name: string }
      }[]
      newCustomers: {
        id: string
        name: string
        source: string | null
        salesRep: { name: string } | null
      }[]
      quotations: {
        id: string
        quotationNo: string
        totalAmount: string
        customer: { name: string }
        createdBy: { name: string }
      }[]
      salesOrders: {
        id: string
        orderNo: string
        totalAmount: string
        customer: { name: string }
        createdBy: { name: string }
      }[]
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Highlight = {
  id: string
  type: 'order' | 'quotation' | 'complaint' | 'new-customer' | 'visit'
  emoji: string
  summary: string
  amount?: number
  rep: string
  href: string
}

const GENERIC_CONTENT = new Set([
  '',
  '無',
  '無內容',
  'N/A',
  '-',
  '.',
  '追蹤',
  '追蹤中',
  '跟進',
  '跟進中',
  '已聯繫',
  '已追蹤',
])

function isGenericContent(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length <= 2) return true
  return GENERIC_CONTENT.has(trimmed)
}

function isPositiveReaction(reaction: string | null): boolean {
  if (!reaction) return false
  const lower = reaction.toLowerCase()
  const positive = ['正面', '積極', '有興趣', '同意', '滿意', 'positive', 'interested', '下單', '成交']
  return positive.some((kw) => lower.includes(kw))
}

function isComplaint(log: { logType: string; content: string }): boolean {
  const type = log.logType.toLowerCase()
  const content = log.content.toLowerCase()
  return (
    type.includes('complaint') ||
    type.includes('投訴') ||
    type.includes('客訴') ||
    content.includes('投訴') ||
    content.includes('客訴') ||
    content.includes('抱怨')
  )
}

function formatAmount(amount: number): string {
  if (amount >= 100_000_000) {
    return `$${(amount / 100_000_000).toFixed(1)}億`
  }
  if (amount >= 10_000) {
    return `$${(amount / 10_000).toFixed(amount >= 100_000 ? 0 : 1)}萬`
  }
  return `$${amount.toLocaleString()}`
}

function calcActivityScore(summary: MobileDailyReportProps['report']['summary']): number {
  // Weighted activity score (0-100)
  const raw =
    summary.orders * 20 +
    summary.quotations * 10 +
    summary.newCustomers * 8 +
    summary.totalVisits * 5 +
    summary.totalCalls * 3 +
    summary.completedTasks * 4 +
    summary.shipments * 6
  return Math.min(100, raw)
}

const TYPE_STYLES: Record<Highlight['type'], { bg: string; text: string; border: string }> = {
  order: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  quotation: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  complaint: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
  'new-customer': { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  visit: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
}

const TYPE_LABELS: Record<Highlight['type'], string> = {
  order: '訂單',
  quotation: '報價',
  complaint: '客訴',
  'new-customer': '新客戶',
  visit: '拜訪',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon: Icon,
  label,
  value,
  valueClass,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string
  valueClass?: string
  sub?: string
}) {
  return (
    <div className="flex-none w-[136px] snap-start">
      <Card className="h-full">
        <CardContent className="flex flex-col gap-1 py-3 px-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Icon className="size-3.5" />
            <span className="text-[11px] font-medium tracking-wide">{label}</span>
          </div>
          <span className={cn('text-xl font-bold tabular-nums tracking-tight', valueClass)}>
            {value}
          </span>
          {sub && <span className="text-[10px] text-muted-foreground truncate">{sub}</span>}
        </CardContent>
      </Card>
    </div>
  )
}

function HighlightCard({ item, onClick }: { item: Highlight; onClick: () => void }) {
  const style = TYPE_STYLES[item.type]
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border p-3.5 transition-all active:scale-[0.98]',
        style.bg,
        style.border
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none mt-0.5">{item.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', style.text)}>
              {TYPE_LABELS[item.type]}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{item.rep}</span>
          </div>
          <p className={cn('text-sm font-medium leading-snug line-clamp-2', style.text)}>
            {item.summary}
          </p>
          {item.amount != null && item.amount > 0 && (
            <p className={cn('text-base font-bold mt-1 tabular-nums', style.text)}>
              {formatAmount(item.amount)}
            </p>
          )}
        </div>
        <ChevronRight className={cn('size-4 mt-1 shrink-0 opacity-40', style.text)} />
      </div>
    </button>
  )
}

function RepBar({ name, score, max }: { name: string; score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-xs font-medium text-muted-foreground truncate text-right">
        {name}
      </span>
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2"
          style={{ width: `${Math.max(pct, 8)}%` }}
        >
          {pct > 20 && (
            <span className="text-[10px] font-bold text-white tabular-nums">{score}</span>
          )}
        </div>
      </div>
      {pct <= 20 && (
        <span className="text-[10px] font-medium text-muted-foreground tabular-nums w-6">
          {score}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MobileDailyReport({ report }: MobileDailyReportProps) {
  const router = useRouter()
  const { summary, details, repSummaries } = report

  // --- Compute highlights -------------------------------------------------
  const highlights = useMemo<Highlight[]>(() => {
    const items: Highlight[] = []

    // Sales orders with amount > 0
    for (const order of details.salesOrders) {
      const amount = parseFloat(order.totalAmount) || 0
      if (amount <= 0) continue
      items.push({
        id: `order-${order.id}`,
        type: 'order',
        emoji: '💰',
        summary: `${order.customer.name} 成交 ${order.orderNo}`,
        amount,
        rep: order.createdBy.name,
        href: `/orders/${order.id}`,
      })
    }

    // Significant quotations
    for (const q of details.quotations) {
      const amount = parseFloat(q.totalAmount) || 0
      if (amount <= 0) continue
      items.push({
        id: `quote-${q.id}`,
        type: 'quotation',
        emoji: '📋',
        summary: `${q.customer.name} 報價 ${q.quotationNo}`,
        amount,
        rep: q.createdBy.name,
        href: `/quotations/${q.id}`,
      })
    }

    // Complaints – always show
    for (const log of details.followUpLogs) {
      if (isComplaint(log)) {
        items.push({
          id: `complaint-${log.id}`,
          type: 'complaint',
          emoji: '⚠️',
          summary: `${log.customer.name}：${log.content.slice(0, 60)}`,
          rep: log.createdBy.name,
          href: `/customers/${log.customer.id}`,
        })
      }
    }

    // Visits with positive outcomes
    for (const log of details.followUpLogs) {
      if (log.logType.toLowerCase().includes('visit') || log.logType === '拜訪') {
        if (isGenericContent(log.content)) continue
        if (!isPositiveReaction(log.customerReaction) && !log.customerReaction) continue
        items.push({
          id: `visit-${log.id}`,
          type: 'visit',
          emoji: '🤝',
          summary: `拜訪 ${log.customer.name}：${log.content.slice(0, 50)}`,
          rep: log.createdBy.name,
          href: `/customers/${log.customer.id}`,
        })
      }
    }

    // New customers with clear development status
    for (const c of details.newCustomers) {
      if (!c.name || c.name.trim().length === 0) continue
      items.push({
        id: `customer-${c.id}`,
        type: 'new-customer',
        emoji: '🆕',
        summary: `新客戶 ${c.name}${c.source ? `（來源：${c.source}）` : ''}`,
        rep: c.salesRep?.name ?? '未指派',
        href: `/customers/${c.id}`,
      })
    }

    // Sort: complaints first, then by amount descending, then by type priority
    const typePriority: Record<Highlight['type'], number> = {
      complaint: 0,
      order: 1,
      quotation: 2,
      'new-customer': 3,
      visit: 4,
    }

    items.sort((a, b) => {
      const pa = typePriority[a.type]
      const pb = typePriority[b.type]
      if (pa !== pb) return pa - pb
      return (b.amount ?? 0) - (a.amount ?? 0)
    })

    return items
  }, [details])

  // --- Compute complaint count --------------------------------------------
  const complaintCount = useMemo(
    () => details.followUpLogs.filter(isComplaint).length,
    [details.followUpLogs]
  )

  // --- Activity score -----------------------------------------------------
  const activityScore = useMemo(() => calcActivityScore(summary), [summary])

  // --- Active reps with scores (filter out 0 activity) --------------------
  const activeReps = useMemo(() => {
    const reps = repSummaries
      .map((r) => ({
        name: r.rep.name,
        score:
          r.orders * 20 +
          r.quotations * 10 +
          r.newCustomers * 8 +
          r.visitCount * 5 +
          r.callCount * 3,
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
    return reps
  }, [repSummaries])

  const maxRepScore = activeReps.length > 0 ? activeReps[0].score : 1

  // --- Active deals count -------------------------------------------------
  const activeDeals = summary.orders + summary.quotations

  // --- Format date --------------------------------------------------------
  const formattedDate = useMemo(() => {
    try {
      const d = new Date(report.date)
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`
    } catch {
      return report.date
    }
  }, [report.date])

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">每日簡報</h1>
            <p className="text-xs text-muted-foreground">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
            <Activity className="size-3" />
            <span className="tabular-nums">{activityScore}</span>
            <span className="text-muted-foreground">分</span>
          </div>
        </div>
      </div>

      {/* Summary Cards – horizontal scroll */}
      <div className="px-4 pt-4">
        <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-none">
          <SummaryCard
            icon={DollarSign}
            label="今日營收"
            value={formatAmount(summary.orderAmount)}
            valueClass="text-emerald-600 dark:text-emerald-400"
            sub={`${summary.orders} 筆訂單`}
          />
          <SummaryCard
            icon={Handshake}
            label="進行中交易"
            value={String(activeDeals)}
            sub={`${summary.quotations} 報價 / ${summary.orders} 訂單`}
          />
          <SummaryCard
            icon={UserPlus}
            label="新客戶"
            value={String(summary.newCustomers)}
            valueClass={summary.newCustomers > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
          />
          <SummaryCard
            icon={AlertTriangle}
            label="客訴"
            value={String(complaintCount)}
            valueClass={complaintCount > 0 ? 'text-red-600 dark:text-red-400' : undefined}
          />
          <SummaryCard
            icon={TrendingUp}
            label="團隊活動"
            value={`${summary.totalCalls + summary.totalVisits}`}
            sub={`${summary.totalCalls} 電話 / ${summary.totalVisits} 拜訪`}
          />
          <SummaryCard
            icon={CheckCircle2}
            label="完成任務"
            value={String(summary.completedTasks)}
          />
        </div>
      </div>

      {/* Key Highlights */}
      <section className="px-4 mt-6">
        <h2 className="text-sm font-bold text-muted-foreground tracking-widest uppercase mb-3">
          重點摘要
        </h2>
        {highlights.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">今日無重點項目</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {highlights.map((item) => (
              <HighlightCard
                key={item.id}
                item={item}
                onClick={() => router.push(item.href)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Team Performance */}
      {activeReps.length > 0 && (
        <section className="px-4 mt-6">
          <h2 className="text-sm font-bold text-muted-foreground tracking-widest uppercase mb-3">
            團隊表現
          </h2>
          <Card>
            <CardContent className="flex flex-col gap-2.5 py-4">
              {activeReps.map((rep) => (
                <RepBar key={rep.name} name={rep.name} score={rep.score} max={maxRepScore} />
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Quick stats footer */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 py-2.5">
            <Phone className="size-3.5 mx-auto mb-0.5 text-muted-foreground" />
            <span className="text-base font-bold tabular-nums">{summary.totalCalls}</span>
            <p className="text-[10px] text-muted-foreground">電話</p>
          </div>
          <div className="rounded-lg bg-muted/50 py-2.5">
            <MapPin className="size-3.5 mx-auto mb-0.5 text-muted-foreground" />
            <span className="text-base font-bold tabular-nums">{summary.totalVisits}</span>
            <p className="text-[10px] text-muted-foreground">拜訪</p>
          </div>
          <div className="rounded-lg bg-muted/50 py-2.5">
            <ShoppingCart className="size-3.5 mx-auto mb-0.5 text-muted-foreground" />
            <span className="text-base font-bold tabular-nums">{summary.shipments}</span>
            <p className="text-[10px] text-muted-foreground">出貨</p>
          </div>
        </div>
      </div>
    </div>
  )
}
