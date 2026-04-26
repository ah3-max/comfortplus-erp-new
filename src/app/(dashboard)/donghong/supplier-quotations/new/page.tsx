'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Supplier {
  id: string; name: string; code: string; country: string | null
}
interface Variant {
  id: string; variantSku: string; masterSku: string
  masterProduct: { name: string } | null
}
interface ItemRow {
  variantId: string; unitPrice: string; unit: string; packingSpec: string
}

const CURRENCIES = ['CNY', 'TWD', 'USD', 'THB', 'EUR']

export default function NewSupplierQuotationPage() {
  const router = useRouter()

  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [variants, setVariants]     = useState<Variant[]>([])
  const [saving, setSaving]         = useState(false)

  // Header form
  const [supplierId, setSupplierId]   = useState('')
  const [quotedAt, setQuotedAt]       = useState(new Date().toISOString().slice(0, 10))
  const [validFrom, setValidFrom]     = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil]   = useState('')
  const [currency, setCurrency]       = useState('CNY')
  const [incoterms, setIncoterms]     = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState('')
  const [minOrderQty, setMinOrderQty]   = useState('')
  const [notes, setNotes]             = useState('')

  // Items
  const [items, setItems] = useState<ItemRow[]>([
    { variantId: '', unitPrice: '', unit: 'pc', packingSpec: '' },
  ])

  useEffect(() => {
    fetch('/api/suppliers?showAll=true')
      .then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {})
    fetch('/api/donghong/variants?isActive=true&pageSize=100')
      .then(r => r.json())
      .then(d => setVariants(d.data ?? []))
      .catch(() => {})
  }, [])

  function addItem() {
    setItems(prev => [...prev, { variantId: '', unitPrice: '', unit: 'pc', packingSpec: '' }])
  }
  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }
  function updateItem(idx: number, field: keyof ItemRow, value: string) {
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  async function handleSave() {
    if (!supplierId) { toast.error('請選擇供應商'); return }
    if (!validUntil) { toast.error('請填寫報價有效期'); return }
    const validItems = items.filter(r => r.variantId && r.unitPrice)
    if (validItems.length === 0) { toast.error('至少需要一筆有效品項（variant + 單價）'); return }

    setSaving(true)
    try {
      // Step 1: create quotation header
      const hRes = await fetch('/api/donghong/supplier-quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          quotedAt,
          validFrom,
          validUntil,
          currency,
          incoterms:    incoterms    || undefined,
          paymentTerms: paymentTerms || undefined,
          leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
          minOrderQty:  minOrderQty  ? Number(minOrderQty)  : undefined,
          notes:        notes        || undefined,
        }),
      })
      const hData = await hRes.json()
      if (!hRes.ok) { toast.error(hData.error ?? '建立失敗'); return }
      const sqId = hData.id

      // Step 2: add items sequentially
      const warnings: string[] = []
      for (const row of validItems) {
        const iRes = await fetch(`/api/donghong/supplier-quotations/${sqId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variantId:   row.variantId,
            unitPrice:   Number(row.unitPrice),
            unit:        row.unit || 'pc',
            packingSpec: row.packingSpec || undefined,
          }),
        })
        const iData = await iRes.json()
        if (!iRes.ok) { toast.error(`品項新增失敗：${iData.error ?? ''}`); return }
        if (iData.warnings?.length) warnings.push(...iData.warnings)
      }

      if (warnings.length) toast.warning(`注意：${warnings.join('；')}`)
      toast.success(`報價草稿 ${hData.quotationNumber} 已儲存`)
      router.push(`/donghong/supplier-quotations/${sqId}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">新建供應商報價</h1>
          <p className="text-sm text-muted-foreground">建立後為草稿狀態，可繼續新增品項再啟用</p>
        </div>
      </div>

      {/* Section 1: Header */}
      <Card>
        <CardHeader><CardTitle className="text-base">報價基本資料</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1">
            <Label>供應商 *</Label>
            <Select value={supplierId} onValueChange={v => setSupplierId(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="選擇供應商..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}（{s.country ?? s.code}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>報價日期 *</Label>
            <input type="date" value={quotedAt} onChange={e => setQuotedAt(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" />
          </div>
          <div className="space-y-1">
            <Label>幣別 *</Label>
            <Select value={currency} onValueChange={v => setCurrency(v ?? 'CNY')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>有效期起 *</Label>
            <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" />
          </div>
          <div className="space-y-1">
            <Label>有效期至 *</Label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" />
          </div>
          <div className="space-y-1">
            <Label>交貨條件 (Incoterms)</Label>
            <Input placeholder="FOB Xiamen" value={incoterms} onChange={e => setIncoterms(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>付款條件</Label>
            <Input placeholder="T/T 30 days" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>交期（天）</Label>
            <Input type="number" min={0} placeholder="45" value={leadTimeDays} onChange={e => setLeadTimeDays(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>最低訂量 (MOQ)</Label>
            <Input type="number" min={0} placeholder="1000" value={minOrderQty} onChange={e => setMinOrderQty(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>備註</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="其他說明..." />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">報價明細</CardTitle>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" /> 新增品項
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3 bg-slate-50/50">
              <div className="col-span-12 sm:col-span-5 space-y-1">
                <Label className="text-xs">產地變體 *</Label>
                <Select value={row.variantId} onValueChange={v => updateItem(idx, 'variantId', v ?? '')}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="選擇 Variant..." /></SelectTrigger>
                  <SelectContent>
                    {variants.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.variantSku} — {v.masterProduct?.name ?? v.masterSku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs">單價 *</Label>
                <Input className="h-8 text-xs" type="number" min={0} step={0.0001}
                  placeholder="2.5000" value={row.unitPrice}
                  onChange={e => updateItem(idx, 'unitPrice', e.target.value)} />
              </div>
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs">單位</Label>
                <Input className="h-8 text-xs" placeholder="pc" value={row.unit}
                  onChange={e => updateItem(idx, 'unit', e.target.value)} />
              </div>
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs">包裝規格</Label>
                <Input className="h-8 text-xs" placeholder="30pc/pack" value={row.packingSpec}
                  onChange={e => updateItem(idx, 'packingSpec', e.target.value)} />
              </div>
              <div className="col-span-12 sm:col-span-1 flex items-end">
                <Button variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0"
                  disabled={items.length === 1}
                  onClick={() => removeItem(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => router.back()}>取消</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          儲存草稿
        </Button>
      </div>
    </div>
  )
}
