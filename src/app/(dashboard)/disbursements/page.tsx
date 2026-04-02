'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, CreditCard, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

/* ─── Types ─────────────────────────────────────────────── */
interface APOption {
  id: string
  invoiceNo: string | null
  amount: number
  paidAmount: number
  outstanding: number
  status: string
  currency: string
  supplierName: string
  supplierCode: string | null
}

interface DisbursementRecord {
  id: string
  paymentDate: string
  paymentMethod: string | null
  currency: string
  amount: number
  payee: string | null
  bankInfo: string | null
  notes: string | null
  createdAt: string
  ap: {
    invoiceNo: string | null
    amount: number
    paidAmount: number
    status: string
    supplier: { name: string; code: string }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW')
}

const STATUS_CLASS: Record<string, string> = {
  NOT_DUE:      'bg-green-100 text-green-700',
  DUE:          'bg-orange-100 text-orange-700',
  PARTIAL_PAID: 'bg-blue-100 text-blue-700',
  PAID:         'bg-slate-100 text-slate-600',
}

const STATUS_LABEL: Record<string, string> = {
  NOT_DUE:      '未到期',
  DUE:          '逾期',
  PARTIAL_PAID: '部分付款',
  PAID:         '已付清',
}

/* ─── Component ─────────────────────────────────────────── */
export default function DisbursementsPage() {
  const { dict } = useI18n()
  const [records, setRecords] = useState<DisbursementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [apOptions, setApOptions] = useState<APOption[]>([])
  const [apLoading, setApLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // form state
  const [selectedApId, setSelectedApId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER')
  const [payee, setPayee] = useState('')
  const [bankInfo, setBankInfo] = useState('')
  const [notes, setNotes] = useState('')

  const selectedAp = apOptions.find(a => a.id === selectedApId)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/finance/disbursements?pageSize=100')
      .then(r => r.json())
      .then(d => { setRecords(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openDialog() {
    setSelectedApId('')
    setAmount('')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentMethod('TRANSFER')
    setPayee('')
    setBankInfo('')
    setNotes('')
    setOpen(true)
    setApLoading(true)
    fetch('/api/finance/ap-aging')
      .then(r => r.json())
      .then(d => {
        const rows: APOption[] = (d.rows ?? []).flatMap((row: { supplierName: string; supplierCode: string | null; items: APOption[] }) =>
          row.items.map((item: APOption) => ({
            ...item,
            supplierName: row.supplierName,
            supplierCode: row.supplierCode,
          }))
        )
        setApOptions(rows)
        setApLoading(false)
      })
      .catch(() => setApLoading(false))
  }

  async function handleSubmit() {
    if (!selectedApId) { toast.error(dict.disbursements?.selectApRequired ?? '請選擇應付帳款'); return }
    if (!amount || Number(amount) <= 0) { toast.error(dict.disbursements?.amountRequired ?? '請填寫付款金額'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/finance/disbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apId: selectedApId,
          amount: Number(amount),
          paymentDate,
          paymentMethod,
          payee: payee || undefined,
          bankInfo: bankInfo || undefined,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '登記失敗'); return }
      toast.success(dict.disbursements?.createSuccess ?? '付款登記成功')
      setOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.disbursements?.title ?? '付款登記'}</h1>
          <p className="text-sm text-muted-foreground">{dict.disbursements?.subtitle ?? '登記應付帳款付款，自動更新 AP 狀態'}</p>
        </div>
        <Button onClick={openDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          {dict.disbursements?.newDisbursement ?? '登記付款'}
        </Button>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-blue-600" />
            {dict.disbursements?.historyTitle ?? '付款紀錄'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{dict.disbursements?.supplierName ?? '供應商'}</TableHead>
                  <TableHead className="text-xs">{dict.disbursements?.invoiceNo ?? '發票號碼'}</TableHead>
                  <TableHead className="text-xs">{dict.disbursements?.paymentDate ?? '付款日期'}</TableHead>
                  <TableHead className="text-xs">{dict.disbursements?.method ?? '付款方式'}</TableHead>
                  <TableHead className="text-xs">{dict.disbursements?.payee ?? '收款人'}</TableHead>
                  <TableHead className="text-xs text-right">{dict.disbursements?.amount ?? '金額'}</TableHead>
                  <TableHead className="text-xs">{dict.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center text-muted-foreground text-sm">
                      {dict.disbursements?.noData ?? '尚無付款紀錄'}
                    </TableCell>
                  </TableRow>
                ) : records.map(r => (
                  <TableRow key={r.id} className="hover:bg-slate-50/80">
                    <TableCell className="text-sm">{r.ap.supplier.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{r.ap.invoiceNo ?? '-'}</TableCell>
                    <TableCell className="text-xs">{fmtDate(r.paymentDate)}</TableCell>
                    <TableCell className="text-xs">{r.paymentMethod ?? '-'}</TableCell>
                    <TableCell className="text-xs">{r.payee ?? '-'}</TableCell>
                    <TableCell className="text-sm text-right font-medium text-blue-700">{fmt(r.amount)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.ap.status] ?? ''}`}>
                        {STATUS_LABEL[r.ap.status] ?? r.ap.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              {dict.disbursements?.dialogTitle ?? '登記付款'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* AP Select */}
            <div className="space-y-1.5">
              <Label>{dict.disbursements?.selectAp ?? '選擇應付帳款'}</Label>
              {apLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 載入中…
                </div>
              ) : (
                <Select value={selectedApId} onValueChange={v => { if (!v) return; setSelectedApId(v); setAmount(String((apOptions.find(a => a.id === v)?.outstanding ?? 0).toFixed(0))) }}>
                  <SelectTrigger>
                    <SelectValue placeholder={dict.disbursements?.selectApPlaceholder ?? '選擇未付 AP…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {apOptions.map(ap => (
                      <SelectItem key={ap.id} value={ap.id}>
                        {ap.supplierName} — {ap.invoiceNo ?? '無發票'} — 餘 {fmt(ap.outstanding)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedAp && (
                <p className="text-xs text-muted-foreground">
                  應付 {fmt(Number(selectedAp.amount))}　已付 {fmt(Number(selectedAp.paidAmount))}　<span className="font-medium text-slate-700">餘額 {fmt(selectedAp.outstanding)}</span>
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label>{dict.disbursements?.amountLabel ?? '本次付款金額'}</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>{dict.disbursements?.paymentDate ?? '付款日期'}</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>

            {/* Method */}
            <div className="space-y-1.5">
              <Label>{dict.disbursements?.method ?? '付款方式'}</Label>
              <Select value={paymentMethod} onValueChange={v => { if (v) setPaymentMethod(v) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRANSFER">T/T 匯款</SelectItem>
                  <SelectItem value="CHECK">支票</SelectItem>
                  <SelectItem value="CASH">現金</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payee */}
            <div className="space-y-1.5">
              <Label>{dict.disbursements?.payee ?? '收款人'}</Label>
              <Input value={payee} onChange={e => setPayee(e.target.value)} placeholder={dict.disbursements?.payeePlaceholder ?? '供應商名稱'} />
            </div>

            {/* Bank Info */}
            <div className="space-y-1.5">
              <Label>{dict.disbursements?.bankInfo ?? '匯款資訊'}</Label>
              <Input value={bankInfo} onChange={e => setBankInfo(e.target.value)} placeholder={dict.disbursements?.bankInfoPlaceholder ?? '銀行/帳號資訊'} />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>{dict.common.notes ?? '備註'}</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={dict.disbursements?.notesPlaceholder ?? '選填備註'} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {dict.disbursements?.confirm ?? '確認付款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
