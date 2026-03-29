'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { TrendingUp, Package, Users, CheckCircle2, AlertTriangle } from 'lucide-react'

interface MonthlyRow { month: string; ordered: number; shipped: number; rate: number }
interface ProductRow { productId: string; name: string; sku: string; ordered: number; shipped: number; rate: number }
interface CustomerRow { customerId: string; name: string; ordered: number; shipped: number; orders: number; rate: number }

type View = 'monthly' | 'product' | 'customer'

export default function FulfillmentRatePage() {
  const { dict } = useI18n()
  const fr = dict.fulfillmentRate
  const [view, setView] = useState<View>('monthly')
  const [from, setFrom] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (v: View) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales/fulfillment-rate?view=${v}&from=${from}&to=${to}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (v === 'monthly') setMonthly(data)
      else if (v === 'product') setProducts(data)
      else setCustomers(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { load(view) }, [load, view])

  const avgRate = monthly.length > 0
    ? Math.round(monthly.reduce((s, r) => s + r.rate, 0) / monthly.length * 10) / 10
    : 0

  const rateColor = (r: number) => r >= 95 ? '#10b981' : r >= 85 ? '#f59e0b' : '#ef4444'

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{fr.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{fr.subtitle}</p>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <div className="text-xs text-gray-500 mb-1">{fr.startDate}</div>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm h-9" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">{fr.endDate}</div>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm h-9" />
        </div>
        <div className="flex gap-2">
          {(['monthly', 'product', 'customer'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded text-sm h-9 ${view === v ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}`}>
              {v === 'monthly' ? fr.viewMonthly : v === 'product' ? fr.viewProduct : fr.viewCustomer}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards (monthly view only) */}
      {view === 'monthly' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={14} className="text-blue-500" />
              <span className="text-xs text-gray-400">{fr.avgRate}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: rateColor(avgRate) }}>{avgRate}%</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">{fr.totalOrdered}</div>
            <div className="text-2xl font-bold">{monthly.reduce((s, r) => s + r.ordered, 0).toLocaleString()}</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span className="text-xs text-gray-400">{fr.totalShipped}</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600">{monthly.reduce((s, r) => s + r.shipped, 0).toLocaleString()}</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-xs text-gray-400">{fr.totalUnshipped}</span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {(monthly.reduce((s, r) => s + r.ordered, 0) - monthly.reduce((s, r) => s + r.shipped, 0)).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border rounded-xl py-16 text-center text-gray-400">{dict.common.loading}</div>
      ) : view === 'monthly' ? (
        <div className="space-y-4">
          {/* Line Chart - Rate Trend */}
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm font-medium mb-3">{fr.rateTrend}</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [`${v}%`, fr.colRate]} />
                <ReferenceLine y={95} stroke="#10b981" strokeDasharray="4 4" label={{ value: '95%', position: 'right', fontSize: 10 }} />
                <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '85%', position: 'right', fontSize: 10 }} />
                <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stacked Bar - Ordered vs Shipped */}
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm font-medium mb-3">{fr.orderedVsShipped}</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="shipped" name={fr.totalShipped} fill="#10b981" stackId="a" />
                <Bar dataKey="ordered" name={fr.totalUnshipped} fill="#fee2e2"
                  stackId="b"
                  label={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : view === 'product' ? (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2">
            <Package size={16} className="text-gray-400" />
            <span className="text-sm font-medium">{fr.productRateTitle}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[fr.colProductName, fr.colSku, fr.colOrdered, fr.colShipped, fr.colUnshipped, fr.colRate].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.productId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{p.sku || '-'}</td>
                    <td className="px-4 py-2.5">{p.ordered.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-emerald-600">{p.shipped.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-red-500">{(p.ordered - p.shipped).toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[80px]">
                          <div className="h-2 rounded-full" style={{ width: `${Math.min(p.rate, 100)}%`, backgroundColor: rateColor(p.rate) }} />
                        </div>
                        <span className="font-bold text-xs" style={{ color: rateColor(p.rate) }}>{p.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">{fr.noData}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2">
            <Users size={16} className="text-gray-400" />
            <span className="text-sm font-medium">{fr.customerRateTitle}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[fr.colCustomer, fr.colOrders, fr.colOrdered, fr.colShipped, fr.colUnshipped, fr.colRate].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.customerId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{c.orders}</td>
                    <td className="px-4 py-2.5">{c.ordered.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-emerald-600">{c.shipped.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-red-500">{(c.ordered - c.shipped).toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[80px]">
                          <div className="h-2 rounded-full" style={{ width: `${Math.min(c.rate, 100)}%`, backgroundColor: rateColor(c.rate) }} />
                        </div>
                        <span className="font-bold text-xs" style={{ color: rateColor(c.rate) }}>{c.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">{fr.noData}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
