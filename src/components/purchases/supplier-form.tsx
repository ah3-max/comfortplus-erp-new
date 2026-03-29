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

// Static payment term values — stored in DB as-is; display labels come from i18n
const PAYMENT_TERM_VALUES = ['Net 30', 'Net 60', 'Net 90', '月結30天', '月結60天', '貨到付款', '預付'] as const
type PaymentTermValue = typeof PAYMENT_TERM_VALUES[number]

// Static export for backward compat with other pages
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
  const fl = dict.formLabels
  const isEdit = !!supplier
  const [form, setForm] = useState<FormData>(empty())
  const [saving, setSaving] = useState(false)

  const purchaseTypeOptionsI18n = [
    { value: 'FINISHED_GOODS',     label: fl.ptFinishedGoods },
    { value: 'OEM',                label: fl.ptOem },
    { value: 'PACKAGING',          label: fl.ptPackaging },
    { value: 'RAW_MATERIAL',       label: fl.ptRawMaterial },
    { value: 'GIFT_PROMO',         label: fl.ptGiftPromo },
    { value: 'LOGISTICS_SUPPLIES', label: fl.ptLogisticsSupplies },
  ]

  const paymentTermLabelMap: Record<PaymentTermValue, string> = {
    'Net 30':   fl.paymentTermNet30,
    'Net 60':   fl.paymentTermNet60,
    'Net 90':   fl.paymentTermNet90,
    '月結30天': fl.paymentTermMonthly30,
    '月結60天': fl.paymentTermMonthly60,
    '貨到付款': fl.paymentTermCOD,
    '預付':     fl.paymentTermPrepaid,
  }

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
          <DialogTitle>{isEdit ? fl.editSupplier : fl.newSupplier}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">

          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionBasic}</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{fl.supplierName}</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={fl.supplierNamePlaceholder} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{fl.contactPerson}</Label>
                  <Input value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} placeholder={fl.contactPersonPlaceholder} />
                </div>
                <div className="space-y-1.5">
                  <Label>{fl.supplierPhone}</Label>
                  <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="02-XXXX-XXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>{fl.supplierEmail}</Label>
                  <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="vendor@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>{fl.supplierTaxId}</Label>
                  <Input value={form.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="12345678" maxLength={8} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{fl.supplierAddress}</Label>
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder={fl.supplierAddressPlaceholder} />
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fl.sectionCoopTerms}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{fl.supplierPaymentTerms}</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)}>
                    <option value="">{fl.selectPaymentTerms}</option>
                    {PAYMENT_TERM_VALUES.map(t => <option key={t} value={t}>{paymentTermLabelMap[t]}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{fl.leadTimeDays}</Label>
                  <div className="relative">
                    <Input type="number" value={form.leadTimeDays}
                      onChange={(e) => set('leadTimeDays', e.target.value)}
                      placeholder="0" min={0} className="pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{fl.dayUnit}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{fl.supplyCategories}</Label>
                <div className="flex flex-wrap gap-2">
                  {purchaseTypeOptionsI18n.map(opt => (
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
                <Label>{fl.supplyItems}</Label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2} value={form.supplyItems} onChange={(e) => set('supplyItems', e.target.value)}
                  placeholder={fl.supplyItemsPlaceholder} />
              </div>
            </div>
          </section>

          <Separator />

          <div className="space-y-1.5">
            <Label>{fl.notes}</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder={fl.supplierNotesPlaceholder} />
          </div>

          {isEdit && (
            <>
              <Separator />
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{fl.activeStatus}</p>
                  <p className="text-xs text-muted-foreground">{fl.activeStatusDesc}</p>
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
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{fl.cancel}</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? fl.saveChanges : fl.newSupplier}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
