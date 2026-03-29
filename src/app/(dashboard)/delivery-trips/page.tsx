'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, Truck, MapPin, Package, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-blue-100 text-blue-700', DEPARTED: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-gray-100 text-gray-500',
}

interface ShipmentItem {
  id: string; quantity: number
  product: { name: string; sku: string; unit: string | null }
}
interface TripShipment {
  id: string; shipmentNo: string
  order: { customer: { name: string; code: string } }
  items: ShipmentItem[]
}
interface DeliveryTrip {
  id: string; tripNo: string; vehicleNo: string | null; driverName: string | null
  driverPhone: string | null; region: string | null; tripDate: string; status: string
  totalFuelCost: number | null; tollFee: number | null; driverAllowance: number | null
  otherCost: number | null; totalTripCost: number | null; actualStops: number | null
  notes: string | null
  shipments: TripShipment[]
  _count: { shipments: number }
}

export default function DeliveryTripsPage() {
  const { dict } = useI18n()
  const [trips, setTrips] = useState<DeliveryTrip[]>([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [selected, setSelected] = useState<DeliveryTrip | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    tripDate: new Date().toISOString().slice(0, 10),
    vehicleNo: '', driverName: '', driverPhone: '', region: '', notes: '',
  })

  const STATUS_LABELS: Record<string, string> = {
    PLANNED: dict.deliveryTrips.statusPlanned,
    DEPARTED: dict.deliveryTrips.statusDeparted,
    COMPLETED: dict.deliveryTrips.statusCompleted,
    CANCELLED: dict.deliveryTrips.statusCancelled,
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        dateFrom, dateTo,
        ...(filterStatus && { status: filterStatus }),
      })
      const res = await fetch(`/api/delivery/trips?${params}`)
      if (!res.ok) throw new Error()
      setTrips(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo, filterStatus])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.tripDate) { toast.error(dict.deliveryTrips.dateRequired); return }
    try {
      const res = await fetch('/api/delivery/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? dict.common.createFailed)
      toast.success(dict.deliveryTrips.created)
      setShowCreate(false)
      setForm({ tripDate: new Date().toISOString().slice(0, 10), vehicleNo: '', driverName: '', driverPhone: '', region: '', notes: '' })
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : dict.common.createFailed) }
  }

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/delivery/trips/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success(dict.common.statusUpdated)
      setSelected(null)
      load()
    } catch { toast.error(dict.common.updateFailed) }
  }

  const totalCost = trips.reduce((s, t) => s + Number(t.totalTripCost ?? 0), 0)
  const totalStops = trips.reduce((s, t) => s + (t._count.shipments ?? 0), 0)

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.deliveryTrips ?? dict.deliveryTrips.addTrip}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dict.deliveryTrips.subtitle}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus size={16} />{dict.deliveryTrips.addTrip}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">{dict.deliveryTrips.cardTrips}</div>
          <div className="text-2xl font-bold">{trips.length}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Package size={13} className="text-blue-500" />
            <span className="text-xs text-gray-400">{dict.deliveryTrips.cardShipments}</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{totalStops}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={13} className="text-orange-500" />
            <span className="text-xs text-gray-400">{dict.deliveryTrips.cardCost}</span>
          </div>
          <div className="text-xl font-bold">NT${totalCost.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">{dict.deliveryTrips.cardDeparted}</div>
          <div className="text-2xl font-bold text-yellow-600">{trips.filter(t => t.status === 'DEPARTED').length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <div>
          <div className="text-xs text-gray-400 mb-1">{dict.deliveryTrips.filterStart}</div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border rounded-md px-2 h-9 text-sm" />
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">{dict.deliveryTrips.filterEnd}</div>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border rounded-md px-2 h-9 text-sm" />
        </div>
        <div className="self-end">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border rounded-md px-3 h-9 text-sm bg-white">
            <option value="">{dict.deliveryTrips.filterAllStatus}</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Trip Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-gray-400">{dict.deliveryTrips.loading}</div>
        ) : trips.length === 0 ? (
          <div className="col-span-3 py-16 text-center text-gray-400">
            <Truck size={40} className="mx-auto mb-3 opacity-30" />
            <p>{dict.deliveryTrips.empty}</p>
          </div>
        ) : trips.map(trip => (
          <div key={trip.id} className="bg-white border rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setSelected(trip)}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <Truck size={15} className="text-gray-400" />
                  <span className="font-bold font-mono">{trip.tripNo}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {new Date(trip.tripDate).toLocaleDateString('zh-TW')}
                  {trip.region && ` · ${trip.region}`}
                </div>
              </div>
              <Badge className={STATUS_COLORS[trip.status] ?? ''}>{STATUS_LABELS[trip.status] ?? trip.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 mt-2">
              <div className="flex items-center gap-1">
                <Truck size={11} className="text-gray-300" />
                {trip.vehicleNo ?? '-'}
              </div>
              <div>{trip.driverName ?? '-'}</div>
              <div className="flex items-center gap-1">
                <Package size={11} className="text-gray-300" />
                {trip._count.shipments} {dict.deliveryTrips.shipmentCount}
              </div>
              {trip.totalTripCost != null && (
                <div className="text-orange-600">NT${Number(trip.totalTripCost).toLocaleString()}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dict.deliveryTrips.createTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">{dict.deliveryTrips.fieldDate}</div>
              <input type="date" value={form.tripDate} onChange={e => setForm(f => ({ ...f, tripDate: e.target.value }))}
                className="w-full border rounded-md px-3 h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.deliveryTrips.fieldPlate}</div>
                <Input value={form.vehicleNo} onChange={e => setForm(f => ({ ...f, vehicleNo: e.target.value }))}
                  placeholder="ABC-1234" className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.deliveryTrips.fieldRegion}</div>
                <Input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                  className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.deliveryTrips.fieldDriver}</div>
                <Input value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.deliveryTrips.fieldPhone}</div>
                <Input value={form.driverPhone} onChange={e => setForm(f => ({ ...f, driverPhone: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{dict.deliveryTrips.fieldNotes}</div>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-9" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} className="flex-1" disabled={!form.tripDate}>{dict.deliveryTrips.btnAdd}</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>{dict.common.cancel}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Truck size={16} />{selected.tripNo}
                  <Badge className={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    [dict.deliveryTrips.detailDate, new Date(selected.tripDate).toLocaleDateString('zh-TW')],
                    [dict.deliveryTrips.detailPlate, selected.vehicleNo ?? '-'],
                    [dict.deliveryTrips.detailDriver, selected.driverName ?? '-'],
                    [dict.deliveryTrips.detailPhone, selected.driverPhone ?? '-'],
                    [dict.deliveryTrips.detailRegion, selected.region ?? '-'],
                    [dict.deliveryTrips.detailShipments, String(selected._count.shipments)],
                    [dict.deliveryTrips.detailFuel, selected.totalFuelCost ? `NT$${Number(selected.totalFuelCost).toLocaleString()}` : '-'],
                    [dict.deliveryTrips.detailToll, selected.tollFee ? `NT$${Number(selected.tollFee).toLocaleString()}` : '-'],
                    [dict.deliveryTrips.detailAllowance, selected.driverAllowance ? `NT$${Number(selected.driverAllowance).toLocaleString()}` : '-'],
                    [dict.deliveryTrips.detailTotal, selected.totalTripCost ? `NT$${Number(selected.totalTripCost).toLocaleString()}` : '-'],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">{k}</div>
                      <div className="font-medium">{v}</div>
                    </div>
                  ))}
                </div>
                {selected.shipments.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1">
                      <MapPin size={11} />{dict.deliveryTrips.sectionShipments}
                    </div>
                    {selected.shipments.map(s => (
                      <div key={s.id} className="text-xs border rounded p-2 mb-1">
                        <div className="font-mono font-medium text-blue-700">{s.shipmentNo ?? s.id.slice(-8)}</div>
                        <div className="text-gray-600">{s.order.customer.name}</div>
                        <div className="text-gray-400">{s.items.length} {dict.common.pieces}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selected.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">{selected.notes}</p>}
                {selected.status === 'PLANNED' && (
                  <div className="flex gap-2 pt-1 border-t">
                    <Button size="sm" onClick={() => handleStatusUpdate(selected.id, 'DEPARTED')} className="flex-1">
                      {dict.deliveryTrips.btnDepart}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(selected.id, 'CANCELLED')} className="text-red-500">
                      {dict.deliveryTrips.btnCancel}
                    </Button>
                  </div>
                )}
                {selected.status === 'DEPARTED' && (
                  <Button size="sm" onClick={() => handleStatusUpdate(selected.id, 'COMPLETED')} className="w-full">
                    {dict.deliveryTrips.btnComplete}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
