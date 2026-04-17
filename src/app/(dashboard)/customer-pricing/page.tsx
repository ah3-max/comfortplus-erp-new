'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import {
  Search, Pencil, Trash2, Plus, Save, Building2, CreditCard,
  DollarSign, Package, Loader2,
} from 'lucide-react'

/* ─── Types ─── */
interface Customer {
  id: string; code: string; name: string; type: string
  taxId?: string | null; invoiceTitle?: string | null; invoiceAddress?: string | null
  paymentTerms?: string | null; creditLimit?: number | null; creditUsed?: number | null
}

interface PriceTierProduct {
  id: string; sku: string; name: string; category: string; unit: string
  sellingPrice: string | number | null
  priceTiers: Record<string, unknown> | null
}

interface SpecialPriceRecord {
  id: string; customerId: string; productId: string; price: string | number
  effectiveDate?: string | null; expiryDate?: string | null; notes?: string | null
  product?: { id: string; sku: string; name: string; unit: string }
}

interface CustomerPriceLevelRecord {
  customerId: string; priceLevel: string; notes?: string | null
}

/* ─── Helpers ─── */
const fmt = (n: number | string | null | undefined) => {
  if (n == null) return '—'
  const v = typeof n === 'string' ? parseFloat(n) : n
  return isNaN(v) ? '—' : `$${v.toLocaleString()}`
}

const TIER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const

/* ─── Page ─── */
export default function CustomerPricingPage() {
  const { dict } = useI18n()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = dict as any
  const cp = d.customerPricing ?? {}
  const nav = d.nav ?? {}
  const title = cp.title ?? nav.customerPricing ?? '客戶定價管理'

  /* ── Customer search state ── */
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showList, setShowList] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  /* ── Pricing data ── */
  const [priceLevel, setPriceLevel] = useState<string>('A')
  const [originalPriceLevel, setOriginalPriceLevel] = useState<string>('A')
  const [allProducts, setAllProducts] = useState<PriceTierProduct[]>([])
  const [specialPrices, setSpecialPrices] = useState<SpecialPriceRecord[]>([])
  const [productFilter, setProductFilter] = useState('')
  const [dataLoading, setDataLoading] = useState(false)

  /* ── Edit dialogs ── */
  const [editInfoOpen, setEditInfoOpen] = useState(false)
  const [editForm, setEditForm] = useState({ taxId: '', invoiceTitle: '', invoiceAddress: '', paymentTerms: '', creditLimit: '' })

  const [specialPriceDialog, setSpecialPriceDialog] = useState<{
    open: boolean; mode: 'add' | 'edit'; productId: string; productName: string
    price: string; effectiveDate: string; expiryDate: string; notes: string; existingId?: string
  }>({ open: false, mode: 'add', productId: '', productName: '', price: '', effectiveDate: '', expiryDate: '', notes: '' })

  const [saving, setSaving] = useState(false)

  /* ── Customer search ── */
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomers([]); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&pageSize=20`)
        const json = await res.json()
        setCustomers(json.data ?? [])
      } finally { setSearchLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  /* ── Load pricing data when customer selected ── */
  const loadPricingData = useCallback(async (custId: string) => {
    setDataLoading(true)
    try {
      const [tiersRes, specialRes, levelRes] = await Promise.all([
        fetch('/api/price-tiers').then(r => r.json()),
        fetch(`/api/special-prices?customerId=${custId}`).then(r => r.json()),
        fetch(`/api/customers/price-level?search=`).then(r => r.json()),
      ])
      setAllProducts(tiersRes.data ?? [])
      setSpecialPrices(specialRes.data ?? [])

      const levels: CustomerPriceLevelRecord[] = levelRes.data ?? []
      const cl = levels.find(l => l.customerId === custId)
      const lv = cl?.priceLevel ?? 'A'
      setPriceLevel(lv)
      setOriginalPriceLevel(lv)
    } finally { setDataLoading(false) }
  }, [])

  const selectCustomer = useCallback(async (c: Customer) => {
    // Fetch full customer detail for taxId/invoiceTitle etc.
    const res = await fetch(`/api/customers/${c.id}`)
    const full = await res.json()
    setSelectedCustomer(full)
    setShowList(false)
    setCustomerSearch('')
    loadPricingData(c.id)
  }, [loadPricingData])

  /* ── Derived: merged product pricing table ── */
  const specialMap = useMemo(() => {
    const m = new Map<string, SpecialPriceRecord>()
    for (const sp of specialPrices) m.set(sp.productId, sp)
    return m
  }, [specialPrices])

  const filteredProducts = useMemo(() => {
    if (!productFilter.trim()) return allProducts
    const q = productFilter.toLowerCase()
    return allProducts.filter(p =>
      p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    )
  }, [allProducts, productFilter])

  const getTierPrice = (product: PriceTierProduct): number | null => {
    const tiers = product.priceTiers as Record<string, string | number | null> | null
    if (!tiers) return null
    const key = `price${priceLevel}`
    const val = tiers[key]
    if (val == null) return null
    const n = Number(val)
    return n > 0 ? n : null
  }

  const getFinalPrice = (product: PriceTierProduct): { price: number; source: string } => {
    const sp = specialMap.get(product.id)
    if (sp) {
      const v = Number(sp.price)
      if (v > 0) return { price: v, source: '特殊價' }
    }
    const tp = getTierPrice(product)
    if (tp != null) return { price: tp, source: `${priceLevel}級價` }
    const def = Number(product.sellingPrice ?? 0)
    return { price: def, source: '目錄價' }
  }

  /* ── Save price level ── */
  const savePriceLevel = async () => {
    if (!selectedCustomer) return
    setSaving(true)
    try {
      const res = await fetch('/api/customers/price-level', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ customerId: selectedCustomer.id, priceLevel }] }),
      })
      if (!res.ok) throw new Error('儲存失敗')
      setOriginalPriceLevel(priceLevel)
      toast.success('價格等級已更新')
    } catch { toast.error('儲存失敗') }
    finally { setSaving(false) }
  }

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
      if (!res.ok) throw new Error('儲存失敗')
      const updated = await res.json()
      setSelectedCustomer(prev => prev ? { ...prev, ...updated } : prev)
      setEditInfoOpen(false)
      toast.success('客戶資訊已更新')
    } catch { toast.error('儲存失敗') }
    finally { setSaving(false) }
  }

  /* ── Special price CRUD ── */
  const openAddSpecialPrice = (product: PriceTierProduct) => {
    setSpecialPriceDialog({
      open: true, mode: 'add', productId: product.id, productName: `${product.sku} ${product.name}`,
      price: '', effectiveDate: new Date().toISOString().slice(0, 10), expiryDate: '', notes: '',
    })
  }

  const openEditSpecialPrice = (product: PriceTierProduct) => {
    const sp = specialMap.get(product.id)
    if (!sp) return
    setSpecialPriceDialog({
      open: true, mode: 'edit', productId: product.id, productName: `${product.sku} ${product.name}`,
      price: String(Number(sp.price)), existingId: sp.id,
      effectiveDate: sp.effectiveDate ? new Date(sp.effectiveDate).toISOString().slice(0, 10) : '',
      expiryDate: sp.expiryDate ? new Date(sp.expiryDate).toISOString().slice(0, 10) : '',
      notes: sp.notes ?? '',
    })
  }

  const saveSpecialPrice = async () => {
    if (!selectedCustomer) return
    const d = specialPriceDialog
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
      if (!res.ok) throw new Error('儲存失敗')
      setSpecialPriceDialog(prev => ({ ...prev, open: false }))
      toast.success(d.mode === 'add' ? '特殊價已新增' : '特殊價已更新')
      // Reload special prices
      const spRes = await fetch(`/api/special-prices?customerId=${selectedCustomer.id}`)
      const spJson = await spRes.json()
      setSpecialPrices(spJson.data ?? [])
    } catch { toast.error('儲存失敗') }
    finally { setSaving(false) }
  }

  const deleteSpecialPrice = async (productId: string) => {
    const sp = specialMap.get(productId)
    if (!sp || !selectedCustomer) return
    if (!confirm('確定刪除此特殊價？')) return
    try {
      const res = await fetch(`/api/special-prices?id=${sp.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('刪除失敗')
      toast.success('特殊價已刪除')
      setSpecialPrices(prev => prev.filter(s => s.id !== sp.id))
    } catch { toast.error('刪除失敗') }
  }

  /* ── Render ── */
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">{title}</h1>

      {/* ── Customer Search ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={cp.searchPlaceholder ?? '搜尋客戶名稱/代碼/統編...'}
              value={selectedCustomer ? `${selectedCustomer.code} — ${selectedCustomer.name}` : customerSearch}
              onChange={e => {
                if (selectedCustomer) { setSelectedCustomer(null); setAllProducts([]); setSpecialPrices([]) }
                setCustomerSearch(e.target.value)
                setShowList(true)
              }}
              onFocus={() => { if (customerSearch && !selectedCustomer) setShowList(true) }}
            />
            {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            {showList && customers.length > 0 && !selectedCustomer && (
              <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                {customers.map(c => (
                  <button key={c.id} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex justify-between items-center text-sm"
                    onClick={() => selectCustomer(c)}>
                    <span><span className="font-medium">{c.code}</span> — {c.name}</span>
                    <Badge variant="outline" className="text-xs">{c.type}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedCustomer && (
        <div className="text-center py-20 text-muted-foreground">
          {cp.noCustomerSelected ?? '請先選擇客戶'}
        </div>
      )}

      {selectedCustomer && dataLoading && (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
      )}

      {selectedCustomer && !dataLoading && (
        <>
          {/* ── Customer Info Card ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" />
                {cp.basicInfo ?? '客戶基本資訊'}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                setEditForm({
                  taxId: selectedCustomer.taxId ?? '',
                  invoiceTitle: selectedCustomer.invoiceTitle ?? '',
                  invoiceAddress: selectedCustomer.invoiceAddress ?? '',
                  paymentTerms: selectedCustomer.paymentTerms ?? '',
                  creditLimit: selectedCustomer.creditLimit ? String(selectedCustomer.creditLimit) : '',
                })
                setEditInfoOpen(true)
              }}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> {d.common?.edit ?? '編輯'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">客戶名稱：</span>{selectedCustomer.name}</div>
                <div><span className="text-muted-foreground">客戶代碼：</span>{selectedCustomer.code}</div>
                <div><span className="text-muted-foreground">{cp.taxId ?? '統一編號'}：</span>{selectedCustomer.taxId || '—'}</div>
                <div><span className="text-muted-foreground">{cp.invoiceTitle ?? '發票抬頭'}：</span>{selectedCustomer.invoiceTitle || '—'}</div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">{cp.invoiceAddress ?? '發票地址'}：</span>{selectedCustomer.invoiceAddress || '—'}</div>
                <div><span className="text-muted-foreground">{cp.paymentTerms ?? '付款條件'}：</span>{selectedCustomer.paymentTerms || '—'}</div>
                <div><span className="text-muted-foreground">{cp.creditLimit ?? '信用額度'}：</span>{fmt(selectedCustomer.creditLimit)}</div>
                <div><span className="text-muted-foreground">{cp.creditUsed ?? '已用額度'}：</span>{fmt(selectedCustomer.creditUsed)}</div>
              </div>
            </CardContent>
          </Card>

          {/* ── Price Level ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5" />
                {cp.priceLevel ?? '價格等級'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label>{cp.currentLevel ?? '目前等級'}：</Label>
                <Select value={priceLevel} onValueChange={v => { if (v) setPriceLevel(v) }}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIER_LABELS.map(l => <SelectItem key={l} value={l}>{l} 級</SelectItem>)}
                  </SelectContent>
                </Select>
                {priceLevel !== originalPriceLevel && (
                  <Button size="sm" onClick={savePriceLevel} disabled={saving}>
                    <Save className="h-3.5 w-3.5 mr-1" /> 儲存
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  等級價依 ProductPriceTier 的 {priceLevel} 欄帶入
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Product Pricing Table ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                {cp.productPricing ?? '商品定價一覽'}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                共 {allProducts.length} 項商品，{specialPrices.length} 項特殊價
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="搜尋 SKU / 商品名稱..."
                    value={productFilter} onChange={e => setProductFilter(e.target.value)} />
                </div>
              </div>

              <div className="rounded-md border overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-24">SKU</TableHead>
                      <TableHead>商品名稱</TableHead>
                      <TableHead className="text-right w-24">{cp.catalogPrice ?? '目錄價'}</TableHead>
                      <TableHead className="text-right w-24">{priceLevel}{cp.tierPrice ? ` ${cp.tierPrice}` : '級價'}</TableHead>
                      <TableHead className="text-right w-32">{cp.specialPrice ?? '特殊價'}</TableHead>
                      <TableHead className="text-right w-28">{cp.finalPrice ?? '最終價'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">無商品資料</TableCell></TableRow>
                    ) : filteredProducts.map(product => {
                      const sp = specialMap.get(product.id)
                      const tierPrice = getTierPrice(product)
                      const final_ = getFinalPrice(product)
                      return (
                        <TableRow key={product.id} className="group">
                          <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                          <TableCell>{product.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(product.sellingPrice)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(tierPrice)}</TableCell>
                          <TableCell className="text-right">
                            {sp ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="tabular-nums font-medium text-blue-700">{fmt(sp.price)}</span>
                                <button onClick={() => openEditSpecialPrice(product)}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded" title="編輯">
                                  <Pencil className="h-3.5 w-3.5 text-slate-500" />
                                </button>
                                <button onClick={() => deleteSpecialPrice(product.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded" title="刪除">
                                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => openAddSpecialPrice(product)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600" title="新增特殊價">
                                <Plus className="h-4 w-4" />
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="tabular-nums font-semibold">{fmt(final_.price)}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {final_.source}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                最終價 = 特殊價 &gt; {priceLevel}級價 &gt; 目錄價（依優先順序取第一個有值的價格）
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══ Edit Customer Info Dialog ═══ */}
      <Dialog open={editInfoOpen} onOpenChange={setEditInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{cp.basicInfo ?? '編輯客戶基本資訊'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{cp.taxId ?? '統一編號'}</Label>
              <Input value={editForm.taxId} maxLength={8} placeholder="8 位數字"
                onChange={e => setEditForm(f => ({ ...f, taxId: e.target.value }))} />
            </div>
            <div>
              <Label>{cp.invoiceTitle ?? '發票抬頭'}</Label>
              <Input value={editForm.invoiceTitle}
                onChange={e => setEditForm(f => ({ ...f, invoiceTitle: e.target.value }))} />
            </div>
            <div>
              <Label>{cp.invoiceAddress ?? '發票地址'}</Label>
              <Input value={editForm.invoiceAddress}
                onChange={e => setEditForm(f => ({ ...f, invoiceAddress: e.target.value }))} />
            </div>
            <div>
              <Label>{cp.paymentTerms ?? '付款條件'}</Label>
              <Input value={editForm.paymentTerms} placeholder="例: 月結30天"
                onChange={e => setEditForm(f => ({ ...f, paymentTerms: e.target.value }))} />
            </div>
            <div>
              <Label>{cp.creditLimit ?? '信用額度'}</Label>
              <Input type="number" value={editForm.creditLimit} placeholder="0"
                onChange={e => setEditForm(f => ({ ...f, creditLimit: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInfoOpen(false)}>取消</Button>
            <Button onClick={saveCustomerInfo} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Special Price Dialog ═══ */}
      <Dialog open={specialPriceDialog.open} onOpenChange={v => setSpecialPriceDialog(p => ({ ...p, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {specialPriceDialog.mode === 'add' ? (cp.addSpecialPrice ?? '新增特殊價') : (cp.editSpecialPrice ?? '編輯特殊價')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>商品</Label>
              <Input value={specialPriceDialog.productName} disabled />
            </div>
            <div>
              <Label>{cp.specialPrice ?? '特殊價'} *</Label>
              <Input type="number" min="0" step="0.01" value={specialPriceDialog.price}
                onChange={e => setSpecialPriceDialog(p => ({ ...p, price: e.target.value }))}
                autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{cp.effectiveDate ?? '生效日'}</Label>
                <Input type="date" value={specialPriceDialog.effectiveDate}
                  onChange={e => setSpecialPriceDialog(p => ({ ...p, effectiveDate: e.target.value }))} />
              </div>
              <div>
                <Label>{cp.expiryDate ?? '到期日'}</Label>
                <Input type="date" value={specialPriceDialog.expiryDate}
                  onChange={e => setSpecialPriceDialog(p => ({ ...p, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>備註</Label>
              <Input value={specialPriceDialog.notes}
                onChange={e => setSpecialPriceDialog(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpecialPriceDialog(p => ({ ...p, open: false }))}>取消</Button>
            <Button onClick={saveSpecialPrice} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <DollarSign className="h-4 w-4 mr-1" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
