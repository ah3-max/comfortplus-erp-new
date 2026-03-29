'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n/context'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

type ViewKey = 'monthly' | 'product' | 'customer' | 'reason'

interface MonthlyRow {
  month: string; returnCount: number; returnQty: number; refundAmount: number
  salesCount: number; salesRevenue: number; returnRatePct: number; refundRatePct: number
}
interface ProductRow { productId: string; name: string; sku: string; qty: number; returnCount: number; salesQty: number; returnRatePct: number }
interface CustomerRow { customerId: string; name: string; returnCount: number; returnQty: number; refundAmount: number }
interface ReasonRow { reason: string; count: number; qty: number; refundAmount: number; pct: number }

const PIE_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function ReturnAnalysisPage() {
  const { dict } = useI18n()
  const now = new Date()
  const [view, setView] = useState<ViewKey>('monthly')
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [reasons, setReasons] = useState<ReasonRow[]>([])

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const query = useCallback(async () => {
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams({ view, startDate, endDate })
      const res = await fetch(`/api/sales-returns/analysis?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (view === 'monthly') setMonthly(json.data ?? [])
      if (view === 'product') setProducts(json.data ?? [])
      if (view === 'customer') setCustomers(json.data ?? [])
      if (view === 'reason') setReasons(json.data ?? [])
    } catch { toast.error(dict.common.queryFailed) }
    finally { setLoading(false) }
  }, [view, startDate, endDate])

  const tooltipFmt = (v: unknown) => typeof v === 'number' ? fmt(v) : String(v ?? '')

  // Monthly totals
  const totalReturns = monthly.reduce((s, r) => s + r.returnCount, 0)
  const totalRefund = monthly.reduce((s, r) => s + r.refundAmount, 0)
  const avgReturnRate = monthly.length > 0
    ? Math.round(monthly.reduce((s, r) => s + r.returnRatePct, 0) / monthly.filter(r => r.salesCount > 0).length * 10) / 10 : 0

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{dict.nav?.returnAnalysis ?? '銷售退貨率分析'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">退貨率月度趨勢、高退貨品項/客戶、退貨原因分析</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">分析維度</div>
          <Select value={view} onValueChange={v => { if (v) setView(v as ViewKey) }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">月度趨勢</SelectItem>
              <SelectItem value="product">品項分析</SelectItem>
              <SelectItem value="customer">客戶分析</SelectItem>
              <SelectItem value="reason">原因分析</SelectItem>
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
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">期間退貨件數</div>
                <div className="text-2xl font-bold text-red-600">{totalReturns}</div>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">退款總額</div>
                <div className="text-2xl font-bold text-red-600">{fmt(totalRefund)}</div>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">平均退貨率</div>
                <div className="text-2xl font-bold">{avgReturnRate}%</div>
              </div>
            </div>
          )}
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">月度退貨率趨勢</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                <Tooltip formatter={(v: unknown) => [`${v}%`, '退貨率']} />
                <Line dataKey="returnRatePct" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="退貨率" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">月度退款金額</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={tooltipFmt} />
                <Bar dataKey="refundAmount" fill="#ef4444" name="退款金額" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">月份</th>
                <th className="px-4 py-3 text-right">出貨筆數</th>
                <th className="px-4 py-3 text-right">退貨件數</th>
                <th className="px-4 py-3 text-right">退貨率</th>
                <th className="px-4 py-3 text-right">退款金額</th>
                <th className="px-4 py-3 text-right">退款率</th>
              </tr></thead>
              <tbody>
                {monthly.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">無資料</td></tr>
                ) : monthly.map(row => (
                  <tr key={row.month} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">{row.month}</td>
                    <td className="px-4 py-3 text-right">{row.salesCount}</td>
                    <td className="px-4 py-3 text-right text-red-500">{row.returnCount}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      <span className={row.returnRatePct >= 5 ? 'text-red-600' : row.returnRatePct >= 2 ? 'text-yellow-600' : 'text-emerald-600'}>
                        {row.returnRatePct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-500">{fmt(row.refundAmount)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{row.refundRatePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Product view ── */}
      {searched && view === 'product' && (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-3 text-left">品項</th>
              <th className="px-4 py-3 text-right">銷售量</th>
              <th className="px-4 py-3 text-right">退貨量</th>
              <th className="px-4 py-3 text-right">退貨率</th>
              <th className="px-4 py-3 text-right">退貨件數</th>
            </tr></thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">無資料</td></tr>
              ) : products.map(row => (
                <tr key={row.productId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{row.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.salesQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-500">{row.qty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    <span className={row.returnRatePct >= 5 ? 'text-red-600' : row.returnRatePct >= 2 ? 'text-yellow-600' : 'text-emerald-600'}>
                      {row.returnRatePct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{row.returnCount}</td>
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
              <th className="px-4 py-3 text-right">退貨件數</th>
              <th className="px-4 py-3 text-right">退貨數量</th>
              <th className="px-4 py-3 text-right">退款金額</th>
            </tr></thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">無資料</td></tr>
              ) : customers.map(row => (
                <tr key={row.customerId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-right text-red-500">{row.returnCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.returnQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(row.refundAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Reason view ── */}
      {searched && view === 'reason' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">退貨原因占比</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={reasons} dataKey="count" nameKey="reason" outerRadius={100}
                  label={(props) => {
                    const pct = (props as unknown as { pct?: number }).pct
                    return pct !== undefined ? `${pct}%` : ''
                  }}>
                  {reasons.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">原因</th>
                <th className="px-4 py-3 text-right">件數</th>
                <th className="px-4 py-3 text-right">數量</th>
                <th className="px-4 py-3 text-right">退款</th>
                <th className="px-4 py-3 text-right">占比</th>
              </tr></thead>
              <tbody>
                {reasons.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">無資料</td></tr>
                ) : reasons.map((row, i) => (
                  <tr key={row.reason} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {row.reason}
                    </td>
                    <td className="px-4 py-3 text-right">{row.count}</td>
                    <td className="px-4 py-3 text-right">{row.qty}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(row.refundAmount)}</td>
                    <td className="px-4 py-3 text-right font-medium">{row.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!searched && (
        <div className="py-20 text-center text-gray-400">
          <RotateCcw size={40} className="mx-auto mb-3 opacity-30" />
          <p>請選擇維度與期間後按「查詢」</p>
        </div>
      )}
    </div>
  )
}
