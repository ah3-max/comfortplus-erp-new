'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n/context'
import { Search, BarChart3, TrendingUp, TrendingDown, PackageX, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface MovementRow {
  productId: string
  sku: string
  name: string
  category: string
  unit: string
  warehouses: string[]
  openingQty: number
  inboundQty: number
  outboundQty: number
  netChange: number
  closingQty: number
  turnoverRate: number | null
}

interface Summary {
  totalProducts: number
  totalInbound: number
  totalOutbound: number
  totalClosing: number
  zeroStock: number
}

const CATEGORY_LABELS: Record<string, string> = {
  FINISHED_GOODS: '成品',
  RAW_MATERIAL: '原料',
  PACKAGING: '包材',
  SEMI_FINISHED: '半成品',
  CONSUMABLE: '耗材',
}

export default function InventoryMovementPage() {
  const { dict } = useI18n()
  const [rows, setRows] = useState<MovementRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')

  // Period defaults: current month
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)

  const query = useCallback(async () => {
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter)
      const res = await fetch(`/api/inventory/movement?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setRows(json.data ?? [])
      setSummary(json.summary)
    } catch {
      toast.error('查詢失敗')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, categoryFilter])

  // Filter client-side by search term
  const filtered = rows.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.sku.toLowerCase().includes(search.toLowerCase())
  )

  const netColor = (n: number) => n > 0 ? 'text-blue-600' : n < 0 ? 'text-red-600' : 'text-gray-400'

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{dict.nav?.inventoryMovement ?? '進銷存彙總報表'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">查詢任意期間各品項的期初庫存、進貨、出貨、期末庫存</p>
      </div>

      {/* Query bar */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">期間起</div>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-36" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">期間迄</div>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-36" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">品項類型</div>
          <Select value={categoryFilter} onValueChange={v => { if (v) setCategoryFilter(v) }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={query} disabled={loading} className="gap-1.5 h-9">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? '查詢中…' : '查詢'}
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: '品項數', value: summary.totalProducts, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '本期進貨', value: `${summary.totalInbound.toLocaleString()} 件`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
            { label: '本期出貨', value: `${summary.totalOutbound.toLocaleString()} 件`, icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: '期末庫存', value: `${summary.totalClosing.toLocaleString()} 件`, icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: '零庫存品項', value: summary.zeroStock, icon: PackageX, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((c, i) => {
            const Icon = c.icon
            return (
              <div key={i} className={`rounded-xl p-3 ${c.bg} flex flex-col gap-1`}>
                <div className="flex items-center gap-1.5">
                  <Icon size={14} className={c.color} />
                  <span className="text-xs text-gray-600">{c.label}</span>
                </div>
                <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Search within results */}
      {searched && rows.length > 0 && (
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="篩選品名/SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      )}

      {/* Table */}
      {searched && (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">品項</th>
                <th className="px-4 py-3 text-center">類型</th>
                <th className="px-4 py-3 text-right">期初庫存</th>
                <th className="px-4 py-3 text-right">本期進貨 ↑</th>
                <th className="px-4 py-3 text-right">本期出貨 ↓</th>
                <th className="px-4 py-3 text-right">淨異動</th>
                <th className="px-4 py-3 text-right">期末庫存</th>
                <th className="px-4 py-3 text-center">週轉率</th>
                <th className="px-4 py-3 text-left">倉庫</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400">查詢中…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400">
                  {rows.length === 0 ? '無資料（期間內無庫存異動）' : '無符合搜尋的品項'}
                </td></tr>
              ) : filtered.map(row => (
                <tr key={row.productId} className={`border-b last:border-0 hover:bg-gray-50 ${row.closingQty <= 0 ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{row.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">
                      {CATEGORY_LABELS[row.category] ?? row.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {row.openingQty.toLocaleString()} <span className="text-xs text-gray-400">{row.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-600 font-medium">
                    {row.inboundQty > 0 ? `+${row.inboundQty.toLocaleString()}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-orange-600 font-medium">
                    {row.outboundQty > 0 ? `-${row.outboundQty.toLocaleString()}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${netColor(row.netChange)}`}>
                    {row.netChange > 0 ? `+${row.netChange.toLocaleString()}` : row.netChange.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">
                    <span className={row.closingQty <= 0 ? 'text-red-600' : row.closingQty <= 10 ? 'text-orange-600' : ''}>
                      {row.closingQty.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.turnoverRate !== null ? (
                      <span className={`text-xs font-medium ${row.turnoverRate > 1 ? 'text-green-600' : row.turnoverRate > 0.5 ? 'text-yellow-600' : 'text-gray-400'}`}>
                        {row.turnoverRate.toFixed(2)}x
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">
                    {row.warehouses.join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!searched && (
        <div className="py-20 text-center text-gray-400">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p>請選擇期間後按「查詢」</p>
        </div>
      )}
    </div>
  )
}
