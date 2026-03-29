'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n/context'
import { RefreshCw, AlertTriangle, PackageX, Clock, CheckCircle2, Filter } from 'lucide-react'
import { toast } from 'sonner'

interface InventoryLot {
  id: string
  lotNo: string
  status: string
  quantity: number
  remainingQty: number
  expiryDate: string | null
  manufactureDate: string | null
  daysToExpiry: number | null
  isNearExpiry: boolean
  isExpired: boolean
  product: { id: string; sku: string; name: string; unit: string }
  warehouse: { id: string; code: string; name: string }
  supplier: { id: string; name: string; code: string; country: string } | null
  purchaseOrder: { poNo: string } | null
}

type AlertZone = 'all' | 'expired' | '0-30' | '30-60' | '60-90'

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: '可用',
  RESERVED: '預留',
  QUARANTINE: '隔離',
  SCRAPPED: '報廢',
  SOLD: '已售出',
}

function getZone(lot: InventoryLot): string {
  if (lot.isExpired || (lot.daysToExpiry !== null && lot.daysToExpiry <= 0)) return 'expired'
  if (lot.daysToExpiry !== null && lot.daysToExpiry <= 30) return '0-30'
  if (lot.daysToExpiry !== null && lot.daysToExpiry <= 60) return '30-60'
  if (lot.daysToExpiry !== null && lot.daysToExpiry <= 90) return '60-90'
  return 'ok'
}

function zoneColor(zone: string) {
  if (zone === 'expired') return 'bg-red-100 text-red-700 border-red-300'
  if (zone === '0-30') return 'bg-orange-100 text-orange-700 border-orange-300'
  if (zone === '30-60') return 'bg-yellow-100 text-yellow-700 border-yellow-300'
  if (zone === '60-90') return 'bg-blue-100 text-blue-700 border-blue-300'
  return 'bg-green-100 text-green-700 border-green-300'
}

function zoneLabel(zone: string) {
  if (zone === 'expired') return '已過期'
  if (zone === '0-30') return '30天內到期'
  if (zone === '30-60') return '31-60天'
  if (zone === '60-90') return '61-90天'
  return '安全'
}

export default function ExpiryTrackingPage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const canManage = ['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER', 'WAREHOUSE'].includes(role)

  const [lots, setLots] = useState<InventoryLot[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [alertZone, setAlertZone] = useState<AlertZone>('all')
  const [warehouseFilter, setWarehouseFilter] = useState('')

  const fetchLots = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all lots with expiry data (include 90-day lookahead)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/inventory/lots?${params}`)
      const json = await res.json()
      // Filter to only lots with expiry date
      const withExpiry = (json as InventoryLot[]).filter(l => l.expiryDate !== null)
      setLots(withExpiry)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchLots() }, [fetchLots])

  async function refreshExpiryStatus() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/inventory/lots/refresh-expiry', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? dict.common.updateFailed); return }
      toast.success(`已更新 ${json.updated} 筆效期狀態`)
      fetchLots()
    } finally {
      setRefreshing(false)
    }
  }

  // Compute stats
  const now = new Date()
  const allActive = lots.filter(l => l.status !== 'SCRAPPED' && l.status !== 'SOLD')
  const expired = allActive.filter(l => l.isExpired || (l.daysToExpiry !== null && l.daysToExpiry <= 0))
  const within30 = allActive.filter(l => !l.isExpired && l.daysToExpiry !== null && l.daysToExpiry > 0 && l.daysToExpiry <= 30)
  const within60 = allActive.filter(l => !l.isExpired && l.daysToExpiry !== null && l.daysToExpiry > 30 && l.daysToExpiry <= 60)
  const within90 = allActive.filter(l => !l.isExpired && l.daysToExpiry !== null && l.daysToExpiry > 60 && l.daysToExpiry <= 90)

  // Warehouses for filter
  const warehouses = Array.from(new Set(lots.map(l => l.warehouse?.id))).map(wid => {
    const l = lots.find(x => x.warehouse?.id === wid)
    return { id: wid, name: l?.warehouse?.name ?? wid }
  })

  // Apply filters
  let filtered = alertZone === 'all' ? allActive :
    alertZone === 'expired' ? expired :
    alertZone === '0-30' ? within30 :
    alertZone === '30-60' ? within60 :
    within90

  if (warehouseFilter) filtered = filtered.filter(l => l.warehouse?.id === warehouseFilter)

  // FEFO recommendations: group by product, sort by expiry
  const fefoMap: Record<string, InventoryLot[]> = {}
  for (const l of allActive.filter(l => l.remainingQty > 0)) {
    if (!fefoMap[l.product.id]) fefoMap[l.product.id] = []
    fefoMap[l.product.id].push(l)
  }
  // Sort each product's lots by expiryDate ascending (FEFO)
  for (const pid in fefoMap) {
    fefoMap[pid].sort((a, b) => {
      if (!a.expiryDate) return 1
      if (!b.expiryDate) return -1
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
    })
  }
  // Only show products with near-expiry first lot
  const fefoAlerts = Object.values(fefoMap)
    .filter(ls => ls[0] && ls[0].daysToExpiry !== null && ls[0].daysToExpiry <= 60)
    .sort((a, b) => (a[0].daysToExpiry ?? 999) - (b[0].daysToExpiry ?? 999))

  const _ = now // suppress unused warning

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold">{dict.nav.expiryTracking ?? '庫存效期管理'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">批次效期追蹤、到期預警、FEFO 出貨建議</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLots} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {canManage && (
            <Button size="sm" variant="outline" onClick={refreshExpiryStatus} disabled={refreshing}>
              <Clock className="w-4 h-4 mr-1" />
              {refreshing ? '更新中...' : '更新效期狀態'}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <button onClick={() => setAlertZone('expired')}
          className={`border rounded-lg p-3 text-left transition-all hover:shadow-sm ${alertZone === 'expired' ? 'ring-2 ring-red-400' : ''}`}>
          <div className="flex items-center gap-2">
            <PackageX className="w-4 h-4 text-red-500" />
            <span className="text-xs text-muted-foreground">已過期</span>
          </div>
          <div className="text-2xl font-bold text-red-600 mt-1">{expired.length}</div>
          <div className="text-xs text-muted-foreground">批次</div>
        </button>
        <button onClick={() => setAlertZone('0-30')}
          className={`border rounded-lg p-3 text-left transition-all hover:shadow-sm ${alertZone === '0-30' ? 'ring-2 ring-orange-400' : ''}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-muted-foreground">30天內到期</span>
          </div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{within30.length}</div>
          <div className="text-xs text-muted-foreground">批次</div>
        </button>
        <button onClick={() => setAlertZone('30-60')}
          className={`border rounded-lg p-3 text-left transition-all hover:shadow-sm ${alertZone === '30-60' ? 'ring-2 ring-yellow-400' : ''}`}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-muted-foreground">31-60天</span>
          </div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{within60.length}</div>
          <div className="text-xs text-muted-foreground">批次</div>
        </button>
        <button onClick={() => setAlertZone('all')}
          className={`border rounded-lg p-3 text-left transition-all hover:shadow-sm ${alertZone === 'all' ? 'ring-2 ring-blue-400' : ''}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">全部有效期</span>
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{allActive.length}</div>
          <div className="text-xs text-muted-foreground">批次</div>
        </button>
      </div>

      {/* FEFO Recommendations */}
      {fefoAlerts.length > 0 && (
        <div className="border rounded-lg p-4 mb-6 bg-orange-50 border-orange-200">
          <h3 className="font-medium text-orange-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            FEFO 出貨建議（優先出貨批次）
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {fefoAlerts.slice(0, 9).map(ls => {
              const first = ls[0]
              const zone = getZone(first)
              return (
                <div key={first.product.id} className={`border rounded p-2.5 text-sm ${zoneColor(zone)}`}>
                  <div className="font-medium">{first.product.name}</div>
                  <div className="text-xs opacity-80">{first.product.sku}</div>
                  <div className="mt-1 flex justify-between">
                    <span>批號: {first.lotNo}</span>
                    <span>剩餘: {first.remainingQty} {first.product.unit}</span>
                  </div>
                  <div className="mt-0.5 font-medium">
                    {first.isExpired || (first.daysToExpiry !== null && first.daysToExpiry <= 0)
                      ? '⛔ 已過期，請報廢'
                      : first.daysToExpiry !== null && first.daysToExpiry <= 7
                      ? `🚨 ${first.daysToExpiry} 天後到期`
                      : `⚠ ${first.daysToExpiry} 天後到期`
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="w-44" placeholder="批號 / 商品" value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchLots()} />
        <Select value={alertZone} onValueChange={v => setAlertZone(v as AlertZone)}>
          <SelectTrigger className="w-36">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue placeholder="效期篩選" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="expired">已過期</SelectItem>
            <SelectItem value="0-30">30天內</SelectItem>
            <SelectItem value="30-60">31-60天</SelectItem>
            <SelectItem value="60-90">61-90天</SelectItem>
          </SelectContent>
        </Select>
        {warehouses.length > 1 && (
          <Select value={warehouseFilter || '__all__'} onValueChange={v => { if (v) setWarehouseFilter(v === '__all__' ? '' : v) }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="倉庫" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部倉庫</SelectItem>
              {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Lots table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30 text-green-500" />
          <p>此篩選條件下無效期資料</p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left p-3">批號</th>
                <th className="text-left p-3">商品</th>
                <th className="text-left p-3">倉庫</th>
                <th className="text-right p-3">剩餘庫存</th>
                <th className="text-left p-3">效期</th>
                <th className="text-center p-3">剩餘天數</th>
                <th className="text-left p-3">狀態</th>
                <th className="text-left p-3">供應商</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lot => {
                const zone = getZone(lot)
                return (
                  <tr key={lot.id} className={`border-t hover:bg-muted/20 ${
                    zone === 'expired' ? 'bg-red-50/60' :
                    zone === '0-30' ? 'bg-orange-50/40' : ''
                  }`}>
                    <td className="p-3 font-mono text-xs font-medium">{lot.lotNo}</td>
                    <td className="p-3">
                      <div className="font-medium">{lot.product.name}</div>
                      <div className="text-xs text-muted-foreground">{lot.product.sku}</div>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{lot.warehouse?.name}</td>
                    <td className="p-3 text-right font-medium">
                      {lot.remainingQty} <span className="text-xs text-muted-foreground">{lot.product.unit}</span>
                    </td>
                    <td className="p-3">
                      {lot.expiryDate
                        ? <span className={zone === 'expired' ? 'text-red-600 font-medium' : zone === '0-30' ? 'text-orange-600 font-medium' : ''}>
                            {lot.expiryDate.slice(0, 10)}
                          </span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                    <td className="p-3 text-center">
                      {lot.daysToExpiry !== null ? (
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${zoneColor(zone)}`}>
                          {lot.daysToExpiry <= 0 ? `+${Math.abs(lot.daysToExpiry)}d 過期` : `${lot.daysToExpiry}d`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3">
                      <Badge className="text-xs">{STATUS_LABELS[lot.status] ?? lot.status}</Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{lot.supplier?.name ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="p-2 text-xs text-muted-foreground text-right border-t">
            共 {filtered.length} 筆
          </div>
        </div>
      )}
    </div>
  )
}
