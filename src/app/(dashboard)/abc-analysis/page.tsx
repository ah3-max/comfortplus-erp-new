'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n/context'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { RefreshCw, Package } from 'lucide-react'
import { toast } from 'sonner'

interface ABCRow {
  rank: number
  productId: string
  name: string
  sku: string
  category: string | null
  unit: string
  qty: number
  revenue: number
  revenuePct: number
  cumulativePct: number
  orderCount: number
  grade: 'A' | 'B' | 'C'
}

interface Summary {
  totalProducts: number
  grandTotal: number
  gradeA: number; gradeB: number; gradeC: number
  gradeARevenue: number; gradeBRevenue: number; gradeCRevenue: number
}

const GRADE_COLOR: Record<string, string> = { A: 'bg-emerald-100 text-emerald-700', B: 'bg-blue-100 text-blue-700', C: 'bg-gray-100 text-gray-500' }
const GRADE_BAR_COLOR: Record<string, string> = { A: '#10b981', B: '#3b82f6', C: '#9ca3af' }

export default function ABCAnalysisPage() {
  const { dict } = useI18n()
  const abc = dict.abcAnalysis
  const now = new Date()
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [data, setData] = useState<ABCRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL')

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const query = useCallback(async () => {
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const res = await fetch(`/api/inventory/abc-analysis?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data ?? [])
      setSummary(json.summary ?? null)
    } catch { toast.error(dict.common.queryFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate])

  const filtered = gradeFilter === 'ALL' ? data : data.filter(r => r.grade === gradeFilter)

  // Pareto chart data (top 20)
  const paretoData = data.slice(0, 20).map(r => ({
    name: r.sku,
    revenue: r.revenue,
    cumulative: r.cumulativePct,
    fill: GRADE_BAR_COLOR[r.grade],
  }))

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{abc.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{abc.subtitle}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">{abc.startDate}</div>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-36" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">{abc.endDate}</div>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-36" />
        </div>
        <Button onClick={query} disabled={loading} className="gap-1.5 h-9">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? abc.querying : abc.query}
        </Button>
      </div>

      {searched && summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['A', 'B', 'C'] as const).map(g => {
              const count = summary[`grade${g}` as keyof Summary] as number
              const rev = summary[`grade${g}Revenue` as keyof Summary] as number
              const pctTarget = g === 'A' ? 80 : g === 'B' ? 15 : 5
              return (
                <div key={g} className="bg-white border rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => setGradeFilter(gradeFilter === g ? 'ALL' : g)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold text-lg px-2 py-0.5 rounded ${GRADE_COLOR[g]}`}>{abc[`grade${g}` as 'gradeA' | 'gradeB' | 'gradeC']}</span>
                    {gradeFilter === g && <span className="text-xs text-blue-500">{abc.filtered}</span>}
                  </div>
                  <div className="text-2xl font-bold mt-1">{count} <span className="text-sm font-normal text-gray-400">{abc.colProduct}</span></div>
                  <div className="text-sm text-gray-500">{fmt(rev)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{abc.targetContrib.replace('{n}', String(pctTarget))}</div>
                </div>
              )
            })}
            <div className="bg-white border rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-1">{abc.totalSummary}</div>
              <div className="text-2xl font-bold">{summary.totalProducts}</div>
              <div className="text-sm text-gray-500">{fmt(summary.grandTotal)}</div>
            </div>
          </div>

          {/* Pareto chart */}
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">{abc.paretoTitle}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={paretoData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmt(v) : String(v ?? '')} />
                <ReferenceLine yAxisId="right" y={80} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '80%', position: 'right', fontSize: 10 }} />
                <ReferenceLine yAxisId="right" y={95} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '95%', position: 'right', fontSize: 10 }} />
                <Bar yAxisId="left" dataKey="revenue" name={abc.colRevenue} radius={[2, 2, 0, 0]}>
                  {paretoData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Grade filter */}
          <div className="flex gap-2 items-center">
            {(['ALL', 'A', 'B', 'C'] as const).map(g => (
              <button key={g} onClick={() => setGradeFilter(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${gradeFilter === g ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50 text-gray-700'}`}>
                {g === 'ALL' ? abc.filterAll : abc[`grade${g}` as 'gradeA' | 'gradeB' | 'gradeC']}
              </button>
            ))}
            <span className="text-sm text-gray-400 ml-2">{filtered.length} {abc.colProduct}</span>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-right w-12">{abc.colRank}</th>
                <th className="px-4 py-3 text-left">{abc.colProduct}</th>
                <th className="px-4 py-3 text-left">{abc.colCategory}</th>
                <th className="px-4 py-3 text-right">{abc.colQty}</th>
                <th className="px-4 py-3 text-right">{abc.colRevenue}</th>
                <th className="px-4 py-3 text-right">{abc.colSharePct}</th>
                <th className="px-4 py-3 text-right">{abc.colCumPct}</th>
                <th className="px-4 py-3 text-right">{abc.colOrderCount}</th>
                <th className="px-4 py-3 text-center">{abc.colGrade}</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-400">{abc.noData}</td></tr>
                ) : filtered.map(row => (
                  <tr key={row.productId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-right text-gray-400 font-mono text-xs">{row.rank}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{row.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{row.category ?? '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.qty.toLocaleString()} {row.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(row.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{row.revenuePct}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(row.cumulativePct, 100)}%` }} />
                        </div>
                        <span>{row.cumulativePct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{row.orderCount}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={GRADE_COLOR[row.grade]}>{row.grade}</Badge>
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
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>{abc.promptText}</p>
        </div>
      )}
    </div>
  )
}
