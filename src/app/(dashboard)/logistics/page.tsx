'use client'

import { useEffect, useState, useCallback } from 'react'
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

const VEHICLE_TYPES = ['3.5噸貨車', '廂型車', '小貨車', '大貨車', '冷凍車', '其他']
const FUEL_TYPES: { value: string; label: string }[] = [
  { value: 'DIESEL', label: '柴油' },
  { value: 'GASOLINE', label: '汽油' },
  { value: 'ELECTRIC', label: '電動' },
]
const MAINTENANCE_TYPES: { value: string; label: string }[] = [
  { value: 'REGULAR_SERVICE', label: '定期保養' },
  { value: 'REPAIR', label: '維修' },
  { value: 'TIRE', label: '輪胎' },
  { value: 'INSPECTION', label: '驗車' },
  { value: 'INSURANCE', label: '保險' },
  { value: 'OTHER', label: '其他' },
]

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

function alertVariant(alert: string): 'destructive' | 'outline' {
  return alert.includes('已過期') || alert.includes('已逾期') ? 'destructive' : 'outline'
}

function alertColor(alert: string): string {
  return alert.includes('已過期') || alert.includes('已逾期')
    ? 'border-red-400 text-red-600'
    : 'border-amber-400 text-amber-600'
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'providers' | 'vehicles'

export default function LogisticsPage() {
  const [tab, setTab] = useState<Tab>('providers')

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">物流管理</h1>
        <p className="text-sm text-muted-foreground">管理物流商與自有車隊</p>
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
          物流商
        </button>
        <button
          onClick={() => setTab('vehicles')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'vehicles'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          車輛管理
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
    if (!form.name) { toast.error('請填寫物流商名稱'); return }
    if (!editing && !form.code) { toast.error('請填寫物流商代碼'); return }
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
      toast.success(editing ? '物流商已更新' : '物流商已新增')
      setOpen(false); fetchProviders()
    } else {
      const d = await res.json()
      toast.error(d.error ?? '儲存失敗')
    }
  }

  async function toggleActive(p: Provider) {
    const res = await fetch(`/api/logistics/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    if (res.ok) { toast.success(p.isActive ? '已停用' : '已啟用'); fetchProviders() }
    else toast.error('操作失敗')
  }

  const activeCount = providers.filter(p => p.isActive).length

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">共 {activeCount} 間物流商</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            顯示已停用
          </label>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />新增物流商</Button>
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
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(p)}
                    className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {p.deliveryDays != null && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{p.deliveryDays} 天時效
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
                    付款：{p.paymentTerms}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="h-3 w-3" />{p._count.shipments} 筆出貨
                </div>
                <div className="flex items-center gap-2">
                  {p.isActive
                    ? <Badge variant="outline" className="border-green-400 text-green-600 text-xs">啟用</Badge>
                    : <Badge variant="outline" className="border-red-400 text-red-600 text-xs">停用</Badge>
                  }
                  <button onClick={() => toggleActive(p)}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                    {p.isActive ? '停用' : '啟用'}
                  </button>
                </div>
              </div>

              {(p.rateCard || p.claimRules) && (
                <div className="mt-2 border-t pt-2 space-y-1">
                  {p.rateCard   && <p className="text-xs text-muted-foreground">運價：{p.rateCard}</p>}
                  {p.claimRules && <p className="text-xs text-muted-foreground">理賠：{p.claimRules}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && providers.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-16 text-center text-muted-foreground">
          尚無物流商資料，請新增第一間物流商
        </div>
      )}

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '編輯物流商' : '新增物流商'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            {!editing && (
              <div className="space-y-1.5">
                <Label>物流商代碼 <span className="text-red-500">*</span></Label>
                <Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())}
                  placeholder="HSINCHU / KERRY" maxLength={20} />
                <p className="text-xs text-muted-foreground">英數大寫，建立後不可更改</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>物流商名稱 <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="新竹物流" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>配送時效（天）</Label>
                <Input type="number" min={1} value={form.deliveryDays}
                  onChange={e => f('deliveryDays', e.target.value)} placeholder="2" />
              </div>
              <div className="space-y-1.5">
                <Label>付款條件</Label>
                <Input value={form.paymentTerms} onChange={e => f('paymentTerms', e.target.value)}
                  placeholder="月結30天" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>配送區域</Label>
              <Input value={form.regions} onChange={e => f('regions', e.target.value)}
                placeholder="全台灣 / 北部 / 中部 / 南部" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>聯絡窗口</Label>
                <Input value={form.contactPerson} onChange={e => f('contactPerson', e.target.value)}
                  placeholder="業務聯絡人" />
              </div>
              <div className="space-y-1.5">
                <Label>聯絡電話</Label>
                <Input value={form.contactPhone} onChange={e => f('contactPhone', e.target.value)}
                  placeholder="02-1234-5678" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>聯絡信箱</Label>
              <Input value={form.contactEmail} onChange={e => f('contactEmail', e.target.value)}
                placeholder="logistics@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>運價表</Label>
              <Textarea value={form.rateCard} onChange={e => f('rateCard', e.target.value)}
                rows={2} placeholder="重量/材積計費說明..." />
            </div>
            <div className="space-y-1.5">
              <Label>異常理賠規則</Label>
              <Textarea value={form.claimRules} onChange={e => f('claimRules', e.target.value)}
                rows={2} placeholder="損毀賠償條件..." />
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea value={form.notes} onChange={e => f('notes', e.target.value)}
                rows={2} placeholder="特殊說明..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? '儲存' : '新增'}
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
    if (!vForm.plateNo) { toast.error('請填寫車牌號碼'); return }
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
      toast.success(editingVehicle ? '車輛資料已更新' : '車輛已新增')
      setVehicleOpen(false)
      fetchVehicles()
    } else {
      const d = await res.json()
      toast.error(d.error ?? '儲存失敗')
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
    if (!mForm.title)       { toast.error('請填寫保養項目'); return }
    if (!mForm.serviceDate) { toast.error('請填寫保養日期'); return }
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
      toast.success('保養紀錄已新增')
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
      toast.error(d.error ?? '儲存失敗')
    }
  }

  function maintTypeLabel(type: string): string {
    return MAINTENANCE_TYPES.find(t => t.value === type)?.label ?? type
  }

  return (
    <>
      {/* Vehicles toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {vehicles.length} 輛車</p>
        <Button onClick={openCreateVehicle}>
          <Plus className="mr-2 h-4 w-4" />新增車輛
        </Button>
      </div>

      {/* Vehicle list */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-16 text-center text-muted-foreground">
          尚無車輛資料，請新增第一輛車
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
                        {[v.vehicleType, v.brand, v.year ? `${v.year}年` : null]
                          .filter(Boolean).join(' · ') || '未設定車型'}
                      </div>
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                    {/* Driver */}
                    <div>
                      <span className="text-slate-500 font-medium">司機</span>
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
                      <span className="text-slate-500 font-medium">目前里程</span>
                      <div className="mt-0.5">
                        {v.currentOdometer != null
                          ? `${v.currentOdometer.toLocaleString()} km`
                          : '—'
                        }
                      </div>
                    </div>

                    {/* Fuel type + max weight */}
                    <div>
                      <span className="text-slate-500 font-medium">燃料 / 載重</span>
                      <div className="mt-0.5">
                        {[
                          FUEL_TYPES.find(f => f.value === v.fuelType)?.label,
                          v.maxWeight ? `${v.maxWeight} kg` : null,
                        ].filter(Boolean).join(' / ') || '—'}
                      </div>
                    </div>

                    {/* Expiry dates */}
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-slate-500 font-medium">到期日</span>
                      <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5">
                        <span>保險：{fmtDate(v.insuranceExpiry)}</span>
                        <span>驗車：{fmtDate(v.inspectionExpiry)}</span>
                        <span>牌照稅：{fmtDate(v.licenseTaxExpiry)}</span>
                        <span>燃料稅：{fmtDate(v.fuelTaxExpiry)}</span>
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
                            className={`text-xs ${alertColor(alert)}`}
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
                        {v._count.maintenances} 筆保養
                      </span>
                      <button
                        onClick={() => openEditVehicle(v)}
                        className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground"
                        title="編輯車輛"
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
                        ? <><ChevronDown className="h-3.5 w-3.5" />收起保養紀錄</>
                        : <><ChevronRight className="h-3.5 w-3.5" />查看保養紀錄</>
                      }
                    </button>
                  </div>
                </div>

                {/* Maintenance records (expandable) */}
                {expandedId === v.id && (
                  <div className="border-t bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">保養紀錄</span>
                      <Button size="sm" variant="outline" onClick={() => openAddMaintenance(v.id)}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />新增保養
                      </Button>
                    </div>

                    {maintLoading[v.id] ? (
                      <div className="py-6 flex justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : !maintRecords[v.id] || maintRecords[v.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">尚無保養紀錄</p>
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
                                <span>里程：{rec.odometerAtService.toLocaleString()} km</span>
                              )}
                              {rec.vendor && <span>保養廠：{rec.vendor}</span>}
                              {rec.nextServiceDate && (
                                <span>下次保養日：{fmtDate(rec.nextServiceDate)}</span>
                              )}
                              {rec.nextServiceKm != null && (
                                <span>下次保養里程：{rec.nextServiceKm.toLocaleString()} km</span>
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
            <DialogTitle>{editingVehicle ? '編輯車輛' : '新增車輛'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            {/* 車牌 */}
            <div className="space-y-1.5">
              <Label>車牌號碼 <span className="text-red-500">*</span></Label>
              <Input
                value={vForm.plateNo}
                onChange={e => vf('plateNo', e.target.value.toUpperCase())}
                placeholder="ABC-1234"
                maxLength={10}
              />
            </div>

            {/* 車型 + 品牌 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>車型</Label>
                <select
                  value={vForm.vehicleType}
                  onChange={e => vf('vehicleType', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— 選擇車型 —</option>
                  {VEHICLE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>品牌</Label>
                <Input
                  value={vForm.brand}
                  onChange={e => vf('brand', e.target.value)}
                  placeholder="ISUZU / HINO"
                />
              </div>
            </div>

            {/* 出廠年份 + 載重 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>出廠年份</Label>
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
                <Label>載重（kg）</Label>
                <Input
                  type="number"
                  min={0}
                  value={vForm.maxWeight}
                  onChange={e => vf('maxWeight', e.target.value)}
                  placeholder="3500"
                />
              </div>
            </div>

            {/* 燃料 + 目前里程 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>燃料種類</Label>
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
                <Label>目前里程（km）</Label>
                <Input
                  type="number"
                  min={0}
                  value={vForm.currentOdometer}
                  onChange={e => vf('currentOdometer', e.target.value)}
                  placeholder="50000"
                />
              </div>
            </div>

            {/* 保險 + 驗車到期 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>保險到期日</Label>
                <Input
                  type="date"
                  value={vForm.insuranceExpiry}
                  onChange={e => vf('insuranceExpiry', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>驗車到期日</Label>
                <Input
                  type="date"
                  value={vForm.inspectionExpiry}
                  onChange={e => vf('inspectionExpiry', e.target.value)}
                />
              </div>
            </div>

            {/* 牌照稅 + 燃料稅到期 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>牌照稅到期日</Label>
                <Input
                  type="date"
                  value={vForm.licenseTaxExpiry}
                  onChange={e => vf('licenseTaxExpiry', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>燃料稅到期日</Label>
                <Input
                  type="date"
                  value={vForm.fuelTaxExpiry}
                  onChange={e => vf('fuelTaxExpiry', e.target.value)}
                />
              </div>
            </div>

            {/* 備註 */}
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea
                value={vForm.notes}
                onChange={e => vf('notes', e.target.value)}
                rows={2}
                placeholder="其他說明..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehicleOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={handleVehicleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingVehicle ? '儲存' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add maintenance record dialog ── */}
      <Dialog open={maintOpen} onOpenChange={o => !o && setMaintOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增保養紀錄</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            {/* Type + Title */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>保養類型</Label>
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
                <Label>保養項目 <span className="text-red-500">*</span></Label>
                <Input
                  value={mForm.title}
                  onChange={e => mf('title', e.target.value)}
                  placeholder="更換機油濾芯"
                />
              </div>
            </div>

            {/* Service date + next service date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>保養日期 <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={mForm.serviceDate}
                  onChange={e => mf('serviceDate', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>下次保養日</Label>
                <Input
                  type="date"
                  value={mForm.nextServiceDate}
                  onChange={e => mf('nextServiceDate', e.target.value)}
                />
              </div>
            </div>

            {/* Odometer at service + next service km */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>保養時里程（km）</Label>
                <Input
                  type="number"
                  min={0}
                  value={mForm.odometerAtService}
                  onChange={e => mf('odometerAtService', e.target.value)}
                  placeholder="52000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>下次保養里程（km）</Label>
                <Input
                  type="number"
                  min={0}
                  value={mForm.nextServiceKm}
                  onChange={e => mf('nextServiceKm', e.target.value)}
                  placeholder="57000"
                />
              </div>
            </div>

            {/* Cost + Vendor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>費用（NT$）</Label>
                <Input
                  type="number"
                  min={0}
                  value={mForm.cost}
                  onChange={e => mf('cost', e.target.value)}
                  placeholder="3500"
                />
              </div>
              <div className="space-y-1.5">
                <Label>保養廠</Label>
                <Input
                  value={mForm.vendor}
                  onChange={e => mf('vendor', e.target.value)}
                  placeholder="台灣大保修廠"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea
                value={mForm.notes}
                onChange={e => mf('notes', e.target.value)}
                rows={2}
                placeholder="異常狀況或特殊說明..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintOpen(false)} disabled={maintSaving}>取消</Button>
            <Button onClick={handleMaintSave} disabled={maintSaving}>
              {maintSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
