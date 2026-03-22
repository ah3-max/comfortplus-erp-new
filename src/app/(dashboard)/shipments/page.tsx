'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ShipmentForm } from '@/components/shipments/shipment-form'
import {
  Plus, Search, MoreHorizontal, Truck, PackageCheck, Loader2,
  Printer, AlertTriangle, CheckCircle2, ClipboardList, Car, MapPin,
  Calendar, Phone, Package, Camera,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────────────────
type ShipmentStatus   = 'PREPARING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'FAILED'
type DeliveryMethod   = 'EXPRESS' | 'FREIGHT' | 'OWN_FLEET' | 'SELF_PICKUP'
type SignStatus       = 'PENDING' | 'SIGNED' | 'REJECTED'
type AnomalyStatus    = 'NORMAL' | 'DELAY' | 'LOST' | 'DAMAGE' | 'PARTIAL'
type TripStatus       = 'PLANNED' | 'DEPARTED' | 'COMPLETED' | 'CANCELLED'

interface Provider { id: string; code: string; name: string; deliveryDays: number | null }
interface ShipmentItem {
  id: string; productId: string; quantity: number; boxCount: number | null; notes: string | null
  product: { sku: string; name: string; unit: string }
}
interface Shipment {
  id: string; shipmentNo: string; status: ShipmentStatus
  deliveryMethod: DeliveryMethod; carrier: string | null; trackingNo: string | null
  warehouse: string; palletCount: number | null; boxCount: number | null
  weight: string | null; volume: string | null
  shipDate: string | null; expectedDeliveryDate: string | null; deliveryDate: string | null
  signStatus: SignStatus; anomalyStatus: AnomalyStatus; anomalyNote: string | null
  notes: string | null; createdAt: string
  order: { id: string; orderNo: string; customer: { name: string; code: string; address: string | null } }
  logisticsProvider: { id: string; code: string; name: string } | null
  trip: { id: string; tripNo: string; driverName: string | null } | null
  createdBy: { name: string }
  items: ShipmentItem[]
}
interface DeliveryTrip {
  id: string; tripNo: string; vehicleNo: string | null; driverName: string | null
  driverPhone: string | null; region: string | null; tripDate: string; status: TripStatus
  notes: string | null
  shipments: Shipment[]
  _count: { shipments: number }
}

// ── Config ────────────────────────────────────────────────────────────────────
const statusConfig: Record<ShipmentStatus, { label: string; className: string }> = {
  PREPARING: { label: '備貨中',  className: 'border-slate-300 text-slate-600' },
  PACKED:    { label: '已打包',  className: 'border-blue-300 text-blue-600 bg-blue-50' },
  SHIPPED:   { label: '已出貨',  className: 'border-indigo-300 text-indigo-700 bg-indigo-50' },
  DELIVERED: { label: '已送達',  className: 'border-green-400 text-green-700 bg-green-50' },
  FAILED:    { label: '配送失敗', className: 'border-red-400 text-red-600 bg-red-50' },
}
const methodLabel: Record<DeliveryMethod, string> = {
  EXPRESS: '宅配', FREIGHT: '貨運', OWN_FLEET: '自有車隊', SELF_PICKUP: '自取',
}
const signLabel: Record<SignStatus, string> = {
  PENDING: '待簽收', SIGNED: '已簽收', REJECTED: '拒收',
}
const anomalyLabel: Record<AnomalyStatus, string> = {
  NORMAL: '正常', DELAY: '延誤', LOST: '遺失', DAMAGE: '損毀', PARTIAL: '部分短缺',
}
const tripStatusLabel: Record<TripStatus, { label: string; className: string }> = {
  PLANNED:   { label: '已排定', className: 'border-blue-300 text-blue-600 bg-blue-50' },
  DEPARTED:  { label: '出發中', className: 'border-amber-300 text-amber-700 bg-amber-50' },
  COMPLETED: { label: '已完成', className: 'border-green-400 text-green-700 bg-green-50' },
  CANCELLED: { label: '已取消', className: 'border-slate-300 text-slate-500' },
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}
function fmtFull(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ShipmentsPage() {
  const [tab, setTab] = useState<'shipments' | 'trips' | 'picking' | 'logistics'>('shipments')

  // Shipment list state
  const [shipments, setShipments]   = useState<Shipment[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [anomalyOnly, setAnomalyOnly]   = useState(false)
  const [formOpen, setFormOpen]     = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{page:number;pageSize:number;total:number;totalPages:number}|null>(null)

  // Update dialog state
  const [updOpen, setUpdOpen]   = useState(false)
  const [updTarget, setUpdTarget] = useState<Shipment | null>(null)
  const [updForm, setUpdForm]   = useState({
    trackingNo: '', carrier: '', logisticsProviderId: '',
    palletCount: '', boxCount: '', weight: '', volume: '',
    expectedDeliveryDate: '', signStatus: 'PENDING', anomalyStatus: 'NORMAL', anomalyNote: '',
  })
  const [updSaving, setUpdSaving] = useState(false)

  // Trip state
  const [trips, setTrips]           = useState<DeliveryTrip[]>([])
  const [tripsLoading, setTripsLoading] = useState(false)
  const [tripNewOpen, setTripNewOpen]   = useState(false)
  const [tripDetailOpen, setTripDetailOpen] = useState(false)
  const [tripTarget, setTripTarget] = useState<DeliveryTrip | null>(null)
  const [tripForm, setTripForm]     = useState({ vehicleNo: '', driverName: '', driverPhone: '', region: '', tripDate: '', notes: '' })
  const [tripSaving, setTripSaving] = useState(false)

  // Logistics providers (for selects)
  const [providers, setProviders]   = useState<Provider[]>([])

  // Picking list state
  const [pickShipmentId, setPickShipmentId] = useState('')
  const [pickData, setPickData]             = useState<Shipment | null>(null)
  const [pickLoading, setPickLoading]       = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchShipments = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search)       p.set('search', search)
    if (filterStatus) p.set('status', filterStatus)
    if (filterMethod) p.set('deliveryMethod', filterMethod)
    if (anomalyOnly)  p.set('anomaly', 'true')
    p.set('page', String(page))
    p.set('pageSize', '50')
    try {
      const res = await fetch(`/api/shipments?${p}`)
      if (!res.ok) throw new Error('載入失敗')
      const result = await res.json()
      setShipments(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error('出貨載入失敗，請檢查網路連線')
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, filterMethod, anomalyOnly, page])

  const fetchTrips = useCallback(async () => {
    setTripsLoading(true)
    const res = await fetch('/api/delivery/trips')
    setTrips(await res.json())
    setTripsLoading(false)
  }, [])

  const fetchProviders = useCallback(async () => {
    const res = await fetch('/api/logistics')
    setProviders(await res.json())
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchShipments, 300)
    return () => clearTimeout(t)
  }, [fetchShipments])

  useEffect(() => {
    if (tab === 'trips') fetchTrips()
  }, [tab, fetchTrips])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  // ── Shipment actions ─────────────────────────────────────────────────────────
  async function updateStatus(id: string, status: ShipmentStatus) {
    const res = await fetch(`/api/shipments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const labels: Record<string, string> = {
        PACKED: '已標記打包', SHIPPED: '已標記出貨', DELIVERED: '已標記送達', FAILED: '已標記失敗',
      }
      toast.success(labels[status] ?? '狀態已更新')
      fetchShipments()
    } else toast.error('更新失敗')
  }

  function openUpdate(s: Shipment) {
    setUpdTarget(s)
    setUpdForm({
      trackingNo:           s.trackingNo           ?? '',
      carrier:              s.carrier              ?? '',
      logisticsProviderId:  s.logisticsProvider?.id ?? '',
      palletCount:          s.palletCount?.toString() ?? '',
      boxCount:             s.boxCount?.toString()    ?? '',
      weight:               s.weight               ?? '',
      volume:               s.volume               ?? '',
      expectedDeliveryDate: s.expectedDeliveryDate ? s.expectedDeliveryDate.substring(0,10) : '',
      signStatus:           s.signStatus,
      anomalyStatus:        s.anomalyStatus,
      anomalyNote:          s.anomalyNote          ?? '',
    })
    setUpdOpen(true)
  }

  async function handleUpdateSave() {
    if (!updTarget) return
    setUpdSaving(true)
    const res = await fetch(`/api/shipments/${updTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...updForm,
        logisticsProviderId:  updForm.logisticsProviderId || null,
        palletCount:          updForm.palletCount ? Number(updForm.palletCount) : null,
        boxCount:             updForm.boxCount    ? Number(updForm.boxCount)    : null,
        weight:               updForm.weight      ? Number(updForm.weight)      : null,
        expectedDeliveryDate: updForm.expectedDeliveryDate || null,
      }),
    })
    setUpdSaving(false)
    if (res.ok) { toast.success('已更新'); setUpdOpen(false); fetchShipments() }
    else toast.error('更新失敗')
  }

  // ── Trip actions ─────────────────────────────────────────────────────────────
  async function handleCreateTrip() {
    if (!tripForm.tripDate) { toast.error('請填寫出車日期'); return }
    setTripSaving(true)
    const res = await fetch('/api/delivery/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripForm),
    })
    setTripSaving(false)
    if (res.ok) { toast.success('車次已建立'); setTripNewOpen(false); fetchTrips() }
    else { const d = await res.json(); toast.error(d.error ?? '建立失敗') }
  }

  async function tripAction(id: string, action: string) {
    const res = await fetch(`/api/delivery/trips/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) { toast.success('車次已更新'); fetchTrips(); setTripDetailOpen(false) }
    else toast.error('操作失敗')
  }

  async function assignShipmentToTrip(tripId: string, shipmentId: string) {
    const res = await fetch(`/api/delivery/trips/${tripId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addShipment', shipmentId }),
    })
    if (res.ok) { toast.success('出貨單已加入車次'); fetchTrips(); fetchShipments() }
    else toast.error('操作失敗')
  }

  async function removeShipmentFromTrip(tripId: string, shipmentId: string) {
    const res = await fetch(`/api/delivery/trips/${tripId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'removeShipment', shipmentId }),
    })
    if (res.ok) { toast.success('已移除'); fetchTrips(); fetchShipments() }
    else toast.error('操作失敗')
  }

  // ── Picking list ─────────────────────────────────────────────────────────────
  async function loadPickingList() {
    if (!pickShipmentId.trim()) { toast.error('請輸入出貨單號或選擇出貨單'); return }
    setPickLoading(true)
    // Try by shipmentNo search
    const res = await fetch(`/api/shipments?search=${encodeURIComponent(pickShipmentId.trim())}`)
    const list: Shipment[] = await res.json()
    setPickLoading(false)
    if (!list.length) { toast.error('找不到此出貨單'); return }
    setPickData(list[0])
  }

  function handlePrint() {
    window.print()
  }

  // ── Counts ───────────────────────────────────────────────────────────────────
  const preparingCount = shipments.filter(s => s.status === 'PREPARING').length
  const shippedCount   = shipments.filter(s => s.status === 'SHIPPED').length
  const anomalyCount   = shipments.filter(s => s.anomalyStatus !== 'NORMAL').length

  // ── Render ───────────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'shipments', label: '出貨單',   icon: Package },
    { key: 'trips',     label: '配送行程', icon: Car },
    { key: 'picking',   label: '撿貨/裝箱單', icon: ClipboardList },
    { key: 'logistics', label: '物流商',   icon: Truck },
  ] as const

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">出貨與物流管理</h1>
          <p className="text-sm text-muted-foreground">
            共 {shipments.length} 筆出貨
            {preparingCount > 0 && <span className="ml-2 text-amber-600">{preparingCount} 備貨中</span>}
            {shippedCount   > 0 && <span className="ml-2 text-blue-600">{shippedCount} 已出貨</span>}
            {anomalyCount   > 0 && <span className="ml-2 text-red-600">{anomalyCount} 異常</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'trips' && (
            <Button variant="outline" onClick={() => { setTripForm({ vehicleNo:'', driverName:'', driverPhone:'', region:'', tripDate:'', notes:'' }); setTripNewOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />新增車次
            </Button>
          )}
          {tab === 'shipments' && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />建立出貨單
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Tab: 出貨單 ──────────────────────────────────────────────────────── */}
      {tab === 'shipments' && (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="搜尋出貨單號或客戶..."
                value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['', 'PREPARING', 'PACKED', 'SHIPPED', 'DELIVERED', 'FAILED'] as const).map(v => (
                <button key={v} onClick={() => { setFilterStatus(v); setPage(1) }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    filterStatus === v ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {v === '' ? '全部' : statusConfig[v].label}
                </button>
              ))}
            </div>
            <select value={filterMethod} onChange={e => { setFilterMethod(e.target.value); setPage(1) }}
              className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600">
              <option value="">全部配送方式</option>
              {(Object.keys(methodLabel) as DeliveryMethod[]).map(m => (
                <option key={m} value={m}>{methodLabel[m]}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={anomalyOnly} onChange={e => { setAnomalyOnly(e.target.checked); setPage(1) }} />
              僅顯示異常
            </label>
          </div>

          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">出貨單號</TableHead>
                  <TableHead>訂單 / 客戶</TableHead>
                  <TableHead className="w-24">狀態</TableHead>
                  <TableHead className="w-24">配送方式</TableHead>
                  <TableHead>物流商</TableHead>
                  <TableHead className="w-32">追蹤號</TableHead>
                  <TableHead className="w-20">棧板/箱</TableHead>
                  <TableHead className="w-24">出貨日</TableHead>
                  <TableHead className="w-24">預計到貨</TableHead>
                  <TableHead className="w-24">簽收</TableHead>
                  <TableHead className="w-24">異常</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-16 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : shipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-16 text-center text-muted-foreground">
                      {search || filterStatus ? '找不到符合的出貨單' : '尚無出貨記錄'}
                    </TableCell>
                  </TableRow>
                ) : shipments.map(s => {
                  const sc = statusConfig[s.status]
                  return (
                    <TableRow key={s.id} className="group">
                      <TableCell className="font-mono text-sm font-medium">{s.shipmentNo}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{s.order.customer.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{s.order.orderNo}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{methodLabel[s.deliveryMethod]}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.logisticsProvider?.name ?? s.carrier ?? '—'}
                      </TableCell>
                      <TableCell>
                        {s.trackingNo ? (
                          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{s.trackingNo}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.palletCount != null || s.boxCount != null
                          ? `${s.palletCount ?? '—'} / ${s.boxCount ?? '—'}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmt(s.shipDate)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmt(s.expectedDeliveryDate)}</TableCell>
                      <TableCell>
                        <span className={`text-xs ${s.signStatus === 'SIGNED' ? 'text-green-600' : s.signStatus === 'REJECTED' ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {signLabel[s.signStatus]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {s.anomalyStatus !== 'NORMAL' ? (
                          <span className="text-xs text-amber-600 flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" />{anomalyLabel[s.anomalyStatus]}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">正常</span>}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openUpdate(s)}>
                              <Truck className="mr-2 h-4 w-4" />編輯物流資訊
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {s.status === 'PREPARING' && (
                              <DropdownMenuItem onClick={() => updateStatus(s.id, 'PACKED')}>
                                <Package className="mr-2 h-4 w-4" />標記已打包
                              </DropdownMenuItem>
                            )}
                            {(s.status === 'PREPARING' || s.status === 'PACKED') && (
                              <DropdownMenuItem onClick={() => updateStatus(s.id, 'SHIPPED')}>
                                <Truck className="mr-2 h-4 w-4" />標記已出貨
                              </DropdownMenuItem>
                            )}
                            {s.status === 'SHIPPED' && (
                              <>
                                <DropdownMenuItem onClick={() => window.location.href = `/shipments/${s.id}/deliver`}>
                                  <Camera className="mr-2 h-4 w-4" />送達拍照確認
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(s.id, 'DELIVERED')}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />直接標記送達
                                </DropdownMenuItem>
                              </>
                            )}
                            {s.status === 'SHIPPED' && (
                              <DropdownMenuItem onClick={() => updateStatus(s.id, 'FAILED')} className="text-red-600">
                                <AlertTriangle className="mr-2 h-4 w-4" />標記配送失敗
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setPickShipmentId(s.shipmentNo); setPickData(s); setTab('picking') }}>
                              <Printer className="mr-2 h-4 w-4" />撿貨/裝箱單
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

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                共 {pagination.total} 筆，第 {pagination.page}/{pagination.totalPages} 頁
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                  onClick={() => setPage(p => p - 1)}>上一頁</Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}>下一頁</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab: 配送行程 ─────────────────────────────────────────────────────── */}
      {tab === 'trips' && (
        <div className="space-y-4">
          {tripsLoading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : trips.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-16 text-center text-muted-foreground">
              尚無配送行程，點擊右上角新增
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {trips.map(t => {
                const ts = tripStatusLabel[t.status]
                return (
                  <Card key={t.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold font-mono text-sm">{t.tripNo}</span>
                            <Badge variant="outline" className={ts.className}>{ts.label}</Badge>
                          </div>
                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {fmtFull(t.tripDate)}
                            </div>
                            {t.vehicleNo && <div className="flex items-center gap-1"><Car className="h-3 w-3" />{t.vehicleNo}</div>}
                            {t.driverName && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{t.driverName}{t.driverPhone && ` · ${t.driverPhone}`}</div>}
                            {t.region && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t.region}</div>}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">{t._count.shipments} 筆出貨</div>
                      </div>

                      {t.shipments.length > 0 && (
                        <div className="mt-3 border-t pt-3 space-y-1">
                          {t.shipments.map(s => (
                            <div key={s.id} className="flex items-center justify-between text-xs">
                              <div>
                                <span className="font-mono font-medium">{s.shipmentNo}</span>
                                <span className="ml-2 text-muted-foreground">{s.order.customer.name}</span>
                              </div>
                              {t.status === 'PLANNED' && (
                                <button onClick={() => removeShipmentFromTrip(t.id, s.id)}
                                  className="text-red-500 hover:text-red-700">移除</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex gap-2 flex-wrap">
                        {t.status === 'PLANNED' && (
                          <>
                            <Button size="sm" variant="outline"
                              onClick={() => { setTripTarget(t); setTripDetailOpen(true) }}>
                              指派出貨單
                            </Button>
                            <Button size="sm" onClick={() => tripAction(t.id, 'depart')}>
                              <Car className="mr-1 h-3 w-3" />出發
                            </Button>
                          </>
                        )}
                        {t.status === 'DEPARTED' && (
                          <Button size="sm" onClick={() => tripAction(t.id, 'complete')}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />完成配送
                          </Button>
                        )}
                        {(t.status === 'PLANNED' || t.status === 'DEPARTED') && (
                          <Button size="sm" variant="outline" className="text-red-600"
                            onClick={() => tripAction(t.id, 'cancel')}>取消</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: 撿貨 / 裝箱單 ──────────────────────────────────────────────── */}
      {tab === 'picking' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="space-y-1.5">
              <Label>出貨單號</Label>
              <div className="flex gap-2">
                <Input className="w-60" placeholder="輸入出貨單號..."
                  value={pickShipmentId}
                  onChange={e => setPickShipmentId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadPickingList()} />
                <Button onClick={loadPickingList} disabled={pickLoading}>
                  {pickLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  查詢
                </Button>
              </div>
            </div>
            {pickData && (
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />列印
              </Button>
            )}
          </div>

          {pickData && (
            <div ref={printRef} className="rounded-lg border bg-white p-6 print:shadow-none print:border-0 space-y-6">
              {/* 撿貨單 */}
              <div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-xl font-bold">撿貨單</h2>
                    <p className="text-sm text-muted-foreground">Picking List</p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-mono font-bold text-lg">{pickData.shipmentNo}</div>
                    <div className="text-muted-foreground">建立：{fmtFull(pickData.createdAt)}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground">客戶：</span>{pickData.order.customer.name}</div>
                  <div><span className="text-muted-foreground">訂單號：</span><span className="font-mono">{pickData.order.orderNo}</span></div>
                  <div><span className="text-muted-foreground">配送方式：</span>{methodLabel[pickData.deliveryMethod]}</div>
                  <div><span className="text-muted-foreground">出貨倉庫：</span>{pickData.warehouse}</div>
                  {pickData.order.customer.address && (
                    <div className="col-span-2"><span className="text-muted-foreground">送貨地址：</span>{pickData.order.customer.address}</div>
                  )}
                </div>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>品項</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">應揀數量</TableHead>
                      <TableHead className="text-right">實揀數量</TableHead>
                      <TableHead className="w-40">備註</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pickData.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{item.product.sku}</TableCell>
                        <TableCell className="text-right font-bold">{item.quantity} {item.product.unit}</TableCell>
                        <TableCell className="text-right">
                          <div className="border-b border-dashed w-20 ml-auto h-6" />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.notes ?? ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end text-sm text-muted-foreground">
                  揀貨人員：___________________　　日期：___________________
                </div>
              </div>

              <Separator />

              {/* 裝箱單 */}
              <div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-xl font-bold">裝箱單</h2>
                    <p className="text-sm text-muted-foreground">Packing List</p>
                  </div>
                  <div className="text-right text-sm font-mono font-bold">{pickData.shipmentNo}</div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">棧板數：</span>{pickData.palletCount ?? '—'}</div>
                  <div><span className="text-muted-foreground">總箱數：</span>{pickData.boxCount ?? '—'}</div>
                  <div><span className="text-muted-foreground">總重量：</span>{pickData.weight ? `${pickData.weight} kg` : '—'}</div>
                  <div><span className="text-muted-foreground">材積：</span>{pickData.volume ?? '—'}</div>
                  <div><span className="text-muted-foreground">物流商：</span>{pickData.logisticsProvider?.name ?? pickData.carrier ?? '—'}</div>
                  <div><span className="text-muted-foreground">追蹤號：</span><span className="font-mono">{pickData.trackingNo ?? '—'}</span></div>
                </div>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>品項</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">數量</TableHead>
                      <TableHead className="text-right">箱數</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pickData.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{item.product.sku}</TableCell>
                        <TableCell className="text-right">{item.quantity} {item.product.unit}</TableCell>
                        <TableCell className="text-right">{item.boxCount ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {pickData.notes && (
                  <div className="mt-3 text-sm text-muted-foreground border-t pt-2">備註：{pickData.notes}</div>
                )}
                <div className="mt-4 flex justify-end text-sm text-muted-foreground">
                  裝箱確認：___________________　　日期：___________________
                </div>
              </div>

              <Separator />

              {/* 配送單 */}
              <div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-xl font-bold">配送單</h2>
                    <p className="text-sm text-muted-foreground">Delivery Note</p>
                  </div>
                  <div className="text-right text-sm font-mono font-bold">{pickData.shipmentNo}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground">收貨方：</span>{pickData.order.customer.name}</div>
                  <div><span className="text-muted-foreground">聯絡方式：</span>—</div>
                  <div className="col-span-2"><span className="text-muted-foreground">送貨地址：</span>{pickData.order.customer.address ?? pickData.order.customer.name}</div>
                  <div><span className="text-muted-foreground">預計到貨：</span>{fmtFull(pickData.expectedDeliveryDate)}</div>
                  <div><span className="text-muted-foreground">物流商：</span>{pickData.logisticsProvider?.name ?? pickData.carrier ?? '—'}</div>
                  <div><span className="text-muted-foreground">追蹤號：</span><span className="font-mono">{pickData.trackingNo ?? '—'}</span></div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-x-12 text-sm text-muted-foreground">
                  <div>簽收人：___________________</div>
                  <div>簽收日期：___________________</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: 物流商 ──────────────────────────────────────────────────────── */}
      {tab === 'logistics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{providers.length} 間物流商</p>
            <Button variant="outline" onClick={() => window.open('/logistics', '_blank')}>
              開啟物流商管理頁面
            </Button>
          </div>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>代碼</TableHead>
                  <TableHead>名稱</TableHead>
                  <TableHead>配送區域</TableHead>
                  <TableHead>時效（天）</TableHead>
                  <TableHead>付款條件</TableHead>
                  <TableHead>聯絡窗口</TableHead>
                  <TableHead className="w-20">狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      尚無物流商資料
                    </TableCell>
                  </TableRow>
                ) : providers.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm font-medium">{p.code}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.deliveryDays ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-green-400 text-green-600 text-xs">啟用</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Update Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={updOpen} onOpenChange={o => !o && setUpdOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>編輯物流資訊 — {updTarget?.shipmentNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>物流商</Label>
                <Select value={updForm.logisticsProviderId}
                  onValueChange={(v) => setUpdForm(f => ({ ...f, logisticsProviderId: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="選擇物流商" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— 未指定 —</SelectItem>
                    {providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>追蹤號</Label>
                <Input value={updForm.trackingNo} onChange={e => setUpdForm(f => ({ ...f, trackingNo: e.target.value }))}
                  placeholder="宅配追蹤號" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>棧板數</Label>
                <Input type="number" min={0} value={updForm.palletCount}
                  onChange={e => setUpdForm(f => ({ ...f, palletCount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>箱數</Label>
                <Input type="number" min={0} value={updForm.boxCount}
                  onChange={e => setUpdForm(f => ({ ...f, boxCount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>重量 (kg)</Label>
                <Input type="number" min={0} step="0.001" value={updForm.weight}
                  onChange={e => setUpdForm(f => ({ ...f, weight: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>材積</Label>
                <Input value={updForm.volume} onChange={e => setUpdForm(f => ({ ...f, volume: e.target.value }))}
                  placeholder="30x20x15 cm" />
              </div>
              <div className="space-y-1.5">
                <Label>預計到貨日</Label>
                <Input type="date" value={updForm.expectedDeliveryDate}
                  onChange={e => setUpdForm(f => ({ ...f, expectedDeliveryDate: e.target.value }))} />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>簽收狀態</Label>
                <Select value={updForm.signStatus} onValueChange={(v) => setUpdForm(f => ({ ...f, signStatus: v ?? 'PENDING' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(signLabel) as [SignStatus, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>異常狀態</Label>
                <Select value={updForm.anomalyStatus} onValueChange={(v) => setUpdForm(f => ({ ...f, anomalyStatus: v ?? 'NORMAL' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(anomalyLabel) as [AnomalyStatus, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {updForm.anomalyStatus !== 'NORMAL' && (
              <div className="space-y-1.5">
                <Label>異常說明</Label>
                <Textarea value={updForm.anomalyNote}
                  onChange={e => setUpdForm(f => ({ ...f, anomalyNote: e.target.value }))}
                  rows={2} placeholder="說明異常情況..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdOpen(false)} disabled={updSaving}>取消</Button>
            <Button onClick={handleUpdateSave} disabled={updSaving}>
              {updSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Trip Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={tripNewOpen} onOpenChange={o => !o && setTripNewOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>新增配送行程</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>出車日期 <span className="text-red-500">*</span></Label>
              <Input type="date" value={tripForm.tripDate}
                onChange={e => setTripForm(f => ({ ...f, tripDate: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>車牌號碼</Label>
                <Input value={tripForm.vehicleNo} onChange={e => setTripForm(f => ({ ...f, vehicleNo: e.target.value }))}
                  placeholder="ABC-1234" />
              </div>
              <div className="space-y-1.5">
                <Label>司機姓名</Label>
                <Input value={tripForm.driverName} onChange={e => setTripForm(f => ({ ...f, driverName: e.target.value }))}
                  placeholder="王大明" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>司機電話</Label>
                <Input value={tripForm.driverPhone} onChange={e => setTripForm(f => ({ ...f, driverPhone: e.target.value }))}
                  placeholder="0912-345-678" />
              </div>
              <div className="space-y-1.5">
                <Label>配送區域</Label>
                <Input value={tripForm.region} onChange={e => setTripForm(f => ({ ...f, region: e.target.value }))}
                  placeholder="台北市 / 新北市" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Input value={tripForm.notes} onChange={e => setTripForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTripNewOpen(false)} disabled={tripSaving}>取消</Button>
            <Button onClick={handleCreateTrip} disabled={tripSaving}>
              {tripSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Trip Detail (assign shipments) ───────────────────────────────────── */}
      <Dialog open={tripDetailOpen} onOpenChange={o => !o && setTripDetailOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>指派出貨單 — {tripTarget?.tripNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">選擇狀態為「備貨中」或「已打包」的出貨單加入此行程</p>
            {shipments.filter(s => s.status === 'PREPARING' || s.status === 'PACKED').length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">目前沒有待出貨的出貨單</div>
            ) : (
              <div className="space-y-2">
                {shipments.filter(s => s.status === 'PREPARING' || s.status === 'PACKED').map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-mono text-sm font-medium">{s.shipmentNo}</div>
                      <div className="text-xs text-muted-foreground">{s.order.customer.name}</div>
                    </div>
                    {s.trip ? (
                      <span className="text-xs text-muted-foreground">已在行程 {s.trip.tripNo}</span>
                    ) : (
                      <Button size="sm" variant="outline"
                        onClick={() => tripTarget && assignShipmentToTrip(tripTarget.id, s.id)}>
                        加入
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTripDetailOpen(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Original ShipmentForm */}
      <ShipmentForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={fetchShipments} />
    </div>
  )
}
