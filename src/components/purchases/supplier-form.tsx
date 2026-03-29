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

const paymentTermOptions = ['Net 30', 'Net 60', 'Net 90', '月結30天', '月結60天', '貨到付款', '預付']

export const purchaseTypeOptions = [
  { value: 'FINISHED_GOODS',     label: '成品採購' },
  { value: 'OEM',                label: 'OEM代工採購' },
  { value: 'PACKAGING',          label: '包材採購' },
  { value: 'RAW_MATERIAL',       label: '原物料採購' },
  { value: 'GIFT_PROMO',         label: '贈品/活動物料' },
  { value: 'LOGISTICS_SUPPLIES', label: '物流耗材採購' },
]

interface Supplier {
  id: string; code: string; name: string; contactPerson: string | null
  phone: string | null; email: string | null; address: string | null
  taxId: string | null; paymentTerms: string | null
  leadTimeDays: number | null; supplyCategories: string | null
  supplyItems: string | null; notes: string | null; isActive: boolean
}

interface Props {
  open: boolean; onClose: () => void; onSuccess: () => void
  supplier?: Supplier | null
}

interface FormData {
  name: string; contactPerson: string; phone: string; email: string
  address: string; taxId: string; paymentTerms: string
  leadTimeDays: string; supplyCategories: string[]; supplyItems: string
  notes: string; isActive: boolean
}

const empty = (): FormData => ({
  name: '', contactPerson: '', phone: '', email: '',
  address: '', taxId: '', paymentTerms: '',
  leadTimeDays: '', supplyCategories: [], supplyItems: '',
  notes: '', isActive: true,
})

export function SupplierForm({ open, onClose, onSuccess, supplier }: Props) {
  const { dict } = useI18n()
  const isEdit = !!supplier
  const [form, setForm] = useState<FormData>(empty())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && supplier) {
      setForm({
        name:             supplier.name,
        contactPerson:    supplier.contactPerson  ?? '',
        phone:            supplier.phone          ?? '',
        email:            supplier.email          ?? '',
        address:          supplier.address        ?? '',
        taxId:            supplier.taxId          ?? '',
        paymentTerms:     supplier.paymentTerms   ?? '',
        leadTimeDays:     supplier.leadTimeDays   != null ? String(supplier.leadTimeDays) : '',
        supplyCategories: supplier.supplyCategories ? JSON.parse(supplier.supplyCategories) : [],
        supplyItems:      supplier.supplyItems    ?? '',
        notes:            supplier.notes          ?? '',
        isActive:         supplier.isActive,
      })
    } else if (!open) {
      setForm(empty())
    }
  }, [open, supplier])

  function set(field: keyof FormData, value: string | boolean | string[]) {
    setForm(p => ({ ...p, [field]: value }))
  }

  function toggleCategory(val: string) {
    setForm(p => ({
      ...p,
      supplyCategories: p.supplyCategories.includes(val)
        ? p.supplyCategories.filter(c => c !== val)
        : [...p.supplyCategories, val],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { toast.error(dict.forms.supplierNameRequired); return }
    setSaving(true)
    const url    = isEdit ? `/api/suppliers/${supplier!.id}` : '/api/suppliers'
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        leadTimeDays:     form.leadTimeDays ? Number(form.leadTimeDays) : null,
        supplyCategories: form.supplyCategories.length > 0 ? JSON.stringify(form.supplyCategories) : null,
        supplyItems:      form.supplyItems || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(isEdit ? dict.forms.supplierUpdated : dict.forms.supplierCreated)
      onSuccess(); onClose()
    } else {
      const data = await res.json()
      toast.error(data.error ?? dict.common.operationFailed)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯供應商' : '新增供應商'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">

          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">基本資料</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>供應商名稱 <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="供應商全名" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>聯絡人</Label>
                  <Input value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} placeholder="聯絡窗口姓名" />
                </div>
                <div className="space-y-1.5">
                  <Label>電話</Label>
                  <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="02-XXXX-XXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="vendor@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>統一編號</Label>
                  <Input value={form.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="12345678" maxLength={8} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>地址</Label>
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="供應商地址" />
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">合作條件</p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>付款條件</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)}>
                    <option value="">選擇付款條件</option>
                    {paymentTermOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>交期天數</Label>
                  <div className="relative">
                    <Input type="number" value={form.leadTimeDays}
                      onChange={(e) => set('leadTimeDays', e.target.value)}
                      placeholder="0" min={0} className="pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">天</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>採購分類</Label>
                <div className="flex flex-wrap gap-2">
                  {purchaseTypeOptions.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => toggleCategory(opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        form.supplyCategories.includes(opt.value)
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>供應品項</Label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2} value={form.supplyItems} onChange={(e) => set('supplyItems', e.target.value)}
                  placeholder="可供應的具體品項描述（如：L號尿布 / 透氣型成人紙尿褲...）" />
              </div>
            </div>
          </section>

          <Separator />

          <div className="space-y-1.5">
            <Label>備註</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="備註事項..." />
          </div>

          {isEdit && (
            <>
              <Separator />
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">啟用狀態</p>
                  <p className="text-xs text-muted-foreground">停用後不影響已建立的採購單</p>
                </div>
                <button type="button"
                  onClick={() => set('isActive', !form.isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>取消</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? '儲存變更' : '新增供應商'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
