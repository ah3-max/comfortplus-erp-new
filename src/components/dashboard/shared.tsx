'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

// ── Helpers ──────────────────────────────────────────────────────────────────

const LOCALE_MAP: Record<string, string> = { 'zh-TW': 'zh-TW', en: 'en-US', th: 'th-TH' }

export function fmt(n: number, locale = 'zh-TW') {
  return new Intl.NumberFormat(LOCALE_MAP[locale] ?? locale, { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
}

export function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export const STATUS_CLS: Record<string, string> = {
  PENDING:    'border-slate-300 text-slate-600',
  CONFIRMED:  'bg-blue-100 text-blue-700 border-blue-200',
  PROCESSING: 'bg-amber-100 text-amber-700 border-amber-200',
  SHIPPED:    'bg-blue-100 text-blue-700 border-blue-200',
  DELIVERED:  'bg-teal-100 text-teal-700 border-teal-200',
  COMPLETED:  'bg-green-100 text-green-700 border-green-200',
  CANCELLED:  'bg-red-100 text-red-700 border-red-200',
}

export const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308']

// ── Loading ──────────────────────────────────────────────────────────────────

export function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, sub, href, borderColor }: {
  label: string
  value: string | number
  sub?: string
  href?: string
  borderColor?: string
}) {
  const content = (
    <Card className={`${borderColor ? `border-${borderColor}` : ''} hover:border-slate-400 transition-colors`} style={borderColor ? { borderColor } : undefined}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

// ── Alert Item ───────────────────────────────────────────────────────────────

export function AlertBanner({ items }: {
  items: { label: string; href: string; icon: LucideIcon; cls: string }[]
}) {
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((item) => (
        <Link key={item.label} href={item.href}
          className={`flex items-center justify-between rounded-xl border px-4 py-3 ${item.cls} hover:opacity-90 transition-opacity`}>
          <div className="flex items-center gap-2">
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">{item.label}</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 opacity-60" />
        </Link>
      ))}
    </div>
  )
}

// ── Ranking Card ─────────────────────────────────────────────────────────────

export function RankingCard({ title, icon, items, color, noDataLabel }: {
  title: string
  icon: React.ReactNode
  items: { label: string; value: string; sub: string; revenue: number }[]
  color: string
  noDataLabel: string
}) {
  const maxRev = items[0]?.revenue ?? 1
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">{noDataLabel}</p>
        ) : (
          <div className="divide-y">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 px-4 py-1.5">
                <span className={`w-4 shrink-0 text-center text-xs font-bold ${idx < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs font-medium">{item.label}</span>
                    <span className="ml-2 shrink-0 text-xs font-bold">{item.value}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <div className="flex-1 h-1 rounded-full bg-slate-100">
                      <div className={`h-1 rounded-full ${color}`} style={{ width: `${Math.round((item.revenue / maxRev) * 100)}%` }} />
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{item.sub}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Progress Bar ─────────────────────────────────────────────────────────────

export function ProgressBar({ label, current, target, color = 'bg-blue-500' }: {
  label: string
  current: number
  target: number
  color?: string
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Quick Action Button ──────────────────────────────────────────────────────

export function QuickAction({ label, href, icon: Icon, color = 'bg-blue-600' }: {
  label: string
  href: string
  icon: LucideIcon
  color?: string
}) {
  return (
    <Link href={href}
      className={`flex items-center gap-2 rounded-xl ${color} px-4 py-3 text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm`}>
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

// ── Section Header ───────────────────────────────────────────────────────────

export function SectionHeader({ title, icon: Icon, iconColor }: {
  title: string
  icon: LucideIcon
  iconColor?: string
}) {
  return (
    <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
      <Icon className={`h-4 w-4 ${iconColor ?? 'text-slate-500'}`} />
      {title}
    </h2>
  )
}

// ── Order Row ────────────────────────────────────────────────────────────────

export function OrderRow({ id, orderNo, customerName, amount, status, statusLabel }: {
  id: string
  orderNo: string
  customerName: string
  amount: number
  status: string
  statusLabel: string
}) {
  const statusCls = STATUS_CLS[status] ?? ''
  return (
    <Link href={`/orders/${id}`}
      className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/80 transition-colors">
      <div>
        <span className="font-mono text-xs font-medium">{orderNo}</span>
        <span className="ml-1.5 text-xs text-muted-foreground">{customerName}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold">{fmt(amount)}</span>
        <Badge variant="outline" className={`text-[10px] py-0 ${statusCls}`}>{statusLabel}</Badge>
      </div>
    </Link>
  )
}

// ── Today Header Banner ──────────────────────────────────────────────────────

export function DashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { locale } = useI18n()
  const dateLocale = LOCALE_MAP[locale] ?? 'zh-TW'
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {subtitle ?? new Date().toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      </p>
    </div>
  )
}
