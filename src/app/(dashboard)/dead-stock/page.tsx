'use client'

import { useState, useCallback, useEffect } from 'react'
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
    } catch { toast.error(dict.common.queryFailed) }
    finally { setLoading(false) }
  }, [noMovementDays, warehouse])

  useEffect(() => { query() }, [query])

  const filtered = riskFilter === 'ALL' ? data : data.filter(r => r.riskLevel === riskFilter)

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{dict.deadStock.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{dict.deadStock.subtitle}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">{dict.deadStock.noMovementDays}</div>
          <Input type="number" value={noMovementDays} onChange={e => setNoMovementDays(e.target.value)}
            className="h-9 w-24" min={7} />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">{dict.deadStock.warehouseLabel}</div>
          <Select value={warehouse} onValueChange={v => { if (v) setWarehouse(v) }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{dict.deadStock.allWarehouses}</SelectItem>
              <SelectItem value="MAIN">{dict.deadStock.warehouseMain}</SelectItem>
              <SelectItem value="BONDED">{dict.deadStock.warehouseBonded}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={query} disabled={loading} className="gap-1.5 h-9">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? dict.deadStock.analyzing : dict.deadStock.analyze}
        </Button>
      </div>

      {searched && summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setRiskFilter(riskFilter === 'DEAD' ? 'ALL' : 'DEAD')}>
              <div className="flex items-center gap-2 mb-1">
                <PackageX size={16} className="text-red-500" />
                <span className="text-xs text-gray-400">{dict.deadStock.deadLabel}</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{summary.dead} {dict.deadStock.itemsUnit}</div>
              <div className="text-sm text-gray-500 mt-0.5">{fmt(summary.deadStockValue)}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setRiskFilter(riskFilter === 'SLOW' ? 'ALL' : 'SLOW')}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-orange-500" />
                <span className="text-xs text-gray-400">{dict.deadStock.slowLabel}</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{summary.slow} {dict.deadStock.itemsUnit}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setRiskFilter(riskFilter === 'WATCH' ? 'ALL' : 'WATCH')}>
              <div className="flex items-center gap-2 mb-1">
                <Eye size={16} className="text-yellow-500" />
                <span className="text-xs text-gray-400">{dict.deadStock.watchLabel}</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{summary.watch} {dict.deadStock.itemsUnit}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 col-span-2 md:col-span-1">
              <div className="text-xs text-gray-400 mb-1">{dict.deadStock.deadStockValue}</div>
              <div className="text-2xl font-bold text-red-600">{fmt(summary.deadStockValue)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{dict.deadStock.ofTotalValuePct} {summary.totalStockValue > 0 ? Math.round(summary.deadStockValue / summary.totalStockValue * 1000) / 10 : 0}%</div>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-1">{dict.deadStock.totalItems}</div>
              <div className="text-2xl font-bold">{summary.total}</div>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-1">{dict.deadStock.totalStockValue}</div>
              <div className="text-2xl font-bold">{fmt(summary.totalStockValue)}</div>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex gap-2 items-center">
            {(['ALL', 'DEAD', 'SLOW', 'WATCH'] as const).map(r => (
              <button key={r} onClick={() => setRiskFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${riskFilter === r ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50 text-gray-700'}`}>
                {r === 'ALL' ? dict.deadStock.filterAll : (dict.deadStock.riskLabels as Record<string, string>)[r]}
              </button>
            ))}
            <span className="text-sm text-gray-400 ml-2">{filtered.length} {dict.deadStock.itemsUnit}</span>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left">{dict.deadStock.colProduct}</th>
                <th className="px-4 py-3 text-left">{dict.deadStock.colWarehouse}</th>
                <th className="px-4 py-3 text-right">{dict.deadStock.colQty}</th>
                <th className="px-4 py-3 text-right">{dict.deadStock.colValue}</th>
                <th className="px-4 py-3 text-right">{dict.deadStock.colLastMovement}</th>
                <th className="px-4 py-3 text-right">{dict.deadStock.colDaysSince}</th>
                <th className="px-4 py-3 text-center">{dict.deadStock.colRisk}</th>
                <th className="px-4 py-3 text-center">{dict.deadStock.colRemark}</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400">{dict.deadStock.noData}</td></tr>
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
                    <td className="px-4 py-3 text-right font-mono text-xs">{row.lastMovementDate ?? dict.deadStock.neverShipped}</td>
                    <td className="px-4 py-3 text-right">
                      {row.daysSinceMovement != null
                        ? <span className={row.daysSinceMovement >= 180 ? 'text-red-600 font-medium' : row.daysSinceMovement >= 90 ? 'text-orange-500' : 'text-yellow-600'}>
                            {row.daysSinceMovement} {dict.deadStock.daysUnit}
                          </span>
                        : <span className="text-red-600 font-medium">{dict.deadStock.neverMoved}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={RISK_BADGE[row.riskLevel]}>{(dict.deadStock.riskLabels as Record<string, string>)[row.riskLevel]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {row.isDiscontinued && <span className="text-red-400">{dict.deadStock.discontinued}</span>}
                      {row.isNewlyReceived && <span className="text-blue-400">{dict.deadStock.newlyReceived}</span>}
                      {row.damagedQty > 0 && <span className="text-orange-400"> {dict.deadStock.defectiveNote.replace('{n}', String(row.damagedQty))}</span>}
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
          <p>{dict.deadStock.promptText}</p>
          <p className="text-xs mt-1">{dict.deadStock.promptSubText}</p>
        </div>
      )}
    </div>
  )
}
