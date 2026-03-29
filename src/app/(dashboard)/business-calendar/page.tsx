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
  Calendar, CalendarCheck, Mic, ClipboardList, Plus, Loader2, Pencil,
  ChevronLeft, ChevronRight, Check, X, Clock, MapPin, Users, Star,
  AlertTriangle, TrendingUp, FileText, Megaphone, PartyPopper, Building2,
  CheckCircle2, Circle, RefreshCw, ExternalLink,
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

interface BusinessEvent {
  id: string; eventNo: string; title: string; eventType: string; status: string
  startDate: string; endDate: string; allDay: boolean; location?: string | null
  venue?: string | null; channelPlatform?: string | null
  ownerUserId: string; owner?: { id: string; name: string }
  budget?: string | null; actualCost?: string | null
  boothNo?: string | null; boothSize?: string | null
  estimatedVisitors?: number | null; actualVisitors?: number | null
  leadsCollected?: number | null; ordersTaken?: number | null
  tags: string[]; notes?: string | null
  customer?: { id: string; name: string } | null
  promoCalendar?: { id: string; promoName: string; promoCode: string } | null
  _count?: { meetingRecords: number }
}

interface PromoCalendar {
  id: string; promoCode: string; promoName: string; promoTier: string
  year: number; eventStartDate: string; eventEndDate: string
  prepStartDate: string; negoStartDate: string; execStartDate: string
  currentPhase: string; reminderDays: number[]
  revenueTarget?: string | null; revenueActual?: string | null
  orderTarget?: number | null; orderActual?: number | null
  targetChannels: string[]; featuredSkus: string[]
  responsibleUserId?: string | null
  responsibleUser?: { id: string; name: string } | null
  daysUntilEvent?: number
  notes?: string | null; isActive: boolean
  _count?: { businessEvents: number; meetingRecords: number }
}

interface MeetingRecord {
  id: string; meetingNo: string; title: string; meetingType: string; status: string
  meetingDate: string; startTime?: string | null; endTime?: string | null
  location?: string | null; isOnline: boolean; channelName?: string | null
  facilitator?: { id: string; name: string }
  customer?: { id: string; name: string } | null
  businessEvent?: { id: string; title: string; eventType: string } | null
  summary?: string | null; decisions?: string | null
  negotiationContext?: string | null; negotiationOutcome?: string | null
  audioFileUrl?: string | null; transcriptStatus?: string
  negotiationHistory?: unknown[]
  _count?: { actionItems: number }
}

interface ActionItem {
  id: string; meetingRecordId: string; actionTitle: string
  actionDescription?: string | null
  ownerUserId?: string | null; owner?: { id: string; name: string } | null
  dueDate?: string | null; status: string; priority: string
  completionNote?: string | null; followUpNote?: string | null
  isOverdue?: boolean; isDueThisWeek?: boolean
  meetingRecord?: { id: string; meetingNo: string; title: string; meetingDate: string }
}

interface User { id: string; name: string; role: string }

// ── Config ──────────────────────────────────────────────────────────────────

// CSS-only maps (labels come from dict.businessCalendar.*)
const EVENT_TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  EXHIBITION_LARGE:     { color: 'bg-orange-100 text-orange-700',  icon: '🏛️' },
  EXHIBITION_SMALL:     { color: 'bg-amber-100 text-amber-700',   icon: '⛺' },
  ASSOCIATION_NATIONAL: { color: 'bg-indigo-100 text-indigo-700', icon: '🏛️' },
  ASSOCIATION_COUNTY:   { color: 'bg-violet-100 text-violet-700', icon: '🏢' },
  CHANNEL_PROMO:        { color: 'bg-pink-100 text-pink-700',     icon: '🏪' },
  WEEKLY_ADMIN:         { color: 'bg-slate-100 text-slate-600',   icon: '📋' },
  MAJOR_PROMO:          { color: 'bg-red-100 text-red-700',       icon: '🔥' },
  QUARTERLY_PROMO:      { color: 'bg-rose-100 text-rose-700',     icon: '📦' },
  OTHER:                { color: 'bg-slate-100 text-slate-500',   icon: '📌' },
}

const EVENT_STATUS_COLOR: Record<string, string> = {
  PLANNING:    'bg-amber-100 text-amber-700',
  CONFIRMED:   'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-green-100 text-green-700',
  COMPLETED:   'bg-slate-100 text-slate-500',
  CANCELLED:   'bg-red-100 text-red-600',
}

const MEETING_TYPE_COLOR: Record<string, string> = {
  WEEKLY_ADMIN:        'bg-slate-100 text-slate-600',
  CHANNEL_NEGOTIATION: 'bg-red-100 text-red-700',
  ASSOCIATION_MEETING: 'bg-indigo-100 text-indigo-700',
  EXHIBITION_DEBRIEF:  'bg-orange-100 text-orange-700',
  PROMO_PLANNING:      'bg-pink-100 text-pink-700',
  SUPPLIER_MEETING:    'bg-teal-100 text-teal-700',
  INTERNAL:            'bg-blue-100 text-blue-700',
  OTHER:               'bg-slate-100 text-slate-500',
}

const PROMO_TIER_COLOR: Record<string, string> = {
  NATIONAL_MAJOR:  'bg-red-100 text-red-700',
  QUARTERLY:       'bg-orange-100 text-orange-700',
  MONTHLY:         'bg-amber-100 text-amber-700',
  FLASH_SALE:      'bg-yellow-100 text-yellow-700',
  CHANNEL_SPECIAL: 'bg-pink-100 text-pink-700',
}

const PHASE_CLS: Record<string, { color: string; bg: string }> = {
  PREPARATION: { color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  NEGOTIATION: { color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  EXECUTION:   { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  LIVE:        { color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  REVIEW:      { color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200' },
}

const ACTION_STATUS_COLOR: Record<string, string> = {
  OPEN:        'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE:        'bg-green-100 text-green-700',
  CANCELLED:   'bg-slate-100 text-slate-500',
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}
function fmtDateFull(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
function fmtMoney(v: string | number | null | undefined) {
  if (v == null || v === '') return '—'
  return `$${Number(v).toLocaleString()}`
}

// ── 通用 Textarea ─────────────────────────────────────────────────────────────
function TextArea({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
    />
  )
}

// ── 業務活動表單 ─────────────────────────────────────────────────────────────
function EventForm({ initial, users, onSaved, onCancel }: {
  initial?: Partial<BusinessEvent>; users: User[]; onSaved: () => void; onCancel: () => void
}) {
  const { dict } = useI18n()
  const bc = dict.businessCalendar
  const isEdit = !!initial?.id
  const EVENT_TYPE_LABELS = bc.eventTypeLabels as Record<string, string>
  const [f, setF] = useState({
    title:          initial?.title          || '',
    eventType:      initial?.eventType      || 'WEEKLY_ADMIN',
    status:         initial?.status         || 'PLANNING',
    startDate:      initial?.startDate      ? initial.startDate.slice(0, 10) : '',
    endDate:        initial?.endDate        ? initial.endDate.slice(0, 10)   : '',
    location:       initial?.location       || '',
    venue:          initial?.venue          || '',
    channelPlatform: initial?.channelPlatform || '',
    ownerUserId:    initial?.ownerUserId    || '',
    budget:         initial?.budget         ?? '',
    boothNo:        initial?.boothNo        || '',
    boothSize:      initial?.boothSize      || '',
    estimatedVisitors: initial?.estimatedVisitors ?? '',
    actualVisitors:    initial?.actualVisitors    ?? '',
    leadsCollected:    initial?.leadsCollected    ?? '',
    ordersTaken:       initial?.ordersTaken       ?? '',
    notes:          initial?.notes          || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }))
  const isExhibition = ['EXHIBITION_LARGE', 'EXHIBITION_SMALL'].includes(f.eventType)

  async function handleSubmit() {
    if (!f.title || !f.startDate) { toast.error(dict.businessCalendar.titleDateRequired); return }
    setSaving(true)
    try {
      const url    = isEdit ? `/api/business-events/${initial!.id}` : '/api/business-events'
      const method = isEdit ? 'PUT' : 'POST'
      const body   = { ...f, endDate: f.endDate || f.startDate }
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success(isEdit ? dict.common.updateSuccess : dict.common.createSuccess)
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : dict.common.saveFailed) }
    finally { setSaving(false) }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-blue-900 flex items-center gap-2">
          <Calendar className="h-4 w-4" />{isEdit ? bc.editEventTitle : bc.newEventFormTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.eventTitleLabel}</Label>
            <Input value={f.title} onChange={e => set('title', e.target.value)} className="h-9 text-sm" placeholder={bc.eventTitlePlaceholder} />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-2 block">{bc.eventTypeFormLabel}</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(EVENT_TYPE_CONFIG).map(([k, v]) => (
              <button key={k} onClick={() => set('eventType', k)}
                className={`text-xs py-1 px-2.5 rounded-lg border-2 font-medium transition-all ${f.eventType === k ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                {v.icon} {(bc.eventTypeLabels as Record<string,string>)[k] ?? k}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.eventStatusFormLabel}</Label>
            <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.status} onChange={e => set('status', e.target.value)}>
              {Object.entries(bc.eventStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.eventStartDateLabel}</Label>
            <Input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.eventEndDateLabel}</Label>
            <Input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.ownerLabel}</Label>
            <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.ownerUserId} onChange={e => set('ownerUserId', e.target.value)}>
              <option value="">{bc.selectOwner}</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.locationLabel}</Label>
            <Input value={f.location} onChange={e => set('location', e.target.value)} className="h-9 text-sm" placeholder={bc.locationPlaceholder} />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.venueLabel}</Label>
            <Input value={f.venue} onChange={e => set('venue', e.target.value)} className="h-9 text-sm" placeholder={bc.venuePlaceholder} />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.channelLabel}</Label>
            <Input value={f.channelPlatform} onChange={e => set('channelPlatform', e.target.value)} className="h-9 text-sm" placeholder={bc.channelPlaceholder} />
          </div>
        </div>
        {isExhibition && (
          <div className="grid grid-cols-4 gap-3 rounded-lg bg-orange-50 p-3">
            <div className="col-span-4 text-xs font-medium text-orange-800 mb-1">{bc.exhibitionSection}</div>
            <div><Label className="text-xs text-slate-600 mb-1.5 block">{bc.boothNoLabel}</Label><Input value={f.boothNo} onChange={e => set('boothNo', e.target.value)} className="h-9 text-sm" /></div>
            <div><Label className="text-xs text-slate-600 mb-1.5 block">{bc.boothSizeLabel}</Label><Input value={f.boothSize} onChange={e => set('boothSize', e.target.value)} className="h-9 text-sm" placeholder="3x3m" /></div>
            <div><Label className="text-xs text-slate-600 mb-1.5 block">{bc.estimatedVisitorsLabel}</Label><Input type="number" value={String(f.estimatedVisitors)} onChange={e => set('estimatedVisitors', e.target.value)} className="h-9 text-sm" /></div>
            <div><Label className="text-xs text-slate-600 mb-1.5 block">{bc.eventBudgetLabel}</Label><Input type="number" value={String(f.budget)} onChange={e => set('budget', e.target.value)} className="h-9 text-sm" /></div>
          </div>
        )}
        {isEdit && isExhibition && (
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-green-50 p-3">
            <div className="col-span-3 text-xs font-medium text-green-800 mb-1">{bc.resultsSection}</div>
            <div><Label className="text-xs text-slate-600 mb-1.5 block">{bc.actualVisitorsLabel}</Label><Input type="number" value={String(f.actualVisitors)} onChange={e => set('actualVisitors', e.target.value)} className="h-9 text-sm" /></div>
            <div><Label className="text-xs text-slate-600 mb-1.5 block">{bc.leadsCollectedLabel}</Label><Input type="number" value={String(f.leadsCollected)} onChange={e => set('leadsCollected', e.target.value)} className="h-9 text-sm" /></div>
            <div><Label className="text-xs text-slate-600 mb-1.5 block">{bc.ordersTakenLabel}</Label><Input type="number" value={String(f.ordersTaken)} onChange={e => set('ordersTaken', e.target.value)} className="h-9 text-sm" /></div>
          </div>
        )}
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">{bc.notesLabel}</Label>
          <Input value={f.notes} onChange={e => set('notes', e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {isEdit ? bc.saveEvent : bc.createEvent}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}><X className="mr-1.5 h-3.5 w-3.5" />{dict.common.cancel}</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── 大檔期表單 ────────────────────────────────────────────────────────────────
function PromoForm({ initial, users, onSaved, onCancel }: {
  initial?: Partial<PromoCalendar>; users: User[]; onSaved: () => void; onCancel: () => void
}) {
  const { dict } = useI18n()
  const bc = dict.businessCalendar
  const isEdit = !!initial?.id
  const PROMO_TIER_CONFIG: Record<string, { label: string; color: string }> = {
    NATIONAL_MAJOR:  { label: (bc.promoTierLabels as Record<string,string>).NATIONAL_MAJOR,  color: PROMO_TIER_COLOR.NATIONAL_MAJOR },
    QUARTERLY:       { label: (bc.promoTierLabels as Record<string,string>).QUARTERLY,       color: PROMO_TIER_COLOR.QUARTERLY },
    MONTHLY:         { label: (bc.promoTierLabels as Record<string,string>).MONTHLY,         color: PROMO_TIER_COLOR.MONTHLY },
    FLASH_SALE:      { label: (bc.promoTierLabels as Record<string,string>).FLASH_SALE,      color: PROMO_TIER_COLOR.FLASH_SALE },
    CHANNEL_SPECIAL: { label: (bc.promoTierLabels as Record<string,string>).CHANNEL_SPECIAL, color: PROMO_TIER_COLOR.CHANNEL_SPECIAL },
  }
  const [f, setF] = useState({
    promoCode:         initial?.promoCode         || '',
    promoName:         initial?.promoName         || '',
    promoTier:         initial?.promoTier         || 'NATIONAL_MAJOR',
    eventStartDate:    initial?.eventStartDate    ? initial.eventStartDate.slice(0, 10) : '',
    eventEndDate:      initial?.eventEndDate      ? initial.eventEndDate.slice(0, 10)   : '',
    prepStartDate:     initial?.prepStartDate     ? initial.prepStartDate.slice(0, 10)  : '',
    negoStartDate:     initial?.negoStartDate     ? initial.negoStartDate.slice(0, 10)  : '',
    execStartDate:     initial?.execStartDate     ? initial.execStartDate.slice(0, 10)  : '',
    revenueTarget:     initial?.revenueTarget     ?? '',
    orderTarget:       initial?.orderTarget       ?? '',
    revenueActual:     initial?.revenueActual     ?? '',
    orderActual:       initial?.orderActual       ?? '',
    targetChannels:    initial?.targetChannels?.join('、')    || '',
    responsibleUserId: initial?.responsibleUserId || (initial?.responsibleUser?.id || ''),
    notes:             initial?.notes             || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }))

  async function handleSubmit() {
    if (!f.promoCode || !f.promoName || !f.eventStartDate) { toast.error(dict.businessCalendar.promoFieldsRequired); return }
    setSaving(true)
    try {
      const payload = {
        ...f,
        year: new Date(f.eventStartDate).getFullYear(),
        targetChannels: f.targetChannels.split(/[,、，]/).map(s => s.trim()).filter(Boolean),
        prepStartDate: f.prepStartDate || undefined,
        negoStartDate: f.negoStartDate || undefined,
        execStartDate: f.execStartDate || undefined,
      }
      const url    = isEdit ? `/api/promo-calendar/${initial!.id}` : '/api/promo-calendar'
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success(isEdit ? bc.promoUpdated : bc.promoCreated)
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : dict.common.saveFailed) }
    finally { setSaving(false) }
  }

  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-red-900 flex items-center gap-2">
          <Megaphone className="h-4 w-4" />{isEdit ? bc.editPromo : bc.newPromo}
          {!isEdit && <span className="text-xs font-normal text-red-600">{bc.promoAutoSchedule}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.promoCodeLabel}</Label>
            <Input value={f.promoCode} onChange={e => set('promoCode', e.target.value.toUpperCase())} className="h-9 text-sm" placeholder="618-2026" disabled={isEdit} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.promoNameLabel}</Label>
            <Input value={f.promoName} onChange={e => set('promoName', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.promoTierLabel}</Label>
            <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.promoTier} onChange={e => set('promoTier', e.target.value)}>
              {Object.keys(PROMO_TIER_COLOR).map(k => <option key={k} value={k}>{(bc.promoTierLabels as Record<string,string>)[k] ?? k}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.eventStartDatePromo}</Label>
            <Input type="date" value={f.eventStartDate} onChange={e => set('eventStartDate', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.eventEndDatePromo}</Label>
            <Input type="date" value={f.eventEndDate} onChange={e => set('eventEndDate', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.prepStartDateLabel}</Label>
            <Input type="date" value={f.prepStartDate} onChange={e => set('prepStartDate', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.negoStartDateLabel}</Label>
            <Input type="date" value={f.negoStartDate} onChange={e => set('negoStartDate', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.execStartDateLabel}</Label>
            <Input type="date" value={f.execStartDate} onChange={e => set('execStartDate', e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.revenueTargetLabel}</Label>
            <Input type="number" value={String(f.revenueTarget)} onChange={e => set('revenueTarget', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.orderTargetLabel}</Label>
            <Input type="number" value={String(f.orderTarget)} onChange={e => set('orderTarget', e.target.value)} className="h-9 text-sm" />
          </div>
          {isEdit && <>
            <div><Label className="text-xs text-slate-600 mb-1.5 block">{bc.revenueActualLabel}</Label><Input type="number" value={String(f.revenueActual)} onChange={e => set('revenueActual', e.target.value)} className="h-9 text-sm" /></div>
            <div><Label className="text-xs text-slate-600 mb-1.5 block">{bc.orderActualLabel}</Label><Input type="number" value={String(f.orderActual)} onChange={e => set('orderActual', e.target.value)} className="h-9 text-sm" /></div>
          </>}
          {!isEdit && <div className="col-span-2">
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.targetChannelsLabel}</Label>
            <Input value={f.targetChannels} onChange={e => set('targetChannels', e.target.value)} className="h-9 text-sm" />
          </div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.promoOwnerLabel}</Label>
            <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.responsibleUserId} onChange={e => set('responsibleUserId', e.target.value)}>
              <option value="">{bc.selectOwner}</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">{bc.promoNotesLabel}</Label>
            <Input value={f.notes} onChange={e => set('notes', e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {isEdit ? bc.savePromo : bc.createPromo}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}><X className="mr-1.5 h-3.5 w-3.5" />{dict.common.cancel}</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── 會議記錄表單 ──────────────────────────────────────────────────────────────
function MeetingForm({ initial, users, onSaved, onCancel }: {
  initial?: Partial<MeetingRecord>; users: User[]; onSaved: () => void; onCancel: () => void
}) {
  const { dict } = useI18n()
  const bc = dict.businessCalendar
  const isEdit = !!initial?.id
  const MEETING_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    WEEKLY_ADMIN:        { label: (bc.meetingTypeLabels as Record<string,string>).WEEKLY_ADMIN,        color: MEETING_TYPE_COLOR.WEEKLY_ADMIN },
    CHANNEL_NEGOTIATION: { label: (bc.meetingTypeLabels as Record<string,string>).CHANNEL_NEGOTIATION, color: MEETING_TYPE_COLOR.CHANNEL_NEGOTIATION },
    ASSOCIATION_MEETING: { label: (bc.meetingTypeLabels as Record<string,string>).ASSOCIATION_MEETING, color: MEETING_TYPE_COLOR.ASSOCIATION_MEETING },
    EXHIBITION_DEBRIEF:  { label: (bc.meetingTypeLabels as Record<string,string>).EXHIBITION_DEBRIEF,  color: MEETING_TYPE_COLOR.EXHIBITION_DEBRIEF },
    PROMO_PLANNING:      { label: (bc.meetingTypeLabels as Record<string,string>).PROMO_PLANNING,      color: MEETING_TYPE_COLOR.PROMO_PLANNING },
    SUPPLIER_MEETING:    { label: (bc.meetingTypeLabels as Record<string,string>).SUPPLIER_MEETING,    color: MEETING_TYPE_COLOR.SUPPLIER_MEETING },
    INTERNAL:            { label: (bc.meetingTypeLabels as Record<string,string>).INTERNAL,            color: MEETING_TYPE_COLOR.INTERNAL },
    OTHER:               { label: (bc.meetingTypeLabels as Record<string,string>).OTHER,               color: MEETING_TYPE_COLOR.OTHER },
  }
  const [tab, setTab] = useState<'basic' | 'minutes' | 'audio'>('basic')
  const [f, setF] = useState({
    title:              initial?.title              || '',
    meetingType:        initial?.meetingType        || 'WEEKLY_ADMIN',
    status:             initial?.status             || 'SCHEDULED',
    meetingDate:        initial?.meetingDate        ? initial.meetingDate.slice(0, 10) : '',
    location:           initial?.location           || '',
    channelName:        initial?.channelName        || '',
    facilitatorId:      initial?.facilitator?.id    || '',
    externalAttendees:  '',
    agenda:             '',
    summary:            initial?.summary            || '',
    decisions:          '',
    negotiationContext: '',
    negotiationOutcome: '',
    audioFileUrl:       initial?.audioFileUrl       || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  async function handleSubmit() {
    if (!f.title || !f.meetingDate) { toast.error(dict.businessCalendar.meetingFieldsRequired); return }
    setSaving(true)
    try {
      const url    = isEdit ? `/api/meeting-records/${initial!.id}` : '/api/meeting-records'
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success(isEdit ? dict.common.updateSuccess : dict.common.createSuccess)
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : dict.common.saveFailed) }
    finally { setSaving(false) }
  }

  const tabs = [{ key: 'basic', label: bc.tabMeetingBasic }, { key: 'minutes', label: bc.tabMeetingMinutes }, { key: 'audio', label: bc.tabMeetingAudio }] as const

  return (
    <Card className="border-indigo-200 bg-indigo-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
          <FileText className="h-4 w-4" />{isEdit ? bc.editMeeting : bc.newMeeting}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-1 border-b">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'basic' && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">{bc.meetingTitleLabel}</Label>
              <Input value={f.title} onChange={e => set('title', e.target.value)} className="h-9 text-sm" placeholder={bc.meetingTitlePlaceholder} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">{bc.meetingTypeLabel}</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.meetingType} onChange={e => set('meetingType', e.target.value)}>
                  {Object.entries(MEETING_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">{bc.meetingStatusLabel}</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.status} onChange={e => set('status', e.target.value)}>
                  <option value="SCHEDULED">{bc.meetingStatusScheduled}</option>
                  <option value="IN_PROGRESS">{bc.meetingStatusInProgress}</option>
                  <option value="COMPLETED">{bc.meetingStatusCompleted}</option>
                  <option value="CANCELLED">{bc.meetingStatusCancelled}</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">{bc.meetingDateLabel}</Label>
                <Input type="date" value={f.meetingDate} onChange={e => set('meetingDate', e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">{bc.facilitatorLabel}</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm" value={f.facilitatorId} onChange={e => set('facilitatorId', e.target.value)}>
                  <option value="">{bc.selectFacilitator}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">{bc.meetingLocationLabel}</Label>
                <Input value={f.location} onChange={e => set('location', e.target.value)} className="h-9 text-sm" placeholder={bc.meetingLocationPlaceholder} />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">{bc.externalNameLabel}</Label>
                <Input value={f.channelName} onChange={e => set('channelName', e.target.value)} className="h-9 text-sm" placeholder={bc.externalNamePlaceholder} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">{bc.externalAttendeesLabel}</Label>
              <Input value={f.externalAttendees} onChange={e => set('externalAttendees', e.target.value)} className="h-9 text-sm" placeholder={bc.externalAttendeesPlaceholder} />
            </div>
          </div>
        )}

        {tab === 'minutes' && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">{bc.agendaLabel}</Label>
              <TextArea value={f.agenda} onChange={v => set('agenda', v)} rows={3} />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">{bc.summaryLabel}</Label>
              <TextArea value={f.summary} onChange={v => set('summary', v)} rows={4} />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">{bc.decisionsLabel}</Label>
              <TextArea value={f.decisions} onChange={v => set('decisions', v)} rows={3} />
            </div>
            {f.meetingType === 'CHANNEL_NEGOTIATION' && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
                <p className="text-xs font-medium text-red-800">{bc.channelNegotiationSection}</p>
                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">{bc.negotiationContextLabel}</Label>
                  <TextArea value={f.negotiationContext} onChange={v => set('negotiationContext', v)} rows={3} />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">{bc.negotiationOutcomeLabel}</Label>
                  <TextArea value={f.negotiationOutcome} onChange={v => set('negotiationOutcome', v)} rows={3} />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'audio' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 p-3 space-y-1">
              <p className="text-xs font-medium text-slate-700 flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" />{bc.audioSection}</p>
              <p className="text-xs text-muted-foreground">{bc.audioHint}</p>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">{bc.audioLinkLabel}</Label>
              <Input value={f.audioFileUrl} onChange={e => set('audioFileUrl', e.target.value)} className="h-9 text-sm" placeholder="https://drive.google.com/..." />
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-1 text-xs text-blue-800">
              <p className="font-medium">{bc.aiTranscriptTitle}</p>
              <p>{bc.aiTranscriptDesc}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {isEdit ? bc.saveMeeting : bc.createMeeting}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}><X className="mr-1.5 h-3.5 w-3.5" />{dict.common.cancel}</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function BusinessCalendarPage() {
  const { dict } = useI18n()
  const bc = dict.businessCalendar
  type EvSt = keyof typeof bc.eventStatuses
  type TkSt = keyof typeof bc.taskStatuses

  // ── Text label maps (inside component, uses dict) ──────────────────────────
  const EVENT_TYPE_WITH_LABEL: Record<string, { label: string; color: string; icon: string }> = Object.fromEntries(
    Object.entries(EVENT_TYPE_CONFIG).map(([k, v]) => [k, { ...v, label: (bc.eventTypeLabels as Record<string,string>)[k] ?? k }])
  )
  const PROMO_TIER_CONFIG: Record<string, { label: string; color: string }> = {
    NATIONAL_MAJOR:  { label: (bc.promoTierLabels as Record<string,string>).NATIONAL_MAJOR,  color: PROMO_TIER_COLOR.NATIONAL_MAJOR },
    QUARTERLY:       { label: (bc.promoTierLabels as Record<string,string>).QUARTERLY,       color: PROMO_TIER_COLOR.QUARTERLY },
    MONTHLY:         { label: (bc.promoTierLabels as Record<string,string>).MONTHLY,         color: PROMO_TIER_COLOR.MONTHLY },
    FLASH_SALE:      { label: (bc.promoTierLabels as Record<string,string>).FLASH_SALE,      color: PROMO_TIER_COLOR.FLASH_SALE },
    CHANNEL_SPECIAL: { label: (bc.promoTierLabels as Record<string,string>).CHANNEL_SPECIAL, color: PROMO_TIER_COLOR.CHANNEL_SPECIAL },
  }
  const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    PREPARATION: { label: (bc.phaseLabels as Record<string,string>).PREPARATION, ...PHASE_CLS.PREPARATION },
    NEGOTIATION: { label: (bc.phaseLabels as Record<string,string>).NEGOTIATION, ...PHASE_CLS.NEGOTIATION },
    EXECUTION:   { label: (bc.phaseLabels as Record<string,string>).EXECUTION,   ...PHASE_CLS.EXECUTION },
    LIVE:        { label: (bc.phaseLabels as Record<string,string>).LIVE,        ...PHASE_CLS.LIVE },
    REVIEW:      { label: (bc.phaseLabels as Record<string,string>).REVIEW,      ...PHASE_CLS.REVIEW },
  }
  const MEETING_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    WEEKLY_ADMIN:        { label: (bc.meetingTypeLabels as Record<string,string>).WEEKLY_ADMIN,        color: MEETING_TYPE_COLOR.WEEKLY_ADMIN },
    CHANNEL_NEGOTIATION: { label: (bc.meetingTypeLabels as Record<string,string>).CHANNEL_NEGOTIATION, color: MEETING_TYPE_COLOR.CHANNEL_NEGOTIATION },
    ASSOCIATION_MEETING: { label: (bc.meetingTypeLabels as Record<string,string>).ASSOCIATION_MEETING, color: MEETING_TYPE_COLOR.ASSOCIATION_MEETING },
    EXHIBITION_DEBRIEF:  { label: (bc.meetingTypeLabels as Record<string,string>).EXHIBITION_DEBRIEF,  color: MEETING_TYPE_COLOR.EXHIBITION_DEBRIEF },
    PROMO_PLANNING:      { label: (bc.meetingTypeLabels as Record<string,string>).PROMO_PLANNING,      color: MEETING_TYPE_COLOR.PROMO_PLANNING },
    SUPPLIER_MEETING:    { label: (bc.meetingTypeLabels as Record<string,string>).SUPPLIER_MEETING,    color: MEETING_TYPE_COLOR.SUPPLIER_MEETING },
    INTERNAL:            { label: (bc.meetingTypeLabels as Record<string,string>).INTERNAL,            color: MEETING_TYPE_COLOR.INTERNAL },
    OTHER:               { label: (bc.meetingTypeLabels as Record<string,string>).OTHER,               color: MEETING_TYPE_COLOR.OTHER },
  }

  const [activeTab, setActiveTab] = useState<'calendar' | 'promo' | 'meetings' | 'todo'>('calendar')

  const [events,   setEvents]   = useState<BusinessEvent[]>([])
  const [promos,   setPromos]   = useState<PromoCalendar[]>([])
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [users,    setUsers]    = useState<User[]>([])
  const [loading,  setLoading]  = useState(true)

  const [showEventForm,   setShowEventForm]   = useState(false)
  const [showPromoForm,   setShowPromoForm]   = useState(false)
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [editingEvent,    setEditingEvent]    = useState<BusinessEvent | null>(null)
  const [editingPromo,    setEditingPromo]    = useState<PromoCalendar | null>(null)
  const [editingMeeting,  setEditingMeeting]  = useState<MeetingRecord | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null)
  const [meetingDetail,   setMeetingDetail]   = useState<(MeetingRecord & { actionItems: ActionItem[]; negotiationHistory: unknown[] }) | null>(null)
  const [loadingDetail,   setLoadingDetail]   = useState(false)

  // Weekly summary
  const [weeklyData, setWeeklyData] = useState<{
    ownerGroups: { owner: { id: string; name: string } | null; items: ActionItem[] }[]
    weekMeetings: MeetingRecord[]; totalOpen: number; totalOverdue: number; totalCompleted: number
    completedThisWeek: ActionItem[]
  } | null>(null)
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay() + 1); return d
  })

  // Filters
  const [meetingTypeFilter, setMeetingTypeFilter] = useState('')
  const [eventTypeFilter,   setEventTypeFilter]   = useState('')
  const [year,              setYear]              = useState(new Date().getFullYear())

  // Inline action item form
  const [addingActionItem, setAddingActionItem] = useState(false)
  const [newAction, setNewAction] = useState({ actionTitle: '', ownerUserId: '', dueDate: '', priority: 'MEDIUM' })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [evRes, prRes, mrRes, usRes] = await Promise.all([
        fetch(`/api/business-events?year=${year}`),
        fetch(`/api/promo-calendar?year=${year}`),
        fetch('/api/meeting-records?limit=100'),
        fetch('/api/users'),
      ])
      if (evRes.ok) setEvents(await evRes.json())
      if (prRes.ok) setPromos(await prRes.json())
      if (mrRes.ok) setMeetings(await mrRes.json())
      if (usRes.ok) { const d = await usRes.json(); setUsers(Array.isArray(d) ? d : (d.users ?? [])) }
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [year])

  const loadWeekly = useCallback(async () => {
    const iso = weekStart.toISOString().slice(0, 10)
    const res = await fetch(`/api/meeting-records/weekly-summary?weekStart=${iso}`)
    if (res.ok) setWeeklyData(await res.json())
  }, [weekStart])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (activeTab === 'todo') loadWeekly() }, [activeTab, loadWeekly])

  async function loadMeetingDetail(id: string) {
    setLoadingDetail(true); setSelectedMeeting(id)
    try {
      const res = await fetch(`/api/meeting-records/${id}`)
      if (res.ok) setMeetingDetail(await res.json())
    } finally { setLoadingDetail(false) }
  }

  async function updateActionItem(itemId: string, patch: Record<string, unknown>) {
    if (!meetingDetail) return
    const res = await fetch(`/api/meeting-records/${meetingDetail.id}/action-items/${itemId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    if (res.ok) { await loadMeetingDetail(meetingDetail.id); if (activeTab === 'todo') loadWeekly() }
  }

  async function addActionItem() {
    if (!meetingDetail || !newAction.actionTitle) return
    const res = await fetch(`/api/meeting-records/${meetingDetail.id}/action-items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAction),
    })
    if (res.ok) {
      setAddingActionItem(false); setNewAction({ actionTitle: '', ownerUserId: '', dueDate: '', priority: 'MEDIUM' })
      await loadMeetingDetail(meetingDetail.id)
    }
  }

  function handleSaved() {
    setShowEventForm(false); setShowPromoForm(false); setShowMeetingForm(false)
    setEditingEvent(null); setEditingPromo(null); setEditingMeeting(null)
    loadData()
    if (selectedMeeting) loadMeetingDetail(selectedMeeting)
  }

  const tabStyle = (t: string) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`

  const upcomingEvents  = events.filter(e => new Date(e.startDate) >= new Date()).sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  const activePromos    = promos.filter(p => p.isActive && p.currentPhase !== 'REVIEW')
  const filteredMeetings = meetings.filter(m => !meetingTypeFilter || m.meetingType === meetingTypeFilter)
  const filteredEvents   = events.filter(e => !eventTypeFilter || e.eventType === eventTypeFilter)

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-blue-600" />{dict.businessCalendar.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {bc.headerDesc.replace('{events}', String(events.length)).replace('{promos}', String(activePromos.length)).replace('{meetings}', String(meetings.length))}
          </p>
        </div>
        <div className="flex gap-2">
          <select className="border rounded-md px-2 py-1.5 text-sm" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y} {bc.yearUnit}</option>)}
          </select>
          {activeTab === 'calendar'  && <Button size="sm" onClick={() => setShowEventForm(true)}><Plus className="mr-1.5 h-4 w-4" />{bc.addEventBtn}</Button>}
          {activeTab === 'promo'     && <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => setShowPromoForm(true)}><Megaphone className="mr-1.5 h-4 w-4" />{bc.addPromoBtn}</Button>}
          {activeTab === 'meetings'  && <Button size="sm" onClick={() => setShowMeetingForm(true)}><Plus className="mr-1.5 h-4 w-4" />{bc.addMeetingBtn}</Button>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: bc.statEvents,      value: events.length,    icon: Calendar,     color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
          { label: bc.statExhibitions, value: upcomingEvents.filter(e => e.eventType.startsWith('EXHIBITION')).length, icon: Building2, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
          { label: bc.statPromos,      value: activePromos.length, icon: Megaphone, color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
          { label: bc.statMeetings,    value: meetings.length,  icon: FileText,     color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
          { label: bc.statTodos,       value: weeklyData?.totalOpen ?? '—', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-3 flex items-center gap-3`}>
            <s.icon className={`h-7 w-7 ${s.color}`} />
            <div><p className={`text-xl font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="border-b flex gap-0">
        <button className={tabStyle('calendar')} onClick={() => setActiveTab('calendar')}>{bc.tabCalendar}</button>
        <button className={tabStyle('promo')}    onClick={() => setActiveTab('promo')}>{bc.tabPromo}</button>
        <button className={tabStyle('meetings')} onClick={() => setActiveTab('meetings')}>{bc.tabMeetings}</button>
        <button className={tabStyle('todo')}     onClick={() => setActiveTab('todo')}>{bc.tabTodo}</button>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>}

      {/* ── 行事曆總覽 ── */}
      {!loading && activeTab === 'calendar' && (
        <div className="space-y-4">
          {(showEventForm || editingEvent) && (
            <EventForm users={users} initial={editingEvent ?? undefined} onSaved={handleSaved} onCancel={() => { setShowEventForm(false); setEditingEvent(null) }} />
          )}
          <div className="flex gap-2 flex-wrap">
            <select className="border rounded-md px-3 py-1.5 text-sm" value={eventTypeFilter} onChange={e => setEventTypeFilter(e.target.value)}>
              <option value="">{bc.allTypes}</option>
              {Object.entries(EVENT_TYPE_WITH_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {eventTypeFilter && <button onClick={() => setEventTypeFilter('')} className="text-xs text-red-500 px-2">{bc.clearFilter}</button>}
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{bc.noActivities}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Group by month */}
              {Array.from(new Set(filteredEvents.map(e => e.startDate.slice(0, 7)))).map(month => (
                <div key={month}>
                  <p className="text-xs font-semibold text-muted-foreground px-1 py-1.5 uppercase tracking-wider">
                    {new Date(month + '-01').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })}
                  </p>
                  <div className="space-y-1.5">
                    {filteredEvents.filter(e => e.startDate.startsWith(month)).map(ev => {
                      const typeCfg   = EVENT_TYPE_WITH_LABEL[ev.eventType]   ?? { label: ev.eventType,   color: 'bg-slate-100 text-slate-600', icon: '📌' }
                      const evStColor = EVENT_STATUS_COLOR[ev.status]    ?? 'bg-slate-100 text-slate-600'
                      const evStLabel = bc.eventStatuses[ev.status as EvSt] ?? ev.status
                      return (
                        <div key={ev.id} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 hover:bg-slate-50">
                          <div className="w-10 text-center shrink-0">
                            <p className="text-lg font-bold text-slate-700">{new Date(ev.startDate).getDate()}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(ev.startDate).toLocaleDateString('zh-TW', { weekday: 'short' })}
                            </p>
                          </div>
                          <span className="text-lg">{typeCfg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-slate-800">{ev.title}</span>
                              <Badge className={`text-[11px] border-0 ${typeCfg.color}`}>{typeCfg.label}</Badge>
                              <Badge className={`text-[11px] border-0 ${evStColor}`}>{evStLabel}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                              {ev.location && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{ev.location}</span>}
                              {ev.venue     && <span>{ev.venue}</span>}
                              {ev.channelPlatform && <span>{ev.channelPlatform}</span>}
                              {ev.endDate !== ev.startDate && <span>{bc.eventToSuffix}{fmtDate(ev.endDate)}</span>}
                              {ev.owner && <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{ev.owner.name}</span>}
                            </div>
                            {(ev.boothNo || ev.actualVisitors || ev.leadsCollected) && (
                              <div className="flex gap-2 mt-0.5 text-xs">
                                {ev.boothNo         && <span className="text-orange-600">{bc.boothPrefix}{ev.boothNo}</span>}
                                {ev.actualVisitors  && <span className="text-green-600">{bc.actualVisitorsPrefix}{ev.actualVisitors.toLocaleString()}</span>}
                                {ev.leadsCollected  && <span className="text-blue-600">{bc.leadsPrefix}{ev.leadsCollected}</span>}
                                {ev.ordersTaken     && <span className="text-purple-600">{ev.ordersTaken}{bc.dealCountSuffix}</span>}
                              </div>
                            )}
                          </div>
                          <button onClick={() => { setEditingEvent(ev); setShowEventForm(false) }} className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground shrink-0">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 大檔期規劃 ── */}
      {!loading && activeTab === 'promo' && (
        <div className="space-y-4">
          {(showPromoForm || editingPromo) && (
            <PromoForm users={users} initial={editingPromo ?? undefined} onSaved={handleSaved} onCancel={() => { setShowPromoForm(false); setEditingPromo(null) }} />
          )}

          {promos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{bc.noPromos}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {promos.map(p => {
                const tierCfg  = PROMO_TIER_CONFIG[p.promoTier]  ?? { label: p.promoTier,  color: 'bg-slate-100 text-slate-600' }
                const phaseCfg = PHASE_CONFIG[p.currentPhase]    ?? { label: p.currentPhase, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' }
                const daysLeft = p.daysUntilEvent ?? 0
                const isUrgent = daysLeft > 0 && daysLeft <= 30
                return (
                  <Card key={p.id} className={`border ${phaseCfg.bg}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-xs border-0 ${tierCfg.color}`}>{tierCfg.label}</Badge>
                            <span className="font-semibold text-slate-900">{p.promoName}</span>
                            <span className="font-mono text-xs text-slate-400">{p.promoCode}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${phaseCfg.bg} ${phaseCfg.color}`}>{phaseCfg.label}</span>
                          </div>

                          {/* Timeline */}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                            <span className="text-purple-600">▶ {(bc.phaseLabels as Record<string,string>).PREPARATION} {fmtDate(p.prepStartDate)}</span>
                            <span>→</span>
                            <span className="text-blue-600">{(bc.phaseLabels as Record<string,string>).NEGOTIATION} {fmtDate(p.negoStartDate)}</span>
                            <span>→</span>
                            <span className="text-orange-600">{(bc.phaseLabels as Record<string,string>).EXECUTION} {fmtDate(p.execStartDate)}</span>
                            <span>→</span>
                            <span className="text-green-700 font-semibold">🔥 {(bc.phaseLabels as Record<string,string>).LIVE} {fmtDate(p.eventStartDate)}</span>
                            {p.eventEndDate !== p.eventStartDate && <span className="text-green-700">~ {fmtDate(p.eventEndDate)}</span>}
                          </div>

                          <div className="flex flex-wrap gap-3 text-xs">
                            {daysLeft > 0 && (
                              <span className={`font-semibold flex items-center gap-1 ${isUrgent ? 'text-red-600' : 'text-slate-600'}`}>
                                {isUrgent && <AlertTriangle className="h-3.5 w-3.5" />}
                                {bc.daysLeft.replace('{n}', String(daysLeft))}
                              </span>
                            )}
                            {daysLeft <= 0 && <span className="text-green-600 font-semibold flex items-center gap-1"><PartyPopper className="h-3 w-3" />{bc.eventLive}</span>}
                            {p.revenueTarget && <span>{bc.revenueTargetDisplay}{fmtMoney(p.revenueTarget)}</span>}
                            {p.revenueActual && <span className="text-green-600">{bc.revenueActualDisplay}{fmtMoney(p.revenueActual)}</span>}
                            {p.orderTarget   && <span>{bc.orderTargetDisplay}{p.orderTarget.toLocaleString()}</span>}
                          </div>

                          {p.targetChannels.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {p.targetChannels.map(c => <span key={c} className="text-[11px] bg-white border px-2 py-0.5 rounded">{c}</span>)}
                            </div>
                          )}

                          {p.responsibleUser && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" />{bc.ownerDisplay}{p.responsibleUser.name}</p>
                          )}
                        </div>
                        <button onClick={() => { setEditingPromo(p); setShowPromoForm(false) }} className="p-1.5 rounded hover:bg-white text-muted-foreground shrink-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 會議記錄 ── */}
      {!loading && activeTab === 'meetings' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left: list */}
          <div className="lg:col-span-2 space-y-3">
            {(showMeetingForm || editingMeeting) && (
              <MeetingForm users={users} initial={editingMeeting ?? undefined} onSaved={handleSaved} onCancel={() => { setShowMeetingForm(false); setEditingMeeting(null) }} />
            )}
            <div className="flex gap-2">
              <select className="border rounded-md px-2 py-1.5 text-sm flex-1" value={meetingTypeFilter} onChange={e => setMeetingTypeFilter(e.target.value)}>
                <option value="">{bc.allMeetingTypes}</option>
                {Object.entries(MEETING_TYPE_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {meetingTypeFilter && <button onClick={() => setMeetingTypeFilter('')} className="text-xs text-red-500 px-2">{bc.clearFilter}</button>}
            </div>
            {filteredMeetings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">{bc.noMeetings}</div>
            ) : (
              <div className="space-y-1.5">
                {filteredMeetings.map(m => {
                  const typeCfg = MEETING_TYPE_CONFIG[m.meetingType] ?? { label: m.meetingType, color: 'bg-slate-100' }
                  const isSelected = selectedMeeting === m.id
                  return (
                    <button key={m.id} onClick={() => loadMeetingDetail(m.id)} className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-slate-800 truncate">{m.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge className={`text-[11px] border-0 ${typeCfg.color}`}>{typeCfg.label}</Badge>
                            <span className="text-xs text-muted-foreground">{fmtDateFull(m.meetingDate)}</span>
                          </div>
                          {m.channelName && <p className="text-xs text-slate-500 mt-0.5">{m.channelName}</p>}
                        </div>
                        {m._count && m._count.actionItems > 0 && (
                          <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">{m._count.actionItems} {bc.pendingActions}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: detail */}
          <div className="lg:col-span-3">
            {loadingDetail && <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>}
            {!loadingDetail && !meetingDetail && (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>{bc.clickToView}</p>
              </div>
            )}
            {!loadingDetail && meetingDetail && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-400">{meetingDetail.meetingNo}</span>
                        <Badge className={`text-xs border-0 ${MEETING_TYPE_CONFIG[meetingDetail.meetingType]?.color ?? 'bg-slate-100'}`}>
                          {MEETING_TYPE_CONFIG[meetingDetail.meetingType]?.label ?? meetingDetail.meetingType}
                        </Badge>
                      </div>
                      <CardTitle className="text-base mt-1">{meetingDetail.title}</CardTitle>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateFull(meetingDetail.meetingDate)}</span>
                        {meetingDetail.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{meetingDetail.location}</span>}
                        {meetingDetail.facilitator && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{meetingDetail.facilitator.name}</span>}
                      </div>
                    </div>
                    <button onClick={() => { setEditingMeeting(meetingDetail as unknown as MeetingRecord); setShowMeetingForm(false) }} className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground shrink-0">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 摘要 */}
                  {meetingDetail.summary && (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-700 mb-1">{bc.meetingSummarySection}</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{meetingDetail.summary}</p>
                    </div>
                  )}
                  {meetingDetail.decisions && (
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-xs font-medium text-blue-800 mb-1">{bc.meetingDecisionsSection}</p>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">{meetingDetail.decisions}</p>
                    </div>
                  )}

                  {/* 通路談判歷史 */}
                  {meetingDetail.meetingType === 'CHANNEL_NEGOTIATION' && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-red-800">{bc.negotiationDbSection}</p>
                      {meetingDetail.negotiationContext && (
                        <div><p className="text-xs text-red-700 font-medium">{bc.negotiationBackground}</p><p className="text-xs text-slate-700 whitespace-pre-wrap">{meetingDetail.negotiationContext}</p></div>
                      )}
                      {meetingDetail.negotiationOutcome && (
                        <div><p className="text-xs text-red-700 font-medium">{bc.negotiationResult}</p><p className="text-xs text-slate-700 whitespace-pre-wrap">{meetingDetail.negotiationOutcome}</p></div>
                      )}
                      {(meetingDetail.negotiationHistory as unknown[]).length > 0 && (
                        <div>
                          <p className="text-xs text-red-700 font-medium mb-1">{bc.negotiationHistory}</p>
                          <div className="space-y-1">
                            {(meetingDetail.negotiationHistory as { id: string; meetingNo: string; meetingDate: string; negotiationOutcome?: string | null }[]).map(h => (
                              <div key={h.id} className="rounded bg-white border px-2 py-1.5 text-xs">
                                <span className="font-mono text-slate-400 mr-2">{h.meetingNo}</span>
                                <span className="text-muted-foreground mr-2">{fmtDateFull(h.meetingDate)}</span>
                                {h.negotiationOutcome && <span className="text-slate-700">{h.negotiationOutcome.slice(0, 60)}{h.negotiationOutcome.length > 60 ? '...' : ''}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 錄音 */}
                  {meetingDetail.audioFileUrl && (
                    <div className="rounded-lg bg-slate-50 p-3 flex items-center gap-2">
                      <Mic className="h-4 w-4 text-slate-500" />
                      <a href={meetingDetail.audioFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        {bc.audioFile} <ExternalLink className="h-3 w-3" />
                      </a>
                      {meetingDetail.transcriptStatus && meetingDetail.transcriptStatus !== 'PENDING' && (
                        <Badge className="text-xs border-0 bg-green-100 text-green-700 ml-2">{bc.transcribed}</Badge>
                      )}
                    </div>
                  )}

                  {/* 待辦事項 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-700">{bc.actionItemsSection}</p>
                      <button onClick={() => setAddingActionItem(true)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                        <Plus className="h-3 w-3" />{bc.addActionItem}
                      </button>
                    </div>
                    {addingActionItem && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2 mb-2">
                        <Input value={newAction.actionTitle} onChange={e => setNewAction(p => ({...p, actionTitle: e.target.value}))} className="h-8 text-sm" placeholder={bc.actionItemPlaceholder} />
                        <div className="grid grid-cols-3 gap-2">
                          <select className="border rounded-md h-8 px-2 text-xs" value={newAction.ownerUserId} onChange={e => setNewAction(p => ({...p, ownerUserId: e.target.value}))}>
                            <option value="">{bc.ownerSelect}</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                          <Input type="date" value={newAction.dueDate} onChange={e => setNewAction(p => ({...p, dueDate: e.target.value}))} className="h-8 text-xs" />
                          <select className="border rounded-md h-8 px-2 text-xs" value={newAction.priority} onChange={e => setNewAction(p => ({...p, priority: e.target.value}))}>
                            {[['HIGH', bc.priorityHigh],['MEDIUM', bc.priorityMedium],['LOW', bc.priorityLow]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs" onClick={addActionItem}><Check className="h-3 w-3 mr-1" />{bc.addBtn}</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingActionItem(false)}><X className="h-3 w-3 mr-1" />{dict.common.cancel}</Button>
                        </div>
                      </div>
                    )}
                    {meetingDetail.actionItems.length === 0 && !addingActionItem && (
                      <p className="text-xs text-muted-foreground py-2">{bc.noActionItems}</p>
                    )}
                    <div className="space-y-1.5">
                      {meetingDetail.actionItems.map(item => {
                        const scColor = ACTION_STATUS_COLOR[item.status] ?? 'bg-slate-100 text-slate-600'
                        const scLabel = bc.taskStatuses[item.status as TkSt] ?? item.status
                        const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'DONE'
                        return (
                          <div key={item.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 ${item.status === 'DONE' ? 'bg-green-50' : isOverdue ? 'bg-red-50' : 'bg-slate-50'}`}>
                            <button onClick={() => updateActionItem(item.id, { status: item.status === 'DONE' ? 'OPEN' : 'DONE' })} className="mt-0.5 shrink-0">
                              {item.status === 'DONE'
                                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                : <Circle className="h-4 w-4 text-slate-400" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${item.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.actionTitle}</p>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                                {item.owner && <span>{item.owner.name}</span>}
                                {item.dueDate && <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{isOverdue ? '⚠ ' : ''}{bc.dueDatePrefix}{fmtDate(item.dueDate)}</span>}
                                <Badge className={`text-[10px] border-0 py-0 ${scColor}`}>{scLabel}</Badge>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── 待辦追蹤（周會看板）── */}
      {!loading && activeTab === 'todo' && (
        <div className="space-y-4">
          {/* Week nav */}
          <div className="flex items-center gap-3">
            <button onClick={() => setWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd })} className="p-1.5 rounded hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-medium text-slate-700">
              {bc.weekLabel}{weekStart.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}{bc.weekRange}{new Date(weekStart.getTime() + 6*86400_000).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}
            </span>
            <button onClick={() => setWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd })} className="p-1.5 rounded hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={loadWeekly} className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
            <div className="flex gap-3 ml-auto text-xs">
              <span className="text-amber-600 font-medium">{bc.pendingLabel}{weeklyData?.totalOpen ?? 0}</span>
              <span className="text-red-600 font-medium">{bc.overdueLabel}{weeklyData?.totalOverdue ?? 0}</span>
              <span className="text-green-600 font-medium">{bc.completedLabel}{weeklyData?.totalCompleted ?? 0}</span>
            </div>
          </div>

          {/* 本週周會 */}
          {weeklyData?.weekMeetings && weeklyData.weekMeetings.length > 0 && (
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><CalendarCheck className="h-3.5 w-3.5" />{bc.weekMeetingsTitle}</p>
              <div className="flex gap-2 flex-wrap">
                {weeklyData.weekMeetings.map(m => (
                  <button key={m.id} onClick={() => { setActiveTab('meetings'); loadMeetingDetail(m.id) }} className="text-xs bg-white border rounded px-3 py-1.5 hover:bg-blue-50 hover:border-blue-300">
                    {m.title} · {fmtDate(m.meetingDate)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 待辦分組 */}
          {!weeklyData || weeklyData.ownerGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />{bc.noTodos}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {weeklyData.ownerGroups.map((group, gi) => (
                <Card key={gi} className={group.items.some(i => i.isOverdue) ? 'border-red-200' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {group.owner?.name ?? bc.unassigned}
                      <span className="ml-auto text-xs font-normal text-muted-foreground">{group.items.length}{bc.itemCountSuffix}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 pt-0">
                    {group.items.map(item => {
                      const isOverdue = item.isOverdue
                      const itmClr = ACTION_STATUS_COLOR[item.status] ?? 'bg-slate-100'
                      const itmLbl = bc.taskStatuses[item.status as TkSt] ?? item.status
                      return (
                        <div key={item.id} className={`rounded-lg p-2 text-xs ${isOverdue ? 'bg-red-50 border border-red-200' : item.isDueThisWeek ? 'bg-amber-50' : 'bg-slate-50'}`}>
                          <div className="flex items-start gap-1.5">
                            <button onClick={() => updateActionItem(item.id, { status: 'DONE' })} className="mt-0.5 shrink-0">
                              <Circle className="h-3.5 w-3.5 text-slate-400 hover:text-green-600" />
                            </button>
                            <div className="flex-1">
                              <p className="text-slate-800 font-medium">{item.actionTitle}</p>
                              <div className="flex gap-2 mt-0.5 text-muted-foreground flex-wrap">
                                {item.dueDate && <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>{isOverdue ? '⚠ ' : ''}{bc.duePrefix}{fmtDate(item.dueDate)}</span>}
                                {item.meetingRecord && <span className="truncate max-w-[100px]">{item.meetingRecord.meetingNo}</span>}
                              </div>
                            </div>
                            <Badge className={`text-[10px] border-0 ${itmClr} shrink-0`}>
                              {itmLbl}
                            </Badge>
                          </div>
                          {item.followUpNote && <p className="mt-1 text-muted-foreground italic pl-5">{item.followUpNote}</p>}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 本週已完成 */}
          {weeklyData?.completedThisWeek && weeklyData.completedThisWeek.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />{bc.weekCompleted} ({weeklyData.completedThisWeek.length})</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {weeklyData.completedThisWeek.map(item => (
                  <div key={item.id} className="rounded-lg bg-green-50 px-3 py-2 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-slate-700 line-through">{item.actionTitle}</p>
                      <p className="text-muted-foreground">{item.owner?.name ?? ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
