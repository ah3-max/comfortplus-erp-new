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
  Calendar, Phone, Package, Camera, CheckSquare, Square, Download, X,
  Route, GripVertical, ChevronUp, ChevronDown, Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

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
  routeStops: unknown
  shipments: Shipment[]
  _count: { shipments: number }
}

// ── Config ────────────────────────────────────────────────────────────────────
const statusClassName: Record<ShipmentStatus, string> = {
  PREPARING: 'border-slate-300 text-slate-600',
  PACKED:    'border-blue-300 text-blue-600 bg-blue-50',
  SHIPPED:   'border-indigo-300 text-indigo-700 bg-indigo-50',
  DELIVERED: 'border-green-400 text-green-700 bg-green-50',
  FAILED:    'border-red-400 text-red-600 bg-red-50',
}
const tripStatusClassName: Record<TripStatus, string> = {
  PLANNED:   'border-blue-300 text-blue-600 bg-blue-50',
  DEPARTED:  'border-amber-300 text-amber-700 bg-amber-50',
  COMPLETED: 'border-green-400 text-green-700 bg-green-50',
  CANCELLED: 'border-slate-300 text-slate-500',
}

// ── Logistics tracking URL builder ───────────────────────────────────────────
const CARRIER_TRACKING: Record<string, (no: string) => string> = {
  '黑貓':    no => `https://www.t-cat.com.tw/inquire/trace.aspx?no=${no}`,
  't-cat':   no => `https://www.t-cat.com.tw/inquire/trace.aspx?no=${no}`,
  'tcat':    no => `https://www.t-cat.com.tw/inquire/trace.aspx?no=${no}`,
  '郵局':    no => `https://postserv.post.gov.tw/pstmail/main_mail.jsp?targetRef=TrackMail&searchForm.mailNo=${no}`,
  'post':    no => `https://postserv.post.gov.tw/pstmail/main_mail.jsp?targetRef=TrackMail&searchForm.mailNo=${no}`,
  '大榮':    no => `https://www.t-cat.com.tw/inquire/trace.aspx?no=${no}`,
  '嘉里':    no => `https://www.kerry.com/tw/express/tracking?trackingNo=${no}`,
  'kerry':   no => `https://www.kerry.com/tw/express/tracking?trackingNo=${no}`,
  '新竹':    no => `https://www.hct.com.tw/search/trace_detail_list.aspx?bno=${no}`,
  'hct':     no => `https://www.hct.com.tw/search/trace_detail_list.aspx?bno=${no}`,
}

function getTrackingUrl(carrier: string | null, trackingNo: string): string | null {
  if (!carrier) return null
  const key = carrier.toLowerCase().replace(/[\s-]/g, '')
  for (const [k, fn] of Object.entries(CARRIER_TRACKING)) {
    if (key.includes(k) || carrier.includes(k)) return fn(trackingNo)
  }
  return null
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ShipmentsPage() {
  const { dict, locale } = useI18n()
  const se = dict.shipmentsExt
  const [tab, setTab] = useState<'shipments' | 'trips' | 'picking' | 'logistics'>('shipments')

  function fmt(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString(locale, { month: '2-digit', day: '2-digit' })
  }
  function fmtFull(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

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

  // Batch operations state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)

  // Route planning state
  type RouteStop = { stopNo: number; shipmentId: string; shipmentNo: string; customerName: string; address: string }
  const [routeOpen, setRouteOpen]       = useState(false)
  const [routeTrip, setRouteTrip]       = useState<DeliveryTrip | null>(null)
  const [routeStops, setRouteStops]     = useState<RouteStop[]>([])
  const [routeSaving, setRouteSaving]   = useState(false)
  const [dragIdx, setDragIdx]           = useState<number | null>(null)

  // Picking list state
  const [pickShipmentId, setPickShipmentId] = useState('')
  const [pickData, setPickData]             = useState<Shipment | null>(null)
  const [pickLoading, setPickLoading]       = useState(false)

  // S-11: POD photos state
  const [podPhotos, setPodPhotos] = useState<{ id: string; photoUrl: string | null; signerName: string | null; signedAt: string | null; anomalyNote: string | null; isCompleted: boolean }[]>([])
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
      if (!res.ok) throw new Error(dict.common.loadFailed)
      const result = await res.json()
      setShipments(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error(dict.shipmentsPage.loadFailed)
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

  // Clear selection when filters or page change
  useEffect(() => { setSelectedIds(new Set()) }, [search, filterStatus, filterMethod, anomalyOnly, page])

  useEffect(() => {
    const t = setTimeout(fetchShipments, 300)
    return () => clearTimeout(t)
  }, [fetchShipments])

  useEffect(() => {
    if (tab === 'trips') fetchTrips()
  }, [tab, fetchTrips])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  // ── Batch operations ─────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === shipments.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(shipments.map(s => s.id)))
    }
  }

  async function batchConfirm() {
    if (selectedIds.size === 0) return
    setBatchConfirmOpen(false)
    setBatchLoading(true)
    const results = await Promise.allSettled(
      Array.from(selectedIds).map(id =>
        fetch(`/api/shipments/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'SHIPPED' }),
        })
      )
    )
    setBatchLoading(false)
    const responses = results.map(r => r.status === 'fulfilled' ? (r.value as Response) : null)
    const ok      = responses.filter(r => r?.ok).length
    const skipped = responses.filter(r => r?.status === 409).length
    if (ok > 0) {
      const msg = skipped > 0
        ? dict.shipmentsBatch.batchShipPartial.replace('{ok}', String(ok)).replace('{skipped}', String(skipped))
        : dict.shipmentsBatch.batchShipSuccess.replace('{n}', String(ok))
      toast.success(msg)
      setSelectedIds(new Set())
      fetchShipments()
    } else if (skipped > 0) {
      toast.warning(dict.shipmentsBatch.batchShipAllSkipped.replace('{skipped}', String(skipped)))
      setSelectedIds(new Set())
      fetchShipments()
    } else {
      toast.error(dict.common.updateFailed)
    }
  }

  async function batchExport() {
    if (selectedIds.size === 0) return
    const params = new URLSearchParams()
    Array.from(selectedIds).forEach(id => params.append('ids', id))
    const res = await fetch(`/api/shipments/export?${params}`)
    if (!res.ok) { toast.error(dict.common.loadFailed); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shipments-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Shipment actions ─────────────────────────────────────────────────────────
  async function updateStatus(id: string, status: ShipmentStatus) {
    const res = await fetch(`/api/shipments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(dict.shipmentsExt.messages.statusUpdated)
      fetchShipments()
    } else toast.error(dict.common.updateFailed)
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
    // S-11: fetch POD photos for DELIVERED shipments
    setPodPhotos([])
    if (s.status === 'DELIVERED') {
      fetch(`/api/shipments/${s.id}`)
        .then(r => r.json())
        .then(d => setPodPhotos(d.proofOfDeliveries ?? []))
        .catch(() => {})
    }
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
    if (res.ok) { toast.success(dict.common.updateSuccess); setUpdOpen(false); fetchShipments() }
    else toast.error(dict.common.updateFailed)
  }

  // ── Trip actions ─────────────────────────────────────────────────────────────
  async function handleCreateTrip() {
    if (!tripForm.tripDate) { toast.error(dict.shipmentsPage.tripDateRequired); return }
    setTripSaving(true)
    const res = await fetch('/api/delivery/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripForm),
    })
    setTripSaving(false)
    if (res.ok) { toast.success(dict.shipmentsPage.tripCreated); setTripNewOpen(false); fetchTrips() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.saveFailed) }
  }

  async function tripAction(id: string, action: string) {
    const res = await fetch(`/api/delivery/trips/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) { toast.success(dict.common.updateSuccess); fetchTrips(); setTripDetailOpen(false) }
    else toast.error(dict.common.updateFailed)
  }

  async function assignShipmentToTrip(tripId: string, shipmentId: string) {
    const res = await fetch(`/api/delivery/trips/${tripId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addShipment', shipmentId }),
    })
    if (res.ok) { toast.success(dict.shipmentsPage.addedToTrip); fetchTrips(); fetchShipments() }
    else toast.error(dict.common.updateFailed)
  }

  async function removeShipmentFromTrip(tripId: string, shipmentId: string) {
    const res = await fetch(`/api/delivery/trips/${tripId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'removeShipment', shipmentId }),
    })
    if (res.ok) { toast.success(dict.common.deleteSuccess); fetchTrips(); fetchShipments() }
    else toast.error(dict.common.updateFailed)
  }

  // ── Route planning ────────────────────────────────────────────────────────────
  function openRoutePlanner(trip: DeliveryTrip) {
    // Use existing routeStops order if saved, otherwise use current shipments order
    const saved = trip.routeStops as RouteStop[] | null
    let stops: RouteStop[]
    if (saved && Array.isArray(saved) && saved.length > 0) {
      // Merge: keep saved order, append any new shipments not yet in saved
      const savedIds = new Set(saved.map(s => s.shipmentId))
      const extra = trip.shipments
        .filter(s => !savedIds.has(s.id))
        .map((s, i) => ({
          stopNo: saved.length + i + 1,
          shipmentId: s.id,
          shipmentNo: s.shipmentNo,
          customerName: s.order.customer.name,
          address: s.order.customer.address ?? '',
        }))
      stops = [...saved, ...extra].map((s, i) => ({ ...s, stopNo: i + 1 }))
    } else {
      stops = trip.shipments.map((s, i) => ({
        stopNo: i + 1,
        shipmentId: s.id,
        shipmentNo: s.shipmentNo,
        customerName: s.order.customer.name,
        address: s.order.customer.address ?? '',
      }))
    }
    setRouteTrip(trip)
    setRouteStops(stops)
    setRouteOpen(true)
  }

  function moveStop(from: number, to: number) {
    if (to < 0 || to >= routeStops.length) return
    const next = [...routeStops]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setRouteStops(next.map((s, i) => ({ ...s, stopNo: i + 1 })))
  }

  function onDragStart(idx: number) { setDragIdx(idx) }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    moveStop(dragIdx, idx)
    setDragIdx(idx)
  }
  function onDragEnd() { setDragIdx(null) }

  async function saveRoute() {
    if (!routeTrip) return
    setRouteSaving(true)
    const res = await fetch(`/api/delivery/trips/${routeTrip.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveRoute', stops: routeStops }),
    })
    setRouteSaving(false)
    if (res.ok) {
      toast.success(dict.shipmentsBatch.routeSaved)
      setRouteOpen(false)
      fetchTrips()
    } else {
      toast.error(dict.common.saveFailed)
    }
  }

  // ── Picking list ─────────────────────────────────────────────────────────────
  async function loadPickingList() {
    if (!pickShipmentId.trim()) { toast.error(dict.shipmentsPage.selectShipment); return }
    setPickLoading(true)
    // Try by shipmentNo search
    const res = await fetch(`/api/shipments?search=${encodeURIComponent(pickShipmentId.trim())}`)
    const json = await res.json()
    const list: Shipment[] = Array.isArray(json) ? json : (json.data ?? [])
    setPickLoading(false)
    if (!list.length) { toast.error(dict.shipmentsExt.noResults); return }
    setPickData(list[0])
  }

  function handlePrint() {
    window.print()
  }

  // ── Counts ───────────────────────────────────────────────────────────────────
  const preparingCount = shipments.filter(s => s.status === 'PREPARING').length
  const shippedCount   = shipments.filter(s => s.status === 'SHIPPED').length
  const anomalyCount   = shipments.filter(s => s.anomalyStatus !== 'NORMAL').length

  // ── Dict-based label maps ────────────────────────────────────────────────────
  const methodLabel: Record<DeliveryMethod, string> = {
    EXPRESS:     dict.shipments.methods.EXPRESS,
    FREIGHT:     dict.shipments.methods.FREIGHT,
    OWN_FLEET:   dict.shipments.methods.OWN_FLEET,
    SELF_PICKUP: dict.shipments.methods.SELF_PICKUP,
  }
  const signLabel: Record<SignStatus, string> = {
    PENDING:  se.signStatuses.PENDING,
    SIGNED:   se.signStatuses.SIGNED,
    REJECTED: se.signStatuses.REJECTED,
  }
  const anomalyLabel: Record<AnomalyStatus, string> = {
    NORMAL:  se.anomalyLabels.NORMAL,
    DELAY:   se.anomalyLabels.DELAY,
    LOST:    se.anomalyLabels.LOST,
    DAMAGE:  se.anomalyLabels.DAMAGE,
    PARTIAL: se.anomalyLabels.PARTIAL,
  }
  const tripStatusLabel: Record<TripStatus, { label: string; className: string }> = {
    PLANNED:   { label: dict.shipmentsExt.tripStatuses.PLANNED,   className: tripStatusClassName.PLANNED },
    DEPARTED:  { label: dict.shipmentsExt.tripStatuses.DEPARTED,  className: tripStatusClassName.DEPARTED },
    COMPLETED: { label: dict.shipmentsExt.tripStatuses.COMPLETED, className: tripStatusClassName.COMPLETED },
    CANCELLED: { label: dict.shipmentsExt.tripStatuses.CANCELLED, className: tripStatusClassName.CANCELLED },
  }
  const statusConfig: Record<ShipmentStatus, { label: string; className: string }> = {
    PREPARING: { label: dict.shipments.statuses.PREPARING, className: statusClassName.PREPARING },
    PACKED:    { label: dict.shipments.statuses.PACKED,    className: statusClassName.PACKED },
    SHIPPED:   { label: dict.shipments.statuses.SHIPPED,   className: statusClassName.SHIPPED },
    DELIVERED: { label: dict.shipments.statuses.DELIVERED, className: statusClassName.DELIVERED },
    FAILED:    { label: dict.shipments.statuses.FAILED,    className: statusClassName.FAILED },
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'shipments', label: se.tabShipments,   icon: Package },
    { key: 'trips',     label: se.tabTrips,        icon: Car },
    { key: 'picking',   label: se.tabPicking,      icon: ClipboardList },
    { key: 'logistics', label: dict.shipments.carrier, icon: Truck },
  ] as const

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.shipments.title}{se.titleSuffix}</h1>
          <p className="text-sm text-muted-foreground">
            {dict.common.totalCount} {shipments.length} {se.tripsCount}
            {preparingCount > 0 && <span className="ml-2 text-amber-600">{preparingCount} {dict.shipments.statuses.PREPARING}</span>}
            {shippedCount   > 0 && <span className="ml-2 text-blue-600">{shippedCount} {dict.shipments.statuses.SHIPPED}</span>}
            {anomalyCount   > 0 && <span className="ml-2 text-red-600">{anomalyCount} {dict.shipmentsExt.anomalies}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'trips' && (
            <Button variant="outline" onClick={() => { setTripForm({ vehicleNo:'', driverName:'', driverPhone:'', region:'', tripDate:'', notes:'' }); setTripNewOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />{se.newTrip}
            </Button>
          )}
          {tab === 'shipments' && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />{dict.shipmentsExt.newShipment}
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
              <Input className="pl-9" placeholder={dict.shipmentsExt.searchPlaceholder}
                value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['', 'PREPARING', 'PACKED', 'SHIPPED', 'DELIVERED', 'FAILED'] as const).map(v => (
                <button key={v} onClick={() => { setFilterStatus(v); setPage(1) }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    filterStatus === v ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {v === '' ? dict.common.all : statusConfig[v].label}
                </button>
              ))}
            </div>
            <select value={filterMethod} onChange={e => { setFilterMethod(e.target.value); setPage(1) }}
              className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600">
              <option value="">{dict.common.all}{dict.shipments.deliveryMethod}</option>
              {(Object.keys(methodLabel) as DeliveryMethod[]).map(m => (
                <option key={m} value={m}>{methodLabel[m]}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={anomalyOnly} onChange={e => { setAnomalyOnly(e.target.checked); setPage(1) }} />
              {se.anomalyOnly}
            </label>
          </div>

          {/* Batch action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5">
              <span className="text-sm font-medium text-blue-700">{dict.shipmentsBatch.selectedCount.replace('{n}', String(selectedIds.size))}</span>
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={batchExport} disabled={batchLoading}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100">
                  <Download className="mr-1.5 h-3.5 w-3.5" />{dict.shipmentsBatch.exportSelected}
                </Button>
                <Button size="sm" onClick={() => setBatchConfirmOpen(true)} disabled={batchLoading}
                  className="bg-blue-600 hover:bg-blue-700">
                  {batchLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Truck className="mr-1.5 h-3.5 w-3.5" />}
                  {dict.shipmentsBatch.batchMarkShipped}
                </Button>
                <button onClick={() => setSelectedIds(new Set())} className="ml-1 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pr-0">
                    <button onClick={toggleAll} className="flex items-center justify-center w-full">
                      {selectedIds.size === shipments.length && shipments.length > 0
                        ? <CheckSquare className="h-4 w-4 text-blue-600" />
                        : <Square className="h-4 w-4 text-slate-400" />}
                    </button>
                  </TableHead>
                  <TableHead className="w-36">{dict.shipments.shipmentNo}</TableHead>
                  <TableHead>{se.colOrderCustomer}</TableHead>
                  <TableHead className="w-24">{dict.common.status}</TableHead>
                  <TableHead className="w-24">{dict.shipments.deliveryMethod}</TableHead>
                  <TableHead>{dict.shipments.carrier}</TableHead>
                  <TableHead className="w-32">{dict.shipments.trackingNo}</TableHead>
                  <TableHead className="w-20">{se.colPalletBox}</TableHead>
                  <TableHead className="w-24">{se.colShipDate}</TableHead>
                  <TableHead className="w-24">{dict.shipmentsExt.deliveryDate}</TableHead>
                  <TableHead className="w-24">{dict.shipments.signStatus}</TableHead>
                  <TableHead className="w-24">{se.colAnomaly}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="py-16 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : shipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="py-16 text-center text-muted-foreground">
                      {search || filterStatus ? dict.shipmentsExt.noResults : dict.shipmentsExt.noShipments}
                    </TableCell>
                  </TableRow>
                ) : shipments.map(s => {
                  const sc = statusConfig[s.status]
                  const isSelected = selectedIds.has(s.id)
                  return (
                    <TableRow key={s.id} className={`group ${isSelected ? 'bg-blue-50' : ''}`}>
                      <TableCell className="pr-0">
                        <button onClick={() => toggleSelect(s.id)} className="flex items-center justify-center w-full">
                          {isSelected
                            ? <CheckSquare className="h-4 w-4 text-blue-600" />
                            : <Square className="h-4 w-4 text-slate-300 opacity-60 hover:opacity-100 transition-opacity" />}
                        </button>
                      </TableCell>
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
                        {s.trackingNo ? (() => {
                          const url = getTrackingUrl(s.logisticsProvider?.name ?? s.carrier, s.trackingNo)
                          return url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="font-mono text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 underline-offset-2 hover:underline">
                              {s.trackingNo}
                            </a>
                          ) : (
                            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{s.trackingNo}</span>
                          )
                        })() : '—'}
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
                        ) : <span className="text-xs text-muted-foreground">{se.anomalyNormal}</span>}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded p-1 opacity-60 hover:opacity-100 transition-opacity hover:bg-slate-100">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openUpdate(s)}>
                              <Truck className="mr-2 h-4 w-4" />{se.editLogistics}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {s.status === 'PREPARING' && (
                              <DropdownMenuItem onClick={() => updateStatus(s.id, 'PACKED')}>
                                <Package className="mr-2 h-4 w-4" />{dict.common.markAs}{dict.shipments.statuses.PACKED}
                              </DropdownMenuItem>
                            )}
                            {(s.status === 'PREPARING' || s.status === 'PACKED') && (
                              <DropdownMenuItem onClick={() => updateStatus(s.id, 'SHIPPED')}>
                                <Truck className="mr-2 h-4 w-4" />{dict.common.markAs}{dict.shipments.statuses.SHIPPED}
                              </DropdownMenuItem>
                            )}
                            {s.status === 'SHIPPED' && (
                              <>
                                <DropdownMenuItem onClick={() => window.location.href = `/shipments/${s.id}/deliver`}>
                                  <Camera className="mr-2 h-4 w-4" />{dict.delivery.deliveryPhotos}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(s.id, 'DELIVERED')}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />{dict.common.markAs}{dict.shipments.statuses.DELIVERED}
                                </DropdownMenuItem>
                              </>
                            )}
                            {s.status === 'SHIPPED' && (
                              <DropdownMenuItem onClick={() => updateStatus(s.id, 'FAILED')} className="text-red-600">
                                <AlertTriangle className="mr-2 h-4 w-4" />{dict.common.markAs}{dict.shipments.statuses.FAILED}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setPickShipmentId(s.shipmentNo); setPickData(s); setTab('picking') }}>
                              <Printer className="mr-2 h-4 w-4" />{se.tabPicking}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/api/shipments/${s.id}/print`, '_blank')}>
                              <Download className="mr-2 h-4 w-4" />列印出貨單
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
                {se.paginationInfo
                  .replace('{total}', String(pagination.total))
                  .replace('{page}', String(pagination.page))
                  .replace('{totalPages}', String(pagination.totalPages))}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                  onClick={() => setPage(p => p - 1)}>{dict.common.prevPage}</Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}>{dict.common.nextPage}</Button>
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
              {se.noTrips}
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
                        <div className="text-sm text-muted-foreground">{t._count.shipments} {se.tripsCount}</div>
                      </div>

                      {t.shipments.length > 0 && (
                        <div className="mt-3 border-t pt-3 space-y-1">
                          {(() => {
                            // Determine stop order from routeStops if available
                            const saved = t.routeStops as { stopNo: number; shipmentId: string }[] | null
                            const orderMap = saved && Array.isArray(saved)
                              ? new Map(saved.map(s => [s.shipmentId, s.stopNo]))
                              : null
                            const sorted = orderMap
                              ? [...t.shipments].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
                              : t.shipments
                            return sorted.map((s, idx) => (
                              <div key={s.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                                    {orderMap ? (orderMap.get(s.id) ?? idx + 1) : idx + 1}
                                  </span>
                                  <span className="font-mono font-medium">{s.shipmentNo}</span>
                                  <span className="text-muted-foreground truncate">{s.order.customer.name}</span>
                                </div>
                                {t.status === 'PLANNED' && (
                                  <button onClick={() => removeShipmentFromTrip(t.id, s.id)}
                                    className="ml-2 shrink-0 text-red-500 hover:text-red-700">{se.remove}</button>
                                )}
                              </div>
                            ))
                          })()}
                        </div>
                      )}

                      <div className="mt-3 flex gap-2 flex-wrap">
                        {t.status === 'PLANNED' && (
                          <>
                            <Button size="sm" variant="outline"
                              onClick={() => { setTripTarget(t); setTripDetailOpen(true) }}>
                              {se.assignShipment}
                            </Button>
                            {t.shipments.length > 1 && (
                              <Button size="sm" variant="outline"
                                onClick={() => openRoutePlanner(t)}>
                                <Route className="mr-1 h-3 w-3" />規劃路線
                              </Button>
                            )}
                            <Button size="sm" onClick={() => tripAction(t.id, 'depart')}>
                              <Car className="mr-1 h-3 w-3" />{se.depart}
                            </Button>
                          </>
                        )}
                        {t.status === 'DEPARTED' && (
                          <Button size="sm" onClick={() => tripAction(t.id, 'complete')}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />{se.completeDelivery}
                          </Button>
                        )}
                        {(t.status === 'PLANNED' || t.status === 'DEPARTED') && (
                          <Button size="sm" variant="outline" className="text-red-600"
                            onClick={() => tripAction(t.id, 'cancel')}>{se.cancel}</Button>
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
              <Label>{se.pickingLabel}</Label>
              <div className="flex gap-2">
                <Input className="w-60" placeholder={se.pickingInputPlaceholder}
                  value={pickShipmentId}
                  onChange={e => setPickShipmentId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadPickingList()} />
                <Button onClick={loadPickingList} disabled={pickLoading}>
                  {pickLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {se.query}
                </Button>
              </div>
            </div>
            {pickData && (
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />{se.print}
              </Button>
            )}
          </div>

          {pickData && (
            <div ref={printRef} className="rounded-lg border bg-white p-6 print:shadow-none print:border-0 space-y-6">
              {/* 撿貨單 */}
              <div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-xl font-bold">{se.pickingListTitle}</h2>
                    <p className="text-sm text-muted-foreground">Picking List</p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-mono font-bold text-lg">{pickData.shipmentNo}</div>
                    <div className="text-muted-foreground">{se.labelCreated}{fmtFull(pickData.createdAt)}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground">{se.labelCustomer}</span>{pickData.order.customer.name}</div>
                  <div><span className="text-muted-foreground">{se.labelOrderNo}</span><span className="font-mono">{pickData.order.orderNo}</span></div>
                  <div><span className="text-muted-foreground">{se.labelDeliveryMethod}</span>{methodLabel[pickData.deliveryMethod]}</div>
                  <div><span className="text-muted-foreground">{se.labelWarehouse}</span>{pickData.warehouse}</div>
                  {pickData.order.customer.address && (
                    <div className="col-span-2"><span className="text-muted-foreground">{se.labelAddress}</span>{pickData.order.customer.address}</div>
                  )}
                </div>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{se.colItem}</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">{se.colPickQty}</TableHead>
                      <TableHead className="text-right">{se.colActualQty}</TableHead>
                      <TableHead className="w-40">{dict.common.notes}</TableHead>
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
                  {se.pickerSignature}
                </div>
              </div>

              <Separator />

              {/* 裝箱單 */}
              <div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-xl font-bold">{se.packingListTitle}</h2>
                    <p className="text-sm text-muted-foreground">Packing List</p>
                  </div>
                  <div className="text-right text-sm font-mono font-bold">{pickData.shipmentNo}</div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">{se.labelPallets}</span>{pickData.palletCount ?? '—'}</div>
                  <div><span className="text-muted-foreground">{se.labelBoxes}</span>{pickData.boxCount ?? '—'}</div>
                  <div><span className="text-muted-foreground">{se.labelWeight}</span>{pickData.weight ? `${pickData.weight} kg` : '—'}</div>
                  <div><span className="text-muted-foreground">{se.labelVolume}</span>{pickData.volume ?? '—'}</div>
                  <div><span className="text-muted-foreground">{se.labelCarrier}</span>{pickData.logisticsProvider?.name ?? pickData.carrier ?? '—'}</div>
                  <div><span className="text-muted-foreground">{se.labelTracking}</span>{pickData.trackingNo ? (() => { const url = getTrackingUrl(pickData.logisticsProvider?.name ?? pickData.carrier, pickData.trackingNo!); return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-600 hover:underline">{pickData.trackingNo}</a> : <span className="font-mono">{pickData.trackingNo}</span> })() : '—'}</div>
                </div>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{se.colItem}</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">{se.colQty}</TableHead>
                      <TableHead className="text-right">{se.colBoxCount}</TableHead>
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
                  <div className="mt-3 text-sm text-muted-foreground border-t pt-2">{se.labelNotes}{pickData.notes}</div>
                )}
                <div className="mt-4 flex justify-end text-sm text-muted-foreground">
                  {se.packerSignature}
                </div>
              </div>

              <Separator />

              {/* 配送單 */}
              <div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-xl font-bold">{se.deliveryNoteTitle}</h2>
                    <p className="text-sm text-muted-foreground">Delivery Note</p>
                  </div>
                  <div className="text-right text-sm font-mono font-bold">{pickData.shipmentNo}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground">{se.labelRecipient}</span>{pickData.order.customer.name}</div>
                  <div><span className="text-muted-foreground">{se.labelContact}</span>—</div>
                  <div className="col-span-2"><span className="text-muted-foreground">{se.labelAddress}</span>{pickData.order.customer.address ?? pickData.order.customer.name}</div>
                  <div><span className="text-muted-foreground">{se.labelExpectedDate}</span>{fmtFull(pickData.expectedDeliveryDate)}</div>
                  <div><span className="text-muted-foreground">{se.labelCarrier}</span>{pickData.logisticsProvider?.name ?? pickData.carrier ?? '—'}</div>
                  <div><span className="text-muted-foreground">{se.labelTracking}</span>{pickData.trackingNo ? (() => { const url = getTrackingUrl(pickData.logisticsProvider?.name ?? pickData.carrier, pickData.trackingNo!); return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-600 hover:underline">{pickData.trackingNo}</a> : <span className="font-mono">{pickData.trackingNo}</span> })() : '—'}</div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-x-12 text-sm text-muted-foreground">
                  <div>{se.recipientSignature}</div>
                  <div>{se.signDateLabel}</div>
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
            <p className="text-sm text-muted-foreground">{providers.length} {se.logisticsCount}</p>
            <Button variant="outline" onClick={() => window.open('/logistics', '_blank')}>
              {se.openLogisticsPage}
            </Button>
          </div>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{se.colCode}</TableHead>
                  <TableHead>{se.colName}</TableHead>
                  <TableHead>{se.colRegion}</TableHead>
                  <TableHead>{se.colLeadDays}</TableHead>
                  <TableHead>{se.colPayTerms}</TableHead>
                  <TableHead>{se.colContact}</TableHead>
                  <TableHead className="w-20">{se.colStatusHead}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      {se.noLogistics}
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
                      <Badge variant="outline" className="border-green-400 text-green-600 text-xs">{dict.common.active}</Badge>
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
            <DialogTitle>{se.editLogistics} — {updTarget?.shipmentNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{dict.shipments.carrier}</Label>
                <Select value={updForm.logisticsProviderId}
                  onValueChange={(v) => setUpdForm(f => ({ ...f, logisticsProviderId: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder={se.selectCarrier} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— {se.unspecified} —</SelectItem>
                    {providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{dict.shipments.trackingNo}</Label>
                <Input value={updForm.trackingNo} onChange={e => setUpdForm(f => ({ ...f, trackingNo: e.target.value }))}
                  placeholder={se.trackingPlaceholder} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{se.labelPalletCount}</Label>
                <Input type="number" min={0} value={updForm.palletCount}
                  onChange={e => setUpdForm(f => ({ ...f, palletCount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{se.labelBoxCount}</Label>
                <Input type="number" min={0} value={updForm.boxCount}
                  onChange={e => setUpdForm(f => ({ ...f, boxCount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{se.labelWeightKg}</Label>
                <Input type="number" min={0} step="0.001" value={updForm.weight}
                  onChange={e => setUpdForm(f => ({ ...f, weight: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{se.labelVolumeShort}</Label>
                <Input value={updForm.volume} onChange={e => setUpdForm(f => ({ ...f, volume: e.target.value }))}
                  placeholder="30x20x15 cm" />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.shipmentsExt.deliveryDate}</Label>
                <Input type="date" value={updForm.expectedDeliveryDate}
                  onChange={e => setUpdForm(f => ({ ...f, expectedDeliveryDate: e.target.value }))} />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{dict.shipments.signStatus}</Label>
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
                <Label>{se.anomalyStatus}</Label>
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
                <Label>{se.anomalyNote}</Label>
                <Textarea value={updForm.anomalyNote}
                  onChange={e => setUpdForm(f => ({ ...f, anomalyNote: e.target.value }))}
                  rows={2} placeholder={se.anomalyNotePlaceholder} />
              </div>
            )}
            {/* S-11: POD 送達照片 */}
            {podPhotos.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Camera className="h-4 w-4 text-blue-500" />送達照片（{podPhotos.length} 張）
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {podPhotos.map(p => p.photoUrl && (
                    <a key={p.id} href={p.photoUrl} target="_blank" rel="noreferrer"
                      className="relative block rounded-lg overflow-hidden border bg-slate-50 aspect-square hover:opacity-90 transition-opacity">
                      <img src={p.photoUrl} alt="POD" className="w-full h-full object-cover" />
                      {p.anomalyNote && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                          {p.anomalyNote}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
                {podPhotos.some(p => p.signerName) && (
                  <p className="text-xs text-muted-foreground">
                    簽收人：{podPhotos.find(p => p.signerName)?.signerName}
                    {podPhotos.find(p => p.signedAt)?.signedAt && ` · ${new Date(podPhotos.find(p => p.signedAt)!.signedAt!).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdOpen(false)} disabled={updSaving}>{dict.common.cancel}</Button>
            <Button onClick={handleUpdateSave} disabled={updSaving}>
              {updSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Trip Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={tripNewOpen} onOpenChange={o => !o && setTripNewOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{se.newTripTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>{se.labelTripDate} <span className="text-red-500">*</span></Label>
              <Input type="date" value={tripForm.tripDate}
                onChange={e => setTripForm(f => ({ ...f, tripDate: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{se.labelVehicleNo}</Label>
                <Input value={tripForm.vehicleNo} onChange={e => setTripForm(f => ({ ...f, vehicleNo: e.target.value }))}
                  placeholder={se.vehiclePlaceholder} />
              </div>
              <div className="space-y-1.5">
                <Label>{se.labelDriverName}</Label>
                <Input value={tripForm.driverName} onChange={e => setTripForm(f => ({ ...f, driverName: e.target.value }))}
                  placeholder={se.driverPlaceholder} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{se.labelDriverPhone}</Label>
                <Input value={tripForm.driverPhone} onChange={e => setTripForm(f => ({ ...f, driverPhone: e.target.value }))}
                  placeholder={se.phonePlaceholder} />
              </div>
              <div className="space-y-1.5">
                <Label>{se.labelRegion}</Label>
                <Input value={tripForm.region} onChange={e => setTripForm(f => ({ ...f, region: e.target.value }))}
                  placeholder={se.regionPlaceholder} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{se.labelNoteShort}</Label>
              <Input value={tripForm.notes} onChange={e => setTripForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTripNewOpen(false)} disabled={tripSaving}>{dict.common.cancel}</Button>
            <Button onClick={handleCreateTrip} disabled={tripSaving}>
              {tripSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Trip Detail (assign shipments) ───────────────────────────────────── */}
      <Dialog open={tripDetailOpen} onOpenChange={o => !o && setTripDetailOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{se.assignShipmentTitle} — {tripTarget?.tripNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">{se.assignShipmentDesc}</p>
            {shipments.filter(s => s.status === 'PREPARING' || s.status === 'PACKED').length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">{se.noReadyShipments}</div>
            ) : (
              <div className="space-y-2">
                {shipments.filter(s => s.status === 'PREPARING' || s.status === 'PACKED').map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-mono text-sm font-medium">{s.shipmentNo}</div>
                      <div className="text-xs text-muted-foreground">{s.order.customer.name}</div>
                    </div>
                    {s.trip ? (
                      <span className="text-xs text-muted-foreground">{se.inTrip} {s.trip.tripNo}</span>
                    ) : (
                      <Button size="sm" variant="outline"
                        onClick={() => tripTarget && assignShipmentToTrip(tripTarget.id, s.id)}>
                        {se.addToTrip}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTripDetailOpen(false)}>{dict.common.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route Planning Dialog */}
      <Dialog open={routeOpen} onOpenChange={o => !o && setRouteOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-4 w-4 text-blue-600" />
              規劃配送路線
              {routeTrip && <span className="text-sm font-normal text-muted-foreground ml-1">· {routeTrip.tripNo}</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="py-1 space-y-1">
            <p className="text-xs text-muted-foreground mb-3">拖曳或使用上下箭頭調整停靠順序，完成後儲存。</p>

            {routeStops.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">尚無出貨單</p>
            ) : (
              <div className="space-y-2">
                {routeStops.map((stop, idx) => (
                  <div
                    key={stop.shipmentId}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={e => onDragOver(e, idx)}
                    onDragEnd={onDragEnd}
                    className={`flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5 transition-all cursor-grab active:cursor-grabbing select-none ${
                      dragIdx === idx ? 'opacity-50 scale-[0.98] border-blue-300 shadow-md' : 'hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Drag handle */}
                    <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />

                    {/* Stop number badge */}
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                      {stop.stopNo}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-slate-700">{stop.shipmentNo}</span>
                        <span className="font-medium text-sm truncate">{stop.customerName}</span>
                      </div>
                      {stop.address && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />{stop.address}
                        </p>
                      )}
                    </div>

                    {/* Up/Down buttons for non-drag devices */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button onClick={() => moveStop(idx, idx - 1)} disabled={idx === 0}
                        className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100">
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => moveStop(idx, idx + 1)} disabled={idx === routeStops.length - 1}
                        className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRouteOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={saveRoute} disabled={routeSaving || routeStops.length === 0}>
              {routeSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              儲存路線
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Original ShipmentForm */}
      <ShipmentForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={fetchShipments} />

      {/* Batch confirm dialog */}
      <Dialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {dict.shipmentsBatch.confirmBatchShip}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {dict.shipmentsBatch.batchShipSuccess.replace('{n}', String(selectedIds.size))}？{dict.common.deleteConfirm.split('？')[1]}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchConfirmOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={batchConfirm} className="bg-blue-600 hover:bg-blue-700">{dict.common.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
