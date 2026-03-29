'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, RefreshCw, CreditCard, Landmark, ArrowUpCircle, ArrowDownCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

interface BankAccount {
  id: string
  accountName: string
  accountNo: string
  bankName: string
  bankCode: string | null
  accountType: string
  currency: string
  openingBalance: string
  currentBalance: string
  creditLimit: string | null
  statementDay: number | null
  paymentDay: number | null
  isActive: boolean
  notes: string | null
  createdAt: string
  _count: { transactions: number }
}

interface BankTransaction {
  id: string
  txDate: string
  description: string
  direction: string
  amount: string
  balance: string
  referenceNo: string | null
  category: string | null
  notes: string | null
}

const TYPE_LABELS: Record<string, string> = {
  CHECKING: '活期帳戶',
  SAVINGS: '儲蓄帳戶',
  CREDIT_CARD: '信用卡',
}

const TYPE_COLORS: Record<string, string> = {
  CHECKING: 'bg-blue-100 text-blue-700',
  SAVINGS: 'bg-green-100 text-green-700',
  CREDIT_CARD: 'bg-purple-100 text-purple-700',
}

const fmt = (v: string | number) =>
  Number(v).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function BankAccountsPage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const canManage = ['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Record<string, BankTransaction[]>>({})
  const [txLoading, setTxLoading] = useState<string | null>(null)

  const [showNewAccount, setShowNewAccount] = useState(false)
  const [showNewTx, setShowNewTx] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [accountForm, setAccountForm] = useState({
    accountName: '', accountNo: '', bankName: '', bankCode: '',
    accountType: 'CHECKING', currency: 'TWD', openingBalance: '0',
    creditLimit: '', statementDay: '', paymentDay: '', notes: '',
  })

  const [txForm, setTxForm] = useState({
    txDate: new Date().toISOString().slice(0, 10),
    description: '', direction: 'DEBIT', amount: '', referenceNo: '', category: '', notes: '',
  })

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finance/bank-accounts?activeOnly=false')
      const json = await res.json()
      setAccounts(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!transactions[id]) {
      setTxLoading(id)
      try {
        const res = await fetch(`/api/finance/bank-accounts/${id}/transactions?pageSize=30`)
        const json = await res.json()
        setTransactions(t => ({ ...t, [id]: json.data ?? [] }))
      } finally {
        setTxLoading(null)
      }
    }
  }

  async function handleCreateAccount() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/finance/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountForm,
          openingBalance: Number(accountForm.openingBalance) || 0,
          creditLimit: accountForm.creditLimit ? Number(accountForm.creditLimit) : null,
          statementDay: accountForm.statementDay ? Number(accountForm.statementDay) : null,
          paymentDay: accountForm.paymentDay ? Number(accountForm.paymentDay) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? dict.common.createFailed); return }
      toast.success(dict.bankAccounts.accountCreated)
      setShowNewAccount(false)
      fetchAccounts()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCreateTx() {
    if (!showNewTx) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/finance/bank-accounts/${showNewTx}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...txForm, amount: Number(txForm.amount) }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? dict.common.createFailed); return }
      toast.success(dict.bankAccounts.transactionRecorded)
      setShowNewTx(null)
      // Refresh account list + transactions
      fetchAccounts()
      setTransactions(t => { const n = { ...t }; delete n[showNewTx]; return n })
      if (expandedId === showNewTx) {
        const res2 = await fetch(`/api/finance/bank-accounts/${showNewTx}/transactions?pageSize=30`)
        const json2 = await res2.json()
        setTransactions(t => ({ ...t, [showNewTx]: json2.data ?? [] }))
      }
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold">{dict.nav.bankAccounts ?? '存摺/信用卡管理'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理銀行帳戶、存摺對帳與信用卡交易</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAccounts}><RefreshCw className="w-4 h-4" /></Button>
          {canManage && (
            <Button size="sm" onClick={() => setShowNewAccount(true)}>
              <Plus className="w-4 h-4 mr-1" />新增帳戶
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {['CHECKING', 'SAVINGS', 'CREDIT_CARD'].map(type => {
            const filtered = accounts.filter(a => a.accountType === type && a.isActive)
            if (!filtered.length) return null
            const total = filtered.reduce((s, a) => s + Number(a.currentBalance), 0)
            return (
              <div key={type} className="border rounded-lg p-3 bg-card">
                <div className="text-xs text-muted-foreground">{TYPE_LABELS[type]}</div>
                <div className="text-lg font-bold mt-1">
                  {total < 0 ? <span className="text-red-600">-{fmt(Math.abs(total))}</span> : fmt(total)}
                </div>
                <div className="text-xs text-muted-foreground">{filtered.length} 個帳戶</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Account list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Landmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>尚無銀行帳戶，請新增</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(a => (
            <div key={a.id} className="border rounded-lg bg-card overflow-hidden">
              {/* Account header */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {a.accountType === 'CREDIT_CARD' ? (
                    <CreditCard className="w-8 h-8 text-purple-500" />
                  ) : (
                    <Landmark className="w-8 h-8 text-blue-500" />
                  )}
                  <div>
                    <div className="font-semibold">{a.accountName}</div>
                    <div className="text-sm text-muted-foreground">{a.bankName} · {a.accountNo}</div>
                  </div>
                  <Badge className={TYPE_COLORS[a.accountType]}>{TYPE_LABELS[a.accountType]}</Badge>
                  {!a.isActive && <Badge className="bg-gray-100 text-gray-500">停用</Badge>}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">目前餘額</div>
                    <div className={`text-lg font-bold ${Number(a.currentBalance) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {fmt(a.currentBalance)} {a.currency}
                    </div>
                    {a.creditLimit && (
                      <div className="text-xs text-muted-foreground">額度：{fmt(a.creditLimit)}</div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {canManage && (
                      <Button size="sm" variant="outline" onClick={() => { setShowNewTx(a.id); setTxForm(f => ({ ...f, txDate: new Date().toISOString().slice(0, 10) })) }}>
                        <Plus className="w-3 h-3 mr-1" />記帳
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleExpand(a.id)}>
                      {expandedId === a.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Transactions panel */}
              {expandedId === a.id && (
                <div className="border-t bg-muted/20 p-3">
                  {txLoading === a.id ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">載入中...</div>
                  ) : (transactions[a.id] ?? []).length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">尚無交易紀錄</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground text-xs border-b">
                            <th className="text-left py-1.5 pr-3">日期</th>
                            <th className="text-left py-1.5 pr-3">說明</th>
                            <th className="text-left py-1.5 pr-3">票號</th>
                            <th className="text-right py-1.5 pr-3">支出</th>
                            <th className="text-right py-1.5 pr-3">存入</th>
                            <th className="text-right py-1.5">餘額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(transactions[a.id] ?? []).map(tx => (
                            <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-1.5 pr-3 text-muted-foreground">{tx.txDate.slice(0, 10)}</td>
                              <td className="py-1.5 pr-3">{tx.description}</td>
                              <td className="py-1.5 pr-3 text-muted-foreground">{tx.referenceNo ?? '-'}</td>
                              <td className="py-1.5 pr-3 text-right text-red-600">
                                {tx.direction === 'DEBIT' && (
                                  <span className="flex items-center justify-end gap-1">
                                    <ArrowDownCircle className="w-3 h-3" />{fmt(tx.amount)}
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 pr-3 text-right text-green-700">
                                {tx.direction === 'CREDIT' && (
                                  <span className="flex items-center justify-end gap-1">
                                    <ArrowUpCircle className="w-3 h-3" />{fmt(tx.amount)}
                                  </span>
                                )}
                              </td>
                              <td className={`py-1.5 text-right font-medium ${Number(tx.balance) < 0 ? 'text-red-600' : ''}`}>
                                {fmt(tx.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(transactions[a.id] ?? []).length >= 30 && (
                        <p className="text-xs text-center text-muted-foreground mt-2">顯示最近 30 筆</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Account Dialog */}
      <Dialog open={showNewAccount} onOpenChange={setShowNewAccount}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增銀行帳戶</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>帳戶類型</Label>
                <Select value={accountForm.accountType} onValueChange={v => { if (v) setAccountForm(f => ({ ...f, accountType: v })) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHECKING">活期帳戶</SelectItem>
                    <SelectItem value="SAVINGS">儲蓄帳戶</SelectItem>
                    <SelectItem value="CREDIT_CARD">信用卡</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>幣別</Label>
                <Select value={accountForm.currency} onValueChange={v => { if (v) setAccountForm(f => ({ ...f, currency: v })) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TWD">TWD 新台幣</SelectItem>
                    <SelectItem value="USD">USD 美元</SelectItem>
                    <SelectItem value="CNY">CNY 人民幣</SelectItem>
                    <SelectItem value="THB">THB 泰銖</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>帳戶名稱 *</Label>
              <Input value={accountForm.accountName} onChange={e => setAccountForm(f => ({ ...f, accountName: e.target.value }))} placeholder="例：台灣銀行活期存款" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>銀行名稱 *</Label>
                <Input value={accountForm.bankName} onChange={e => setAccountForm(f => ({ ...f, bankName: e.target.value }))} />
              </div>
              <div>
                <Label>銀行代碼</Label>
                <Input value={accountForm.bankCode} onChange={e => setAccountForm(f => ({ ...f, bankCode: e.target.value }))} placeholder="例：004" />
              </div>
            </div>
            <div>
              <Label>帳號 *</Label>
              <Input value={accountForm.accountNo} onChange={e => setAccountForm(f => ({ ...f, accountNo: e.target.value }))} />
            </div>
            <div>
              <Label>期初餘額</Label>
              <Input type="number" value={accountForm.openingBalance} onChange={e => setAccountForm(f => ({ ...f, openingBalance: e.target.value }))} />
            </div>
            {accountForm.accountType === 'CREDIT_CARD' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>信用額度</Label>
                  <Input type="number" value={accountForm.creditLimit} onChange={e => setAccountForm(f => ({ ...f, creditLimit: e.target.value }))} />
                </div>
                <div>
                  <Label>結帳日</Label>
                  <Input type="number" min={1} max={31} value={accountForm.statementDay} onChange={e => setAccountForm(f => ({ ...f, statementDay: e.target.value }))} placeholder="日" />
                </div>
                <div>
                  <Label>繳款日</Label>
                  <Input type="number" min={1} max={31} value={accountForm.paymentDay} onChange={e => setAccountForm(f => ({ ...f, paymentDay: e.target.value }))} placeholder="日" />
                </div>
              </div>
            )}
            <div>
              <Label>備註</Label>
              <Input value={accountForm.notes} onChange={e => setAccountForm(f => ({ ...f, notes: e.target.value }))} placeholder="選填" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewAccount(false)}>取消</Button>
            <Button onClick={handleCreateAccount} disabled={actionLoading}>{actionLoading ? '建立中...' : '建立'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Transaction Dialog */}
      <Dialog open={!!showNewTx} onOpenChange={open => { if (!open) setShowNewTx(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>記錄交易</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>交易日期</Label>
                <Input type="date" value={txForm.txDate} onChange={e => setTxForm(f => ({ ...f, txDate: e.target.value }))} />
              </div>
              <div>
                <Label>方向</Label>
                <Select value={txForm.direction} onValueChange={v => { if (v) setTxForm(f => ({ ...f, direction: v })) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBIT">支出（DEBIT）</SelectItem>
                    <SelectItem value="CREDIT">存入（CREDIT）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>說明 *</Label>
              <Input value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>金額 *</Label>
                <Input type="number" min={0} value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>票號/流水號</Label>
                <Input value={txForm.referenceNo} onChange={e => setTxForm(f => ({ ...f, referenceNo: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>備註</Label>
              <Input value={txForm.notes} onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))} placeholder="選填" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTx(null)}>取消</Button>
            <Button onClick={handleCreateTx} disabled={actionLoading}>{actionLoading ? '記錄中...' : '記錄'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
