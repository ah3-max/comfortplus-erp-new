'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n/context'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { RefreshCw, Truck } from 'lucide-react'
import { toast } from 'sonner'

type ViewKey = 'monthly' | 'provider' | 'customer'

interface MonthlyRow {
  month: string; total: number; onTime: number; late: number; noData: number
  onTimePct: number | null; avgDelayDays: number; anomalies: number
}
interface ProviderRow {
  providerId: string; name: string
  total: number; onTime: number; late: number; noData: number
  onTimePct: number | null; avgDelayDays: number; anomalies: number; totalFreight: number
}
interface CustomerRow {
  customerId: string; name: string
  total: number; onTime: number; late: number; noData: number
  onTimePct: number | null; avgDelayDays: number
}

function OnTimeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-400 text-sm">-</span>
  const color = pct >= 95 ? 'text-emerald-600' : pct >= 85 ? 'text-yellow-600' : 'text-red-600'
  const bg = pct >= 95 ? 'bg-emerald-50' : pct >= 85 ? 'bg-yellow-50' : 'bg-red-50'
  return <span className={`px-2 py-0.5 rounded text-sm font-medium ${color} ${bg}`}>{pct}%</span>
}

export default function DeliveryPerformancePage() {
  const { dict } = useI18n()
  const now = new Date()
  const [view, setView] = useState<ViewKey>('monthly')
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const query = useCallback(async () => {
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams({ view, startDate, endDate })
      const res = await fetch(`/api/logistics/delivery-performance?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (view === 'monthly') setMonthly(json.data ?? [])
      if (view === 'provider') setProviders(json.data ?? [])
      if (view === 'customer') setCustomers(json.data ?? [])
    } catch { toast.error(dict.common.queryFailed) }
    finally { setLoading(false) }
  }, [view, startDate, endDate])

  // Monthly overall stats
  const totalShipments = monthly.reduce((s, r) => s + r.total, 0)
  const totalOnTime = monthly.reduce((s, r) => s + r.onTime, 0)
  const totalEval = monthly.reduce((s, r) => s + r.onTime + r.late, 0)
  const overallOnTimePct = totalEval > 0 ? Math.round(totalOnTime / totalEval * 1000) / 10 : null

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{dict.nav?.deliveryPerformance ?? '出貨準時率分析'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">分析出貨準時率、平均延誤天數、物流商表現</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">分析維度</div>
          <Select value={view} onValueChange={v => { if (v) setView(v as ViewKey) }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">月度趨勢</SelectItem>
              <SelectItem value="provider">物流商分析</SelectItem>
              <SelectItem value="customer">客戶分析</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">期間起</div>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-36" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">期間迄</div>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-36" />
        </div>
        <Button onClick={query} disabled={loading} className="gap-1.5 h-9">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? '查詢中…' : '查詢'}
        </Button>
      </div>

      {/* ── Monthly view ── */}
      {searched && view === 'monthly' && (
        <div className="space-y-4">
          {monthly.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">期間出貨量</div>
                <div className="text-2xl font-bold">{totalShipments}</div>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">整體準時率</div>
                <div className="text-2xl font-bold">{overallOnTimePct != null ? `${overallOnTimePct}%` : '-'}</div>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">準時出貨</div>
                <div className="text-2xl font-bold text-emerald-600">{totalOnTime}</div>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">延誤出貨</div>
                <div className="text-2xl font-bold text-red-600">{totalEval - totalOnTime}</div>
              </div>
            </div>
          )}
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">月度準時率趨勢</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip formatter={(v: unknown) => [`${v}%`, '準時率']} />
                <Line dataKey="onTimePct" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="準時率" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">月度準時 vs 延誤出貨量</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="onTime" fill="#10b981" name="準時" stackId="a" />
                <Bar dataKey="late" fill="#ef4444" name="延誤" stackId="a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">月份</th>
                <th className="px-4 py-3 text-right">出貨量</th>
                <th className="px-4 py-3 text-right">準時</th>
                <th className="px-4 py-3 text-right">延誤</th>
                <th className="px-4 py-3 text-right">準時率</th>
                <th className="px-4 py-3 text-right">平均延誤</th>
                <th className="px-4 py-3 text-right">異常件</th>
              </tr></thead>
              <tbody>
                {monthly.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">無資料</td></tr>
                ) : monthly.map(row => (
                  <tr key={row.month} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">{row.month}</td>
                    <td className="px-4 py-3 text-right">{row.total}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{row.onTime}</td>
                    <td className="px-4 py-3 text-right text-red-500">{row.late}</td>
                    <td className="px-4 py-3 text-right"><OnTimeBadge pct={row.onTimePct} /></td>
                    <td className="px-4 py-3 text-right text-gray-500">{row.avgDelayDays > 0 ? `+${row.avgDelayDays}天` : '-'}</td>
                    <td className="px-4 py-3 text-right">{row.anomalies > 0 ? <span className="text-orange-500">{row.anomalies}</span> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Provider view ── */}
      {searched && view === 'provider' && (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-3 text-left">物流商</th>
              <th className="px-4 py-3 text-right">出貨量</th>
              <th className="px-4 py-3 text-right">準時</th>
              <th className="px-4 py-3 text-right">延誤</th>
              <th className="px-4 py-3 text-right">準時率</th>
              <th className="px-4 py-3 text-right">平均延誤</th>
              <th className="px-4 py-3 text-right">異常件</th>
              <th className="px-4 py-3 text-right">物流費用</th>
            </tr></thead>
            <tbody>
              {providers.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-gray-400">無資料</td></tr>
              ) : providers.map(row => (
                <tr key={row.providerId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-right">{row.total}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{row.onTime}</td>
                  <td className="px-4 py-3 text-right text-red-500">{row.late}</td>
                  <td className="px-4 py-3 text-right"><OnTimeBadge pct={row.onTimePct} /></td>
                  <td className="px-4 py-3 text-right text-gray-500">{row.avgDelayDays > 0 ? `+${row.avgDelayDays}天` : '-'}</td>
                  <td className="px-4 py-3 text-right">{row.anomalies > 0 ? <span className="text-orange-500">{row.anomalies}</span> : '-'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(row.totalFreight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Customer view ── */}
      {searched && view === 'customer' && (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-3 text-left">客戶</th>
              <th className="px-4 py-3 text-right">出貨量</th>
              <th className="px-4 py-3 text-right">準時</th>
              <th className="px-4 py-3 text-right">延誤</th>
              <th className="px-4 py-3 text-right">準時率</th>
              <th className="px-4 py-3 text-right">平均延誤</th>
            </tr></thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">無資料</td></tr>
              ) : customers.map(row => (
                <tr key={row.customerId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-right">{row.total}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{row.onTime}</td>
                  <td className="px-4 py-3 text-right text-red-500">{row.late}</td>
                  <td className="px-4 py-3 text-right"><OnTimeBadge pct={row.onTimePct} /></td>
                  <td className="px-4 py-3 text-right text-gray-500">{row.avgDelayDays > 0 ? `+${row.avgDelayDays}天` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!searched && (
        <div className="py-20 text-center text-gray-400">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p>請選擇維度與期間後按「查詢」</p>
        </div>
      )}
    </div>
  )
}
