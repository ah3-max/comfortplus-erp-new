'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, Loader2, MoreHorizontal, Pencil, Trash2, Paperclip, ExternalLink,
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

/** 產生近 12 個雙月期別選項，格式 YYYY-MM（奇數月） */
function generatePeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 2, 1)
    const year  = d.getFullYear()
    const month = d.getMonth() % 2 === 0 ? d.getMonth() : d.getMonth() - 1
    // 對齊到奇數月（1-based）
    const startMonth = (month % 2 === 0 ? month : month - 1) + 1
    // clamp to valid odd month
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
  const [quickMode, setQuickMode]       = useState(false)  // 快速登錄：只輸含稅總額
  const [taxIdError, setTaxIdError]     = useState('')     // 統編驗證錯誤

  const EMPTY_FORM: FormState = {
    vendorName: '', vendorTaxId: '', invoiceNo: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    subtotal: '', taxAmount: '', totalAmount: '',
    sourceType: '', taxPeriod: period, attachmentUrl: '',
  }
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  /* ── Fetch ── */
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period, pageSize: '100' })
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

  /* ── Auto-calc ── */
  useEffect(() => {
    if (quickMode) {
      // Quick mode: auto-split total → subtotal + tax
      const total = parseFloat(form.totalAmount) || 0
      if (total > 0) {
        const tax = Math.round(total / 1.05 * 0.05)
        const sub = total - tax
        setForm(f => ({ ...f, subtotal: String(sub), taxAmount: String(tax) }))
      }
    } else {
      // Normal mode: auto-calc total from subtotal + tax
      const sub = parseFloat(form.subtotal) || 0
      const tax = parseFloat(form.taxAmount) || 0
      if (sub > 0 || tax > 0) {
        setForm(f => ({ ...f, totalAmount: String(Math.round((sub + tax) * 100) / 100) }))
      }
    }
  }, [quickMode ? form.totalAmount : form.subtotal + '|' + form.taxAmount])

  /* ── Tax ID validation ── */
  useEffect(() => {
    if (!form.vendorTaxId) { setTaxIdError(''); return }
    setTaxIdError(/^\d{8}$/.test(form.vendorTaxId) ? '' : '統一編號需為8位數字')
  }, [form.vendorTaxId])

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
    setDialogOpen(true)
  }

  /* ── Save ── */
  async function handleSave() {
    if (!form.vendorName || !form.invoiceNo || !form.invoiceDate || !form.sourceType || !form.taxPeriod) {
      toast.error('請填寫必要欄位')
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
          const proceed = confirm(`${err.error}\n\n是否仍要新增？`)
          if (!proceed) return
          // Re-submit with a flag to skip duplicate check (or user cancels)
          toast.warning('此發票已存在，請確認是否重複登錄')
          return
        }
        toast.error(err.error ?? '儲存失敗')
        return
      }

      toast.success(editItem ? '已更新' : '已新增')
      setDialogOpen(false)
      fetchItems()
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? '編輯進項憑證' : '新增進項憑證'}</DialogTitle>
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

            {/* 廠商 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>廠商名稱 <span className="text-red-500">*</span></Label>
                <Input
                  value={form.vendorName}
                  onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))}
                  placeholder="廠商名稱"
                />
              </div>
              <div className="space-y-1.5">
                <Label>廠商統編</Label>
                <Input
                  value={form.vendorTaxId}
                  onChange={e => setForm(f => ({ ...f, vendorTaxId: e.target.value }))}
                  placeholder="12345678"
                  maxLength={8}
                  className={form.vendorTaxId ? (taxIdError ? 'border-red-400 focus-visible:ring-red-400' : 'border-green-400 focus-visible:ring-green-400') : ''}
                />
                {taxIdError && <p className="text-xs text-red-500">{taxIdError}</p>}
              </div>
            </div>

            {/* 發票 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>發票/單號 <span className="text-red-500">*</span></Label>
                <Input
                  value={form.invoiceNo}
                  onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value }))}
                  placeholder="AB12345678"
                />
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
                    type="number"
                    value={form.totalAmount}
                    onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                    placeholder="輸入含稅總額，自動拆分稅額"
                    autoFocus
                  />
                </div>
                {parseFloat(form.totalAmount) > 0 && (
                  <div className="text-sm text-slate-500 bg-slate-50 rounded px-3 py-2">
                    自動拆分：稅前 <span className="font-medium">${fmt(parseFloat(form.subtotal) || 0)}</span>
                    ，稅額 <span className="font-medium">${fmt(parseFloat(form.taxAmount) || 0)}</span>
                  </div>
                )}
              </div>
            ) : (
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
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>含稅金額</Label>
                  <Input
                    type="number"
                    value={form.totalAmount}
                    onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                    placeholder="自動計算"
                    disabled
                  />
                </div>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editItem ? '儲存變更' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
