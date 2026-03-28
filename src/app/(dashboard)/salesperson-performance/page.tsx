'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n/context'
import { RefreshCw, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

interface SalespersonRow {
  userId: string; name: string; role: string
  orderCount: number; revenue: number; grossProfit: number; grossMarginPct: number
  activeCustomers: number; newCustomers: number; avgOrderValue: number
  visitCount: number
  revenueTarget: number; achieveRate: number | null
  orderTarget: number | null; visitTarget: number | null; newCustTarget: number | null
}

interface Summary { totalRevenue: number; totalOrders: number; totalGP: number; periodStart: string; periodEnd: string }

function AchieveBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-gray-400 text-sm">-</span>
  const color = rate >= 100 ? 'text-emerald-600 bg-emerald-50' : rate >= 80 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
  return <span className={`px-2 py-0.5 rounded text-sm font-semibold ${color}`}>{rate}%</span>
}

export default function SalespersonPerformancePage() {
  const { dict } = useI18n()
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(defaultMonth)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [data, setData] = useState<SalespersonRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [selected, setSelected] = useState<SalespersonRow | null>(null)

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const query = useCallback(async () => {
    setLoading(true); setSearched(true)
    try {
      const res = await fetch(`/api/sales/salesperson-performance?month=${month}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data ?? [])
      setSummary(json.summary ?? null)
      setSelected(null)
    } catch { toast.error('查詢失敗') }
    finally { setLoading(false) }
  }, [month])

  // Radar data for selected person
  const radarData = selected ? [
    { subject: '達成率', value: Math.min(selected.achieveRate ?? 0, 120) },
    { subject: '毛利率', value: selected.grossMarginPct },
    { subject: '拜訪次數', value: selected.visitTarget ? Math.min(selected.visitCount / selected.visitTarget * 100, 120) : selected.visitCount * 5 },
    { subject: '新客戶', value: selected.newCustTarget ? Math.min(selected.newCustomers / selected.newCustTarget * 100, 120) : selected.newCustomers * 20 },
    { subject: '訂單數', value: selected.orderTarget ? Math.min(selected.orderCount / selected.orderTarget * 100, 120) : selected.orderCount * 5 },
  ] : []

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{dict.nav?.salespersonPerformance ?? '業務員業績比較'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">各業務月度銷售達成率、毛利貢獻、客戶開發比較</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">分析月份</div>
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-9 w-36" />
        </div>
        <Button onClick={query} disabled={loading} className="gap-1.5 h-9">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? '查詢中…' : '查詢'}
        </Button>
      </div>

      {searched && (
        <>
          {/* Summary KPIs */}
          {summary && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">期間總銷售</div>
                <div className="text-xl font-bold">{fmt(summary.totalRevenue)}</div>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">總訂單數</div>
                <div className="text-xl font-bold">{summary.totalOrders}</div>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">總毛利</div>
                <div className="text-xl font-bold text-emerald-600">{fmt(summary.totalGP)}</div>
              </div>
            </div>
          )}

          {/* Revenue comparison chart */}
          {data.length > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-sm">業務員銷售額比較</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmt(v) : String(v ?? '')} />
                  <Legend />
                  <Bar dataKey="revenueTarget" fill="#e5e7eb" name="目標" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="revenue" fill="#3b82f6" name="實際" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* Table */}
            <div className="rounded-xl border bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="px-4 py-3 text-left">業務員</th>
                  <th className="px-4 py-3 text-right">銷售額</th>
                  <th className="px-4 py-3 text-right">毛利率</th>
                  <th className="px-4 py-3 text-right">訂單</th>
                  <th className="px-4 py-3 text-right">新客</th>
                  <th className="px-4 py-3 text-right">達成率</th>
                </tr></thead>
                <tbody>
                  {data.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400">無資料</td></tr>
                  ) : data.map(row => (
                    <tr key={row.userId}
                      className={`border-b last:border-0 hover:bg-gray-50 cursor-pointer ${selected?.userId === row.userId ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelected(selected?.userId === row.userId ? null : row)}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-gray-400">{row.role}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(row.revenue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={row.grossMarginPct >= 20 ? 'text-emerald-600' : row.grossMarginPct >= 10 ? 'text-yellow-600' : 'text-red-500'}>
                          {row.grossMarginPct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{row.orderCount}</td>
                      <td className="px-4 py-3 text-right">{row.newCustomers}</td>
                      <td className="px-4 py-3 text-right"><AchieveBadge rate={row.achieveRate} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Radar chart for selected */}
            <div className="bg-white border rounded-xl p-4">
              {selected ? (
                <>
                  <h3 className="font-semibold mb-1 text-sm">{selected.name} — 五維雷達</h3>
                  <div className="text-xs text-gray-400 mb-3">各項指標達成率（%）</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">平均客單</div>
                      <div className="font-semibold">{fmt(selected.avgOrderValue)}</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">服務客戶數</div>
                      <div className="font-semibold">{selected.activeCustomers}</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">拜訪 / 目標</div>
                      <div className="font-semibold">{selected.visitCount} / {selected.visitTarget ?? '-'}</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">毛利額</div>
                      <div className="font-semibold text-emerald-600">{fmt(selected.grossProfit)}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm py-16">
                  點選左側業務員查看五維雷達
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!searched && (
        <div className="py-20 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>請選擇月份後按「查詢」</p>
        </div>
      )}
    </div>
  )
}
