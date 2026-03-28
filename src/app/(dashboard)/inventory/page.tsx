'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { AdjustForm } from '@/components/inventory/adjust-form'
import {
  Search, AlertTriangle, Package, Loader2, SlidersHorizontal, History,
  ArrowLeftRight, ClipboardList, Trash2, BarChart3, Plus, CheckCircle2,
  XCircle, ChevronRight, Warehouse, CalendarDays, Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = 'stock' | 'lots' | 'transfer' | 'count' | 'scrap' | 'reports' | 'history'

const INV_CATEGORY_LABELS: Record<string, string> = {
  FINISHED_GOODS: '成品', OEM_PENDING: 'OEM待交', IN_TRANSIT: '在途',
  PACKAGING: '包材', RAW_MATERIAL: '原物料', DEFECTIVE: '不良品', GIFT_PROMO: '贈品',
}
const INV_CATEGORY_COLORS: Record<string, string> = {
  FINISHED_GOODS: 'bg-blue-100 text-blue-700',
  OEM_PENDING:    'bg-purple-100 text-purple-700',
  IN_TRANSIT:     'bg-amber-100 text-amber-700',
  PACKAGING:      'bg-cyan-100 text-cyan-700',
  RAW_MATERIAL:   'bg-green-100 text-green-700',
  DEFECTIVE:      'bg-red-100 text-red-700',
  GIFT_PROMO:     'bg-pink-100 text-pink-700',
}
const LOT_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  AVAILABLE:   { label: '可用',  cls: 'bg-green-100 text-green-700 border-green-200' },
  LOCKED:      { label: '鎖定',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  PENDING_QC:  { label: '待驗',  cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  DEFECTIVE:   { label: '不良',  cls: 'bg-red-100 text-red-700 border-red-200' },
  SCRAPPED:    { label: '已報廢', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}
const TRANSFER_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: '待出庫', cls: 'bg-amber-100 text-amber-700' },
  IN_TRANSIT: { label: '轉運中', cls: 'bg-blue-100 text-blue-700' },
  COMPLETED:  { label: '已完成', cls: 'bg-green-100 text-green-700' },
  CANCELLED:  { label: '已取消', cls: 'bg-slate-100 text-slate-500' },
}
const COUNT_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: '草稿',   cls: 'border-slate-300 text-slate-600' },
  COUNTING:  { label: '盤點中', cls: 'bg-blue-100 text-blue-700' },
  REVIEWING: { label: '複核中', cls: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: '已完成', cls: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '已取消', cls: 'bg-slate-100 text-slate-500' },
}
const TX_TYPE_CFG: Record<string, { label: string; color: string; sign: string }> = {
  IN:           { label: '入庫',   color: 'text-green-600', sign: '+' },
  OUT:          { label: '出庫',   color: 'text-red-600',   sign: '-' },
  TRANSFER_IN:  { label: '調撥入', color: 'text-blue-600',  sign: '+' },
  TRANSFER_OUT: { label: '調撥出', color: 'text-purple-600',sign: '-' },
  ADJUSTMENT:   { label: '盤點',   color: 'text-blue-600',  sign: '±' },
  SCRAP:        { label: '報廢',   color: 'text-red-600',   sign: '-' },
  RETURN:       { label: '退貨',   color: 'text-amber-600', sign: '+' },
}

function fmt(v: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(v))
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function isExpiringSoon(d: string | null | undefined) {
  if (!d) return false
  const days = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return days <= 30
}
function isExpired(d: string | null | undefined) {
  if (!d) return false
  return new Date(d) < new Date()
}

// ── Interfaces ───────────────────────────────────────────────────────────────
interface InventoryItem {
  id: string; productId: string; warehouse: string; category: string
  quantity: number; lockedQty: number; safetyStock: number
  product: { id: string; sku: string; name: string; category: string; unit: string; costPrice: string; sellingPrice: string }
}
interface InventoryLot {
  id: string; lotNo: string; category: string; status: string
  quantity: number; lockedQty: number; location: string | null
  manufactureDate: string | null; expiryDate: string | null
  sourceFactory: string | null; notes: string | null; createdAt: string
  product: { id: string; sku: string; name: string; unit: string }
  warehouse: { id: string; code: string; name: string }
  purchaseOrder: { poNo: string } | null
}
interface StockTransfer {
  id: string; transferNo: string; status: string; createdAt: string
  fromWarehouse: { code: string; name: string }
  toWarehouse:   { code: string; name: string }
  requestedBy:   { name: string }
  items: Array<{ id: string; quantity: number; product: { sku: string; name: string; unit: string } }>
}
interface StockCount {
  id: string; countNo: string; status: string; countDate: string | null; createdAt: string
  notes: string | null
  warehouse:  { code: string; name: string }
  createdBy:  { name: string }
  _count:     { items: number }
}
interface StockCountDetail {
  id: string; countNo: string; status: string; countDate: string | null
  warehouse: { code: string; name: string }
  items: Array<{
    id: string; systemQty: number; countedQty: number; variance: number; notes: string | null
    product: { sku: string; name: string; unit: string; category: string }
  }>
}
interface StockScrap {
  id: string; scrapNo: string; quantity: number; reason: string | null
  scrapDate: string; createdAt: string; notes: string | null
  product:   { sku: string; name: string; unit: string }
  warehouse: { code: string; name: string }
  lot:       { lotNo: string } | null
  createdBy: { name: string } | null
}
interface WmsReports {
  lowStock:     InventoryItem[]
  expiryLots:   InventoryLot[]
  dormantItems: Array<InventoryItem & { lastMovement: string | null }>
  totalValue:   number
  byCategory:   Array<{ category: string; _sum: { quantity: number | null } }>
  byWarehouse:  Array<{ warehouse: string; _sum: { quantity: number | null } }>
}
interface WarehouseOption { id: string; code: string; name: string }
interface ProductOption   { id: string; sku: string; name: string; unit: string }

// ── Main Component ────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('stock')

  // Inventory tab
  const [inventory, setInventory]           = useState<InventoryItem[]>([])
  const [invLoading, setInvLoading]         = useState(true)
  const [invSearch, setInvSearch]           = useState('')
  const [invWarehouse, setInvWarehouse]     = useState('')
  const [invCategory, setInvCategory]       = useState('')
  const [showLowStock, setShowLowStock]     = useState(false)
  const [adjustTarget, setAdjustTarget]     = useState<InventoryItem | null>(null)
  const [adjustOpen, setAdjustOpen]         = useState(false)

  // Lots tab
  const [lots, setLots]               = useState<InventoryLot[]>([])
  const [lotsLoading, setLotsLoading] = useState(false)
  const [lotsSearch, setLotsSearch]   = useState('')
  const [lotsStatus, setLotsStatus]   = useState('')
  const [lotsExpiry, setLotsExpiry]   = useState(false)
  const [lotEditOpen, setLotEditOpen] = useState(false)
  const [lotEditing, setLotEditing]   = useState<InventoryLot | null>(null)
  const [lotSaving, setLotSaving]     = useState(false)
  const [lotForm, setLotForm]         = useState({
    status: '', location: '', notes: '',
    manufactureDate: '', expiryDate: '', sourceFactory: '',
  })

  // Transfer tab
  const [transfers, setTransfers]           = useState<StockTransfer[]>([])
  const [trLoading, setTrLoading]           = useState(false)
  const [trStatus, setTrStatus]             = useState('')
  const [trNewOpen, setTrNewOpen]           = useState(false)
  const [trSaving, setTrSaving]             = useState(false)
  const [trForm, setTrForm]                 = useState({
    fromWarehouseId: '', toWarehouseId: '', notes: '',
    items: [{ productId: '', productName: '', quantity: 1 }],
  })

  // Count tab
  const [counts, setCounts]                 = useState<StockCount[]>([])
  const [ctLoading, setCtLoading]           = useState(false)
  const [ctStatus, setCtStatus]             = useState('')
  const [ctNewOpen, setCtNewOpen]           = useState(false)
  const [ctSaving, setCtSaving]             = useState(false)
  const [ctForm, setCtForm]                 = useState({ warehouseId: '', notes: '', countDate: '' })
  const [ctDetail, setCtDetail]             = useState<StockCountDetail | null>(null)
  const [ctDetailOpen, setCtDetailOpen]     = useState(false)
  const [ctDetailLoading, setCtDetailLoading] = useState(false)

  // Scrap tab
  const [scraps, setScraps]                 = useState<StockScrap[]>([])
  const [scLoading, setScLoading]           = useState(false)
  const [scSearch, setScSearch]             = useState('')
  const [scNewOpen, setScNewOpen]           = useState(false)
  const [scSaving, setScSaving]             = useState(false)
  const [scForm, setScForm]                 = useState({
    productId: '', productName: '', warehouseId: '', quantity: '',
    reason: '', notes: '', scrapDate: '',
  })

  // Reports tab
  const [reports, setReports]               = useState<WmsReports | null>(null)
  const [rpLoading, setRpLoading]           = useState(false)

  // History tab
  const [transactions, setTransactions]     = useState<Array<{
    id: string; type: string; quantity: number; beforeQty: number | null; afterQty: number | null
    warehouse: string; referenceType: string | null; notes: string | null; createdAt: string
    product: { sku: string; name: string; unit: string } | null
  }>>([])
  const [txLoading, setTxLoading]           = useState(false)

  // Shared data
  const [warehouses, setWarehouses]         = useState<WarehouseOption[]>([])
  const [products, setProducts]             = useState<ProductOption[]>([])

  // ── Fetch functions ──────────────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    setInvLoading(true)
    const p = new URLSearchParams()
    if (invSearch)    p.set('search',    invSearch)
    if (invWarehouse) p.set('warehouse', invWarehouse)
    if (invCategory)  p.set('invCategory', invCategory)
    if (showLowStock) p.set('lowStock',  'true')
    const res = await fetch(`/api/inventory?${p}`)
    setInventory(await res.json())
    setInvLoading(false)
  }, [invSearch, invWarehouse, invCategory, showLowStock])

  const fetchLots = useCallback(async () => {
    setLotsLoading(true)
    const p = new URLSearchParams()
    if (lotsSearch) p.set('search', lotsSearch)
    if (lotsStatus) p.set('status', lotsStatus)
    if (lotsExpiry) p.set('expiryAlert', 'true')
    const res = await fetch(`/api/inventory/lots?${p}`)
    setLots(await res.json())
    setLotsLoading(false)
  }, [lotsSearch, lotsStatus, lotsExpiry])

  const fetchTransfers = useCallback(async () => {
    setTrLoading(true)
    const p = new URLSearchParams()
    if (trStatus) p.set('status', trStatus)
    const res = await fetch(`/api/inventory/transfer?${p}`)
    setTransfers(await res.json())
    setTrLoading(false)
  }, [trStatus])

  const fetchCounts = useCallback(async () => {
    setCtLoading(true)
    const p = new URLSearchParams()
    if (ctStatus) p.set('status', ctStatus)
    const res = await fetch(`/api/inventory/count?${p}`)
    setCounts(await res.json())
    setCtLoading(false)
  }, [ctStatus])

  const fetchScraps = useCallback(async () => {
    setScLoading(true)
    const p = new URLSearchParams()
    if (scSearch) p.set('search', scSearch)
    const res = await fetch(`/api/inventory/scrap?${p}`)
    setScraps(await res.json())
    setScLoading(false)
  }, [scSearch])

  const fetchReports = useCallback(async () => {
    setRpLoading(true)
    const res = await fetch('/api/inventory/wms-reports')
    setReports(await res.json())
    setRpLoading(false)
  }, [])

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true)
    const res = await fetch('/api/inventory/transactions?limit=150')
    setTransactions(await res.json())
    setTxLoading(false)
  }, [])

  const fetchMeta = useCallback(async () => {
    const [wRes, pRes] = await Promise.all([
      fetch('/api/warehouses'),
      fetch('/api/products?limit=500'),
    ])
    if (wRes.ok) setWarehouses(await wRes.json())
    if (pRes.ok) {
      const data = await pRes.json()
      setProducts(Array.isArray(data) ? data : data.products ?? [])
    }
  }, [])

  useEffect(() => { fetchMeta() }, [fetchMeta])

  useEffect(() => {
    const t = setTimeout(fetchInventory, 300)
    return () => clearTimeout(t)
  }, [fetchInventory])

  useEffect(() => {
    if (activeTab === 'lots')     fetchLots()
    if (activeTab === 'transfer') fetchTransfers()
    if (activeTab === 'count')    fetchCounts()
    if (activeTab === 'scrap')    fetchScraps()
    if (activeTab === 'reports')  fetchReports()
    if (activeTab === 'history')  fetchTransactions()
  }, [activeTab, fetchLots, fetchTransfers, fetchCounts, fetchScraps, fetchReports, fetchTransactions])

  useEffect(() => {
    if (activeTab === 'lots') {
      const t = setTimeout(fetchLots, 300)
      return () => clearTimeout(t)
    }
  }, [lotsSearch, activeTab, fetchLots])

  // KPIs
  const lowStockCount = inventory.filter(i => i.quantity <= i.safetyStock && i.safetyStock > 0).length
  const totalValue    = inventory.reduce((s, i) => s + i.quantity * Number(i.product.costPrice), 0)
  const expirySoonCount = lots.filter(l => isExpiringSoon(l.expiryDate) && !isExpired(l.expiryDate)).length

  // ── Tab Transfer Actions ────────────────────────────────────────────────
  async function transferAction(id: string, action: string) {
    const res = await fetch(`/api/inventory/transfer/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      toast.success(action === 'complete' ? '調撥已完成，庫存已更新' : action === 'confirm' ? '調撥已確認出庫' : '調撥已取消')
      fetchTransfers()
      fetchInventory()
    } else {
      const d = await res.json()
      toast.error(d.error ?? '操作失敗')
    }
  }

  async function handleNewTransfer() {
    if (!trForm.fromWarehouseId || !trForm.toWarehouseId) { toast.error('請選擇出入庫倉庫'); return }
    const validItems = trForm.items.filter(i => i.productId && i.quantity > 0)
    if (!validItems.length) { toast.error('請新增至少一項商品'); return }
    setTrSaving(true)
    const res = await fetch('/api/inventory/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...trForm, items: validItems }),
    })
    setTrSaving(false)
    if (res.ok) {
      toast.success('調撥單已建立')
      setTrNewOpen(false)
      setTrForm({ fromWarehouseId: '', toWarehouseId: '', notes: '', items: [{ productId: '', productName: '', quantity: 1 }] })
      fetchTransfers()
    } else {
      const d = await res.json()
      toast.error(d.error ?? '建立失敗')
    }
  }

  // ── Count Actions ───────────────────────────────────────────────────────
  async function handleNewCount() {
    if (!ctForm.warehouseId) { toast.error('請選擇倉庫'); return }
    setCtSaving(true)
    const res = await fetch('/api/inventory/count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ctForm),
    })
    setCtSaving(false)
    if (res.ok) {
      toast.success('盤點單已建立')
      setCtNewOpen(false)
      setCtForm({ warehouseId: '', notes: '', countDate: '' })
      fetchCounts()
    } else {
      const d = await res.json()
      toast.error(d.error ?? '建立失敗')
    }
  }

  async function openCountDetail(id: string) {
    setCtDetailLoading(true)
    setCtDetailOpen(true)
    const res = await fetch(`/api/inventory/count/${id}`)
    if (res.ok) setCtDetail(await res.json())
    setCtDetailLoading(false)
  }

  async function countStatusUpdate(id: string, status: string) {
    const res = await fetch(`/api/inventory/count/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(status === 'COMPLETED' ? '盤點已完成，庫存已調整' : '狀態已更新')
      fetchCounts()
      if (ctDetail?.id === id) {
        const r2 = await fetch(`/api/inventory/count/${id}`)
        if (r2.ok) setCtDetail(await r2.json())
      }
    } else {
      const d = await res.json()
      toast.error(d.error ?? '操作失敗')
    }
  }

  async function saveCountItems() {
    if (!ctDetail) return
    const res = await fetch(`/api/inventory/count/${ctDetail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateItems: true,
        items: ctDetail.items.map(i => ({ id: i.id, countedQty: i.countedQty, notes: i.notes })),
      }),
    })
    if (res.ok) toast.success('盤點數量已儲存')
    else toast.error('儲存失敗')
  }

  // ── Scrap Actions ───────────────────────────────────────────────────────
  async function handleNewScrap() {
    if (!scForm.productId || !scForm.warehouseId || !scForm.quantity) { toast.error('請填寫必要欄位'); return }
    setScSaving(true)
    const res = await fetch('/api/inventory/scrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scForm),
    })
    setScSaving(false)
    if (res.ok) {
      toast.success('報廢記錄已建立，庫存已扣除')
      setScNewOpen(false)
      setScForm({ productId: '', productName: '', warehouseId: '', quantity: '', reason: '', notes: '', scrapDate: '' })
      fetchScraps()
      fetchInventory()
    } else {
      const d = await res.json()
      toast.error(d.error ?? '操作失敗')
    }
  }

  // ── Lot Edit ────────────────────────────────────────────────────────────
  function openLotEdit(lot: InventoryLot) {
    setLotEditing(lot)
    setLotForm({
      status:          lot.status,
      location:        lot.location        ?? '',
      notes:           lot.notes           ?? '',
      manufactureDate: lot.manufactureDate ? lot.manufactureDate.slice(0, 10) : '',
      expiryDate:      lot.expiryDate      ? lot.expiryDate.slice(0, 10)      : '',
      sourceFactory:   lot.sourceFactory   ?? '',
    })
    setLotEditOpen(true)
  }

  async function handleLotSave() {
    if (!lotEditing) return
    setLotSaving(true)
    const res = await fetch(`/api/inventory/lots/${lotEditing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lotForm),
    })
    setLotSaving(false)
    if (res.ok) { toast.success('批號已更新'); setLotEditOpen(false); fetchLots() }
    else toast.error('更新失敗')
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'stock',    label: '即時庫存', icon: <Package className="h-4 w-4" /> },
    { key: 'lots',     label: '批號管理', icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'transfer', label: '調撥管理', icon: <ArrowLeftRight className="h-4 w-4" /> },
    { key: 'count',    label: '盤點管理', icon: <ClipboardList className="h-4 w-4" /> },
    { key: 'scrap',    label: '報廢管理', icon: <Trash2 className="h-4 w-4" /> },
    { key: 'reports',  label: '庫存報表', icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'history',  label: '異動記錄', icon: <History className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">庫存管理</h1>
          <p className="text-sm text-muted-foreground">WMS 全模組</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => {
            const params = new URLSearchParams()
            if (invSearch)    params.set('search', invSearch)
            if (invWarehouse) params.set('warehouseId', invWarehouse)
            window.open(`/api/inventory/export?${params}`, '_blank')
          }}>
            <Download className="mr-2 h-4 w-4" />匯出庫存
          </Button>
          <Button variant="outline" onClick={() => router.push('/warehouses')}>
            <Warehouse className="mr-2 h-4 w-4" />倉庫管理
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '商品種類',   value: inventory.length,   icon: <Package className="h-4 w-4 text-blue-600" />,    cls: 'bg-blue-50' },
          { label: '低庫存警示', value: lowStockCount,       icon: <AlertTriangle className="h-4 w-4 text-red-600" />,cls: 'bg-red-50',   highlight: lowStockCount > 0 },
          { label: '近效期批號', value: expirySoonCount,     icon: <CalendarDays className="h-4 w-4 text-amber-600" />,cls: 'bg-amber-50',highlight: expirySoonCount > 0 },
          { label: '庫存總值',   value: fmt(totalValue),    icon: <BarChart3 className="h-4 w-4 text-green-600" />,  cls: 'bg-green-50' },
        ].map(({ label, value, icon, cls, highlight }) => (
          <Card key={label} className={highlight ? 'border-red-200' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg ${cls} p-2`}>{icon}</div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn('text-lg font-bold', highlight ? 'text-red-600' : '')}>{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b overflow-x-auto">
        {tabs.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── Tab: 即時庫存 ─────────────────────────────────────────────────── */}
      {activeTab === 'stock' && (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="搜尋商品名稱、SKU..."
                value={invSearch} onChange={e => setInvSearch(e.target.value)} />
            </div>
            <select value={invWarehouse} onChange={e => setInvWarehouse(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm">
              <option value="">全部倉庫</option>
              {warehouses.map(w => <option key={w.id} value={w.code}>{w.name} ({w.code})</option>)}
            </select>
            <select value={invCategory} onChange={e => setInvCategory(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm">
              <option value="">全部分類</option>
              {Object.entries(INV_CATEGORY_LABELS).map(([k, v]) =>
                <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => setShowLowStock(!showLowStock)}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium flex items-center gap-1 transition-colors',
                showLowStock ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
              <AlertTriangle className="h-3 w-3" />低庫存
            </button>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">SKU</TableHead>
                  <TableHead>商品名稱</TableHead>
                  <TableHead className="w-24">庫存分類</TableHead>
                  <TableHead className="w-20">倉庫</TableHead>
                  <TableHead className="text-center w-20">庫存量</TableHead>
                  <TableHead className="text-center w-20">鎖定量</TableHead>
                  <TableHead className="text-center w-20">可用量</TableHead>
                  <TableHead className="text-center w-20">安全庫存</TableHead>
                  <TableHead className="text-center w-24">狀態</TableHead>
                  <TableHead className="text-right w-28">庫存值</TableHead>
                  <TableHead className="w-16 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invLoading ? (
                  <TableRow><TableCell colSpan={11} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : inventory.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="py-16 text-center text-muted-foreground">
                    尚無庫存資料
                  </TableCell></TableRow>
                ) : inventory.map(item => {
                  const isLow  = item.quantity <= item.safetyStock && item.safetyStock > 0
                  const isZero = item.quantity === 0
                  const avail  = item.quantity - item.lockedQty
                  return (
                    <TableRow key={item.id} className={cn('group', isLow && 'bg-red-50/30')}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.product.sku}</TableCell>
                      <TableCell className="font-medium text-sm">{item.product.name}</TableCell>
                      <TableCell>
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          INV_CATEGORY_COLORS[item.category] ?? 'bg-slate-100 text-slate-600')}>
                          {INV_CATEGORY_LABELS[item.category] ?? item.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{item.warehouse}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn('font-bold', isZero ? 'text-red-600' : isLow ? 'text-amber-600' : '')}>
                          {item.quantity}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">{item.product.unit}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm text-amber-600">{item.lockedQty || '—'}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn('font-medium text-sm', avail <= 0 ? 'text-red-600' : 'text-green-600')}>
                          {avail}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">{item.safetyStock}</TableCell>
                      <TableCell className="text-center">
                        {isZero ? <Badge variant="destructive" className="text-xs">缺貨</Badge>
                          : isLow ? <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs">
                            <AlertTriangle className="mr-1 h-3 w-3" />低庫存</Badge>
                          : <Badge variant="outline" className="border-green-400 text-green-600 text-xs">正常</Badge>}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {fmt(item.quantity * Number(item.product.costPrice))}
                      </TableCell>
                      <TableCell className="text-center">
                        <button onClick={() => { setAdjustTarget(item); setAdjustOpen(true) }}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                          <SlidersHorizontal className="h-3.5 w-3.5" />調整
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* ── Tab: 批號管理 ─────────────────────────────────────────────────── */}
      {activeTab === 'lots' && (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="搜尋批號、商品、工廠..."
                value={lotsSearch} onChange={e => setLotsSearch(e.target.value)} />
            </div>
            <select value={lotsStatus} onChange={e => setLotsStatus(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm">
              <option value="">全部狀態</option>
              {Object.entries(LOT_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => setLotsExpiry(!lotsExpiry)}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium flex items-center gap-1 transition-colors',
                lotsExpiry ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
              <CalendarDays className="h-3 w-3" />近效期
            </button>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">批號</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead className="w-20">倉庫</TableHead>
                  <TableHead className="w-24">儲位</TableHead>
                  <TableHead className="w-24">庫存分類</TableHead>
                  <TableHead className="w-20">狀態</TableHead>
                  <TableHead className="text-center w-20">數量</TableHead>
                  <TableHead className="w-28">製造日</TableHead>
                  <TableHead className="w-28">效期</TableHead>
                  <TableHead className="w-28">來源工廠</TableHead>
                  <TableHead className="w-20">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotsLoading ? (
                  <TableRow><TableCell colSpan={11} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : lots.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="py-16 text-center text-muted-foreground">
                    尚無批號資料
                  </TableCell></TableRow>
                ) : lots.map(lot => {
                  const sc = LOT_STATUS_CFG[lot.status] ?? { label: lot.status, cls: '' }
                  const expired = isExpired(lot.expiryDate)
                  const expiring = isExpiringSoon(lot.expiryDate) && !expired
                  return (
                    <TableRow key={lot.id} className={cn('group', expired && 'bg-red-50/30', expiring && 'bg-amber-50/30')}>
                      <TableCell className="font-mono text-xs">{lot.lotNo}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{lot.product.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{lot.product.sku}</div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{lot.warehouse.code}</TableCell>
                      <TableCell className="text-xs">{lot.location || '—'}</TableCell>
                      <TableCell>
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          INV_CATEGORY_COLORS[lot.category] ?? 'bg-slate-100 text-slate-600')}>
                          {INV_CATEGORY_LABELS[lot.category] ?? lot.category}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', sc.cls)}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{lot.quantity}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{lot.product.unit}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(lot.manufactureDate)}</TableCell>
                      <TableCell>
                        {lot.expiryDate ? (
                          <span className={cn('text-sm font-medium',
                            expired ? 'text-red-600' : expiring ? 'text-amber-600' : 'text-muted-foreground')}>
                            {fmtDate(lot.expiryDate)}
                            {expired && ' 已過期'}
                            {expiring && ' 即將到期'}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{lot.sourceFactory || '—'}</TableCell>
                      <TableCell>
                        <button onClick={() => openLotEdit(lot)}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                          <SlidersHorizontal className="h-3 w-3" />編輯
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* ── Tab: 調撥管理 ─────────────────────────────────────────────────── */}
      {activeTab === 'transfer' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {['', 'PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'].map(s => (
                <button key={s} onClick={() => setTrStatus(s)}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    trStatus === s ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                  {s === '' ? '全部' : TRANSFER_STATUS_CFG[s]?.label}
                </button>
              ))}
            </div>
            <Button onClick={() => setTrNewOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />新增調撥單
            </Button>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">調撥單號</TableHead>
                  <TableHead>出庫倉庫</TableHead>
                  <TableHead>入庫倉庫</TableHead>
                  <TableHead className="w-20">狀態</TableHead>
                  <TableHead>品項</TableHead>
                  <TableHead className="w-32">申請人</TableHead>
                  <TableHead className="w-28">建立日期</TableHead>
                  <TableHead className="w-28">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trLoading ? (
                  <TableRow><TableCell colSpan={8} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : transfers.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                    尚無調撥記錄
                  </TableCell></TableRow>
                ) : transfers.map(tr => {
                  const sc = TRANSFER_STATUS_CFG[tr.status] ?? { label: tr.status, cls: '' }
                  return (
                    <TableRow key={tr.id}>
                      <TableCell className="font-mono text-sm">{tr.transferNo}</TableCell>
                      <TableCell className="text-sm">{tr.fromWarehouse.name}</TableCell>
                      <TableCell className="text-sm">{tr.toWarehouse.name}</TableCell>
                      <TableCell>
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', sc.cls)}>
                          {sc.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tr.items.map(i => `${i.product.name} ×${i.quantity}`).join('、')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tr.requestedBy.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(tr.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {tr.status === 'PENDING' && (
                            <button onClick={() => transferAction(tr.id, 'confirm')}
                              className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100">
                              <CheckCircle2 className="h-3 w-3" />確認出庫
                            </button>
                          )}
                          {(tr.status === 'IN_TRANSIT' || tr.status === 'PENDING') && (
                            <button onClick={() => transferAction(tr.id, 'complete')}
                              className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100">
                              <CheckCircle2 className="h-3 w-3" />完成
                            </button>
                          )}
                          {!['COMPLETED', 'CANCELLED'].includes(tr.status) && (
                            <button onClick={() => transferAction(tr.id, 'cancel')}
                              className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">
                              <XCircle className="h-3 w-3" />取消
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* ── Tab: 盤點管理 ─────────────────────────────────────────────────── */}
      {activeTab === 'count' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {['', 'DRAFT', 'COUNTING', 'REVIEWING', 'COMPLETED'].map(s => (
                <button key={s} onClick={() => setCtStatus(s)}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    ctStatus === s ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                  {s === '' ? '全部' : COUNT_STATUS_CFG[s]?.label}
                </button>
              ))}
            </div>
            <Button onClick={() => setCtNewOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />建立盤點單
            </Button>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">盤點單號</TableHead>
                  <TableHead className="w-24">倉庫</TableHead>
                  <TableHead className="w-20">狀態</TableHead>
                  <TableHead className="w-28">盤點日期</TableHead>
                  <TableHead className="w-20">品項數</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead className="w-32">建立人</TableHead>
                  <TableHead className="w-32">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ctLoading ? (
                  <TableRow><TableCell colSpan={8} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : counts.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                    尚無盤點記錄
                  </TableCell></TableRow>
                ) : counts.map(ct => {
                  const sc = COUNT_STATUS_CFG[ct.status] ?? { label: ct.status, cls: '' }
                  return (
                    <TableRow key={ct.id} className="group cursor-pointer hover:bg-slate-50"
                      onClick={() => openCountDetail(ct.id)}>
                      <TableCell className="font-mono text-sm">{ct.countNo}</TableCell>
                      <TableCell className="text-sm">{ct.warehouse.name}</TableCell>
                      <TableCell><Badge variant="outline" className={cn('text-xs', sc.cls)}>{sc.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(ct.countDate)}</TableCell>
                      <TableCell className="text-center text-sm">{ct._count.items}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{ct.notes || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{ct.createdBy.name}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {ct.status === 'DRAFT' && (
                            <button onClick={() => countStatusUpdate(ct.id, 'COUNTING')}
                              className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100">
                              開始盤點
                            </button>
                          )}
                          {ct.status === 'COUNTING' && (
                            <button onClick={() => countStatusUpdate(ct.id, 'REVIEWING')}
                              className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100">
                              送複核
                            </button>
                          )}
                          {ct.status === 'REVIEWING' && (
                            <button onClick={() => countStatusUpdate(ct.id, 'COMPLETED')}
                              className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100">
                              完成盤點
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* ── Tab: 報廢管理 ─────────────────────────────────────────────────── */}
      {activeTab === 'scrap' && (
        <>
          <div className="flex items-center justify-between">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="搜尋報廢單或商品..."
                value={scSearch} onChange={e => setScSearch(e.target.value)} />
            </div>
            <Button variant="destructive" onClick={() => setScNewOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />登錄報廢
            </Button>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">報廢單號</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead className="w-20">倉庫</TableHead>
                  <TableHead className="w-20">批號</TableHead>
                  <TableHead className="text-center w-20">數量</TableHead>
                  <TableHead>報廢原因</TableHead>
                  <TableHead className="w-28">報廢日期</TableHead>
                  <TableHead className="w-24">登錄人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scLoading ? (
                  <TableRow><TableCell colSpan={8} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : scraps.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                    尚無報廢記錄
                  </TableCell></TableRow>
                ) : scraps.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.scrapNo}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{s.product.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{s.product.sku}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{s.warehouse.code}</TableCell>
                    <TableCell className="text-xs font-mono">{s.lot?.lotNo || '—'}</TableCell>
                    <TableCell className="text-center font-bold text-red-600">{s.quantity} {s.product.unit}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.reason || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(s.scrapDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.createdBy?.name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* ── Tab: 庫存報表 ─────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        rpLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">庫存總值</p>
                <p className="text-xl font-bold">{fmt(reports.totalValue)}</p>
              </CardContent></Card>
              <Card className={reports.lowStock.length > 0 ? 'border-red-200' : ''}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">低庫存品項</p>
                  <p className={cn('text-xl font-bold', reports.lowStock.length > 0 && 'text-red-600')}>
                    {reports.lowStock.length}
                  </p>
                </CardContent>
              </Card>
              <Card className={reports.expiryLots.length > 0 ? 'border-amber-200' : ''}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">近效期批號(30天)</p>
                  <p className={cn('text-xl font-bold', reports.expiryLots.length > 0 && 'text-amber-600')}>
                    {reports.expiryLots.length}
                  </p>
                </CardContent>
              </Card>
              <Card className={reports.dormantItems.length > 0 ? 'border-slate-200' : ''}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">呆滯庫存(90天)</p>
                  <p className="text-xl font-bold text-slate-600">{reports.dormantItems.length}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {/* 低庫存清單 */}
              {reports.lowStock.length > 0 && (
                <Card className="col-span-2 lg:col-span-1">
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />低庫存清單
                  </CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>商品</TableHead>
                          <TableHead className="text-center">庫存</TableHead>
                          <TableHead className="text-center">安全庫存</TableHead>
                          <TableHead className="text-center">缺口</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.lowStock.map(i => (
                          <TableRow key={i.id}>
                            <TableCell>
                              <div className="text-sm font-medium">{i.product.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{i.product.sku}</div>
                            </TableCell>
                            <TableCell className="text-center font-bold text-red-600">{i.quantity}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{i.safetyStock}</TableCell>
                            <TableCell className="text-center text-red-600 font-medium">
                              -{i.safetyStock - i.quantity}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* 近效期批號 */}
              {reports.expiryLots.length > 0 && (
                <Card className="col-span-2 lg:col-span-1">
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                    <CalendarDays className="h-4 w-4" />近效期批號
                  </CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>批號</TableHead>
                          <TableHead>商品</TableHead>
                          <TableHead className="text-center">數量</TableHead>
                          <TableHead>效期</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.expiryLots.map(l => {
                          const expired = isExpired(l.expiryDate)
                          return (
                            <TableRow key={l.id}>
                              <TableCell className="font-mono text-xs">{l.lotNo}</TableCell>
                              <TableCell className="text-sm">{l.product.name}</TableCell>
                              <TableCell className="text-center">{l.quantity} {l.product.unit}</TableCell>
                              <TableCell className={cn('text-sm font-medium', expired ? 'text-red-600' : 'text-amber-600')}>
                                {fmtDate(l.expiryDate)}
                                {expired && ' ⚠已過期'}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* 呆滯庫存 */}
              {reports.dormantItems.length > 0 && (
                <Card className="col-span-2">
                  <CardHeader><CardTitle className="text-sm text-slate-600">呆滯庫存清單（90天無異動）</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>商品</TableHead>
                          <TableHead className="w-20">倉庫</TableHead>
                          <TableHead className="text-center">數量</TableHead>
                          <TableHead>最後異動</TableHead>
                          <TableHead className="text-right">庫存值</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.dormantItems.map(i => (
                          <TableRow key={i.id}>
                            <TableCell>
                              <div className="text-sm font-medium">{i.product.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{i.product.sku}</div>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{i.warehouse}</TableCell>
                            <TableCell className="text-center">{i.quantity} {i.product.unit}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {i.lastMovement ? fmtDate(i.lastMovement) : '從未異動'}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {fmt(i.quantity * Number(i.product.costPrice))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* 分類分布 */}
              <Card>
                <CardHeader><CardTitle className="text-sm">庫存分類分布</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {reports.byCategory.map(bc => (
                    <div key={bc.category} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          INV_CATEGORY_COLORS[bc.category] ?? 'bg-slate-100 text-slate-600')}>
                          {INV_CATEGORY_LABELS[bc.category] ?? bc.category}
                        </span>
                      </div>
                      <span className="font-medium">{bc._sum.quantity ?? 0} 件</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 倉庫分布 */}
              <Card>
                <CardHeader><CardTitle className="text-sm">倉庫庫存分布</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {reports.byWarehouse.map(bw => (
                    <div key={bw.warehouse} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-muted-foreground">{bw.warehouse}</span>
                      <span className="font-medium">{bw._sum.quantity ?? 0} 件</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )
      )}

      {/* ── Tab: 異動記錄 ─────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">時間</TableHead>
                <TableHead>商品</TableHead>
                <TableHead className="w-20">類型</TableHead>
                <TableHead className="text-center w-20">數量</TableHead>
                <TableHead className="text-center w-20">前庫存</TableHead>
                <TableHead className="text-center w-20">後庫存</TableHead>
                <TableHead className="w-16">倉庫</TableHead>
                <TableHead className="w-24">來源</TableHead>
                <TableHead>備註</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txLoading ? (
                <TableRow><TableCell colSpan={9} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell></TableRow>
              ) : transactions.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                  尚無異動記錄
                </TableCell></TableRow>
              ) : transactions.map(tx => {
                const tc = TX_TYPE_CFG[tx.type] ?? { label: tx.type, color: 'text-slate-600', sign: '' }
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(tx.createdAt)}</TableCell>
                    <TableCell>
                      {tx.product ? (
                        <div>
                          <span className="font-medium text-sm">{tx.product.name}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{tx.product.sku}</span>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell><span className={cn('text-sm font-medium', tc.color)}>{tc.label}</span></TableCell>
                    <TableCell className={cn('text-center font-medium', tc.color)}>{tc.sign}{tx.quantity}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{tx.beforeQty ?? '—'}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{tx.afterQty ?? '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{tx.warehouse}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tx.referenceType === 'PURCHASE_RECEIPT' ? '進貨驗收'
                        : tx.referenceType === 'SHIPMENT' ? '出貨單'
                        : tx.referenceType === 'MANUAL' ? '手動調整'
                        : tx.referenceType === 'TRANSFER' ? '調撥'
                        : tx.referenceType === 'STOCK_COUNT' ? '盤點'
                        : tx.referenceType === 'SCRAP' ? '報廢'
                        : tx.referenceType ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tx.notes ?? '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ══ Dialogs ══════════════════════════════════════════════════════════ */}

      {/* Lot Edit Dialog */}
      <Dialog open={lotEditOpen} onOpenChange={o => !o && setLotEditOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>編輯批號 {lotEditing?.lotNo}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>批號狀態</Label>
                <select value={lotForm.status} onChange={e => setLotForm(f => ({ ...f, status: e.target.value }))}
                  className="h-9 w-full rounded-md border px-3 text-sm">
                  {Object.entries(LOT_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>儲位</Label>
                <Input value={lotForm.location} onChange={e => setLotForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="A-01-03" />
              </div>
              <div className="space-y-1.5">
                <Label>製造日</Label>
                <Input type="date" value={lotForm.manufactureDate}
                  onChange={e => setLotForm(f => ({ ...f, manufactureDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>效期</Label>
                <Input type="date" value={lotForm.expiryDate}
                  onChange={e => setLotForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>來源工廠</Label>
                <Input value={lotForm.sourceFactory}
                  onChange={e => setLotForm(f => ({ ...f, sourceFactory: e.target.value }))}
                  placeholder="工廠名稱" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea rows={2} value={lotForm.notes}
                onChange={e => setLotForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLotEditOpen(false)} disabled={lotSaving}>取消</Button>
            <Button onClick={handleLotSave} disabled={lotSaving}>
              {lotSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Transfer Dialog */}
      <Dialog open={trNewOpen} onOpenChange={o => !o && setTrNewOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增調撥單</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>出庫倉庫 <span className="text-red-500">*</span></Label>
                <select value={trForm.fromWarehouseId}
                  onChange={e => setTrForm(f => ({ ...f, fromWarehouseId: e.target.value }))}
                  className="h-9 w-full rounded-md border px-3 text-sm">
                  <option value="">選擇倉庫</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>入庫倉庫 <span className="text-red-500">*</span></Label>
                <select value={trForm.toWarehouseId}
                  onChange={e => setTrForm(f => ({ ...f, toWarehouseId: e.target.value }))}
                  className="h-9 w-full rounded-md border px-3 text-sm">
                  <option value="">選擇倉庫</option>
                  {warehouses.filter(w => w.id !== trForm.fromWarehouseId).map(w =>
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>調撥品項</Label>
                <button onClick={() => setTrForm(f => ({ ...f, items: [...f.items, { productId: '', productName: '', quantity: 1 }] }))}
                  className="text-xs text-blue-600 hover:underline">+ 新增品項</button>
              </div>
              {trForm.items.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <select value={item.productId}
                    onChange={e => {
                      const p = products.find(p => p.id === e.target.value)
                      setTrForm(f => ({ ...f, items: f.items.map((it, i) =>
                        i === idx ? { ...it, productId: e.target.value, productName: p?.name ?? '' } : it) }))
                    }}
                    className="flex-1 h-9 rounded-md border px-3 text-sm">
                    <option value="">選擇商品</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  <Input type="number" min={1} value={item.quantity} className="w-24"
                    onChange={e => setTrForm(f => ({ ...f, items: f.items.map((it, i) =>
                      i === idx ? { ...it, quantity: Number(e.target.value) } : it) }))} />
                  {trForm.items.length > 1 && (
                    <button onClick={() => setTrForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                      className="text-red-500 hover:text-red-700"><XCircle className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Input value={trForm.notes} onChange={e => setTrForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="調撥原因..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrNewOpen(false)} disabled={trSaving}>取消</Button>
            <Button onClick={handleNewTransfer} disabled={trSaving}>
              {trSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}建立調撥單
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Count Dialog */}
      <Dialog open={ctNewOpen} onOpenChange={o => !o && setCtNewOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>建立盤點單</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>倉庫 <span className="text-red-500">*</span></Label>
              <select value={ctForm.warehouseId} onChange={e => setCtForm(f => ({ ...f, warehouseId: e.target.value }))}
                className="h-9 w-full rounded-md border px-3 text-sm">
                <option value="">選擇倉庫</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
              <p className="text-xs text-muted-foreground">系統將自動快照該倉庫目前所有庫存作為基準數量</p>
            </div>
            <div className="space-y-1.5">
              <Label>盤點日期</Label>
              <Input type="date" value={ctForm.countDate}
                onChange={e => setCtForm(f => ({ ...f, countDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Input value={ctForm.notes} onChange={e => setCtForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="盤點說明..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCtNewOpen(false)} disabled={ctSaving}>取消</Button>
            <Button onClick={handleNewCount} disabled={ctSaving}>
              {ctSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}建立盤點單
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Count Detail Dialog */}
      <Dialog open={ctDetailOpen} onOpenChange={o => !o && setCtDetailOpen(false)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              盤點明細 {ctDetail?.countNo}
              {ctDetail && <Badge variant="outline" className={cn('ml-2 text-xs', COUNT_STATUS_CFG[ctDetail.status]?.cls)}>
                {COUNT_STATUS_CFG[ctDetail.status]?.label}
              </Badge>}
            </DialogTitle>
          </DialogHeader>
          {ctDetailLoading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : ctDetail ? (
            <>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">商品</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground w-20">系統數</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground w-28">實盤數</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground w-20">差異</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">備註</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ctDetail.items.map((item, idx) => (
                      <tr key={item.id} className={item.variance !== 0 ? 'bg-amber-50/40' : ''}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.product.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{item.product.sku}</div>
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{item.systemQty}</td>
                        <td className="px-3 py-2">
                          {['COUNTING'].includes(ctDetail.status) ? (
                            <Input type="number" min={0} className="h-7 text-center w-full"
                              value={item.countedQty}
                              onChange={e => {
                                const qty = Number(e.target.value)
                                setCtDetail(d => d ? {
                                  ...d, items: d.items.map((it, i) => i === idx
                                    ? { ...it, countedQty: qty, variance: qty - it.systemQty }
                                    : it)
                                } : d)
                              }} />
                          ) : (
                            <span className="block text-center">{item.countedQty}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn('font-medium',
                            item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                            {item.variance > 0 ? `+${item.variance}` : item.variance || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {ctDetail.status === 'COUNTING' ? (
                            <Input className="h-7 text-xs" value={item.notes ?? ''}
                              onChange={e => setCtDetail(d => d ? {
                                ...d, items: d.items.map((it, i) => i === idx ? { ...it, notes: e.target.value } : it)
                              } : d)} />
                          ) : (
                            <span className="text-xs text-muted-foreground">{item.notes ?? '—'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ctDetail.status === 'COUNTING' && (
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    差異品項：{ctDetail.items.filter(i => i.variance !== 0).length} 項
                  </p>
                  <Button size="sm" onClick={saveCountItems}>儲存盤點數量</Button>
                </div>
              )}
              {ctDetail.status === 'REVIEWING' && (
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    差異品項：{ctDetail.items.filter(i => i.variance !== 0).length} 項，完成後將自動調整庫存
                  </p>
                  <Button size="sm" onClick={() => countStatusUpdate(ctDetail.id, 'COMPLETED')}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />確認完成，調整庫存
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* New Scrap Dialog */}
      <Dialog open={scNewOpen} onOpenChange={o => !o && setScNewOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>登錄報廢</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>商品 <span className="text-red-500">*</span></Label>
              <select value={scForm.productId}
                onChange={e => {
                  const p = products.find(p => p.id === e.target.value)
                  setScForm(f => ({ ...f, productId: e.target.value, productName: p?.name ?? '' }))
                }}
                className="h-9 w-full rounded-md border px-3 text-sm">
                <option value="">選擇商品</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>倉庫 <span className="text-red-500">*</span></Label>
                <select value={scForm.warehouseId}
                  onChange={e => setScForm(f => ({ ...f, warehouseId: e.target.value }))}
                  className="h-9 w-full rounded-md border px-3 text-sm">
                  <option value="">選擇倉庫</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>報廢數量 <span className="text-red-500">*</span></Label>
                <Input type="number" min={1} value={scForm.quantity}
                  onChange={e => setScForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>報廢日期</Label>
              <Input type="date" value={scForm.scrapDate}
                onChange={e => setScForm(f => ({ ...f, scrapDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>報廢原因</Label>
              <Input value={scForm.reason}
                onChange={e => setScForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="過期 / 損壞 / 品管不合格..." />
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea rows={2} value={scForm.notes}
                onChange={e => setScForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScNewOpen(false)} disabled={scSaving}>取消</Button>
            <Button variant="destructive" onClick={handleNewScrap} disabled={scSaving}>
              {scSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}確認報廢
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Dialog (existing component) */}
      <AdjustForm open={adjustOpen} onClose={() => setAdjustOpen(false)}
        onSuccess={fetchInventory} item={adjustTarget} />
    </div>
  )
}
