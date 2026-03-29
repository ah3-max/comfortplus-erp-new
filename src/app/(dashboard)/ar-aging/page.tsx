'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, AlertTriangle, Clock, DollarSign, Users } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

/* ─── Types ─────────────────────────────────────────────── */
interface ARItem {
  id: string
  customerName: string
  customerCode: string
  salesRep: string
  orderId: string | null
  orderNo: string
  invoiceId: string | null
  invoiceNo: string
  amount: number
  paid: number
  balance: number
  dueDate: string
  overdueDays: number
}

interface Bucket {
  label: string
  count: number
  amount: number
  items: ARItem[]
}

interface ARData {
  buckets: { current: Bucket; days30: Bucket; days60: Bucket; days90: Bucket; over90: Bucket }
  summary: { totalBalance: number; totalOverdue: number; overdueRate: number; totalCount: number }
  topCustomers: { name: string; code: string; balance: number }[]
  generatedAt: string
}

/* ─── Helpers ───────────────────────────────────────────── */
function fmt(n: number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
}

function formatDate(str: string) {
  if (!str || str === '-') return '-'
  return new Date(str).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const BUCKET_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  current: { bg: 'bg-green-50', bar: 'bg-green-500', text: 'text-green-700' },
  days30:  { bg: 'bg-yellow-50', bar: 'bg-yellow-500', text: 'text-yellow-700' },
  days60:  { bg: 'bg-orange-50', bar: 'bg-orange-500', text: 'text-orange-700' },
  days90:  { bg: 'bg-red-50', bar: 'bg-red-500', text: 'text-red-700' },
  over90:  { bg: 'bg-red-100', bar: 'bg-red-800', text: 'text-red-900' },
}

type SortField = 'customerName' | 'balance' | 'overdueDays' | 'dueDate' | 'amount'
type SortDir = 'asc' | 'desc'

/* ─── Component ─────────────────────────────────────────── */
export default function ARAgingPage() {
  const { dict } = useI18n()
  const [data, setData] = useState<ARData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('overdueDays')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    fetch('/api/finance/ar-aging')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const sortIcon = (f: SortField) => sortField === f ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''

  /* All items flattened for detail table */
  const allItems: ARItem[] = data
    ? Object.values(data.buckets).flatMap(b => b.items)
    : []

  const sortedItems = [...allItems].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortField === 'customerName') return a.customerName.localeCompare(b.customerName) * dir
    if (sortField === 'dueDate') return (a.dueDate > b.dueDate ? 1 : -1) * dir
    return ((a[sortField] as number) - (b[sortField] as number)) * dir
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-2" />
        <p>{dict.arAging.loadFailed}</p>
      </div>
    )
  }

  const { summary, buckets, topCustomers } = data
  const bucketKeys = ['current', 'days30', 'days60', 'days90', 'over90'] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.arAging.title}</h1>
        <p className="text-sm text-muted-foreground">
          {dict.arAging.subtitle}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2.5">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{dict.arAging.totalBalance}</p>
              <p className="text-lg font-bold text-slate-900">{fmt(summary.totalBalance)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`rounded-lg p-2.5 ${summary.totalOverdue > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <AlertTriangle className={`h-5 w-5 ${summary.totalOverdue > 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{dict.arAging.totalOverdue}</p>
              <p className={`text-lg font-bold ${summary.totalOverdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {fmt(summary.totalOverdue)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2.5">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{dict.arAging.overdueRate}</p>
              <p className="text-lg font-bold text-amber-600">{summary.overdueRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2.5">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{dict.arAging.totalCount}</p>
              <p className="text-lg font-bold text-slate-900">{summary.totalCount} {dict.arAging.countUnit}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Buckets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{dict.arAging.agingDistribution}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {bucketKeys.map(key => {
              const bucket = buckets[key]
              const color = BUCKET_COLORS[key]
              const pct = summary.totalBalance > 0
                ? Math.round((bucket.amount / summary.totalBalance) * 100)
                : 0
              return (
                <div key={key} className={`rounded-lg p-3 ${color.bg}`}>
                  <p className={`text-xs font-medium ${color.text}`}>{bucket.label}</p>
                  <p className={`text-lg font-bold ${color.text}`}>{fmt(bucket.amount)}</p>
                  <div className="mt-1.5 h-2 rounded-full bg-white/60 overflow-hidden">
                    <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-xs mt-1 ${color.text} opacity-80`}>
                    {bucket.count} {dict.arAging.countUnit} ({pct}%)
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top 10 Overdue Customers */}
      {topCustomers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{dict.arAging.top10Title}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-xs">#</TableHead>
                  <TableHead className="text-xs">{dict.arAging.customerCode}</TableHead>
                  <TableHead className="text-xs">{dict.arAging.customerName}</TableHead>
                  <TableHead className="text-xs text-right">{dict.arAging.arBalance}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((c, i) => (
                  <TableRow key={c.code}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-xs font-mono">{c.code}</TableCell>
                    <TableCell className="text-sm">{c.name}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmt(c.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{dict.arAging.detailTitle}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('customerName')}>
                    {dict.arAging.customerName}{sortIcon('customerName')}
                  </TableHead>
                  <TableHead className="text-xs">{dict.arAging.orderNo}</TableHead>
                  <TableHead className="text-xs">{dict.arAging.invoiceNo}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => toggleSort('amount')}>
                    {dict.arAging.arAmount}{sortIcon('amount')}
                  </TableHead>
                  <TableHead className="text-xs text-right">{dict.arAging.received}</TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => toggleSort('balance')}>
                    {dict.arAging.balance}{sortIcon('balance')}
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('dueDate')}>
                    {dict.arAging.dueDate}{sortIcon('dueDate')}
                  </TableHead>
                  <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => toggleSort('overdueDays')}>
                    {dict.arAging.overdueDays}{sortIcon('overdueDays')}
                  </TableHead>
                  <TableHead className="text-xs">{dict.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                      {dict.arAging.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map(item => {
                    const badge = item.overdueDays <= 0
                      ? { label: dict.arAging.statusNotDue, cls: 'bg-green-100 text-green-700' }
                      : item.overdueDays <= 30
                      ? { label: dict.arAging.statusOverdue, cls: 'bg-yellow-100 text-yellow-700' }
                      : item.overdueDays <= 60
                      ? { label: dict.arAging.statusOverdue, cls: 'bg-orange-100 text-orange-700' }
                      : item.overdueDays <= 90
                      ? { label: dict.arAging.statusSevere, cls: 'bg-red-100 text-red-700' }
                      : { label: dict.arAging.statusSevere, cls: 'bg-red-200 text-red-900' }
                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50/80">
                        <TableCell className="text-sm">{item.customerName}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {item.orderId && item.orderNo !== '-' ? (
                            <Link href={`/orders/${item.orderId}`} className="text-blue-600 hover:underline">
                              {item.orderNo}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{item.orderNo}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {item.invoiceId && item.invoiceNo !== '-' ? (
                            <Link href={`/sales-invoices/${item.invoiceId}`} className="text-blue-600 hover:underline">
                              {item.invoiceNo}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{item.invoiceNo}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-right">{fmt(item.amount)}</TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground">{fmt(item.paid)}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{fmt(item.balance)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(item.dueDate)}</TableCell>
                        <TableCell className="text-sm text-right">
                          {item.overdueDays > 0 ? (
                            <span className="text-red-600 font-medium">{item.overdueDays}</span>
                          ) : (
                            <span className="text-green-600">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
