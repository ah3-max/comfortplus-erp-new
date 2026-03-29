'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import { Search, Save, Loader2, Plus, Trash2, Layers } from 'lucide-react'
import { toast } from 'sonner'

const LEVELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const
type Level = typeof LEVELS[number]

interface PriceTier {
  priceA?: number | null; priceB?: number | null; priceC?: number | null
  priceD?: number | null; priceE?: number | null; priceF?: number | null
  priceG?: number | null; priceH?: number | null; priceI?: number | null
  priceJ?: number | null
}

interface ProductRow {
  id: string
  sku: string
  name: string
  category: string
  unit: string
  sellingPrice: string
  priceTiers: PriceTier | null
}

interface CustomerLevelRow {
  id: string
  customerId: string
  priceLevel: string
  notes: string | null
  customer: { id: string; name: string; code: string; type: string }
}

interface SpecialPriceRow {
  id: string
  customerId: string
  productId: string
  price: string
  effectiveDate: string
  expiryDate: string | null
  notes: string | null
  customer: { id: string; name: string; code: string }
  product: { id: string; sku: string; name: string; unit: string }
}

interface Customer { id: string; name: string; code: string }
interface Product { id: string; sku: string; name: string; sellingPrice: string }

function fmt(n: number | string | null | undefined) {
  if (n == null) return ''
  const num = Number(n)
  return isNaN(num) ? '' : num.toLocaleString('zh-TW')
}

export default function PriceTiersPage() {
  const { dict } = useI18n()
  const [tab, setTab] = useState('tiers')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // Tab 1: Product price tiers
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [edits, setEdits] = useState<Record<string, Partial<Record<`price${Level}`, string>>>>({})

  // Tab 2: Customer price levels
  const [customerLevels, setCustomerLevels] = useState<CustomerLevelRow[]>([])
  const [loadingLevels, setLoadingLevels] = useState(true)
  const [levelEdits, setLevelEdits] = useState<Record<string, string>>({})

  // Tab 3: Special prices
  const [specialPrices, setSpecialPrices] = useState<SpecialPriceRow[]>([])
  const [loadingSpecial, setLoadingSpecial] = useState(true)
  const [showSpecialDialog, setShowSpecialDialog] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [spForm, setSpForm] = useState({ customerId: '', productId: '', price: '', effectiveDate: '', expiryDate: '', notes: '' })

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch(`/api/price-tiers?search=${encodeURIComponent(search)}`)
      const result = await res.json()
      setProducts(result.data ?? [])
      setEdits({})
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoadingProducts(false) }
  }, [search])

  const fetchLevels = useCallback(async () => {
    setLoadingLevels(true)
    try {
      const res = await fetch('/api/customers/price-level')
      const result = await res.json()
      setCustomerLevels(result.data ?? [])
      setLevelEdits({})
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoadingLevels(false) }
  }, [])

  const fetchSpecialPrices = useCallback(async () => {
    setLoadingSpecial(true)
    try {
      const res = await fetch('/api/special-prices')
      const result = await res.json()
      setSpecialPrices(result.data ?? [])
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoadingSpecial(false) }
  }, [])

  useEffect(() => { const t = setTimeout(fetchProducts, 300); return () => clearTimeout(t) }, [fetchProducts])
  useEffect(() => { fetchLevels() }, [fetchLevels])
  useEffect(() => { fetchSpecialPrices() }, [fetchSpecialPrices])

  // Load customers + products for special price dialog
  useEffect(() => {
    if (!showSpecialDialog) return
    Promise.all([
      fetch('/api/customers?pageSize=500').then(r => r.json()),
      fetch('/api/products?pageSize=500').then(r => r.json()),
    ]).then(([c, p]) => {
      setCustomers(c.data ?? [])
      setAllProducts(p.data ?? [])
    }).catch(() => {})
  }, [showSpecialDialog])

  function setEdit(productId: string, level: Level, value: string) {
    setEdits(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [`price${level}`]: value },
    }))
  }

  function getPriceValue(product: ProductRow, level: Level): string {
    const key = `price${level}` as keyof PriceTier
    if (edits[product.id]?.[`price${level}`] !== undefined) return edits[product.id][`price${level}`]!
    const v = product.priceTiers?.[key]
    return v != null ? String(v) : ''
  }

  async function saveTiers() {
    const items = Object.entries(edits).map(([productId, vals]) => ({
      productId,
      ...Object.fromEntries(
        Object.entries(vals).map(([k, v]) => [k, v === '' ? null : Number(v)])
      ),
    }))
    if (!items.length) { toast.info(dict.common.noData); return }
    setSaving(true)
    try {
      const res = await fetch('/api/price-tiers', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error()
      toast.success(dict.common.saveSuccess)
      fetchProducts()
    } catch { toast.error(dict.common.saveFailed) }
    finally { setSaving(false) }
  }

  async function saveLevels() {
    const items = Object.entries(levelEdits).map(([customerId, priceLevel]) => ({ customerId, priceLevel }))
    if (!items.length) { toast.info(dict.common.noData); return }
    setSaving(true)
    try {
      const res = await fetch('/api/customers/price-level', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error()
      toast.success(dict.common.saveSuccess)
      fetchLevels()
    } catch { toast.error(dict.common.saveFailed) }
    finally { setSaving(false) }
  }

  async function submitSpecialPrice() {
    if (!spForm.customerId || !spForm.productId || !spForm.price) {
      toast.error(dict.common.required); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/special-prices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spForm),
      })
      if (!res.ok) throw new Error()
      toast.success(dict.common.saveSuccess)
      setShowSpecialDialog(false)
      setSpForm({ customerId: '', productId: '', price: '', effectiveDate: '', expiryDate: '', notes: '' })
      fetchSpecialPrices()
    } catch { toast.error(dict.common.saveFailed) }
    finally { setSaving(false) }
  }

  async function deleteSpecialPrice(id: string) {
    if (!confirm(dict.common.deleteConfirm)) return
    const res = await fetch(`/api/special-prices?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.common.deleteSuccess); fetchSpecialPrices() }
    else toast.error(dict.common.deleteFailed)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.priceTiers.title}</h1>
          <p className="text-sm text-muted-foreground">
            {dict.priceTiers.subtitle}
          </p>
        </div>
      </div>

      {/* Priority info */}
      <div className="rounded-lg border bg-blue-50 border-blue-200 px-4 py-3 text-sm text-blue-700">
        {dict.priceTiers.priorityInfo}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tiers">{dict.priceTiers.tabProductTiers}</TabsTrigger>
          <TabsTrigger value="levels">{dict.priceTiers.tabCustomerLevels}</TabsTrigger>
          <TabsTrigger value="special">{dict.priceTiers.tabSpecialPricing}</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Product Price Tiers ── */}
        <TabsContent value="tiers" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder={dict.priceTiers.itemSearchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button onClick={saveTiers} disabled={saving || !Object.keys(edits).length}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {dict.common.save} {Object.keys(edits).length > 0 && `(${Object.keys(edits).length})`}
            </Button>
          </div>

          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32 sticky left-0 bg-white">{dict.priceTiers.colSku}</TableHead>
                  <TableHead className="min-w-[140px] sticky left-32 bg-white">{dict.priceTiers.colProductName}</TableHead>
                  <TableHead className="text-right w-24">{dict.priceTiers.colSellingPrice}</TableHead>
                  {LEVELS.map(l => (
                    <TableHead key={l} className="text-right w-24">{dict.priceTiers.priceLevel}{l}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProducts ? (
                  <TableRow><TableCell colSpan={13} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : products.length === 0 ? (
                  <TableRow><TableCell colSpan={13} className="py-16 text-center">
                    <Layers className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">{dict.priceTiers.noTiers}</p>
                  </TableCell></TableRow>
                ) : products.map(p => (
                  <TableRow key={p.id} className={edits[p.id] ? 'bg-blue-50/40' : ''}>
                    <TableCell className="font-mono text-xs sticky left-0 bg-inherit">{p.sku}</TableCell>
                    <TableCell className="sticky left-32 bg-inherit">
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.category} · {p.unit}</div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt(p.sellingPrice)}</TableCell>
                    {LEVELS.map(l => (
                      <TableCell key={l} className="p-1">
                        <Input
                          type="number"
                          className="h-8 text-right text-sm w-20 ml-auto"
                          placeholder="—"
                          value={getPriceValue(p, l)}
                          onChange={e => setEdit(p.id, l, e.target.value)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tab 2: Customer Price Levels ── */}
        <TabsContent value="levels" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Button onClick={saveLevels} disabled={saving || !Object.keys(levelEdits).length}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {dict.common.save} {Object.keys(levelEdits).length > 0 && `(${Object.keys(levelEdits).length})`}
            </Button>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.priceTiers.colCustomer}</TableHead>
                  <TableHead>{dict.common.type}</TableHead>
                  <TableHead className="w-40">{dict.priceTiers.tabCustomerLevels}</TableHead>
                  <TableHead>{dict.common.notes}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLevels ? (
                  <TableRow><TableCell colSpan={4} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : customerLevels.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-16 text-center text-muted-foreground">
                    {dict.priceTiers.noTiers}
                  </TableCell></TableRow>
                ) : customerLevels.map(row => {
                  const currentLevel = levelEdits[row.customerId] ?? row.priceLevel
                  return (
                    <TableRow key={row.id} className={levelEdits[row.customerId] ? 'bg-blue-50/40' : ''}>
                      <TableCell>
                        <div className="font-medium">{row.customer.name}</div>
                        <div className="text-xs text-muted-foreground">{row.customer.code}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{row.customer.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {LEVELS.map(l => (
                            <button
                              key={l}
                              onClick={() => setLevelEdits(prev => ({ ...prev, [row.customerId]: l }))}
                              className={`w-7 h-7 rounded text-xs font-medium border transition-colors ${
                                currentLevel === l
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >{l}</button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.notes ?? '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tab 3: Special Prices ── */}
        <TabsContent value="special" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowSpecialDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />{dict.priceTiers.newTier}
            </Button>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.priceTiers.colCustomer}</TableHead>
                  <TableHead>{dict.priceTiers.colProduct}</TableHead>
                  <TableHead className="text-right">{dict.priceTiers.colSpecialPrice}</TableHead>
                  <TableHead>{dict.priceTiers.colEffectiveDate}</TableHead>
                  <TableHead>{dict.priceTiers.colExpiryDate}</TableHead>
                  <TableHead>{dict.common.notes}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSpecial ? (
                  <TableRow><TableCell colSpan={7} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : specialPrices.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                    {dict.priceTiers.noTiers}
                  </TableCell></TableRow>
                ) : specialPrices.map(sp => (
                  <TableRow key={sp.id}>
                    <TableCell>
                      <div className="font-medium">{sp.customer.name}</div>
                      <div className="text-xs text-muted-foreground">{sp.customer.code}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{sp.product.name}</div>
                      <div className="text-xs text-muted-foreground">{sp.product.sku}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-700">${fmt(sp.price)}</TableCell>
                    <TableCell className="text-sm">{new Date(sp.effectiveDate).toLocaleDateString('zh-TW')}</TableCell>
                    <TableCell className="text-sm">{sp.expiryDate ? new Date(sp.expiryDate).toLocaleDateString('zh-TW') : dict.priceTiers.neverExpires}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sp.notes ?? '—'}</TableCell>
                    <TableCell>
                      <button onClick={() => deleteSpecialPrice(sp.id)} className="rounded p-1 hover:bg-red-50 text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Special Price Dialog */}
      <Dialog open={showSpecialDialog} onOpenChange={setShowSpecialDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dict.priceTiers.specialPriceDialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{dict.priceTiers.colCustomer} *</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={spForm.customerId}
                onChange={e => setSpForm(f => ({ ...f, customerId: e.target.value }))}
              >
                <option value="">{dict.priceTiers.selectCustomerPlaceholder}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{dict.priceTiers.colProduct} *</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={spForm.productId}
                onChange={e => setSpForm(f => ({ ...f, productId: e.target.value }))}
              >
                <option value="">{dict.priceTiers.selectProductPlaceholder}</option>
                {allProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({dict.priceTiers.colSellingPrice} ${fmt(p.sellingPrice)})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{dict.priceTiers.colSpecialPrice} *</label>
              <Input type="number" placeholder="0" value={spForm.price} onChange={e => setSpForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">{dict.priceTiers.colEffectiveDate}</label>
                <Input type="date" value={spForm.effectiveDate} onChange={e => setSpForm(f => ({ ...f, effectiveDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{dict.priceTiers.colExpiryDate}</label>
                <Input type="date" value={spForm.expiryDate} onChange={e => setSpForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{dict.common.notes}</label>
              <Input placeholder="..." value={spForm.notes} onChange={e => setSpForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSpecialDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={submitSpecialPrice} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dict.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
