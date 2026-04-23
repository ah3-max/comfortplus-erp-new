'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Loader2, Truck, Package, Clock, Phone, ChevronDown, ChevronRight, Wrench, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────────────────────────
// Logistics Provider types & helpers
// ─────────────────────────────────────────────────────────────────────────────

interface Provider {
  id: string; code: string; name: string
  regions: string | null; deliveryDays: number | null; paymentTerms: string | null
  rateCard: string | null; contactPerson: string | null; contactPhone: string | null
  contactEmail: string | null; claimRules: string | null; notes: string | null
  isActive: boolean
  _count: { shipments: number }
}

const emptyProviderForm = {
  code: '', name: '', regions: '', deliveryDays: '', paymentTerms: '',
  rateCard: '', contactPerson: '', contactPhone: '', contactEmail: '',
  claimRules: '', notes: '',
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle types & helpers
// ─────────────────────────────────────────────────────────────────────────────

interface VehicleDriver {
  id: string
  name: string
  phone: string | null
}

interface VehicleMaintenance {
  id: string
  vehicleId: string
  type: string
  title: string
  serviceDate: string
  nextServiceDate: string | null
  nextServiceKm: number | null
  cost: number | null
  vendor: string | null
  odometerAtService: number | null
  notes: string | null
}

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
  notes: string | null
  isActive: boolean
  alerts: string[]
  drivers: VehicleDriver[]
  maintenances: VehicleMaintenance[]
  _count: { trips: number; maintenances: number }
}

const emptyVehicleForm = {
  plateNo: '',
  vehicleType: '',
  brand: '',
  year: '',
  maxWeight: '',
  fuelType: 'DIESEL',
  currentOdometer: '',
  insuranceExpiry: '',
  inspectionExpiry: '',
  licenseTaxExpiry: '',
  fuelTaxExpiry: '',
  notes: '',
}

const emptyMaintenanceForm = {
  type: 'REGULAR_SERVICE',
  title: '',
  serviceDate: '',
  nextServiceDate: '',
  nextServiceKm: '',
  cost: '',
  vendor: '',
  odometerAtService: '',
  notes: '',
}

// Module-level type declarations only; label arrays are built from dict inside components

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

function alertVariant(alert: string, expiredKw: string, overdueKw: string): 'destructive' | 'outline' {
  return alert.includes(expiredKw) || alert.includes(overdueKw) ? 'destructive' : 'outline'
}

function alertColor(alert: string, expiredKw: string, overdueKw: string): string {
  return alert.includes(expiredKw) || alert.includes(overdueKw)
    ? 'border-red-400 text-red-600'
    : 'border-amber-400 text-amber-600'
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'providers' | 'vehicles'

export default function LogisticsPage() {
  const { dict } = useI18n()
  const [tab, setTab] = useState<Tab>('providers')

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.logistics.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.logistics.subtitle}</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('providers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'providers'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {dict.logistics.providerName}
        </button>
        <button
          onClick={() => setTab('vehicles')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'vehicles'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {dict.nav.vehicles}
        </button>
      </div>

      {tab === 'providers' && <ProvidersTab />}
      {tab === 'vehicles'  && <VehiclesTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Providers tab — original code, untouched
// ─────────────────────────────────────────────────────────────────────────────

function ProvidersTab() {
  const { dict } = useI18n()
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading]     = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [open, setOpen]           = useState(false)
  const [editing, setEditing]     = useState<Provider | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(emptyProviderForm)

  const fetchProviders = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/logistics?showAll=${showInactive}`)
    setProviders(await res.json())
    setLoading(false)
  }, [showInactive])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  function f(k: keyof typeof emptyProviderForm, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function openCreate() {
    setEditing(null); setForm(emptyProviderForm); setOpen(true)
  }
  function openEdit(p: Provider) {
    setEditing(p)
    setForm({
      code: p.code, name: p.name,
      regions:       p.regions      ?? '',
      deliveryDays:  p.deliveryDays?.toString() ?? '',
      paymentTerms:  p.paymentTerms ?? '',
      rateCard:      p.rateCard     ?? '',
      contactPerson: p.contactPerson ?? '',
      contactPhone:  p.contactPhone  ?? '',
      contactEmail:  p.contactEmail  ?? '',
      claimRules:    p.claimRules    ?? '',
      notes:         p.notes         ?? '',
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name) { toast.error(dict.logistics.providerName); return }
    if (!editing && !form.code) { toast.error(dict.logistics.code); return }
    setSaving(true)
    const url    = editing ? `/api/logistics/${editing.id}` : '/api/logistics'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        deliveryDays: form.deliveryDays ? Number(form.deliveryDays) : null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(editing ? dict.common.updateSuccess : dict.common.createSuccess)
      setOpen(false); fetchProviders()
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.saveFailed)
    }
  }

  async function toggleActive(p: Provider) {
    const res = await fetch(`/api/logistics/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    if (res.ok) { toast.success(p.isActive ? dict.common.inactive : dict.common.active); fetchProviders() }
    else toast.error(dict.common.error)
  }

  const activeCount = providers.filter(p => p.isActive).length

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{activeCount} {dict.logistics.activeCount}</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            {dict.common.inactive}
          </label>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{dict.logistics.newLogistics}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-3 py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : providers.map(p => (
          <Card key={p.id} className={`group hover:shadow-md transition-shadow ${!p.isActive ? 'opacity-50' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-50 p-2.5">
                    <Truck className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{p.code}</span>
                    </div>
                    {p.regions && <p className="text-xs text-muted-foreground mt-0.5">{p.regions}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(p)}
                    className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {p.deliveryDays != null && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{p.deliveryDays} {dict.logistics.deliveryDaysLabel}
                  </div>
                )}
                {p.contactPerson && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />{p.contactPerson}
                    {p.contactPhone && ` · ${p.contactPhone}`}
                  </div>
                )}
                {p.paymentTerms && (
                  <div className="flex items-center gap-1 col-span-2">
                    {dict.logistics.paymentLabel}{p.paymentTerms}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="h-3 w-3" />{p._count.shipments} {dict.logistics.shipmentsCount}
                </div>
                <div className="flex items-center gap-2">
                  {p.isActive
                    ? <Badge variant="outline" className="border-green-400 text-green-600 text-xs">{dict.common.active}</Badge>
                    : <Badge variant="outline" className="border-red-400 text-red-600 text-xs">{dict.common.inactive}</Badge>
                  }
                  <button onClick={() => toggleActive(p)}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                    {p.isActive ? dict.common.inactive : dict.common.active}
                  </button>
                </div>
              </div>

              {(p.rateCard || p.claimRules) && (
                <div className="mt-2 border-t pt-2 space-y-1">
                  {p.rateCard   && <p className="text-xs text-muted-foreground">{dict.logistics.rateCardLabel}{p.rateCard}</p>}
                  {p.claimRules && <p className="text-xs text-muted-foreground">{dict.logistics.claimLabel}{p.claimRules}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && providers.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-16 text-center text-muted-foreground">
          {dict.logistics.noLogistics}
        </div>
      )}

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? dict.common.edit : dict.logistics.newLogistics}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            {!editing && (
              <div className="space-y-1.5">
                <Label>{dict.logistics.code} <span className="text-red-500">*</span></Label>
                <Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())}
                  placeholder="HSINCHU / KERRY" maxLength={20} />
                <p className="text-xs text-muted-foreground">{dict.logistics.codeNote}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{dict.logistics.providerName} <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => f('name', e.target.value)} placeholder={dict.logistics.providerNamePlaceholder} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{dict.logistics.deliveryDays}</Label>
                <Input type="number" min={1} value={form.deliveryDays}
                  onChange={e => f('deliveryDays', e.target.value)} placeholder="2" />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.logistics.paymentTerms}</Label>
                <Input value={form.paymentTerms} onChange={e => f('paymentTerms', e.target.value)}
                  placeholder={dict.logistics.paymentTermsPlaceholder} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.logistics.deliveryRegions}</Label>
              <Input value={form.regions} onChange={e => f('regions', e.target.value)}
                placeholder={dict.logistics.deliveryRegionsPlaceholder} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{dict.logistics.contact}</Label>
                <Input value={form.contactPerson} onChange={e => f('contactPerson', e.target.value)}
                  placeholder={dict.logistics.contactPersonPlaceholder} />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.logistics.contactPhone}</Label>
                <Input value={form.contactPhone} onChange={e => f('contactPhone', e.target.value)}
                  placeholder="02-1234-5678" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.logistics.contactEmail}</Label>
              <Input value={form.contactEmail} onChange={e => f('contactEmail', e.target.value)}
                placeholder="logistics@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.logistics.rateCard}</Label>
              <Textarea value={form.rateCard} onChange={e => f('rateCard', e.target.value)}
                rows={2} placeholder={dict.logistics.rateCardPlaceholder} />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.logistics.claimRules}</Label>
              <Textarea value={form.claimRules} onChange={e => f('claimRules', e.target.value)}
                rows={2} placeholder={dict.logistics.claimRulesPlaceholder} />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.common.notes}</Label>
              <Textarea value={form.notes} onChange={e => f('notes', e.target.value)}
                rows={2} placeholder={dict.logistics.notesPlaceholder} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? dict.common.save : dict.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicles tab — new feature
// ─────────────────────────────────────────────────────────────────────────────

function VehiclesTab() {
  const { dict } = useI18n()
  const lg = dict.logistics
  const VEHICLE_TYPES = lg.vehicleTypes
  const FUEL_TYPES = Object.entries(lg.fuelTypes).map(([value, label]) => ({ value, label }))
  const MAINTENANCE_TYPES = Object.entries(lg.maintTypes).map(([value, label]) => ({ value, label }))

  const [vehicles, setVehicles]         = useState<Vehicle[]>([])
  const [loading, setLoading]           = useState(true)
  const [vehicleOpen, setVehicleOpen]   = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [saving, setSaving]             = useState(false)
  const [vForm, setVForm]               = useState(emptyVehicleForm)

  // Maintenance state
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [maintRecords, setMaintRecords] = useState<Record<string, VehicleMaintenance[]>>({})
  const [maintLoading, setMaintLoading] = useState<Record<string, boolean>>({})
  const [maintOpen, setMaintOpen]       = useState(false)
  const [maintVehicleId, setMaintVehicleId] = useState<string | null>(null)
  const [mForm, setMForm]               = useState(emptyMaintenanceForm)
  const [maintSaving, setMaintSaving]   = useState(false)

  const fetchVehicles = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/vehicles')
    if (res.ok) setVehicles(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchVehicles() }, [fetchVehicles])

  function vf(k: keyof typeof emptyVehicleForm, v: string) {
    setVForm(prev => ({ ...prev, [k]: v }))
  }

  function mf(k: keyof typeof emptyMaintenanceForm, v: string) {
    setMForm(prev => ({ ...prev, [k]: v }))
  }

  function openCreateVehicle() {
    setEditingVehicle(null)
    setVForm(emptyVehicleForm)
    setVehicleOpen(true)
  }

  function openEditVehicle(v: Vehicle) {
    setEditingVehicle(v)
    setVForm({
      plateNo:           v.plateNo,
      vehicleType:       v.vehicleType       ?? '',
      brand:             v.brand             ?? '',
      year:              v.year?.toString()  ?? '',
      maxWeight:         v.maxWeight?.toString() ?? '',
      fuelType:          v.fuelType          ?? 'DIESEL',
      currentOdometer:   v.currentOdometer?.toString() ?? '',
      insuranceExpiry:   v.insuranceExpiry   ? v.insuranceExpiry.slice(0, 10) : '',
      inspectionExpiry:  v.inspectionExpiry  ? v.inspectionExpiry.slice(0, 10) : '',
      licenseTaxExpiry:  v.licenseTaxExpiry  ? v.licenseTaxExpiry.slice(0, 10) : '',
      fuelTaxExpiry:     v.fuelTaxExpiry     ? v.fuelTaxExpiry.slice(0, 10) : '',
      notes:             v.notes             ?? '',
    })
    setVehicleOpen(true)
  }

  async function handleVehicleSave() {
    if (!vForm.plateNo) { toast.error(dict.common.required); return }
    setSaving(true)
    const url    = editingVehicle ? `/api/vehicles/${editingVehicle.id}` : '/api/vehicles'
    const method = editingVehicle ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plateNo:          vForm.plateNo,
        vehicleType:      vForm.vehicleType      || null,
        brand:            vForm.brand            || null,
        year:             vForm.year             ? Number(vForm.year) : null,
        maxWeight:        vForm.maxWeight        ? Number(vForm.maxWeight) : null,
        fuelType:         vForm.fuelType         || null,
        currentOdometer:  vForm.currentOdometer  ? Number(vForm.currentOdometer) : null,
        insuranceExpiry:  vForm.insuranceExpiry  || null,
        inspectionExpiry: vForm.inspectionExpiry || null,
        licenseTaxExpiry: vForm.licenseTaxExpiry || null,
        fuelTaxExpiry:    vForm.fuelTaxExpiry    || null,
        notes:            vForm.notes            || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(editingVehicle ? dict.common.updateSuccess : dict.common.createSuccess)
      setVehicleOpen(false)
      fetchVehicles()
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.saveFailed)
    }
  }

  async function toggleExpand(vehicleId: string) {
    if (expandedId === vehicleId) {
      setExpandedId(null)
      return
    }
    setExpandedId(vehicleId)
    if (!maintRecords[vehicleId]) {
      setMaintLoading(prev => ({ ...prev, [vehicleId]: true }))
      const res = await fetch(`/api/vehicles/${vehicleId}/maintenance`)
      if (res.ok) {
        const data = await res.json()
        setMaintRecords(prev => ({ ...prev, [vehicleId]: data }))
      }
      setMaintLoading(prev => ({ ...prev, [vehicleId]: false }))
    }
  }

  function openAddMaintenance(vehicleId: string) {
    setMaintVehicleId(vehicleId)
    setMForm(emptyMaintenanceForm)
    setMaintOpen(true)
  }

  async function handleMaintSave() {
    if (!mForm.title)       { toast.error(dict.common.required); return }
    if (!mForm.serviceDate) { toast.error(dict.common.date); return }
    if (!maintVehicleId)    return
    setMaintSaving(true)
    const res = await fetch(`/api/vehicles/${maintVehicleId}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:              mForm.type,
        title:             mForm.title,
        serviceDate:       mForm.serviceDate,
        nextServiceDate:   mForm.nextServiceDate  || null,
        nextServiceKm:     mForm.nextServiceKm    ? Number(mForm.nextServiceKm) : null,
        cost:              mForm.cost             ? Number(mForm.cost) : null,
        vendor:            mForm.vendor           || null,
        odometerAtService: mForm.odometerAtService ? Number(mForm.odometerAtService) : null,
        notes:             mForm.notes            || null,
      }),
    })
    setMaintSaving(false)
    if (res.ok) {
      toast.success(dict.common.createSuccess)
      setMaintOpen(false)
      // Refresh maintenance records for this vehicle
      const updated = await fetch(`/api/vehicles/${maintVehicleId}/maintenance`)
      if (updated.ok) {
        const data = await updated.json()
        setMaintRecords(prev => ({ ...prev, [maintVehicleId]: data }))
      }
      // Refresh vehicle list to update counts and odometer
      fetchVehicles()
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.saveFailed)
    }
  }

  function maintTypeLabel(type: string): string {
    return MAINTENANCE_TYPES.find(t => t.value === type)?.label ?? type
  }

  return (
    <>
      {/* Vehicles toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{vehicles.length} {lg.vehicleCount}</p>
        <Button onClick={openCreateVehicle}>
          <Plus className="mr-2 h-4 w-4" />{dict.common.add}
        </Button>
      </div>

      {/* Vehicle list */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-16 text-center text-muted-foreground">
          {dict.common.noRecords}
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map(v => (
            <Card key={v.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Vehicle row */}
                <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  {/* Icon + plate */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-lg bg-indigo-50 p-2.5 shrink-0">
                      <Truck className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-base leading-tight">
                        {v.plateNo}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {[v.vehicleType, v.brand, v.year ? `${v.year}${lg.yearUnit}` : null]
                          .filter(Boolean).join(' · ') || lg.noVehicleType}
                      </div>
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                    {/* Driver */}
                    <div>
                      <span className="text-slate-500 font-medium">{lg.driver}</span>
                      <div className="mt-0.5">
                        {v.drivers.length > 0
                          ? v.drivers.map(d => (
                              <div key={d.id}>
                                {d.name}
                                {d.phone && (
                                  <span className="ml-1 text-muted-foreground">{d.phone}</span>
                                )}
                              </div>
                            ))
                          : <span>—</span>
                        }
                      </div>
                    </div>

                    {/* Odometer */}
                    <div>
                      <span className="text-slate-500 font-medium">{lg.odometer}</span>
                      <div className="mt-0.5">
                        {v.currentOdometer != null
                          ? `${v.currentOdometer.toLocaleString()} km`
                          : '—'
                        }
                      </div>
                    </div>

                    {/* Fuel type + max weight */}
                    <div>
                      <span className="text-slate-500 font-medium">{lg.fuelWeight}</span>
                      <div className="mt-0.5">
                        {[
                          FUEL_TYPES.find(f => f.value === v.fuelType)?.label,
                          v.maxWeight ? `${v.maxWeight} kg` : null,
                        ].filter(Boolean).join(' / ') || '—'}
                      </div>
                    </div>

                    {/* Expiry dates */}
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-slate-500 font-medium">{lg.expiryDates}</span>
                      <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5">
                        <span>{lg.insurance}{fmtDate(v.insuranceExpiry)}</span>
                        <span>{lg.inspection}{fmtDate(v.inspectionExpiry)}</span>
                        <span>{lg.licenseTax}{fmtDate(v.licenseTaxExpiry)}</span>
                        <span>{lg.fuelTax}{fmtDate(v.fuelTaxExpiry)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right-side: alerts + actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Alert badges */}
                    {v.alerts.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {v.alerts.map((alert, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className={`text-xs ${alertColor(alert, lg.alertExpiredKeyword, lg.alertOverdueKeyword)}`}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {alert}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Maintenance count + actions */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        {v._count.maintenances} {lg.maintenanceCount}
                      </span>
                      <button
                        onClick={() => openEditVehicle(v)}
                        className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground"
                        title={dict.common.edit}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Toggle maintenance */}
                    <button
                      onClick={() => toggleExpand(v.id)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      {expandedId === v.id
                        ? <><ChevronDown className="h-3.5 w-3.5" />{lg.collapseMaintenance}</>
                        : <><ChevronRight className="h-3.5 w-3.5" />{lg.viewMaintenance}</>
                      }
                    </button>
                  </div>
                </div>

                {/* Maintenance records (expandable) */}
                {expandedId === v.id && (
                  <div className="border-t bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">{lg.maintenanceRecords}</span>
                      <Button size="sm" variant="outline" onClick={() => openAddMaintenance(v.id)}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />{lg.addMaintenance}
                      </Button>
                    </div>

                    {maintLoading[v.id] ? (
                      <div className="py-6 flex justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : !maintRecords[v.id] || maintRecords[v.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">{lg.noMaintenance}</p>
                    ) : (
                      <div className="space-y-2">
                        {maintRecords[v.id].map(rec => (
                          <div
                            key={rec.id}
                            className="bg-white rounded-md border px-3 py-2.5 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {maintTypeLabel(rec.type)}
                                </Badge>
                                <span className="font-medium text-slate-800">{rec.title}</span>
                                <span className="text-muted-foreground">{fmtDate(rec.serviceDate)}</span>
                              </div>
                              {rec.cost != null && (
                                <span className="text-slate-700 font-medium shrink-0">
                                  NT$ {rec.cost.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
                              {rec.odometerAtService != null && (
                                <span>{lg.odometerLabel}{rec.odometerAtService.toLocaleString()} km</span>
                              )}
                              {rec.vendor && <span>{lg.vendorLabel}{rec.vendor}</span>}
                              {rec.nextServiceDate && (
                                <span>{lg.nextMaintDateLabel}{fmtDate(rec.nextServiceDate)}</span>
                              )}
                              {rec.nextServiceKm != null && (
                                <span>{lg.nextMaintKmLabel}{rec.nextServiceKm.toLocaleString()} km</span>
                              )}
                            </div>
                            {rec.notes && (
                              <p className="mt-1 text-muted-foreground">{rec.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit vehicle dialog ── */}
      <Dialog open={vehicleOpen} onOpenChange={o => !o && setVehicleOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? dict.common.edit : dict.common.add}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>{lg.plateNo} <span className="text-red-500">*</span></Label>
              <Input
                value={vForm.plateNo}
                onChange={e => vf('plateNo', e.target.value.toUpperCase())}
                placeholder="ABC-1234"
                maxLength={10}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lg.vehicleType}</Label>
                <select
                  value={vForm.vehicleType}
                  onChange={e => vf('vehicleType', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">{lg.selectVehicleType}</option>
                  {VEHICLE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{lg.brand}</Label>
                <Input
                  value={vForm.brand}
                  onChange={e => vf('brand', e.target.value)}
                  placeholder="ISUZU / HINO"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lg.year}</Label>
                <Input
                  type="number"
                  min={1980}
                  max={2099}
                  value={vForm.year}
                  onChange={e => vf('year', e.target.value)}
                  placeholder="2020"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lg.maxWeight}</Label>
                <Input
                  type="number"
                  min={0}
                  value={vForm.maxWeight}
                  onChange={e => vf('maxWeight', e.target.value)}
                  placeholder="3500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lg.fuelKind}</Label>
                <select
                  value={vForm.fuelType}
                  onChange={e => vf('fuelType', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {FUEL_TYPES.map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{lg.currentOdometer}</Label>
                <Input
                  type="number"
                  min={0}
                  value={vForm.currentOdometer}
                  onChange={e => vf('currentOdometer', e.target.value)}
                  placeholder="50000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lg.insuranceExpiry}</Label>
                <Input
                  type="date"
                  value={vForm.insuranceExpiry}
                  onChange={e => vf('insuranceExpiry', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lg.inspectionExpiry}</Label>
                <Input
                  type="date"
                  value={vForm.inspectionExpiry}
                  onChange={e => vf('inspectionExpiry', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lg.licenseTaxExpiry}</Label>
                <Input
                  type="date"
                  value={vForm.licenseTaxExpiry}
                  onChange={e => vf('licenseTaxExpiry', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lg.fuelTaxExpiry}</Label>
                <Input
                  type="date"
                  value={vForm.fuelTaxExpiry}
                  onChange={e => vf('fuelTaxExpiry', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{dict.common.notes}</Label>
              <Textarea
                value={vForm.notes}
                onChange={e => vf('notes', e.target.value)}
                rows={2}
                placeholder={lg.vehicleNotesPlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehicleOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
            <Button onClick={handleVehicleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingVehicle ? dict.common.save : dict.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add maintenance record dialog ── */}
      <Dialog open={maintOpen} onOpenChange={o => !o && setMaintOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dict.common.add}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lg.maintType}</Label>
                <select
                  value={mForm.type}
                  onChange={e => mf('type', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {MAINTENANCE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{lg.maintTitle} <span className="text-red-500">*</span></Label>
                <Input
                  value={mForm.title}
                  onChange={e => mf('title', e.target.value)}
                  placeholder={lg.maintTitlePlaceholder}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lg.maintDate} <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={mForm.serviceDate}
                  onChange={e => mf('serviceDate', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lg.nextMaintDate}</Label>
                <Input
                  type="date"
                  value={mForm.nextServiceDate}
                  onChange={e => mf('nextServiceDate', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lg.odometerAtService}</Label>
                <Input
                  type="number"
                  min={0}
                  value={mForm.odometerAtService}
                  onChange={e => mf('odometerAtService', e.target.value)}
                  placeholder="52000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lg.nextMaintKm}</Label>
                <Input
                  type="number"
                  min={0}
                  value={mForm.nextServiceKm}
                  onChange={e => mf('nextServiceKm', e.target.value)}
                  placeholder="57000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lg.cost}</Label>
                <Input
                  type="number"
                  min={0}
                  value={mForm.cost}
                  onChange={e => mf('cost', e.target.value)}
                  placeholder="3500"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lg.vendor}</Label>
                <Input
                  value={mForm.vendor}
                  onChange={e => mf('vendor', e.target.value)}
                  placeholder={lg.vendorPlaceholder}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{dict.common.notes}</Label>
              <Textarea
                value={mForm.notes}
                onChange={e => mf('notes', e.target.value)}
                rows={2}
                placeholder={lg.maintNotesPlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintOpen(false)} disabled={maintSaving}>{dict.common.cancel}</Button>
            <Button onClick={handleMaintSave} disabled={maintSaving}>
              {maintSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
