'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

// Static exports kept for backward-compat (pages that can't call hooks).
// Labels here are English fallbacks; components with useI18n() use dict.formLabels variants below.
export const customerTypes = [
  { value: 'NURSING_HOME',     label: 'Nursing Home' },
  { value: 'CARE_HOME',        label: 'Care Home' },
  { value: 'ELDERLY_HOME',     label: 'Elderly Home' },
  { value: 'SOCIAL_WELFARE',   label: 'Social Welfare LTC' },
  { value: 'DAY_CARE',         label: 'Day Care Center' },
  { value: 'HOME_CARE',        label: 'Home Care' },
  { value: 'HOSPITAL',         label: 'Hospital/Clinic' },
  { value: 'DISTRIBUTOR',      label: 'Distributor' },
  { value: 'MEDICAL_CHANNEL',  label: 'Medical Channel' },
  { value: 'PHARMACY_CHANNEL', label: 'Pharmacy Channel' },
  { value: 'OTHER',            label: 'Other' },
]

export const orgLevelOptions = [
  { value: 'HEADQUARTERS', label: 'Headquarters' },
  { value: 'BRANCH',       label: 'Branch' },
  { value: 'STANDALONE',   label: 'Standalone' },
]

export const devStatusOptions = [
  { value: 'POTENTIAL',         label: 'Potential' },
  { value: 'CONTACTED',         label: 'Contacted' },
  { value: 'VISITED',           label: 'Visited' },
  { value: 'NEGOTIATING',       label: 'Negotiating' },
  { value: 'TRIAL',             label: 'Trial' },
  { value: 'CLOSED',            label: 'Closed' },
  { value: 'STABLE_REPURCHASE', label: 'Stable Repurchase' },
  { value: 'DORMANT',           label: 'Dormant' },
  { value: 'CHURNED',           label: 'Churned' },
  { value: 'REJECTED',          label: 'Rejected' },
  { value: 'OTHER',             label: 'Other' },
]
export const sourceOptions = [
  { value: 'COLD_CALL',   label: 'Cold Call' },
  { value: 'REFERRAL',    label: 'Referral' },
  { value: 'EXHIBITION',  label: 'Exhibition' },
  { value: 'ADVERTISING', label: 'Advertising' },
  { value: 'WEBSITE',     label: 'Website' },
]
export const regionOptions = [
  { value: 'NORTH_METRO',       label: 'North Metro (Taipei/New Taipei/Taoyuan)' },
  { value: 'KEELUNG_YILAN',     label: 'Keelung/Yilan' },
  { value: 'HSINCHU_MIAOLI',    label: 'Hsinchu/Miaoli' },
  { value: 'TAICHUNG_AREA',     label: 'Taichung/Changhua/Nantou' },
  { value: 'YUNLIN_CHIAYI',     label: 'Yunlin/Chiayi' },
  { value: 'TAINAN_KAOHSIUNG',  label: 'Tainan/Kaohsiung/Pingtung' },
  { value: 'HUALIEN_TAITUNG',   label: 'Hualien/Taitung' },
  { value: 'OFFSHORE',          label: 'Offshore Islands' },
]

// 縣市 → SalesRegion 自動對應表
export const CITY_TO_REGION: Record<string, string> = {
  '台北市': 'NORTH_METRO',   '臺北市': 'NORTH_METRO',
  '新北市': 'NORTH_METRO',   '桃園市': 'NORTH_METRO',
  '基隆市': 'KEELUNG_YILAN', '宜蘭縣': 'KEELUNG_YILAN',
  '新竹市': 'HSINCHU_MIAOLI','新竹縣': 'HSINCHU_MIAOLI','苗栗縣': 'HSINCHU_MIAOLI',
  '台中市': 'TAICHUNG_AREA', '臺中市': 'TAICHUNG_AREA',
  '彰化縣': 'TAICHUNG_AREA', '南投縣': 'TAICHUNG_AREA',
  '雲林縣': 'YUNLIN_CHIAYI', '嘉義市': 'YUNLIN_CHIAYI','嘉義縣': 'YUNLIN_CHIAYI',
  '台南市': 'TAINAN_KAOHSIUNG','臺南市': 'TAINAN_KAOHSIUNG',
  '高雄市': 'TAINAN_KAOHSIUNG','屏東縣': 'TAINAN_KAOHSIUNG',
  '花蓮縣': 'HUALIEN_TAITUNG','台東縣': 'HUALIEN_TAITUNG','臺東縣': 'HUALIEN_TAITUNG',
  '澎湖縣': 'OFFSHORE',      '金門縣': 'OFFSHORE',      '連江縣': 'OFFSHORE',
}

export function detectRegionFromAddress(address: string): string {
  for (const [city, region] of Object.entries(CITY_TO_REGION)) {
    if (address.includes(city)) return region
  }
  return ''
}

const paymentTermOptions = ['NET30', 'NET45', 'NET60', '月結30天', '月結60天', '現金', '預付']

interface SalesRep { id: string; name: string }
interface Customer {
  id: string; code: string; name: string; type: string
  contactPerson: string | null; phone: string | null; lineId: string | null
  email: string | null; address: string | null; region: string | null
  taxId: string | null; paymentTerms: string | null; creditLimit: string | null
  grade: string | null; devStatus: string; source: string | null
  salesRepId: string | null; winRate: number | null
  estimatedMonthlyVolume: string | null; notes: string | null; isActive: boolean
  isCorporateFoundation?: boolean
  corporateFoundationName?: string | null
  branchName?: string | null
  orgLevel?: string | null
  bedCount?: number | null
}
interface Props {
  open: boolean; onClose: () => void; onSuccess: () => void
  customer?: Customer | null
}
interface FormData {
  name: string; type: string; contactPerson: string
  phone: string; lineId: string; email: string; address: string; region: string
  taxId: string; paymentTerms: string; creditLimit: string
  grade: string; devStatus: string; source: string; salesRepId: string
  winRate: string; estimatedMonthlyVolume: string
  notes: string; isActive: boolean
  isCorporateFoundation: boolean
  corporateFoundationName: string
  branchName: string
  orgLevel: string
  bedCount: string
}

const empty = (): FormData => ({
  name: '', type: '', contactPerson: '',
  phone: '', lineId: '', email: '', address: '', region: '',
  taxId: '', paymentTerms: '', creditLimit: '',
  grade: '', devStatus: 'POTENTIAL', source: '', salesRepId: '',
  winRate: '', estimatedMonthlyVolume: '',
  notes: '', isActive: true,
  isCorporateFoundation: false,
  corporateFoundationName: '',
  branchName: '',
  orgLevel: '',
  bedCount: '',
})

function SelField({ label, value, options, onChange, placeholder, required }: {
  label: string; value: string; options: { value: string; label: string }[]
  onChange: (v: string) => void; placeholder?: string; required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      <select
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={value} onChange={e => onChange(e.target.value)} required={required}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function CustomerForm({ open, onClose, onSuccess, customer }: Props) {
  const { dict } = useI18n()
  const fl = dict.formLabels
  const isEdit = !!customer
  const [form, setForm] = useState<FormData>(empty())
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(false)

  const customerTypes = [
    { value: 'NURSING_HOME',     label: fl.typeNursingHome },
    { value: 'CARE_HOME',        label: fl.typeCareHome },
    { value: 'ELDERLY_HOME',     label: fl.typeElderlyHome },
    { value: 'SOCIAL_WELFARE',   label: fl.typeSocialWelfare },
    { value: 'DAY_CARE',         label: fl.typeDayCare },
    { value: 'HOME_CARE',        label: fl.typeHomeCare },
    { value: 'HOSPITAL',         label: fl.typeHospital },
    { value: 'DISTRIBUTOR',      label: fl.typeDistributor },
    { value: 'MEDICAL_CHANNEL',  label: fl.typeMedicalChannel },
    { value: 'PHARMACY_CHANNEL', label: fl.typePharmacyChannel },
    { value: 'OTHER',            label: fl.typeOther },
  ]

  const orgLevelOptions = [
    { value: 'HEADQUARTERS', label: fl.orgHeadquarters },
    { value: 'BRANCH',       label: fl.orgBranch },
    { value: 'STANDALONE',   label: fl.orgStandalone },
  ]

  const devStatusOptions = [
    { value: 'POTENTIAL',         label: fl.devPotential },
    { value: 'CONTACTED',         label: fl.devContacted },
    { value: 'VISITED',           label: fl.devVisited },
    { value: 'NEGOTIATING',       label: fl.devNegotiating },
    { value: 'TRIAL',             label: fl.devTrial },
    { value: 'CLOSED',            label: fl.devClosed },
    { value: 'STABLE_REPURCHASE', label: fl.devStableRepurchase },
    { value: 'DORMANT',           label: fl.devDormant },
    { value: 'CHURNED',           label: fl.devChurned },
    { value: 'REJECTED',          label: fl.devRejected },
    { value: 'OTHER',             label: fl.devOther },
  ]

  const sourceOptions = [
    { value: 'COLD_CALL',   label: fl.sourceColdCall },
    { value: 'REFERRAL',    label: fl.sourceReferral },
    { value: 'EXHIBITION',  label: fl.sourceExhibition },
    { value: 'ADVERTISING', label: fl.sourceAdvertising },
    { value: 'WEBSITE',     label: fl.sourceWebsite },
  ]

  const regionOptions = [
    { value: 'NORTH_METRO',       label: fl.regionNorthMetro },
    { value: 'KEELUNG_YILAN',     label: fl.regionKeelungYilan },
    { value: 'HSINCHU_MIAOLI',    label: fl.regionHsinchuMiaoli },
    { value: 'TAICHUNG_AREA',     label: fl.regionTaichungArea },
    { value: 'YUNLIN_CHIAYI',     label: fl.regionYunlinChiayi },
    { value: 'TAINAN_KAOHSIUNG',  label: fl.regionTainanKaohsiung },
    { value: 'HUALIEN_TAITUNG',   label: fl.regionHualienTaitung },
    { value: 'OFFSHORE',          label: fl.regionOffshore },
  ]

  const gradeHints: Record<string, string> = {
    A: fl.gradeA,
    B: fl.gradeB,
    C: fl.gradeC,
    D: fl.gradeD,
  }

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then((d: { id: string; name: string; role: string }[]) =>
        setSalesReps(Array.isArray(d)
          ? d.filter(u => ['SALES','SALES_MANAGER','GM','SUPER_ADMIN'].includes(u.role))
             .map(u => ({ id: u.id, name: u.name }))
          : [])
      ).catch(() => {})
  }, [])

  useEffect(() => {
    if (open && customer) {
      setForm({
        name: customer.name, type: customer.type,
        contactPerson: customer.contactPerson ?? '',
        phone: customer.phone ?? '', lineId: customer.lineId ?? '',
        email: customer.email ?? '', address: customer.address ?? '',
        region: customer.region ?? '', taxId: customer.taxId ?? '',
        paymentTerms: customer.paymentTerms ?? '', creditLimit: customer.creditLimit ?? '',
        grade: customer.grade ?? '', devStatus: customer.devStatus ?? 'POTENTIAL',
        source: customer.source ?? '', salesRepId: customer.salesRepId ?? '',
        winRate: customer.winRate != null ? String(customer.winRate) : '',
        estimatedMonthlyVolume: customer.estimatedMonthlyVolume ?? '',
        notes: customer.notes ?? '', isActive: customer.isActive,
        isCorporateFoundation: customer.isCorporateFoundation ?? false,
        corporateFoundationName: customer.corporateFoundationName ?? '',
        branchName: customer.branchName ?? '',
        orgLevel: customer.orgLevel ?? '',
        bedCount: customer.bedCount != null ? String(customer.bedCount) : '',
      })
    } else if (!open) { setForm(empty()) }
  }, [open, customer])

  function set(field: keyof FormData, value: string | boolean) {
    setForm(p => ({ ...p, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.type) { toast.error(dict.forms.customerNameTypeRequired); return }
    setLoading(true)
    const res = await fetch(isEdit ? `/api/customers/${customer!.id}` : '/api/customers', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) { toast.success(isEdit ? dict.forms.customerUpdated : dict.forms.customerCreated); onSuccess(); onClose() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.operationFailed) }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? fl.editCustomer : fl.newCustomer}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 機構基本分類 */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionOrgClass}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>{fl.customerName} <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder={fl.customerNamePlaceholder} required />
              </div>
              <SelField label={fl.customerType} value={form.type} options={customerTypes} onChange={v => set('type', v)} required placeholder={fl.customerTypeSelectPlaceholder} />
              <SelField label={fl.customerLevel} value={form.orgLevel} options={orgLevelOptions} onChange={v => set('orgLevel', v)} placeholder={fl.customerLevelPlaceholder} />

              <div className="col-span-2 space-y-1.5">
                <Label>{fl.branchName}</Label>
                <Input value={form.branchName} onChange={e => set('branchName', e.target.value)} placeholder={fl.branchNamePlaceholder} />
              </div>

              <div className="col-span-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{fl.isCorporateFoundation}</p>
                    <p className="text-xs text-muted-foreground">{fl.isCorporateFoundationDesc}</p>
                  </div>
                  <button type="button" onClick={() => set('isCorporateFoundation', !form.isCorporateFoundation)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isCorporateFoundation ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isCorporateFoundation ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {form.isCorporateFoundation && (
                <div className="col-span-2 space-y-1.5">
                  <Label>{fl.corporateFoundationName}</Label>
                  <Input value={form.corporateFoundationName} onChange={e => set('corporateFoundationName', e.target.value)} placeholder={fl.corporateFoundationNamePlaceholder} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>{fl.bedCount}</Label>
                <Input type="number" value={form.bedCount} onChange={e => set('bedCount', e.target.value)} placeholder={fl.bedCountPlaceholder} min={0} />
              </div>
            </div>
          </section>

          <Separator />

          {/* 聯絡資訊 */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionContact}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>{fl.mainContact}</Label>
                <Input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder={fl.mainContactPlaceholder} /></div>
              <div className="space-y-1.5"><Label>{fl.phone}</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0912-345-678" /></div>
              <div className="space-y-1.5"><Label>{fl.lineId}</Label>
                <Input value={form.lineId} onChange={e => set('lineId', e.target.value)} placeholder="@line_id" /></div>
              <div className="space-y-1.5"><Label>{fl.email}</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@example.com" /></div>
              <div className="col-span-2 space-y-1.5">
                <Label>{fl.fullAddress}</Label>
                <Input value={form.address} onChange={e => {
                  set('address', e.target.value)
                  const detected = detectRegionFromAddress(e.target.value)
                  if (detected && !form.region) set('region', detected)
                }} placeholder={fl.fullAddressPlaceholder} />
                <p className="text-xs text-muted-foreground">{fl.autoRegionHint}</p>
              </div>
              <div className="col-span-2">
                <SelField label={fl.salesRegion} value={form.region} options={regionOptions} onChange={v => set('region', v)} />
              </div>
            </div>
          </section>

          <Separator />

          {/* 業務資訊 */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionSales}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelField label={fl.devStatus} value={form.devStatus} options={devStatusOptions} onChange={v => set('devStatus', v)} />
              <div className="space-y-1.5">
                <Label>{fl.customerGrade}</Label>
                <div className="flex gap-1.5">
                  {[
                    { g: 'A', cls: 'border-amber-400 bg-amber-400 text-white',  hint: fl.gradeAHint },
                    { g: 'B', cls: 'border-blue-400 bg-blue-400 text-white',    hint: fl.gradeBHint },
                    { g: 'C', cls: 'border-green-500 bg-green-500 text-white',  hint: fl.gradeCHint },
                    { g: 'D', cls: 'border-slate-400 bg-slate-400 text-white',  hint: fl.gradeDHint },
                  ].map(({ g, cls, hint }) => (
                    <button key={g} type="button" title={hint}
                      onClick={() => set('grade', form.grade === g ? '' : g)}
                      className={`flex-1 rounded-md border py-2 text-sm font-bold transition-colors ${
                        form.grade === g ? cls : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}>{g}</button>
                  ))}
                </div>
                {form.grade && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {gradeHints[form.grade]}
                  </p>
                )}
              </div>
              <SelField label={fl.customerSource} value={form.source} options={sourceOptions} onChange={v => set('source', v)} />
              <div className="space-y-1.5">
                <Label>{fl.salesRepLabel}</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.salesRepId} onChange={e => set('salesRepId', e.target.value)}>
                  <option value="">{fl.unassigned}</option>
                  {salesReps.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{fl.winRate}</Label>
                <div className="relative">
                  <Input type="number" value={form.winRate}
                    onChange={e => set('winRate', e.target.value)}
                    placeholder="0" min={0} max={100} className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
                {form.winRate && (
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(Number(form.winRate), 100)}%`,
                        backgroundColor: Number(form.winRate) >= 70 ? '#22c55e' : Number(form.winRate) >= 40 ? '#f59e0b' : '#94a3b8' }} />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{fl.estimatedMonthlyVolume}</Label>
                <Input type="number" value={form.estimatedMonthlyVolume}
                  onChange={e => set('estimatedMonthlyVolume', e.target.value)}
                  placeholder="0" min={0} />
              </div>
            </div>
          </section>

          <Separator />

          {/* 財務資料 */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionFinance}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>{fl.taxId}</Label>
                <Input value={form.taxId} onChange={e => set('taxId', e.target.value)} placeholder="12345678" maxLength={8} /></div>
              <SelField label={fl.paymentTerms} value={form.paymentTerms}
                options={paymentTermOptions.map(t => ({ value: t, label: t }))} onChange={v => set('paymentTerms', v)} />
              <div className="space-y-1.5"><Label>{fl.creditLimit}</Label>
                <Input type="number" value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} placeholder="0" min={0} /></div>
            </div>
          </section>

          <Separator />

          <div className="space-y-1.5"><Label>{fl.notes}</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={fl.notesPlaceholder} /></div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <div><p className="text-sm font-medium">{fl.customerStatus}</p>
                <p className="text-xs text-muted-foreground">{fl.customerStatusDesc}</p></div>
              <button type="button" onClick={() => set('isActive', !form.isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{fl.cancel}</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? fl.saveChanges : fl.newCustomer}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
