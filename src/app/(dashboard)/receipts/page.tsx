'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, DollarSign, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

/* ─── Types ─────────────────────────────────────────────── */
interface AROption {
  id: string
  invoiceNo: string | null
  amount: number
  paidAmount: number
  status: string
  customer: { name: string; code: string }
  order?: { id: string; orderNo: string } | null
}

interface ReceiptRecord {
  id: string
  receiptDate: string
  receiptMethod: string | null
  amount: number
  bankLast5: string | null
  notes: string | null
  createdAt: string
  ar: {
    invoiceNo: string | null
    amount: number
    paidAmount: number
    status: string
    customer: { name: string; code: string }
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
  BAD_DEBT:     'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  NOT_DUE:      '未到期',
  DUE:          '逾期',
  PARTIAL_PAID: '部分收款',
  PAID:         '已收清',
  BAD_DEBT:     '呆帳風險',
}

/* ─── Component ─────────────────────────────────────────── */
export default function ReceiptsPage() {
  const { dict } = useI18n()
  const [records, setRecords] = useState<ReceiptRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [arOptions, setArOptions] = useState<AROption[]>([])
  const [arLoading, setArLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // form state
  const [selectedArId, setSelectedArId] = useState('')
  const [amount, setAmount] = useState('')
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiptMethod, setReceiptMethod] = useState('TRANSFER')
  const [bankLast5, setBankLast5] = useState('')
  const [notes, setNotes] = useState('')

  const selectedAr = arOptions.find(a => a.id === selectedArId)
  const balance = selectedAr ? Number(selectedAr.amount) - Number(selectedAr.paidAmount) : 0

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/finance/receipts?pageSize=100')
      .then(r => r.json())
      .then(d => { setRecords(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openDialog() {
    setSelectedArId('')
    setAmount('')
    setReceiptDate(new Date().toISOString().slice(0, 10))
    setReceiptMethod('TRANSFER')
    setBankLast5('')
    setNotes('')
    setOpen(true)
    setArLoading(true)
    fetch('/api/finance/ar-aging')
      .then(r => r.json())
      .then(d => {
        const raw = Object.values(d.buckets as Record<string, { items: Array<Record<string, unknown>> }>)
          .flatMap(b => b.items)
        // Map AR aging items into AROption format
        const items: AROption[] = raw.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          invoiceNo: (r.invoiceNo as string) ?? null,
          amount: Number(r.amount ?? 0),
          paidAmount: Number(r.paid ?? r.paidAmount ?? 0),
          status: (r.status as string) ?? 'NOT_DUE',
          customer: {
            name: (r.customerName as string) ?? '',
            code: (r.customerCode as string) ?? '',
          },
          order: r.orderId ? { id: r.orderId as string, orderNo: (r.orderNo as string) ?? '' } : null,
        }))
        setArOptions(items)
        setArLoading(false)
      })
      .catch(() => setArLoading(false))
  }

  async function handleSubmit() {
    if (!selectedArId) { toast.error(dict.receipts?.selectArRequired ?? '請選擇應收帳款'); return }
    if (!amount || Number(amount) <= 0) { toast.error(dict.receipts?.amountRequired ?? '請填寫收款金額'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/finance/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arId: selectedArId, amount: Number(amount), receiptDate, receiptMethod, bankLast5: bankLast5 || undefined, notes: notes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '登記失敗'); return }
      toast.success(dict.receipts?.createSuccess ?? '收款登記成功')
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
          <h1 className="text-2xl font-bold text-slate-900">{dict.receipts?.title ?? '收款登記'}</h1>
          <p className="text-sm text-muted-foreground">{dict.receipts?.subtitle ?? '登記應收帳款收款，自動更新 AR 狀態'}</p>
        </div>
        <Button onClick={openDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          {dict.receipts?.newReceipt ?? '登記收款'}
        </Button>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            {dict.receipts?.historyTitle ?? '收款紀錄'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{dict.receipts?.customerName ?? '客戶'}</TableHead>
                  <TableHead className="text-xs">{dict.receipts?.invoiceNo ?? '發票號碼'}</TableHead>
                  <TableHead className="text-xs">{dict.receipts?.receiptDate ?? '收款日期'}</TableHead>
                  <TableHead className="text-xs">{dict.receipts?.method ?? '付款方式'}</TableHead>
                  <TableHead className="text-xs">{dict.receipts?.bankLast5 ?? '帳號末5碼'}</TableHead>
                  <TableHead className="text-xs text-right">{dict.receipts?.amount ?? '金額'}</TableHead>
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
                      {dict.receipts?.noData ?? '尚無收款紀錄'}
                    </TableCell>
                  </TableRow>
                ) : records.map(r => (
                  <TableRow key={r.id} className="hover:bg-slate-50/80">
                    <TableCell className="text-sm">{r.ar.customer.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{r.ar.invoiceNo ?? '-'}</TableCell>
                    <TableCell className="text-xs">{fmtDate(r.receiptDate)}</TableCell>
                    <TableCell className="text-xs">{r.receiptMethod ?? '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{r.bankLast5 ?? '-'}</TableCell>
                    <TableCell className="text-sm text-right font-medium text-green-700">{fmt(r.amount)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.ar.status] ?? ''}`}>
                        {STATUS_LABEL[r.ar.status] ?? r.ar.status}
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
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              {dict.receipts?.dialogTitle ?? '登記收款'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* AR Select */}
            <div className="space-y-1.5">
              <Label>{dict.receipts?.selectAr ?? '選擇應收帳款'}</Label>
              {arLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 載入中…
                </div>
              ) : (
                <Select value={selectedArId} onValueChange={v => { if (!v) return; setSelectedArId(v); setAmount(String((Number(arOptions.find(a => a.id === v)?.amount ?? 0) - Number(arOptions.find(a => a.id === v)?.paidAmount ?? 0)).toFixed(0))) }}>
                  <SelectTrigger>
                    <SelectValue placeholder={dict.receipts?.selectArPlaceholder ?? '選擇未收 AR…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {arOptions.map(ar => (
                      <SelectItem key={ar.id} value={ar.id}>
                        {ar.customer.name} — {ar.invoiceNo ?? '無發票'} — 餘 {fmt(Number(ar.amount) - Number(ar.paidAmount))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedAr && (
                <p className="text-xs text-muted-foreground">
                  應收 {fmt(Number(selectedAr.amount))}　已收 {fmt(Number(selectedAr.paidAmount))}　<span className="font-medium text-slate-700">餘額 {fmt(balance)}</span>
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label>{dict.receipts?.amountLabel ?? '本次收款金額'}</Label>
              <Input
                type="number"
                min={1}
                max={balance || undefined}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>{dict.receipts?.receiptDate ?? '收款日期'}</Label>
              <Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} />
            </div>

            {/* Method */}
            <div className="space-y-1.5">
              <Label>{dict.receipts?.method ?? '付款方式'}</Label>
              <Select value={receiptMethod} onValueChange={v => { if (v) setReceiptMethod(v) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRANSFER">匯款</SelectItem>
                  <SelectItem value="CHECK">支票</SelectItem>
                  <SelectItem value="CASH">現金</SelectItem>
                  <SelectItem value="OFFSET">沖帳</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bank Last 5 */}
            {receiptMethod === 'TRANSFER' && (
              <div className="space-y-1.5">
                <Label>{dict.receipts?.bankLast5 ?? '匯款帳號末 5 碼'}</Label>
                <Input
                  maxLength={5}
                  value={bankLast5}
                  onChange={e => setBankLast5(e.target.value)}
                  placeholder="12345"
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>{dict.common.notes ?? '備註'}</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={dict.receipts?.notesPlaceholder ?? '選填備註'} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {dict.receipts?.confirm ?? '確認收款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
