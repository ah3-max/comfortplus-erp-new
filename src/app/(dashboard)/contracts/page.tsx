'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, RefreshCw, AlertTriangle, CheckCircle2, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaySchedule {
  id: string
  dueDate: string
  amount: number
  description: string | null
  isPaid: boolean
  paidAt: string | null
}

interface ContractBase {
  id: string
  contractNo: string
  title: string
  contractType: string
  status: string
  currency: string
  totalValue: number | null
  effectiveFrom: string
  effectiveTo: string
  signedAt: string | null
  paymentTerms: string | null
  autoRenew: boolean
  reminderDays: number
  notes: string | null
  createdAt: string
  customer: { id: string; name: string; code: string } | null
  supplier: { id: string; name: string; code: string } | null
  createdBy: { id: string; name: string }
  schedules: PaySchedule[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT:      'secondary',
  ACTIVE:     'default',
  EXPIRED:    'outline',
  TERMINATED: 'destructive',
  RENEWED:    'secondary',
}

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(n) : '—'

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ─── Edit Form State ──────────────────────────────────────────────────────────

interface EditForm {
  title: string
  contractType: string
  effectiveFrom: string
  effectiveTo: string
  totalValue: string
  paymentTerms: string
  notes: string
}

const emptyEditForm: EditForm = {
  title: '', contractType: 'SALES', effectiveFrom: '', effectiveTo: '',
  totalValue: '', paymentTerms: '', notes: '',
}

function contractToEditForm(c: ContractBase): EditForm {
  return {
    title: c.title,
    contractType: c.contractType,
    effectiveFrom: c.effectiveFrom.slice(0, 10),
    effectiveTo: c.effectiveTo.slice(0, 10),
    totalValue: c.totalValue != null ? String(c.totalValue) : '',
    paymentTerms: c.paymentTerms ?? '',
    notes: c.notes ?? '',
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const { dict } = useI18n()
  const ct = dict.contracts
  const STATUS_LABELS = ct.statuses as Record<string, string>
  const CONTRACT_TYPES = ct.contractTypes as Record<string, string>

  const [contracts, setContracts] = useState<ContractBase[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [detail, setDetail] = useState<ContractBase | null>(null)
  const [detailTab, setDetailTab] = useState('info')
  const [createOpen, setCreateOpen] = useState(false)
  const [renewDialog, setRenewDialog] = useState(false)
  const [renewDate, setRenewDate] = useState('')
  const [renewNote, setRenewNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Customers/suppliers for create form
  const [customers, setCustomers] = useState<{ id: string; name: string; code: string }[]>([])
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; code: string }[]>([])

  // New schedule row state
  const [newSchedules, setNewSchedules] = useState<{ dueDate: string; amount: string; description: string }[]>([])
  const [form, setForm] = useState({
    title: '', contractType: 'SALES', effectiveFrom: '', effectiveTo: '',
    signedAt: '', totalValue: '', currency: 'TWD', paymentTerms: '', autoRenew: false, notes: '',
    customerId: '', supplierId: '',
  })

  const fetchContracts = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter }),
      ...(typeFilter && { contractType: typeFilter }),
      ...(expiringSoon && { expiringSoon: 'true' }),
    })
    const res = await fetch(`/api/contracts?${p}`)
    const json = await res.json()
    setContracts(json.data ?? [])
    setLoading(false)
  }, [search, statusFilter, typeFilter, expiringSoon])

  useEffect(() => { fetchContracts() }, [fetchContracts])

  useEffect(() => {
    Promise.all([
      fetch('/api/customers?pageSize=500').then(r => r.json()),
      fetch('/api/suppliers?pageSize=500').then(r => r.json()),
    ]).then(([c, s]) => {
      setCustomers(Array.isArray(c) ? c : (c.data ?? []))
      setSuppliers(Array.isArray(s) ? s : (s.data ?? []))
    }).catch(() => {})
  }, [])

  async function refreshDetail(id: string) {
    const res = await fetch(`/api/contracts/${id}`)
    const updated = await res.json()
    setDetail(updated)
  }

  async function handleCreate() {
    setSaving(true)
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        totalValue: form.totalValue ? Number(form.totalValue) : null,
        schedules: newSchedules.filter(s => s.dueDate && s.amount).map(s => ({ ...s, amount: Number(s.amount) })),
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(ct.created)
      setCreateOpen(false)
      setForm({ title: '', contractType: 'SALES', effectiveFrom: '', effectiveTo: '', signedAt: '', totalValue: '', currency: 'TWD', paymentTerms: '', autoRenew: false, notes: '', customerId: '', supplierId: '' })
      setNewSchedules([])
      fetchContracts()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.createFailed)
    }
  }

  function openEdit(contract: ContractBase, e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditingId(contract.id)
    setEditForm(contractToEditForm(contract))
    setEditOpen(true)
  }

  async function handleEdit() {
    if (!editingId) return
    setSaving(true)
    const res = await fetch(`/api/contracts/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editForm.title,
        contractType: editForm.contractType,
        effectiveFrom: editForm.effectiveFrom,
        effectiveTo: editForm.effectiveTo,
        totalValue: editForm.totalValue ? Number(editForm.totalValue) : null,
        paymentTerms: editForm.paymentTerms || null,
        notes: editForm.notes || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(ct.updated)
      setEditOpen(false)
      fetchContracts()
      if (detail?.id === editingId) refreshDetail(editingId)
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.updateFailed)
    }
  }

  async function handleDelete(id: string, contractNo: string) {
    if (!confirm(ct.deleteConfirm.replace('{no}', contractNo))) return
    const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(ct.deleted)
      setDetail(null)
      fetchContracts()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.deleteFailed)
    }
  }

  async function handleRenew() {
    if (!detail || !renewDate) return
    setSaving(true)
    const res = await fetch(`/api/contracts/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RENEW', newEffectiveTo: renewDate, notes: renewNote }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(ct.renewed)
      setRenewDialog(false)
      refreshDetail(detail.id)
      fetchContracts()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? dict.common.operationFailed)
    }
  }

  async function handleTerminate(id: string) {
    if (!confirm(ct.terminateConfirm)) return
    const res = await fetch(`/api/contracts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'TERMINATE' }),
    })
    if (res.ok) {
      toast.success(ct.terminated)
      setDetail(null)
      fetchContracts()
    } else {
      toast.error(dict.common.operationFailed)
    }
  }

  async function handlePaySchedule(scheduleId: string, contractId: string) {
    await fetch(`/api/contracts/${contractId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'PAY_SCHEDULE', scheduleId }),
    })
    if (detail) refreshDetail(detail.id)
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{ct.title}</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />{ct.newContract}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input placeholder={ct.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-52" />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? '')}>
          <SelectTrigger className="h-8 w-32"><SelectValue placeholder={dict.common.all + dict.common.status} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.common.all + dict.common.status}</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v ?? '')}>
          <SelectTrigger className="h-8 w-32"><SelectValue placeholder={dict.common.all + dict.common.type} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.common.all + dict.common.type}</SelectItem>
            {Object.entries(CONTRACT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={expiringSoon ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setExpiringSoon(e => !e)}>
          <AlertTriangle className="mr-1 h-4 w-4" />{dict.roleDashboard.expiringSoon}
        </Button>
      </div>

      {/* Cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <p className="col-span-full py-8 text-center text-muted-foreground">{dict.common.loading}</p>
        ) : contracts.length === 0 ? (
          <p className="col-span-full py-8 text-center text-muted-foreground">{ct.noContracts}</p>
        ) : contracts.map(c => {
          const days = daysUntil(c.effectiveTo)
          const warn = c.status === 'ACTIVE' && days <= c.reminderDays && days >= 0
          return (
            <Card key={c.id} className={`cursor-pointer hover:shadow-md transition-shadow ${warn ? 'border-orange-400' : ''}`} onClick={() => { setDetail(c); setDetailTab('info') }}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">{c.contractNo}</p>
                    <CardTitle className="mt-0.5 text-base">{c.title}</CardTitle>
                  </div>
                  <Badge variant={STATUS_BADGE_VARIANT[c.status] ?? 'outline'}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{CONTRACT_TYPES[c.contractType] ?? c.contractType}</span>
                    <span className="font-medium">{fmt(c.totalValue)}</span>
                  </div>
                  {c.customer && <p className="text-muted-foreground truncate">{ct.cardCustomer}{c.customer.name}</p>}
                  {c.supplier && <p className="text-muted-foreground truncate">{ct.cardSupplier}{c.supplier.name}</p>}
                  <p className={warn ? 'font-semibold text-orange-600' : 'text-muted-foreground'}>
                    {warn ? <AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> : null}
                    {ct.cardExpiry}{new Date(c.effectiveTo).toLocaleDateString('zh-TW')}
                    {warn ? ` (${ct.cardDaysLeft.replace('{n}', String(days))})` : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Detail Dialog ── */}
      {detail && (
        <Dialog open onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {detail.contractNo} — {detail.title}
                <Badge variant={STATUS_BADGE_VARIANT[detail.status] ?? 'outline'}>
                  {STATUS_LABELS[detail.status] ?? detail.status}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              {!['TERMINATED', 'EXPIRED'].includes(detail.status) && (
                <Button size="sm" variant="outline" onClick={() => openEdit(detail)}>
                  <Pencil className="mr-1 h-4 w-4" />{dict.common.edit}
                </Button>
              )}
              {detail.status === 'ACTIVE' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setRenewDate(detail.effectiveTo.slice(0, 10)); setRenewDialog(true) }}>
                    <RefreshCw className="mr-1 h-4 w-4" />{ct.btnRenew}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleTerminate(detail.id)}>{STATUS_LABELS.TERMINATED}</Button>
                </>
              )}
              {detail.status === 'DRAFT' && (
                <Button size="sm" variant="destructive" onClick={() => handleDelete(detail.id, detail.contractNo)}>
                  <Trash2 className="mr-1 h-4 w-4" />{ct.btnDeleteDraft}
                </Button>
              )}
            </div>

            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList>
                <TabsTrigger value="info">{ct.tabInfo}</TabsTrigger>
                <TabsTrigger value="schedules">{ct.tabSchedules}</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">{ct.detailType}</span>{CONTRACT_TYPES[detail.contractType] ?? detail.contractType}</div>
                  <div><span className="text-muted-foreground">{ct.detailCurrency}</span>{detail.currency}</div>
                  <div><span className="text-muted-foreground">{ct.detailTotalValue}</span>{fmt(detail.totalValue)}</div>
                  <div><span className="text-muted-foreground">{ct.detailSignedAt}</span>{detail.signedAt ? new Date(detail.signedAt).toLocaleDateString('zh-TW') : '—'}</div>
                  <div><span className="text-muted-foreground">{ct.detailEffectiveFrom}</span>{new Date(detail.effectiveFrom).toLocaleDateString('zh-TW')}</div>
                  <div><span className="text-muted-foreground">{ct.detailEffectiveTo}</span>{new Date(detail.effectiveTo).toLocaleDateString('zh-TW')}</div>
                  {detail.customer && <div className="col-span-2"><span className="text-muted-foreground">{ct.detailCustomer}</span>{detail.customer.name}</div>}
                  {detail.supplier && <div className="col-span-2"><span className="text-muted-foreground">{ct.detailSupplier}</span>{detail.supplier.name}</div>}
                  {detail.paymentTerms && <div className="col-span-2"><span className="text-muted-foreground">{ct.detailPaymentTerms}</span>{detail.paymentTerms}</div>}
                  <div><span className="text-muted-foreground">{ct.detailAutoRenew}</span>{detail.autoRenew ? ct.detailAutoRenewYes : ct.detailAutoRenewNo}</div>
                  <div><span className="text-muted-foreground">{ct.detailReminderDays}</span>{detail.reminderDays} {ct.detailDaysUnit}</div>
                </div>
                {detail.notes && <p className="mt-3 rounded bg-muted/40 p-2 text-sm">{detail.notes}</p>}
              </TabsContent>

              <TabsContent value="schedules">
                {detail.schedules.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{dict.common.noRecords}</p>
                ) : (
                  <div className="space-y-2">
                    {detail.schedules.map(s => (
                      <div key={s.id} className={`flex items-center justify-between rounded border p-2 text-sm ${s.isPaid ? 'bg-green-50/50 dark:bg-green-950/20' : ''}`}>
                        <div>
                          <p className="font-medium">{fmt(s.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {ct.scheduleExpiry}{new Date(s.dueDate).toLocaleDateString('zh-TW')}
                            {s.description ? ` · ${s.description}` : ''}
                          </p>
                        </div>
                        {s.isPaid ? (
                          <Badge variant="secondary" className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{ct.schedulePaid}</Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handlePaySchedule(s.id, detail.id)}>{ct.schedulePaidBtn}</Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{ct.editTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{ct.fieldContractTitle}</Label>
              <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div><Label>{ct.fieldContractType}</Label>
              <Select value={editForm.contractType} onValueChange={v => setEditForm(f => ({ ...f, contractType: v ?? 'SALES' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CONTRACT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{ct.fieldEffectiveFrom}</Label>
                <Input type="date" value={editForm.effectiveFrom} onChange={e => setEditForm(f => ({ ...f, effectiveFrom: e.target.value }))} className="mt-1" />
              </div>
              <div><Label>{ct.fieldEffectiveTo}</Label>
                <Input type="date" value={editForm.effectiveTo} onChange={e => setEditForm(f => ({ ...f, effectiveTo: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div><Label>{ct.fieldTotalValue}</Label>
              <Input type="number" value={editForm.totalValue} onChange={e => setEditForm(f => ({ ...f, totalValue: e.target.value }))} className="mt-1" placeholder={ct.fieldTotalValuePlaceholder} />
            </div>
            <div><Label>{ct.fieldPaymentTerms}</Label>
              <Input value={editForm.paymentTerms} onChange={e => setEditForm(f => ({ ...f, paymentTerms: e.target.value }))} className="mt-1" placeholder={ct.fieldPaymentTermsPlaceholder} />
            </div>
            <div><Label>{ct.fieldNotes}</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
            <Button onClick={handleEdit} disabled={saving || !editForm.title || !editForm.effectiveFrom || !editForm.effectiveTo}>{dict.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Renew Dialog ── */}
      <Dialog open={renewDialog} onOpenChange={setRenewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{ct.renewDialogTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{ct.renewFieldNewExpiry}</Label><Input type="date" value={renewDate} onChange={e => setRenewDate(e.target.value)} className="mt-1" /></div>
            <div><Label>{ct.fieldNotes}</Label><Textarea value={renewNote} onChange={e => setRenewNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleRenew} disabled={saving || !renewDate}>{ct.renewBtnConfirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{ct.newContract}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{ct.fieldContractTitle}</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{ct.createFieldCustomer}</Label>
                <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value, supplierId: '' }))}>
                  <option value="">{ct.createSelectCustomer}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div><Label>{ct.createFieldSupplier}</Label>
                <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value, customerId: '' }))}>
                  <option value="">{ct.createSelectSupplier}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{ct.fieldContractType}</Label>
                <Select value={form.contractType} onValueChange={v => setForm(f => ({ ...f, contractType: v ?? 'SALES' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CONTRACT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{ct.createFieldCurrency}</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v ?? 'TWD' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{['TWD', 'USD', 'EUR', 'CNY'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{ct.fieldEffectiveFrom}</Label><Input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} className="mt-1" /></div>
              <div><Label>{ct.fieldEffectiveTo}</Label><Input type="date" value={form.effectiveTo} onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{ct.createFieldSignedAt}</Label><Input type="date" value={form.signedAt} onChange={e => setForm(f => ({ ...f, signedAt: e.target.value }))} className="mt-1" /></div>
              <div><Label>{ct.fieldTotalValue}</Label><Input type="number" value={form.totalValue} onChange={e => setForm(f => ({ ...f, totalValue: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>{ct.fieldPaymentTerms}</Label><Input value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} className="mt-1" placeholder={ct.fieldPaymentTermsPlaceholder} /></div>
            <div><Label>{ct.fieldNotes}</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" rows={2} /></div>

            {/* Payment schedules */}
            <div>
              <div className="flex items-center justify-between">
                <Label>{ct.createFieldSchedules}</Label>
                <Button variant="ghost" size="sm" onClick={() => setNewSchedules(s => [...s, { dueDate: '', amount: '', description: '' }])}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {newSchedules.map((s, i) => (
                <div key={i} className="mt-1 flex items-center gap-2">
                  <Input type="date" value={s.dueDate} onChange={e => setNewSchedules(arr => arr.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x))} className="w-36" />
                  <Input type="number" placeholder={ct.createScheduleAmountPlaceholder} value={s.amount} onChange={e => setNewSchedules(arr => arr.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} className="w-28" />
                  <Input placeholder={ct.createScheduleDescPlaceholder} value={s.description} onChange={e => setNewSchedules(arr => arr.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setNewSchedules(arr => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title || !form.effectiveFrom || !form.effectiveTo}>{ct.newContract}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
