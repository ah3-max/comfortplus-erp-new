'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Camera, Plus, Trash2, Search, Loader2,
  Package, Truck, TestTube, CheckCircle2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface Product {
  id: string; sku: string; name: string; unit: string; sellingPrice: string
}

interface Customer {
  id: string; code: string; name: string
}

interface PickupItem {
  productId: string
  productName: string
  productSku: string
  unit: string
  quantity: number
}

export default function NewPickupPage() {
  const router = useRouter()
  const { dict } = useI18n()
  const p = dict.pickup
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  // Form state
  const [warehouse, setWarehouse] = useState('MARKETING')
  const [purpose, setPurpose] = useState('DELIVERY')
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerList, setShowCustomerList] = useState(false)
  const [notes, setNotes] = useState('')

  // Products
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [items, setItems] = useState<PickupItem[]>([])

  // Photos
  const [photos, setPhotos] = useState<{ url: string; file?: File; preview: string }[]>([])
  const [uploading, setUploading] = useState(false)

  // Load customers
  useEffect(() => {
    fetch('/api/customers?pageSize=500').then(r => r.json()).then(d => setCustomers(d.data ?? []))
  }, [])

  // Load products with search
  useEffect(() => {
    const params = new URLSearchParams()
    if (productSearch) params.set('search', productSearch)
    const timer = setTimeout(() => {
      fetch(`/api/products?${params}`).then(r => r.json()).then(d => setProducts(d.data ?? []))
    }, 200)
    return () => clearTimeout(timer)
  }, [productSearch])

  const filteredCustomers = customers.filter(
    c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
         c.code.toLowerCase().includes(customerSearch.toLowerCase())
  )

  function addProduct(product: Product) {
    if (items.some(i => i.productId === product.id)) {
      toast.error(dict.pickup.alreadyAdded)
      return
    }
    setItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      unit: product.unit,
      quantity: 1,
    }])
    setShowProductSearch(false)
    setProductSearch('')
  }

  // Camera capture
  function openCamera() {
    fileInputRef.current?.click()
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return

    for (const file of Array.from(files)) {
      const preview = URL.createObjectURL(file)
      setPhotos(prev => [...prev, { url: '', file, preview }])
    }

    // Reset input
    e.target.value = ''
  }

  function removePhoto(index: number) {
    setPhotos(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }

  async function handleSubmit() {
    if (items.length === 0) {
      toast.error(dict.pickup.selectAtLeastOne)
      return
    }

    setLoading(true)

    try {
      // 1. Create pickup record
      const res = await fetch('/api/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse,
          purpose,
          customerId: customerId || undefined,
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          notes: notes || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? dict.common.createFailed)
      }

      const pickup = await res.json()

      // 2. Upload photos if any
      if (photos.length > 0) {
        setUploading(true)
        const uploadedPhotos: { url: string; uploadedAt: string; note?: string }[] = []

        for (const photo of photos) {
          if (!photo.file) continue
          const formData = new FormData()
          formData.append('file', photo.file)
          formData.append('type', 'image')

          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          })

          if (uploadRes.ok) {
            const data = await uploadRes.json()
            uploadedPhotos.push({
              url: data.url,
              uploadedAt: new Date().toISOString(),
            })
          }
        }

        // 3. Attach photos to pickup
        if (uploadedPhotos.length > 0) {
          await fetch(`/api/pickup/${pickup.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'upload_photos', photos: uploadedPhotos }),
          })
        }
      }

      toast.success(dict.pickup.completed)
      router.push('/pickup')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900">{p.newPickup}</h1>

      {/* Warehouse Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { value: 'MARKETING', label: p.warehouseMarketing, sub: p.marketingSub },
          { value: 'MAIN', label: p.warehouseMain, sub: p.mainSub },
        ].map(w => (
          <button key={w.value} type="button"
            onClick={() => setWarehouse(w.value)}
            className={`rounded-xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
              warehouse === w.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}>
            <p className="font-medium text-sm">{w.label}</p>
            <p className="text-xs text-muted-foreground">{w.sub}</p>
          </button>
        ))}
      </div>

      {/* Purpose */}
      <div>
        <Label className="mb-2 block">{p.purpose}</Label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'DELIVERY', label: p.purposeDelivery, icon: Truck },
            { value: 'SAMPLE', label: p.purposeSample, icon: TestTube },
            { value: 'OTHER', label: p.purposeOther, icon: Package },
          ].map(p => {
            const Icon = p.icon
            return (
              <button key={p.value} type="button"
                onClick={() => setPurpose(p.value)}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-medium transition-all active:scale-[0.98] ${
                  purpose === p.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                <Icon className="h-4 w-4" />
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Customer (optional) */}
      <div className="space-y-1.5">
        <Label>{p.customerOptional}</Label>
        {selectedCustomer ? (
          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <span className="text-sm font-medium">{selectedCustomer.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{selectedCustomer.code}</span>
            </div>
            <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerId('') }}
              className="text-xs text-muted-foreground hover:text-foreground p-2">{p.change}</button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={p.searchCustomer}
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setShowCustomerList(true) }}
              onFocus={() => setShowCustomerList(true)} />
            {showCustomerList && filteredCustomers.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.slice(0, 8).map(c => (
                  <button key={c.id} type="button"
                    className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                    onClick={() => { setSelectedCustomer(c); setCustomerId(c.id); setShowCustomerList(false); setCustomerSearch('') }}>
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>{p.pickupProducts}</Label>
          <button type="button"
            onClick={() => setShowProductSearch(true)}
            className="flex items-center gap-1 text-sm text-blue-600 font-medium">
            <Plus className="h-4 w-4" />{p.addProduct}
          </button>
        </div>

        {/* Product Search */}
        {showProductSearch && (
          <Card className="mb-3">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input placeholder={p.searchProduct}
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  autoFocus />
                <button type="button" onClick={() => { setShowProductSearch(false); setProductSearch('') }}
                  className="p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {products.slice(0, 10).map(p => (
                  <button key={p.id} type="button"
                    className="w-full rounded-lg px-3 py-3 text-left hover:bg-slate-50 flex items-center justify-between active:scale-[0.99] transition-all"
                    onClick={() => addProduct(p)}>
                    <div>
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground font-mono">{p.sku}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{p.unit}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Item Cards */}
        {items.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-sm text-muted-foreground">
            {p.addItems}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{item.productSku} · {item.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" className="w-20 text-center"
                    value={item.quantity} min={1}
                    onChange={e => setItems(prev => prev.map((it, i) =>
                      i === idx ? { ...it, quantity: Number(e.target.value) } : it
                    ))} />
                  <button type="button"
                    onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                    className="p-2 text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Capture */}
      <div>
        <Label className="mb-2 block">{p.photoProof}</Label>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          multiple onChange={handlePhotoCapture} className="hidden" />

        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border">
              <img src={photo.preview} alt={`取貨照片 ${idx + 1}`}
                className="w-full h-full object-cover" />
              <button type="button" onClick={() => removePhoto(idx)}
                className="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Add Photo Button */}
          <button type="button" onClick={openCamera}
            className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 active:scale-[0.97] transition-all">
            <Camera className="h-8 w-8" />
            <span className="text-xs font-medium">{p.takePhoto}</span>
          </button>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>{p.notes}</Label>
        <textarea className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
          rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={p.pickupNotes} />
      </div>

      {/* Submit */}
      <button type="button" onClick={handleSubmit} disabled={loading || items.length === 0}
        className="w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-sm hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {uploading ? p.uploading : p.creating}
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5" />
            {p.confirmPickup}
          </>
        )}
      </button>
    </div>
  )
}
