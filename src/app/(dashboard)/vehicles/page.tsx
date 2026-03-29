'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, Truck, AlertTriangle, CheckCircle2, Search } from 'lucide-react'
import { toast } from 'sonner'

interface VehicleDriver { id: string; name: string; phone: string }
interface VehicleMaintenance { id: string; serviceDate: string; serviceType: string; odometer: number | null; nextServiceDate: string | null; totalCost: number | null }

interface Vehicle {
  id: string
  plateNo: string
  vehicleType: string | null
  brand: string | null
  model: string | null
  year: number | null
  maxWeight: number | null
  fuelType: string | null
  currentOdometer: number | null
  insuranceExpiry: string | null
  inspectionExpiry: string | null
  licenseTaxExpiry: string | null
  fuelTaxExpiry: string | null
  isActive: boolean
  notes: string | null
  drivers: VehicleDriver[]
  maintenances: VehicleMaintenance[]
  alerts: string[]
  _count: { trips: number; maintenances: number }
}

export default function VehiclesPage() {
  const { dict } = useI18n()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Vehicle | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    plateNo: '', vehicleType: '', brand: '', model: '',
    year: '', fuelType: 'DIESEL',
    insuranceExpiry: '', inspectionExpiry: '', licenseTaxExpiry: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vehicles')
      if (!res.ok) throw new Error()
      setVehicles(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          year: form.year ? Number(form.year) : null,
          insuranceExpiry: form.insuranceExpiry || null,
          inspectionExpiry: form.inspectionExpiry || null,
          licenseTaxExpiry: form.licenseTaxExpiry || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? dict.common.createFailed)
      toast.success(dict.vehiclesPage.created)
      setShowCreate(false)
      setForm({ plateNo: '', vehicleType: '', brand: '', model: '', year: '', fuelType: 'DIESEL', insuranceExpiry: '', inspectionExpiry: '', licenseTaxExpiry: '', notes: '' })
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : dict.common.createFailed) }
  }

  const filtered = vehicles.filter(v =>
    v.plateNo.toLowerCase().includes(search.toLowerCase()) ||
    (v.brand ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const alertCount = vehicles.filter(v => v.alerts.length > 0).length

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-TW') : '-'

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.vehicles ?? dict.vehiclesPage.addVehicle}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dict.vehiclesPage.subtitle}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus size={16} />{dict.vehiclesPage.addVehicle}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">{dict.vehiclesPage.cardTotal}</div>
          <div className="text-2xl font-bold">{vehicles.length}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 cursor-pointer" onClick={() => setSearch('')}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} className="text-red-500" />
            <span className="text-xs text-gray-400">{dict.vehiclesPage.cardAlerts}</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{alertCount}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="text-xs text-gray-400">{dict.vehiclesPage.cardNormal}</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{vehicles.length - alertCount}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative bg-white border rounded-xl px-3">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={dict.vehiclesPage.searchPlaceholder} className="pl-8 border-0 shadow-none h-11" />
      </div>

      {/* Vehicle cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-gray-400">{dict.vehiclesPage.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 py-16 text-center text-gray-400">
            <Truck size={40} className="mx-auto mb-3 opacity-30" />
            <p>{dict.vehiclesPage.empty}</p>
          </div>
        ) : filtered.map(v => (
          <div key={v.id} className="bg-white border rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setSelected(v)}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-gray-400" />
                  <span className="font-bold font-mono text-lg">{v.plateNo}</span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {[v.brand, v.model, v.vehicleType].filter(Boolean).join(' · ')}
                </div>
              </div>
              {v.alerts.length > 0 ? (
                <Badge className="bg-red-100 text-red-700 shrink-0">{v.alerts.length} {dict.vehiclesPage.alertBadge}</Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-700 shrink-0">{dict.vehiclesPage.normalBadge}</Badge>
              )}
            </div>

            {v.alerts.length > 0 && (
              <div className="mt-2 space-y-1">
                {v.alerts.map((a, i) => (
                  <div key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded flex items-center gap-1">
                    <AlertTriangle size={10} />{a}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-gray-500">
              <div>{dict.vehiclesPage.cardInsurance}：{fmtDate(v.insuranceExpiry)}</div>
              <div>{dict.vehiclesPage.cardInspection}：{fmtDate(v.inspectionExpiry)}</div>
              {v.drivers.length > 0 && (
                <div className="col-span-2 text-blue-500">{dict.vehiclesPage.cardDriver}：{v.drivers.map(d => d.name).join('、')}</div>
              )}
              <div>{dict.vehiclesPage.cardTrips}：{v._count.trips}</div>
              <div>{dict.vehiclesPage.cardMaintenance}：{v._count.maintenances}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dict.vehiclesPage.createTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">{dict.vehiclesPage.fieldPlate}</div>
              <Input value={form.plateNo} onChange={e => setForm(f => ({ ...f, plateNo: e.target.value }))} placeholder="ABC-1234" className="h-9" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.vehiclesPage.fieldBrand}</div>
                <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="HINO" className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.vehiclesPage.fieldModel}</div>
                <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="300" className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.vehiclesPage.fieldYear}</div>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2022" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.vehiclesPage.fieldType}</div>
                <Input value={form.vehicleType} onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))} placeholder="3.5T" className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.vehiclesPage.fieldFuel}</div>
                <Input value={form.fuelType} onChange={e => setForm(f => ({ ...f, fuelType: e.target.value }))} placeholder="DIESEL" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.vehiclesPage.fieldInsuranceExpiry}</div>
                <Input type="date" value={form.insuranceExpiry} onChange={e => setForm(f => ({ ...f, insuranceExpiry: e.target.value }))} className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.vehiclesPage.fieldInspectionExpiry}</div>
                <Input type="date" value={form.inspectionExpiry} onChange={e => setForm(f => ({ ...f, inspectionExpiry: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{dict.vehiclesPage.fieldNotes}</div>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-9" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} className="flex-1" disabled={!form.plateNo}>{dict.vehiclesPage.btnAdd}</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>{dict.common.cancel}</Button>
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
                <DialogTitle className="flex items-center gap-2">
                  <Truck size={18} />{selected.plateNo}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    [dict.vehiclesPage.detailBrand, selected.brand],
                    [dict.vehiclesPage.detailModel, selected.model],
                    [dict.vehiclesPage.detailType, selected.vehicleType],
                    [dict.vehiclesPage.detailFuel, selected.fuelType],
                    [dict.vehiclesPage.detailYear, selected.year],
                    [dict.vehiclesPage.detailOdometer, selected.currentOdometer ? `${selected.currentOdometer.toLocaleString()} km` : null],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k as string} className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">{k}</div>
                      <div className="font-medium">{v}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-400 mb-1.5">{dict.vehiclesPage.sectionExpiry}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      [dict.vehiclesPage.detailInsurance, selected.insuranceExpiry],
                      [dict.vehiclesPage.detailInspection, selected.inspectionExpiry],
                      [dict.vehiclesPage.detailLicenseTax, selected.licenseTaxExpiry],
                      [dict.vehiclesPage.detailFuelTax, selected.fuelTaxExpiry],
                    ].map(([k, v]) => (
                      <div key={k as string} className="bg-gray-50 rounded p-2">
                        <div className="text-gray-400">{k}</div>
                        <div className={v && new Date(v as string) < new Date() ? 'text-red-600 font-medium' : ''}>{fmtDate(v as string | null)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {selected.drivers.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-1.5">{dict.vehiclesPage.sectionDrivers}</div>
                    {selected.drivers.map(d => (
                      <div key={d.id} className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded mb-1">
                        {d.name} {d.phone && `· ${d.phone}`}
                      </div>
                    ))}
                  </div>
                )}
                {selected.maintenances.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-1.5">{dict.vehiclesPage.sectionMaintenance}</div>
                    {selected.maintenances.map(m => (
                      <div key={m.id} className="text-xs border rounded p-2 mb-1">
                        <div className="font-medium">{new Date(m.serviceDate).toLocaleDateString('zh-TW')} — {m.serviceType}</div>
                        {m.totalCost && <div className="text-gray-500">{dict.vehiclesPage.maintenanceCost}：NT${m.totalCost.toLocaleString()}</div>}
                        {m.nextServiceDate && <div className="text-yellow-600">{dict.vehiclesPage.maintenanceNext}：{new Date(m.nextServiceDate).toLocaleDateString('zh-TW')}</div>}
                      </div>
                    ))}
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
