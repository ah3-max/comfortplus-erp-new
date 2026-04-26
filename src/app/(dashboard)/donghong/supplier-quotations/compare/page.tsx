'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, ExternalLink, PlusCircle } from 'lucide-react'

interface CompareItem {
  supplier: { id: string; name: string; code: string; country: string | null }
  quotation: { id: string; quotationNumber: string; validUntil: string; leadTimeDays: number | null; minOrderQty: number | null; incoterms: string | null; paymentTerms: string | null }
  unitPrice: number
  currency: string
  unitPriceTwd: number
  delta_pct: number
  is_lowest: boolean
}
interface CompareResult {
  variant: { id: string; variantSku: string; masterSku: string; countryOrigin: string; masterProduct: { name: string } | null }
  items: CompareItem[]
  summary: { lowestPriceTwd: number | null; highestPriceTwd: number | null; averagePriceTwd: number | null; supplierCount: number }
}
interface Variant { id: string; variantSku: string; masterSku: string; masterProduct: { name: string } | null }

function fmt(n: number | null) {
  if (n == null) return '—'
  return `NT$${n.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('zh-TW')
}

const ROWS: { label: string; key: keyof CompareItem | 'quotationNo' | 'validUntil' | 'leadTime' | 'moq' | 'incoterms' }[] = [
  { label: '供應商',     key: 'supplier' as keyof CompareItem },
  { label: '報價單號',   key: 'quotationNo' },
  { label: '單價（原幣）', key: 'unitPrice' as keyof CompareItem },
  { label: '單價（TWD）*', key: 'unitPriceTwd' as keyof CompareItem },
  { label: '較最低價',   key: 'delta_pct' as keyof CompareItem },
  { label: '有效期至',   key: 'validUntil' },
  { label: '交期（天）', key: 'leadTime' },
  { label: 'MOQ',       key: 'moq' },
  { label: '交貨條件',  key: 'incoterms' },
]

function getCellValue(row: typeof ROWS[0], item: CompareItem): string {
  switch (row.key) {
    case 'supplier':    return item.supplier.name
    case 'quotationNo': return item.quotation.quotationNumber
    case 'unitPrice':   return `${item.unitPrice.toFixed(4)} ${item.currency}`
    case 'unitPriceTwd': return fmt(item.unitPriceTwd)
    case 'delta_pct':   return item.is_lowest ? '最低價' : `+${item.delta_pct.toFixed(1)}%`
    case 'validUntil':  return fmtDate(item.quotation.validUntil)
    case 'leadTime':    return item.quotation.leadTimeDays != null ? `${item.quotation.leadTimeDays} 天` : '—'
    case 'moq':         return item.quotation.minOrderQty != null ? String(item.quotation.minOrderQty) : '—'
    case 'incoterms':   return item.quotation.incoterms ?? '—'
    default:            return '—'
  }
}

export default function ComparePage() {
  const router = useRouter()
  const [variantSearch, setVariantSearch] = useState('')
  const [variantSuggestions, setVariantSuggestions] = useState<Variant[]>([])
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)
  const [result, setResult]   = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const searchVariants = useCallback(async (q: string) => {
    if (q.length < 1) { setVariantSuggestions([]); return }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/donghong/variants?masterSku=${encodeURIComponent(q)}&pageSize=20&isActive=true`)
      const data = await res.json()
      setVariantSuggestions(data.data ?? [])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const selectVariant = useCallback(async (v: Variant) => {
    setSelectedVariant(v)
    setVariantSearch(v.variantSku)
    setVariantSuggestions([])
    setLoading(true)
    try {
      const res = await fetch(`/api/donghong/supplier-quotations/compare?variantId=${v.id}`)
      const data = await res.json()
      if (res.ok) setResult(data)
      else setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Check if all items are TWD to hide the raw price row
  const allTwd = result?.items.every(i => i.currency === 'TWD') ?? false
  const visibleRows = ROWS.filter(r => allTwd ? r.key !== 'unitPrice' : true)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">多廠比價</h1>
        <p className="text-sm text-muted-foreground">選擇產地變體，比較所有有效供應商報價</p>
      </div>

      {/* Variant picker */}
      <Card>
        <CardContent className="pt-5">
          <div className="relative max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full h-10 pl-9 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="輸入 masterSku 搜尋（如 CP-I-Night）..."
                value={variantSearch}
                onChange={e => {
                  setVariantSearch(e.target.value)
                  searchVariants(e.target.value)
                }}
              />
              {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {variantSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {variantSuggestions.map(v => (
                  <button key={v.id} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex flex-col"
                    onClick={() => selectVariant(v)}>
                    <span className="font-mono font-medium">{v.variantSku}</span>
                    <span className="text-xs text-muted-foreground">{v.masterProduct?.name ?? v.masterSku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedVariant && (
            <p className="mt-2 text-sm text-muted-foreground">
              已選：<span className="font-mono font-medium">{selectedVariant.variantSku}</span>
              {' '}— {selectedVariant.masterProduct?.name ?? selectedVariant.masterSku}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && selectedVariant && result && result.items.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">目前無有效報價，請先建立供應商報價並啟用</p>
            <Button variant="outline" onClick={() => router.push('/donghong/supplier-quotations/new')}>
              <PlusCircle className="h-4 w-4 mr-2" /> 建立供應商報價
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Compare table */}
      {!loading && result && result.items.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '最低價（TWD）', value: fmt(result.summary.lowestPriceTwd) },
              { label: '最高價（TWD）', value: fmt(result.summary.highestPriceTwd) },
              { label: '平均價（TWD）', value: fmt(result.summary.averagePriceTwd) },
              { label: '參與供應商',    value: `${result.summary.supplierCount} 家` },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main compare matrix */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {result.variant.variantSku} — {result.variant.masterProduct?.name ?? result.variant.masterSku}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto pb-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    {/* Sticky label column */}
                    <th className="sticky left-0 bg-slate-50 border border-slate-200 px-3 py-2 text-left text-xs font-medium text-muted-foreground w-32 min-w-32">
                      項目
                    </th>
                    {result.items.map(item => (
                      <th key={item.quotation.id}
                        className={`border border-slate-200 px-4 py-2 text-center text-xs font-medium min-w-40 ${item.is_lowest ? 'bg-green-50' : 'bg-slate-50'}`}>
                        {item.is_lowest && (
                          <Badge variant="outline" className="block mb-1 text-green-700 border-green-300 bg-green-100 w-fit mx-auto">
                            最低價 ✓
                          </Badge>
                        )}
                        <span className="block">{item.supplier.name}</span>
                        <span className="block text-muted-foreground font-normal">{item.supplier.code}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(row => (
                    <tr key={row.key}>
                      <td className="sticky left-0 bg-white border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {row.label}
                      </td>
                      {result.items.map(item => {
                        const val = getCellValue(row, item)
                        const isLowest = item.is_lowest
                        return (
                          <td key={item.quotation.id}
                            className={`border border-slate-200 px-4 py-2 text-center ${isLowest ? 'bg-green-50/60' : ''} ${row.key === 'delta_pct' && item.is_lowest ? 'text-green-700 font-semibold' : ''} ${row.key === 'delta_pct' && !item.is_lowest ? 'text-orange-600' : ''}`}>
                            {row.key === 'quotationNo' ? (
                              <button
                                className="text-blue-600 hover:underline font-mono text-xs"
                                onClick={() => router.push(`/donghong/supplier-quotations/${item.quotation.id}`)}
                              >
                                {val}
                                <ExternalLink className="inline h-3 w-3 ml-1" />
                              </button>
                            ) : val}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Footnote */}
          <p className="text-xs text-muted-foreground px-1">
            * 匯率以報價建立日為準：TWD=1 / CNY=4.5 / USD=32 / THB=0.92（硬編，未來接台銀即期匯率 API）
          </p>

          {/* Disabled PO button */}
          <div className="flex justify-end">
            <Button disabled title="待 M03 採購單功能">
              以最低價建立 PO（待 M03）
            </Button>
          </div>
        </>
      )}

      {/* Initial state */}
      {!selectedVariant && !loading && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            請在上方搜尋並選擇一個產地變體，即可查看各供應商報價比較
          </CardContent>
        </Card>
      )}
    </div>
  )
}
