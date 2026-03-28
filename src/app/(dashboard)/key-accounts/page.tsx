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

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  NURSING_HOME: '護理之家',
  CARE_HOME: '養老院',
  ELDERLY_HOME: '老福養老院',
  SOCIAL_WELFARE: '社團法人長照',
  DAY_CARE: '日照中心',
  HOME_CARE: '居家服務',
  HOSPITAL: '醫院/診所',
  DISTRIBUTOR: '經銷商',
  MEDICAL_CHANNEL: '醫材通路',
  PHARMACY_CHANNEL: '藥局通路',
  B2C_OFFICIAL: '官網會員',
  B2C_SHOPEE: '蝦皮',
  B2C_MOMO: 'momo',
  B2C_OTHER: 'B2C其他',
  OTHER: '其他',
}

const GRADE_BADGE: Record<string, string> = {
  A: 'bg-amber-500 text-white hover:bg-amber-500',
  B: 'bg-blue-500 text-white hover:bg-blue-500',
  C: 'bg-emerald-500 text-white hover:bg-emerald-500',
  D: 'bg-slate-400 text-white hover:bg-slate-400',
  NONE: 'bg-slate-200 text-slate-600 hover:bg-slate-200',
}

const REGION_LABELS: Record<SalesRegion, string> = {
  NORTH_METRO: '北北桃',
  KEELUNG_YILAN: '基隆宜蘭',
  HSINCHU_MIAOLI: '新竹苗栗',
  TAICHUNG_AREA: '台中彰化南投',
  YUNLIN_CHIAYI: '雲林嘉義',
  TAINAN_KAOHSIUNG: '台南高屏',
  HUALIEN_TAITUNG: '花東',
  OFFSHORE: '離島',
}

const PAYMENT_TERMS_OPTIONS = [
  { value: 'CASH', label: '現金' },
  { value: 'NET30', label: 'NET30（月結30天）' },
  { value: 'NET45', label: 'NET45（月結45天）' },
  { value: 'NET60', label: 'NET60（月結60天）' },
]

const GRADE_OPTIONS: { value: CustomerGrade; label: string }[] = [
  { value: 'A', label: 'A — 頂級重要' },
  { value: 'B', label: 'B — 重要客戶' },
  { value: 'C', label: 'C — 一般客戶' },
  { value: 'D', label: 'D — 觀察中' },
]

const LOG_TYPE_OPTIONS = [
  { value: 'VISIT', label: '拜訪' },
  { value: 'CALL', label: '電話' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'LINE', label: 'LINE' },
]

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
  return (
    <Badge variant="outline" className="text-xs font-normal">
      {CUSTOMER_TYPE_LABELS[type] ?? type}
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
              {REGION_LABELS[customer.region] ?? customer.region}
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
            <p className="text-xs text-muted-foreground">累積訂單</p>
            <p className="text-sm font-semibold text-slate-700">
              {customer._count.salesOrders}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">總業績</p>
            <p className="text-sm font-semibold text-blue-600">
              {formatCurrency(customer.lifetimeValue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">互動次數</p>
            <p className="text-sm font-semibold text-slate-700">{interactions}</p>
          </div>
        </div>

        {/* Last order */}
        {customer.lastOrderDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>最後訂單：{formatDate(customer.lastOrderDate)}</span>
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
            查看/編輯
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            onClick={() => onFollowUp(customer)}
          >
            <Phone className="h-3.5 w-3.5 mr-1" />
            跟進記錄
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
      toast.success(`已新增客戶「${data.name}」`)
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
            新增重要客戶
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name + Code */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="nc-name">
                客戶名稱 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nc-name"
                placeholder="請輸入客戶全名"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-code">客戶代碼</Label>
              <Input
                id="nc-code"
                placeholder="留空自動產生"
                value={form.code}
                onChange={e => setField('code', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>客戶類型 <span className="text-red-500">*</span></Label>
              <Select value={form.type} onValueChange={v => setField('type', v as CustomerType)}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NURSING_HOME">護理之家</SelectItem>
                  <SelectItem value="CARE_HOME">養老院</SelectItem>
                  <SelectItem value="ELDERLY_HOME">老福養老院</SelectItem>
                  <SelectItem value="SOCIAL_WELFARE">社團法人長照</SelectItem>
                  <SelectItem value="DAY_CARE">日照中心</SelectItem>
                  <SelectItem value="HOME_CARE">居家服務</SelectItem>
                  <SelectItem value="HOSPITAL">醫院/診所</SelectItem>
                  <SelectItem value="DISTRIBUTOR">經銷商</SelectItem>
                  <SelectItem value="MEDICAL_CHANNEL">醫材通路</SelectItem>
                  <SelectItem value="PHARMACY_CHANNEL">藥局通路</SelectItem>
                  <SelectItem value="B2C_OFFICIAL">官網會員</SelectItem>
                  <SelectItem value="B2C_SHOPEE">蝦皮</SelectItem>
                  <SelectItem value="B2C_MOMO">momo</SelectItem>
                  <SelectItem value="B2C_OTHER">B2C其他</SelectItem>
                  <SelectItem value="OTHER">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-contact">聯絡人</Label>
              <Input
                id="nc-contact"
                placeholder="姓名"
                value={form.contactPerson}
                onChange={e => setField('contactPerson', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-phone">電話</Label>
              <Input
                id="nc-phone"
                placeholder="02-xxxx-xxxx"
                value={form.phone}
                onChange={e => setField('phone', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="nc-email">Email</Label>
              <Input
                id="nc-email"
                type="email"
                placeholder="contact@example.com"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="nc-address">地址</Label>
              <Input
                id="nc-address"
                placeholder="公司地址"
                value={form.address}
                onChange={e => setField('address', e.target.value)}
              />
            </div>
          </div>

          {/* Commercial */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>付款條件</Label>
              <Select
                value={form.paymentTerms}
                onValueChange={v => setField('paymentTerms', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇付款條件" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-credit">信用額度 (NT$)</Label>
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
              <Label>客戶等級</Label>
              <Select
                value={form.grade}
                onValueChange={v => setField('grade', v as CustomerGrade)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇等級" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map(o => (
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
            <Label htmlFor="nc-notes">備註</Label>
            <textarea
              id="nc-notes"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              placeholder="客戶特殊需求、背景資訊…"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            新增客戶
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
            編輯客戶資料
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
              <Label>客戶名稱 <span className="text-red-500">*</span></Label>
              <Input
                value={form.name ?? ''}
                onChange={e => setField('name', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>客戶類型</Label>
              <Select
                value={form.type ?? ''}
                onValueChange={v => setField('type', v as CustomerType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NURSING_HOME">護理之家</SelectItem>
                  <SelectItem value="CARE_HOME">養老院</SelectItem>
                  <SelectItem value="ELDERLY_HOME">老福養老院</SelectItem>
                  <SelectItem value="SOCIAL_WELFARE">社團法人長照</SelectItem>
                  <SelectItem value="DAY_CARE">日照中心</SelectItem>
                  <SelectItem value="HOME_CARE">居家服務</SelectItem>
                  <SelectItem value="HOSPITAL">醫院/診所</SelectItem>
                  <SelectItem value="DISTRIBUTOR">經銷商</SelectItem>
                  <SelectItem value="MEDICAL_CHANNEL">醫材通路</SelectItem>
                  <SelectItem value="PHARMACY_CHANNEL">藥局通路</SelectItem>
                  <SelectItem value="B2C_OFFICIAL">官網會員</SelectItem>
                  <SelectItem value="B2C_SHOPEE">蝦皮</SelectItem>
                  <SelectItem value="B2C_MOMO">momo</SelectItem>
                  <SelectItem value="B2C_OTHER">B2C其他</SelectItem>
                  <SelectItem value="OTHER">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>客戶等級</Label>
              <Select
                value={form.grade ?? ''}
                onValueChange={v => setField('grade', v as CustomerGrade)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇等級" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map(o => (
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
              <Label>聯絡人</Label>
              <Input
                value={form.contactPerson ?? ''}
                onChange={e => setField('contactPerson', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>電話</Label>
              <Input
                value={form.phone ?? ''}
                onChange={e => setField('phone', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={e => setField('email', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>地址</Label>
              <Input
                value={form.address ?? ''}
                onChange={e => setField('address', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>付款條件</Label>
              <Select
                value={form.paymentTerms ?? ''}
                onValueChange={v => setField('paymentTerms', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇付款條件" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>信用額度 (NT$)</Label>
              <Input
                type="number"
                min={0}
                value={form.creditLimit ?? ''}
                onChange={e => setField('creditLimit', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>備註</Label>
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
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            儲存變更
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
      toast.success(`已記錄「${customer.name}」的跟進`)
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
            跟進記錄
          </DialogTitle>
          {customer && (
            <p className="text-sm text-muted-foreground pt-1">
              客戶：<span className="font-medium text-foreground">{customer.name}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>跟進方式</Label>
            <Select
              value={form.logType}
              onValueChange={v => setField('logType', v as FollowUpForm['logType'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOG_TYPE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              跟進摘要 <span className="text-red-500">*</span>
            </Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={4}
              placeholder="本次聯繫重點、客戶反應、後續事項…"
              value={form.content}
              onChange={e => setField('content', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fu-next-date">下次追蹤日期</Label>
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
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            儲存記錄
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
            A / B 級核心客戶 — 共 {customers.length} 位
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
            label: 'A 級客戶',
            value: gradeACount,
            icon: Star,
            color: 'text-amber-500',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
          },
          {
            label: 'B 級客戶',
            value: gradeBCount,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            border: 'border-blue-200',
          },
          {
            label: '累積訂單',
            value: totalOrders,
            icon: FileText,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
          },
          {
            label: '總業績',
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
                A 級
              </span>
            </TabsTrigger>
            <TabsTrigger value="B">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                B 級
              </span>
            </TabsTrigger>
            <TabsTrigger value="C">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                C 級
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
            <SelectValue placeholder="所有區域" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">所有區域</SelectItem>
            {ALL_REGIONS.map(r => (
              <SelectItem key={r} value={r}>
                {REGION_LABELS[r]}
              </SelectItem>
            ))}
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
              ? '點擊「新增重要客戶」開始建立'
              : '請調整篩選條件後再試'}
          </p>
          {customers.length === 0 && (
            <Button className="mt-4" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新增重要客戶
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground -mb-2">
            顯示 {filtered.length} / {customers.length} 位客戶
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
