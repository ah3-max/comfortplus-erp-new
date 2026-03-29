'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ProductForm } from '@/components/products/product-form'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, AlertTriangle, Lock } from 'lucide-react'
import { toast } from 'sonner'

const CAN_SEE_COST    = ['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'FINANCE']
const CAN_SEE_MANAGER = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'PROCUREMENT', 'FINANCE']

const categoryColors: Record<string, string> = {
  紙尿布:   'bg-blue-100 text-blue-700',
  護墊:     'bg-purple-100 text-purple-700',
  清潔用品: 'bg-green-100 text-green-700',
  護理用品: 'bg-amber-100 text-amber-700',
  防護用品: 'bg-red-100 text-red-700',
  輔具:     'bg-cyan-100 text-cyan-700',
  其他:     'bg-slate-100 text-slate-600',
}

interface Product {
  id: string; sku: string; name: string; category: string
  series: string | null; size: string | null; packagingType: string | null
  piecesPerPack: number | null; packsPerBox: number | null
  specification: string | null; unit: string; barcode: string | null
  costPrice?: string; floorPrice?: string | null
  sellingPrice: string; channelPrice?: string | null; wholesalePrice?: string | null
  minSellPrice?: string | null; oemBasePrice?: string | null
  weight: string | null; volume: string | null; storageNotes: string | null
  description: string | null; isActive: boolean
  inventory: { quantity: number; safetyStock: number }[]
}

const CATEGORY_VALUES = ['紙尿布', '護墊', '清潔用品', '護理用品', '防護用品', '輔具', '其他']

function fmt(v: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(v))
}

export default function ProductsPage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const router = useRouter()
  const role = (session?.user?.role as string) ?? ''
  const canSeeCost    = CAN_SEE_COST.includes(role)
  const canSeeManager = CAN_SEE_MANAGER.includes(role)

  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showInactive, setShowInactive]     = useState(false)
  const [formOpen, setFormOpen]     = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search)         params.set('search', search)
    if (filterCategory) params.set('category', filterCategory)
    if (showInactive)   params.set('all', '1')
    const res  = await fetch(`/api/products?${params}`)
    const data = await res.json()
    setProducts(showInactive ? data : data.filter((p: Product) => p.isActive))
    setLoading(false)
  }, [search, filterCategory, showInactive])

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300)
    return () => clearTimeout(t)
  }, [fetchProducts])

  async function handleDelete(id: string, name: string) {
    if (!confirm(dict.common.deleteConfirm)) return
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.productsExt.statusInactive); fetchProducts() }
    else toast.error(dict.common.deleteFailed)
  }

  const lowStockCount = products.filter(p => {
    const inv = p.inventory?.[0]
    return inv && inv.quantity <= inv.safetyStock
  }).length

  const p = dict.products

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{p.title}</h1>
          <p className="text-sm text-muted-foreground">
            {p.countLabel.replace('{n}', String(products.length))}
            {lowStockCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />{lowStockCount} {p.lowStock}
              </span>
            )}
            {!canSeeCost && (
              <span className="ml-3 inline-flex items-center gap-1 text-slate-400 text-xs">
                <Lock className="h-3 w-3" />{p.sensitiveHidden}
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />{p.newProduct}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={dict.productsExt.searchPlaceholder}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterCategory('')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterCategory === '' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {dict.common.all}
          </button>
          {CATEGORY_VALUES.map((c, i) => (
            <button key={c} onClick={() => setFilterCategory(c === filterCategory ? '' : c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterCategory === c ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {dict.productsPage.categoryLabels[i]}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          {p.showInactive}{dict.productsExt.statusInactive}{dict.common.product}
        </label>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">{p.sku}</TableHead>
              <TableHead>{p.name}</TableHead>
              <TableHead className="w-20">{p.category}</TableHead>
              <TableHead className="w-20">{p.series}/{p.size}</TableHead>
              <TableHead className="w-24">{p.packaging}</TableHead>
              {canSeeCost && <TableHead className="text-right w-24">{p.costPrice}</TableHead>}
              <TableHead className="text-right w-24">{p.sellingPrice}</TableHead>
              {canSeeCost && <TableHead className="text-right w-24">{p.grossMarginRate}</TableHead>}
              {canSeeManager && !canSeeCost && <TableHead className="text-right w-24">{p.minPrice}</TableHead>}
              <TableHead className="text-center w-20">{p.stock}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canSeeCost ? 10 : 8} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canSeeCost ? 10 : 8} className="py-16 text-center text-muted-foreground">
                  {search || filterCategory ? dict.productsExt.noResults : dict.productsExt.noProducts}
                </TableCell>
              </TableRow>
            ) : products.map(p => {
              const inv    = p.inventory?.[0]
              const isLow  = inv && inv.quantity <= inv.safetyStock
              const colorClass = categoryColors[p.category] ?? 'bg-slate-100 text-slate-600'
              const margin = p.costPrice && p.sellingPrice
                ? (((Number(p.sellingPrice) - Number(p.costPrice)) / Number(p.sellingPrice)) * 100).toFixed(1)
                : null

              return (
                <TableRow key={p.id} className={`group cursor-pointer hover:bg-slate-50/50 ${!p.isActive ? 'opacity-50' : ''}`}
                  onClick={() => router.push(`/products/${p.id}`)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.specification && <div className="text-xs text-muted-foreground">{p.specification}</div>}
                    {!p.isActive && <Badge variant="outline" className="text-xs border-red-200 text-red-500 mt-0.5">{dict.productsExt.statusInactive}</Badge>}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                      {p.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[p.series, p.size].filter(Boolean).join(' / ') || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.packagingType
                      ? <div>{p.packagingType}{p.piecesPerPack ? <span className="text-xs"> ({p.piecesPerPack})</span> : null}</div>
                      : '—'}
                  </TableCell>
                  {canSeeCost && (
                    <TableCell className="text-right text-sm">{p.costPrice ? fmt(p.costPrice) : '—'}</TableCell>
                  )}
                  <TableCell className="text-right text-sm font-medium">{fmt(p.sellingPrice)}</TableCell>
                  {canSeeCost && (
                    <TableCell className="text-right text-sm">
                      {margin !== null
                        ? <span className={Number(margin) >= 30 ? 'text-green-600 font-medium' : Number(margin) >= 15 ? 'text-amber-600' : 'text-red-600'}>
                            {margin}%
                          </span>
                        : '—'}
                    </TableCell>
                  )}
                  {canSeeManager && !canSeeCost && (
                    <TableCell className="text-right text-sm text-amber-700">
                      {p.minSellPrice ? fmt(p.minSellPrice) : '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    {inv ? (
                      <span className={`inline-flex items-center gap-1 text-sm font-medium ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                        {isLow && <AlertTriangle className="h-3.5 w-3.5" />}
                        {inv.quantity}
                      </span>
                    ) : <Badge variant="outline">{dict.common.unassigned}</Badge>}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditTarget(p); setFormOpen(true) }}>
                          <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(p.id, p.name)} variant="destructive">
                          <Trash2 className="mr-2 h-4 w-4" />{dict.productsExt.statusInactive}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <ProductForm open={formOpen} onClose={() => setFormOpen(false)}
        onSuccess={fetchProducts} product={editTarget} />
    </div>
  )
}
