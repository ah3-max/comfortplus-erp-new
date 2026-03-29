'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, Loader2, ArrowDownLeft, ArrowUpRight,
  MoreHorizontal, Pencil, Trash2, Receipt, Banknote, MinusCircle, Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

/* ─── Types ─────────────────────────────────────────────── */
type PaymentDirection = 'INCOMING' | 'OUTGOING'
type PaymentType = 'DEPOSIT' | 'PROGRESS' | 'FINAL' | 'FULL' | 'REFUND' | 'ADJUSTMENT'

interface Payment {
  id: string
  paymentNo: string
  direction: PaymentDirection
  type: PaymentType
  amount: string
  paymentDate: string
  method: string | null
  bankAccount: string | null
  referenceNo: string | null
  invoiceNo: string | null
  notes: string | null
  createdAt: string
  customer: { id: string; name: string; code: string } | null
  supplier: { id: string; name: string; code: string } | null
  salesOrder: { id: string; orderNo: string } | null
  purchaseOrder: { id: string; poNo: string } | null
}

interface Customer { id: string; name: string; code: string }
interface Supplier { id: string; name: string; code: string }
interface SalesOrder { id: string; orderNo: string; customer: { id: string; name: string } }
interface PurchaseOrder { id: string; poNo: string; supplier: { id: string; name: string } }

/* ─── Constants ──────────────────────────────────────────── */
const DIRECTION_COLOR: Record<PaymentDirection, string> = {
  INCOMING: 'bg-green-100 text-green-700',
  OUTGOING: 'bg-red-100 text-red-700',
}

const TYPE_COLOR: Record<PaymentType, string> = {
  DEPOSIT:    'bg-blue-100 text-blue-700',
  PROGRESS:   'bg-amber-100 text-amber-700',
  FINAL:      'bg-teal-100 text-teal-700',
  FULL:       'bg-indigo-100 text-indigo-700',
  REFUND:     'bg-red-100 text-red-600',
  ADJUSTMENT: 'bg-slate-100 text-slate-600',
}

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: '銀行轉帳' },
  { value: 'CHECK', label: '支票' },
  { value: 'CASH', label: '現金' },
  { value: 'CREDIT_CARD', label: '信用卡' },
  { value: 'OTHER', label: '其他' },
]

const METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map(m => [m.value, m.label]),
)

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency', currency: 'TWD', maximumFractionDigits: 0,
  }).format(Number(val))
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const emptyForm = {
  direction: 'INCOMING' as PaymentDirection,
  type: 'FULL' as PaymentType,
  amount: '',
  paymentDate: new Date().toISOString().substring(0, 10),
  method: 'BANK_TRANSFER',
  customerId: '',
  supplierId: '',
  salesOrderId: '',
  purchaseOrderId: '',
  bankAccount: '',
  referenceNo: '',
  invoiceNo: '',
  notes: '',
}

/* ─── Component ──────────────────────────────────────────── */
export default function PaymentsPage() {
  const { dict } = useI18n()
  const [payments, setPayments]       = useState<Payment[]>([])
  const [customers, setCustomers]     = useState<Customer[]>([])
  const [suppliers, setSuppliers]     = useState<Supplier[]>([])
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading]         = useState(true)

  const [tab, setTab] = useState<'INCOMING' | 'OUTGOING'>('INCOMING')

  // filters
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo]     = useState('')

  // create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ ...emptyForm })
  const [saving, setSaving]         = useState(false)

  // edit dialog
  const [editOpen, setEditOpen]     = useState(false)
  const [editTarget, setEditTarget] = useState<Payment | null>(null)
  const [editForm, setEditForm]     = useState({
    method: '', bankAccount: '', referenceNo: '', invoiceNo: '', notes: '',
  })

  // write-off dialog
  const [writeOffTarget, setWriteOffTarget] = useState<Payment | null>(null)
  const [writeOffForm, setWriteOffForm]     = useState({ amount: '', notes: '' })
  const [writingOff, setWritingOff]         = useState(false)

  /* ─── Data Loading ──────────────────────────────────────── */
  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('direction', tab)
    if (filterDateFrom) params.set('dateFrom', filterDateFrom)
    if (filterDateTo) params.set('dateTo', filterDateTo)
    const res = await fetch(`/api/payments?${params}`)
    const data = await res.json()
    setPayments(Array.isArray(data) ? data : (data.data ?? []))
    setLoading(false)
  }, [tab, filterDateFrom, filterDateTo])

  useEffect(() => {
    const t = setTimeout(fetchPayments, 300)
    return () => clearTimeout(t)
  }, [fetchPayments])

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()),
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/purchases').then(r => r.json()),
    ]).then(([c, s, o, p]) => {
      setCustomers(Array.isArray(c) ? c : (c.data ?? []))
      setSuppliers(Array.isArray(s) ? s : (s.data ?? []))
      setSalesOrders(Array.isArray(o) ? o : (o.data ?? []))
      setPurchaseOrders(Array.isArray(p) ? p : (p.data ?? []))
    })
  }, [])

  /* ─── KPI ───────────────────────────────────────────────── */
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // We compute KPIs from all payments (regardless of tab filter).
  // For a production app this would come from a dedicated API, but
  // we'll filter client-side from what we have.
  const allIncoming = payments.filter(p => p.direction === 'INCOMING')
  const allOutgoing = payments.filter(p => p.direction === 'OUTGOING')

  // Since we fetch by tab, we need separate KPI fetch or calculate from current data
  // For now we show tab-relevant totals + use a simple approach
  const monthPayments = payments.filter(p => p.paymentDate.substring(0, 7) === thisMonth)
  const monthIncoming = monthPayments.filter(p => p.direction === 'INCOMING')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const monthOutgoing = monthPayments.filter(p => p.direction === 'OUTGOING')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const totalIncoming = allIncoming.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalOutgoing = allOutgoing.reduce((sum, p) => sum + Number(p.amount), 0)

  /* ─── Create ────────────────────────────────────────────── */
  function openCreate() {
    setCreateForm({ ...emptyForm, direction: tab })
    setCreateOpen(true)
  }

  function cf(k: keyof typeof emptyForm, v: string) {
    setCreateForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleCreate() {
    if (!createForm.amount || Number(createForm.amount) <= 0) {
      toast.error(dict.paymentsPage.validAmount); return
    }
    if (!createForm.paymentDate) {
      toast.error(`請選擇${dict.payments.paymentDate}`); return
    }
    if (createForm.direction === 'INCOMING' && !createForm.customerId) {
      toast.error(`收款必須選擇${dict.common.customer}`); return
    }
    if (createForm.direction === 'OUTGOING' && !createForm.supplierId) {
      toast.error(`付款必須選擇${dict.common.supplier}`); return
    }
    setSaving(true)
    const body = {
      direction:       createForm.direction,
      paymentType:     createForm.type,
      amount:          Number(createForm.amount),
      paymentDate:     createForm.paymentDate,
      paymentMethod:   createForm.method || null,
      customerId:      createForm.customerId || null,
      supplierId:      createForm.supplierId || null,
      salesOrderId:    createForm.salesOrderId || null,
      purchaseOrderId: createForm.purchaseOrderId || null,
      bankAccount:     createForm.bankAccount || null,
      referenceNo:     createForm.referenceNo || null,
      invoiceNo:       createForm.invoiceNo || null,
      notes:           createForm.notes || null,
    }
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(dict.common.createSuccess)
      setCreateOpen(false)
      fetchPayments()
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.saveFailed)
    }
  }

  /* ─── Edit ──────────────────────────────────────────────── */
  function openEdit(p: Payment) {
    setEditTarget(p)
    setEditForm({
      method:      p.method ?? '',
      bankAccount: p.bankAccount ?? '',
      referenceNo: p.referenceNo ?? '',
      invoiceNo:   p.invoiceNo ?? '',
      notes:       p.notes ?? '',
    })
    setEditOpen(true)
  }

  async function handleEdit() {
    if (!editTarget) return
    setSaving(true)
    const body = {
      method:      editForm.method || null,
      bankAccount: editForm.bankAccount || null,
      referenceNo: editForm.referenceNo || null,
      invoiceNo:   editForm.invoiceNo || null,
      notes:       editForm.notes || null,
    }
    const res = await fetch(`/api/payments/${editTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(dict.common.updateSuccess)
      setEditOpen(false)
      fetchPayments()
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.updateFailed)
    }
  }

  /* ─── Delete ────────────────────────────────────────────── */
  async function handleDelete(p: Payment) {
    if (!confirm(`確定要刪除 ${p.paymentNo} 嗎？刪除後將重新計算關聯訂單已付金額。`)) return
    const res = await fetch(`/api/payments/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(dict.common.deleteSuccess)
      fetchPayments()
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.deleteFailed)
    }
  }

  /* ─── Write-off ─────────────────────────────────────────── */
  function openWriteOff(p: Payment) {
    setWriteOffTarget(p)
    setWriteOffForm({ amount: p.amount, notes: '壞帳核銷' })
  }

  async function handleWriteOff() {
    if (!writeOffTarget) return
    if (!writeOffForm.amount || Number(writeOffForm.amount) <= 0) {
      toast.error(dict.paymentsPage.validWriteOff); return
    }
    setWritingOff(true)
    const body = {
      direction:   writeOffTarget.direction,
      type:        'ADJUSTMENT',
      amount:      Number(writeOffForm.amount),
      paymentDate: new Date().toISOString().substring(0, 10),
      customerId:  writeOffTarget.customer?.id ?? null,
      supplierId:  writeOffTarget.supplier?.id ?? null,
      salesOrderId:    writeOffTarget.salesOrder?.id ?? null,
      purchaseOrderId: writeOffTarget.purchaseOrder?.id ?? null,
      notes: writeOffForm.notes || `核銷 ${writeOffTarget.paymentNo}`,
    }
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setWritingOff(false)
    if (res.ok) {
      toast.success(dict.common.createSuccess)
      setWriteOffTarget(null)
      fetchPayments()
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.saveFailed)
    }
  }

  /* ─── Tab Styling ───────────────────────────────────────── */
  const tabStyle = (t: string) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
      tab === t
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`

  /* ─── Dict-based label maps ─────────────────────────────── */
  const DIRECTION_CONFIG: Record<PaymentDirection, { label: string; color: string }> = {
    INCOMING: { label: dict.payments.directions.INCOMING, color: DIRECTION_COLOR.INCOMING },
    OUTGOING: { label: dict.payments.directions.OUTGOING, color: DIRECTION_COLOR.OUTGOING },
  }
  const TYPE_CONFIG: Record<PaymentType, { label: string; color: string }> = {
    DEPOSIT:    { label: dict.payments.types.DEPOSIT,    color: TYPE_COLOR.DEPOSIT },
    PROGRESS:   { label: dict.payments.types.PROGRESS,   color: TYPE_COLOR.PROGRESS },
    FINAL:      { label: dict.payments.types.FINAL,      color: TYPE_COLOR.FINAL },
    FULL:       { label: dict.payments.types.FULL,       color: TYPE_COLOR.FULL },
    REFUND:     { label: dict.payments.types.REFUND,     color: TYPE_COLOR.REFUND },
    ADJUSTMENT: { label: dict.payments.types.ADJUSTMENT, color: TYPE_COLOR.ADJUSTMENT },
  }

  /* ─── Filtered data ─────────────────────────────────────── */
  const filteredPayments = payments

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.payments.title}</h1>
          <p className="text-sm text-muted-foreground">
            管理銷售收款與採購付款紀錄
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => {
            const params = new URLSearchParams()
            params.set('direction', tab)
            if (filterDateFrom) params.set('dateFrom', filterDateFrom)
            if (filterDateTo)   params.set('dateTo', filterDateTo)
            window.open(`/api/payments/export?${params}`, '_blank')
          }}>
            <Download className="mr-2 h-4 w-4" />{dict.common.exportExcel}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {dict.paymentsExt.newPayment}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2.5">
              <ArrowDownLeft className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">本月{dict.payments.directions.INCOMING}總額</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(monthIncoming)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2.5">
              <ArrowUpRight className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">本月{dict.payments.directions.OUTGOING}總額</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(monthOutgoing)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2.5">
              <Receipt className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{dict.paymentsExt.totalReceived}</p>
              <p className="text-xl font-bold text-amber-600">
                {tab === 'INCOMING' ? formatCurrency(totalIncoming) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2.5">
              <Banknote className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{dict.paymentsExt.totalPaid}</p>
              <p className="text-xl font-bold text-purple-600">
                {tab === 'OUTGOING' ? formatCurrency(totalOutgoing) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="border-b flex gap-0">
        <button className={tabStyle('INCOMING')} onClick={() => setTab('INCOMING')}>
          {dict.payments.incoming}
        </button>
        <button className={tabStyle('OUTGOING')} onClick={() => setTab('OUTGOING')}>
          {dict.payments.outgoing}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">日期範圍</Label>
          <Input type="date" className="w-40" value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)} />
          <span className="text-muted-foreground">~</span>
          <Input type="date" className="w-40" value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)} />
        </div>
        {(filterDateFrom || filterDateTo) && (
          <Button variant="ghost" size="sm"
            onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}>
            清除篩選
          </Button>
        )}
      </div>

      {/* Payment Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">{dict.payments.paymentNo}</TableHead>
              <TableHead className="w-16">方向</TableHead>
              <TableHead className="w-16">{dict.common.type}</TableHead>
              <TableHead className="text-right w-28">{dict.common.amount}</TableHead>
              <TableHead className="w-28">{dict.payments.paymentDate}</TableHead>
              <TableHead>{tab === 'INCOMING' ? dict.common.customer : dict.common.supplier}</TableHead>
              <TableHead>關聯單號</TableHead>
              <TableHead className="w-24">{dict.payments.paymentMethod}</TableHead>
              <TableHead className="w-32">{dict.payments.invoiceNo}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-16 text-center text-muted-foreground">
                  {filterDateFrom || filterDateTo
                    ? dict.paymentsExt.noResults
                    : dict.paymentsExt.noPayments}
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map(p => {
                const dir = DIRECTION_CONFIG[p.direction]
                const typ = TYPE_CONFIG[p.type] ?? { label: p.type, color: 'bg-slate-100 text-slate-600' }
                const counterparty = p.direction === 'INCOMING'
                  ? p.customer?.name
                  : p.supplier?.name
                const linkedOrder = p.direction === 'INCOMING'
                  ? p.salesOrder?.orderNo
                  : p.purchaseOrder?.poNo
                return (
                  <TableRow key={p.id} className="group hover:bg-slate-50/80">
                    <TableCell className="font-mono text-sm font-medium">{p.paymentNo}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${dir.color}`}>
                        {dir.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typ.color}`}>
                        {typ.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(p.paymentDate)}</TableCell>
                    <TableCell className="text-sm">{counterparty ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {linkedOrder ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.method ? (METHOD_LABELS[p.method] ?? p.method) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.invoiceNo ?? '—'}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openWriteOff(p)}>
                            <MinusCircle className="mr-2 h-4 w-4" />核銷
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(p)} variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" />{dict.common.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Create Dialog ────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dict.paymentsExt.newPayment}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            {/* Direction */}
            <div className="space-y-1.5">
              <Label>方向 <span className="text-red-500">*</span></Label>
              <Select
                value={createForm.direction}
                onValueChange={v => {
                  const dir = (v ?? 'INCOMING') as PaymentDirection
                  setCreateForm(prev => ({
                    ...prev,
                    direction: dir,
                    customerId: '',
                    supplierId: '',
                    salesOrderId: '',
                    purchaseOrderId: '',
                  }))
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOMING">{dict.payments.directions.INCOMING}</SelectItem>
                  <SelectItem value="OUTGOING">{dict.payments.directions.OUTGOING}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>{dict.common.type} <span className="text-red-500">*</span></Label>
              <Select
                value={createForm.type}
                onValueChange={v => cf('type', v ?? 'FULL')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPOSIT">{dict.payments.types.DEPOSIT}</SelectItem>
                  <SelectItem value="PROGRESS">{dict.payments.types.PROGRESS}</SelectItem>
                  <SelectItem value="FINAL">{dict.payments.types.FINAL}</SelectItem>
                  <SelectItem value="FULL">{dict.payments.types.FULL}</SelectItem>
                  <SelectItem value="REFUND">{dict.payments.types.REFUND}</SelectItem>
                  <SelectItem value="ADJUSTMENT">{dict.payments.types.ADJUSTMENT}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{dict.common.amount} <span className="text-red-500">*</span></Label>
                <Input type="number" min={0} step="1" placeholder="0"
                  value={createForm.amount}
                  onChange={e => cf('amount', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.payments.paymentDate} <span className="text-red-500">*</span></Label>
                <Input type="date" value={createForm.paymentDate}
                  onChange={e => cf('paymentDate', e.target.value)} />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label>{dict.payments.paymentMethod}</Label>
              <Select
                value={createForm.method || '_none'}
                onValueChange={v => cf('method', v === '_none' ? '' : (v ?? ''))}
              >
                <SelectTrigger><SelectValue placeholder="選擇付款方式" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— 選擇付款方式 —</SelectItem>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer / Supplier + Order link */}
            {createForm.direction === 'INCOMING' ? (
              <>
                <div className="space-y-1.5">
                  <Label>{dict.common.customer} <span className="text-red-500">*</span></Label>
                  <Select
                    value={createForm.customerId || '_none'}
                    onValueChange={v => cf('customerId', v === '_none' ? '' : (v ?? ''))}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— 選擇客戶 —</SelectItem>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>關聯銷售訂單</Label>
                  <Select
                    value={createForm.salesOrderId || '_none'}
                    onValueChange={v => cf('salesOrderId', v === '_none' ? '' : (v ?? ''))}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇訂單（選填）" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— 不關聯 —</SelectItem>
                      {salesOrders
                        .filter(o => !createForm.customerId || o.customer.id === createForm.customerId)
                        .map(o => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.orderNo} - {o.customer.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>{dict.common.supplier} <span className="text-red-500">*</span></Label>
                  <Select
                    value={createForm.supplierId || '_none'}
                    onValueChange={v => cf('supplierId', v === '_none' ? '' : (v ?? ''))}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇供應商" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— 選擇供應商 —</SelectItem>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>關聯採購單</Label>
                  <Select
                    value={createForm.purchaseOrderId || '_none'}
                    onValueChange={v => cf('purchaseOrderId', v === '_none' ? '' : (v ?? ''))}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇採購單（選填）" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— 不關聯 —</SelectItem>
                      {purchaseOrders
                        .filter(po => !createForm.supplierId || po.supplier.id === createForm.supplierId)
                        .map(po => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.poNo} - {po.supplier.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Bank Account */}
            <div className="space-y-1.5">
              <Label>{dict.paymentsExt.bankAccount}</Label>
              <Input value={createForm.bankAccount}
                onChange={e => cf('bankAccount', e.target.value)}
                placeholder="銀行名稱 / 帳號末四碼" />
            </div>

            {/* Reference No + Invoice No */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{dict.payments.referenceNo}</Label>
                <Input value={createForm.referenceNo}
                  onChange={e => cf('referenceNo', e.target.value)}
                  placeholder="匯款單號 / 支票號碼" />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.payments.invoiceNo}</Label>
                <Input value={createForm.invoiceNo}
                  onChange={e => cf('invoiceNo', e.target.value)}
                  placeholder="AB-12345678" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>{dict.common.notes}</Label>
              <Textarea value={createForm.notes}
                onChange={e => cf('notes', e.target.value)}
                rows={2} placeholder="特殊說明..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Write-off Dialog ─────────────────────────────── */}
      <Dialog open={!!writeOffTarget} onOpenChange={o => !o && setWriteOffTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>核銷帳款 — {writeOffTarget?.paymentNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              核銷將建立一筆「調整」類型的收付款紀錄，用於沖銷壞帳或已確認無法收回的帳款。
            </div>
            <div className="space-y-1.5">
              <Label>核銷金額 *</Label>
              <Input
                type="number" min={0}
                value={writeOffForm.amount}
                onChange={e => setWriteOffForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>核銷說明</Label>
              <Textarea
                value={writeOffForm.notes}
                onChange={e => setWriteOffForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="說明核銷原因…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteOffTarget(null)} disabled={writingOff}>{dict.common.cancel}</Button>
            <Button onClick={handleWriteOff} disabled={writingOff}>
              {writingOff && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              確認核銷
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ──────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dict.common.edit} — {editTarget?.paymentNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>{dict.payments.paymentMethod}</Label>
              <Select
                value={editForm.method || '_none'}
                onValueChange={v => setEditForm(prev => ({ ...prev, method: v === '_none' ? '' : (v ?? '') }))}
              >
                <SelectTrigger><SelectValue placeholder="選擇付款方式" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— 選擇付款方式 —</SelectItem>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.paymentsExt.bankAccount}</Label>
              <Input value={editForm.bankAccount}
                onChange={e => setEditForm(prev => ({ ...prev, bankAccount: e.target.value }))}
                placeholder="銀行名稱 / 帳號末四碼" />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.payments.referenceNo}</Label>
              <Input value={editForm.referenceNo}
                onChange={e => setEditForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                placeholder="匯款單號 / 支票號碼" />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.payments.invoiceNo}</Label>
              <Input value={editForm.invoiceNo}
                onChange={e => setEditForm(prev => ({ ...prev, invoiceNo: e.target.value }))}
                placeholder="AB-12345678" />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.common.notes}</Label>
              <Textarea value={editForm.notes}
                onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2} placeholder="特殊說明..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
