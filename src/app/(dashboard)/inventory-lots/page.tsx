'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, Search, Package, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: '可用', LOCKED: '鎖定', PENDING_QC: '待驗', DEFECTIVE: '不良', SCRAPPED: '報廢', IN_TRANSIT: '在途', PENDING_TRANSFER: '待調撥',
}
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700', LOCKED: 'bg-yellow-100 text-yellow-700',
  PENDING_QC: 'bg-blue-100 text-blue-700', DEFECTIVE: 'bg-red-100 text-red-700',
  SCRAPPED: 'bg-gray-100 text-gray-500', IN_TRANSIT: 'bg-indigo-100 text-indigo-700',
  PENDING_TRANSFER: 'bg-orange-100 text-orange-700',
}
const CATEGORY_LABELS: Record<string, string> = {
  FINISHED_GOODS: '成品', OEM_PENDING: 'OEM待交', IN_TRANSIT: '在途', PACKAGING: '包材',
  RAW_MATERIAL: '原物料', DEFECTIVE: '不良品', GIFT_PROMO: '贈品',
}

interface InventoryLot {
  id: string; lotNo: string; quantity: number; lockedQty: number; status: string; category: string
  location: string | null; manufactureDate: string | null; expiryDate: string | null
  isNearExpiry: boolean; isExpired: boolean; factoryLotNo: string | null; notes: string | null
  product: { id: string; sku: string; name: string; unit: string | null }
  warehouse: { id: string; code: string; name: string }
  supplier: { id: string; name: string; country: string | null } | null
  purchaseOrder: { poNo: string } | null
}

interface Product { id: string; sku: string; name: string }
interface Warehouse { id: string; name: string; code: string }
interface Supplier { id: string; name: string; code: string }

export default function InventoryLotsPage() {
  const { dict } = useI18n()
  const [lots, setLots] = useState<InventoryLot[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [expiryAlert, setExpiryAlert] = useState(false)
  const [selected, setSelected] = useState<InventoryLot | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    productId: '', warehouseId: '', supplierId: '', quantity: '', category: 'FINISHED_GOODS',
    location: '', manufactureDate: '', expiryDate: '', factoryLotNo: '', notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(filterWarehouse && { warehouseId: filterWarehouse }),
        ...(filterStatus && { status: filterStatus }),
        ...(expiryAlert && { expiryAlert: 'true' }),
      })
      const res = await fetch(`/api/inventory/lots?${params}`)
      if (!res.ok) throw new Error()
      setLots(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [search, filterWarehouse, filterStatus, expiryAlert])

  useEffect(() => {
    Promise.all([
      fetch('/api/products?pageSize=500'),
      fetch('/api/warehouses'),
      fetch('/api/suppliers?pageSize=200'),
    ]).then(async ([p, w, s]) => {
      if (p.ok) { const d = await p.json(); setProducts(d.data ?? d) }
      if (w.ok) { const d = await w.json(); setWarehouses(d.data ?? d) }
      if (s.ok) { const d = await s.json(); setSuppliers(d.data ?? d) }
    })
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.productId || !form.warehouseId || !form.quantity) {
      toast.error(dict.inventoryLots.fieldsRequired)
      return
    }
    try {
      const res = await fetch('/api/inventory/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          supplierId: form.supplierId || null,
          manufactureDate: form.manufactureDate || null,
          expiryDate: form.expiryDate || null,
          factoryLotNo: form.factoryLotNo || null,
          location: form.location || null,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? dict.common.createFailed)
      toast.success(dict.inventoryLots.created)
      setShowCreate(false)
      setForm({ productId: '', warehouseId: '', supplierId: '', quantity: '', category: 'FINISHED_GOODS', location: '', manufactureDate: '', expiryDate: '', factoryLotNo: '', notes: '' })
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : dict.common.createFailed) }
  }

  const now = new Date()
  const soon = new Date(now.getTime() + 30 * 24 * 3600 * 1000)

  const nearExpiryCount = lots.filter(l => l.isNearExpiry && !l.isExpired).length
  const expiredCount = lots.filter(l => l.isExpired).length
  const totalQty = lots.reduce((s, l) => s + l.quantity, 0)

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-TW') : '-'
  const expiryClass = (l: InventoryLot) => {
    if (l.isExpired) return 'text-red-600 font-medium'
    if (l.isNearExpiry) return 'text-orange-500'
    return ''
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.inventoryLots ?? '批號管理'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">批號建立、效期追蹤、倉位管理</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus size={16} />建立批號
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">批號數</div>
          <div className="text-2xl font-bold">{lots.length}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">總庫存數量</div>
          <div className="text-2xl font-bold">{totalQty.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setExpiryAlert(true)}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={13} className="text-orange-500" />
            <span className="text-xs text-gray-400">30天內到期</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">{nearExpiryCount}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={13} className="text-red-500" />
            <span className="text-xs text-gray-400">已到期</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{expiredCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋批號、品名、工廠批號…" className="pl-8 h-9" />
        </div>
        <select value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)}
          className="border rounded-md px-3 h-9 text-sm bg-white">
          <option value="">全部倉庫</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-md px-3 h-9 text-sm bg-white">
          <option value="">全部狀態</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setExpiryAlert(v => !v)}
          className={`px-3 h-9 rounded text-sm border transition-colors ${expiryAlert ? 'bg-orange-500 text-white border-orange-500' : 'hover:bg-gray-50'}`}>
          <AlertTriangle size={13} className="inline mr-1" />效期警示
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['批號', '品項', '倉庫', '類別', '數量', '倉位', '製造日', '效期', '狀態'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">載入中…</td></tr>
              ) : lots.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-gray-400">
                    <Package size={36} className="mx-auto mb-2 opacity-30" />
                    <p>無批號資料</p>
                  </td>
                </tr>
              ) : lots.map(lot => (
                <tr key={lot.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(lot)}>
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-700">{lot.lotNo}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{lot.product.name}</div>
                    <div className="text-xs text-gray-400">{lot.product.sku}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{lot.warehouse.name}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{CATEGORY_LABELS[lot.category] ?? lot.category}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {lot.quantity} {lot.product.unit ?? ''}
                    {lot.lockedQty > 0 && <span className="text-xs text-yellow-600 ml-1">(鎖{lot.lockedQty})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{lot.location ?? '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(lot.manufactureDate)}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={expiryClass(lot)}>{fmtDate(lot.expiryDate)}</span>
                    {lot.isExpired && <span className="ml-1 text-red-500">⚠ 已過期</span>}
                    {lot.isNearExpiry && !lot.isExpired && <span className="ml-1 text-orange-400">⚠ 即將到期</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={STATUS_COLORS[lot.status] ?? 'bg-gray-100'}>{STATUS_LABELS[lot.status] ?? lot.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>建立批號</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">品項 *</div>
              <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                className="w-full border rounded-md px-3 h-9 text-sm bg-white">
                <option value="">請選擇品項</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">倉庫 *</div>
                <select value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))}
                  className="w-full border rounded-md px-3 h-9 text-sm bg-white">
                  <option value="">請選擇</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">數量 *</div>
                <Input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">類別</div>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border rounded-md px-3 h-9 text-sm bg-white">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">倉位代碼</div>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="A-01-03" className="h-9" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">供應商</div>
              <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                className="w-full border rounded-md px-3 h-9 text-sm bg-white">
                <option value="">請選擇（選填）</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">製造日期</div>
                <Input type="date" value={form.manufactureDate} onChange={e => setForm(f => ({ ...f, manufactureDate: e.target.value }))} className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">效期</div>
                <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">工廠原始批號</div>
              <Input value={form.factoryLotNo} onChange={e => setForm(f => ({ ...f, factoryLotNo: e.target.value }))}
                placeholder="廠商提供的批號" className="h-9" />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">備註</div>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-9" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} className="flex-1" disabled={!form.productId || !form.warehouseId || !form.quantity}>
                建立
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-mono">
                  {selected.lotNo}
                  <Badge className={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 mt-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['品項', selected.product.name], ['SKU', selected.product.sku],
                    ['倉庫', selected.warehouse.name], ['倉位', selected.location ?? '-'],
                    ['類別', CATEGORY_LABELS[selected.category] ?? selected.category],
                    ['數量', `${selected.quantity} ${selected.product.unit ?? ''}`],
                    ['鎖定', `${selected.lockedQty}`],
                    ['可用', `${selected.quantity - selected.lockedQty}`],
                    ['供應商', selected.supplier?.name ?? '-'],
                    ['工廠批號', selected.factoryLotNo ?? '-'],
                    ['採購單', selected.purchaseOrder?.poNo ?? '-'],
                    ['製造日', selected.manufactureDate ? new Date(selected.manufactureDate).toLocaleDateString('zh-TW') : '-'],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">{k}</div>
                      <div className="font-medium">{v}</div>
                    </div>
                  ))}
                </div>
                {selected.expiryDate && (
                  <div className={`text-xs rounded p-2 ${selected.isExpired ? 'bg-red-50 text-red-700' : selected.isNearExpiry ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    <div className="flex items-center gap-1.5">
                      {selected.isExpired || selected.isNearExpiry ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                      效期：{new Date(selected.expiryDate).toLocaleDateString('zh-TW')}
                      {selected.isExpired && ' — 已過期'}
                      {selected.isNearExpiry && !selected.isExpired && ' — 30天內到期'}
                    </div>
                  </div>
                )}
                {selected.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">{selected.notes}</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
