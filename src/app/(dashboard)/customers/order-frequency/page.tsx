'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ArrowLeft, TrendingUp, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface FrequencyRow {
  customerId: string
  customerName: string
  customerCode: string
  orderCount: number
  totalRevenue: number
  firstOrder: string
  lastOrder: string
  daysSinceLast: number
  avgDaysBetweenOrders: number | null
  churnRisk: 'LOW' | 'MEDIUM' | 'HIGH'
}

function fmt(n: number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const churnConfig = {
  LOW:    { label: '正常',   className: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  MEDIUM: { label: '注意',   className: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  HIGH:   { label: '高流失', className: 'bg-red-100 text-red-700 border-red-200',       icon: AlertTriangle },
}

export default function OrderFrequencyPage() {
  const [rows, setRows] = useState<FrequencyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'orderCount' | 'totalRevenue' | 'daysSinceLast' | 'avgDays'>('orderCount')

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/customers/order-frequency')
      if (!res.ok) throw new Error('載入失敗')
      setRows(await res.json())
    } catch {
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const sorted = [...rows].sort((a, b) => {
    if (sort === 'orderCount')   return b.orderCount - a.orderCount
    if (sort === 'totalRevenue') return b.totalRevenue - a.totalRevenue
    if (sort === 'daysSinceLast') return b.daysSinceLast - a.daysSinceLast
    if (sort === 'avgDays') return (a.avgDaysBetweenOrders ?? 9999) - (b.avgDaysBetweenOrders ?? 9999)
    return 0
  })

  const highRisk  = rows.filter(r => r.churnRisk === 'HIGH').length
  const medRisk   = rows.filter(r => r.churnRisk === 'MEDIUM').length
  const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0)
  const avgOrderCount = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.orderCount, 0) / rows.length * 10) / 10 : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />客戶</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">訂單頻率分析</h1>
          <p className="text-sm text-muted-foreground">近 6 個月下單活躍度與流失風險</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="ml-auto" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />重新整理
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">活躍客戶</p>
            <p className="text-2xl font-bold text-slate-900">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">平均下單次數</p>
            <p className="text-2xl font-bold text-slate-900">{avgOrderCount}<span className="text-sm font-normal text-muted-foreground ml-1">次/客</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />流失風險</p>
            <p className="text-2xl font-bold text-red-600">{highRisk} <span className="text-base text-amber-600">+{medRisk}</span></p>
            <p className="text-xs text-muted-foreground">高風險 + 注意</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-green-500" />6個月累計</p>
            <p className="text-2xl font-bold text-slate-900">{fmt(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">排序：</span>
        {[
          { key: 'orderCount' as const,   label: '下單次數' },
          { key: 'totalRevenue' as const, label: '累計金額' },
          { key: 'daysSinceLast' as const,label: '距上次天數' },
          { key: 'avgDays' as const,      label: '平均間隔' },
        ].map(s => (
          <button key={s.key}
            onClick={() => setSort(s.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              sort === s.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">客戶下單頻率明細</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">載入中...</div>
          ) : sorted.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">近 6 個月無訂單資料</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">客戶代碼</TableHead>
                    <TableHead>客戶名稱</TableHead>
                    <TableHead className="w-16 text-center">下單次數</TableHead>
                    <TableHead className="w-28 text-right">累計金額</TableHead>
                    <TableHead className="w-24">首次下單</TableHead>
                    <TableHead className="w-24">最近下單</TableHead>
                    <TableHead className="w-20 text-center">距今天數</TableHead>
                    <TableHead className="w-20 text-center">平均間隔</TableHead>
                    <TableHead className="w-20 text-center">流失風險</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(r => {
                    const cfg = churnConfig[r.churnRisk]
                    const Icon = cfg.icon
                    return (
                      <TableRow key={r.customerId} className="group">
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.customerCode}</TableCell>
                        <TableCell>
                          <Link href={`/customers/${r.customerId}`} className="font-medium hover:text-blue-600 hover:underline">
                            {r.customerName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center font-bold tabular-nums">{r.orderCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.totalRevenue)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(r.firstOrder)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(r.lastOrder)}</TableCell>
                        <TableCell className={`text-center font-medium tabular-nums ${r.daysSinceLast > 60 ? 'text-red-600' : r.daysSinceLast > 30 ? 'text-amber-600' : 'text-green-600'}`}>
                          {r.daysSinceLast} 天
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {r.avgDaysBetweenOrders ? `${Math.round(r.avgDaysBetweenOrders)} 天` : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex items-center gap-0.5 w-fit mx-auto ${cfg.className}`}>
                            <Icon className="h-2.5 w-2.5" />{cfg.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
