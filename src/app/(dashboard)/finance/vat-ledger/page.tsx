'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft, FileInput, FileOutput } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface VatRow {
  id: string; date: string; invoiceNo: string; partyName: string; partyCode: string
  currency: string; subtotal: number; taxAmount: number; totalAmount: number; status: string
}
interface VatData {
  type: 'OUTPUT' | 'INPUT'; rows: VatRow[]
  summary: { count: number; subtotalSum: number; taxSum: number; totalSum: number }
  period: { startDate: string; endDate: string }
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿', CONFIRMED: '確認', DELIVERED: '已出貨', COMPLETED: '完成',
  NOT_DUE: '未到期', DUE: '逾期', PARTIAL_PAID: '部分付', PAID: '已付',
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function VatLedgerPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [outputData, setOutputData] = useState<VatData | null>(null)
  const [inputData, setInputData] = useState<VatData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const [outRes, inRes] = await Promise.all([
        fetch(`/api/finance/vat-ledger?${params}&type=OUTPUT`),
        fetch(`/api/finance/vat-ledger?${params}&type=INPUT`),
      ])
      if (!outRes.ok || !inRes.ok) throw new Error()
      setOutputData(await outRes.json())
      setInputData(await inRes.json())
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [startDate, endDate])

  function VatTable({ data }: { data: VatData | null }) {
    if (!data) return <div className="py-12 text-center text-muted-foreground">請點擊查詢</div>
    return (
      <div className="space-y-3">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '筆數', value: `${data.summary.count} 筆`, mono: false },
            { label: '稅前合計', value: `$${fmt(data.summary.subtotalSum)}`, mono: true },
            { label: '稅額合計', value: `$${fmt(data.summary.taxSum)}`, mono: true },
            { label: '含稅合計', value: `$${fmt(data.summary.totalSum)}`, mono: true, bold: true },
          ].map(c => (
            <div key={c.label} className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className={`text-sm ${c.mono ? 'font-mono' : ''} ${c.bold ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">日期</TableHead>
                <TableHead className="w-32">發票號</TableHead>
                <TableHead>{data.type === 'OUTPUT' ? '客戶' : '供應商'}</TableHead>
                <TableHead className="w-16">幣別</TableHead>
                <TableHead className="text-right w-28">稅前金額</TableHead>
                <TableHead className="text-right w-24">稅額</TableHead>
                <TableHead className="text-right w-28">含稅金額</TableHead>
                <TableHead className="w-20">狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">本期間無資料</TableCell></TableRow>
              ) : (
                <>
                  {data.rows.map(row => (
                    <TableRow key={row.id} className="text-sm hover:bg-slate-50/40">
                      <TableCell className="text-muted-foreground">{row.date}</TableCell>
                      <TableCell className="font-mono text-xs">{row.invoiceNo || '—'}</TableCell>
                      <TableCell>
                        <div>{row.partyName}</div>
                        {row.partyCode && <div className="text-xs text-muted-foreground">{row.partyCode}</div>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.currency}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(row.subtotal)}</TableCell>
                      <TableCell className="text-right font-mono text-amber-600">{row.taxAmount > 0 ? fmt(row.taxAmount) : '—'}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{fmt(row.totalAmount)}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{STATUS_LABELS[row.status] ?? row.status}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-semibold text-sm border-t-2">
                    <TableCell colSpan={4}>合計 {data.summary.count} 筆</TableCell>
                    <TableCell className="text-right font-mono">{fmt(data.summary.subtotalSum)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">{fmt(data.summary.taxSum)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(data.summary.totalSum)}</TableCell>
                    <TableCell />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">進項/銷項帳簿</h1>
          <p className="text-sm text-muted-foreground">銷貨發票（銷項）與進貨發票（進項）明細</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">開始</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">結束</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}查詢
        </Button>
      </div>

      <Tabs defaultValue="output">
        <TabsList>
          <TabsTrigger value="output"><FileOutput className="mr-1.5 h-4 w-4" />銷項帳簿</TabsTrigger>
          <TabsTrigger value="input"><FileInput className="mr-1.5 h-4 w-4" />進項帳簿</TabsTrigger>
        </TabsList>
        <TabsContent value="output" className="mt-4"><VatTable data={outputData} /></TabsContent>
        <TabsContent value="input" className="mt-4"><VatTable data={inputData} /></TabsContent>
      </Tabs>
    </div>
  )
}
