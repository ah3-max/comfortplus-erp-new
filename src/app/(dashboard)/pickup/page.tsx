'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Camera, Plus, Package, CheckCircle2, Clock,
  XCircle, Loader2, ImageIcon, Truck, TestTube,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

interface PickupItem {
  id: string
  quantity: number
  product: { sku: string; name: string; unit: string }
}

interface Pickup {
  id: string
  pickupNo: string
  warehouse: string
  purpose: string
  status: string
  photoCount: number
  photos: unknown[]
  createdAt: string
  pickedBy: { name: string }
  verifiedBy: { name: string } | null
  customer: { name: string } | null
  items: PickupItem[]
}

function useStatusMap() {
  const { dict } = useI18n()
  const p = dict.pickup
  return {
    PENDING_PHOTO:  { label: p.statusPendingPhoto, cls: 'bg-amber-100 text-amber-700', icon: Camera },
    PENDING_VERIFY: { label: p.statusPendingVerify, cls: 'bg-blue-100 text-blue-700', icon: Clock },
    VERIFIED:       { label: p.statusVerified, cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    DEDUCTED:       { label: p.statusDeducted, cls: 'bg-slate-100 text-slate-600', icon: Package },
    REJECTED:       { label: p.statusRejected, cls: 'bg-red-100 text-red-700', icon: XCircle },
  } as Record<string, { label: string; cls: string; icon: typeof Clock }>
}

function usePurposeMap() {
  const { dict } = useI18n()
  const p = dict.pickup
  return {
    DELIVERY: { label: p.purposeDelivery, icon: Truck },
    SAMPLE:   { label: p.purposeSample, icon: TestTube },
    DEMO:     { label: p.purposeDemo, icon: Package },
    RETURN:   { label: p.purposeDelivery, icon: Package },
    OTHER:    { label: p.purposeOther, icon: Package },
  } as Record<string, { label: string; icon: typeof Truck }>
}

export default function PickupListPage() {
  const { dict } = useI18n()
  const p = dict.pickup
  const statusMap = useStatusMap()
  const purposeMap = usePurposeMap()
  const [pickups, setPickups] = useState<Pickup[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'mine' | 'pending'>('mine')

  useEffect(() => {
    const params = new URLSearchParams()
    if (tab === 'mine') params.set('mine', 'true')
    if (tab === 'pending') params.set('status', 'PENDING_VERIFY')

    fetch(`/api/pickup?${params}`)
      .then(r => r.json())
      .then(setPickups)
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">{p.title}</h1>
        <Link href="/pickup/new"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-500 active:scale-[0.97] transition-all">
          <Plus className="h-5 w-5" />
          {p.newPickup}
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTab('mine'); setLoading(true) }}
          className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
            tab === 'mine' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
          }`}
        >{p.myPickups}</button>
        <button
          onClick={() => { setTab('pending'); setLoading(true) }}
          className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
            tab === 'pending' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
          }`}
        >{p.pendingVerify}</button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pickups.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {tab === 'mine' ? p.noPickups : p.noPending}
        </div>
      ) : (
        <div className="space-y-3">
          {pickups.map(p => {
            const status = statusMap[p.status] ?? statusMap.PENDING_PHOTO
            const purpose = purposeMap[p.purpose] ?? purposeMap.OTHER
            const StatusIcon = status.icon
            const PurposeIcon = purpose.icon

            return (
              <Link key={p.id} href={`/pickup/${p.id}`}>
                <Card className="hover:border-blue-300 transition-colors active:scale-[0.99]">
                  <CardContent className="p-4">
                    {/* Row 1: No + Status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold">{p.pickupNo}</span>
                        <Badge variant="outline" className={`text-xs ${status.cls}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p.photoCount > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <ImageIcon className="h-3 w-3" />{p.photoCount}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          <PurposeIcon className="h-3 w-3 mr-1" />
                          {purpose.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Row 2: Customer + Items */}
                    <div className="text-sm">
                      {p.customer && (
                        <span className="text-slate-700 font-medium">{p.customer.name} · </span>
                      )}
                      <span className="text-muted-foreground">
                        {p.items.map(it => `${it.product.name}×${it.quantity}`).join('、')}
                      </span>
                    </div>

                    {/* Row 3: Meta */}
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{p.pickedBy.name} · {p.warehouse === 'MARKETING' ? '中和行銷倉' : '龜山大倉'}</span>
                      <span>{new Date(p.createdAt).toLocaleDateString('zh-TW')}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
