'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Camera, CheckCircle2, Loader2, X, Package,
  MapPin, User, FileSignature, ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface ShipmentDetail {
  id: string
  shipmentNo: string
  status: string
  address: string | null
  order: {
    orderNo: string
    customer: { name: string; code: string; address: string | null }
  }
  items: { quantity: number; product: { name: string; sku: string; unit: string } }[]
}

export default function DeliveryConfirmPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { dict } = useI18n()
  const d = dict.delivery
  const fileInputRef = useRef<HTMLInputElement>(null)
  const signInputRef = useRef<HTMLInputElement>(null)

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form
  const [recipientName, setRecipientName] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<{ file: File; preview: string; url?: string }[]>([])
  const [signaturePhoto, setSignaturePhoto] = useState<{ file: File; preview: string; url?: string } | null>(null)

  useEffect(() => {
    fetch(`/api/shipments/${id}`)
      .then(r => r.json())
      .then(setShipment)
      .finally(() => setLoading(false))
  }, [id])

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    for (const file of Array.from(files)) {
      setPhotos(prev => [...prev, { file, preview: URL.createObjectURL(file) }])
    }
    e.target.value = ''
  }

  function handleSignatureCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSignaturePhoto({ file, preview: URL.createObjectURL(file) })
    e.target.value = ''
  }

  function removePhoto(idx: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'image')
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    return data.url
  }

  async function handleSubmit() {
    if (photos.length === 0) {
      toast.error(d.atLeastOnePhoto)
      return
    }

    setSubmitting(true)
    try {
      // Upload all photos
      const uploadedPhotos: { url: string; note?: string }[] = []
      for (const photo of photos) {
        const url = await uploadFile(photo.file)
        uploadedPhotos.push({ url })
      }

      let signatureUrl: string | undefined
      if (signaturePhoto) {
        signatureUrl = await uploadFile(signaturePhoto.file)
      }

      // Submit delivery confirmation
      const res = await fetch(`/api/shipments/${id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: uploadedPhotos,
          signatureUrl,
          recipientName: recipientName || undefined,
          notes: notes || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? d.deliverConfirmFailed)
      }

      const result = await res.json()
      toast.success(`${result.shipmentNo} ${d.deliverySuccess} ${d.notified} ${result.notifiedCount} ${d.people}`)
      router.push('/shipments')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!shipment) return <div className="p-4 text-center text-muted-foreground">{d.notFound}</div>

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{d.title}</h1>
          <p className="text-sm text-muted-foreground font-mono">{shipment.shipmentNo}</p>
        </div>
      </div>

      {/* Shipment Info */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{shipment.order.customer.name}</span>
            <span className="text-xs text-muted-foreground">{shipment.order.customer.code}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-sm">{shipment.address || shipment.order.customer.address || d.addressNotSet}</span>
          </div>
          <div className="flex items-start gap-2">
            <Package className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-sm">
              {shipment.items.map(i => `${i.product.name} ×${i.quantity}`).join('、')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Photos */}
      <div>
        <Label className="mb-2 block">{d.deliveryPhotos} <span className="text-red-500">*</span></Label>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          multiple onChange={handlePhotoCapture} className="hidden" />

        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border">
              <img src={photo.preview} alt={`${d.photoAlt} ${idx + 1}`}
                className="w-full h-full object-cover" />
              <button onClick={() => removePhoto(idx)}
                className="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 active:scale-[0.97] transition-all">
            <Camera className="h-8 w-8" />
            <span className="text-xs font-medium">{dict.pickup.takePhoto}</span>
          </button>
        </div>
      </div>

      {/* Signature Photo */}
      <div>
        <Label className="mb-2 block">{d.signaturePhoto}</Label>
        <input ref={signInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleSignatureCapture} className="hidden" />

        {signaturePhoto ? (
          <div className="relative w-48 aspect-[4/3] rounded-xl overflow-hidden border">
            <img src={signaturePhoto.preview} alt={d.signatureAlt}
              className="w-full h-full object-cover" />
            <button onClick={() => { URL.revokeObjectURL(signaturePhoto.preview); setSignaturePhoto(null) }}
              className="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => signInputRef.current?.click()}
            className="w-48 aspect-[4/3] rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 active:scale-[0.97] transition-all">
            <FileSignature className="h-6 w-6" />
            <span className="text-xs font-medium">{d.takeSignature}</span>
          </button>
        )}
      </div>

      {/* Recipient */}
      <div className="space-y-1.5">
        <Label>{d.recipientName}</Label>
        <Input value={recipientName} onChange={e => setRecipientName(e.target.value)}
          placeholder={d.recipientName} />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>{d.notesOptional}</Label>
        <textarea
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
          rows={2} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={d.deliveryNotes} />
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={submitting || photos.length === 0}
        className="w-full rounded-xl bg-green-600 py-4 text-base font-semibold text-white shadow-sm hover:bg-green-500 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {submitting ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> {d.uploading}</>
        ) : (
          <><CheckCircle2 className="h-5 w-5" /> {d.confirmDelivery}</>
        )}
      </button>

      <p className="text-xs text-center text-muted-foreground pb-4">
        {d.autoNotify}
      </p>
    </div>
  )
}
