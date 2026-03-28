'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, FileText, Send, CheckCircle2, AlertTriangle, XCircle, Printer } from 'lucide-react'
import { toast } from 'sonner'

interface StatementRow {
  id: string
  statementNo: string
  periodStart: string
  periodEnd: string
  openingBalance: number
  totalBilled: number
  totalReceived: number
  totalAdjustment: number
  closingBalance: number
  status: string
  customerConfirmedAt: string | null
  createdAt: string
  customer: { id: string; name: string; code: string }
}

interface StatementDetail extends StatementRow {
  customer: { id: string; name: string; code: string; taxId: string | null; address: string | null; contactPerson: string | null; phone: string | null }
  disputeNote: string | null
  notes: string | null
  lineItems: LineItem[] | null
}

interface LineItem {
  type: 'OPENING' | 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT'
  date: string
  description: string
  debit: number
  credit: number
  balance: number
  refId?: string
}

interface Customer { id: string; name: string; code: string }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT:     { label: '草稿',   color: 'bg-gray-100 text-gray-600 border-gray-200',     icon: FileText },
  SENT:      { label: '已寄出', color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: Send },
  CONFIRMED: { label: '客戶確認', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  DISPUTED:  { label: '客戶異議', color: 'bg-red-100 text-red-700 border-red-200',       icon: AlertTriangle },
  VOID:      { label: '已作廢', color: 'bg-gray-100 text-gray-400 border-gray-200',     icon: XCircle },
}

export default function StatementsPage() {
  const { dict } = useI18n()
  const [rows, setRows] = useState<StatementRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [customerFilter, setCustomerFilter] = useState('ALL')
  const [showGenerate, setShowGenerate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<StatementDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Generate form
  const [genCustomerId, setGenCustomerId] = useState('')
  const [genPeriodStart, setGenPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [genPeriodEnd, setGenPeriodEnd] = useState(() => {
    const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10)  // last day of prev month
  })
  const [genNotes, setGenNotes] = useState('')
  const [generating, setGenerating] = useState(false)

  const fmt = (n: number) =>
    new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '50' })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (customerFilter !== 'ALL') params.set('customerId', customerFilter)
      const res = await fetch(`/api/statements?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setRows(json.data)
    } catch { toast.error('載入失敗') }
    finally { setLoading(false) }
  }, [statusFilter, customerFilter])

  useEffect(() => { load() }, [load])

  // Load customers for filter/generate
  useEffect(() => {
    fetch('/api/customers?pageSize=200&isActive=true')
      .then(r => r.json())
      .then(j => setCustomers(j.data ?? []))
      .catch(() => {})
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailId(id)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await fetch(`/api/statements/${id}`)
      if (!res.ok) throw new Error()
      setDetail(await res.json())
    } catch { toast.error('載入失敗') }
    finally { setDetailLoading(false) }
  }, [])

  const doAction = async (action: string, extra?: Record<string, unknown>) => {
    if (!detailId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/statements/${detailId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success('操作成功')
      loadDetail(detailId)
      load()
    } catch (e) { toast.error(String(e instanceof Error ? e.message : '操作失敗')) }
    finally { setActionLoading(false) }
  }

  const generate = async () => {
    if (!genCustomerId || !genPeriodStart || !genPeriodEnd) {
      toast.error('請選擇客戶與期間')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: genCustomerId, periodStart: genPeriodStart, periodEnd: genPeriodEnd, notes: genNotes }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const stmt = await res.json()
      toast.success(`對帳單 ${stmt.statementNo} 已建立`)
      setShowGenerate(false)
      load()
    } catch (e) { toast.error(String(e instanceof Error ? e.message : '建立失敗')) }
    finally { setGenerating(false) }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.statements ?? '月結對帳單'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">產生客戶月結對帳單，追蹤確認狀態</p>
        </div>
        <Button className="gap-1.5 self-start sm:self-auto" onClick={() => setShowGenerate(true)}>
          <Plus size={15} />產生對帳單
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={v => { if (v) setStatusFilter(v) }}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部狀態</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={customerFilter} onValueChange={v => { if (v) setCustomerFilter(v) }}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="全部客戶" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部客戶</SelectItem>
            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">對帳單號</th>
              <th className="px-4 py-3 text-left">客戶</th>
              <th className="px-4 py-3 text-center">期間</th>
              <th className="px-4 py-3 text-right">期初餘額</th>
              <th className="px-4 py-3 text-right">本期帳款</th>
              <th className="px-4 py-3 text-right">本期收款</th>
              <th className="px-4 py-3 text-right">期末餘額</th>
              <th className="px-4 py-3 text-center">狀態</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400">載入中…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400">尚無對帳單</td></tr>
            ) : rows.map(row => {
              const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.DRAFT
              return (
                <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{row.statementNo}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.customer.name}</div>
                    <div className="text-xs text-gray-400">{row.customer.code}</div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">
                    {row.periodStart.slice(0, 10)} ~ {row.periodEnd.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(Number(row.openingBalance))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(Number(row.totalBilled))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-600">{fmt(Number(row.totalReceived))}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    <span className={Number(row.closingBalance) > 0 ? 'text-orange-600' : 'text-green-600'}>
                      {fmt(Number(row.closingBalance))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={`${cfg.color} border text-xs`}>{cfg.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => loadDetail(row.id)}>
                      查看
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Generate dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>產生月結對帳單</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-gray-600 mb-1">客戶 *</label>
              <Select value={genCustomerId} onValueChange={v => { if (v) setGenCustomerId(v) }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="選擇客戶…" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-600 mb-1">期間起 *</label>
                <Input type="date" value={genPeriodStart} onChange={e => setGenPeriodStart(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">期間迄 *</label>
                <Input type="date" value={genPeriodEnd} onChange={e => setGenPeriodEnd(e.target.value)} className="h-9" />
              </div>
            </div>
            <div>
              <label className="block text-gray-600 mb-1">備註</label>
              <Input value={genNotes} onChange={e => setGenNotes(e.target.value)} className="h-9" placeholder="選填" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>取消</Button>
            <Button onClick={generate} disabled={generating}>
              {generating ? '產生中…' : '產生對帳單'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={open => { if (!open) { setDetailId(null); setDetail(null) } }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail ? (
                <>
                  <span>{detail.statementNo}</span>
                  <span className="text-gray-400 font-normal text-sm">— {detail.customer.name}</span>
                  {detail.status && (
                    <Badge className={`${(STATUS_CONFIG[detail.status] ?? STATUS_CONFIG.DRAFT).color} border text-xs ml-1`}>
                      {(STATUS_CONFIG[detail.status] ?? STATUS_CONFIG.DRAFT).label}
                    </Badge>
                  )}
                </>
              ) : '載入中…'}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && <div className="py-8 text-center text-gray-400">載入中…</div>}

          {detail && !detailLoading && (
            <div className="space-y-5 text-sm">
              {/* Header info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '期初餘額', value: fmt(Number(detail.openingBalance)) },
                  { label: '本期帳款', value: fmt(Number(detail.totalBilled)) },
                  { label: '本期收款', value: fmt(Number(detail.totalReceived)), green: true },
                  { label: '期末餘額', value: fmt(Number(detail.closingBalance)), bold: true },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div className={`font-bold mt-0.5 ${item.green ? 'text-green-600' : item.bold && Number(detail.closingBalance) > 0 ? 'text-orange-600' : ''}`}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {detail.status === 'DRAFT' && (
                  <Button size="sm" className="gap-1.5" disabled={actionLoading} onClick={() => doAction('SEND')}>
                    <Send size={13} />{actionLoading ? '…' : '寄出對帳單'}
                  </Button>
                )}
                {detail.status === 'SENT' && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-200" disabled={actionLoading} onClick={() => doAction('CONFIRM')}>
                      <CheckCircle2 size={13} />{actionLoading ? '…' : '客戶確認'}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200" disabled={actionLoading}
                      onClick={() => {
                        const note = prompt('請輸入異議說明：')
                        if (note) doAction('DISPUTE', { disputeNote: note })
                      }}>
                      <AlertTriangle size={13} />標記異議
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" className="gap-1.5 ml-auto" onClick={() => window.print()}>
                  <Printer size={13} />列印
                </Button>
              </div>

              {detail.disputeNote && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
                  <span className="font-medium">異議說明：</span>{detail.disputeNote}
                </div>
              )}

              {/* Line items table */}
              {detail.lineItems && detail.lineItems.length > 0 && (
                <div>
                  <div className="font-semibold mb-2">
                    明細
                    <span className="ml-2 text-gray-400 font-normal text-xs">
                      {detail.periodStart.slice(0, 10)} ~ {detail.periodEnd.slice(0, 10)}
                    </span>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500">
                          <th className="px-3 py-2 text-left">日期</th>
                          <th className="px-3 py-2 text-left">摘要</th>
                          <th className="px-3 py-2 text-right">借（應收）</th>
                          <th className="px-3 py-2 text-right">貸（收款）</th>
                          <th className="px-3 py-2 text-right">累計餘額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lineItems.map((item, i) => (
                          <tr key={i} className={`border-b last:border-0 ${item.type === 'PAYMENT' ? 'bg-green-50/40' : ''}`}>
                            <td className="px-3 py-2 text-gray-500">{item.date}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {item.debit > 0 ? fmt(item.debit) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-green-600">
                              {item.credit > 0 ? fmt(item.credit) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              {fmt(item.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detail.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-gray-700">
                  <span className="font-medium">備註：</span>{detail.notes}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDetailId(null); setDetail(null) }}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
