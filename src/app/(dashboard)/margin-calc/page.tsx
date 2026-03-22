'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Calculator, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

// ═══════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════

interface Product {
  id: string
  sku: string
  name: string
}

interface CostBreakdown {
  factoryCost: number
  packagingCost: number
  internationalLogistics: number
  customs: number
  storage: number
  domesticDelivery: number
  totalCost: number
}

interface MarginResult {
  product: { id: string; sku: string; name: string; sellingPrice: number; floorPrice: number }
  costBreakdown: CostBreakdown
  grossProfit: number
  marginPct: number
  profitPerUnit: number
  warnings: { level: 'critical' | 'caution'; message: string }[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

const COST_LABELS: { key: keyof CostBreakdown; label: string; color: string }[] = [
  { key: 'factoryCost',            label: '工廠成本',   color: 'bg-blue-500' },
  { key: 'packagingCost',          label: '包裝費',     color: 'bg-indigo-500' },
  { key: 'internationalLogistics', label: '國際物流',   color: 'bg-purple-500' },
  { key: 'customs',                label: '關稅',       color: 'bg-pink-500' },
  { key: 'storage',                label: '倉儲費',     color: 'bg-orange-500' },
  { key: 'domesticDelivery',       label: '國內配送',   color: 'bg-teal-500' },
]

// ═══════════════════════════════════════════════════════════════════════════
//  Page
// ═══════════════════════════════════════════════════════════════════════════

export default function MarginCalcPage() {
  const { t } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  const [selectedProductId, setSelectedProductId] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [qty, setQty] = useState('')
  const [calculating, setCalculating] = useState(false)
  const [result, setResult] = useState<MarginResult | null>(null)

  // Fetch product list
  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.products ?? data.data ?? []
        setProducts(list)
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false))
  }, [])

  const handleCalculate = async () => {
    if (!selectedProductId || !unitPrice || !qty) return
    setCalculating(true)
    setResult(null)
    try {
      const params = new URLSearchParams({
        productId: selectedProductId,
        unitPrice: unitPrice,
        qty: qty,
      })
      const res = await fetch(`/api/margin/simulate?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data: MarginResult = await res.json()
      setResult(data)
    } catch {
      setResult(null)
    } finally {
      setCalculating(false)
    }
  }

  const marginColor = result
    ? result.marginPct >= 30 ? 'text-green-600' : result.marginPct >= 15 ? 'text-yellow-600' : 'text-red-600'
    : ''

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">
          {t('margin.title') === 'margin.title' ? '毛利試算' : t('margin.title')}
        </h1>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">試算條件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Product selector */}
            <div className="space-y-1.5">
              <Label htmlFor="product">產品</Label>
              <select
                id="product"
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">
                  {loadingProducts ? '載入中...' : '請選擇產品'}
                </option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.sku} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Price */}
            <div className="space-y-1.5">
              <Label htmlFor="unitPrice">單價 (TWD)</Label>
              <Input
                id="unitPrice"
                type="number"
                min={0}
                placeholder="150"
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)}
              />
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label htmlFor="qty">數量</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                placeholder="1000"
                value={qty}
                onChange={e => setQty(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleCalculate}
              disabled={!selectedProductId || !unitPrice || !qty || calculating}
            >
              {calculating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              計算
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
                    w.level === 'critical'
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : 'border-yellow-300 bg-yellow-50 text-yellow-800'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Product Info + Margin */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> 產品資訊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="SKU" value={result.product.sku} />
                <Row label="品名" value={result.product.name} />
                <Row label="建議售價" value={fmt(result.product.sellingPrice)} />
                <Row label="底價" value={fmt(result.product.floorPrice)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> 毛利結果
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">毛利率</p>
                  <p className={`text-4xl font-bold ${marginColor}`}>
                    {result.marginPct.toFixed(1)}%
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center p-2 rounded-md bg-muted/50">
                    <p className="text-muted-foreground">毛利金額</p>
                    <p className="font-semibold">{fmt(result.grossProfit)}</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-muted/50">
                    <p className="text-muted-foreground">每件利潤</p>
                    <p className="font-semibold">{fmt(result.profitPerUnit)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">成本明細</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Stacked bar */}
              <div className="h-6 rounded-full overflow-hidden flex mb-4">
                {COST_LABELS.map(({ key, color }) => {
                  const val = result.costBreakdown[key]
                  const pct = result.costBreakdown.totalCost > 0
                    ? (val / result.costBreakdown.totalCost) * 100
                    : 0
                  return pct > 0 ? (
                    <div key={key} className={`${color} h-full`} style={{ width: `${pct}%` }} />
                  ) : null
                })}
              </div>

              {/* Legend list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {COST_LABELS.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-3 h-3 rounded-sm ${color}`} />
                      <span>{label}</span>
                    </div>
                    <span className="font-medium">{fmt(result.costBreakdown[key])}</span>
                  </div>
                ))}
                <div className="sm:col-span-2 border-t pt-2 flex items-center justify-between font-semibold">
                  <span>總成本</span>
                  <span>{fmt(result.costBreakdown.totalCost)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
