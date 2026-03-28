'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n/context'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { RefreshCw, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

type ViewKey = 'monthly' | 'customer' | 'product'

interface MonthlyRow {
  month: string; count: number
  revenue: number; cogs: number; grossProfit: number; grossMarginPct: number
}
interface CustomerRow {
  customerId: string; name: string; type: string
  count: number; revenue: number; cogs: number; grossProfit: number; grossMarginPct: number
}
interface ProductRow {
  productId: string; name: string; sku: string
  qty: number; revenue: number; grossProfit: number; grossMarginPct: number; orderCount: number
}

function MarginBar({ pct }: { pct: number }) {
  const color = pct >= 30 ? 'bg-emerald-500' : pct >= 15 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
      </div>
      <span className={`text-sm font-medium ${pct >= 30 ? 'text-emerald-600' : pct >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
        {pct}%
      </span>
    </div>
  )
}

export default function GrossMarginPage() {
  const { dict } = useI18n()
  const now = new Date()
  const [view, setView] = useState<ViewKey>('monthly')
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
  const tooltipFmt = (v: unknown) => typeof v === 'number' ? fmt(v) : String(v ?? '')

  const query = useCallback(async () => {
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams({ view, startDate, endDate })
      const res = await fetch(`/api/finance/gross-margin?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (view === 'monthly') setMonthly(json.data ?? [])
      if (view === 'customer') setCustomers(json.data ?? [])
      if (view === 'product') setProducts(json.data ?? [])
    } catch { toast.error('查詢失敗') }
    finally { setLoading(false) }
  }, [view, startDate, endDate])

  // Summary for monthly view
  const totalRevenue = monthly.reduce((s, r) => s + r.revenue, 0)
  const totalGP = monthly.reduce((s, r) => s + r.grossProfit, 0)
  const avgMarginPct = totalRevenue > 0 ? Math.round(totalGP / totalRevenue * 1000) / 10 : 0

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{dict.nav?.grossMargin ?? '毛利分析'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">月度毛利趨勢、客戶毛利貢獻、品項毛利率分析</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">分析維度</div>
          <Select value={view} onValueChange={v => { if (v) setView(v as ViewKey) }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">月度趨勢</SelectItem>
              <SelectItem value="customer">客戶分析</SelectItem>
              <SelectItem value="product">品項分析</SelectItem>
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
          {/* KPI cards */}
          {monthly.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">期間銷售額</div>
                <div className="text-xl font-bold">{fmt(totalRevenue)}</div>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">期間毛利額</div>
                <div className="text-xl font-bold text-emerald-600">{fmt(totalGP)}</div>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">平均毛利率</div>
                <div className="text-xl font-bold">{avgMarginPct}%</div>
              </div>
            </div>
          )}

          {/* Stacked bar: revenue + COGS */}
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">月度銷售額 vs 毛利額</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={tooltipFmt} />
                <Legend />
                <Bar dataKey="revenue" fill="#93c5fd" name="銷售額" radius={[3, 3, 0, 0]} />
                <Bar dataKey="grossProfit" fill="#10b981" name="毛利額" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Margin % line chart */}
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">月度毛利率趨勢</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip formatter={(v: unknown) => [`${v}%`, '毛利率']} />
                <Line dataKey="grossMarginPct" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="毛利率" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">月份</th>
                <th className="px-4 py-3 text-right">訂單數</th>
                <th className="px-4 py-3 text-right">銷售額</th>
                <th className="px-4 py-3 text-right">銷貨成本</th>
                <th className="px-4 py-3 text-right">毛利額</th>
                <th className="px-4 py-3 text-left">毛利率</th>
              </tr></thead>
              <tbody>
                {monthly.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">無資料</td></tr>
                ) : monthly.map(row => (
                  <tr key={row.month} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">{row.month}</td>
                    <td className="px-4 py-3 text-right">{row.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(row.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{fmt(row.cogs)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{fmt(row.grossProfit)}</td>
                    <td className="px-4 py-3"><MarginBar pct={row.grossMarginPct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Customer view ── */}
      {searched && view === 'customer' && (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-3 text-left">客戶</th>
              <th className="px-4 py-3 text-right">訂單數</th>
              <th className="px-4 py-3 text-right">銷售額</th>
              <th className="px-4 py-3 text-right">毛利額</th>
              <th className="px-4 py-3 text-left w-40">毛利率</th>
            </tr></thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">無資料</td></tr>
              ) : customers.map(row => (
                <tr key={row.customerId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-gray-400">{row.type}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{row.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(row.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{fmt(row.grossProfit)}</td>
                  <td className="px-4 py-3"><MarginBar pct={row.grossMarginPct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Product view ── */}
      {searched && view === 'product' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">品項毛利率排行</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={products.slice(0, 15)} layout="vertical" margin={{ left: 140, right: 40, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip formatter={(v: unknown) => [`${v}%`, '毛利率']} />
                <Bar dataKey="grossMarginPct" fill="#8b5cf6" name="毛利率" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">品項</th>
                <th className="px-4 py-3 text-right">銷售量</th>
                <th className="px-4 py-3 text-right">銷售額</th>
                <th className="px-4 py-3 text-right">毛利額</th>
                <th className="px-4 py-3 text-left w-40">毛利率</th>
                <th className="px-4 py-3 text-right">訂單數</th>
              </tr></thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">無資料</td></tr>
                ) : products.map(row => (
                  <tr key={row.productId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{row.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(row.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{fmt(row.grossProfit)}</td>
                    <td className="px-4 py-3"><MarginBar pct={row.grossMarginPct} /></td>
                    <td className="px-4 py-3 text-right">{row.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!searched && (
        <div className="py-20 text-center text-gray-400">
          <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
          <p>請選擇維度與期間後按「查詢」</p>
        </div>
      )}
    </div>
  )
}
