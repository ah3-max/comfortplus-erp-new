'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n/context'
import { RefreshCw, Star, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

interface SupplierKPI {
  supplierId: string
  name: string
  country: string | null
  orderCount: number
  totalAmount: number
  onTimeCount: number
  lateCount: number
  noReceiptCount: number
  onTimePct: number | null
  avgDefectRate: number | null
  score: number | null
  grade: 'A' | 'B' | 'C' | 'D' | null
}

interface Summary {
  totalSuppliers: number
  totalOrders: number
  totalAmount: number
  gradeA: number; gradeB: number; gradeC: number; gradeD: number
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-yellow-100 text-yellow-700',
  D: 'bg-red-100 text-red-700',
}

export default function SupplierPerformancePage() {
  const { dict } = useI18n()
  const now = new Date()
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [data, setData] = useState<SupplierKPI[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [selected, setSelected] = useState<SupplierKPI | null>(null)

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const query = useCallback(async () => {
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const res = await fetch(`/api/suppliers/performance?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data ?? [])
      setSummary(json.summary)
    } catch { toast.error(dict.common.queryFailed) }
    finally { setLoading(false) }
  }, [startDate, endDate])

  const radarData = selected ? [
    { subject: dict.supplierPerformance.radarDimOnTime, value: selected.onTimePct ?? 0 },
    { subject: dict.supplierPerformance.radarDimQuality, value: selected.avgDefectRate !== null ? Math.max(0, 100 - selected.avgDefectRate * 10) : 100 },
    { subject: dict.supplierPerformance.radarDimOrders, value: Math.min(100, selected.orderCount * 5) },
    { subject: dict.supplierPerformance.radarDimAmount, value: Math.min(100, selected.totalAmount / 10000) },
    { subject: dict.supplierPerformance.radarDimTotal, value: selected.score ?? 0 },
  ] : []

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{dict.supplierPerformance.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{dict.supplierPerformance.subtitle}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">{dict.supplierPerformance.periodFrom}</div>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-36" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">{dict.supplierPerformance.periodTo}</div>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-36" />
        </div>
        <Button onClick={query} disabled={loading} className="gap-1.5 h-9">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? dict.supplierPerformance.querying : dict.supplierPerformance.query}
        </Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: dict.supplierPerformance.gradeA, value: summary.gradeA, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 },
            { label: dict.supplierPerformance.gradeB, value: summary.gradeB, color: 'text-blue-600', bg: 'bg-blue-50', icon: TrendingUp },
            { label: dict.supplierPerformance.gradeC, value: summary.gradeC, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle },
            { label: dict.supplierPerformance.gradeD, value: summary.gradeD, color: 'text-red-600', bg: 'bg-red-50', icon: TrendingDown },
          ].map((c, i) => {
            const Icon = c.icon
            return (
              <div key={i} className={`rounded-xl p-3 ${c.bg}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={14} className={c.color} />
                  <span className="text-xs text-gray-600">{c.label}</span>
                </div>
                <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-400">{dict.supplierPerformance.supplierLabel}</div>
              </div>
            )
          })}
        </div>
      )}

      {searched && (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Table */}
          <div className="md:col-span-2 rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">{dict.supplierPerformance.colSupplier}</th>
                <th className="px-4 py-3 text-right">{dict.supplierPerformance.colOrderCount}</th>
                <th className="px-4 py-3 text-right">{dict.supplierPerformance.colOnTimePct}</th>
                <th className="px-4 py-3 text-right">{dict.supplierPerformance.colDefectRate}</th>
                <th className="px-4 py-3 text-right">{dict.supplierPerformance.colAmount}</th>
                <th className="px-4 py-3 text-center">{dict.supplierPerformance.colGrade}</th>
                <th className="px-4 py-3 text-center">{dict.supplierPerformance.colScore}</th>
              </tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">{dict.supplierPerformance.querying}</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">{dict.supplierPerformance.noData}</td></tr>
                ) : data.map(row => {
                  const gradeColor = row.grade ? GRADE_COLORS[row.grade] : null
                  const gradeLabels: Record<string, string> = {
                    A: dict.supplierPerformance.gradeA,
                    B: dict.supplierPerformance.gradeB,
                    C: dict.supplierPerformance.gradeC,
                    D: dict.supplierPerformance.gradeD,
                  }
                  return (
                    <tr
                      key={row.supplierId}
                      className={`border-b last:border-0 cursor-pointer transition-colors ${selected?.supplierId === row.supplierId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => setSelected(row)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.name}</div>
                        {row.country && <div className="text-xs text-gray-400">{row.country}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">{row.orderCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.onTimePct !== null ? (
                          <span className={row.onTimePct >= 90 ? 'text-green-600' : row.onTimePct >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                            {row.onTimePct}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.avgDefectRate !== null ? (
                          <span className={row.avgDefectRate < 1 ? 'text-green-600' : row.avgDefectRate < 5 ? 'text-yellow-600' : 'text-red-600'}>
                            {row.avgDefectRate}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(row.totalAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        {gradeColor && row.grade ? (
                          <Badge className={`${gradeColor} border-0 text-xs`}>{gradeLabels[row.grade]}</Badge>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        {row.score !== null ? (
                          <span className={row.score >= 90 ? 'text-green-600' : row.score >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                            {row.score}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Radar chart */}
          <div className="bg-white border rounded-xl p-4">
            {selected ? (
              <>
                <div className="font-semibold text-sm mb-1">{selected.name}</div>
                <div className="text-xs text-gray-400 mb-3">
                  {selected.orderCount} {dict.supplierPerformance.ordersUnit}・{fmt(selected.totalAmount)}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <Radar dataKey="value" fill="#3b82f6" fillOpacity={0.3} stroke="#3b82f6" />
                    <Tooltip formatter={(v: unknown) => typeof v === 'number' ? v.toFixed(1) : String(v ?? '')} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{dict.supplierPerformance.onTimeDelivery}</span>
                    <span className="font-medium">{selected.onTimeCount}{dict.supplierPerformance.onTimeUnit} / {dict.supplierPerformance.latePrefix}{selected.lateCount}{dict.supplierPerformance.onTimeUnit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{dict.supplierPerformance.avgDefectRate}</span>
                    <span className="font-medium">{selected.avgDefectRate !== null ? `${selected.avgDefectRate}%` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{dict.supplierPerformance.noReceiptOrders}</span>
                    <span className={`font-medium ${selected.noReceiptCount > 0 ? 'text-orange-600' : ''}`}>{selected.noReceiptCount} {dict.supplierPerformance.countUnit}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                <Star size={32} className="mb-2 opacity-30" />
                <p className="text-sm">{dict.supplierPerformance.radarPrompt.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br/>}</span>)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!searched && (
        <div className="py-20 text-center text-gray-400">
          <Star size={40} className="mx-auto mb-3 opacity-30" />
          <p>{dict.supplierPerformance.promptText}</p>
        </div>
      )}
    </div>
  )
}
