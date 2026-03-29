'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n/context'
import { RefreshCw, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface CycleRow {
  customerId: string
  name: string
  type: string
  orderCount: number
  avgCycleDays: number | null
  minCycleDays: number | null
  maxCycleDays: number | null
  lastOrderDate: string
  nextExpectedDate: string | null
  daysSinceLastOrder: number
  daysOverdue: number
  totalRevenue: number
  avgOrderValue: number
  status: 'OVERDUE' | 'DUE' | 'NORMAL'
}

interface Summary { total: number; overdue: number; due: number; normal: number }

const STATUS_BADGE: Record<string, string> = {
  OVERDUE: 'bg-red-100 text-red-700',
  DUE: 'bg-yellow-100 text-yellow-700',
  NORMAL: 'bg-emerald-100 text-emerald-700',
}
// STATUS_LABEL replaced by dict.reorderCycle.statusLabels

export default function ReorderCyclePage() {
  const { dict } = useI18n()
  const now = new Date()
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  const [startDate, setStartDate] = useState(oneYearAgo.toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10))
  const [minOrders, setMinOrders] = useState('2')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [data, setData] = useState<CycleRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | 'DUE' | 'NORMAL'>('ALL')

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const query = useCallback(async () => {
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams({ startDate, endDate, minOrders })
      const res = await fetch(`/api/customers/reorder-cycle?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data ?? [])
      setSummary(json.summary ?? null)
    } catch { toast.error(dict.common.queryFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate, minOrders])

  const filtered = statusFilter === 'ALL' ? data : data.filter(r => r.status === statusFilter)

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{dict.reorderCycle.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{dict.reorderCycle.subtitle}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">{dict.reorderCycle.periodFrom}</div>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-36" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">{dict.reorderCycle.periodTo}</div>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-36" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">{dict.reorderCycle.minOrders}</div>
          <Input type="number" value={minOrders} onChange={e => setMinOrders(e.target.value)} className="h-9 w-20" min={1} />
        </div>
        <Button onClick={query} disabled={loading} className="gap-1.5 h-9">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? dict.reorderCycle.querying : dict.reorderCycle.query}
        </Button>
      </div>

      {searched && summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className="text-gray-400" />
                <span className="text-xs text-gray-400">{dict.reorderCycle.cardAnalyzed}</span>
              </div>
              <div className="text-2xl font-bold">{summary.total}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-xs text-gray-400">{dict.reorderCycle.cardOverdue}</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{summary.overdue}</div>
              <div className="text-xs text-gray-400">{dict.reorderCycle.overdueNote}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'DUE' ? 'ALL' : 'DUE')}>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className="text-yellow-500" />
                <span className="text-xs text-gray-400">{dict.reorderCycle.cardDue}</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{summary.due}</div>
              <div className="text-xs text-gray-400">{dict.reorderCycle.dueNote}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'NORMAL' ? 'ALL' : 'NORMAL')}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-xs text-gray-400">{dict.reorderCycle.cardNormal}</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600">{summary.normal}</div>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex gap-2 items-center">
            {(['ALL', 'OVERDUE', 'DUE', 'NORMAL'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50 text-gray-700'}`}>
                {s === 'ALL' ? dict.reorderCycle.filterAll : dict.reorderCycle.statusLabels[s]}
              </button>
            ))}
            <span className="text-sm text-gray-400 ml-2">{filtered.length} {dict.common.customer}</span>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">{dict.reorderCycle.colCustomer}</th>
                <th className="px-4 py-3 text-right">{dict.reorderCycle.colOrderCount}</th>
                <th className="px-4 py-3 text-right">{dict.reorderCycle.colAvgCycle}</th>
                <th className="px-4 py-3 text-right">{dict.reorderCycle.colCycleRange}</th>
                <th className="px-4 py-3 text-right">{dict.reorderCycle.colLastOrder}</th>
                <th className="px-4 py-3 text-right">{dict.reorderCycle.colNextExpected}</th>
                <th className="px-4 py-3 text-right">{dict.reorderCycle.colDaysSince}</th>
                <th className="px-4 py-3 text-right">{dict.reorderCycle.colAvgOrderValue}</th>
                <th className="px-4 py-3 text-center">{dict.reorderCycle.colStatus}</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-400">{dict.reorderCycle.noData}</td></tr>
                ) : filtered.map(row => (
                  <tr key={row.customerId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-gray-400">{row.type}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{row.orderCount}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {row.avgCycleDays != null ? `${row.avgCycleDays} ${dict.reorderCycle.dayUnit}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {row.minCycleDays != null ? `${row.minCycleDays}~${row.maxCycleDays} ${dict.reorderCycle.dayUnit}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{row.lastOrderDate}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{row.nextExpectedDate ?? '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {row.daysOverdue > 0
                        ? <span className="text-red-600 font-medium">{dict.reorderCycle.overdueBy.replace('{n}', String(row.daysOverdue))}</span>
                        : <span className="text-gray-500">{row.daysSinceLastOrder} {dict.reorderCycle.dayUnit}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(row.avgOrderValue)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={STATUS_BADGE[row.status]}>{dict.reorderCycle.statusLabels[row.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!searched && (
        <div className="py-20 text-center text-gray-400">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p>{dict.reorderCycle.promptText}</p>
          <p className="text-xs mt-1">{dict.reorderCycle.promptSubText}</p>
        </div>
      )}
    </div>
  )
}
