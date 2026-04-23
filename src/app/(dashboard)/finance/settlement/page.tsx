'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import {
  Search, CheckCircle2, Loader2, FileCheck, ArrowDownLeft, ArrowUpRight, Banknote,
} from 'lucide-react'

/* ── Types ── */
interface Party { id: string; code: string; name: string }

interface OutstandingRecord {
  id: string
  invoiceNo: string | null
  dueDate: string | null
  amount: number
  paidAmount: number
  balance: number
  agingDays?: number | null
  status: string
  orderNo?: string | null
  poNo?: string | null
}

interface SettleItem {
  recordId: string
  amount: string // editable input value
  checked: boolean
}

/* ── Helpers ── */
const fmt = (n: number) => `$${n.toLocaleString()}`
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-TW') : '—'

/* ── Page ── */
export default function SettlementPage() {
  const { dict } = useI18n()
  const st = dict.settlement

  /* ── State ── */
  const [direction, setDirection] = useState<'INCOMING' | 'OUTGOING'>('INCOMING')
  const [partySearch, setPartySearch] = useState('')
  const [parties, setParties] = useState<Party[]>([])
  const [selectedParty, setSelectedParty] = useState<Party | null>(null)
  const [showPartyList, setShowPartyList] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const [outstanding, setOutstanding] = useState<OutstandingRecord[]>([])
  const [settleItems, setSettleItems] = useState<SettleItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /* ── History ── */
  const [history, setHistory] = useState<Array<{
    id: string; batchNo: string; totalAmount: number; paymentDate: string
    status: string; _count: { items: number }
    customer?: { name: string } | null; supplier?: { name: string } | null
    createdBy?: { name: string } | null
  }>>([])

  /* ── Party search ── */
  useEffect(() => {
    if (!partySearch.trim()) { setParties([]); return }
    const endpoint = direction === 'INCOMING' ? '/api/customers' : '/api/suppliers'
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`${endpoint}?search=${encodeURIComponent(partySearch)}&pageSize=15`)
        const json = await res.json()
        setParties(json.data ?? [])
      } finally { setSearchLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [partySearch, direction])

  /* ── Load outstanding when party selected ── */
  const loadOutstanding = useCallback(async (partyId: string) => {
    setDataLoading(true)
    try {
      const endpoint = direction === 'INCOMING'
        ? `/api/finance/settlement/ar?customerId=${partyId}`
        : `/api/finance/settlement/ap?supplierId=${partyId}`
      const res = await fetch(endpoint)
      const json = await res.json()
      const records: OutstandingRecord[] = json.data ?? []
      setOutstanding(records)
      setSettleItems(records.map(r => ({ recordId: r.id, amount: String(r.balance), checked: false })))
    } finally { setDataLoading(false) }
  }, [direction])

  const selectParty = useCallback((p: Party) => {
    setSelectedParty(p)
    setShowPartyList(false)
    setPartySearch('')
    loadOutstanding(p.id)
  }, [loadOutstanding])

  /* ── Load history ── */
  useEffect(() => {
    fetch(`/api/finance/settlement?pageSize=10&direction=${direction}`)
      .then(r => r.json())
      .then(j => setHistory(j.data ?? []))
      .catch(() => {})
  }, [direction, submitting])

  /* ── Reset on direction change ── */
  const switchDirection = (dir: 'INCOMING' | 'OUTGOING') => {
    setDirection(dir)
    setSelectedParty(null)
    setPartySearch('')
    setOutstanding([])
    setSettleItems([])
  }

  /* ── Settle items helpers ── */
  const toggleCheck = (index: number) => {
    setSettleItems(prev => prev.map((s, i) => i === index ? { ...s, checked: !s.checked } : s))
  }

  const updateAmount = (index: number, value: string) => {
    setSettleItems(prev => prev.map((s, i) => i === index ? { ...s, amount: value, checked: true } : s))
  }

  const checkedItems = useMemo(() =>
    settleItems.filter(s => s.checked && Number(s.amount) > 0),
    [settleItems]
  )

  const totalSettle = useMemo(() =>
    checkedItems.reduce((s, i) => s + Number(i.amount), 0),
    [checkedItems]
  )

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!selectedParty) { toast.error('請先選擇客戶/供應商'); return }
    if (checkedItems.length === 0) { toast.error('請至少勾選一筆帳款'); return }
    if (totalSettle <= 0) { toast.error('沖帳合計金額需大於零'); return }

    setSubmitting(true)
    try {
      const items = checkedItems.map(ci => {
        const rec = outstanding.find(o => o.id === ci.recordId)!
        return direction === 'INCOMING'
          ? { arId: ci.recordId, amount: Number(ci.amount) }
          : { apId: ci.recordId, amount: Number(ci.amount) }
      })

      const res = await fetch('/api/finance/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          customerId: direction === 'INCOMING' ? selectedParty.id : undefined,
          supplierId: direction === 'OUTGOING' ? selectedParty.id : undefined,
          paymentDate,
          paymentMethod,
          referenceNo: referenceNo || undefined,
          notes: notes || undefined,
          items,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? '沖帳失敗')
        return
      }

      const result = await res.json()
      toast.success(`沖帳完成 — ${result.batchNo}，共 ${fmt(totalSettle)}`)

      // Reload outstanding
      loadOutstanding(selectedParty.id)
      setReferenceNo('')
      setNotes('')
    } catch {
      toast.error('沖帳失敗')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Render ── */
  const isAR = direction === 'INCOMING'
  const partyLabel = isAR ? '客戶' : '供應商'

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">{st.title ?? '沖帳作業'}</h1>

      {/* ── Direction Toggle ── */}
      <div className="flex gap-2">
        <Button variant={isAR ? 'default' : 'outline'} onClick={() => switchDirection('INCOMING')}
          className="gap-2">
          <ArrowDownLeft className="h-4 w-4" /> {st.arSettlement ?? '收款沖帳'}
        </Button>
        <Button variant={!isAR ? 'default' : 'outline'} onClick={() => switchDirection('OUTGOING')}
          className="gap-2">
          <ArrowUpRight className="h-4 w-4" /> {st.apSettlement ?? '付款沖帳'}
        </Button>
      </div>

      {/* ── Party Search ── */}
      <Card>
        <CardContent className="pt-6">
          <Label className="mb-2 block">{isAR ? (st.selectCustomer ?? '選擇客戶') : (st.selectSupplier ?? '選擇供應商')}</Label>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9"
              placeholder={`搜尋${partyLabel}名稱/代碼...`}
              value={selectedParty ? `${selectedParty.code} — ${selectedParty.name}` : partySearch}
              onChange={e => {
                if (selectedParty) { setSelectedParty(null); setOutstanding([]); setSettleItems([]) }
                setPartySearch(e.target.value)
                setShowPartyList(true)
              }}
              onFocus={() => { if (partySearch && !selectedParty) setShowPartyList(true) }}
            />
            {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
            {showPartyList && parties.length > 0 && !selectedParty && (
              <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                {parties.map(p => (
                  <button key={p.id} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm"
                    onClick={() => selectParty(p)}>
                    <span className="font-medium">{p.code}</span> — {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Outstanding Table ── */}
      {selectedParty && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCheck className="h-5 w-5" />
              {isAR ? (st.outstandingAr ?? '未結應收') : (st.outstandingAp ?? '未結應付')}
              <Badge variant="outline">{outstanding.length} 筆</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : outstanding.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">無未結帳款</div>
            ) : (
              <>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-10">勾選</TableHead>
                        <TableHead>單號</TableHead>
                        <TableHead>到期日</TableHead>
                        <TableHead className="text-right">{isAR ? '應收金額' : '應付金額'}</TableHead>
                        <TableHead className="text-right">{isAR ? '已收金額' : '已付金額'}</TableHead>
                        <TableHead className="text-right">餘額</TableHead>
                        <TableHead className="text-right w-36">{st.settleAmount ?? '本次沖帳'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outstanding.map((rec, idx) => {
                        const si = settleItems[idx]
                        return (
                          <TableRow key={rec.id} className={si?.checked ? 'bg-blue-50/50' : ''}>
                            <TableCell>
                              <input type="checkbox" checked={si?.checked ?? false}
                                onChange={() => toggleCheck(idx)}
                                className="h-4 w-4 rounded border-gray-300" />
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {rec.orderNo ?? rec.poNo ?? rec.invoiceNo ?? rec.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="text-sm">{fmtDate(rec.dueDate)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmt(rec.amount)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmt(rec.paidAmount)}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{fmt(rec.balance)}</TableCell>
                            <TableCell className="text-right">
                              <Input type="number" min={0} max={rec.balance} step={1}
                                className="h-8 w-full text-right"
                                value={si?.amount ?? ''}
                                onChange={e => updateAmount(idx, e.target.value)}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <Separator className="my-4" />

                {/* ── Payment Info ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label>{st.paymentDate ?? '收/付款日期'}</Label>
                    <Input type="date" value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>{st.paymentMethod ?? '收/付款方式'}</Label>
                    <Select value={paymentMethod} onValueChange={v => { if (v) setPaymentMethod(v) }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRANSFER">匯款</SelectItem>
                        <SelectItem value="CHECK">支票</SelectItem>
                        <SelectItem value="CASH">現金</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{st.referenceNo ?? '匯款/支票單號'}</Label>
                    <Input value={referenceNo} onChange={e => setReferenceNo(e.target.value)}
                      placeholder="選填" />
                  </div>
                  <div>
                    <Label>備註</Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="選填" />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-lg">
                    {st.totalSettle ?? '沖帳合計'}：
                    <span className="font-bold text-xl ml-2">{fmt(totalSettle)}</span>
                    <span className="text-sm text-muted-foreground ml-2">（{checkedItems.length} 筆）</span>
                  </div>
                  <Button size="lg" onClick={handleSubmit} disabled={submitting || checkedItems.length === 0}
                    className="gap-2 min-w-[140px]">
                    {submitting
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <CheckCircle2 className="h-4 w-4" />}
                    {st.confirmSettle ?? '確認沖帳'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Recent History ── */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Banknote className="h-5 w-5" />
              最近沖帳記錄
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{st.batchNo ?? '沖帳批號'}</TableHead>
                    <TableHead>{partyLabel}</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>筆數</TableHead>
                    <TableHead>經辦</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map(h => (
                    <TableRow key={h.id}>
                      <TableCell className="font-mono text-xs">{h.batchNo}</TableCell>
                      <TableCell>{h.customer?.name ?? h.supplier?.name ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmt(Number(h.totalAmount))}</TableCell>
                      <TableCell className="text-sm">{fmtDate(h.paymentDate)}</TableCell>
                      <TableCell>{h._count.items} 筆</TableCell>
                      <TableCell className="text-sm">{h.createdBy?.name ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
