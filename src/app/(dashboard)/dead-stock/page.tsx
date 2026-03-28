'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n/context'
import { RefreshCw, PackageX, AlertTriangle, Eye } from 'lucide-react'
import { toast } from 'sonner'

interface DeadStockRow {
  productId: string
  name: string; sku: string; category: string | null; unit: string
  warehouse: string
  quantity: number; availableQty: number; damagedQty: number; safetyStock: number
  lastMovementDate: string | null
  daysSinceMovement: number | null
  stockValue: number
  isNewlyReceived: boolean; isDiscontinued: boolean
  riskLevel: 'DEAD' | 'SLOW' | 'WATCH'
}

interface Summary {
  total: number; dead: number; slow: number; watch: number
  totalStockValue: number; deadStockValue: number
}

const RISK_BADGE: Record<string, string> = {
  DEAD: 'bg-red-100 text-red-700',
  SLOW: 'bg-orange-100 text-orange-700',
  WATCH: 'bg-yellow-100 text-yellow-700',
}
const RISK_LABEL: Record<string, string> = { DEAD: '呆滯庫存', SLOW: '緩慢移動', WATCH: '留意' }

export default function DeadStockPage() {
  const { dict } = useI18n()
  const [noMovementDays, setNoMovementDays] = useState('90')
  const [warehouse, setWarehouse] = useState('__all__')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [data, setData] = useState<DeadStockRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'DEAD' | 'SLOW' | 'WATCH'>('ALL')

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const query = useCallback(async () => {
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams({ noMovementDays })
      if (warehouse !== '__all__') params.set('warehouse', warehouse)
      const res = await fetch(`/api/inventory/dead-stock?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data ?? [])
      setSummary(json.summary ?? null)
    } catch { toast.error('查詢失敗') }
    finally { setLoading(false) }
  }, [noMovementDays, warehouse])

  const filtered = riskFilter === 'ALL' ? data : data.filter(r => r.riskLevel === riskFilter)

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{dict.nav?.deadStock ?? '庫存呆滯分析'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">識別長期無出貨移動的品項，評估呆滯庫存風險與金額</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">無移動天數（≥）</div>
          <Input type="number" value={noMovementDays} onChange={e => setNoMovementDays(e.target.value)}
            className="h-9 w-24" min={7} />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">倉庫</div>
          <Select value={warehouse} onValueChange={v => { if (v) setWarehouse(v) }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部倉庫</SelectItem>
              <SelectItem value="MAIN">主倉</SelectItem>
              <SelectItem value="BONDED">保稅倉</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={query} disabled={loading} className="gap-1.5 h-9">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? '分析中…' : '開始分析'}
        </Button>
      </div>

      {searched && summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setRiskFilter(riskFilter === 'DEAD' ? 'ALL' : 'DEAD')}>
              <div className="flex items-center gap-2 mb-1">
                <PackageX size={16} className="text-red-500" />
                <span className="text-xs text-gray-400">呆滯庫存 (≥180天)</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{summary.dead} 品項</div>
              <div className="text-sm text-gray-500 mt-0.5">{fmt(summary.deadStockValue)}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setRiskFilter(riskFilter === 'SLOW' ? 'ALL' : 'SLOW')}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-orange-500" />
                <span className="text-xs text-gray-400">緩慢移動 (90~180天)</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{summary.slow} 品項</div>
            </div>
            <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setRiskFilter(riskFilter === 'WATCH' ? 'ALL' : 'WATCH')}>
              <div className="flex items-center gap-2 mb-1">
                <Eye size={16} className="text-yellow-500" />
                <span className="text-xs text-gray-400">留意 (&lt;90天)</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{summary.watch} 品項</div>
            </div>
            <div className="bg-white border rounded-xl p-4 col-span-2 md:col-span-1">
              <div className="text-xs text-gray-400 mb-1">呆滯庫存總值</div>
              <div className="text-2xl font-bold text-red-600">{fmt(summary.deadStockValue)}</div>
              <div className="text-xs text-gray-400 mt-0.5">佔總庫存值 {summary.totalStockValue > 0 ? Math.round(summary.deadStockValue / summary.totalStockValue * 1000) / 10 : 0}%</div>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-1">分析品項數</div>
              <div className="text-2xl font-bold">{summary.total}</div>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-1">所有庫存總值</div>
              <div className="text-2xl font-bold">{fmt(summary.totalStockValue)}</div>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex gap-2 items-center">
            {(['ALL', 'DEAD', 'SLOW', 'WATCH'] as const).map(r => (
              <button key={r} onClick={() => setRiskFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${riskFilter === r ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50 text-gray-700'}`}>
                {r === 'ALL' ? '全部' : RISK_LABEL[r]}
              </button>
            ))}
            <span className="text-sm text-gray-400 ml-2">{filtered.length} 品項</span>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">品項</th>
                <th className="px-4 py-3 text-left">倉庫</th>
                <th className="px-4 py-3 text-right">庫存量</th>
                <th className="px-4 py-3 text-right">庫存值</th>
                <th className="px-4 py-3 text-right">最後出貨</th>
                <th className="px-4 py-3 text-right">無移動天數</th>
                <th className="px-4 py-3 text-center">風險</th>
                <th className="px-4 py-3 text-center">備註</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400">無資料</td></tr>
                ) : filtered.map((row, i) => (
                  <tr key={`${row.productId}-${row.warehouse}-${i}`} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{row.sku}</div>
                      {row.category && <div className="text-xs text-gray-400">{row.category}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{row.warehouse}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.quantity.toLocaleString()} {row.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(row.stockValue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{row.lastMovementDate ?? '從未出貨'}</td>
                    <td className="px-4 py-3 text-right">
                      {row.daysSinceMovement != null
                        ? <span className={row.daysSinceMovement >= 180 ? 'text-red-600 font-medium' : row.daysSinceMovement >= 90 ? 'text-orange-500' : 'text-yellow-600'}>
                            {row.daysSinceMovement} 天
                          </span>
                        : <span className="text-red-600 font-medium">從未</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={RISK_BADGE[row.riskLevel]}>{RISK_LABEL[row.riskLevel]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {row.isDiscontinued && <span className="text-red-400">停產</span>}
                      {row.isNewlyReceived && <span className="text-blue-400">新進貨</span>}
                      {row.damagedQty > 0 && <span className="text-orange-400"> 含{row.damagedQty}不良</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!searched && (
        <div className="py-20 text-center text-gray-400">
          <PackageX size={40} className="mx-auto mb-3 opacity-30" />
          <p>請設定無移動天數後按「開始分析」</p>
          <p className="text-xs mt-1">系統將找出該天數內無出貨記錄的庫存品項</p>
        </div>
      )}
    </div>
  )
}
