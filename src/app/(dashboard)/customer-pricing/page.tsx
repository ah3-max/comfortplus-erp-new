'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import {
  Search, Pencil, Trash2, Plus, Save, Building2,
  DollarSign, Package, Loader2, X,
} from 'lucide-react'

/* ─── Types ─── */
interface Customer {
  id: string; code: string; name: string; type: string
  taxId?: string | null; invoiceTitle?: string | null; invoiceAddress?: string | null
  paymentTerms?: string | null; creditLimit?: number | null; creditUsed?: number | null
  address?: string | null
}

/* ─── Region helpers ─── */
const REGIONS = [
  { key: 'north', label: '北部', cities: ['台北', '新北', '基隆', '桃園', '新竹', '宜蘭'] },
  { key: 'central', label: '中部', cities: ['台中', '苗栗', '彰化', '南投', '雲林'] },
  { key: 'south', label: '南部', cities: ['高雄', '台南', '嘉義', '屏東', '澎湖'] },
  { key: 'east', label: '東部', cities: ['花蓮', '台東'] },
] as const

type RegionKey = typeof REGIONS[number]['key']

function getRegion(address: string | null | undefined): RegionKey | null {
  if (!address) return null
  for (const r of REGIONS) {
    if (r.cities.some(c => address.startsWith(c) || address.includes(c + '市') || address.includes(c + '縣'))) return r.key
  }
  return null
}

interface SpecialPriceRecord {
  id: string; customerId: string; productId: string; price: string | number
  effectiveDate?: string | null; expiryDate?: string | null; notes?: string | null
  product?: {
    id: string; sku: string; name: string; unit: string
    category: string; sellingPrice: string | number | null
  }
}

interface ProductOption {
  id: string; sku: string; name: string; category: string; unit: string
  sellingPrice: number | null
}

/* ─── Helpers ─── */
const fmt = (n: number | string | null | undefined) => {
  if (n == null) return '—'
  const v = typeof n === 'string' ? parseFloat(n) : n
  return isNaN(v) ? '—' : `$${v.toLocaleString()}`
}

/* ─── Page ─── */
export default function CustomerPricingPage() {
  const { dict } = useI18n()
  const cp = dict.customerPricing

  /* ── Customer search ── */
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [regionFilter, setRegionFilter] = useState<RegionKey | ''>('')
  const [hasSearched, setHasSearched] = useState(false)

  /* ── Pricing data ── */
  const [specialPrices, setSpecialPrices] = useState<SpecialPriceRecord[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  /* ── Filters ── */
  const [productFilter, setProductFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  /* ── Edit dialog ── */
  const [editInfoOpen, setEditInfoOpen] = useState(false)
  const [editForm, setEditForm] = useState({ taxId: '', invoiceTitle: '', invoiceAddress: '', paymentTerms: '', creditLimit: '' })

  /* ── Price dialog (add / edit) ── */
  const [priceDialog, setPriceDialog] = useState<{
    open: boolean; mode: 'add' | 'edit'
    productId: string; productName: string; productSku: string
    price: string; effectiveDate: string; expiryDate: string; notes: string
    existingId?: string; catalogPrice?: number | null
  }>({ open: false, mode: 'add', productId: '', productName: '', productSku: '', price: '', effectiveDate: '', expiryDate: '', notes: '' })

  /* ── Add product search ── */
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [productSearchLoading, setProductSearchLoading] = useState(false)

  const [saving, setSaving] = useState(false)

  /* ── Fetch customers from API (debounced) ── */
  const fetchCustomers = useCallback(async (search: string, area: string) => {
    setSearchLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '20' })
      if (search.trim()) params.set('search', search.trim())
      if (area) params.set('area', area)
      const res = await fetch(`/api/customers?${params}`)
      const json = await res.json()
      setCustomers(json.data ?? [])
      setHasSearched(true)
    } finally { setSearchLoading(false) }
  }, [])

  useEffect(() => {
    if (selectedCustomer) return
    const hasInput = customerSearch.trim() || regionFilter
    if (!hasInput) { setCustomers([]); setHasSearched(false); return }
    const timer = setTimeout(() => fetchCustomers(customerSearch, regionFilter), 300)
    return () => clearTimeout(timer)
  }, [customerSearch, regionFilter, selectedCustomer, fetchCustomers])

  /* ── Load special prices for a customer ── */
  const loadPricingData = useCallback(async (custId: string) => {
    setDataLoading(true)
    try {
      const res = await fetch(`/api/special-prices?customerId=${custId}`)
      const json = await res.json()
      setSpecialPrices(json.data ?? [])
    } finally { setDataLoading(false) }
  }, [])

  const selectCustomer = useCallback(async (c: Customer) => {
    const res = await fetch(`/api/customers/${c.id}`)
    const full = await res.json()
    setSelectedCustomer(full)
    setCustomerSearch('')
    setCustomers([])
    setProductFilter('')
    setCategoryFilter('')
    loadPricingData(c.id)
  }, [loadPricingData])

  /* ── Derived: categories from current special prices ── */
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const sp of specialPrices) {
      if (sp.product?.category) set.add(sp.product.category)
    }
    return Array.from(set).sort()
  }, [specialPrices])

  /* ── Derived: filtered and grouped products ── */
  const groupedProducts = useMemo(() => {
    let items = specialPrices.filter(sp => sp.product)

    if (categoryFilter) {
      items = items.filter(sp => sp.product!.category === categoryFilter)
    }
    if (productFilter.trim()) {
      const q = productFilter.toLowerCase()
      items = items.filter(sp =>
        sp.product!.sku.toLowerCase().includes(q) ||
        sp.product!.name.toLowerCase().includes(q)
      )
    }

    const groups = new Map<string, SpecialPriceRecord[]>()
    for (const sp of items) {
      const cat = sp.product!.category || '其他'
      const arr = groups.get(cat) ?? []
      arr.push(sp)
      groups.set(cat, arr)
    }

    for (const [, arr] of groups) {
      arr.sort((a, b) => (a.product!.sku).localeCompare(b.product!.sku))
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [specialPrices, categoryFilter, productFilter])

  /* ── Product search for add dialog ── */
  const loadProducts = useCallback(async (query: string) => {
    setProductSearchLoading(true)
    try {
      const params = query.trim()
        ? `search=${encodeURIComponent(query)}&fuzzy=1`
        : ''
      const res = await fetch(`/api/products?${params}`)
      if (!res.ok) return
      const json = await res.json()
      const arr = Array.isArray(json) ? json : (json.data ?? [])
      const list: ProductOption[] = arr.map((p: Record<string, unknown>) => ({
        id: p.id, sku: p.sku, name: p.name,
        category: (p.category as string) ?? '', unit: (p.unit as string) ?? '',
        sellingPrice: p.sellingPrice ? Number(p.sellingPrice) : null,
      }))
      const existingIds = new Set(specialPrices.map(sp => sp.productId))
      setProductOptions(list.filter(p => !existingIds.has(p.id)))
    } finally { setProductSearchLoading(false) }
  }, [specialPrices])

  useEffect(() => {
    if (!addDialogOpen) return
    if (!productSearch.trim()) { loadProducts(''); return }
    const timer = setTimeout(() => loadProducts(productSearch), 300)
    return () => clearTimeout(timer)
  }, [productSearch, addDialogOpen, loadProducts])

  /* ── Save customer info ── */
  const saveCustomerInfo = async () => {
    if (!selectedCustomer) return
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxId: editForm.taxId || null,
          invoiceTitle: editForm.invoiceTitle || null,
          invoiceAddress: editForm.invoiceAddress || null,
          paymentTerms: editForm.paymentTerms || null,
          creditLimit: editForm.creditLimit ? Number(editForm.creditLimit) : null,
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setSelectedCustomer(prev => prev ? { ...prev, ...updated } : prev)
      setEditInfoOpen(false)
      toast.success('客戶資訊已更新')
    } catch { toast.error('儲存失敗') }
    finally { setSaving(false) }
  }

  /* ── Select product from add dialog → open price dialog ── */
  const selectProductToAdd = (product: ProductOption) => {
    setAddDialogOpen(false)
    setProductSearch('')
    setPriceDialog({
      open: true, mode: 'add',
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      price: product.sellingPrice ? String(product.sellingPrice) : '',
      effectiveDate: new Date().toISOString().slice(0, 10),
      expiryDate: '', notes: '',
      catalogPrice: product.sellingPrice,
    })
  }

  /* ── Open edit dialog for existing price ── */
  const openEditPrice = (sp: SpecialPriceRecord) => {
    setPriceDialog({
      open: true, mode: 'edit',
      productId: sp.productId,
      productName: sp.product?.name ?? '',
      productSku: sp.product?.sku ?? '',
      price: String(Number(sp.price)),
      effectiveDate: sp.effectiveDate ? new Date(sp.effectiveDate).toISOString().slice(0, 10) : '',
      expiryDate: sp.expiryDate ? new Date(sp.expiryDate).toISOString().slice(0, 10) : '',
      notes: sp.notes ?? '',
      existingId: sp.id,
      catalogPrice: sp.product?.sellingPrice ? Number(sp.product.sellingPrice) : null,
    })
  }

  /* ── Save price (add or edit) ── */
  const savePrice = async () => {
    if (!selectedCustomer) return
    const d = priceDialog
    if (!d.price || isNaN(Number(d.price))) { toast.error('請輸入有效金額'); return }
    setSaving(true)
    try {
      const body = {
        customerId: selectedCustomer.id, productId: d.productId,
        price: Number(d.price),
        effectiveDate: d.effectiveDate || undefined,
        expiryDate: d.expiryDate || undefined,
        notes: d.notes || undefined,
      }
      const res = d.mode === 'edit' && d.existingId
        ? await fetch(`/api/special-prices?id=${d.existingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/special-prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      setPriceDialog(prev => ({ ...prev, open: false }))
      toast.success(d.mode === 'add' ? '品項已新增' : '定價已更新')
      loadPricingData(selectedCustomer.id)
    } catch { toast.error('儲存失敗') }
    finally { setSaving(false) }
  }

  /* ── Delete price ── */
  const deletePrice = async (sp: SpecialPriceRecord) => {
    if (!selectedCustomer) return
    if (!confirm(`確定移除「${sp.product?.name}」的定價？`)) return
    try {
      const res = await fetch(`/api/special-prices?id=${sp.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('已移除')
      setSpecialPrices(prev => prev.filter(s => s.id !== sp.id))
    } catch { toast.error('刪除失敗') }
  }

  /* ── Render ── */
  return (
    <div className="space-y-5 p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">

      {/* ── Header + Search + Customer List ── */}
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold">{cp.title ?? '客戶定價'}</h1>

        {!selectedCustomer && (
          <div className="space-y-4">
            {/* Search + Region filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  className="pl-12 h-12 text-base rounded-xl border-slate-300 shadow-sm focus:border-blue-400 focus:ring-blue-400"
                  placeholder={cp.searchPlaceholder ?? '搜尋客戶名稱 / 代碼 / 統編...'}
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                />
                {customerSearch && (
                  <button className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100"
                    onClick={() => setCustomerSearch('')}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {REGIONS.map(r => (
                  <button key={r.key}
                    className={`h-11 px-4 rounded-lg text-sm font-medium transition-colors active:scale-[0.97] ${
                      regionFilter === r.key
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    onClick={() => setRegionFilter(prev => prev === r.key ? '' : r.key)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer results */}
            {!hasSearched && !searchLoading ? (
              <div className="text-center py-20 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-base">請輸入關鍵字搜尋，或選擇地區瀏覽客戶</p>
              </div>
            ) : searchLoading ? (
              <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
            ) : customers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-base">無符合條件的客戶</p>
              </div>
            ) : (
              <div className="rounded-xl border shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">
                    {customers.length >= 20 ? '前 20 筆結果' : `共 ${customers.length} 家客戶`}
                    {regionFilter && <span>（{REGIONS.find(r => r.key === regionFilter)?.label}）</span>}
                  </span>
                  {customers.length >= 20 && (
                    <span className="text-xs text-muted-foreground">可輸入更精確的關鍵字縮小範圍</span>
                  )}
                </div>
                <div className="max-h-[420px] overflow-auto divide-y">
                  {customers.map(c => {
                    const region = getRegion(c.address)
                    return (
                      <button key={c.id}
                        className="w-full text-left px-5 py-4 hover:bg-blue-50/60 flex items-center justify-between active:scale-[0.995] transition-colors"
                        onClick={() => selectCustomer(c)}>
                        <div className="min-w-0">
                          <div className="text-[15px]">
                            <span className="font-mono text-sm text-muted-foreground mr-2">{c.code}</span>
                            <span className="font-medium">{c.name}</span>
                          </div>
                          {c.address && (
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">{c.address}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          {region && (
                            <Badge variant="outline" className="text-xs">{REGIONS.find(r => r.key === region)?.label}</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">{c.type}</Badge>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selected customer bar */}
        {selectedCustomer && (
          <div className="flex items-center gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                className="pl-12 h-12 text-base rounded-xl border-slate-300 shadow-sm"
                value={`${selectedCustomer.code} — ${selectedCustomer.name}`}
                readOnly
              />
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 active:scale-[0.97]"
                onClick={() => {
                  setSelectedCustomer(null)
                  setSpecialPrices([])
                  setCustomerSearch('')
                  setCategoryFilter('')
                  setProductFilter('')
                  setRegionFilter('')
                }}
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedCustomer && dataLoading && (
        <div className="text-center py-28"><Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" /></div>
      )}

      {selectedCustomer && !dataLoading && (
        <>
          {/* ── Customer Info Card ── */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="flex items-center gap-2.5 text-xl">
                <Building2 className="h-5 w-5 text-slate-600" />
                {cp.basicInfo ?? '客戶基本資訊'}
              </CardTitle>
              <Button variant="outline" className="h-10 px-4 active:scale-[0.97]" onClick={() => {
                setEditForm({
                  taxId: selectedCustomer.taxId ?? '',
                  invoiceTitle: selectedCustomer.invoiceTitle ?? '',
                  invoiceAddress: selectedCustomer.invoiceAddress ?? '',
                  paymentTerms: selectedCustomer.paymentTerms ?? '',
                  creditLimit: selectedCustomer.creditLimit ? String(selectedCustomer.creditLimit) : '',
                })
                setEditInfoOpen(true)
              }}>
                <Pencil className="h-4 w-4 mr-1.5" /> {dict.common?.edit ?? '編輯'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-[15px]">
                <div><span className="text-muted-foreground">客戶名稱：</span><span className="font-medium">{selectedCustomer.name}</span></div>
                <div><span className="text-muted-foreground">客戶代碼：</span><span className="font-mono">{selectedCustomer.code}</span></div>
                <div><span className="text-muted-foreground">{cp.taxId ?? '統一編號'}：</span>{selectedCustomer.taxId || '—'}</div>
                <div><span className="text-muted-foreground">{cp.invoiceTitle ?? '發票抬頭'}：</span>{selectedCustomer.invoiceTitle || '—'}</div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">{cp.invoiceAddress ?? '發票地址'}：</span>{selectedCustomer.invoiceAddress || '—'}</div>
                <div><span className="text-muted-foreground">{cp.paymentTerms ?? '付款條件'}：</span>{selectedCustomer.paymentTerms || '—'}</div>
                <div><span className="text-muted-foreground">{cp.creditLimit ?? '信用額度'}：</span>{fmt(selectedCustomer.creditLimit)}</div>
                <div><span className="text-muted-foreground">{cp.creditUsed ?? '已用額度'}：</span>{fmt(selectedCustomer.creditUsed)}</div>
              </div>
            </CardContent>
          </Card>

          {/* ── Product Pricing ── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4 space-y-4">
              {/* Title row */}
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-xl">
                  <Package className="h-5 w-5 text-slate-600" />
                  {cp.productPricing ?? '簽約品項'}
                  <Badge variant="secondary" className="ml-1 text-sm px-2.5 py-0.5">
                    {specialPrices.length}
                  </Badge>
                </CardTitle>
                <Button className="h-11 px-5 text-sm active:scale-[0.97]" onClick={() => { setAddDialogOpen(true); setProductSearch(''); setProductOptions([]) }}>
                  <Plus className="h-4 w-4 mr-1.5" /> {cp.addProduct ?? '新增品項'}
                </Button>
              </div>
              {/* Filters row */}
              {specialPrices.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  {categories.length > 1 && (
                    <Select value={categoryFilter || '__all__'} onValueChange={v => setCategoryFilter(v === '__all__' ? '' : (v ?? ''))}>
                      <SelectTrigger className="w-44 h-10">
                        <SelectValue placeholder={cp.allCategories ?? '全部品類'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{cp.allCategories ?? '全部品類'}</SelectItem>
                        {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 h-10 w-56" placeholder={cp.searchProduct ?? '搜尋品項...'}
                      value={productFilter} onChange={e => setProductFilter(e.target.value)} />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {specialPrices.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Package className="h-14 w-14 mx-auto mb-4 opacity-30" />
                  <p className="text-base">{cp.noProducts ?? '此客戶尚無簽約品項，請點右上「新增品項」開始設定'}</p>
                </div>
              ) : groupedProducts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-base">無符合篩選條件的品項</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {groupedProducts.map(([category, items]) => (
                    <div key={category}>
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-base font-semibold text-slate-700">{category}</h3>
                        <Badge variant="outline" className="text-xs">{items.length} 項</Badge>
                        <div className="flex-1 border-b border-slate-200" />
                      </div>
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/80">
                              <TableHead className="w-32 text-[13px] py-3">SKU</TableHead>
                              <TableHead className="text-[13px] py-3">品名</TableHead>
                              <TableHead className="w-20 text-center text-[13px] py-3">單位</TableHead>
                              <TableHead className="text-right w-32 text-[13px] py-3">{cp.catalogPrice ?? '目錄價'}</TableHead>
                              <TableHead className="text-right w-32 text-[13px] py-3">{cp.customerPrice ?? '客戶價'}</TableHead>
                              <TableHead className="text-right w-24 text-[13px] py-3">折讓</TableHead>
                              <TableHead className="w-24 py-3" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map(sp => {
                              const catalog = sp.product?.sellingPrice ? Number(sp.product.sellingPrice) : null
                              const custPrice = Number(sp.price)
                              const discount = catalog && catalog > 0
                                ? Math.round((1 - custPrice / catalog) * 100)
                                : null
                              return (
                                <TableRow key={sp.id} className="group hover:bg-slate-50/50">
                                  <TableCell className="font-mono text-sm py-3.5">{sp.product?.sku}</TableCell>
                                  <TableCell className="py-3.5">
                                    <span className="text-[15px]">{sp.product?.name}</span>
                                    {sp.notes && (
                                      <span className="ml-2 text-xs text-muted-foreground" title={sp.notes}>
                                        ({sp.notes})
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center text-sm text-muted-foreground py-3.5">{sp.product?.unit}</TableCell>
                                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground py-3.5">{fmt(catalog)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-base font-semibold text-blue-700 py-3.5">{fmt(custPrice)}</TableCell>
                                  <TableCell className="text-right py-3.5">
                                    {discount != null && discount > 0 && (
                                      <Badge variant="outline" className="text-xs px-2 py-0.5 text-green-700 border-green-300">
                                        -{discount}%
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-3.5">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => openEditPrice(sp)}
                                        className="p-2 hover:bg-slate-100 rounded-md active:scale-[0.95]" title={cp.editPrice ?? '編輯定價'}>
                                        <Pencil className="h-4 w-4 text-slate-500" />
                                      </button>
                                      <button onClick={() => deletePrice(sp)}
                                        className="p-2 hover:bg-red-50 rounded-md active:scale-[0.95]" title="移除">
                                        <Trash2 className="h-4 w-4 text-red-400" />
                                      </button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══ Edit Customer Info Dialog ═══ */}
      <Dialog open={editInfoOpen} onOpenChange={setEditInfoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">{cp.basicInfo ?? '編輯客戶基本資訊'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm">{cp.taxId ?? '統一編號'}</Label>
              <Input className="h-11" value={editForm.taxId} maxLength={8} placeholder="8 位數字"
                onChange={e => setEditForm(f => ({ ...f, taxId: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{cp.invoiceTitle ?? '發票抬頭'}</Label>
              <Input className="h-11" value={editForm.invoiceTitle}
                onChange={e => setEditForm(f => ({ ...f, invoiceTitle: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{cp.invoiceAddress ?? '發票地址'}</Label>
              <Input className="h-11" value={editForm.invoiceAddress}
                onChange={e => setEditForm(f => ({ ...f, invoiceAddress: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{cp.paymentTerms ?? '付款條件'}</Label>
              <Input className="h-11" value={editForm.paymentTerms} placeholder="例: 月結30天"
                onChange={e => setEditForm(f => ({ ...f, paymentTerms: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{cp.creditLimit ?? '信用額度'}</Label>
              <Input className="h-11" type="number" value={editForm.creditLimit} placeholder="0"
                onChange={e => setEditForm(f => ({ ...f, creditLimit: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" className="h-11 px-5" onClick={() => setEditInfoOpen(false)}>取消</Button>
            <Button className="h-11 px-5" onClick={saveCustomerInfo} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Add Product Dialog ═══ */}
      <Dialog open={addDialogOpen} onOpenChange={v => { setAddDialogOpen(v); if (!v) setProductSearch('') }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg">{cp.addProduct ?? '新增品項'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input className="pl-12 h-12 text-base" placeholder="搜尋 SKU / 品名..."
                value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus />
              {productSearchLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
            <div className="rounded-lg border max-h-[400px] overflow-auto">
              {productSearchLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : productOptions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {productSearch.trim() ? '無符合的產品，或已全部加入' : '載入中...'}
                </div>
              ) : (() => {
                const grouped = new Map<string, ProductOption[]>()
                for (const p of productOptions) {
                  const cat = p.category || '其他'
                  const arr = grouped.get(cat) ?? []
                  arr.push(p)
                  grouped.set(cat, arr)
                }
                return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
                  <div key={cat}>
                    <div className="sticky top-0 bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-600 border-b">
                      {cat}（{items.length}）
                    </div>
                    {items.map(p => (
                      <button key={p.id}
                        className="w-full text-left px-5 py-3.5 hover:bg-blue-50 flex items-center justify-between border-b last:border-b-0 active:scale-[0.99]"
                        onClick={() => selectProductToAdd(p)}>
                        <div className="text-[15px]">
                          <span className="font-mono text-sm text-muted-foreground mr-2.5">{p.sku}</span>
                          <span>{p.name}</span>
                        </div>
                        <span className="text-muted-foreground tabular-nums text-sm ml-4">{fmt(p.sellingPrice)}</span>
                      </button>
                    ))}
                  </div>
                ))
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Price Dialog (Add/Edit) ═══ */}
      <Dialog open={priceDialog.open} onOpenChange={v => setPriceDialog(p => ({ ...p, open: v }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {priceDialog.mode === 'add' ? (cp.addProduct ?? '新增品項定價') : (cp.editPrice ?? '編輯定價')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label className="text-sm">品項</Label>
              <div className="text-[15px] mt-1.5 p-3 bg-slate-50 rounded-lg">
                <span className="font-mono text-sm text-muted-foreground mr-2">{priceDialog.productSku}</span>
                {priceDialog.productName}
                {priceDialog.catalogPrice != null && (
                  <span className="ml-2 text-muted-foreground">（目錄價 {fmt(priceDialog.catalogPrice)}）</span>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{cp.customerPrice ?? '客戶價'} *</Label>
              <Input className="h-12 text-lg tabular-nums" type="number" min="0" step="0.01" value={priceDialog.price}
                onChange={e => setPriceDialog(p => ({ ...p, price: e.target.value }))}
                autoFocus />
              {priceDialog.catalogPrice != null && priceDialog.price && !isNaN(Number(priceDialog.price)) && Number(priceDialog.price) > 0 && (
                <p className="text-sm text-muted-foreground mt-1.5">
                  相對目錄價折讓 {Math.round((1 - Number(priceDialog.price) / priceDialog.catalogPrice) * 100)}%
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">{cp.effectiveDate ?? '生效日'}</Label>
                <Input className="h-11" type="date" value={priceDialog.effectiveDate}
                  onChange={e => setPriceDialog(p => ({ ...p, effectiveDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{cp.expiryDate ?? '到期日'}</Label>
                <Input className="h-11" type="date" value={priceDialog.expiryDate}
                  onChange={e => setPriceDialog(p => ({ ...p, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">備註</Label>
              <Input className="h-11" value={priceDialog.notes}
                onChange={e => setPriceDialog(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" className="h-11 px-5" onClick={() => setPriceDialog(p => ({ ...p, open: false }))}>取消</Button>
            <Button className="h-11 px-5" onClick={savePrice} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <DollarSign className="h-4 w-4 mr-1.5" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
