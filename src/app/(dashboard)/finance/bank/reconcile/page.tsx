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
  Upload, Loader2, CheckCircle2, AlertCircle, RefreshCw,
  FileText, Link2, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface BankAccount {
  id: string
  accountName: string
  bankName: string
  accountNo: string
  currentBalance: number
}

interface BankTx {
  id: string
  txDate: string
  description: string
  direction: 'DEBIT' | 'CREDIT'
  amount: number
  balance: number
  referenceNo: string | null
  isReconciled: boolean
  paymentRecordId: string | null
}

interface SuggestedMatch {
  bankTxId: string
  paymentId: string
  paymentNo: string
  confidence: number
}

interface ImportResult {
  created: number
  reconciled: number
  pending: number
  skipped: number
  total: number
  newBalance: number
}

type AnomalySet = Set<string>

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmt(n: number) {
  return Math.abs(Number(n)).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function confidenceLabel(c: number) {
  if (c >= 0.95) return { label: '高', cls: 'bg-green-100 text-green-700' }
  if (c >= 0.85) return { label: '中', cls: 'bg-yellow-100 text-yellow-700' }
  return { label: '低', cls: 'bg-slate-100 text-slate-600' }
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function BankReconcilePage() {
  const fileRef = useRef<HTMLInputElement>(null)

  // Account picker
  const [accounts, setAccounts]     = useState<BankAccount[]>([])
  const [accountId, setAccountId]   = useState('')

  // Upload state
  const [uploading, setUploading]   = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // Unreconciled list
  const [pending, setPending]       = useState<BankTx[]>([])
  const [suggested, setSuggested]   = useState<SuggestedMatch[]>([])
  const [summary, setSummary]       = useState<{ unreconciledCount: number; totalDebit: number; totalCredit: number } | null>(null)
  const [loadingPending, setLoadingPending] = useState(false)

  // Manual actions
  const [anomalies, setAnomalies]   = useState<AnomalySet>(new Set())
  const [reconciling, setReconciling] = useState<string | null>(null)

  /* ── Load accounts ── */
  useEffect(() => {
    fetch('/api/finance/bank-accounts')
      .then(r => r.json())
      .then(d => {
        const list: BankAccount[] = d.data ?? d
        setAccounts(list)
        if (list.length > 0) setAccountId(list[0].id)
      })
      .catch(() => toast.error('無法載入銀行帳戶'))
  }, [])

  /* ── Load unreconciled ── */
  const loadPending = useCallback(async () => {
    if (!accountId) return
    setLoadingPending(true)
    try {
      const res  = await fetch(`/api/finance/bank/unreconciled?bankAccountId=${accountId}&pageSize=100`)
      const json = await res.json()
      setPending(json.data ?? [])
      setSuggested(json.suggestedMatches ?? [])
      setSummary(json.summary ?? null)
    } catch {
      toast.error('載入待確認清單失敗')
    } finally {
      setLoadingPending(false)
    }
  }, [accountId])

  useEffect(() => { loadPending() }, [loadPending])

  /* ── CSV Upload ── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !accountId) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('請上傳 .csv 格式的銀行對帳單')
      return
    }

    setUploading(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bankAccountId', accountId)

      const res  = await fetch('/api/finance/bank/import', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? '上傳失敗')
        return
      }

      setImportResult(json)
      toast.success(`匯入完成：${json.created} 筆，自動對帳 ${json.reconciled} 筆`)
      loadPending()
    } catch {
      toast.error('上傳失敗')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /* ── Auto reconcile ── */
  async function handleAutoReconcile() {
    if (!accountId) return
    const res  = await fetch('/api/finance/bank/reconcile', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ bankAccountId: accountId }),
    })
    const json = await res.json()
    if (res.ok) {
      toast.success(`自動對帳完成：${json.autoMatched} 筆`)
      loadPending()
    } else {
      toast.error(json.error ?? '自動對帳失敗')
    }
  }

  /* ── Manual reconcile (accept suggested or confirm no match) ── */
  async function handleManualMatch(bankTxId: string, paymentRecordId?: string) {
    setReconciling(bankTxId)
    try {
      const res = await fetch('/api/finance/bank/reconcile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ matches: [{ bankTransactionId: bankTxId, paymentRecordId: paymentRecordId ?? null }] }),
      })
      if (res.ok) {
        toast.success('已完成勾稽')
        loadPending()
      } else {
        const d = await res.json()
        toast.error(d.error ?? '勾稽失敗')
      }
    } finally {
      setReconciling(null)
    }
  }

  /* ── Mark anomaly ── */
  function toggleAnomaly(id: string) {
    setAnomalies(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedAccount = accounts.find(a => a.id === accountId)

  /* ── Render ── */
  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">銀行對帳</h1>
          <p className="text-sm text-slate-500 mt-0.5">上傳銀行對帳單 CSV，自動比對系統付款記錄</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadPending} disabled={loadingPending} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loadingPending ? 'animate-spin' : ''}`} />
          重新整理
        </Button>
      </div>

      {/* Account + Upload */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Account selector */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">選擇銀行帳戶</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={accountId} onValueChange={v => v && setAccountId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="選擇帳戶" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.accountName}（{a.bankName} {a.accountNo}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccount && (
              <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                目前餘額：<span className="font-mono font-semibold text-slate-800">
                  {fmt(selectedAccount.currentBalance)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CSV Upload */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">上傳銀行對帳單</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {uploading
                ? <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-2" />
                : <Upload className="h-8 w-8 text-slate-300 mb-2" />
              }
              <p className="text-sm text-slate-500">
                {uploading ? '上傳中…' : '點擊或拖放 CSV 檔案'}
              </p>
              <p className="text-xs text-slate-400 mt-1">格式：日期, 摘要, 支出, 存入, 餘額, 參考號</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
              disabled={!accountId || uploading}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={handleAutoReconcile}
              disabled={!accountId || loadingPending}
            >
              <Link2 className="h-3.5 w-3.5" />
              重新執行自動比對
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: '匯入筆數', value: importResult.created, cls: 'text-slate-800' },
            { label: '自動對帳', value: importResult.reconciled, cls: 'text-green-600' },
            { label: '待確認',   value: importResult.pending,    cls: 'text-orange-600' },
            { label: '略過重複', value: importResult.skipped,    cls: 'text-slate-400' },
          ].map(c => (
            <Card key={c.label}>
              <CardContent className="p-4 text-center">
                <div className="text-xs text-slate-500">{c.label}</div>
                <div className={`text-2xl font-bold ${c.cls}`}>{c.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="flex flex-wrap gap-4 items-center rounded-lg bg-slate-50 border px-5 py-3 text-sm">
          <div>
            <span className="text-slate-500">待確認筆數：</span>
            <span className="font-semibold text-orange-600">{summary.unreconciledCount}</span>
          </div>
          <div>
            <span className="text-slate-500">待確認支出：</span>
            <span className="font-mono font-semibold text-red-500">{fmt(summary.totalDebit)}</span>
          </div>
          <div>
            <span className="text-slate-500">待確認存入：</span>
            <span className="font-mono font-semibold text-green-600">{fmt(summary.totalCredit)}</span>
          </div>
        </div>
      )}

      {/* Two-column: Reconciled / Pending */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Suggested matches */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <CardTitle className="text-sm">建議配對（{suggested.length} 筆）</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-96 overflow-y-auto">
            {suggested.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">無建議配對</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>流水日期/摘要</TableHead>
                    <TableHead>付款單號</TableHead>
                    <TableHead className="text-center">信心</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggested.map(m => {
                    const tx  = pending.find(t => t.id === m.bankTxId)
                    const con = confidenceLabel(m.confidence)
                    return (
                      <TableRow key={m.bankTxId}>
                        <TableCell className="text-sm">
                          <div className="font-mono text-xs text-slate-400">{tx?.txDate.split('T')[0]}</div>
                          <div className="truncate max-w-32">{tx?.description}</div>
                          <div className={`font-mono text-xs ${tx?.direction === 'CREDIT' ? 'text-green-600' : 'text-red-500'}`}>
                            {tx?.direction === 'CREDIT' ? '+' : '-'}{fmt(tx?.amount ?? 0)}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{m.paymentNo}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${con.cls}`}>{con.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={reconciling === m.bankTxId}
                            onClick={() => handleManualMatch(m.bankTxId, m.paymentId)}
                          >
                            {reconciling === m.bankTxId
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : '確認'
                            }
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Unreconciled / pending confirmation */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-400" />
              <CardTitle className="text-sm">
                待確認（{pending.filter(t => !suggested.find(m => m.bankTxId === t.id)).length} 筆）
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-96 overflow-y-auto">
            {(() => {
              const unmatched = pending.filter(t => !suggested.find(m => m.bankTxId === t.id))
              return unmatched.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">所有流水皆已配對或對帳</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期 / 摘要</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead className="text-center w-28">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatched.map(tx => {
                      const isAnomaly = anomalies.has(tx.id)
                      return (
                        <TableRow key={tx.id} className={isAnomaly ? 'bg-red-50' : ''}>
                          <TableCell className="text-sm">
                            <div className="font-mono text-xs text-slate-400">{tx.txDate.split('T')[0]}</div>
                            <div className="truncate max-w-36">{tx.description}</div>
                            {tx.referenceNo && (
                              <div className="text-xs text-slate-400">{tx.referenceNo}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-mono text-sm font-semibold ${tx.direction === 'CREDIT' ? 'text-green-600' : 'text-red-500'}`}>
                              {tx.direction === 'CREDIT' ? '+' : '-'}{fmt(tx.amount)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs w-full"
                                disabled={reconciling === tx.id}
                                onClick={() => handleManualMatch(tx.id)}
                              >
                                {reconciling === tx.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <><FileText className="h-3 w-3 mr-1" />確認無對應</>
                                }
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-6 text-xs w-full ${isAnomaly ? 'text-red-600 bg-red-50' : 'text-slate-500'}`}
                                onClick={() => toggleAnomaly(tx.id)}
                              >
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {isAnomaly ? '取消標記' : '標記異常'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )
            })()}
          </CardContent>
        </Card>

      </div>

      {/* Anomaly summary */}
      {anomalies.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>已標記 <strong>{anomalies.size}</strong> 筆異常，請通知主管或財務確認</span>
        </div>
      )}
    </div>
  )
}
