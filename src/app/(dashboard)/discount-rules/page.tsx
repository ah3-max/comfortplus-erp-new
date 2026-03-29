'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Plus, Percent, Tag } from 'lucide-react'
import { toast } from 'sonner'

interface DiscountRule {
  id: string; name: string; ruleType: string; discountType: string; scope: string; scopeValue: string | null
  minQty: number | null; minAmount: number | null; discountValue: number; isActive: boolean
  effectiveFrom: string | null; effectiveTo: string | null; priority: number; notes: string | null
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-slate-900' : 'bg-slate-200'}`}>
      <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

export default function DiscountRulesPage() {
  const { dict } = useI18n()
  const [rules, setRules] = useState<DiscountRule[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('SALES')
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ name: '', ruleType: 'SALES', discountType: 'PERCENTAGE', scope: 'ALL', scopeValue: '', minQty: '', minAmount: '', discountValue: '', priority: '0', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/discount-rules?ruleType=${tab}`).then(r => r.json()).then(d => setRules(d.data ?? []))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setSaving(true)
    const res = await fetch('/api/discount-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        minQty: form.minQty ? Number(form.minQty) : null,
        minAmount: form.minAmount ? Number(form.minAmount) : null,
        discountValue: Number(form.discountValue),
        priority: Number(form.priority),
        scopeValue: form.scopeValue || null,
      }),
    })
    setSaving(false)
    if (res.ok) { toast.success(dict.common.createSuccess); setDialog(false); load() }
    else toast.error(dict.common.saveFailed)
  }

  async function toggleActive(rule: DiscountRule) {
    await fetch('/api/discount-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
    })
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.discountRules.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.discountRules.subtitle}</p>
        </div>
        <Button onClick={() => { setForm({ ...form, ruleType: tab }); setDialog(true) }}>
          <Plus className="h-4 w-4 mr-1" />{dict.discountRules.newRule}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="SALES" className="gap-1.5"><Tag className="h-3.5 w-3.5" />{dict.discountRules.salesDiscount}</TabsTrigger>
          <TabsTrigger value="PURCHASE" className="gap-1.5"><Percent className="h-3.5 w-3.5" />{dict.discountRules.purchaseDiscount}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rules.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">{dict.discountRules.noRules}</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    {[dict.discountRules.colName, dict.discountRules.colDiscountType, dict.discountRules.colDiscountValue, dict.discountRules.colScope, dict.discountRules.colMinQty, dict.discountRules.colMinAmount, dict.discountRules.colPriority, dict.discountRules.colEnabled].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{r.discountType === 'PERCENTAGE' ? dict.discountRules.percentage : dict.discountRules.fixedAmount}</Badge></td>
                      <td className="px-3 py-2 font-mono">{r.discountType === 'PERCENTAGE' ? `${r.discountValue}%` : `$${Number(r.discountValue).toLocaleString()}`}</td>
                      <td className="px-3 py-2">{r.scope === 'ALL' ? dict.discountRules.scopeAll : r.scopeValue ?? r.scope}</td>
                      <td className="px-3 py-2">{r.minQty ?? '-'}</td>
                      <td className="px-3 py-2">{r.minAmount ? `$${Number(r.minAmount).toLocaleString()}` : '-'}</td>
                      <td className="px-3 py-2">{r.priority}</td>
                      <td className="px-3 py-2"><ToggleSwitch checked={r.isActive} onChange={() => toggleActive(r)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dict.discountRules.newRule}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{dict.discountRules.ruleName}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder={dict.discountRules.namePlaceholder} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{dict.discountRules.discountType}</Label>
                <Select value={form.discountType} onValueChange={(v: string | null) => setForm(f => ({ ...f, discountType: v ?? 'PERCENTAGE' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">{dict.discountRules.types.PERCENTAGE}</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">{dict.discountRules.types.FIXED_AMOUNT}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{dict.discountRules.value}</Label>
                <Input type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} className="mt-1" placeholder={form.discountType === 'PERCENTAGE' ? '5' : '100'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{dict.discountRules.minQty}</Label>
                <Input type="number" value={form.minQty} onChange={e => setForm(f => ({ ...f, minQty: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{dict.discountRules.minAmount}</Label>
                <Input type="number" value={form.minAmount} onChange={e => setForm(f => ({ ...f, minAmount: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>{dict.discountRules.priorityNote}</Label>
              <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name || !form.discountValue}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
