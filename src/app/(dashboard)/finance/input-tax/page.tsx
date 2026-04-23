'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, Loader2, MoreHorizontal, Pencil, Trash2, Paperclip, ExternalLink,
  AlertTriangle, CheckCircle2, Search, Building2,
} from 'lucide-react'
import { toast } from 'sonner'

/* ─── Types ─────────────────────────────────────────────────────────────────── */

type SourceType = 'CUSTOMS' | 'DOMESTIC_INVOICE' | 'RECEIPT'

interface InputTaxItem {
  id: string
  vendorName: string
  vendorTaxId: string | null
  invoiceNo: string
  invoiceDate: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  sourceType: SourceType
  taxPeriod: string
  attachmentUrl: string | null
  apId: string | null
  createdAt: string
}

interface FormState {
  vendorName: string
  vendorTaxId: string
  invoiceNo: string
  invoiceDate: string
  subtotal: string
  taxAmount: string
  totalAmount: string
  sourceType: SourceType | ''
  taxPeriod: string
  attachmentUrl: string
}

interface VendorLookupResult {
  source: 'supplier' | 'history' | 'none'
  vendorName: string | null
  supplierCode?: string
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  CUSTOMS:          '進口報單',
  DOMESTIC_INVOICE: '國內統一發票',
  RECEIPT:          '收據',
}

const SOURCE_TYPE_COLORS: Record<SourceType, string> = {
  CUSTOMS:          'bg-blue-100 text-blue-700',
  DOMESTIC_INVOICE: 'bg-green-100 text-green-700',
  RECEIPT:          'bg-slate-100 text-slate-700',
}

const INVOICE_NO_REGEX = /^[A-Z]{2}\d{8}$/

function generatePeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 2, 1)
    const year  = d.getFullYear()
    const month = d.getMonth() % 2 === 0 ? d.getMonth() : d.getMonth() - 1
    const startMonth = (month % 2 === 0 ? month : month - 1) + 1
    const odd = startMonth % 2 === 0 ? startMonth - 1 : startMonth
    const key   = `${year}-${String(odd).padStart(2, '0')}`
    const label = `${year} 年 ${odd}–${odd + 1} 月`
    if (!options.find(o => o.value === key)) options.push({ value: key, label })
  }
  return options
}

const PERIOD_OPTIONS = generatePeriodOptions()

function currentPeriod(): string {
  return PERIOD_OPTIONS[0]?.value ?? ''
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function calcTaxFromTotal(total: number) {
  const tax = Math.round(total / 1.05 * 0.05)
  return { subtotal: total - tax, taxAmount: tax }
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function InputTaxPage() {
  const [items, setItems]       = useState<InputTaxItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [period, setPeriod]     = useState(currentPeriod)
  const [sourceFilter, setSourceFilter] = useState<string>('ALL')
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [editItem, setEditItem]         = useState<InputTaxItem | null>(null)
  const [saving, setSaving]             = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [quickMode, setQuickMode]       = useState(true)

  // 防呆 state
  const [taxIdError, setTaxIdError]     = useState('')
  const [vendorLookup, setVendorLookup] = useState<VendorLookupResult | null>(null)
  const [lookingUp, setLookingUp]       = useState(false)
  const [invoiceNoError, setInvoiceNoError] = useState('')
  const [taxMismatch, setTaxMismatch]   = useState('')

  // 連續登錄
  const [sessionCount, setSessionCount] = useState(0)

  const invoiceNoRef = useRef<HTMLInputElement>(null)
  const totalAmountRef = useRef<HTMLInputElement>(null)

  const EMPTY_FORM: FormState = {
    vendorName: '', vendorTaxId: '', invoiceNo: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    subtotal: '', taxAmount: '', totalAmount: '',
    sourceType: 'DOMESTIC_INVOICE', taxPeriod: period, attachmentUrl: '',
  }
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  /* ── Fetch ── */
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period, pageSize: '200' })
      if (sourceFilter !== 'ALL') params.set('sourceType', sourceFilter)
      const res = await fetch(`/api/finance/input-tax?${params}`)
      const json = await res.json()
      setItems(json.data ?? [])
    } catch {
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [period, sourceFilter])

  useEffect(() => { fetchItems() }, [fetchItems])

  /* ── Vendor lookup on taxId change ── */
  useEffect(() => {
    if (!form.vendorTaxId) {
      setTaxIdError('')
      setVendorLookup(null)
      return
    }
    if (!/^\d{8}$/.test(form.vendorTaxId)) {
      setTaxIdError(form.vendorTaxId.length > 0 ? '統一編號需為 8 位數字' : '')
      setVendorLookup(null)
      return
    }
    setTaxIdError('')

    let cancelled = false
    const timer = setTimeout(async () => {
      setLookingUp(true)
      try {
        const res = await fetch(`/api/finance/vendor-lookup?taxId=${form.vendorTaxId}`)
        if (!res.ok || cancelled) return
        const data: VendorLookupResult = await res.json()
        if (cancelled) return
        setVendorLookup(data)
        if (data.vendorName && !form.vendorName) {
          setForm(f => ({ ...f, vendorName: data.vendorName! }))
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLookingUp(false)
      }
    }, 300)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [form.vendorTaxId])

  /* ── Invoice number validation ── */
  useEffect(() => {
    if (!form.invoiceNo) { setInvoiceNoError(''); return }
    if (form.sourceType === 'DOMESTIC_INVOICE') {
      const upper = form.invoiceNo.toUpperCase()
      if (upper !== form.invoiceNo) {
        setForm(f => ({ ...f, invoiceNo: upper }))
      }
      setInvoiceNoError(INVOICE_NO_REGEX.test(upper) ? '' : '統一發票格式：2 碼英文 + 8 碼數字（如 AB12345678）')
    } else {
      setInvoiceNoError('')
    }
  }, [form.invoiceNo, form.sourceType])

  /* ── Auto-calc ── */
  useEffect(() => {
    if (quickMode) {
      const total = parseFloat(form.totalAmount) || 0
      if (total > 0) {
        const { subtotal, taxAmount } = calcTaxFromTotal(total)
        setForm(f => ({ ...f, subtotal: String(subtotal), taxAmount: String(taxAmount) }))
      }
    } else {
      const sub = parseFloat(form.subtotal) || 0
      const tax = parseFloat(form.taxAmount) || 0
      if (sub > 0 || tax > 0) {
        setForm(f => ({ ...f, totalAmount: String(Math.round((sub + tax) * 100) / 100) }))
      }
    }
  }, [quickMode ? form.totalAmount : form.subtotal + '|' + form.taxAmount])

  /* ── Tax amount cross-check (normal mode) ── */
  useEffect(() => {
    if (quickMode) { setTaxMismatch(''); return }
    const sub = parseFloat(form.subtotal) || 0
    const tax = parseFloat(form.taxAmount) || 0
    if (sub > 0 && tax > 0) {
      const expected = Math.round(sub * 0.05)
      const diff = Math.abs(tax - expected)
      if (diff > 1) {
        setTaxMismatch(`稅額與 5% 計算值（${fmt(expected)}）差異 ${fmt(diff)} 元`)
      } else {
        setTaxMismatch('')
      }
    } else {
      setTaxMismatch('')
    }
  }, [quickMode, form.subtotal, form.taxAmount])

  /* ── Upload attachment ── */
  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', file.type.startsWith('image/') ? 'image' : 'document')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('上傳失敗'); return }
      const { url } = await res.json()
      setForm(f => ({ ...f, attachmentUrl: url }))
      toast.success('附件上傳完成')
    } catch {
      toast.error('上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  /* ── Open dialog ── */
  function openCreate() {
    setEditItem(null)
    setForm({ ...EMPTY_FORM, taxPeriod: period })
    setVendorLookup(null)
    setSessionCount(0)
    setDialogOpen(true)
  }

  function openEdit(item: InputTaxItem) {
    setEditItem(item)
    setForm({
      vendorName:    item.vendorName,
      vendorTaxId:   item.vendorTaxId ?? '',
      invoiceNo:     item.invoiceNo,
      invoiceDate:   item.invoiceDate.split('T')[0],
      subtotal:      String(item.subtotal),
      taxAmount:     String(item.taxAmount),
      totalAmount:   String(item.totalAmount),
      sourceType:    item.sourceType,
      taxPeriod:     item.taxPeriod,
      attachmentUrl: item.attachmentUrl ?? '',
    })
    setVendorLookup(null)
    setDialogOpen(true)
  }

  /* ── Save ── */
  async function handleSave(continueAfter = false) {
    if (!form.vendorName || !form.invoiceNo || !form.invoiceDate || !form.sourceType || !form.taxPeriod) {
      toast.error('請填寫必要欄位')
      return
    }
    if (taxIdError) {
      toast.error('請修正統一編號格式')
      return
    }
    if (invoiceNoError && form.sourceType === 'DOMESTIC_INVOICE') {
      toast.error('請修正發票號碼格式')
      return
    }

    setSaving(true)
    try {
      const payload = {
        vendorName:    form.vendorName,
        vendorTaxId:   form.vendorTaxId || null,
        invoiceNo:     form.invoiceNo,
        invoiceDate:   form.invoiceDate,
        subtotal:      parseFloat(form.subtotal) || 0,
        taxAmount:     parseFloat(form.taxAmount) || 0,
        totalAmount:   parseFloat(form.totalAmount) || 0,
        sourceType:    form.sourceType,
        taxPeriod:     form.taxPeriod,
        attachmentUrl: form.attachmentUrl || null,
      }

      const url    = editItem ? `/api/finance/input-tax/${editItem.id}` : '/api/finance/input-tax'
      const method = editItem ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        if (res.status === 409 && err.duplicate) {
          toast.warning(`此發票已登錄（${form.invoiceNo}）`, { description: '請確認是否重複' })
          return
        }
        toast.error(err.error ?? '儲存失敗')
        return
      }

      setSessionCount(c => c + 1)
      fetchItems()

      if (continueAfter && !editItem) {
        toast.success(`已新增第 ${sessionCount + 1} 筆`, { duration: 1500 })
        // 保留廠商資訊，清掉發票欄位
        setForm(f => ({
          ...EMPTY_FORM,
          taxPeriod: f.taxPeriod,
          sourceType: f.sourceType,
          vendorName: f.vendorName,
          vendorTaxId: f.vendorTaxId,
        }))
        setInvoiceNoError('')
        setTaxMismatch('')
        setTimeout(() => invoiceNoRef.current?.focus(), 100)
      } else {
        toast.success(editItem ? '已更新' : '已新增')
        setDialogOpen(false)
      }
    } catch {
      toast.error('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  /* ── Delete ── */
  async function handleDelete(id: string) {
    if (!confirm('確定刪除此進項憑證？')) return
    const res = await fetch(`/api/finance/input-tax/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('已刪除'); fetchItems() }
    else toast.error('刪除失敗')
  }

  /* ── Summary ── */
  const totalSubtotal  = items.reduce((s, i) => s + Number(i.subtotal),  0)
  const totalTaxAmount = items.reduce((s, i) => s + Number(i.taxAmount), 0)
  const totalTotal     = items.reduce((s, i) => s + Number(i.totalAmount), 0)

  /* ── Render ── */
  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">進項憑證登錄</h1>
          <p className="text-sm text-slate-500 mt-0.5">登錄進項稅額明細，供 VAT 401 申報使用</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />新增憑證
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-52">
          <Select value={period} onValueChange={v => v && setPeriod(v)}>
            <SelectTrigger>
              <SelectValue placeholder="選擇申報期" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Select value={sourceFilter} onValueChange={v => v && setSourceFilter(v)}>
            <SelectTrigger>
              <SelectValue placeholder="來源類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部類型</SelectItem>
              <SelectItem value="CUSTOMS">進口報單</SelectItem>
              <SelectItem value="DOMESTIC_INVOICE">國內統一發票</SelectItem>
              <SelectItem value="RECEIPT">收據</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>發票/單號</TableHead>
                <TableHead>廠商名稱</TableHead>
                <TableHead>統編</TableHead>
                <TableHead>發票日期</TableHead>
                <TableHead>來源類型</TableHead>
                <TableHead className="text-right">稅前金額</TableHead>
                <TableHead className="text-right">稅額</TableHead>
                <TableHead className="text-right">含稅金額</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-slate-400">
                    本期尚無進項憑證
                  </TableCell>
                </TableRow>
              ) : (
                items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-1.5">
                        {item.invoiceNo}
                        {item.attachmentUrl && (
                          <a
                            href={item.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{item.vendorName}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{item.vendorTaxId ?? '—'}</TableCell>
                    <TableCell className="text-sm">{item.invoiceDate.split('T')[0]}</TableCell>
                    <TableCell>
                      <Badge className={SOURCE_TYPE_COLORS[item.sourceType]}>
                        {SOURCE_TYPE_LABELS[item.sourceType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmt(Number(item.subtotal))}</TableCell>
                    <TableCell className="text-right font-mono text-blue-600">{fmt(Number(item.taxAmount))}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(Number(item.totalAmount))}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4 mr-2" />編輯
                          </DropdownMenuItem>
                          {item.attachmentUrl && (
                            <DropdownMenuItem
                              onClick={() => window.open(item.attachmentUrl!, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />查看附件
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />刪除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary bar */}
      {items.length > 0 && (
        <div className="flex items-center justify-end gap-6 rounded-lg border bg-slate-50 px-6 py-3 text-sm">
          <span className="text-slate-500">本期合計（{items.length} 筆）</span>
          <div className="flex gap-6">
            <div className="text-right">
              <div className="text-xs text-slate-500">稅前金額</div>
              <div className="font-mono font-semibold text-slate-700">{fmt(totalSubtotal)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">進項稅額</div>
              <div className="font-mono font-semibold text-blue-600">{fmt(totalTaxAmount)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">含稅合計</div>
              <div className="font-mono font-semibold text-slate-800">{fmt(totalTotal)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? '編輯進項憑證' : '新增進項憑證'}</DialogTitle>
            {!editItem && sessionCount > 0 && (
              <DialogDescription>本次已登錄 {sessionCount} 筆</DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 申報期 + 來源類型 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>申報期 <span className="text-red-500">*</span></Label>
                <Select
                  value={form.taxPeriod}
                  onValueChange={v => v && setForm(f => ({ ...f, taxPeriod: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇期別" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>來源類型 <span className="text-red-500">*</span></Label>
                <Select
                  value={form.sourceType}
                  onValueChange={v => v && setForm(f => ({ ...f, sourceType: v as SourceType }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOMESTIC_INVOICE">國內統一發票</SelectItem>
                    <SelectItem value="CUSTOMS">進口報單</SelectItem>
                    <SelectItem value="RECEIPT">收據</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 廠商統編 + 名稱（統編在前，輸入後自動帶出名稱） */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  廠商統編
                  {lookingUp && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                </Label>
                <div className="relative">
                  <Input
                    value={form.vendorTaxId}
                    onChange={e => setForm(f => ({ ...f, vendorTaxId: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                    placeholder="12345678"
                    maxLength={8}
                    className={
                      form.vendorTaxId
                        ? taxIdError
                          ? 'border-red-400 focus-visible:ring-red-400 pr-8'
                          : 'border-green-400 focus-visible:ring-green-400 pr-8'
                        : ''
                    }
                  />
                  {form.vendorTaxId && !taxIdError && (
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  )}
                </div>
                {taxIdError && <p className="text-xs text-red-500">{taxIdError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>廠商名稱 <span className="text-red-500">*</span></Label>
                <Input
                  value={form.vendorName}
                  onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))}
                  placeholder="輸入統編自動帶出"
                />
              </div>
            </div>

            {/* 統編查詢結果 */}
            {vendorLookup && vendorLookup.source !== 'none' && (
              <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                vendorLookup.source === 'supplier'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {vendorLookup.source === 'supplier' ? (
                  <>
                    <Building2 className="h-4 w-4 shrink-0" />
                    供應商：{vendorLookup.vendorName}
                    {vendorLookup.supplierCode && (
                      <span className="text-xs opacity-70">({vendorLookup.supplierCode})</span>
                    )}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    歷史紀錄：{vendorLookup.vendorName}
                  </>
                )}
                {form.vendorName && vendorLookup.vendorName && form.vendorName !== vendorLookup.vendorName && (
                  <button
                    type="button"
                    className="ml-auto text-xs underline"
                    onClick={() => setForm(f => ({ ...f, vendorName: vendorLookup.vendorName! }))}
                  >
                    套用
                  </button>
                )}
              </div>
            )}

            {/* 名稱不一致警告 */}
            {vendorLookup?.vendorName && form.vendorName && form.vendorName !== vendorLookup.vendorName && (
              <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                廠商名稱與{vendorLookup.source === 'supplier' ? '供應商資料' : '歷史紀錄'}不一致
              </div>
            )}

            {/* 發票號碼 + 日期 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>發票/單號 <span className="text-red-500">*</span></Label>
                <Input
                  ref={invoiceNoRef}
                  value={form.invoiceNo}
                  onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value.toUpperCase() }))}
                  placeholder={form.sourceType === 'DOMESTIC_INVOICE' ? 'AB12345678' : '單號'}
                  className={invoiceNoError ? 'border-orange-400 focus-visible:ring-orange-400' : ''}
                />
                {invoiceNoError && <p className="text-xs text-orange-500">{invoiceNoError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>發票日期 <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.invoiceDate}
                  onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))}
                />
              </div>
            </div>

            {/* 金額 — 快速/一般模式切換 */}
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-sm font-medium">金額</Label>
              <button
                type="button"
                onClick={() => setQuickMode(!quickMode)}
                className="text-xs text-blue-600 hover:underline"
              >
                {quickMode ? '切換一般模式（分別輸入）' : '切換快速模式（只輸含稅總額）'}
              </button>
            </div>
            {quickMode ? (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label>含稅金額 <span className="text-red-500">*</span></Label>
                  <Input
                    ref={totalAmountRef}
                    type="number"
                    value={form.totalAmount}
                    onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                    placeholder="輸入含稅總額，自動拆分稅額"
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(true) }}
                  />
                </div>
                {parseFloat(form.totalAmount) > 0 && (
                  <div className="flex items-center gap-1 text-sm text-slate-500 bg-slate-50 rounded px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    稅前 <span className="font-mono font-medium">{fmt(parseFloat(form.subtotal) || 0)}</span>
                    ＋ 稅額 <span className="font-mono font-medium text-blue-600">{fmt(parseFloat(form.taxAmount) || 0)}</span>
                    <span className="text-xs text-slate-400 ml-1">（÷1.05×0.05）</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>稅前金額</Label>
                    <Input
                      type="number"
                      value={form.subtotal}
                      onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>稅額（5%）</Label>
                    <Input
                      type="number"
                      value={form.taxAmount}
                      onChange={e => setForm(f => ({ ...f, taxAmount: e.target.value }))}
                      placeholder="0"
                      className={taxMismatch ? 'border-orange-400 focus-visible:ring-orange-400' : ''}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>含稅金額</Label>
                    <Input
                      type="number"
                      value={form.totalAmount}
                      disabled
                      placeholder="自動計算"
                    />
                  </div>
                </div>
                {taxMismatch && (
                  <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {taxMismatch}
                  </div>
                )}
              </div>
            )}

            {/* 附件上傳 */}
            <div className="space-y-1.5">
              <Label>附件（PDF / 圖片）</Label>
              {form.attachmentUrl ? (
                <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                  <Paperclip className="h-4 w-4 text-slate-400" />
                  <a
                    href={form.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 truncate text-blue-600 hover:underline"
                  >
                    {form.attachmentUrl.split('/').pop()}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setForm(f => ({ ...f, attachmentUrl: '' }))}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="cursor-pointer"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(file)
                    }}
                  />
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {sessionCount > 0 ? `完成（已登 ${sessionCount} 筆）` : '取消'}
            </Button>
            {!editItem && (
              <Button
                variant="secondary"
                onClick={() => handleSave(true)}
                disabled={saving || uploading}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                儲存並繼續
              </Button>
            )}
            <Button onClick={() => handleSave(false)} disabled={saving || uploading}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editItem ? '儲存變更' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
