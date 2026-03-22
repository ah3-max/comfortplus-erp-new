'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, TrendingUp, Users, Package, DollarSign, Award, BarChart2, PieChart, TrendingDown, ShoppingBag, Clock, CheckCircle2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart as RePieChart, Pie, Cell,
} from 'recharts'

interface MonthlyData { month: string; revenue: number; orders: number; paid: number }
interface TopCustomer { customer: { id: string; name: string; code: string } | null; revenue: number; orders: number }
interface TopProduct { product: { id: string; sku: string; name: string; unit: string } | null; quantity: number; revenue: number }
interface StatusDist { status: string; _count: { id: number } }
interface SalesRepPerf { user: { id: string; name: string; role: string } | null; revenue: number; orders: number }
interface ChannelRevenue { type: string; revenue: number }
interface ProductMargin {
  product: { id: string; sku: string; name: string; unit: string } | null
  revenue: number; cost: number; margin: number; quantity: number
}

interface PurchaseData {
  monthlyPurchase: { month: string; amount: number; orders: number }[]
  bySupplier: { supplierName: string; amount: number; orders: number }[]
  byType: { type: string; amount: number }[]
  totalPayable: number
  avgLeadDays: number | null
  onTimeRate: number | null
}

interface ReportData {
  monthlyRevenue: MonthlyData[]
  topCustomers: TopCustomer[]
  topProducts: TopProduct[]
  orderStatusDist: StatusDist[]
  totalReceivable: number
  salesRepPerf: SalesRepPerf[]
  salesRepMonthly: Record<string, number | string>[]
  salesRepNames: string[]
  channelRevenue: ChannelRevenue[]
  channelMonthly: Record<string, number | string>[]
  channelTypes: string[]
  productMargin: ProductMargin[]
  purchaseData: PurchaseData | null
  canSeeCost: boolean
}

function formatCurrency(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
  return String(val)
}
function formatFull(val: number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(val)
}

const statusLabels: Record<string, string> = {
  PENDING: '待確認', CONFIRMED: '已確認', PROCESSING: '處理中',
  SHIPPED: '已出貨', DELIVERED: '已送達', COMPLETED: '已完成', CANCELLED: '已取消',
}
const statusColors: Record<string, string> = {
  PENDING: '#94a3b8', CONFIRMED: '#60a5fa', PROCESSING: '#f59e0b',
  SHIPPED: '#3b82f6', DELIVERED: '#14b8a6', COMPLETED: '#22c55e', CANCELLED: '#ef4444',
}
const typeLabels: Record<string, string> = {
  NURSING_HOME: '護理之家', ELDERLY_HOME: '安養中心', HOSPITAL: '醫院',
  DISTRIBUTOR: '經銷商', OTHER: '其他',
}
const CHANNEL_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']
const REP_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']

const monthRanges = [
  { label: '近 3 個月', value: 3 },
  { label: '近 6 個月', value: 6 },
  { label: '近 12 個月', value: 12 },
]

const poTypeLabels: Record<string, string> = {
  FINISHED_GOODS:     '成品採購',
  OEM:                'OEM代工',
  PACKAGING:          '包材',
  RAW_MATERIAL:       '原物料',
  GIFT_PROMO:         '贈品/活動',
  LOGISTICS_SUPPLIES: '物流耗材',
}
const PO_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#64748b']

const tabs = [
  { id: 'overview',  label: '總覽',     icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'salesrep',  label: '業務報表', icon: <Award className="h-4 w-4" /> },
  { id: 'channel',   label: '通路分析', icon: <PieChart className="h-4 w-4" /> },
  { id: 'margin',    label: '毛利分析', icon: <BarChart2 className="h-4 w-4" /> },
  { id: 'purchase',  label: '採購報表', icon: <ShoppingBag className="h-4 w-4" /> },
]

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(6)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports?months=${months}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [months])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) return null

  const totalRevenue = data.monthlyRevenue.reduce((s, m) => s + m.revenue, 0)
  const totalOrders = data.monthlyRevenue.reduce((s, m) => s + m.orders, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">銷售報表</h1>
          <p className="text-sm text-muted-foreground">業務概況與趨勢分析</p>
        </div>
        <div className="flex gap-1.5">
          {monthRanges.map((r) => (
            <button key={r.value} onClick={() => setMonths(r.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                months === r.value
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((t) => (
          (!( t.id === 'margin' && !data.canSeeCost)) && (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}>
              {t.icon}{t.label}
            </button>
          )
        ))}
      </div>

      {/* KPI Cards — always visible */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: `${months} 個月營收`, value: formatFull(totalRevenue), icon: <TrendingUp className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50' },
          { label: `${months} 個月訂單`, value: `${totalOrders} 筆`, icon: <Package className="h-5 w-5 text-violet-600" />, bg: 'bg-violet-50' },
          { label: '應收帳款', value: formatFull(data.totalReceivable), icon: <DollarSign className="h-5 w-5 text-amber-600" />, bg: 'bg-amber-50' },
          { label: '參與業務數', value: `${data.salesRepPerf.length} 人`, icon: <Users className="h-5 w-5 text-green-600" />, bg: 'bg-green-50' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
                </div>
                <div className={`rounded-lg p-2 ${kpi.bg}`}>{kpi.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── 總覽 tab ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 月度趨勢圖 */}
          <Card>
            <CardHeader><CardTitle className="text-base">月度營收趨勢</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.monthlyRevenue} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip formatter={(value, name) => [formatFull(Number(value ?? 0)), name === 'revenue' ? '訂單金額' : '已收款']} labelStyle={{ fontWeight: 600 }} />
                  <Legend formatter={(val) => val === 'revenue' ? '訂單金額' : '已收款'} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="revenue" />
                  <Bar dataKey="paid" fill="#22c55e" radius={[4, 4, 0, 0]} name="paid" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 訂單數趨勢 */}
          <Card>
            <CardHeader><CardTitle className="text-base">月度訂單數量</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.monthlyRevenue} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip formatter={(val) => [Number(val ?? 0), '訂單數']} />
                  <Line type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 客戶排行 */}
            <Card>
              <CardHeader><CardTitle className="text-base">客戶營收排行（本年度）</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.topCustomers.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">尚無資料</p>
                ) : data.topCustomers.map((item, index) => {
                  const max = data.topCustomers[0]?.revenue ?? 1
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
                          <span className="text-sm font-medium truncate max-w-[160px]">{item.customer?.name ?? '—'}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{formatFull(item.revenue)}</div>
                          <div className="text-xs text-muted-foreground">{item.orders} 筆</div>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(item.revenue / max) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* 商品銷售排行 */}
            <Card>
              <CardHeader><CardTitle className="text-base">商品銷售排行（本年度）</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.topProducts.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">尚無資料</p>
                ) : data.topProducts.map((item, index) => {
                  const max = data.topProducts[0]?.revenue ?? 1
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
                          <div>
                            <span className="text-sm font-medium truncate max-w-[140px] block">{item.product?.name ?? '—'}</span>
                            <span className="text-xs text-muted-foreground font-mono">{item.product?.sku}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{formatFull(item.revenue)}</div>
                          <div className="text-xs text-muted-foreground">{item.quantity} {item.product?.unit ?? ''}</div>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${(item.revenue / max) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* 訂單狀態分佈 */}
          <Card>
            <CardHeader><CardTitle className="text-base">訂單狀態分佈</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {data.orderStatusDist.map((item) => (
                  <div key={item.status} className="flex items-center gap-2 rounded-lg border px-4 py-2.5">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: statusColors[item.status] ?? '#94a3b8' }} />
                    <span className="text-sm text-muted-foreground">{statusLabels[item.status] ?? item.status}</span>
                    <span className="text-sm font-bold">{item._count.id}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 業務報表 tab ── */}
      {activeTab === 'salesrep' && (
        <div className="space-y-6">
          {/* 業務業績排行 */}
          <Card>
            <CardHeader><CardTitle className="text-base">業務業績排行（本年度）</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.salesRepPerf.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">尚無資料</p>
              ) : data.salesRepPerf.map((rep, index) => {
                const max = data.salesRepPerf[0]?.revenue ?? 1
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                          index === 0 ? 'bg-amber-400' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-700' : 'bg-slate-200 text-slate-600'
                        }`}>{index + 1}</span>
                        <span className="text-sm font-medium">{rep.user?.name ?? '—'}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{formatFull(rep.revenue)}</div>
                        <div className="text-xs text-muted-foreground">{rep.orders} 筆訂單</div>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(rep.revenue / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* 業務月度趨勢 */}
          {data.salesRepNames.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">業務月度業績趨勢（Top 5）</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.salesRepMonthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <Tooltip formatter={(val, name) => [formatFull(Number(val ?? 0)), String(name)]} />
                    <Legend />
                    {data.salesRepNames.map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name}
                        stroke={REP_COLORS[i % REP_COLORS.length]} strokeWidth={2}
                        dot={{ fill: REP_COLORS[i % REP_COLORS.length], r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── 通路分析 tab ── */}
      {activeTab === 'channel' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 通路營收圓餅圖 */}
            <Card>
              <CardHeader><CardTitle className="text-base">各通路營收佔比（本年度）</CardTitle></CardHeader>
              <CardContent>
                {data.channelRevenue.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">尚無資料</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <RePieChart>
                        <Pie data={data.channelRevenue} dataKey="revenue" nameKey="type"
                          cx="50%" cy="50%" outerRadius={90}
                          label={({ name, percent }) => `${typeLabels[String(name ?? '')] ?? name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                          labelLine={false}>
                          {data.channelRevenue.map((_, i) => (
                            <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val, name) => [formatFull(Number(val ?? 0)), typeLabels[String(name)] ?? String(name)]} />
                      </RePieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {data.channelRevenue.map((item, i) => (
                        <div key={item.type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />
                            <span className="text-sm text-slate-700">{typeLabels[item.type] ?? item.type}</span>
                          </div>
                          <span className="text-sm font-bold">{formatFull(item.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 通路排行 bar */}
            <Card>
              <CardHeader><CardTitle className="text-base">各通路銷售金額（本年度）</CardTitle></CardHeader>
              <CardContent>
                {data.channelRevenue.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">尚無資料</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.channelRevenue} layout="vertical" margin={{ top: 4, right: 60, left: 60, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis type="category" dataKey="type" tickFormatter={(v) => typeLabels[v] ?? v} tick={{ fontSize: 12, fill: '#64748b' }} width={60} />
                      <Tooltip formatter={(val) => [formatFull(Number(val ?? 0)), '營收']} labelFormatter={(v) => typeLabels[v] ?? v} />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                        {data.channelRevenue.map((_, i) => (
                          <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 通路月度趨勢 */}
          {data.channelTypes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">各通路月度趨勢</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.channelMonthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <Tooltip formatter={(val, name) => [formatFull(Number(val ?? 0)), typeLabels[String(name)] ?? String(name)]} />
                    <Legend formatter={(v) => typeLabels[v] ?? v} />
                    {data.channelTypes.map((t, i) => (
                      <Line key={t} type="monotone" dataKey={t}
                        stroke={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} strokeWidth={2}
                        dot={{ fill: CHANNEL_COLORS[i % CHANNEL_COLORS.length], r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── 採購報表 tab ── */}
      {activeTab === 'purchase' && (
        !data.canSeeCost ? (
          <div className="rounded-lg border-2 border-dashed p-16 text-center text-muted-foreground">
            採購報表僅限財務、採購、總經理與超級管理員查看
          </div>
        ) : !data.purchaseData ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2.5"><ShoppingBag className="h-5 w-5 text-blue-600" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">應付帳款</p>
                      <p className="text-xl font-bold">{formatCurrency(data.purchaseData.totalPayable)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-50 p-2.5"><Clock className="h-5 w-5 text-purple-600" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">平均交期</p>
                      <p className="text-xl font-bold">{data.purchaseData.avgLeadDays != null ? `${data.purchaseData.avgLeadDays} 天` : '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-50 p-2.5"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">準時到貨率</p>
                      <p className="text-xl font-bold">{data.purchaseData.onTimeRate != null ? `${data.purchaseData.onTimeRate}%` : '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-amber-50 p-2.5"><Package className="h-5 w-5 text-amber-600" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">供應商數</p>
                      <p className="text-xl font-bold">{data.purchaseData.bySupplier.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 月度採購趨勢 */}
            <Card>
              <CardHeader><CardTitle className="text-base">月度採購金額趨勢</CardTitle></CardHeader>
              <CardContent>
                {data.purchaseData.monthlyPurchase.every(m => m.amount === 0) ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">所選期間尚無採購資料</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.purchaseData.monthlyPurchase} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip formatter={(val, name) => [name === 'amount' ? formatFull(Number(val)) : val, name === 'amount' ? '採購金額' : '訂單數']} />
                      <Legend formatter={v => v === 'amount' ? '採購金額' : '訂單數'} />
                      <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="amount" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* 供應商佔比 */}
              <Card>
                <CardHeader><CardTitle className="text-base">供應商採購佔比（Top 8，本期間）</CardTitle></CardHeader>
                <CardContent>
                  {data.purchaseData.bySupplier.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">尚無資料</p>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const total = data.purchaseData!.bySupplier.reduce((s, r) => s + r.amount, 0)
                        return data.purchaseData!.bySupplier.map((s, i) => (
                          <div key={i}>
                            <div className="mb-1 flex justify-between text-sm">
                              <span className="font-medium truncate max-w-[160px]">{s.supplierName}</span>
                              <span className="text-muted-foreground">{formatFull(s.amount)} · {s.orders} 筆</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${total > 0 ? (s.amount / total) * 100 : 0}%`, backgroundColor: PO_COLORS[i % PO_COLORS.length] }} />
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 採購類型分佈 */}
              <Card>
                <CardHeader><CardTitle className="text-base">採購類型分佈</CardTitle></CardHeader>
                <CardContent>
                  {data.purchaseData.byType.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">尚無資料</p>
                  ) : (
                    <div className="flex gap-6 items-center">
                      <ResponsiveContainer width={180} height={180}>
                        <RePieChart>
                          <Pie data={data.purchaseData.byType} dataKey="amount" nameKey="type" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                            {data.purchaseData.byType.map((_, i) => (
                              <Cell key={i} fill={PO_COLORS[i % PO_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val, name) => [formatFull(Number(val)), poTypeLabels[String(name)] ?? String(name)]} />
                        </RePieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {(() => {
                          const total = data.purchaseData!.byType.reduce((s, t) => s + t.amount, 0)
                          return data.purchaseData!.byType.map((t, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PO_COLORS[i % PO_COLORS.length] }} />
                                <span>{poTypeLabels[t.type] ?? t.type}</span>
                              </div>
                              <span className="text-muted-foreground">{total > 0 ? Math.round((t.amount / total) * 100) : 0}%</span>
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )
      )}

      {/* ── 毛利分析 tab (finance/gm/super_admin only) ── */}
      {activeTab === 'margin' && data.canSeeCost && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">商品毛利分析（本年度，Top 12）</CardTitle>
            </CardHeader>
            <CardContent>
              {data.productMargin.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">尚無資料</p>
              ) : (
                <div className="space-y-3">
                  {data.productMargin.map((item, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium">{item.product?.name ?? '—'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{item.product?.sku}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${item.margin >= 30 ? 'text-green-600' : item.margin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                            毛利率 {item.margin}%
                          </div>
                          <div className="text-xs text-muted-foreground">{formatFull(item.revenue - item.cost)} 毛利</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground mb-2">
                        <div><span>營收：</span><span className="font-medium text-slate-700">{formatFull(item.revenue)}</span></div>
                        <div><span>成本：</span><span className="font-medium text-slate-700">{formatFull(item.cost)}</span></div>
                        <div><span>銷量：</span><span className="font-medium text-slate-700">{item.quantity} {item.product?.unit}</span></div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className={`h-full rounded-full transition-all ${item.margin >= 30 ? 'bg-green-500' : item.margin >= 15 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(item.margin, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 毛利率 bar chart */}
          {data.productMargin.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">商品毛利率比較</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={data.productMargin.map(p => ({ name: p.product?.name ?? '—', margin: p.margin, revenue: p.revenue }))}
                    layout="vertical" margin={{ top: 4, right: 60, left: 80, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
                    <Tooltip
                      formatter={(val, name) => [
                        name === 'margin' ? `${val}%` : formatFull(Number(val ?? 0)),
                        name === 'margin' ? '毛利率' : '營收',
                      ]}
                    />
                    <Bar dataKey="margin" radius={[0, 4, 4, 0]} name="margin">
                      {data.productMargin.map((item, i) => (
                        <Cell key={i} fill={item.margin >= 30 ? '#22c55e' : item.margin >= 15 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-green-500" />毛利率 ≥ 30%</div>
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-amber-400" />15% – 30%</div>
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-red-400" />{'< 15%'}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 毛利 vs 營收 scatter-like bar */}
          {data.productMargin.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                  營收 vs 成本比較
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.productMargin.map(p => ({
                      name: p.product?.sku ?? '—',
                      revenue: p.revenue,
                      cost: p.cost,
                      profit: p.revenue - p.cost,
                    }))}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip formatter={(val, name) => [formatFull(Number(val ?? 0)), name === 'revenue' ? '營收' : name === 'cost' ? '成本' : '毛利']} />
                    <Legend formatter={(v) => v === 'revenue' ? '營收' : v === 'cost' ? '成本' : '毛利'} />
                    <Bar dataKey="cost" fill="#fca5a5" radius={[4, 4, 0, 0]} name="cost" stackId="a" />
                    <Bar dataKey="profit" fill="#4ade80" radius={[4, 4, 0, 0]} name="profit" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
