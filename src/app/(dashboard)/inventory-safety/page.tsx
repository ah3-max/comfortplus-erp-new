'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertTriangle,
  Package,
  CheckCircle2,
  TrendingDown,
  Edit2,
  Save,
  RefreshCw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string
  productId: string
  warehouse: string
  category: string
  quantity: number
  availableQty: number
  reservedQty: number
  lockedQty: number
  safetyStock: number
  product: {
    id: string
    sku: string
    name: string
    unit: string | null
    costPrice: number | null
    sellingPrice: number | null
    leadTimeDays?: number | null
  }
}

type StockStatus = 'insufficient' | 'warning' | 'adequate' | 'zero'
type SortKey = 'lowestStock' | 'highestSafety' | 'highestReorder'
type FilterStatus = 'all' | StockStatus

interface EnrichedItem extends InventoryItem {
  status: StockStatus
  reorderQty: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatus(availableQty: number, safetyStock: number): StockStatus {
  if (availableQty <= 0) return 'zero'
  if (availableQty < safetyStock) return 'insufficient'
  if (availableQty < safetyStock * 2) return 'warning'
  return 'adequate'
}

function getReorderQty(availableQty: number, safetyStock: number): number {
  return Math.max(0, safetyStock * 2 - availableQty)
}

const STATUS_LABEL: Record<StockStatus, string> = {
  insufficient: '不足',
  warning: '警示',
  adequate: '充足',
  zero: '零庫存',
}

const STATUS_BADGE_CLASS: Record<StockStatus, string> = {
  insufficient: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  adequate: 'bg-green-100 text-green-700 border-green-200',
  zero: 'bg-gray-100 text-gray-600 border-gray-200',
}

const FILTER_OPTIONS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'insufficient', label: '不足' },
  { key: 'warning', label: '警示' },
  { key: 'adequate', label: '充足' },
  { key: 'zero', label: '零庫存' },
]

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'lowestStock', label: '庫存最低' },
  { key: 'highestSafety', label: '安全庫存最高' },
  { key: 'highestReorder', label: '補貨量最高' },
]

// ── Inline Edit Component ─────────────────────────────────────────────────────

interface InlineEditProps {
  item: EnrichedItem
  onSaved: (id: string, newSafetyStock: number) => void
  onCancel: () => void
}

function InlineEdit({ item, onSaved, onCancel }: InlineEditProps) {
  const [value, setValue] = useState(String(item.safetyStock))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const num = Number(value)
    if (isNaN(num) || num < 0) {
      toast.error('安全庫存必須為非負整數')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/${item.id}/safety-stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safetyStock: Math.round(num) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? '更新失敗')
      }
      toast.success(`${item.product.name} 安全庫存已更新為 ${Math.round(num)}`)
      onSaved(item.id, Math.round(num))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        value={value}
        onChange={e => setValue(e.target.value)}
        className="h-8 w-24 text-sm"
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') onCancel()
        }}
        autoFocus
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <Save size={14} />
        )}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-gray-400 hover:text-gray-600"
        onClick={onCancel}
        disabled={saving}
      >
        <X size={14} />
      </Button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventorySafetyPage() {
  const [items, setItems] = useState<EnrichedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortKey, setSortKey] = useState<SortKey>('lowestStock')
  const [editingId, setEditingId] = useState<string | null>(null)

  // ── Fetch inventory ───────────────────────────────────────────────────────

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory?pageSize=200')
      if (!res.ok) throw new Error('載入失敗')
      const json = await res.json()

      // API returns plain array (no pagination wrapper per the actual route.ts)
      const raw: InventoryItem[] = Array.isArray(json) ? json : (json.data ?? [])

      const enriched: EnrichedItem[] = raw.map(item => ({
        ...item,
        status: getStatus(item.availableQty, item.safetyStock),
        reorderQty: getReorderQty(item.availableQty, item.safetyStock),
      }))

      setItems(enriched)
    } catch {
      toast.error('載入庫存資料失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  // ── Safety stock update callback ──────────────────────────────────────────

  const handleSaved = useCallback((id: string, newSafetyStock: number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        const updated = { ...item, safetyStock: newSafetyStock }
        return {
          ...updated,
          status: getStatus(updated.availableQty, newSafetyStock),
          reorderQty: getReorderQty(updated.availableQty, newSafetyStock),
        }
      }),
    )
    setEditingId(null)
  }, [])

  // ── KPI summary ───────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const insufficient = items.filter(i => i.status === 'insufficient').length
    const warning = items.filter(i => i.status === 'warning').length
    const adequate = items.filter(i => i.status === 'adequate').length
    const zero = items.filter(i => i.status === 'zero').length
    return { insufficient, warning, adequate, zero }
  }, [items])

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = items

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        i =>
          i.product.sku.toLowerCase().includes(q) ||
          i.product.name.toLowerCase().includes(q),
      )
    }

    if (filterStatus !== 'all') {
      result = result.filter(i => i.status === filterStatus)
    }

    return [...result].sort((a, b) => {
      if (sortKey === 'lowestStock') return a.availableQty - b.availableQty
      if (sortKey === 'highestSafety') return b.safetyStock - a.safetyStock
      if (sortKey === 'highestReorder') return b.reorderQty - a.reorderQty
      return 0
    })
  }, [items, search, filterStatus, sortKey])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">安全庫存儀表板</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            監控所有商品庫存與安全庫存的差距，即時掌握補貨需求
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchInventory}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          重新整理
        </Button>
      </div>

      {/* Alert banner */}
      {summary.insufficient > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={18} className="shrink-0 text-red-500" />
          <p className="text-sm font-medium text-red-700">
            {summary.insufficient} 項商品庫存不足安全庫存，請盡快補貨
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          className="cursor-pointer hover:border-red-300 transition-colors"
          onClick={() =>
            setFilterStatus(f => (f === 'insufficient' ? 'all' : 'insufficient'))
          }
        >
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-gray-400">
              <TrendingDown size={14} className="text-red-500" />
              庫存不足
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-red-600">
              {loading ? '—' : summary.insufficient}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">項商品</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-amber-300 transition-colors"
          onClick={() =>
            setFilterStatus(f => (f === 'warning' ? 'all' : 'warning'))
          }
        >
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-gray-400">
              <AlertTriangle size={14} className="text-amber-500" />
              安全庫存內
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-amber-600">
              {loading ? '—' : summary.warning}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">項商品</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-green-300 transition-colors"
          onClick={() =>
            setFilterStatus(f => (f === 'adequate' ? 'all' : 'adequate'))
          }
        >
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-gray-400">
              <CheckCircle2 size={14} className="text-green-500" />
              庫存充足
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-green-600">
              {loading ? '—' : summary.adequate}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">項商品</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-gray-300 transition-colors"
          onClick={() => setFilterStatus(f => (f === 'zero' ? 'all' : 'zero'))}
        >
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-gray-400">
              <Package size={14} className="text-gray-400" />
              零庫存商品
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-gray-600">
              {loading ? '—' : summary.zero}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">項商品</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        {/* Search + sort row */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="搜尋商品名稱或 SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background pl-3 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>
                排序：{o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2 items-center">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilterStatus(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {!loading && (
            <span className="text-sm text-gray-400 ml-1">
              共 {filtered.length} 筆
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <RefreshCw size={28} className="mx-auto mb-3 animate-spin opacity-40" />
            <p className="text-sm">載入中…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Package size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">查無符合條件的庫存資料</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">商品</th>
                <th className="px-4 py-3 text-left">倉庫</th>
                <th className="px-4 py-3 text-right">現貨</th>
                <th className="px-4 py-3 text-right">安全庫存</th>
                <th className="px-4 py-3 text-center">庫存狀態</th>
                <th className="px-4 py-3 text-right">建議補貨量</th>
                <th className="px-4 py-3 text-center">備注</th>
                <th className="px-4 py-3 text-center">編輯</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr
                  key={item.id}
                  className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                >
                  {/* 商品 */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {item.product.name}
                    </div>
                    <div className="text-xs font-mono text-gray-400 mt-0.5">
                      {item.product.sku}
                    </div>
                  </td>

                  {/* 倉庫 */}
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {item.warehouse}
                  </td>

                  {/* 現貨 */}
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <span
                      className={
                        item.availableQty <= 0
                          ? 'text-gray-400'
                          : item.availableQty < item.safetyStock
                          ? 'font-semibold text-red-600'
                          : 'text-gray-800'
                      }
                    >
                      {item.availableQty.toLocaleString()}
                    </span>
                    {item.product.unit && (
                      <span className="text-gray-400 text-xs ml-1">
                        {item.product.unit}
                      </span>
                    )}
                  </td>

                  {/* 安全庫存 */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {editingId === item.id ? (
                      <InlineEdit
                        item={item}
                        onSaved={handleSaved}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <span className="text-gray-700">
                        {item.safetyStock.toLocaleString()}
                        {item.product.unit && (
                          <span className="text-gray-400 text-xs ml-1">
                            {item.product.unit}
                          </span>
                        )}
                      </span>
                    )}
                  </td>

                  {/* 庫存狀態 */}
                  <td className="px-4 py-3 text-center">
                    <Badge
                      className={`text-xs border ${STATUS_BADGE_CLASS[item.status]}`}
                    >
                      {STATUS_LABEL[item.status]}
                    </Badge>
                  </td>

                  {/* 建議補貨量 */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {item.reorderQty > 0 ? (
                      <span className="font-semibold text-orange-600">
                        {item.reorderQty.toLocaleString()}
                        {item.product.unit && (
                          <span className="font-normal text-gray-400 text-xs ml-1">
                            {item.product.unit}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* 備注 (leadTimeDays) */}
                  <td className="px-4 py-3 text-center text-xs text-gray-400">
                    {item.product.leadTimeDays != null ? (
                      <span className="whitespace-nowrap">
                        交期 {item.product.leadTimeDays} 天
                      </span>
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>

                  {/* 編輯按鈕 */}
                  <td className="px-4 py-3 text-center">
                    {editingId === item.id ? null : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => setEditingId(item.id)}
                      >
                        <Edit2 size={13} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
