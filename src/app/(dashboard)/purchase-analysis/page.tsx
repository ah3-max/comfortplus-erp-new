'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n/context'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { RefreshCw, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'

type ViewKey = 'monthly' | 'supplier' | 'product'

interface MonthlyRow { month: string; count: number; totalAmount: number; subtotal: number; tax: number }
interface SupplierRow { supplierId: string; name: string; country: string | null; count: number; totalAmount: number; sharePct: number }
interface ProductRow { productId: string; name: string; sku: string; qty: number; subtotal: number; avgCost: number; orderCount: number }

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16']

export default function PurchaseAnalysisPage() {
  const { dict } = useI18n()
  const now = new Date()
  const [view, setView] = useState<ViewKey>('monthly')
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [total, setTotal] = useState(0)

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const query = useCallback(async () => {
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams({ view, startDate, endDate })
      const res = await fetch(`/api/finance/purchase-analysis?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (view === 'monthly') setMonthly(json.data ?? [])
      if (view === 'supplier') { setSuppliers(json.data ?? []); setTotal(json.total ?? 0) }
      if (view === 'product') setProducts(json.data ?? [])
    } catch { toast.error(dict.common.queryFailed) }
    finally { setLoading(false) }
  }, [view, startDate, endDate])

  useEffect(() => { query() }, [query])

  const tooltipFmt = (v: unknown) => typeof v === 'number' ? fmt(v) : String(v ?? '')

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{dict.purchaseAnalysis.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{dict.purchaseAnalysis.subtitle}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">{dict.purchaseAnalysis.dimLabel}</div>
          <Select value={view} onValueChange={v => { if (v) setView(v as ViewKey) }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">{dict.purchaseAnalysis.viewMonthly}</SelectItem>
              <SelectItem value="supplier">{dict.purchaseAnalysis.viewSupplier}</SelectItem>
              <SelectItem value="product">{dict.purchaseAnalysis.viewProduct}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">{dict.purchaseAnalysis.periodFrom}</div>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-36" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">{dict.purchaseAnalysis.periodTo}</div>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-36" />
        </div>
        <Button onClick={query} disabled={loading} className="gap-1.5 h-9">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? dict.purchaseAnalysis.querying : dict.purchaseAnalysis.query}
        </Button>
      </div>

      {/* ── Monthly view ── */}
      {searched && view === 'monthly' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">{dict.purchaseAnalysis.monthlyChartTitle}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={tooltipFmt} />
                <Bar dataKey="totalAmount" fill="#3b82f6" name={dict.purchaseAnalysis.colPurchaseAmount} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">{dict.purchaseAnalysis.colMonth}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colOrderCount}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colSubtotal}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colTax}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colTotal}</th>
              </tr></thead>
              <tbody>
                {monthly.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">{dict.purchaseAnalysis.noData}</td></tr>
                ) : monthly.map(row => (
                  <tr key={row.month} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">{row.month}</td>
                    <td className="px-4 py-3 text-right">{row.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(row.subtotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{fmt(row.tax)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(row.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Supplier view ── */}
      {searched && view === 'supplier' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">{dict.purchaseAnalysis.supplierChartTitle}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={suppliers.slice(0, 8)} dataKey="totalAmount" nameKey="name" outerRadius={100} label={(props) => { const pct = (props as unknown as { sharePct?: number }).sharePct; return pct !== undefined ? `${pct}%` : '' }}>
                  {suppliers.slice(0, 8).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={tooltipFmt} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">{dict.purchaseAnalysis.colSupplier}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colOrderCount}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colPurchaseAmount}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colSharePct}</th>
              </tr></thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400">{dict.purchaseAnalysis.noData}</td></tr>
                ) : suppliers.map((row, i) => (
                  <tr key={row.supplierId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-medium">{row.name}</span>
                      </div>
                      {row.country && <div className="text-xs text-gray-400 ml-5">{row.country}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">{row.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(row.totalAmount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{row.sharePct}%</td>
                  </tr>
                ))}
              </tbody>
              {total > 0 && (
                <tfoot><tr className="border-t bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-xs text-gray-500" colSpan={2}>{dict.purchaseAnalysis.colGrandTotal}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(total)}</td>
                  <td className="px-4 py-2 text-right">100%</td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Product view ── */}
      {searched && view === 'product' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">{dict.purchaseAnalysis.productChartTitle}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={products.slice(0, 15)} layout="vertical" margin={{ left: 140, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip formatter={tooltipFmt} />
                <Bar dataKey="subtotal" fill="#10b981" name={dict.purchaseAnalysis.colPurchaseAmount} radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">{dict.purchaseAnalysis.colProduct}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colQty}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colPurchaseAmount}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colAvgCost}</th>
                <th className="px-4 py-3 text-right">{dict.purchaseAnalysis.colOrderCount}</th>
              </tr></thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">{dict.purchaseAnalysis.noData}</td></tr>
                ) : products.map(row => (
                  <tr key={row.productId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{row.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(row.subtotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(row.avgCost)}</td>
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
          <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
          <p>{dict.purchaseAnalysis.promptText}</p>
        </div>
      )}
    </div>
  )
}
