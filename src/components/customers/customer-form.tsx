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

export const customerTypes = [
  { value: 'NURSING_HOME',     label: '護理之家' },
  { value: 'CARE_HOME',        label: '養老院' },
  { value: 'ELDERLY_HOME',     label: '老福法養老院' },
  { value: 'SOCIAL_WELFARE',   label: '社團法人長照機構' },
  { value: 'DAY_CARE',         label: '日照中心' },
  { value: 'HOME_CARE',        label: '居家服務單位' },
  { value: 'HOSPITAL',         label: '醫院/診所' },
  { value: 'DISTRIBUTOR',      label: '經銷商' },
  { value: 'MEDICAL_CHANNEL',  label: '醫材通路' },
  { value: 'PHARMACY_CHANNEL', label: '藥局通路' },
  { value: 'OTHER',            label: '其他' },
]

export const orgLevelOptions = [
  { value: 'HEADQUARTERS', label: '總部' },
  { value: 'BRANCH',       label: '分院/分館' },
  { value: 'STANDALONE',   label: '單一機構' },
]

export const devStatusOptions = [
  { value: 'POTENTIAL',         label: '潛在客戶' },
  { value: 'CONTACTED',         label: '已接觸' },
  { value: 'VISITED',           label: '已拜訪' },
  { value: 'NEGOTIATING',       label: '洽談中' },
  { value: 'TRIAL',             label: '試用中' },
  { value: 'CLOSED',            label: '已成交' },
  { value: 'STABLE_REPURCHASE', label: '穩定回購' },
  { value: 'DORMANT',           label: '休眠' },
  { value: 'CHURNED',           label: '流失' },
  { value: 'REJECTED',          label: '確定拒絕' },
  { value: 'OTHER',             label: '其他' },
]
export const sourceOptions = [
  { value: 'COLD_CALL',   label: '陌生開發' },
  { value: 'REFERRAL',    label: '介紹' },
  { value: 'EXHIBITION',  label: '展會' },
  { value: 'ADVERTISING', label: '廣告' },
  { value: 'WEBSITE',     label: '官網' },
]
// 業務區域 (對應 SalesRegion enum)
export const regionOptions = [
  { value: 'NORTH_METRO',       label: '北北桃（台北市・新北市・桃園市）' },
  { value: 'KEELUNG_YILAN',     label: '基隆宜蘭（基隆市・宜蘭縣）' },
  { value: 'HSINCHU_MIAOLI',    label: '新竹苗栗（新竹縣市・苗栗縣）' },
  { value: 'TAICHUNG_AREA',     label: '台中彰化南投' },
  { value: 'YUNLIN_CHIAYI',     label: '雲林嘉義（雲林縣・嘉義縣市）' },
  { value: 'TAINAN_KAOHSIUNG',  label: '台南高屏（台南市・高雄市・屏東縣）' },
  { value: 'HUALIEN_TAITUNG',   label: '花東（花蓮縣・台東縣）' },
  { value: 'OFFSHORE',          label: '離島（澎湖・金門・馬祖）' },
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
  // new fields
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
  // new fields
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

function SelField({ label, value, options, onChange, placeholder = '請選擇', required }: {
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
  const isEdit = !!customer
  const [form, setForm] = useState<FormData>(empty())
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(false)

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
        <DialogHeader><DialogTitle>{isEdit ? '編輯客戶' : '新增客戶'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── 機構基本分類 ── */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">機構分類</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>客戶名稱 <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="請輸入客戶名稱（機構全名）" required />
              </div>
              <SelField label="客戶類型 *" value={form.type} options={customerTypes} onChange={v => set('type', v)} required placeholder="選擇類型" />
              <SelField label="客戶層級" value={form.orgLevel} options={orgLevelOptions} onChange={v => set('orgLevel', v)} placeholder="單一機構 / 總部 / 分院" />

              <div className="col-span-2 space-y-1.5">
                <Label>分院/館別名稱</Label>
                <Input value={form.branchName} onChange={e => set('branchName', e.target.value)} placeholder="若為分院，填入分院名稱（如：板橋分院）" />
              </div>

              {/* 是否社團法人 */}
              <div className="col-span-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">是否為社團法人</p>
                    <p className="text-xs text-muted-foreground">如：財團法人、社團法人長照機構</p>
                  </div>
                  <button type="button" onClick={() => set('isCorporateFoundation', !form.isCorporateFoundation)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isCorporateFoundation ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isCorporateFoundation ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {form.isCorporateFoundation && (
                <div className="col-span-2 space-y-1.5">
                  <Label>社團法人名稱</Label>
                  <Input value={form.corporateFoundationName} onChange={e => set('corporateFoundationName', e.target.value)} placeholder="如：社團法人台灣長照機構協會" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>床數</Label>
                <Input type="number" value={form.bedCount} onChange={e => set('bedCount', e.target.value)} placeholder="機構床位數" min={0} />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── 聯絡資訊 ── */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">聯絡資訊</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>主要聯絡人</Label>
                <Input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="主要聯絡人姓名" /></div>
              <div className="space-y-1.5"><Label>電話</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="02-XXXX-XXXX" /></div>
              <div className="space-y-1.5"><Label>LINE ID</Label>
                <Input value={form.lineId} onChange={e => set('lineId', e.target.value)} placeholder="@line_id" /></div>
              <div className="space-y-1.5"><Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@example.com" /></div>
              <div className="col-span-2 space-y-1.5">
                <Label>完整地址</Label>
                <Input value={form.address} onChange={e => {
                  set('address', e.target.value)
                  const detected = detectRegionFromAddress(e.target.value)
                  if (detected && !form.region) set('region', detected)
                }} placeholder="完整地址（含縣市區路號）" />
                <p className="text-xs text-muted-foreground">輸入地址後系統自動帶出區域</p>
              </div>
              <div className="col-span-2">
                <SelField label="所屬業務區域" value={form.region} options={regionOptions} onChange={v => set('region', v)} />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── 業務資訊 ── */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">業務資訊</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelField label="開發狀態" value={form.devStatus} options={devStatusOptions} onChange={v => set('devStatus', v)} />
              <div className="space-y-1.5">
                <Label>客戶等級</Label>
                <div className="flex gap-1.5">
                  {[
                    { g: 'A', cls: 'border-amber-400 bg-amber-400 text-white',  hint: '核心大客戶' },
                    { g: 'B', cls: 'border-blue-400 bg-blue-400 text-white',    hint: '穩定客戶' },
                    { g: 'C', cls: 'border-green-500 bg-green-500 text-white',  hint: '一般客戶' },
                    { g: 'D', cls: 'border-slate-400 bg-slate-400 text-white',  hint: '低頻/觀察' },
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
                    {{ A: 'A 級：核心大客戶，優先維護', B: 'B 級：穩定成交，定期拜訪', C: 'C 級：一般客戶，按需服務', D: 'D 級：低頻客戶，觀察中' }[form.grade]}
                  </p>
                )}
              </div>
              <SelField label="客戶來源" value={form.source} options={sourceOptions} onChange={v => set('source', v)} />
              <div className="space-y-1.5">
                <Label>負責業務</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.salesRepId} onChange={e => set('salesRepId', e.target.value)}>
                  <option value="">未指派</option>
                  {salesReps.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>成交機率（%）</Label>
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
                <Label>預估月採購量（元）</Label>
                <Input type="number" value={form.estimatedMonthlyVolume}
                  onChange={e => set('estimatedMonthlyVolume', e.target.value)}
                  placeholder="0" min={0} />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── 財務資料 ── */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">財務資料</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>統一編號</Label>
                <Input value={form.taxId} onChange={e => set('taxId', e.target.value)} placeholder="12345678" maxLength={8} /></div>
              <SelField label="付款條件" value={form.paymentTerms}
                options={paymentTermOptions.map(t => ({ value: t, label: t }))} onChange={v => set('paymentTerms', v)} />
              <div className="space-y-1.5"><Label>信用額度（元）</Label>
                <Input type="number" value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} placeholder="0" min={0} /></div>
            </div>
          </section>

          <Separator />

          <div className="space-y-1.5"><Label>備註</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="備註事項、特殊需求..." /></div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <div><p className="text-sm font-medium">客戶狀態</p>
                <p className="text-xs text-muted-foreground">停用後不會出現在報價/訂單選品清單</p></div>
              <button type="button" onClick={() => set('isActive', !form.isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>取消</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? '儲存變更' : '新增客戶'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
