'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, Search, Tag, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

interface SpecialPrice {
  id: string
  price: number
  effectiveDate: string
  expiryDate: string | null
  notes: string | null
  customer: { id: string; name: string; code: string }
  product: { id: string; sku: string; name: string; unit: string | null }
}

interface Customer { id: string; name: string; code: string }
interface Product { id: string; sku: string; name: string; sellingPrice: number | null }

export default function PriceListsPage() {
  const { dict } = useI18n()
  const [prices, setPrices] = useState<SpecialPrice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<SpecialPrice | null>(null)
  const [form, setForm] = useState({
    customerId: '', productId: '', price: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    expiryDate: '', notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pricesRes, custRes, prodRes] = await Promise.all([
        fetch('/api/special-prices'),
        fetch('/api/customers?pageSize=500'),
        fetch('/api/products?pageSize=500'),
      ])
      if (pricesRes.ok) {
        const d = await pricesRes.json()
        setPrices(d.data ?? d)
      }
      if (custRes.ok) {
        const d = await custRes.json()
        setCustomers(d.data ?? d)
      }
      if (prodRes.ok) {
        const d = await prodRes.json()
        setProducts(d.data ?? d)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ customerId: '', productId: '', price: '', effectiveDate: new Date().toISOString().slice(0, 10), expiryDate: '', notes: '' })
    setShowDialog(true)
  }

  const openEdit = (p: SpecialPrice) => {
    setEditing(p)
    setForm({
      customerId: p.customer.id,
      productId: p.product.id,
      price: String(p.price),
      effectiveDate: p.effectiveDate.slice(0, 10),
      expiryDate: p.expiryDate ? p.expiryDate.slice(0, 10) : '',
      notes: p.notes ?? '',
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.customerId || !form.productId || !form.price) {
      toast.error('請填寫客戶、商品與特殊價格')
      return
    }
    try {
      const url = editing ? `/api/special-prices?id=${editing.id}` : '/api/special-prices'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          productId: form.productId,
          price: Number(form.price),
          effectiveDate: form.effectiveDate || undefined,
          expiryDate: form.expiryDate || null,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '儲存失敗')
      toast.success(editing ? '已更新特殊價格' : '已新增特殊價格')
      setShowDialog(false)
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '儲存失敗') }
  }

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`確定刪除「${label}」的特殊定價？`)) return
    try {
      const res = await fetch(`/api/special-prices?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('已刪除')
      load()
    } catch { toast.error('刪除失敗') }
  }

  const now = new Date()

  const filtered = prices.filter(p =>
    p.customer.name.toLowerCase().includes(search.toLowerCase()) ||
    p.customer.code.toLowerCase().includes(search.toLowerCase()) ||
    p.product.name.toLowerCase().includes(search.toLowerCase()) ||
    p.product.sku.toLowerCase().includes(search.toLowerCase())
  )

  const isExpired = (p: SpecialPrice) => p.expiryDate && new Date(p.expiryDate) < now
  const isActive = (p: SpecialPrice) => !isExpired(p) && new Date(p.effectiveDate) <= now

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.priceLists ?? '客戶特殊價格表'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">針對特定客戶設定商品特殊售價，優先於一般定價</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus size={16} />新增特殊定價
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">特殊定價總數</div>
          <div className="text-2xl font-bold">{prices.length}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">生效中</div>
          <div className="text-2xl font-bold text-emerald-600">{prices.filter(isActive).length}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">已過期</div>
          <div className="text-2xl font-bold text-red-500">{prices.filter(isExpired).length}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative bg-white border rounded-xl px-3">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋客戶、商品…" className="pl-8 border-0 shadow-none h-11" />
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['客戶', '商品', '特殊價格', '生效日', '到期日', '狀態', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">載入中…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Tag size={36} className="mx-auto mb-2 opacity-30" />
                    <p>無特殊定價資料</p>
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{p.customer.name}</div>
                    <div className="text-xs text-gray-400">{p.customer.code}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{p.product.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{p.product.sku}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-bold text-blue-700">NT${Number(p.price).toLocaleString()}</span>
                    {p.product.unit && <span className="text-xs text-gray-400 ml-1">/{p.product.unit}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(p.effectiveDate).toLocaleDateString('zh-TW')}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {p.expiryDate ? (
                      <span className={isExpired(p) ? 'text-red-500' : ''}>
                        {new Date(p.expiryDate).toLocaleDateString('zh-TW')}
                      </span>
                    ) : '無期限'}
                  </td>
                  <td className="px-4 py-2.5">
                    {isExpired(p) ? (
                      <Badge className="bg-red-100 text-red-700">已過期</Badge>
                    ) : isActive(p) ? (
                      <Badge className="bg-emerald-100 text-emerald-700">生效中</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-600">未開始</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                        <Pencil size={13} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(p.id, `${p.customer.name} × ${p.product.name}`)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '編輯特殊定價' : '新增特殊定價'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">客戶 *</div>
              <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                className="w-full border rounded-md px-3 h-9 text-sm bg-white">
                <option value="">請選擇客戶</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">商品 *</div>
              <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                className="w-full border rounded-md px-3 h-9 text-sm bg-white">
                <option value="">請選擇商品</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku}){p.sellingPrice ? ` — 定價 NT$${Number(p.sellingPrice).toLocaleString()}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">特殊售價 (NT$) *</div>
              <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="0" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">生效日期</div>
                <Input type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">到期日（留空=無期限）</div>
                <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">備註</div>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="備註" className="h-9" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} className="flex-1" disabled={!form.customerId || !form.productId || !form.price}>
                {editing ? '儲存' : '新增'}
              </Button>
              <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
