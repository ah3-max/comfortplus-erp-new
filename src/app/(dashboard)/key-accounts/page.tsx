'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  Plus,
  Star,
  Phone,
  Mail,
  MapPin,
  FileText,
  Search,
  RefreshCw,
  Building2,
  Calendar,
  TrendingUp,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────

type CustomerType =
  | 'NURSING_HOME'
  | 'CARE_HOME'
  | 'ELDERLY_HOME'
  | 'SOCIAL_WELFARE'
  | 'DAY_CARE'
  | 'HOME_CARE'
  | 'HOSPITAL'
  | 'DISTRIBUTOR'
  | 'MEDICAL_CHANNEL'
  | 'PHARMACY_CHANNEL'
  | 'B2C_OFFICIAL'
  | 'B2C_SHOPEE'
  | 'B2C_MOMO'
  | 'B2C_OTHER'
  | 'OTHER'

type CustomerGrade = 'A' | 'B' | 'C' | 'D' | 'NONE'

type SalesRegion =
  | 'NORTH_METRO'
  | 'KEELUNG_YILAN'
  | 'HSINCHU_MIAOLI'
  | 'TAICHUNG_AREA'
  | 'YUNLIN_CHIAYI'
  | 'TAINAN_KAOHSIUNG'
  | 'HUALIEN_TAITUNG'
  | 'OFFSHORE'

interface Customer {
  id: string
  code: string
  name: string
  type: CustomerType
  grade: CustomerGrade | null
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  region: SalesRegion | null
  paymentTerms: string | null
  creditLimit: string | null
  notes: string | null
  lastOrderDate: string | null
  lifetimeValue: string | null
  salesRep: { id: string; name: string } | null
  keyAccountMgr: { id: string; name: string } | null
  _count: { visitRecords: number; callRecords: number; salesOrders: number }
}

interface NewCustomerForm {
  name: string
  code: string
  type: CustomerType | ''
  contactPerson: string
  phone: string
  email: string
  address: string
  paymentTerms: string
  creditLimit: string
  grade: CustomerGrade | ''
  notes: string
}

interface FollowUpForm {
  logType: 'VISIT' | 'CALL' | 'EMAIL' | 'LINE'
  content: string
  nextFollowUpDate: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GRADE_BADGE: Record<string, string> = {
  A: 'bg-amber-500 text-white hover:bg-amber-500',
  B: 'bg-blue-500 text-white hover:bg-blue-500',
  C: 'bg-emerald-500 text-white hover:bg-emerald-500',
  D: 'bg-slate-400 text-white hover:bg-slate-400',
  NONE: 'bg-slate-200 text-slate-600 hover:bg-slate-200',
}

const ALL_REGIONS: SalesRegion[] = [
  'NORTH_METRO',
  'KEELUNG_YILAN',
  'HSINCHU_MIAOLI',
  'TAICHUNG_AREA',
  'YUNLIN_CHIAYI',
  'TAINAN_KAOHSIUNG',
  'HUALIEN_TAITUNG',
  'OFFSHORE',
]

const EMPTY_NEW_FORM: NewCustomerForm = {
  name: '',
  code: '',
  type: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  paymentTerms: '',
  creditLimit: '',
  grade: '',
  notes: '',
}

const EMPTY_FOLLOW_UP: FollowUpForm = {
  logType: 'CALL',
  content: '',
  nextFollowUpDate: '',
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatCurrency(value: string | null): string {
  if (!value) return '—'
  const num = parseFloat(value)
  if (isNaN(num)) return '—'
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`
  return `$${num.toFixed(0)}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CustomerTypeBadge({ type }: { type: CustomerType }) {
  const { dict } = useI18n()
  const ka = dict.keyAccounts
  const typeLabels: Record<string, string> = {
    NURSING_HOME: ka.typeNursingHome, CARE_HOME: ka.typeCareHome,
    ELDERLY_HOME: ka.typeElderlyHome, SOCIAL_WELFARE: ka.typeSocialWelfare,
    DAY_CARE: ka.typeDayCare, HOME_CARE: ka.typeHomeCare,
    HOSPITAL: ka.typeHospital, DISTRIBUTOR: ka.typeDistributor,
    MEDICAL_CHANNEL: ka.typeMedicalChannel, PHARMACY_CHANNEL: ka.typePharmacyChannel,
    B2C_OFFICIAL: ka.typeB2cOfficial, B2C_SHOPEE: ka.typeB2cShopee,
    B2C_MOMO: ka.typeB2cMomo, B2C_OTHER: ka.typeB2cOther, OTHER: ka.typeOther,
  }
  return (
    <Badge variant="outline" className="text-xs font-normal">
      {typeLabels[type] ?? type}
    </Badge>
  )
}

function GradeBadge({ grade }: { grade: CustomerGrade | null }) {
  const g = grade ?? 'NONE'
  return (
    <Badge className={`${GRADE_BADGE[g] ?? GRADE_BADGE.NONE} text-xs font-bold shrink-0`}>
      {g === 'NONE' ? '—' : g}
    </Badge>
  )
}

// ─── Customer Card ────────────────────────────────────────────────────────────

interface CustomerCardProps {
  customer: Customer
  onEdit: (c: Customer) => void
  onFollowUp: (c: Customer) => void
}

function CustomerCard({ customer, onEdit, onFollowUp }: CustomerCardProps) {
  const { dict } = useI18n()
  const ka = dict.keyAccounts
  const regionLabels: Record<string, string> = {
    NORTH_METRO: ka.regionNorthMetro, KEELUNG_YILAN: ka.regionKeelungYilan,
    HSINCHU_MIAOLI: ka.regionHsinchuMiaoli, TAICHUNG_AREA: ka.regionTaichungArea,
    YUNLIN_CHIAYI: ka.regionYunlinChiayi, TAINAN_KAOHSIUNG: ka.regionTainanKaohsiung,
    HUALIEN_TAITUNG: ka.regionHualienTaitung, OFFSHORE: ka.regionOffshore,
  }
  const interactions = customer._count.visitRecords + customer._count.callRecords
  return (
    <Card className="hover:shadow-md transition-shadow border border-border/60">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <button
              onClick={() => onEdit(customer)}
              className="font-semibold text-sm text-left hover:text-blue-600 hover:underline truncate block max-w-full"
            >
              {customer.name}
            </button>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{customer.code}</p>
          </div>
          <GradeBadge grade={customer.grade} />
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Type */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <CustomerTypeBadge type={customer.type} />
          {customer.region && (
            <Badge variant="secondary" className="text-xs">
              {regionLabels[customer.region] ?? customer.region}
            </Badge>
          )}
        </div>

        {/* Contact info */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {customer.contactPerson && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{customer.contactPerson}</span>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{customer.phone}</span>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{customer.email}</span>
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{customer.address}</span>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{ka.totalOrders}</p>
            <p className="text-sm font-semibold text-slate-700">
              {customer._count.salesOrders}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{ka.totalRevenue}</p>
            <p className="text-sm font-semibold text-blue-600">
              {formatCurrency(customer.lifetimeValue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{ka.interactions}</p>
            <p className="text-sm font-semibold text-slate-700">{interactions}</p>
          </div>
        </div>

        {/* Last order */}
        {customer.lastOrderDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{ka.lastOrder}{formatDate(customer.lastOrderDate)}</span>
          </div>
        )}

        {/* Notes */}
        {customer.notes && (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-2.5 py-1.5 line-clamp-2">
            {customer.notes}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-0.5">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={() => onEdit(customer)}
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            {ka.viewEdit}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            onClick={() => onFollowUp(customer)}
          >
            <Phone className="h-3.5 w-3.5 mr-1" />
            {ka.followUp}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── New Customer Dialog ──────────────────────────────────────────────────────

interface NewCustomerDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function NewCustomerDialog({ open, onClose, onSuccess }: NewCustomerDialogProps) {
  const { dict } = useI18n()
  const ka = dict.keyAccounts
  const [form, setForm] = useState<NewCustomerForm>(EMPTY_NEW_FORM)
  const [saving, setSaving] = useState(false)
  const paymentOptions = [
    { value: 'CASH', label: ka.paymentCash },
    { value: 'NET30', label: ka.paymentNet30 },
    { value: 'NET45', label: ka.paymentNet45 },
    { value: 'NET60', label: ka.paymentNet60 },
  ]
  const gradeOptions: { value: CustomerGrade; label: string }[] = [
    { value: 'A', label: ka.gradeALabel },
    { value: 'B', label: ka.gradeBLabel },
    { value: 'C', label: ka.gradeCLabel },
    { value: 'D', label: ka.gradeDLabel },
  ]

  function setField<K extends keyof NewCustomerForm>(key: K, value: NewCustomerForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error(ka.nameRequired)
      return
    }
    if (!form.type) {
      toast.error(ka.typeRequired)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          type: form.type,
          contactPerson: form.contactPerson || null,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          paymentTerms: form.paymentTerms || null,
          creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
          grade: form.grade || null,
          notes: form.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? dict.common.createFailed)
        return
      }
      toast.success(ka.customerCreated.replace('{name}', data.name))
      setForm(EMPTY_NEW_FORM)
      onSuccess()
      onClose()
    } catch {
      toast.error(ka.networkError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
            {ka.addKeyAccount}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name + Code */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="nc-name">
                {ka.customerName} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nc-name"
                placeholder={ka.namePlaceholder}
                value={form.name}
                onChange={e => setField('name', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-code">{ka.customerCode}</Label>
              <Input
                id="nc-code"
                placeholder={ka.codePlaceholder}
                value={form.code}
                onChange={e => setField('code', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ka.customerType} <span className="text-red-500">*</span></Label>
              <Select value={form.type} onValueChange={v => setField('type', v as CustomerType)}>
                <SelectTrigger>
                  <SelectValue placeholder={ka.selectType} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NURSING_HOME">{ka.typeNursingHome}</SelectItem>
                  <SelectItem value="CARE_HOME">{ka.typeCareHome}</SelectItem>
                  <SelectItem value="ELDERLY_HOME">{ka.typeElderlyHome}</SelectItem>
                  <SelectItem value="SOCIAL_WELFARE">{ka.typeSocialWelfare}</SelectItem>
                  <SelectItem value="DAY_CARE">{ka.typeDayCare}</SelectItem>
                  <SelectItem value="HOME_CARE">{ka.typeHomeCare}</SelectItem>
                  <SelectItem value="HOSPITAL">{ka.typeHospital}</SelectItem>
                  <SelectItem value="DISTRIBUTOR">{ka.typeDistributor}</SelectItem>
                  <SelectItem value="MEDICAL_CHANNEL">{ka.typeMedicalChannel}</SelectItem>
                  <SelectItem value="PHARMACY_CHANNEL">{ka.typePharmacyChannel}</SelectItem>
                  <SelectItem value="B2C_OFFICIAL">{ka.typeB2cOfficial}</SelectItem>
                  <SelectItem value="B2C_SHOPEE">{ka.typeB2cShopee}</SelectItem>
                  <SelectItem value="B2C_MOMO">{ka.typeB2cMomo}</SelectItem>
                  <SelectItem value="B2C_OTHER">{ka.typeB2cOther}</SelectItem>
                  <SelectItem value="OTHER">{ka.typeOther}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-contact">{ka.contactPerson}</Label>
              <Input
                id="nc-contact"
                placeholder={ka.contactPlaceholder}
                value={form.contactPerson}
                onChange={e => setField('contactPerson', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-phone">{ka.phone}</Label>
              <Input
                id="nc-phone"
                placeholder="02-xxxx-xxxx"
                value={form.phone}
                onChange={e => setField('phone', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="nc-email">{ka.logEmail}</Label>
              <Input
                id="nc-email"
                type="email"
                placeholder="contact@example.com"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="nc-address">{ka.address}</Label>
              <Input
                id="nc-address"
                placeholder={ka.addressPlaceholder}
                value={form.address}
                onChange={e => setField('address', e.target.value)}
              />
            </div>
          </div>

          {/* Commercial */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{ka.paymentTerms}</Label>
              <Select
                value={form.paymentTerms}
                onValueChange={v => setField('paymentTerms', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ka.selectPaymentTerms} />
                </SelectTrigger>
                <SelectContent>
                  {paymentOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-credit">{ka.creditLimit}</Label>
              <Input
                id="nc-credit"
                type="number"
                placeholder="0"
                min={0}
                value={form.creditLimit}
                onChange={e => setField('creditLimit', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{ka.customerGrade}</Label>
              <Select
                value={form.grade}
                onValueChange={v => setField('grade', v as CustomerGrade)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ka.selectGrade} />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-notes">{ka.notes}</Label>
            <textarea
              id="nc-notes"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              placeholder={ka.notesBg}
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {dict.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {ka.addCustomer}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Customer Dialog ─────────────────────────────────────────────────────

interface EditCustomerDialogProps {
  customer: Customer | null
  onClose: () => void
  onSuccess: () => void
}

function EditCustomerDialog({ customer, onClose, onSuccess }: EditCustomerDialogProps) {
  const { dict } = useI18n()
  const ka = dict.keyAccounts
  const [form, setForm] = useState<Partial<NewCustomerForm>>({})
  const [saving, setSaving] = useState(false)
  const paymentOptions = [
    { value: 'CASH', label: ka.paymentCash },
    { value: 'NET30', label: ka.paymentNet30 },
    { value: 'NET45', label: ka.paymentNet45 },
    { value: 'NET60', label: ka.paymentNet60 },
  ]
  const gradeOptions: { value: CustomerGrade; label: string }[] = [
    { value: 'A', label: ka.gradeALabel },
    { value: 'B', label: ka.gradeBLabel },
    { value: 'C', label: ka.gradeCLabel },
    { value: 'D', label: ka.gradeDLabel },
  ]

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name,
        code: customer.code,
        type: customer.type,
        contactPerson: customer.contactPerson ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        address: customer.address ?? '',
        paymentTerms: customer.paymentTerms ?? '',
        creditLimit: customer.creditLimit ? String(parseFloat(customer.creditLimit)) : '',
        grade: (customer.grade as CustomerGrade) ?? '',
        notes: customer.notes ?? '',
      })
    }
  }, [customer])

  function setField<K extends keyof NewCustomerForm>(key: K, value: NewCustomerForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!customer) return
    if (!form.name?.trim()) {
      toast.error(ka.nameRequired)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name?.trim(),
          type: form.type,
          contactPerson: form.contactPerson || null,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          paymentTerms: form.paymentTerms || null,
          creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
          grade: form.grade || null,
          notes: form.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? dict.common.saveFailed)
        return
      }
      toast.success(ka.customerUpdated)
      onSuccess()
      onClose()
    } catch {
      toast.error(ka.networkError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!customer} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-500" />
            {ka.editCustomer}
            {customer && (
              <Badge variant="outline" className="font-mono text-xs ml-1">
                {customer.code}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>{ka.customerName} <span className="text-red-500">*</span></Label>
              <Input
                value={form.name ?? ''}
                onChange={e => setField('name', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ka.customerType}</Label>
              <Select
                value={form.type ?? ''}
                onValueChange={v => setField('type', v as CustomerType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ka.selectType} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NURSING_HOME">{ka.typeNursingHome}</SelectItem>
                  <SelectItem value="CARE_HOME">{ka.typeCareHome}</SelectItem>
                  <SelectItem value="ELDERLY_HOME">{ka.typeElderlyHome}</SelectItem>
                  <SelectItem value="SOCIAL_WELFARE">{ka.typeSocialWelfare}</SelectItem>
                  <SelectItem value="DAY_CARE">{ka.typeDayCare}</SelectItem>
                  <SelectItem value="HOME_CARE">{ka.typeHomeCare}</SelectItem>
                  <SelectItem value="HOSPITAL">{ka.typeHospital}</SelectItem>
                  <SelectItem value="DISTRIBUTOR">{ka.typeDistributor}</SelectItem>
                  <SelectItem value="MEDICAL_CHANNEL">{ka.typeMedicalChannel}</SelectItem>
                  <SelectItem value="PHARMACY_CHANNEL">{ka.typePharmacyChannel}</SelectItem>
                  <SelectItem value="B2C_OFFICIAL">{ka.typeB2cOfficial}</SelectItem>
                  <SelectItem value="B2C_SHOPEE">{ka.typeB2cShopee}</SelectItem>
                  <SelectItem value="B2C_MOMO">{ka.typeB2cMomo}</SelectItem>
                  <SelectItem value="B2C_OTHER">{ka.typeB2cOther}</SelectItem>
                  <SelectItem value="OTHER">{ka.typeOther}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{ka.customerGrade}</Label>
              <Select
                value={form.grade ?? ''}
                onValueChange={v => setField('grade', v as CustomerGrade)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ka.selectGrade} />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{ka.contactPerson}</Label>
              <Input
                value={form.contactPerson ?? ''}
                onChange={e => setField('contactPerson', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ka.phone}</Label>
              <Input
                value={form.phone ?? ''}
                onChange={e => setField('phone', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{ka.logEmail}</Label>
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={e => setField('email', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{ka.address}</Label>
              <Input
                value={form.address ?? ''}
                onChange={e => setField('address', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{ka.paymentTerms}</Label>
              <Select
                value={form.paymentTerms ?? ''}
                onValueChange={v => setField('paymentTerms', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ka.selectPaymentTerms} />
                </SelectTrigger>
                <SelectContent>
                  {paymentOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{ka.creditLimit}</Label>
              <Input
                type="number"
                min={0}
                value={form.creditLimit ?? ''}
                onChange={e => setField('creditLimit', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{ka.notes}</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              value={form.notes ?? ''}
              onChange={e => setField('notes', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {dict.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {ka.saveChanges}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Follow-up Log Dialog ─────────────────────────────────────────────────────

interface FollowUpDialogProps {
  customer: Customer | null
  onClose: () => void
  onSuccess: () => void
}

function FollowUpDialog({ customer, onClose, onSuccess }: FollowUpDialogProps) {
  const { dict } = useI18n()
  const ka = dict.keyAccounts
  const [form, setForm] = useState<FollowUpForm>(EMPTY_FOLLOW_UP)
  const [saving, setSaving] = useState(false)
  const logTypeOptions = [
    { value: 'VISIT', label: ka.logVisit },
    { value: 'CALL', label: ka.logCall },
    { value: 'EMAIL', label: ka.logEmail },
    { value: 'LINE', label: ka.logLine },
  ]

  useEffect(() => {
    if (customer) setForm(EMPTY_FOLLOW_UP)
  }, [customer])

  function setField<K extends keyof FollowUpForm>(key: K, value: FollowUpForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!customer) return
    if (!form.content.trim()) {
      toast.error(ka.followupRequired)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logType: form.logType,
          content: form.content.trim(),
          nextFollowUpDate: form.nextFollowUpDate || null,
          logDate: new Date().toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? dict.common.createFailed)
        return
      }
      toast.success(ka.followupLogged.replace('{name}', customer.name))
      onSuccess()
      onClose()
    } catch {
      toast.error(ka.networkError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!customer} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-blue-500" />
            {ka.followupTitle}
          </DialogTitle>
          {customer && (
            <p className="text-sm text-muted-foreground pt-1">
              {ka.customerLabel}<span className="font-medium text-foreground">{customer.name}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{ka.followupMethod}</Label>
            <Select
              value={form.logType}
              onValueChange={v => setField('logType', v as FollowUpForm['logType'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {logTypeOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              {ka.followupSummary} <span className="text-red-500">*</span>
            </Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={4}
              placeholder={ka.followupContentPlaceholder}
              value={form.content}
              onChange={e => setField('content', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fu-next-date">{ka.nextFollowUpDate}</Label>
            <Input
              id="fu-next-date"
              type="date"
              value={form.nextFollowUpDate}
              onChange={e => setField('nextFollowUpDate', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {dict.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            {ka.saveRecord}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type GradeFilter = 'ALL' | 'A' | 'B' | 'C'
type RegionFilter = 'ALL' | SalesRegion

export default function KeyAccountsPage() {
  const { dict } = useI18n()
  const ka = dict.keyAccounts
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('ALL')
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('ALL')

  // Dialog states
  const [showNew, setShowNew] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [followUpTarget, setFollowUpTarget] = useState<Customer | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/customers?pageSize=100&grade=A&grade=B', {
        cache: 'no-store',
      })
      if (!res.ok) {
        toast.error(dict.common.loadFailed)
        return
      }
      // Fetch A + B grades separately since the API supports single grade param
      const [resA, resB] = await Promise.all([
        fetch('/api/customers?pageSize=100&grade=A'),
        fetch('/api/customers?pageSize=100&grade=B'),
      ])
      const [dataA, dataB] = await Promise.all([resA.json(), resB.json()])
      const combined: Customer[] = [
        ...(dataA.data ?? []),
        ...(dataB.data ?? []),
      ]
      // Deduplicate by id
      const unique = Array.from(new Map(combined.map(c => [c.id, c])).values())
      setCustomers(unique)
    } catch {
      toast.error(dict.common.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Derived filtered list
  const filtered = customers.filter(c => {
    const searchLower = search.toLowerCase()
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(searchLower) ||
      c.code.toLowerCase().includes(searchLower) ||
      (c.contactPerson ?? '').toLowerCase().includes(searchLower)

    const matchesGrade =
      gradeFilter === 'ALL' || c.grade === gradeFilter

    const matchesRegion =
      regionFilter === 'ALL' || c.region === regionFilter

    return matchesSearch && matchesGrade && matchesRegion
  })

  // Stats
  const gradeACount = customers.filter(c => c.grade === 'A').length
  const gradeBCount = customers.filter(c => c.grade === 'B').length
  const totalRevenue = customers.reduce(
    (sum, c) => sum + (c.lifetimeValue ? parseFloat(c.lifetimeValue) : 0),
    0
  )
  const totalOrders = customers.reduce((sum, c) => sum + c._count.salesOrders, 0)

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-400 fill-amber-400" />
            {dict.customersExt.keyAccount}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ka.coreCustomers.replace('{count}', String(customers.length))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowNew(true)} className="active:scale-[0.97]">
            <Plus className="h-4 w-4 mr-2" />
            {dict.common.create}
          </Button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: ka.gradeA,
            value: gradeACount,
            icon: Star,
            color: 'text-amber-500',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
          },
          {
            label: ka.gradeB,
            value: gradeBCount,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            border: 'border-blue-200',
          },
          {
            label: ka.totalOrders,
            value: totalOrders,
            icon: FileText,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
          },
          {
            label: ka.totalRevenue,
            value: formatCurrency(totalRevenue > 0 ? String(totalRevenue) : null),
            icon: TrendingUp,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            border: 'border-violet-200',
          },
        ].map(stat => (
          <div
            key={stat.label}
            className={`rounded-xl border ${stat.border} ${stat.bg} p-4 flex items-center gap-3`}
          >
            <stat.icon className={`h-5 w-5 ${stat.color} shrink-0`} />
            <div>
              <p className="text-xs text-muted-foreground leading-tight">{stat.label}</p>
              <p className={`text-xl font-bold ${stat.color} leading-tight`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={dict.customersExt.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Grade tabs */}
        <Tabs value={gradeFilter} onValueChange={v => setGradeFilter(v as GradeFilter)}>
          <TabsList>
            <TabsTrigger value="ALL">{dict.common.all}</TabsTrigger>
            <TabsTrigger value="A">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                {ka.gradeAShort}
              </span>
            </TabsTrigger>
            <TabsTrigger value="B">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                {ka.gradeBShort}
              </span>
            </TabsTrigger>
            <TabsTrigger value="C">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                {ka.gradeCShort}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Region filter */}
        <Select
          value={regionFilter}
          onValueChange={v => setRegionFilter(v as RegionFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={ka.allRegions} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{ka.allRegions}</SelectItem>
            {ALL_REGIONS.map(r => {
              const regionLabels: Record<string, string> = {
                NORTH_METRO: ka.regionNorthMetro, KEELUNG_YILAN: ka.regionKeelungYilan,
                HSINCHU_MIAOLI: ka.regionHsinchuMiaoli, TAICHUNG_AREA: ka.regionTaichungArea,
                YUNLIN_CHIAYI: ka.regionYunlinChiayi, TAINAN_KAOHSIUNG: ka.regionTainanKaohsiung,
                HUALIEN_TAITUNG: ka.regionHualienTaitung, OFFSHORE: ka.regionOffshore,
              }
              return (
                <SelectItem key={r} value={r}>
                  {regionLabels[r] ?? r}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Star className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">
            {customers.length === 0 ? dict.customersExt.noCustomers : dict.customersExt.noResults}
          </p>
          <p className="text-sm mt-1">
            {customers.length === 0
              ? ka.addFirstHint
              : ka.adjustFilter}
          </p>
          {customers.length === 0 && (
            <Button className="mt-4" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {ka.addKeyAccount}
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground -mb-2">
            {ka.showingCount.replace('{filtered}', String(filtered.length)).replace('{total}', String(customers.length))}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(c => (
              <CustomerCard
                key={c.id}
                customer={c}
                onEdit={setEditTarget}
                onFollowUp={setFollowUpTarget}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Dialogs ── */}
      <NewCustomerDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onSuccess={load}
      />

      <EditCustomerDialog
        customer={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={load}
      />

      <FollowUpDialog
        customer={followUpTarget}
        onClose={() => setFollowUpTarget(null)}
        onSuccess={load}
      />
    </div>
  )
}
