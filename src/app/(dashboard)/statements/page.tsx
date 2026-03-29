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

const STATUS_ICONS: Record<string, React.ElementType> = {
  DRAFT: FileText,
  SENT: Send,
  CONFIRMED: CheckCircle2,
  DISPUTED: AlertTriangle,
  VOID: XCircle,
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600 border-gray-200',
  SENT:      'bg-blue-100 text-blue-700 border-blue-200',
  CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  DISPUTED:  'bg-red-100 text-red-700 border-red-200',
  VOID:      'bg-gray-100 text-gray-400 border-gray-200',
}

export default function StatementsPage() {
  const { dict } = useI18n()
  const sp = dict.statementsPage
  const STATUS_LABELS = sp.statusLabels as Record<string, string>

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

  const [genCustomerId, setGenCustomerId] = useState('')
  const [genPeriodStart, setGenPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [genPeriodEnd, setGenPeriodEnd] = useState(() => {
    const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10)
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
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [statusFilter, customerFilter, dict.common.loadFailed])

  useEffect(() => { load() }, [load])

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
    } catch { toast.error(dict.common.loadFailed) }
    finally { setDetailLoading(false) }
  }, [dict.common.loadFailed])

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
      toast.success(dict.common.updateSuccess)
      loadDetail(detailId)
      load()
    } catch (e) { toast.error(String(e instanceof Error ? e.message : dict.common.operationFailed)) }
    finally { setActionLoading(false) }
  }

  const generate = async () => {
    if (!genCustomerId || !genPeriodStart || !genPeriodEnd) {
      toast.error(sp.selectCustomerPeriod)
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
      toast.success(sp.createdMsg.replace('{no}', stmt.statementNo))
      setShowGenerate(false)
      load()
    } catch (e) { toast.error(String(e instanceof Error ? e.message : dict.common.createFailed)) }
    finally { setGenerating(false) }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.statements ?? sp.generateTitle}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sp.subtitle}</p>
        </div>
        <Button className="gap-1.5 self-start sm:self-auto" onClick={() => setShowGenerate(true)}>
          <Plus size={15} />{sp.generateBtn}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={v => { if (v) setStatusFilter(v) }}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{sp.allStatuses}</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={customerFilter} onValueChange={v => { if (v) setCustomerFilter(v) }}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder={sp.allCustomers} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{sp.allCustomers}</SelectItem>
            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">{sp.colStatementNo}</th>
              <th className="px-4 py-3 text-left">{sp.colCustomer}</th>
              <th className="px-4 py-3 text-center">{sp.colPeriod}</th>
              <th className="px-4 py-3 text-right">{sp.colOpeningBalance}</th>
              <th className="px-4 py-3 text-right">{sp.colTotalBilled}</th>
              <th className="px-4 py-3 text-right">{sp.colTotalReceived}</th>
              <th className="px-4 py-3 text-right">{sp.colClosingBalance}</th>
              <th className="px-4 py-3 text-center">{sp.colStatus}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400">{sp.loading}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400">{sp.noData}</td></tr>
            ) : rows.map(row => {
              const label = STATUS_LABELS[row.status] ?? row.status
              const color = STATUS_COLORS[row.status] ?? STATUS_COLORS.DRAFT
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
                    <Badge className={`${color} border text-xs`}>{label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => loadDetail(row.id)}>
                      {sp.viewBtn}
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
          <DialogHeader><DialogTitle>{sp.generateTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-gray-600 mb-1">{sp.fieldCustomer}</label>
              <Select value={genCustomerId} onValueChange={v => { if (v) setGenCustomerId(v) }}>
                <SelectTrigger className="h-9"><SelectValue placeholder={sp.customerPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-600 mb-1">{sp.fieldPeriodStart}</label>
                <Input type="date" value={genPeriodStart} onChange={e => setGenPeriodStart(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">{sp.fieldPeriodEnd}</label>
                <Input type="date" value={genPeriodEnd} onChange={e => setGenPeriodEnd(e.target.value)} className="h-9" />
              </div>
            </div>
            <div>
              <label className="block text-gray-600 mb-1">{sp.fieldNotes}</label>
              <Input value={genNotes} onChange={e => setGenNotes(e.target.value)} className="h-9" placeholder={sp.notesPlaceholder} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>{dict.common.cancel}</Button>
            <Button onClick={generate} disabled={generating}>
              {generating ? sp.generating : sp.generateDialogBtn}
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
                    <Badge className={`${STATUS_COLORS[detail.status] ?? STATUS_COLORS.DRAFT} border text-xs ml-1`}>
                      {STATUS_LABELS[detail.status] ?? detail.status}
                    </Badge>
                  )}
                </>
              ) : sp.detailLoading}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && <div className="py-8 text-center text-gray-400">{sp.detailLoading}</div>}

          {detail && !detailLoading && (
            <div className="space-y-5 text-sm">
              {/* Header info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: sp.labelOpeningBalance, value: fmt(Number(detail.openingBalance)) },
                  { label: sp.labelTotalBilled, value: fmt(Number(detail.totalBilled)) },
                  { label: sp.labelTotalReceived, value: fmt(Number(detail.totalReceived)), green: true },
                  { label: sp.labelClosingBalance, value: fmt(Number(detail.closingBalance)), bold: true },
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
                    <Send size={13} />{actionLoading ? '…' : sp.actionSend}
                  </Button>
                )}
                {detail.status === 'SENT' && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-200" disabled={actionLoading} onClick={() => doAction('CONFIRM')}>
                      <CheckCircle2 size={13} />{actionLoading ? '…' : sp.actionConfirm}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200" disabled={actionLoading}
                      onClick={() => {
                        const note = prompt(sp.disputePrompt)
                        if (note) doAction('DISPUTE', { disputeNote: note })
                      }}>
                      <AlertTriangle size={13} />{sp.actionDispute}
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" className="gap-1.5 ml-auto" onClick={() => window.print()}>
                  <Printer size={13} />{sp.actionPrint}
                </Button>
              </div>

              {detail.disputeNote && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
                  <span className="font-medium">{sp.disputeLabel}</span>{detail.disputeNote}
                </div>
              )}

              {/* Line items table */}
              {detail.lineItems && detail.lineItems.length > 0 && (
                <div>
                  <div className="font-semibold mb-2">
                    {sp.lineItemsTitle}
                    <span className="ml-2 text-gray-400 font-normal text-xs">
                      {detail.periodStart.slice(0, 10)} ~ {detail.periodEnd.slice(0, 10)}
                    </span>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500">
                          <th className="px-3 py-2 text-left">{sp.colDate}</th>
                          <th className="px-3 py-2 text-left">{sp.colDesc}</th>
                          <th className="px-3 py-2 text-right">{sp.colDebit}</th>
                          <th className="px-3 py-2 text-right">{sp.colCredit}</th>
                          <th className="px-3 py-2 text-right">{sp.colBalance}</th>
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
                  <span className="font-medium">{sp.notesLabel}</span>{detail.notes}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDetailId(null); setDetail(null) }}>{sp.closeBtn}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
