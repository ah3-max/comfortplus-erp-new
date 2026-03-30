'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Loader2, Search, Warehouse, Package, ArrowDownToLine, ArrowUpFromLine,
  Plus, Trash2, MapPin,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'inbound' | 'outbound' | 'inventory' | 'locations'

interface WmsWarehouse { id: string; code: string; name: string }

interface WmsZone {
  id: string
  code: string
  name: string
  warehouse: { id: string; name: string; code: string }
  locations: { id: string; code: string; name: string | null }[]
}

interface WmsLocation {
  id: string
  code: string
  name: string | null
  zone: { id: string; code: string; name: string; warehouse: { id: string; name: string } }
  _count: { inventory: number }
}

interface WmsInventoryItem {
  id: string
  stockNumber: string
  totalQuantity: string
  availableQty: string
  reservedQty: string
  product: { name: string; sku: string }
  location: { code: string; zone: { name: string; warehouse: { name: string } } }
}

interface WmsInbound {
  id: string
  inboundNumber: string
  type: string
  status: string
  expectedDate: string | null
  createdAt: string
  notes: string | null
  items: { id: string; quantity: string; receivedQty: string; product: { name: string; sku: string } }[]
}

interface WmsOutbound {
  id: string
  outboundNumber: string
  type: string
  status: string
  expectedDate: string | null
  createdAt: string
  notes: string | null
  items: { id: string; quantity: string; pickedQty: string; product: { name: string; sku: string } }[]
}

interface Product { id: string; name: string; sku: string; unit: string }

// ─── Constants ───────────────────────────────────────────────────────────────

const INBOUND_TYPES  = ['PURCHASE', 'PRODUCTION', 'TRANSFER']
const OUTBOUND_TYPES = ['SALES', 'TRANSFER', 'INTERNAL']

const INBOUND_STATUS_CLASSES: Record<string, string> = {
  EXPECTED:  'bg-slate-100 text-slate-600',
  RECEIVING: 'bg-amber-100 text-amber-700',
  RECEIVED:  'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}
const OUTBOUND_STATUS_CLASSES: Record<string, string> = {
  EXPECTED:  'bg-slate-100 text-slate-600',
  PICKING:   'bg-amber-100 text-amber-700',
  SHIPPED:   'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(str: string | null | undefined) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface InboundItemRow {
  productId: string
  locationCode: string
  qty: string
  batchNo: string
  expiryDate: string
}

interface OutboundItemRow {
  productId: string
  locationCode: string
  qty: string
}

// ─── Inbound Dialog ──────────────────────────────────────────────────────────

function InboundDialog({
  open, onClose, onCreated, products,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  products: Product[]
}) {
  const { dict } = useI18n()
  const wm = dict.wms
  const [saving, setSaving] = useState(false)
  const [inboundType, setInboundType] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<InboundItemRow[]>([
    { productId: '', locationCode: '', qty: '', batchNo: '', expiryDate: '' },
  ])

  function reset() {
    setInboundType('')
    setReferenceNo('')
    setNotes('')
    setItems([{ productId: '', locationCode: '', qty: '', batchNo: '', expiryDate: '' }])
  }

  function handleClose() {
    reset()
    onClose()
  }

  function addItem() {
    setItems(prev => [...prev, { productId: '', locationCode: '', qty: '', batchNo: '', expiryDate: '' }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof InboundItemRow, value: string) {
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  async function handleSubmit() {
    if (!inboundType) { toast.error(wm.inboundTypeRequired); return }
    if (items.some(r => !r.productId || !r.qty || Number(r.qty) <= 0)) {
      toast.error(wm.itemsRequired)
      return
    }

    setSaving(true)
    try {
      const body = {
        type: inboundType,
        sourceId: referenceNo || undefined,
        notes: notes || undefined,
        items: items.map(r => ({
          productId: r.productId,
          quantity: Number(r.qty),
          locationCode: r.locationCode || undefined,
          batchNo: r.batchNo || undefined,
          expiryDate: r.expiryDate || undefined,
        })),
      }
      const res = await fetch('/api/wms/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? dict.common.createFailed); return }
      toast.success(`${wm.inboundNo} ${data.inboundNumber} ${dict.common.createSuccess}`)
      reset()
      onCreated()
      onClose()
    } catch {
      toast.error(wm.networkError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{wm.newInboundTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{wm.inboundType} <span className="text-red-500">*</span></Label>
              <Select value={inboundType} onValueChange={v => setInboundType(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder={wm.selectType} />
                </SelectTrigger>
                <SelectContent>
                  {INBOUND_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{(wm.inboundTypeLabels as Record<string, string>)[t] ?? t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{wm.referenceNo}</Label>
              <Input
                placeholder={wm.inboundReferenceHint}
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{dict.common.notes}</Label>
            <Input
              placeholder={dict.common.optional}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Items — card layout, no horizontal scroll */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{wm.itemsDetail}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />{wm.addItem}
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((row, idx) => (
                <div key={idx} className="rounded-lg border bg-slate-50/50 p-3 space-y-2.5">
                  {/* Row 1: 品項 (full width) + 刪除 */}
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">{dict.common.product} <span className="text-red-500">*</span></Label>
                      <Select value={row.productId} onValueChange={v => updateItem(idx, 'productId', v ?? '')}>
                        <SelectTrigger className="h-9 bg-white">
                          <SelectValue placeholder={dict.common.product} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} <span className="text-muted-foreground text-xs">({p.sku})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 mt-5 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      disabled={items.length === 1}
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Row 2: 數量 / 貨位 / 批號 / 效期 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{dict.common.quantity} <span className="text-red-500">*</span></Label>
                      <Input
                        className="h-9 bg-white"
                        type="number"
                        min="1"
                        placeholder="0"
                        value={row.qty}
                        onChange={e => updateItem(idx, 'qty', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{wm.locationCodeCol}</Label>
                      <Input
                        className="h-9 bg-white"
                        placeholder="A-01-01"
                        value={row.locationCode}
                        onChange={e => updateItem(idx, 'locationCode', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{wm.batchNo}</Label>
                      <Input
                        className="h-9 bg-white"
                        placeholder={wm.batchNo}
                        value={row.batchNo}
                        onChange={e => updateItem(idx, 'batchNo', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{dict.inventoryExt.expiryDate}</Label>
                      <Input
                        className="h-9 bg-white"
                        type="date"
                        value={row.expiryDate}
                        onChange={e => updateItem(idx, 'expiryDate', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>{dict.common.cancel}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {wm.createInbound}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Outbound Dialog ─────────────────────────────────────────────────────────

function OutboundDialog({
  open, onClose, onCreated, products,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  products: Product[]
}) {
  const { dict } = useI18n()
  const wm = dict.wms
  const [saving, setSaving] = useState(false)
  const [outboundType, setOutboundType] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OutboundItemRow[]>([
    { productId: '', locationCode: '', qty: '' },
  ])

  function reset() {
    setOutboundType('')
    setReferenceNo('')
    setNotes('')
    setItems([{ productId: '', locationCode: '', qty: '' }])
  }

  function handleClose() {
    reset()
    onClose()
  }

  function addItem() {
    setItems(prev => [...prev, { productId: '', locationCode: '', qty: '' }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof OutboundItemRow, value: string) {
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  async function handleSubmit() {
    if (!outboundType) { toast.error(wm.outboundTypeRequired); return }
    if (items.some(r => !r.productId || !r.qty || Number(r.qty) <= 0)) {
      toast.error(wm.itemsRequired)
      return
    }

    setSaving(true)
    try {
      const body = {
        type: outboundType,
        sourceId: referenceNo || undefined,
        notes: notes || undefined,
        items: items.map(r => ({
          productId: r.productId,
          quantity: Number(r.qty),
          locationCode: r.locationCode || undefined,
        })),
      }
      const res = await fetch('/api/wms/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? dict.common.createFailed); return }
      toast.success(`${wm.outboundNo} ${data.outboundNumber} ${dict.common.createSuccess}`)
      reset()
      onCreated()
      onClose()
    } catch {
      toast.error(wm.networkError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{wm.newOutboundTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{wm.outboundType} <span className="text-red-500">*</span></Label>
              <Select value={outboundType} onValueChange={v => setOutboundType(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder={wm.selectType} />
                </SelectTrigger>
                <SelectContent>
                  {OUTBOUND_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{(wm.outboundTypeLabels as Record<string, string>)[t] ?? t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{wm.referenceNo}</Label>
              <Input
                placeholder={wm.outboundReferenceHint}
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{dict.common.notes}</Label>
            <Input
              placeholder={dict.common.optional}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Items — card layout, no horizontal scroll */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{wm.itemsDetail}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />{wm.addItem}
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((row, idx) => (
                <div key={idx} className="rounded-lg border bg-slate-50/50 p-3 space-y-2.5">
                  {/* 品項 + 刪除 */}
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">{dict.common.product} <span className="text-red-500">*</span></Label>
                      <Select value={row.productId} onValueChange={v => updateItem(idx, 'productId', v ?? '')}>
                        <SelectTrigger className="h-9 bg-white">
                          <SelectValue placeholder={dict.common.product} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} <span className="text-muted-foreground text-xs">({p.sku})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 mt-5 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      disabled={items.length === 1}
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 數量 + 貨位 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{dict.common.quantity} <span className="text-red-500">*</span></Label>
                      <Input
                        className="h-9 bg-white"
                        type="number"
                        min="1"
                        placeholder="0"
                        value={row.qty}
                        onChange={e => updateItem(idx, 'qty', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{wm.locationCodeCol}</Label>
                      <Input
                        className="h-9 bg-white"
                        placeholder="A-01-01"
                        value={row.locationCode}
                        onChange={e => updateItem(idx, 'locationCode', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>{dict.common.cancel}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {wm.createOutbound}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Location Dialog ─────────────────────────────────────────────────────────

function LocationDialog({
  open, onClose, onCreated, warehouses, zones,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  warehouses: WmsWarehouse[]
  zones: WmsZone[]
}) {
  const { dict } = useI18n()
  const wm = dict.wms
  const [saving, setSaving] = useState(false)
  const [warehouseId, setWarehouseId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [aisle, setAisle] = useState('')
  const [shelf, setShelf] = useState('')
  const [bin, setBin] = useState('')
  const [name, setName] = useState('')

  const filteredZones = zones.filter(z => !warehouseId || z.warehouse.id === warehouseId)

  // Derive location code from aisle/shelf/bin
  const locationCode = [aisle, shelf, bin].filter(Boolean).join('-')

  function reset() {
    setWarehouseId('')
    setZoneId('')
    setAisle('')
    setShelf('')
    setBin('')
    setName('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  // When warehouse changes, clear zone selection if zone no longer valid
  function handleWarehouseChange(wid: string) {
    setWarehouseId(wid)
    setZoneId('')
  }

  async function handleSubmit() {
    if (!zoneId) { toast.error(wm.locationZoneRequired); return }
    if (!locationCode) { toast.error(wm.locationCodeRequired); return }

    setSaving(true)
    try {
      const res = await fetch('/api/wms/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId,
          code: locationCode,
          name: name || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? dict.common.createFailed); return }
      toast.success(`${wm.locationCodeCol} ${data.code} ${dict.common.createSuccess}`)
      reset()
      onCreated()
      onClose()
    } catch {
      toast.error(wm.networkError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{wm.newLocationTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{dict.common.warehouse}</Label>
            <Select value={warehouseId} onValueChange={v => handleWarehouseChange(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder={wm.selectWarehouseOptional} />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{wm.zone} <span className="text-red-500">*</span></Label>
            <Select value={zoneId} onValueChange={v => setZoneId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder={wm.selectZoneRequired} />
              </SelectTrigger>
              <SelectContent>
                {filteredZones.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {warehouseId ? wm.zoneNoLocations : wm.selectZoneFirst}
                  </div>
                ) : filteredZones.map(z => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.code} - {z.name}
                    <span className="text-muted-foreground text-xs ml-1">({z.warehouse.name})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{wm.aisle}</Label>
              <Input
                placeholder="A"
                value={aisle}
                onChange={e => setAisle(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{wm.shelf}</Label>
              <Input
                placeholder="01"
                value={shelf}
                onChange={e => setShelf(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{wm.bin}</Label>
              <Input
                placeholder="01"
                value={bin}
                onChange={e => setBin(e.target.value)}
              />
            </div>
          </div>

          {locationCode && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
              {wm.locationCodePreview}<span className="font-mono font-semibold">{locationCode}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{wm.locationNameOptional}</Label>
            <Input
              placeholder={wm.locationNameOptional}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>{dict.common.cancel}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {wm.createLocation}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WmsPage() {
  const { dict } = useI18n()
  const wm = dict.wms

  const TABS: { key: Tab; label: string }[] = [
    { key: 'inbound',   label: wm.tabInbound },
    { key: 'outbound',  label: wm.tabOutbound },
    { key: 'inventory', label: wm.tabInventory },
    { key: 'locations', label: wm.tabLocations },
  ]

  const INBOUND_TYPE_LABELS: Record<string, string> = {
    PURCHASE:   wm.inboundTypeLabels.PURCHASE,
    PRODUCTION: wm.inboundTypeLabels.PRODUCTION,
    TRANSFER:   wm.inboundTypeLabels.TRANSFER,
  }
  const OUTBOUND_TYPE_LABELS: Record<string, string> = {
    SALES:    wm.outboundTypeLabels.SALES,
    TRANSFER: wm.outboundTypeLabels.TRANSFER,
    INTERNAL: wm.outboundTypeLabels.INTERNAL,
  }
  const INBOUND_STATUS: Record<string, { label: string; className: string }> = {
    EXPECTED:  { label: wm.inboundStatusLabels.EXPECTED,  className: INBOUND_STATUS_CLASSES.EXPECTED },
    RECEIVING: { label: wm.inboundStatusLabels.RECEIVING, className: INBOUND_STATUS_CLASSES.RECEIVING },
    RECEIVED:  { label: wm.inboundStatusLabels.RECEIVED,  className: INBOUND_STATUS_CLASSES.RECEIVED },
    CANCELLED: { label: wm.inboundStatusLabels.CANCELLED, className: INBOUND_STATUS_CLASSES.CANCELLED },
  }
  const OUTBOUND_STATUS: Record<string, { label: string; className: string }> = {
    EXPECTED:  { label: wm.outboundStatusLabels.EXPECTED,  className: OUTBOUND_STATUS_CLASSES.EXPECTED },
    PICKING:   { label: wm.outboundStatusLabels.PICKING,   className: OUTBOUND_STATUS_CLASSES.PICKING },
    SHIPPED:   { label: wm.outboundStatusLabels.SHIPPED,   className: OUTBOUND_STATUS_CLASSES.SHIPPED },
    CANCELLED: { label: wm.outboundStatusLabels.CANCELLED, className: OUTBOUND_STATUS_CLASSES.CANCELLED },
  }

  const [activeTab, setActiveTab] = useState<Tab>('inbound')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Data
  const [inventory, setInventory]   = useState<WmsInventoryItem[]>([])
  const [inbounds, setInbounds]     = useState<WmsInbound[]>([])
  const [outbounds, setOutbounds]   = useState<WmsOutbound[]>([])
  const [locations, setLocations]   = useState<WmsLocation[]>([])
  const [products, setProducts]     = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<WmsWarehouse[]>([])
  const [zones, setZones]           = useState<WmsZone[]>([])

  // Dialog states
  const [showInbound,  setShowInbound]  = useState(false)
  const [showOutbound, setShowOutbound] = useState(false)
  const [showLocation, setShowLocation] = useState(false)

  // Load product + warehouse + zone reference data once
  const refLoaded = useRef(false)
  useEffect(() => {
    if (refLoaded.current) return
    refLoaded.current = true

    Promise.all([
      fetch('/api/products?pageSize=200').then(r => r.json()),
      fetch('/api/warehouses').then(r => r.json()),
      fetch('/api/wms/zones?pageSize=100').then(r => r.json()),
    ]).then(([prodRes, whRes, zoneRes]) => {
      setProducts(prodRes.data ?? [])
      setWarehouses(Array.isArray(whRes) ? whRes : (whRes.data ?? []))
      setZones(zoneRes.data ?? [])
    }).catch(() => {})
  }, [])

  const fetchTab = useCallback(async () => {
    setLoading(true)
    try {
      if (activeTab === 'inbound') {
        const res = await fetch(`/api/wms/inbound?search=${encodeURIComponent(search)}&pageSize=100`)
        const result = await res.json()
        setInbounds(result.data ?? [])
      } else if (activeTab === 'outbound') {
        const res = await fetch(`/api/wms/outbound?search=${encodeURIComponent(search)}&pageSize=100`)
        const result = await res.json()
        setOutbounds(result.data ?? [])
      } else if (activeTab === 'inventory') {
        const res = await fetch(`/api/wms/inventory?search=${encodeURIComponent(search)}&pageSize=100`)
        const result = await res.json()
        setInventory(result.data ?? [])
      } else if (activeTab === 'locations') {
        const res = await fetch(`/api/wms/locations?search=${encodeURIComponent(search)}&pageSize=100`)
        const result = await res.json()
        setLocations(result.data ?? [])
      }
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [activeTab, search])

  useEffect(() => {
    const t = setTimeout(fetchTab, 300)
    return () => clearTimeout(t)
  }, [fetchTab])

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    setSearch('')
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.wms.title}</h1>
          <p className="text-sm text-muted-foreground">{wm.subtitle}</p>
        </div>
        <div>
          {activeTab === 'inbound' && (
            <Button onClick={() => setShowInbound(true)} className="min-h-[44px]">
              <Plus className="h-4 w-4 mr-2" />{dict.wms.newInbound}
            </Button>
          )}
          {activeTab === 'outbound' && (
            <Button onClick={() => setShowOutbound(true)} className="min-h-[44px]">
              <Plus className="h-4 w-4 mr-2" />{dict.wms.newOutbound}
            </Button>
          )}
          {activeTab === 'locations' && (
            <Button onClick={() => setShowLocation(true)} className="min-h-[44px]">
              <Plus className="h-4 w-4 mr-2" />{dict.wms.newLocation}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] active:scale-[0.97] ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 min-h-[44px]"
          placeholder={dict.wms.searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Inbound Tab ── */}
          {activeTab === 'inbound' && (
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{wm.inboundNo}</TableHead>
                      <TableHead>{dict.common.type}</TableHead>
                      <TableHead className="hidden sm:table-cell">{dict.common.product}</TableHead>
                      <TableHead>{dict.common.status}</TableHead>
                      <TableHead className="hidden md:table-cell">{wm.expectedDate}</TableHead>
                      <TableHead className="hidden md:table-cell">{dict.common.createdAt}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inbounds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-16 text-center">
                          <ArrowDownToLine className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
                          <p className="text-muted-foreground">{dict.common.noRecords}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setShowInbound(true)}
                          >
                            <Plus className="h-4 w-4 mr-1" />{dict.wms.newInbound}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : inbounds.map(ib => {
                      const st = INBOUND_STATUS[ib.status] ?? { label: ib.status, className: '' }
                      return (
                        <TableRow key={ib.id}>
                          <TableCell className="font-mono text-sm font-medium">{ib.inboundNumber}</TableCell>
                          <TableCell className="text-sm">
                            {INBOUND_TYPE_LABELS[ib.type] ?? ib.type}
                          </TableCell>
                          <TableCell className="text-sm hidden sm:table-cell max-w-[200px] truncate">
                            {ib.items.map(i => i.product.name).join('、') || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={st.className}>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm hidden md:table-cell">
                            {fmtDate(ib.expectedDate)}
                          </TableCell>
                          <TableCell className="text-sm hidden md:table-cell">
                            {fmtDate(ib.createdAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ── Outbound Tab ── */}
          {activeTab === 'outbound' && (
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{wm.outboundNo}</TableHead>
                      <TableHead>{dict.common.type}</TableHead>
                      <TableHead className="hidden sm:table-cell">{dict.common.product}</TableHead>
                      <TableHead>{dict.common.status}</TableHead>
                      <TableHead className="hidden md:table-cell">{wm.expectedDate}</TableHead>
                      <TableHead className="hidden md:table-cell">{dict.common.createdAt}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outbounds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-16 text-center">
                          <ArrowUpFromLine className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
                          <p className="text-muted-foreground">{dict.common.noRecords}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setShowOutbound(true)}
                          >
                            <Plus className="h-4 w-4 mr-1" />{dict.wms.newOutbound}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : outbounds.map(ob => {
                      const st = OUTBOUND_STATUS[ob.status] ?? { label: ob.status, className: '' }
                      return (
                        <TableRow key={ob.id}>
                          <TableCell className="font-mono text-sm font-medium">{ob.outboundNumber}</TableCell>
                          <TableCell className="text-sm">
                            {OUTBOUND_TYPE_LABELS[ob.type] ?? ob.type}
                          </TableCell>
                          <TableCell className="text-sm hidden sm:table-cell max-w-[200px] truncate">
                            {ob.items.map(i => i.product.name).join('、') || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={st.className}>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm hidden md:table-cell">
                            {fmtDate(ob.expectedDate)}
                          </TableCell>
                          <TableCell className="text-sm hidden md:table-cell">
                            {fmtDate(ob.createdAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ── Inventory Tab ── */}
          {activeTab === 'inventory' && (
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{wm.stockNo}</TableHead>
                      <TableHead>{dict.common.product}</TableHead>
                      <TableHead className="hidden sm:table-cell">{dict.common.warehouse} / {dict.wms.zone} / {dict.wms.bin}</TableHead>
                      <TableHead className="text-right">{dict.common.quantity}</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">{dict.inventoryExt.available}</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">{wm.reserved}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-16 text-center">
                          <Warehouse className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
                          <p className="text-muted-foreground">{dict.wms.noResults}</p>
                        </TableCell>
                      </TableRow>
                    ) : inventory.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.stockNumber}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{inv.product.name}</div>
                          <div className="text-xs text-muted-foreground">{inv.product.sku}</div>
                        </TableCell>
                        <TableCell className="text-sm hidden sm:table-cell">
                          {inv.location.zone.warehouse.name} / {inv.location.zone.name} / {inv.location.code}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(inv.totalQuantity).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-green-600 hidden sm:table-cell">
                          {Number(inv.availableQty).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-amber-600 hidden sm:table-cell">
                          {Number(inv.reservedQty).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ── Locations Tab ── */}
          {activeTab === 'locations' && (
            <>
              {locations.length === 0 ? (
                <div className="py-16 text-center rounded-lg border bg-white">
                  <MapPin className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-muted-foreground">{dict.common.noRecords}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowLocation(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />{dict.wms.newLocation}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {locations.map(loc => (
                    <Card key={loc.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="font-mono">{loc.code}</span>
                          {loc._count.inventory > 0 && (
                            <Badge variant="outline" className="ml-auto text-xs bg-green-50 text-green-700">
                              {loc._count.inventory} {wm.itemsDetail}
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-1">
                        {loc.name && (
                          <p className="text-sm text-slate-700">{loc.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {loc.zone.warehouse.name} › {loc.zone.code} - {loc.zone.name}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Dialogs ── */}
      <InboundDialog
        open={showInbound}
        onClose={() => setShowInbound(false)}
        onCreated={fetchTab}
        products={products}
      />
      <OutboundDialog
        open={showOutbound}
        onClose={() => setShowOutbound(false)}
        onCreated={fetchTab}
        products={products}
      />
      <LocationDialog
        open={showLocation}
        onClose={() => setShowLocation(false)}
        onCreated={fetchTab}
        warehouses={warehouses}
        zones={zones}
      />
    </div>
  )
}
