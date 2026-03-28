'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

interface TxRow {
  id: string; date: string; type: string
  referenceNo: string; description: string
  debit: number; credit: number; balance: number
}
interface TxData {
  party: { id: string; name: string; code: string; type: string }
  period: { startDate: string; endDate: string }
  summary: { totalDebit: number; totalCredit: number; netBalance: number }
  rows: TxRow[]
}

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  AR:          { label: '應收',   className: 'bg-blue-100 text-blue-700' },
  AP:          { label: '應付',   className: 'bg-amber-100 text-amber-700' },
  PAYMENT_IN:  { label: '收款',   className: 'bg-green-100 text-green-700' },
  PAYMENT_OUT: { label: '付款',   className: 'bg-red-100 text-red-700' },
}

function fmt(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function PartyTransactionsPage() {
  const searchParams = useSearchParams()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`

  const [partyType, setPartyType] = useState(searchParams.get('partyType') ?? 'CUSTOMER')
  const [partyId, setPartyId] = useState(searchParams.get('partyId') ?? '')
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate] = useState(today)
  const [data, setData] = useState<TxData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!partyId) { toast.error('請輸入往來對象 ID'); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ partyType, partyId, startDate, endDate })
      const res = await fetch(`/api/finance/party-transactions?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? '載入失敗')
      setData(await res.json())
    } catch (e) { toast.error(e instanceof Error ? e.message : '載入失敗') }
    finally { setLoading(false) }
  }, [partyType, partyId, startDate, endDate])

  // Auto-query if partyId is pre-filled from URL
  useEffect(() => {
    if (searchParams.get('partyId')) fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">往來交易明細</h1>
          <p className="text-sm text-muted-foreground">查詢客戶或供應商所有交易記錄</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">往來類型</label>
          <select value={partyType} onChange={e => { setPartyType(e.target.value); setData(null) }} className="rounded-md border px-3 py-2 text-sm">
            <option value="CUSTOMER">客戶</option>
            <option value="SUPPLIER">供應商</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">ID</label>
          <input
            type="text" value={partyId} onChange={e => setPartyId(e.target.value)}
            placeholder="貼上客戶/供應商 ID"
            className="rounded-md border px-3 py-2 text-sm w-64"
          />
        </div>
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

      {data && (
        <>
          <div className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3">
            <Badge className={partyType === 'CUSTOMER' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}>
              {partyType === 'CUSTOMER' ? '客戶' : '供應商'}
            </Badge>
            <span className="font-semibold">{data.party.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{data.party.code}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: partyType === 'CUSTOMER' ? '應收合計' : '應付合計', value: data.summary.totalDebit, color: 'text-slate-900' },
              { label: partyType === 'CUSTOMER' ? '收款合計' : '付款合計', value: data.summary.totalCredit, color: 'text-green-600' },
              { label: '淨餘額', value: data.summary.netBalance, color: data.summary.netBalance >= 0 ? 'text-slate-900 font-bold' : 'text-red-600 font-bold' },
            ].map(c => (
              <div key={c.label} className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-base font-mono ${c.color}`}>${data.summary.totalDebit === 0 && data.summary.totalCredit === 0 ? '0' : Math.abs(c.value).toLocaleString('zh-TW', { minimumFractionDigits: 0 })}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">日期</TableHead>
                  <TableHead className="w-20">類型</TableHead>
                  <TableHead className="w-32">單號</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead className="text-right w-28">借方</TableHead>
                  <TableHead className="text-right w-28">貸方</TableHead>
                  <TableHead className="text-right w-32">累計餘額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">本期間無交易記錄</TableCell></TableRow>
                ) : (
                  data.rows.map(row => {
                    const cfg = TYPE_CONFIG[row.type] ?? { label: row.type, className: 'bg-slate-100 text-slate-600' }
                    return (
                      <TableRow key={row.id} className="text-sm hover:bg-slate-50/40">
                        <TableCell className="text-muted-foreground">{row.date}</TableCell>
                        <TableCell><Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{row.referenceNo || '—'}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.debit)}</TableCell>
                        <TableCell className="text-right font-mono text-green-700">{fmt(row.credit)}</TableCell>
                        <TableCell className={`text-right font-mono font-medium ${row.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          ${Math.abs(row.balance).toLocaleString('zh-TW', { minimumFractionDigits: 0 })}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">
          請輸入往來對象 ID 並點擊查詢
        </div>
      )}
    </div>
  )
}
