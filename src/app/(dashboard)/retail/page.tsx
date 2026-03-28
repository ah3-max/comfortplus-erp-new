'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Store, MapPin, Plus, Loader2, Users, CalendarCheck, ClipboardCheck,
  ChevronDown, ChevronRight, Building2, Clock, Truck, Layers, ShoppingBag,
  Phone, User, Pencil, X, Check, Calendar, Tag, Package, BarChart3,
  PartyPopper, AlertCircle, TrendingUp,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
interface RetailBrand {
  id: string; code: string; name: string; brandType: string
  website?: string | null
  hqContact?: string | null; hqPhone?: string | null
  // 採購窗口
  buyerName?: string | null; buyerTitle?: string | null; buyerDept?: string | null
  buyerPhone?: string | null; buyerEmail?: string | null; buyerLine?: string | null
  // 採購條件
  purchaseMode?: string | null; paymentTerms?: string | null; creditDays?: number | null
  deliveryLeadDays?: number | null; minOrderQty?: number | null; minOrderNote?: string | null
  discountNote?: string | null; listingFee?: string | null; annualFee?: string | null
  contractExpiry?: string | null; contractNote?: string | null
  notes?: string | null; isActive: boolean
  _count?: { outlets: number }
}

interface RetailOutletEvent {
  id: string; eventName: string; eventStatus: string; eventDate: string
  endDate?: string | null; eventType: string
}

interface RetailOutlet {
  id: string; outletCode?: string | null; outletName: string
  brandId: string; brand: { id: string; name: string; code: string; brandType: string }
  address?: string | null; city?: string | null; region?: string | null
  phone?: string | null; openHours?: string | null; closedDays?: string | null
  storeManagerName?: string | null; storeManagerPhone?: string | null; storeManagerLine?: string | null
  salesRepName?: string | null; backupContactName?: string | null; backupContactPhone?: string | null
  displayShelfCount?: number | null; displayShelfSpec?: string | null
  displayRequirements?: string | null; facingCount?: number | null
  shelfLocation?: string | null; displayType?: string | null
  eventRequirements?: string | null; promoCalendarNote?: string | null; minOrderQtyPerEvent?: number | null
  placementZone?: string | null; placementDetail?: string | null
  maxSkuCount?: number | null; maxUnitsPerSku?: number | null; maxPacksTotal?: number | null; currentSkuCount?: number | null
  deliveryTimeWindow?: string | null; deliveryDayOfWeek?: string | null
  logisticsNote?: string | null; parkingInfo?: string | null; loadingDockNote?: string | null
  commissionRate?: string | null; paymentTerms?: string | null; settlementDay?: number | null
  shelfRent?: string | null; displayFee?: string | null
  isActive: boolean; notes?: string | null
  events: RetailOutletEvent[]
  _count: { events: number; groupBuys: number }
}

interface RetailEvent {
  id: string; outletId?: string | null; eventType: string; eventName: string
  eventStatus: string; eventDate: string; endDate?: string | null
  location?: string | null; budget?: string | null; actualCost?: string | null
  staffNote?: string | null
  setupRequirements?: string | null; productRequirements?: string | null; communicationNote?: string | null
  attendeeCount?: number | null; sampleQty?: number | null; ordersTaken?: number | null
  leadsCollected?: number | null; revenueDuringEvent?: string | null; unitsSoldDuringEvent?: number | null
  couponRedeemed?: number | null; newCustomersCollected?: number | null
  roi?: string | null; targetAchievementPct?: string | null
  performanceSummary?: string | null; nextActionNote?: string | null; notes?: string | null
  outlet?: { id: string; outletName: string; brand: { name: string } } | null
  groupBuy?: RetailGroupBuy | null
}

interface RetailGroupBuy {
  id: string; groupBuyTitle: string; organizer?: string | null
  organizerPhone?: string | null; platform?: string | null
  minQty: number; targetQty?: number | null; groupBuyPrice: string
  originalPrice?: string | null; discountNote?: string | null
  openDate: string; closeDate: string; shipDate?: string | null
  status: string; actualOrders?: number | null; actualQty?: number | null
  actualRevenue?: string | null; fulfillmentNote?: string | null; notes?: string | null
}

// ── Config (color-only) ────────────────────────────────────────────────────
const BRAND_TYPE_COLOR: Record<string, string> = {
  SUPERMARKET:  'bg-green-100 text-green-700',
  PHARMACY:     'bg-pink-100 text-pink-700',
  WAREHOUSE:    'bg-blue-100 text-blue-700',
  CONVENIENCE:  'bg-orange-100 text-orange-700',
  DRUG_STORE:   'bg-purple-100 text-purple-700',
  OTHER:        'bg-slate-100 text-slate-600',
}
const EVENT_STATUS_COLOR: Record<string, string> = {
  PLANNING:   'bg-amber-100 text-amber-700',
  ACTIVE:     'bg-green-100 text-green-700',
  COMPLETED:  'bg-slate-100 text-slate-600',
  CANCELLED:  'bg-red-100 text-red-600',
}
const GROUP_BUY_STATUS_COLOR: Record<string, string> = {
  OPEN:       'bg-green-100 text-green-700',
  CLOSED:     'bg-blue-100 text-blue-700',
  FULFILLED:  'bg-slate-100 text-slate-600',
  CANCELLED:  'bg-red-100 text-red-600',
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}
function fmtMoney(v: string | number | null | undefined) {
  if (v == null || v === '') return '—'
  return `$${Number(v).toLocaleString()}`
}

// ── Info Row ────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <span className="text-muted-foreground whitespace-nowrap">{label}：</span>
      <span className="text-slate-700">{value}</span>
    </div>
  )
}

// ── Brand Form ──────────────────────────────────────────────────────────────
function BrandForm({ initial, onSaved, onCancel }: {
  initial?: Partial<RetailBrand>; onSaved: () => void; onCancel: () => void
}) {
  const { dict } = useI18n()
  const rt = dict.retail
  type BrTy = keyof typeof rt.brandTypes
  type PuMo = keyof typeof rt.purchaseModes
  const isEdit = !!initial?.id
  const [tab, setTab] = useState<'basic' | 'buyer' | 'terms'>('basic')
  const [f, setF] = useState({
    code:             initial?.code             || '',
    name:             initial?.name             || '',
    brandType:        initial?.brandType        || 'OTHER',
    website:          initial?.website          || '',
    hqContact:        initial?.hqContact        || '',
    hqPhone:          initial?.hqPhone          || '',
    buyerName:        initial?.buyerName        || '',
    buyerTitle:       initial?.buyerTitle       || '',
    buyerDept:        initial?.buyerDept        || '',
    buyerPhone:       initial?.buyerPhone       || '',
    buyerEmail:       initial?.buyerEmail       || '',
    buyerLine:        initial?.buyerLine        || '',
    purchaseMode:     initial?.purchaseMode     || '',
    paymentTerms:     initial?.paymentTerms     || '',
    creditDays:       initial?.creditDays       ?? '',
    deliveryLeadDays: initial?.deliveryLeadDays ?? '',
    minOrderQty:      initial?.minOrderQty      ?? '',
    minOrderNote:     initial?.minOrderNote     || '',
    discountNote:     initial?.discountNote     || '',
    listingFee:       initial?.listingFee       ?? '',
    annualFee:        initial?.annualFee        ?? '',
    contractExpiry:   initial?.contractExpiry   ? initial.contractExpiry.slice(0, 10) : '',
    contractNote:     initial?.contractNote     || '',
    notes:            initial?.notes            || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setF(prev => ({ ...prev, [k]: v }))

  async function handleSubmit() {
    if (!f.code || !f.name) { toast.error(rt.brandRequired); return }
    setSaving(true)
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const payload = isEdit ? { ...f, id: initial!.id } : f
      const res = await fetch('/api/retail/brands', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success(isEdit ? rt.brandUpdated : rt.brandCreated)
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : dict.common.saveFailed) }
    finally { setSaving(false) }
  }

  const tabs = [
    { key: 'basic', label: '基本資訊' },
    { key: 'buyer', label: '採購窗口' },
    { key: 'terms', label: '採購條件' },
  ] as const

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-blue-900 flex items-center gap-2">
          <Building2 className="h-4 w-4" />{isEdit ? `編輯通路：${initial?.name}` : '新增通路品牌'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sub-tabs */}
        <div className="flex gap-1 border-b">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 基本資訊 ── */}
        {tab === 'basic' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">代碼 * (英文大寫)</Label>
                <Input value={f.code} onChange={e => set('code', e.target.value.toUpperCase())} className="h-9 text-sm" placeholder="QUANSHENG" disabled={isEdit} />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">通路品牌名稱 *</Label>
                <Input value={f.name} onChange={e => set('name', e.target.value)} className="h-9 text-sm" placeholder="全聯福利中心" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-2 block">通路類型</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(rt.brandTypes).map(([k, v]) => (
                  <button key={k} onClick={() => set('brandType', k)}
                    className={`text-xs py-1.5 px-3 rounded-lg border-2 font-medium transition-all ${f.brandType === k ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">官網</Label>
                <Input value={f.website} onChange={e => set('website', e.target.value)} className="h-9 text-sm" placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">總部行政聯絡人</Label>
                <Input value={f.hqContact} onChange={e => set('hqContact', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">總部電話</Label>
                <Input value={f.hqPhone} onChange={e => set('hqPhone', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">備注</Label>
              <Input value={f.notes} onChange={e => set('notes', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        )}

        {/* ── 採購窗口 ── */}
        {tab === 'buyer' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">填寫通路採購部門的主要對口人資訊</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">採購負責人姓名</Label>
                <Input value={f.buyerName} onChange={e => set('buyerName', e.target.value)} className="h-9 text-sm" placeholder="王小明" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">職稱</Label>
                <Input value={f.buyerTitle} onChange={e => set('buyerTitle', e.target.value)} className="h-9 text-sm" placeholder="採購專員" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">部門</Label>
                <Input value={f.buyerDept} onChange={e => set('buyerDept', e.target.value)} className="h-9 text-sm" placeholder="採購部 / 商品部" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">直撥電話 / 手機</Label>
                <Input value={f.buyerPhone} onChange={e => set('buyerPhone', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">Email</Label>
                <Input value={f.buyerEmail} onChange={e => set('buyerEmail', e.target.value)} className="h-9 text-sm" placeholder="buyer@channel.com" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">LINE ID</Label>
                <Input value={f.buyerLine} onChange={e => set('buyerLine', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* ── 採購條件 ── */}
        {tab === 'terms' && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-600 mb-2 block">採購模式</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(rt.purchaseModes).map(([k, v]) => (
                  <button key={k} onClick={() => set('purchaseMode', f.purchaseMode === k ? '' : k)}
                    className={`text-xs py-1.5 px-3 rounded-lg border-2 font-medium transition-all ${f.purchaseMode === k ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">付款條件</Label>
                <Input value={f.paymentTerms} onChange={e => set('paymentTerms', e.target.value)} className="h-9 text-sm" placeholder="月結60天 / 貨到付款" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">帳期天數</Label>
                <Input type="number" value={String(f.creditDays)} onChange={e => set('creditDays', e.target.value)} className="h-9 text-sm" placeholder="60" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">交期天數（下單→到貨）</Label>
                <Input type="number" value={String(f.deliveryLeadDays)} onChange={e => set('deliveryLeadDays', e.target.value)} className="h-9 text-sm" placeholder="7" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">最低訂購量（件/箱）</Label>
                <Input type="number" value={String(f.minOrderQty)} onChange={e => set('minOrderQty', e.target.value)} className="h-9 text-sm" placeholder="100" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-slate-600 mb-1.5 block">最低訂購說明</Label>
                <Input value={f.minOrderNote} onChange={e => set('minOrderNote', e.target.value)} className="h-9 text-sm" placeholder="每次最少下100件，可分批出貨" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">折讓 / 扣款條件</Label>
              <Input value={f.discountNote} onChange={e => set('discountNote', e.target.value)} className="h-9 text-sm" placeholder="年度達標返還2%，退貨扣款5%..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">上架費（元）</Label>
                <Input type="number" value={String(f.listingFee)} onChange={e => set('listingFee', e.target.value)} className="h-9 text-sm" placeholder="0" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">年費 / 管理費（元）</Label>
                <Input type="number" value={String(f.annualFee)} onChange={e => set('annualFee', e.target.value)} className="h-9 text-sm" placeholder="0" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">合約到期日</Label>
                <Input type="date" value={f.contractExpiry} onChange={e => set('contractExpiry', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">合約備注</Label>
              <Input value={f.contractNote} onChange={e => set('contractNote', e.target.value)} className="h-9 text-sm" placeholder="年度採購合約、獨家陳列協議..." />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {isEdit ? '儲存變更' : '新增品牌'}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>取消</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Outlet Form ─────────────────────────────────────────────────────────────
function OutletForm({ brands, initial, onSaved, onCancel }: {
  brands: RetailBrand[]; initial?: Partial<RetailOutlet>; onSaved: () => void; onCancel: () => void
}) {
  const { dict } = useI18n()
  const rt = dict.retail
  const isEdit = !!initial?.id
  const [section, setSection] = useState<'basic' | 'display' | 'logistics' | 'finance'>('basic')
  const [f, setF] = useState({
    brandId: initial?.brandId || '', outletCode: initial?.outletCode || '', outletName: initial?.outletName || '',
    address: initial?.address || '', city: initial?.city || '', region: initial?.region || '',
    phone: initial?.phone || '', openHours: initial?.openHours || '', closedDays: initial?.closedDays || '',
    storeManagerName: initial?.storeManagerName || '', storeManagerPhone: initial?.storeManagerPhone || '',
    storeManagerLine: initial?.storeManagerLine || '', salesRepName: initial?.salesRepName || '',
    backupContactName: initial?.backupContactName || '', backupContactPhone: initial?.backupContactPhone || '',
    displayShelfCount: initial?.displayShelfCount ?? '', displayShelfSpec: initial?.displayShelfSpec || '',
    displayRequirements: initial?.displayRequirements || '', facingCount: initial?.facingCount ?? '',
    shelfLocation: initial?.shelfLocation || '', displayType: initial?.displayType || '',
    eventRequirements: initial?.eventRequirements || '', promoCalendarNote: initial?.promoCalendarNote || '',
    minOrderQtyPerEvent: initial?.minOrderQtyPerEvent ?? '',
    placementZone: initial?.placementZone || '', placementDetail: initial?.placementDetail || '',
    maxSkuCount: initial?.maxSkuCount ?? '', maxUnitsPerSku: initial?.maxUnitsPerSku ?? '',
    maxPacksTotal: initial?.maxPacksTotal ?? '', currentSkuCount: initial?.currentSkuCount ?? '',
    deliveryTimeWindow: initial?.deliveryTimeWindow || '', deliveryDayOfWeek: initial?.deliveryDayOfWeek || '',
    logisticsNote: initial?.logisticsNote || '', parkingInfo: initial?.parkingInfo || '',
    loadingDockNote: initial?.loadingDockNote || '',
    commissionRate: initial?.commissionRate ?? '', paymentTerms: initial?.paymentTerms || '',
    settlementDay: initial?.settlementDay ?? '', shelfRent: initial?.shelfRent ?? '',
    displayFee: initial?.displayFee ?? '', notes: initial?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string | number) => setF(prev => ({ ...prev, [k]: v }))

  async function handleSubmit() {
    if (!f.outletName || !f.brandId) { toast.error(rt.outletRequired); return }
    setSaving(true)
    try {
      const url    = isEdit ? `/api/retail/outlets/${initial!.id}` : '/api/retail/outlets'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success(isEdit ? rt.outletUpdated : rt.outletCreated)
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : dict.common.saveFailed) }
    finally { setSaving(false) }
  }

  const tabs = [
    { key: 'basic',     label: '基本資訊' },
    { key: 'display',   label: '展示/容量' },
    { key: 'logistics', label: '物流/停車' },
    { key: 'finance',   label: '財務條件' },
  ] as const

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-blue-900 flex items-center gap-2">
          <Store className="h-4 w-4" />{isEdit ? `編輯門市：${initial?.outletName}` : '新增門市'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sub-tabs */}
        <div className="flex gap-1 border-b">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setSection(t.key)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${section === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 基本資訊 ── */}
        {section === 'basic' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">通路品牌 *</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.brandId} onChange={e => set('brandId', e.target.value)}>
                  <option value="">選擇品牌…</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">門市代碼</Label>
                <Input value={String(f.outletCode)} onChange={e => set('outletCode', e.target.value)} className="h-9 text-sm" placeholder="QS-001" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">門市名稱 *</Label>
              <Input value={f.outletName} onChange={e => set('outletName', e.target.value)} className="h-9 text-sm" placeholder="全聯忠孝店" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-slate-600 mb-1.5 block">地址</Label>
                <Input value={f.address} onChange={e => set('address', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">縣市</Label>
                <Input value={f.city} onChange={e => set('city', e.target.value)} className="h-9 text-sm" placeholder="台北市" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">門市電話</Label>
                <Input value={f.phone} onChange={e => set('phone', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">營業時間</Label>
                <Input value={f.openHours} onChange={e => set('openHours', e.target.value)} className="h-9 text-sm" placeholder="09:00-22:00" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">公休日</Label>
                <Input value={f.closedDays} onChange={e => set('closedDays', e.target.value)} className="h-9 text-sm" placeholder="每週三" />
              </div>
            </div>
            <p className="text-xs font-medium text-slate-700 mt-2">人員資訊</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">店長姓名</Label>
                <Input value={f.storeManagerName} onChange={e => set('storeManagerName', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">店長電話</Label>
                <Input value={f.storeManagerPhone} onChange={e => set('storeManagerPhone', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">店長 LINE</Label>
                <Input value={f.storeManagerLine} onChange={e => set('storeManagerLine', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">主責業務</Label>
                <Input value={f.salesRepName} onChange={e => set('salesRepName', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">備用聯絡人</Label>
                <Input value={f.backupContactName} onChange={e => set('backupContactName', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">備用電話</Label>
                <Input value={f.backupContactPhone} onChange={e => set('backupContactPhone', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">備注</Label>
              <Input value={f.notes} onChange={e => set('notes', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        )}

        {/* ── 展示/容量 ── */}
        {section === 'display' && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-700">展示架</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">展示架數量（座）</Label>
                <Input type="number" value={String(f.displayShelfCount)} onChange={e => set('displayShelfCount', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">面排數</Label>
                <Input type="number" value={String(f.facingCount)} onChange={e => set('facingCount', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">展示類型</Label>
                <Input value={f.displayType} onChange={e => set('displayType', e.target.value)} className="h-9 text-sm" placeholder="端架/中島/壁架" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">展示架規格要求</Label>
              <Input value={f.displayShelfSpec} onChange={e => set('displayShelfSpec', e.target.value)} className="h-9 text-sm" placeholder="高180cm×寬60cm，4層" />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">陳列要求</Label>
              <Input value={f.displayRequirements} onChange={e => set('displayRequirements', e.target.value)} className="h-9 text-sm" placeholder="需貼價格牌，正面朝外…" />
            </div>

            <p className="text-xs font-medium text-slate-700 mt-2">置放位置</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">置放區域</Label>
                <Input value={f.placementZone} onChange={e => set('placementZone', e.target.value)} className="h-9 text-sm" placeholder="照護用品區/保健品區" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">架位詳細</Label>
                <Input value={f.shelfLocation} onChange={e => set('shelfLocation', e.target.value)} className="h-9 text-sm" placeholder="B區第3排" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">置放位置說明</Label>
              <Input value={f.placementDetail} onChange={e => set('placementDetail', e.target.value)} className="h-9 text-sm" />
            </div>

            <p className="text-xs font-medium text-slate-700 mt-2">容量限制</p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">最多 SKU 數</Label>
                <Input type="number" value={String(f.maxSkuCount)} onChange={e => set('maxSkuCount', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">每 SKU 最多件</Label>
                <Input type="number" value={String(f.maxUnitsPerSku)} onChange={e => set('maxUnitsPerSku', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">總包數上限</Label>
                <Input type="number" value={String(f.maxPacksTotal)} onChange={e => set('maxPacksTotal', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">目前在架 SKU</Label>
                <Input type="number" value={String(f.currentSkuCount)} onChange={e => set('currentSkuCount', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <p className="text-xs font-medium text-slate-700 mt-2">活動要求</p>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">通路活動要求</Label>
              <Input value={f.eventRequirements} onChange={e => set('eventRequirements', e.target.value)} className="h-9 text-sm" placeholder="最低買量/搭配品…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">促銷檔期說明</Label>
                <Input value={f.promoCalendarNote} onChange={e => set('promoCalendarNote', e.target.value)} className="h-9 text-sm" placeholder="每季4檔" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">每次活動最低訂購量</Label>
                <Input type="number" value={String(f.minOrderQtyPerEvent)} onChange={e => set('minOrderQtyPerEvent', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* ── 物流/停車 ── */}
        {section === 'logistics' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">收貨時間窗</Label>
                <Input value={f.deliveryTimeWindow} onChange={e => set('deliveryTimeWindow', e.target.value)} className="h-9 text-sm" placeholder="週二 09:00-12:00" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">固定補貨星期</Label>
                <Input value={f.deliveryDayOfWeek} onChange={e => set('deliveryDayOfWeek', e.target.value)} className="h-9 text-sm" placeholder="二/四" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">物流備注</Label>
              <Input value={f.logisticsNote} onChange={e => set('logisticsNote', e.target.value)} className="h-9 text-sm" placeholder="需預約收貨/附送貨單…" />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">停車資訊</Label>
              <Input value={f.parkingInfo} onChange={e => set('parkingInfo', e.target.value)} className="h-9 text-sm" placeholder="地下停車場B2，搬運車免費1小時" />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">卸貨月台說明</Label>
              <Input value={f.loadingDockNote} onChange={e => set('loadingDockNote', e.target.value)} className="h-9 text-sm" placeholder="後門卸貨，需聯繫倉管" />
            </div>
          </div>
        )}

        {/* ── 財務 ── */}
        {section === 'finance' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">佣金率 %</Label>
                <Input type="number" value={String(f.commissionRate)} onChange={e => set('commissionRate', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">付款條件</Label>
                <Input value={f.paymentTerms} onChange={e => set('paymentTerms', e.target.value)} className="h-9 text-sm" placeholder="月結30天" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">結帳日</Label>
                <Input type="number" value={String(f.settlementDay)} onChange={e => set('settlementDay', e.target.value)} className="h-9 text-sm" placeholder="每月25日" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">上架費（元）</Label>
                <Input type="number" value={String(f.shelfRent)} onChange={e => set('shelfRent', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">陳列費（元）</Label>
                <Input type="number" value={String(f.displayFee)} onChange={e => set('displayFee', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {isEdit ? '儲存變更' : '新增門市'}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>取消</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Event Form ──────────────────────────────────────────────────────────────
function EventForm({ outlets, initial, onSaved, onCancel }: {
  outlets: RetailOutlet[]; initial?: Partial<RetailEvent>; onSaved: () => void; onCancel: () => void
}) {
  const { dict } = useI18n()
  const rt = dict.retail
  type EvTy = keyof typeof rt.eventTypes
  type EvSt = keyof typeof rt.eventStatuses
  type GbSt = keyof typeof rt.groupBuyStatuses
  const isEdit = !!initial?.id
  const [tab, setTab] = useState<'basic' | 'result'>('basic')
  const [f, setF] = useState({
    outletId: initial?.outletId || '', eventType: initial?.eventType || 'DISPLAY_PROMO',
    eventName: initial?.eventName || '', eventStatus: initial?.eventStatus || 'PLANNING',
    eventDate: initial?.eventDate ? initial.eventDate.split('T')[0] : '',
    endDate: initial?.endDate ? initial.endDate.split('T')[0] : '',
    location: initial?.location || '', budget: initial?.budget ?? '',
    actualCost: initial?.actualCost ?? '', staffNote: initial?.staffNote || '',
    setupRequirements: initial?.setupRequirements || '',
    productRequirements: initial?.productRequirements || '',
    communicationNote: initial?.communicationNote || '',
    attendeeCount: initial?.attendeeCount ?? '', sampleQty: initial?.sampleQty ?? '',
    ordersTaken: initial?.ordersTaken ?? '', leadsCollected: initial?.leadsCollected ?? '',
    revenueDuringEvent: initial?.revenueDuringEvent ?? '', unitsSoldDuringEvent: initial?.unitsSoldDuringEvent ?? '',
    couponRedeemed: initial?.couponRedeemed ?? '', newCustomersCollected: initial?.newCustomersCollected ?? '',
    roi: initial?.roi ?? '', targetAchievementPct: initial?.targetAchievementPct ?? '',
    performanceSummary: initial?.performanceSummary || '', nextActionNote: initial?.nextActionNote || '',
    notes: initial?.notes || '',
    // 團購欄位
    groupBuyTitle: initial?.groupBuy?.groupBuyTitle || '',
    groupBuyOrganizer: initial?.groupBuy?.organizer || '',
    groupBuyPhone: initial?.groupBuy?.organizerPhone || '',
    groupBuyPlatform: initial?.groupBuy?.platform || '',
    groupBuyMinQty: initial?.groupBuy?.minQty ?? 1,
    groupBuyPrice: initial?.groupBuy?.groupBuyPrice ?? '',
    groupBuyOpenDate: initial?.groupBuy?.openDate ? initial.groupBuy.openDate.split('T')[0] : '',
    groupBuyCloseDate: initial?.groupBuy?.closeDate ? initial.groupBuy.closeDate.split('T')[0] : '',
    groupBuyStatus: initial?.groupBuy?.status || 'OPEN',
    groupBuyActualOrders: initial?.groupBuy?.actualOrders ?? '',
    groupBuyActualQty: initial?.groupBuy?.actualQty ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }))

  async function handleSubmit() {
    if (!f.eventName || !f.eventType || !f.eventDate) { toast.error(rt.eventRequired); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { ...f }
      if (f.eventType === 'GROUP_BUY') {
        body.groupBuy = {
          groupBuyTitle: f.groupBuyTitle || f.eventName,
          organizer: f.groupBuyOrganizer, organizerPhone: f.groupBuyPhone,
          platform: f.groupBuyPlatform, minQty: f.groupBuyMinQty,
          groupBuyPrice: f.groupBuyPrice,
          openDate: f.groupBuyOpenDate || f.eventDate,
          closeDate: f.groupBuyCloseDate || f.endDate,
          status: f.groupBuyStatus,
          actualOrders: f.groupBuyActualOrders, actualQty: f.groupBuyActualQty,
        }
      }
      const url    = isEdit ? `/api/retail/events/${initial!.id}` : '/api/retail/events'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success(isEdit ? rt.eventUpdated : rt.eventCreated)
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : dict.common.saveFailed) }
    finally { setSaving(false) }
  }

  return (
    <Card className="border-green-200 bg-green-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-green-900 flex items-center gap-2">
          <PartyPopper className="h-4 w-4" />{isEdit ? `編輯活動：${initial?.eventName}` : '新增活動'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1 border-b">
          {[{ key: 'basic', label: '活動設定' }, { key: 'result', label: '活動成效' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as 'basic' | 'result')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'basic' && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-600 mb-2 block">活動類型 *</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(rt.eventTypes).map(([k, v]) => (
                  <button key={k} onClick={() => set('eventType', k)}
                    className={`text-xs py-1 px-2.5 rounded-lg border-2 font-medium transition-all ${f.eventType === k ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">活動名稱 *</Label>
                <Input value={f.eventName} onChange={e => set('eventName', e.target.value)} className="h-9 text-sm" placeholder="Q2 保健品節特賣" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">門市</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.outletId} onChange={e => set('outletId', e.target.value)}>
                  <option value="">（全通路/不指定）</option>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.brand.name} · {o.outletName}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">開始日期 *</Label>
                <Input type="date" value={f.eventDate} onChange={e => set('eventDate', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">結束日期</Label>
                <Input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">狀態</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.eventStatus} onChange={e => set('eventStatus', e.target.value)}>
                  {Object.entries(rt.eventStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">地點</Label>
                <Input value={f.location} onChange={e => set('location', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">預算（元）</Label>
                <Input type="number" value={String(f.budget)} onChange={e => set('budget', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">實際花費（元）</Label>
                <Input type="number" value={String(f.actualCost)} onChange={e => set('actualCost', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">活動佈置要求</Label>
              <Input value={f.setupRequirements} onChange={e => set('setupRequirements', e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">活動商品要求</Label>
              <Input value={f.productRequirements} onChange={e => set('productRequirements', e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">對通路溝通事項</Label>
              <Input value={f.communicationNote} onChange={e => set('communicationNote', e.target.value)} className="h-9 text-sm" />
            </div>
            {/* 團購專屬 */}
            {f.eventType === 'GROUP_BUY' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5" />團購設定</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-600 mb-1.5 block">團購名稱</Label>
                    <Input value={f.groupBuyTitle} onChange={e => set('groupBuyTitle', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600 mb-1.5 block">揪團平台</Label>
                    <Input value={f.groupBuyPlatform} onChange={e => set('groupBuyPlatform', e.target.value)} className="h-9 text-sm" placeholder="LINE/FB/門市公告" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600 mb-1.5 block">團主姓名</Label>
                    <Input value={f.groupBuyOrganizer} onChange={e => set('groupBuyOrganizer', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600 mb-1.5 block">團主電話</Label>
                    <Input value={f.groupBuyPhone} onChange={e => set('groupBuyPhone', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600 mb-1.5 block">最低成團量</Label>
                    <Input type="number" value={String(f.groupBuyMinQty)} onChange={e => set('groupBuyMinQty', Number(e.target.value))} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600 mb-1.5 block">團購價（元）</Label>
                    <Input type="number" value={String(f.groupBuyPrice)} onChange={e => set('groupBuyPrice', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600 mb-1.5 block">開團日</Label>
                    <Input type="date" value={f.groupBuyOpenDate} onChange={e => set('groupBuyOpenDate', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600 mb-1.5 block">截團日</Label>
                    <Input type="date" value={f.groupBuyCloseDate} onChange={e => set('groupBuyCloseDate', e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'result' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              {[
                { k: 'attendeeCount',         l: '到場人次' },
                { k: 'sampleQty',             l: '發放樣品' },
                { k: 'ordersTaken',           l: '現場成交筆' },
                { k: 'leadsCollected',        l: '蒐集名單' },
                { k: 'unitsSoldDuringEvent',  l: '銷售件數' },
                { k: 'couponRedeemed',        l: '兌換優惠券' },
                { k: 'newCustomersCollected', l: '新客資數' },
              ].map(({ k, l }) => (
                <div key={k}>
                  <Label className="text-xs text-slate-600 mb-1.5 block">{l}</Label>
                  <Input type="number" value={String((f as Record<string, unknown>)[k] ?? '')} onChange={e => set(k, e.target.value)} className="h-9 text-sm" />
                </div>
              ))}
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">活動銷售額</Label>
                <Input type="number" value={String(f.revenueDuringEvent)} onChange={e => set('revenueDuringEvent', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">ROI</Label>
                <Input type="number" step="0.01" value={String(f.roi)} onChange={e => set('roi', e.target.value)} className="h-9 text-sm" placeholder="1.5 = 150%" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">目標達成率 %</Label>
                <Input type="number" value={String(f.targetAchievementPct)} onChange={e => set('targetAchievementPct', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            {f.eventType === 'GROUP_BUY' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">實際訂單數</Label>
                  <Input type="number" value={String(f.groupBuyActualOrders)} onChange={e => set('groupBuyActualOrders', e.target.value)} className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">實際成團量</Label>
                  <Input type="number" value={String(f.groupBuyActualQty)} onChange={e => set('groupBuyActualQty', e.target.value)} className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">團購狀態</Label>
                  <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.groupBuyStatus} onChange={e => set('groupBuyStatus', e.target.value)}>
                    {Object.entries(rt.groupBuyStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">成效總結</Label>
              <Input value={f.performanceSummary} onChange={e => set('performanceSummary', e.target.value)} className="h-9 text-sm" placeholder="活動成效概述…" />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">下次活動建議 / 行動事項</Label>
              <Input value={f.nextActionNote} onChange={e => set('nextActionNote', e.target.value)} className="h-9 text-sm" placeholder="下次提前2週補貨…" />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">備注</Label>
              <Input value={f.notes} onChange={e => set('notes', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {isEdit ? '儲存活動' : '建立活動'}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>取消</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Outlet Card ─────────────────────────────────────────────────────────────
function OutletCard({ outlet, onEdit }: { outlet: RetailOutlet; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const activeEvent  = outlet.events.find(e => e.eventStatus === 'ACTIVE')
  const nextEvent    = outlet.events.find(e => e.eventStatus === 'PLANNING')

  return (
    <Card className={`transition-all ${!outlet.isActive ? 'opacity-60' : ''}`}>
      <CardContent className="p-4 space-y-3">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge className={`text-xs border-0 shrink-0 ${BRAND_TYPE_COLOR[outlet.brand.brandType] ?? 'bg-slate-100 text-slate-600'}`}>
              {outlet.brand.name}
            </Badge>
            <span className="font-semibold text-slate-900 truncate">{outlet.outletName}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className={`text-xs ${outlet.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500'}`}>
              {outlet.isActive ? '營業中' : '停業'}
            </Badge>
            <button onClick={onEdit} className="p-1 rounded hover:bg-slate-100 text-muted-foreground hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        {outlet.outletCode && <p className="font-mono text-xs text-slate-400">{outlet.outletCode}</p>}

        {/* ── 基本資訊 ── */}
        <div className="space-y-1">
          <InfoRow icon={MapPin} label="地址" value={[outlet.address, outlet.city].filter(Boolean).join('，')} />
          <InfoRow icon={Clock} label="營業" value={outlet.openHours} />
          <InfoRow icon={Phone} label="電話" value={outlet.phone} />
        </div>

        {/* ── 人員 ── */}
        {(outlet.storeManagerName || outlet.salesRepName) && (
          <div className="space-y-1 border-t pt-2">
            <InfoRow icon={User}  label="店長" value={outlet.storeManagerName ? `${outlet.storeManagerName}${outlet.storeManagerPhone ? ` · ${outlet.storeManagerPhone}` : ''}` : null} />
            <InfoRow icon={Users} label="業務" value={outlet.salesRepName} />
          </div>
        )}

        {/* ── 容量快覽 ── */}
        {(outlet.maxSkuCount || outlet.maxPacksTotal || outlet.shelfLocation) && (
          <div className="flex flex-wrap gap-2 border-t pt-2">
            {outlet.shelfLocation && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{outlet.shelfLocation}</span>}
            {outlet.maxSkuCount && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">最多 {outlet.maxSkuCount} SKU</span>}
            {outlet.maxPacksTotal && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">上限 {outlet.maxPacksTotal} 包</span>}
          </div>
        )}

        {/* ── 本次/下次活動 ── */}
        {(activeEvent || nextEvent) && (
          <div className="space-y-1.5 border-t pt-2">
            {activeEvent && (
              <div className="flex items-center gap-2 text-xs">
                <Badge className="border-0 bg-green-100 text-green-700 shrink-0">本次活動</Badge>
                <span className="text-slate-700 truncate">{activeEvent.eventName}</span>
                {activeEvent.endDate && <span className="text-muted-foreground shrink-0">至 {fmtDate(activeEvent.endDate)}</span>}
              </div>
            )}
            {nextEvent && (
              <div className="flex items-center gap-2 text-xs">
                <Badge className="border-0 bg-amber-100 text-amber-700 shrink-0">下次活動</Badge>
                <span className="text-slate-700 truncate">{nextEvent.eventName}</span>
                <span className="text-muted-foreground shrink-0">{fmtDate(nextEvent.eventDate)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── 展開詳情 ── */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-slate-700 transition-colors w-full justify-center border-t pt-2"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {expanded ? '收合' : '展開更多資訊'}
        </button>

        {expanded && (
          <div className="space-y-2 pt-1 text-xs">
            {outlet.placementZone && (
              <div className="rounded-lg bg-slate-50 p-2.5 space-y-1">
                <p className="font-medium text-slate-700">置放位置</p>
                <InfoRow icon={Package} label="區域" value={outlet.placementZone} />
                {outlet.placementDetail && <InfoRow icon={Tag} label="詳細" value={outlet.placementDetail} />}
              </div>
            )}
            {(outlet.displayShelfCount || outlet.displayShelfSpec || outlet.displayRequirements) && (
              <div className="rounded-lg bg-slate-50 p-2.5 space-y-1">
                <p className="font-medium text-slate-700">展示架</p>
                {outlet.displayShelfCount && <InfoRow icon={Layers} label="數量" value={`${outlet.displayShelfCount} 座`} />}
                {outlet.displayShelfSpec && <InfoRow icon={Layers} label="規格" value={outlet.displayShelfSpec} />}
                {outlet.displayRequirements && <InfoRow icon={AlertCircle} label="陳列要求" value={outlet.displayRequirements} />}
                {outlet.facingCount && <InfoRow icon={Layers} label="面排" value={`${outlet.facingCount} 排`} />}
              </div>
            )}
            {outlet.eventRequirements && (
              <div className="rounded-lg bg-orange-50 p-2.5 space-y-1">
                <p className="font-medium text-orange-800">活動要求</p>
                <InfoRow icon={CalendarCheck} label="通路要求" value={outlet.eventRequirements} />
                {outlet.promoCalendarNote && <InfoRow icon={Calendar} label="檔期" value={outlet.promoCalendarNote} />}
                {outlet.minOrderQtyPerEvent && <InfoRow icon={Package} label="最低訂量" value={`${outlet.minOrderQtyPerEvent} 件`} />}
              </div>
            )}
            {(outlet.deliveryTimeWindow || outlet.parkingInfo) && (
              <div className="rounded-lg bg-blue-50 p-2.5 space-y-1">
                <p className="font-medium text-blue-800">物流</p>
                {outlet.deliveryTimeWindow && <InfoRow icon={Truck} label="收貨時間" value={outlet.deliveryTimeWindow} />}
                {outlet.deliveryDayOfWeek && <InfoRow icon={Calendar} label="補貨星期" value={outlet.deliveryDayOfWeek} />}
                {outlet.logisticsNote && <InfoRow icon={Truck} label="備注" value={outlet.logisticsNote} />}
                {outlet.parkingInfo && <InfoRow icon={MapPin} label="停車" value={outlet.parkingInfo} />}
                {outlet.loadingDockNote && <InfoRow icon={Truck} label="月台" value={outlet.loadingDockNote} />}
              </div>
            )}
            {outlet.commissionRate && (
              <div className="rounded-lg bg-slate-50 p-2.5 space-y-1">
                <p className="font-medium text-slate-700">財務條件</p>
                <InfoRow icon={BarChart3} label="佣金" value={`${outlet.commissionRate}%`} />
                {outlet.paymentTerms && <InfoRow icon={BarChart3} label="付款" value={outlet.paymentTerms} />}
                {outlet.shelfRent && <InfoRow icon={BarChart3} label="上架費" value={fmtMoney(outlet.shelfRent)} />}
                {outlet.displayFee && <InfoRow icon={BarChart3} label="陳列費" value={fmtMoney(outlet.displayFee)} />}
              </div>
            )}
            {outlet.notes && <p className="text-muted-foreground italic">{outlet.notes}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function RetailPage() {
  const { dict } = useI18n()
  const rt = dict.retail
  type BrTy = keyof typeof rt.brandTypes
  type PuMo = keyof typeof rt.purchaseModes
  type EvSt = keyof typeof rt.eventStatuses
  type EvTy = keyof typeof rt.eventTypes
  type GbSt = keyof typeof rt.groupBuyStatuses
  const [brands,  setBrands]  = useState<RetailBrand[]>([])
  const [outlets, setOutlets] = useState<RetailOutlet[]>([])
  const [events,  setEvents]  = useState<RetailEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'outlets' | 'brands' | 'events'>('outlets')

  const [showBrandForm,  setShowBrandForm]  = useState(false)
  const [showOutletForm, setShowOutletForm] = useState(false)
  const [showEventForm,  setShowEventForm]  = useState(false)
  const [editingBrand,   setEditingBrand]   = useState<RetailBrand | null>(null)
  const [editingOutlet,  setEditingOutlet]  = useState<RetailOutlet | null>(null)
  const [editingEvent,   setEditingEvent]   = useState<RetailEvent | null>(null)

  const [brandFilter, setBrandFilter] = useState('')
  const [eventStatusFilter, setEventStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [br, ot, ev] = await Promise.all([
        fetch('/api/retail/brands').then(r => r.json()),
        fetch('/api/retail/outlets').then(r => r.json()),
        fetch('/api/retail/events').then(r => r.json()),
      ])
      setBrands(Array.isArray(br) ? br : [])
      setOutlets(Array.isArray(ot) ? ot : [])
      setEvents(Array.isArray(ev) ? ev : [])
    } catch { toast.error(dict.retail.loadFailed) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const filteredOutlets = outlets.filter(o => {
    if (brandFilter && o.brandId !== brandFilter) return false
    if (search && !o.outletName.toLowerCase().includes(search.toLowerCase()) && !(o.address ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredEvents = events.filter(e => {
    if (eventStatusFilter && e.eventStatus !== eventStatusFilter) return false
    return true
  })

  // Stats
  const activeEvents = events.filter(e => e.eventStatus === 'ACTIVE').length
  const planningEvents = events.filter(e => e.eventStatus === 'PLANNING').length
  const groupBuyEvents = events.filter(e => e.eventType === 'GROUP_BUY' && e.eventStatus !== 'CANCELLED').length

  const tabStyle = (t: string) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`

  function handleSaved() {
    setShowBrandForm(false); setShowOutletForm(false); setShowEventForm(false)
    setEditingBrand(null); setEditingOutlet(null); setEditingEvent(null)
    loadAll()
  }

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Store className="h-6 w-6 text-blue-600" />{dict.retail.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {brands.length} 個品牌 · {outlets.length} 間門市 · {activeEvents} 個活動進行中
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'brands' && <Button onClick={() => setShowBrandForm(true)} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />{dict.retail.newOutlet}</Button>}
          {activeTab === 'outlets' && <Button onClick={() => setShowOutletForm(true)} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />{dict.retail.outlets}</Button>}
          {activeTab === 'events' && <Button onClick={() => setShowEventForm(true)} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />{dict.retail.newEvent}</Button>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: '通路品牌',   value: brands.length,       icon: Building2,      color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
          { label: '營業門市',   value: outlets.filter(o => o.isActive).length, icon: Store, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
          { label: '進行中活動', value: activeEvents,         icon: PartyPopper,    color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
          { label: '規劃中活動', value: planningEvents,       icon: CalendarCheck,  color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
          { label: '團購活動',   value: groupBuyEvents,       icon: ShoppingBag,    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-3 flex items-center gap-3`}>
            <s.icon className={`h-7 w-7 ${s.color}`} />
            <div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="border-b flex gap-0">
        <button className={tabStyle('outlets')} onClick={() => setActiveTab('outlets')}>{dict.retail.outlets}</button>
        <button className={tabStyle('brands')}  onClick={() => setActiveTab('brands')}>{dict.retail.displays}</button>
        <button className={tabStyle('events')}  onClick={() => setActiveTab('events')}>{dict.retail.events}</button>
      </div>

      {loading && (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      )}

      {/* ── 門市管理 ── */}
      {!loading && activeTab === 'outlets' && (
        <div className="space-y-4">
          {(showOutletForm || editingOutlet) && (
            <OutletForm brands={brands} initial={editingOutlet ?? undefined} onSaved={handleSaved} onCancel={() => { setShowOutletForm(false); setEditingOutlet(null) }} />
          )}
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select className="border rounded-md px-3 py-1.5 text-sm" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
              <option value="">全部品牌</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Input className="h-9 w-48 text-sm" placeholder="搜尋門市名稱/地址…" value={search} onChange={e => setSearch(e.target.value)} />
            {(brandFilter || search) && <button onClick={() => { setBrandFilter(''); setSearch('') }} className="text-xs text-red-500 px-2">清除</button>}
          </div>
          {filteredOutlets.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Store className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>尚無門市資料，請先新增通路品牌再建立門市</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOutlets.map(o => (
                <OutletCard key={o.id} outlet={o} onEdit={() => { setEditingOutlet(o); setShowOutletForm(false) }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 品牌管理 ── */}
      {!loading && activeTab === 'brands' && (
        <div className="space-y-4">
          {(showBrandForm || editingBrand) && (
            <BrandForm
              initial={editingBrand ?? undefined}
              onSaved={handleSaved}
              onCancel={() => { setShowBrandForm(false); setEditingBrand(null) }}
            />
          )}
          {brands.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>尚無品牌資料，請點右上角「新增品牌」</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {brands.map(b => (
                <Card key={b.id}>
                  <CardContent className="p-4 space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs border-0 ${BRAND_TYPE_COLOR[b.brandType] ?? 'bg-slate-100 text-slate-600'}`}>
                            {rt.brandTypes[b.brandType as BrTy] ?? b.brandType}
                          </Badge>
                          <span className="font-mono text-xs text-slate-400">{b.code}</span>
                        </div>
                        <p className="font-semibold text-slate-900">{b.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">{b._count?.outlets ?? 0} 間門市</span>
                        <button onClick={() => { setEditingBrand(b); setShowBrandForm(false) }} className="p-1 rounded hover:bg-slate-100 text-muted-foreground hover:text-slate-700">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 採購窗口 */}
                    {(b.buyerName || b.hqContact) && (
                      <div className="rounded-lg bg-blue-50 px-2.5 py-2 space-y-1 text-xs">
                        <p className="font-medium text-blue-800 flex items-center gap-1"><User className="h-3 w-3" />採購窗口</p>
                        {b.buyerName && (
                          <p className="text-slate-700">
                            {b.buyerName}
                            {b.buyerTitle && <span className="text-muted-foreground"> · {b.buyerTitle}</span>}
                            {b.buyerDept  && <span className="text-muted-foreground"> · {b.buyerDept}</span>}
                          </p>
                        )}
                        {b.buyerPhone && <p className="text-slate-600 flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{b.buyerPhone}</p>}
                        {b.buyerEmail && <p className="text-slate-600">{b.buyerEmail}</p>}
                        {!b.buyerName && b.hqContact && <InfoRow icon={User} label="聯絡人" value={b.hqContact} />}
                      </div>
                    )}

                    {/* 採購條件快覽 */}
                    {(b.purchaseMode || b.paymentTerms || b.deliveryLeadDays || b.creditDays) && (
                      <div className="flex flex-wrap gap-1.5">
                        {b.purchaseMode && (
                          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {rt.purchaseModes[b.purchaseMode as PuMo] ?? b.purchaseMode}
                          </span>
                        )}
                        {b.paymentTerms && (
                          <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{b.paymentTerms}</span>
                        )}
                        {b.deliveryLeadDays && (
                          <span className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                            <Truck className="h-2.5 w-2.5" />交期 {b.deliveryLeadDays}天
                          </span>
                        )}
                        {b.creditDays && (
                          <span className="text-[11px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded">帳期 {b.creditDays}天</span>
                        )}
                        {b.minOrderQty && (
                          <span className="text-[11px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded">最低 {b.minOrderQty} 件</span>
                        )}
                      </div>
                    )}

                    {/* 合約到期 */}
                    {b.contractExpiry && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />合約到期：{new Date(b.contractExpiry).toLocaleDateString('zh-TW')}
                      </p>
                    )}

                    {b.notes && <p className="text-xs text-muted-foreground italic">{b.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 活動管理 ── */}
      {!loading && activeTab === 'events' && (
        <div className="space-y-4">
          {(showEventForm || editingEvent) && (
            <EventForm outlets={outlets} initial={editingEvent ?? undefined} onSaved={handleSaved} onCancel={() => { setShowEventForm(false); setEditingEvent(null) }} />
          )}
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select className="border rounded-md px-3 py-1.5 text-sm" value={eventStatusFilter} onChange={e => setEventStatusFilter(e.target.value)}>
              <option value="">全部狀態</option>
              {Object.entries(rt.eventStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {eventStatusFilter && <button onClick={() => setEventStatusFilter('')} className="text-xs text-red-500 px-2">清除</button>}
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <PartyPopper className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>尚無活動紀錄</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                {/* Header */}
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr_auto] gap-3 px-4 py-2.5 text-xs font-semibold text-muted-foreground bg-slate-50">
                  <span>活動名稱 / 門市</span><span>類型</span><span>日期</span><span>狀態</span><span>成效</span><span></span>
                </div>
                <div className="divide-y">
                  {filteredEvents.map(ev => {
                    const statusColor = EVENT_STATUS_COLOR[ev.eventStatus] ?? 'bg-slate-100 text-slate-600'
                    const statusLabel = rt.eventStatuses[ev.eventStatus as EvSt] ?? ev.eventStatus
                    const hasResult = ev.revenueDuringEvent || ev.ordersTaken || ev.attendeeCount
                    return (
                      <div key={ev.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr_auto] gap-3 px-4 py-3 hover:bg-slate-50 items-center">
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{ev.eventName}</p>
                          {ev.outlet && <p className="text-xs text-muted-foreground">{ev.outlet.brand.name} · {ev.outlet.outletName}</p>}
                          {ev.eventType === 'GROUP_BUY' && ev.groupBuy && (
                            <Badge className={`text-xs border-0 mt-0.5 ${GROUP_BUY_STATUS_COLOR[ev.groupBuy.status] ?? 'bg-slate-100'}`}>
                              {rt.groupBuyStatuses[ev.groupBuy.status as GbSt] ?? ev.groupBuy.status} · 最低 {ev.groupBuy.minQty} 件
                            </Badge>
                          )}
                        </div>
                        <Badge className={`text-xs border-0 w-fit ${BRAND_TYPE_COLOR['OTHER']}`}>{rt.eventTypes[ev.eventType as EvTy] ?? ev.eventType}</Badge>
                        <div className="text-xs text-slate-600">
                          <p>{fmtDate(ev.eventDate)}</p>
                          {ev.endDate && <p className="text-muted-foreground">至 {fmtDate(ev.endDate)}</p>}
                        </div>
                        <Badge className={`text-xs border-0 w-fit ${statusColor}`}>{statusLabel}</Badge>
                        <div className="text-xs text-slate-600 space-y-0.5">
                          {hasResult ? (
                            <>
                              {ev.revenueDuringEvent && <p className="text-green-600 font-medium">{fmtMoney(ev.revenueDuringEvent)}</p>}
                              <div className="flex gap-2">
                                {ev.ordersTaken && <span>成交 {ev.ordersTaken} 筆</span>}
                                {ev.attendeeCount && <span>到場 {ev.attendeeCount} 人</span>}
                              </div>
                              {ev.roi && <p className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-blue-500" />ROI {ev.roi}x</p>}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {ev.performanceSummary && <p className="text-muted-foreground truncate max-w-[160px]">{ev.performanceSummary}</p>}
                        </div>
                        <button onClick={() => { setEditingEvent(ev); setShowEventForm(false) }} className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground hover:text-slate-700">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
