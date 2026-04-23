'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Loader2, ChevronDown, ChevronRight, Printer, RefreshCw, FileDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface OutputInvoice {
  id: string
  invoiceNumber: string
  date: string
  customerName: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  invoiceType: string
}

interface InputItem {
  id: string
  invoiceNo: string
  invoiceDate: string
  vendorName: string
  sourceType: string
  subtotal: number
  taxAmount: number
  totalAmount: number
}

interface VatSummary {
  outputTaxBase: number
  outputTax: number
  inputTaxBase: number
  inputTax: number
  netTax: number
  status: 'PAYABLE' | 'REFUNDABLE'
}

interface ExportValidation {
  period: string
  companyTaxId: string
  outputCount: number
  inputCount: number
  outputAmount: number
  outputTax: number
  inputAmount: number
  inputTax: number
  netTax: number
  warnings: Array<{ line: number; field: string; message: string }>
}

interface VatData {
  period: string
  startDate: string
  endDate: string
  summary: VatSummary
  detail: {
    outputInvoices: OutputInvoice[]
    inputItems: InputItem[]
  }
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function generatePeriodOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 2, 1)
    const year = d.getFullYear()
    const m = d.getMonth() + 1
    const odd = m % 2 === 0 ? m - 1 : m
    const key = `${year}-${String(odd).padStart(2, '0')}`
    const label = `${year} 年 ${odd}–${odd + 1} 月（${key}）`
    if (!options.find(o => o.value === key)) options.push({ value: key, label })
  }
  return options
}

const PERIOD_OPTIONS = generatePeriodOptions()

function fmt(n: number) {
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const SOURCE_LABELS: Record<string, string> = {
  CUSTOMS: '進口報單',
  DOMESTIC_INVOICE: '國內統一發票',
  RECEIPT: '收據',
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function VatSummaryPage() {
  const [period, setPeriod]   = useState(PERIOD_OPTIONS[0]?.value ?? '')
  const [data, setData]       = useState<VatData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showOutput, setShowOutput] = useState(false)
  const [showInput, setShowInput]   = useState(false)
  const [exportDialog, setExportDialog] = useState(false)
  const [exportValidation, setExportValidation] = useState<ExportValidation | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    if (!period) return
    setLoading(true)
    setData(null)
    try {
      const res = await fetch(`/api/finance/vat-summary?period=${period}`)
      if (!res.ok) { toast.error('載入失敗'); return }
      setData(await res.json())
    } catch {
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  function handlePrint() {
    window.print()
  }

  async function handleExportClick() {
    if (!period) return
    setExportLoading(true)
    setExportValidation(null)
    try {
      const res = await fetch(`/api/finance/vat-filings/export-txt?period=${period}&mode=validate`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.error ?? '驗證失敗')
        return
      }
      const validation: ExportValidation = await res.json()
      setExportValidation(validation)
      setExportDialog(true)
    } catch {
      toast.error('驗證失敗')
    } finally {
      setExportLoading(false)
    }
  }

  function handleExportConfirm() {
    const link = document.createElement('a')
    link.href = `/api/finance/vat-filings/export-txt?period=${period}`
    link.download = ''
    link.click()
    setExportDialog(false)
    toast.success('401 媒體檔已下載')
  }

  const s = data?.summary

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">401 VAT 試算</h1>
          <p className="text-sm text-slate-500 mt-0.5">雙月銷項 - 進項 = 應繳稅額試算</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            重新計算
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!data} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            列印 / PDF
          </Button>
          <Button variant="outline" size="sm" disabled={!data || exportLoading} className="gap-1.5"
            onClick={handleExportClick}>
            {exportLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <FileDown className="h-3.5 w-3.5" />}
            匯出 401 TXT
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">申報期</span>
        <div className="w-64">
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
        {data && (
          <span className="text-sm text-slate-400">
            {data.startDate} ～ {data.endDate}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {/* Content */}
      {!loading && data && (
        <div ref={printRef} className="space-y-4">

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <SummaryCard
              label="銷項稅基"
              value={fmt(s!.outputTaxBase)}
              sub="（不含稅銷售額）"
              color="text-slate-700"
            />
            <SummaryCard
              label="銷項稅額"
              value={fmt(s!.outputTax)}
              sub={`${data.detail.outputInvoices.length} 張發票`}
              color="text-blue-600"
            />
            <SummaryCard
              label="進項稅基"
              value={fmt(s!.inputTaxBase)}
              sub="（不含稅採購額）"
              color="text-slate-700"
            />
            <SummaryCard
              label="進項稅額"
              value={fmt(s!.inputTax)}
              sub={`${data.detail.inputItems.length} 筆憑證`}
              color="text-green-600"
            />
            <Card className={`border-2 ${s!.status === 'PAYABLE' ? 'border-orange-400' : 'border-green-400'}`}>
              <CardContent className="p-4 text-center">
                <div className="text-xs text-slate-500 mb-1">
                  {s!.status === 'PAYABLE' ? '應繳稅額' : '可退稅額'}
                </div>
                <div className={`text-2xl font-bold font-mono ${s!.status === 'PAYABLE' ? 'text-orange-600' : 'text-green-600'}`}>
                  {fmt(s!.netTax)}
                </div>
                <Badge className={`mt-1 text-xs ${s!.status === 'PAYABLE' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  {s!.status === 'PAYABLE' ? '需繳稅' : '可申請退稅'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Formula display */}
          <div className="flex items-center justify-center gap-4 rounded-lg bg-slate-50 py-4 text-sm">
            <div className="text-center">
              <div className="text-xs text-slate-500">銷項稅額</div>
              <div className="font-mono font-semibold text-blue-600">{fmt(s!.outputTax)}</div>
            </div>
            <span className="text-slate-400 text-lg">−</span>
            <div className="text-center">
              <div className="text-xs text-slate-500">進項稅額</div>
              <div className="font-mono font-semibold text-green-600">{fmt(s!.inputTax)}</div>
            </div>
            <span className="text-slate-400 text-lg">=</span>
            <div className="text-center">
              <div className="text-xs text-slate-500">{s!.status === 'PAYABLE' ? '應繳' : '可退'}</div>
              <div className={`font-mono font-semibold text-lg ${s!.status === 'PAYABLE' ? 'text-orange-600' : 'text-green-600'}`}>
                {fmt(s!.netTax)}
              </div>
            </div>
          </div>

          {/* Output invoices detail */}
          <Card>
            <CardHeader
              className="cursor-pointer py-3 px-4"
              onClick={() => setShowOutput(v => !v)}
            >
              <div className="flex items-center gap-2">
                {showOutput
                  ? <ChevronDown className="h-4 w-4 text-slate-400" />
                  : <ChevronRight className="h-4 w-4 text-slate-400" />
                }
                <CardTitle className="text-sm font-semibold">
                  銷項明細（{data.detail.outputInvoices.length} 張）
                </CardTitle>
                <span className="ml-auto text-sm text-slate-500 font-mono">
                  稅額合計 {fmt(s!.outputTax)}
                </span>
              </div>
            </CardHeader>
            {showOutput && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>發票號碼</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>客戶名稱</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead className="text-right">稅前</TableHead>
                      <TableHead className="text-right">稅額</TableHead>
                      <TableHead className="text-right">含稅</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.detail.outputInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-6 text-center text-slate-400">本期無銷項發票</TableCell>
                      </TableRow>
                    ) : data.detail.outputInvoices.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-sm">{inv.date.split('T')[0]}</TableCell>
                        <TableCell>{inv.customerName}</TableCell>
                        <TableCell>
                          <Badge className="bg-blue-100 text-blue-700 text-xs">
                            {inv.invoiceType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(inv.subtotal))}</TableCell>
                        <TableCell className="text-right font-mono text-blue-600">{fmt(Number(inv.taxAmount))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(inv.totalAmount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>

          {/* Input items detail */}
          <Card>
            <CardHeader
              className="cursor-pointer py-3 px-4"
              onClick={() => setShowInput(v => !v)}
            >
              <div className="flex items-center gap-2">
                {showInput
                  ? <ChevronDown className="h-4 w-4 text-slate-400" />
                  : <ChevronRight className="h-4 w-4 text-slate-400" />
                }
                <CardTitle className="text-sm font-semibold">
                  進項明細（{data.detail.inputItems.length} 筆）
                </CardTitle>
                <span className="ml-auto text-sm text-slate-500 font-mono">
                  稅額合計 {fmt(s!.inputTax)}
                </span>
              </div>
            </CardHeader>
            {showInput && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>發票/單號</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>廠商名稱</TableHead>
                      <TableHead>來源</TableHead>
                      <TableHead className="text-right">稅前</TableHead>
                      <TableHead className="text-right">稅額</TableHead>
                      <TableHead className="text-right">含稅</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.detail.inputItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-6 text-center text-slate-400">本期無進項憑證</TableCell>
                      </TableRow>
                    ) : data.detail.inputItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.invoiceNo}</TableCell>
                        <TableCell className="text-sm">{item.invoiceDate.split('T')[0]}</TableCell>
                        <TableCell>{item.vendorName}</TableCell>
                        <TableCell>
                          <Badge className="bg-slate-100 text-slate-700 text-xs">
                            {SOURCE_LABELS[item.sourceType] ?? item.sourceType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(item.subtotal))}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{fmt(Number(item.taxAmount))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(item.totalAmount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>

        </div>
      )}

      {/* Empty state */}
      {!loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <p>請選擇申報期以載入資料</p>
        </div>
      )}

      {/* Export preview dialog */}
      <Dialog open={exportDialog} onOpenChange={setExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>匯出 401 媒體申報檔</DialogTitle>
            <DialogDescription>
              確認以下資料無誤後下載 TXT 檔，匯入營業稅離線建檔系統
            </DialogDescription>
          </DialogHeader>

          {exportValidation && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">申報期</span>
                  <span className="font-mono font-medium">{exportValidation.period}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">公司統編</span>
                  <span className="font-mono font-medium">{exportValidation.companyTaxId}</span>
                </div>
                <div className="border-t my-1.5" />
                <div className="flex justify-between">
                  <span className="text-slate-500">銷項筆數</span>
                  <span className="font-mono">{exportValidation.outputCount} 筆</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">銷項稅額</span>
                  <span className="font-mono text-blue-600">{fmt(exportValidation.outputTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">進項筆數</span>
                  <span className="font-mono">{exportValidation.inputCount} 筆</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">進項稅額</span>
                  <span className="font-mono text-green-600">{fmt(exportValidation.inputTax)}</span>
                </div>
                <div className="border-t my-1.5" />
                <div className="flex justify-between font-medium">
                  <span>應繳 / 可退</span>
                  <span className={`font-mono ${exportValidation.netTax >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {fmt(exportValidation.netTax)}
                  </span>
                </div>
              </div>

              {exportValidation.companyTaxId === '00000000' && (
                <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-sm text-orange-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>公司統編未設定（COMPANY_TAX_ID），匯出將使用 00000000</span>
                </div>
              )}

              {exportValidation.warnings.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    {exportValidation.warnings.length} 項警告
                  </div>
                  <div className="max-h-32 overflow-y-auto rounded border bg-orange-50 p-2 text-xs text-orange-700 space-y-0.5">
                    {exportValidation.warnings.map((w, i) => (
                      <div key={i}>{w.message}</div>
                    ))}
                  </div>
                </div>
              )}

              {exportValidation.warnings.length === 0 && exportValidation.companyTaxId !== '00000000' && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-2.5 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  資料驗證通過，可以匯出
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialog(false)}>取消</Button>
            <Button onClick={handleExportConfirm} className="gap-1.5">
              <FileDown className="h-4 w-4" />
              下載 TXT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(#print-root) { display: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}

/* ─── Summary Card ───────────────────────────────────────────────────────────── */

function SummaryCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub: string; color: string
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className="text-xs text-slate-500 mb-1">{label}</div>
        <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
        <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  )
}
