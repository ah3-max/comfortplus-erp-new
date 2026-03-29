'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n/context'
import { RefreshCw, TrendingUp, TrendingDown, Users, Package, UserCheck, BarChart3 } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const fmt = (v: number) =>
  v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` :
  v >= 1000 ? `${(v / 1000).toFixed(0)}K` :
  v.toFixed(0)

const fmtFull = (v: number) =>
  v.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const pct = (v: number) => `${v.toFixed(1)}%`

interface MonthRow {
  month: number
  revenue: number
  cost: number
  grossProfit: number
  netProfit: number
  orderCount: number
  grossMarginPct: number
}
interface CustomerRow {
  customerId: string
  customerName: string
  customerCode: string
  customerType: string
  revenue: number
  grossProfit: number
  netProfit: number
  orderCount: number
  grossMarginPct: number
}
interface SalesRow {
  salesId: string
  salesName: string
  revenue: number
  grossProfit: number
  netProfit: number
  orderCount: number
  grossMarginPct: number
}
interface ProductRow {
  productId: string
  productName: string
  sku: string
  unit: string
  revenue: number
  estimatedCost: number
  estimatedGrossProfit: number
  quantity: number
  grossMarginPct: number
}
interface Summary {
  totalRevenue: number
  totalCost: number
  totalGrossProfit: number
  totalNetProfit: number
  avgGrossMarginPct: number
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ProfitPage() {
  const { dict } = useI18n()
  const pp = dict.profitPage

  const TABS = [
    { key: 'monthly',     label: pp.tabMonthly,     icon: BarChart3 },
    { key: 'customer',    label: pp.tabCustomer,     icon: Users },
    { key: 'product',     label: pp.tabProduct,      icon: Package },
    { key: 'salesperson', label: pp.tabSalesperson,  icon: UserCheck },
  ]
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const canView = ['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER'].includes(role)

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [activeTab, setActiveTab] = useState('monthly')
  const [loading, setLoading] = useState(false)

  const [monthlyData, setMonthlyData] = useState<{ rows: MonthRow[]; summary: Summary } | null>(null)
  const [customerData, setCustomerData] = useState<CustomerRow[]>([])
  const [salesData, setSalesData] = useState<SalesRow[]>([])
  const [productData, setProductData] = useState<ProductRow[]>([])

  const fetchData = useCallback(async (tab: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/profit?view=${tab}&year=${year}`)
      const json = await res.json()
      if (tab === 'monthly') setMonthlyData(json)
      else if (tab === 'customer') setCustomerData(json.rows ?? [])
      else if (tab === 'salesperson') setSalesData(json.rows ?? [])
      else if (tab === 'product') setProductData(json.rows ?? [])
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { fetchData(activeTab) }, [fetchData, activeTab])

  if (!canView) {
    return <div className="p-8 text-center text-muted-foreground">{pp.insufficientPermission}</div>
  }

  const summary = monthlyData?.summary
  const chartData = (monthlyData?.rows ?? []).map(r => ({
    name: MONTH_NAMES[r.month - 1],
    revenue: r.revenue,
    grossProfit: r.grossProfit,
    netProfit: r.netProfit,
    margin: r.grossMarginPct,
  }))

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold">{dict.nav.profit}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{pp.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={v => { if (v) setYear(v) }}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchData(activeTab)}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards — only show when monthly tab */}
      {activeTab === 'monthly' && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="border rounded-lg p-3 bg-card">
            <div className="text-xs text-muted-foreground">{pp.yearlyRevenue}</div>
            <div className="text-xl font-bold mt-1">{fmt(summary.totalRevenue)}</div>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <div className="text-xs text-muted-foreground">{pp.grossProfit}</div>
            <div className="text-xl font-bold mt-1 text-green-700">{fmt(summary.totalGrossProfit)}</div>
            <div className="text-xs text-muted-foreground">{pct(summary.avgGrossMarginPct)}</div>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <div className="text-xs text-muted-foreground">{pp.netProfit}</div>
            <div className={`text-xl font-bold mt-1 ${summary.totalNetProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {summary.totalNetProfit >= 0
                ? <span className="flex items-center gap-1"><TrendingUp className="w-4 h-4" />{fmt(summary.totalNetProfit)}</span>
                : <span className="flex items-center gap-1"><TrendingDown className="w-4 h-4" />{fmt(Math.abs(summary.totalNetProfit))}</span>}
            </div>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <div className="text-xs text-muted-foreground">{pp.cogs}</div>
            <div className="text-xl font-bold mt-1 text-orange-600">{fmt(summary.totalCost)}</div>
            <div className="text-xs text-muted-foreground">
              {summary.totalRevenue > 0 ? pct((summary.totalCost / summary.totalRevenue) * 100) : '-'}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t -mb-px transition-colors ${
              activeTab === t.key
                ? 'border border-b-background border-border font-medium text-foreground bg-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{dict.common.loading}</div>
      ) : (
        <>
          {/* Monthly Tab */}
          {activeTab === 'monthly' && (
            <div className="space-y-6">
              {/* Bar chart: revenue vs gross profit */}
              <div className="border rounded-lg p-4 bg-card">
                <h3 className="font-medium mb-3 text-sm">{pp.monthlyRevenueTrend}</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={48} />
                    <Tooltip formatter={(v) => typeof v === 'number' ? fmtFull(v) : String(v ?? '')} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name={pp.chartRevenue} fill="#3b82f6" radius={[2,2,0,0]} />
                    <Bar dataKey="grossProfit" name={pp.chartGrossProfit} fill="#10b981" radius={[2,2,0,0]} />
                    <Bar dataKey="netProfit" name={pp.chartNetProfit} fill="#8b5cf6" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line chart: margin % */}
              <div className="border rounded-lg p-4 bg-card">
                <h3 className="font-medium mb-3 text-sm">{pp.monthlyMarginTrend}</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} width={40} />
                    <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : String(v ?? '')} />
                    <Line type="monotone" dataKey="margin" name={pp.chartMargin} stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left p-3">{pp.colMonth}</th>
                      <th className="text-right p-3">{pp.colRevenue}</th>
                      <th className="text-right p-3">{pp.colCost}</th>
                      <th className="text-right p-3">{pp.colGrossProfit}</th>
                      <th className="text-right p-3">{pp.colGrossMargin}</th>
                      <th className="text-right p-3">{pp.colNetProfit}</th>
                      <th className="text-right p-3">{pp.colOrderCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(monthlyData?.rows ?? []).map(r => (
                      <tr key={r.month} className="border-t hover:bg-muted/20">
                        <td className="p-3 font-medium">{r.month}{pp.monthSuffix}</td>
                        <td className="p-3 text-right">{fmtFull(r.revenue)}</td>
                        <td className="p-3 text-right text-muted-foreground">{fmtFull(r.cost)}</td>
                        <td className="p-3 text-right text-green-700 font-medium">{fmtFull(r.grossProfit)}</td>
                        <td className="p-3 text-right">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${r.grossMarginPct >= 30 ? 'bg-green-100 text-green-700' : r.grossMarginPct >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {pct(r.grossMarginPct)}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-medium ${r.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtFull(r.netProfit)}</td>
                        <td className="p-3 text-right text-muted-foreground">{r.orderCount}</td>
                      </tr>
                    ))}
                  </tbody>
                  {summary && (
                    <tfoot className="bg-muted/40 font-medium border-t-2">
                      <tr>
                        <td className="p-3">{pp.subtotalRow}</td>
                        <td className="p-3 text-right">{fmtFull(summary.totalRevenue)}</td>
                        <td className="p-3 text-right text-muted-foreground">{fmtFull(summary.totalCost)}</td>
                        <td className="p-3 text-right text-green-700">{fmtFull(summary.totalGrossProfit)}</td>
                        <td className="p-3 text-right">{pct(summary.avgGrossMarginPct)}</td>
                        <td className={`p-3 text-right ${summary.totalNetProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtFull(summary.totalNetProfit)}</td>
                        <td className="p-3 text-right text-muted-foreground">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Customer Tab */}
          {activeTab === 'customer' && (
            <div className="space-y-4">
              {customerData.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">{pp.noData}</div>
              ) : (
                <>
                  <div className="border rounded-lg p-4 bg-card">
                    <h3 className="font-medium mb-3 text-sm">{pp.customerGrossTop10}</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={customerData.slice(0, 10).map(r => ({ name: r.customerName.slice(0, 8), grossProfit: r.grossProfit, revenue: r.revenue }))} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={64} />
                        <Tooltip formatter={(v) => typeof v === 'number' ? fmtFull(v) : String(v ?? '')} />
                        <Bar dataKey="grossProfit" name={pp.chartGrossProfit} fill="#10b981" radius={[0,2,2,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr className="text-xs text-muted-foreground">
                          <th className="text-left p-3">{pp.colRank}</th>
                          <th className="text-left p-3">{pp.colCustomer}</th>
                          <th className="text-right p-3">{pp.colRevenue}</th>
                          <th className="text-right p-3">{pp.colGrossProfit}</th>
                          <th className="text-right p-3">{pp.colGrossMargin}</th>
                          <th className="text-right p-3">{pp.colNetProfit}</th>
                          <th className="text-right p-3">{pp.colOrderCount}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerData.map((r, i) => (
                          <tr key={r.customerId} className="border-t hover:bg-muted/20">
                            <td className="p-3 text-muted-foreground">{i + 1}</td>
                            <td className="p-3">
                              <div className="font-medium">{r.customerName}</div>
                              <div className="text-xs text-muted-foreground">{r.customerCode}</div>
                            </td>
                            <td className="p-3 text-right">{fmtFull(r.revenue)}</td>
                            <td className="p-3 text-right text-green-700 font-medium">{fmtFull(r.grossProfit)}</td>
                            <td className="p-3 text-right">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${r.grossMarginPct >= 30 ? 'bg-green-100 text-green-700' : r.grossMarginPct >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {pct(r.grossMarginPct)}
                              </span>
                            </td>
                            <td className={`p-3 text-right ${r.netProfit >= 0 ? '' : 'text-red-600'}`}>{fmtFull(r.netProfit)}</td>
                            <td className="p-3 text-right text-muted-foreground">{r.orderCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Product Tab */}
          {activeTab === 'product' && (
            <div className="space-y-4">
              {productData.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">{pp.noData}</div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{pp.costEstimateNote}</p>
                  <div className="border rounded-lg p-4 bg-card">
                    <h3 className="font-medium mb-3 text-sm">{pp.productGrossTop10}</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={productData.slice(0, 10).map(r => ({ name: r.productName.slice(0, 10), grossProfit: r.estimatedGrossProfit, revenue: r.revenue }))} layout="vertical" margin={{ left: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
                        <Tooltip formatter={(v) => typeof v === 'number' ? fmtFull(v) : String(v ?? '')} />
                        <Bar dataKey="grossProfit" name={pp.chartEstGrossProfit} fill="#8b5cf6" radius={[0,2,2,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr className="text-xs text-muted-foreground">
                          <th className="text-left p-3">{pp.colRank}</th>
                          <th className="text-left p-3">{pp.colProduct}</th>
                          <th className="text-right p-3">{pp.colSalesQty}</th>
                          <th className="text-right p-3">{pp.colRevenue}</th>
                          <th className="text-right p-3">{pp.colEstCost}</th>
                          <th className="text-right p-3">{pp.colEstGrossProfit}</th>
                          <th className="text-right p-3">{pp.colGrossMargin}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productData.map((r, i) => (
                          <tr key={r.productId} className="border-t hover:bg-muted/20">
                            <td className="p-3 text-muted-foreground">{i + 1}</td>
                            <td className="p-3">
                              <div className="font-medium">{r.productName}</div>
                              <div className="text-xs text-muted-foreground">{r.sku}</div>
                            </td>
                            <td className="p-3 text-right">{fmtFull(r.quantity)} {r.unit}</td>
                            <td className="p-3 text-right">{fmtFull(r.revenue)}</td>
                            <td className="p-3 text-right text-muted-foreground">{fmtFull(r.estimatedCost)}</td>
                            <td className="p-3 text-right text-purple-700 font-medium">{fmtFull(r.estimatedGrossProfit)}</td>
                            <td className="p-3 text-right">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${r.grossMarginPct >= 30 ? 'bg-green-100 text-green-700' : r.grossMarginPct >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {pct(r.grossMarginPct)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Salesperson Tab */}
          {activeTab === 'salesperson' && (
            <div className="space-y-4">
              {salesData.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">{pp.noData}</div>
              ) : (
                <>
                  <div className="border rounded-lg p-4 bg-card">
                    <h3 className="font-medium mb-3 text-sm">{pp.salespersonRanking}</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={salesData.map(r => ({ name: r.salesName, grossProfit: r.grossProfit, revenue: r.revenue }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={48} />
                        <Tooltip formatter={(v) => typeof v === 'number' ? fmtFull(v) : String(v ?? '')} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="revenue" name={pp.chartRevenue} fill="#3b82f6" radius={[2,2,0,0]} />
                        <Bar dataKey="grossProfit" name={pp.chartGrossProfit} fill="#10b981" radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr className="text-xs text-muted-foreground">
                          <th className="text-left p-3">{pp.colRank}</th>
                          <th className="text-left p-3">{pp.colSalesperson}</th>
                          <th className="text-right p-3">{pp.colRevenue}</th>
                          <th className="text-right p-3">{pp.colGrossProfit}</th>
                          <th className="text-right p-3">{pp.colGrossMargin}</th>
                          <th className="text-right p-3">{pp.colNetProfit}</th>
                          <th className="text-right p-3">{pp.colOrderCount}</th>
                          <th className="text-right p-3">{pp.colAvgOrder}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.map((r, i) => (
                          <tr key={r.salesId} className="border-t hover:bg-muted/20">
                            <td className="p-3 text-muted-foreground">{i + 1}</td>
                            <td className="p-3 font-medium">{r.salesName}</td>
                            <td className="p-3 text-right">{fmtFull(r.revenue)}</td>
                            <td className="p-3 text-right text-green-700 font-medium">{fmtFull(r.grossProfit)}</td>
                            <td className="p-3 text-right">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${r.grossMarginPct >= 30 ? 'bg-green-100 text-green-700' : r.grossMarginPct >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {pct(r.grossMarginPct)}
                              </span>
                            </td>
                            <td className={`p-3 text-right ${r.netProfit >= 0 ? '' : 'text-red-600'}`}>{fmtFull(r.netProfit)}</td>
                            <td className="p-3 text-right text-muted-foreground">{r.orderCount}</td>
                            <td className="p-3 text-right text-muted-foreground">
                              {r.orderCount > 0 ? fmtFull(r.revenue / r.orderCount) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
