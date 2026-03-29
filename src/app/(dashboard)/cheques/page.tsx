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
import { Plus, RefreshCw, FileText, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface Cheque {
  id: string
  chequeNo: string
  chequeType: string
  bankName: string
  bankBranch: string | null
  amount: string
  issueDate: string
  dueDate: string
  status: string
  partyName: string | null
  returnReason: string | null
  notes: string | null
  createdBy: { name: string }
  createdAt: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  HOLDING:     { label: '持有中',  color: 'bg-blue-100 text-blue-700' },
  DEPOSITED:   { label: '已存入',  color: 'bg-yellow-100 text-yellow-700' },
  CLEARED:     { label: '已兌現',  color: 'bg-green-100 text-green-700' },
  BOUNCED:     { label: '退票',    color: 'bg-red-100 text-red-700' },
  CANCELLED:   { label: '作廢',    color: 'bg-gray-100 text-gray-500' },
  TRANSFERRED: { label: '背書轉讓', color: 'bg-purple-100 text-purple-700' },
}

const fmt = (v: string | number) =>
  Number(v).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default function ChequesPage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const canManage = ['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)

  const [cheques, setCheques] = useState<Cheque[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editCheque, setEditCheque] = useState<Cheque | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [form, setForm] = useState({
    chequeNo: '', chequeType: 'RECEIVABLE', bankName: '', bankBranch: '',
    accountNo: '', amount: '', issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '', partyName: '', notes: '',
  })

  const [statusForm, setStatusForm] = useState({ status: '', returnReason: '', depositedAt: '', clearedAt: '' })

  const fetchCheques = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter) params.set('chequeType', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/finance/cheques?${params}`)
      const json = await res.json()
      setCheques(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter, search])

  useEffect(() => { fetchCheques() }, [fetchCheques])

  // Highlight due-soon cheques (within 7 days)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueSoon = (dateStr: string) => {
    const d = new Date(dateStr)
    const diff = (d.getTime() - today.getTime()) / 86400000
    return diff >= 0 && diff <= 7
  }
  const overdue = (dateStr: string) => new Date(dateStr) < today

  async function handleCreate() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/finance/cheques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? dict.common.createFailed); return }
      toast.success(dict.cheques.created)
      setShowNew(false)
      fetchCheques()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUpdateStatus() {
    if (!editCheque) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/finance/cheques/${editCheque.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusForm),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? dict.common.updateFailed); return }
      toast.success(dict.cheques.statusUpdated)
      setEditCheque(null)
      fetchCheques()
    } finally {
      setActionLoading(false)
    }
  }

  const holdingReceivable = cheques.filter(c => c.chequeType === 'RECEIVABLE' && c.status === 'HOLDING')
  const holdingPayable = cheques.filter(c => c.chequeType === 'PAYABLE' && c.status === 'HOLDING')

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold">{dict.nav.cheques ?? '支票交易管理'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理應收票、應付票與票期兌現追蹤</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCheques}><RefreshCw className="w-4 h-4" /></Button>
          {canManage && <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-1" />新增支票</Button>}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">應收票（持有中）</div>
          <div className="text-lg font-bold text-green-700 mt-1">
            {fmt(holdingReceivable.reduce((s, c) => s + Number(c.amount), 0))}
          </div>
          <div className="text-xs text-muted-foreground">{holdingReceivable.length} 張</div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">應付票（持有中）</div>
          <div className="text-lg font-bold text-red-600 mt-1">
            {fmt(holdingPayable.reduce((s, c) => s + Number(c.amount), 0))}
          </div>
          <div className="text-xs text-muted-foreground">{holdingPayable.length} 張</div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">7天內到期</div>
          <div className="text-lg font-bold text-yellow-600 mt-1">
            {cheques.filter(c => c.status === 'HOLDING' && dueSoon(c.dueDate)).length} 張
          </div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">已過期未兌現</div>
          <div className="text-lg font-bold text-red-700 mt-1">
            {cheques.filter(c => c.status === 'HOLDING' && overdue(c.dueDate)).length} 張
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="w-48" placeholder="搜尋票號/往來對象" value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchCheques()} />
        <Select value={typeFilter || '__all__'} onValueChange={v => { if (v) setTypeFilter(v === '__all__' ? '' : v) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="票據類型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部類型</SelectItem>
            <SelectItem value="RECEIVABLE">應收票</SelectItem>
            <SelectItem value="PAYABLE">應付票</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter || '__all__'} onValueChange={v => { if (v) setStatusFilter(v === '__all__' ? '' : v) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="狀態" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部狀態</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : cheques.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>尚無支票紀錄</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-2 pr-3">票號</th>
                <th className="text-left py-2 pr-3">類型</th>
                <th className="text-left py-2 pr-3">往來對象</th>
                <th className="text-left py-2 pr-3">銀行</th>
                <th className="text-right py-2 pr-3">金額</th>
                <th className="text-left py-2 pr-3">到期日</th>
                <th className="text-left py-2 pr-3">狀態</th>
                {canManage && <th className="py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {cheques.map(c => (
                <tr key={c.id} className={`border-b hover:bg-muted/30 ${
                  c.status === 'HOLDING' && overdue(c.dueDate) ? 'bg-red-50' :
                  c.status === 'HOLDING' && dueSoon(c.dueDate) ? 'bg-yellow-50' : ''
                }`}>
                  <td className="py-2 pr-3 font-medium">{c.chequeNo}</td>
                  <td className="py-2 pr-3">
                    <Badge className={c.chequeType === 'RECEIVABLE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {c.chequeType === 'RECEIVABLE' ? '應收' : '應付'}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">{c.partyName ?? '-'}</td>
                  <td className="py-2 pr-3">{c.bankName}{c.bankBranch ? ` ${c.bankBranch}` : ''}</td>
                  <td className="py-2 pr-3 text-right font-medium">{fmt(c.amount)}</td>
                  <td className="py-2 pr-3">
                    <span className={
                      c.status === 'HOLDING' && overdue(c.dueDate) ? 'text-red-600 font-bold' :
                      c.status === 'HOLDING' && dueSoon(c.dueDate) ? 'text-yellow-600 font-medium' : ''
                    }>
                      {c.dueDate.slice(0, 10)}
                      {c.status === 'HOLDING' && overdue(c.dueDate) && (
                        <AlertTriangle className="inline w-3 h-3 ml-1" />
                      )}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge className={STATUS_MAP[c.status]?.color ?? ''}>
                      {STATUS_MAP[c.status]?.label ?? c.status}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="py-2">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditCheque(c)
                        setStatusForm({ status: c.status, returnReason: c.returnReason ?? '', depositedAt: '', clearedAt: '' })
                      }}>更新</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Cheque Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增支票</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>票據類型</Label>
                <Select value={form.chequeType} onValueChange={v => { if (v) setForm(f => ({ ...f, chequeType: v })) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEIVABLE">應收票</SelectItem>
                    <SelectItem value="PAYABLE">應付票</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>票號 *</Label>
                <Input value={form.chequeNo} onChange={e => setForm(f => ({ ...f, chequeNo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>銀行名稱 *</Label>
                <Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} />
              </div>
              <div>
                <Label>分行</Label>
                <Input value={form.bankBranch} onChange={e => setForm(f => ({ ...f, bankBranch: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>往來對象</Label>
              <Input value={form.partyName} onChange={e => setForm(f => ({ ...f, partyName: e.target.value }))} placeholder="付款人/受款人" />
            </div>
            <div>
              <Label>金額 *</Label>
              <Input type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>簽發日</Label>
                <Input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
              </div>
              <div>
                <Label>到期日 *</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>備註</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="選填" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={actionLoading}>{actionLoading ? '建立中...' : '建立'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={!!editCheque} onOpenChange={open => { if (!open) setEditCheque(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>更新支票狀態 — {editCheque?.chequeNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>狀態</Label>
              <Select value={statusForm.status} onValueChange={v => { if (v) setStatusForm(f => ({ ...f, status: v })) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(statusForm.status === 'DEPOSITED' || statusForm.status === 'CLEARED') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>存入日期</Label>
                  <Input type="date" value={statusForm.depositedAt} onChange={e => setStatusForm(f => ({ ...f, depositedAt: e.target.value }))} />
                </div>
                {statusForm.status === 'CLEARED' && (
                  <div>
                    <Label>兌現日期</Label>
                    <Input type="date" value={statusForm.clearedAt} onChange={e => setStatusForm(f => ({ ...f, clearedAt: e.target.value }))} />
                  </div>
                )}
              </div>
            )}
            {statusForm.status === 'BOUNCED' && (
              <div>
                <Label>退票原因</Label>
                <Input value={statusForm.returnReason} onChange={e => setStatusForm(f => ({ ...f, returnReason: e.target.value }))} placeholder="例：存款不足" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCheque(null)}>取消</Button>
            <Button onClick={handleUpdateStatus} disabled={actionLoading}>{actionLoading ? '更新中...' : '更新'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
