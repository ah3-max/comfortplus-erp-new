'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Loader2, RefreshCw, Upload, CheckCircle2, Link2, Unlink, Building2,
} from 'lucide-react'
import { toast } from 'sonner'

interface BankAccount { id: string; accountName: string; bankName: string; accountNo: string; currentBalance: number }
interface BankTx { id: string; txDate: string; description: string; direction: string; amount: number; balance: number; referenceNo: string | null; isReconciled: boolean }
interface Payment { id: string; paymentNo: string; paymentDate: string; direction: string; amount: number; paymentMethod: string | null; customer: { name: string } | null; supplier: { name: string } | null }
interface Match  { bankTxId: string; paymentId: string; confidence: number }

function fmt(n: number) { return n.toLocaleString('zh-TW') }
function fmtDate(s: string) { return s?.slice(0, 10) ?? '' }

export default function BankReconciliationPage() {
  const { dict } = useI18n()
  const br = ((dict as unknown) as Record<string, Record<string, string>>).bankReconciliation ?? {}

  const [accounts, setAccounts]     = useState<BankAccount[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [startDate, setStartDate]   = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10) })
  const [endDate, setEndDate]       = useState(() => new Date().toISOString().slice(0, 10))

  const [bankTxs, setBankTxs]     = useState<BankTx[]>([])
  const [payments, setPayments]   = useState<Payment[]>([])
  const [suggested, setSuggested] = useState<Match[]>([])
  const [loading, setLoading]     = useState(false)

  // 手動配對選擇
  const [selectedBankTx, setSelectedBankTx]     = useState<string | null>(null)
  const [selectedPayment, setSelectedPayment]   = useState<string | null>(null)
  const [manualMatches, setManualMatches]       = useState<Match[]>([])

  // CSV 匯入
  const [showImport, setShowImport] = useState(false)
  const [csvText, setCsvText]       = useState('')
  const [importing, setImporting]   = useState(false)

  const [reconciling, setReconciling] = useState(false)

  // 載入帳戶清單
  useEffect(() => {
    fetch('/api/finance/bank-accounts').then(r => r.json()).then(d => setAccounts(d.data ?? []))
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const qs = new URLSearchParams({ bankAccountId: selectedId, startDate, endDate })
      const res = await fetch(`/api/finance/bank-reconciliation?${qs}`)
      const json = await res.json()
      setBankTxs(json.bankTransactions ?? [])
      setPayments(json.systemPayments ?? [])
      setSuggested(json.suggestedMatches ?? [])
      setManualMatches([])
    } catch {
      toast.error(br.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [selectedId, startDate, endDate, br.loadFailed])

  useEffect(() => { if (selectedId) fetchData() }, [selectedId, fetchData])

  // 接受建議配對
  const acceptSuggestion = (m: Match) => {
    setManualMatches(prev => [...prev.filter(x => x.bankTxId !== m.bankTxId), m])
  }

  // 手動配對
  const addManualMatch = () => {
    if (!selectedBankTx || !selectedPayment) return
    setManualMatches(prev => [...prev.filter(x => x.bankTxId !== selectedBankTx), { bankTxId: selectedBankTx, paymentId: selectedPayment, confidence: 1 }])
    setSelectedBankTx(null)
    setSelectedPayment(null)
  }

  const removeMatch = (bankTxId: string) => {
    setManualMatches(prev => prev.filter(x => x.bankTxId !== bankTxId))
  }

  // 全部接受建議
  const acceptAllSuggestions = () => {
    setManualMatches(prev => {
      const existing = new Set(prev.map(m => m.bankTxId))
      const newOnes = suggested.filter(m => !existing.has(m.bankTxId))
      return [...prev, ...newOnes]
    })
  }

  // 確認對帳
  const handleReconcile = async () => {
    if (manualMatches.length === 0) { toast.error(br.noMatches); return }
    setReconciling(true)
    try {
      const res = await fetch('/api/finance/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matches: manualMatches.map(m => ({
            bankTransactionId: m.bankTxId,
            paymentRecordId: m.paymentId,
          })),
        }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      toast.success(`${br.reconciled} ${json.reconciled} ${br.items}`)
      fetchData()
    } catch {
      toast.error(br.reconcileFailed)
    } finally {
      setReconciling(false)
    }
  }

  // CSV 匯入
  const handleImport = async () => {
    if (!csvText.trim()) return
    setImporting(true)
    try {
      const res = await fetch(`/api/finance/bank-accounts/${selectedId}/import-statement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      toast.success(`${br.imported} ${json.created} ${br.items}，${br.skipped} ${json.skipped}`)
      setShowImport(false)
      setCsvText('')
      fetchData()
    } catch {
      toast.error(br.importFailed)
    } finally {
      setImporting(false)
    }
  }

  const matchedBankTxIds = new Set(manualMatches.map(m => m.bankTxId))
  const matchedPaymentIds = new Set(manualMatches.map(m => m.paymentId))

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{br.title}</h1>
          <p className="text-sm text-muted-foreground">{br.subtitle}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1 min-w-[200px]">
          <label className="text-sm font-medium">{br.bankAccount}</label>
          <Select value={selectedId} onValueChange={v => setSelectedId(v ?? '')}>
            <SelectTrigger><SelectValue placeholder={br.selectAccount} /></SelectTrigger>
            <SelectContent>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.bankName} {a.accountNo.slice(-5)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">{br.startDate}</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">{br.endDate}</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading || !selectedId}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{br.refresh}
        </Button>
        {selectedId && (
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" />{br.importCsv}
          </Button>
        )}
      </div>

      {!selectedId ? (
        <div className="text-center py-16 text-muted-foreground">{br.pleaseSelect}</div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{bankTxs.length}</p>
              <p className="text-xs text-muted-foreground">{br.unreconciledTxs}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{payments.length}</p>
              <p className="text-xs text-muted-foreground">{br.unmatchedPayments}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{manualMatches.length}</p>
              <p className="text-xs text-muted-foreground">{br.matchedCount}</p>
            </CardContent></Card>
          </div>

          {/* Suggested matches */}
          {suggested.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{br.suggestedMatches}</CardTitle>
                <Button size="sm" variant="outline" onClick={acceptAllSuggestions}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{br.acceptAll}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y text-sm">
                  {suggested.map(m => {
                    const tx  = bankTxs.find(t => t.id === m.bankTxId)
                    const pay = payments.find(p => p.id === m.paymentId)
                    if (!tx || !pay) return null
                    const matched = matchedBankTxIds.has(m.bankTxId)
                    return (
                      <li key={m.bankTxId} className="px-4 py-2 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground">{fmtDate(tx.txDate)}</span>{' '}
                          {tx.description} <Badge variant="outline" className="text-xs ml-1">${fmt(tx.amount)}</Badge>
                        </div>
                        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground">{fmtDate(pay.paymentDate)}</span>{' '}
                          {pay.paymentNo} <Badge variant="outline" className="text-xs ml-1">${fmt(Number(pay.amount))}</Badge>
                        </div>
                        <Badge className="text-xs">{Math.round(m.confidence * 100)}%</Badge>
                        {matched ? (
                          <Button size="sm" variant="ghost" onClick={() => removeMatch(m.bankTxId)}>
                            <Unlink className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => acceptSuggestion(m)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Two columns: bank side vs system side */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Bank transactions */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{br.bankSide}</CardTitle></CardHeader>
              <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                {bankTxs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{br.noTxs}</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {bankTxs.filter(t => !matchedBankTxIds.has(t.id)).map(tx => (
                      <li key={tx.id}
                        className={`px-3 py-2 cursor-pointer hover:bg-muted/50 ${selectedBankTx === tx.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedBankTx(tx.id)}
                      >
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">{fmtDate(tx.txDate)}</span>
                          <span className={`font-medium ${tx.direction === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.direction === 'CREDIT' ? '+' : '-'}${fmt(tx.amount)}
                          </span>
                        </div>
                        <p className="text-xs truncate">{tx.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* System payments */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{br.systemSide}</CardTitle></CardHeader>
              <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{br.noPayments}</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {payments.filter(p => !matchedPaymentIds.has(p.id)).map(pay => (
                      <li key={pay.id}
                        className={`px-3 py-2 cursor-pointer hover:bg-muted/50 ${selectedPayment === pay.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedPayment(pay.id)}
                      >
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">{fmtDate(pay.paymentDate)}</span>
                          <span className={`font-medium ${pay.direction === 'INCOMING' ? 'text-green-600' : 'text-red-600'}`}>
                            {pay.direction === 'INCOMING' ? '+' : '-'}${fmt(Number(pay.amount))}
                          </span>
                        </div>
                        <p className="text-xs truncate">
                          {pay.paymentNo} · {pay.customer?.name ?? pay.supplier?.name ?? '-'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Manual match + confirm */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" disabled={!selectedBankTx || !selectedPayment} onClick={addManualMatch}>
              <Link2 className="h-4 w-4 mr-1" />{br.manualMatch}
            </Button>
            <Button disabled={manualMatches.length === 0 || reconciling} onClick={handleReconcile}>
              {reconciling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              {br.confirmReconcile} ({manualMatches.length})
            </Button>
          </div>
        </>
      )}

      {/* CSV Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{br.importTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-xs text-muted-foreground">{br.csvFormat}</p>
            <Textarea
              className="min-h-[150px] font-mono text-xs"
              placeholder={br.csvPlaceholder}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleImport} disabled={importing || !csvText.trim()}>
              {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {br.importBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
