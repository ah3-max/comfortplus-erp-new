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
import { Lock, Unlock, CheckCircle2, Plus, RefreshCw, BookOpen, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface FiscalPeriod {
  id: string
  periodCode: string
  periodType: string
  year: number
  month: number | null
  quarter: number | null
  startDate: string
  endDate: string
  status: 'OPEN' | 'CLOSING' | 'CLOSED' | 'LOCKED'
  closedAt: string | null
  closedBy: { name: string } | null
  lockedAt: string | null
  lockedBy: { name: string } | null
  createdBy: { name: string }
  createdAt: string
  notes: string | null
  _count: { journalEntries: number }
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-700',
  CLOSING: 'bg-yellow-100 text-yellow-700',
  CLOSED: 'bg-blue-100 text-blue-700',
  LOCKED: 'bg-gray-100 text-gray-700',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: '開放',
  CLOSING: '結帳中',
  CLOSED: '已結帳',
  LOCKED: '鎖定',
}

interface FormState {
  periodType: string
  year: string
  month: string
  quarter: string
  startDate: string
  endDate: string
  notes: string
}

export default function PeriodClosePage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const canManage = ['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)

  const [periods, setPeriods] = useState<FiscalPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string; label: string; code: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [form, setForm] = useState<FormState>({
    periodType: 'MONTHLY',
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
    quarter: '1',
    startDate: '',
    endDate: '',
    notes: '',
  })

  const fetchPeriods = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (yearFilter) params.set('year', yearFilter)
      const res = await fetch(`/api/finance/fiscal-periods?${params}`)
      const json = await res.json()
      setPeriods(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [yearFilter])

  useEffect(() => { fetchPeriods() }, [fetchPeriods])

  useEffect(() => {
    const y = Number(form.year)
    const m = Number(form.month)
    const q = Number(form.quarter)
    if (form.periodType === 'MONTHLY' && y && m) {
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0)
      setForm(f => ({ ...f, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }))
    } else if (form.periodType === 'QUARTERLY' && y && q) {
      const startM = (q - 1) * 3
      const start = new Date(y, startM, 1)
      const end = new Date(y, startM + 3, 0)
      setForm(f => ({ ...f, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }))
    } else if (form.periodType === 'ANNUAL' && y) {
      setForm(f => ({ ...f, startDate: `${y}-01-01`, endDate: `${y}-12-31` }))
    }
  }, [form.periodType, form.year, form.month, form.quarter])

  function setField(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleCreate() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/finance/fiscal-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          month: form.periodType === 'MONTHLY' ? Number(form.month) : null,
          quarter: form.periodType === 'QUARTERLY' ? Number(form.quarter) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? dict.common.createFailed); return }
      toast.success(dict.periodClose.created)
      setShowNewDialog(false)
      fetchPeriods()
    } finally {
      setActionLoading(false)
    }
  }

  async function executeAction() {
    if (!confirmAction) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/finance/fiscal-periods/${confirmAction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirmAction.action }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? dict.common.operationFailed); return }
      toast.success(`${confirmAction.label}成功`)
      setConfirmAction(null)
      fetchPeriods()
    } finally {
      setActionLoading(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold">{dict.nav.periodClose}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理會計期間開放、結帳與鎖定狀態</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPeriods}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />新增期間
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <Select value={yearFilter} onValueChange={(v) => { if (v) setYearFilter(v) }}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : periods.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>尚無會計期間，請新增</p>
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map(p => (
            <div key={p.id} className="border rounded-lg p-4 bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold w-24">{p.periodCode}</div>
                  <Badge className={STATUS_COLORS[p.status]}>
                    {STATUS_LABELS[p.status]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {p.periodType === 'MONTHLY' ? '月結' : p.periodType === 'QUARTERLY' ? '季結' : '年結'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage && p.status === 'OPEN' && (
                    <Button size="sm" variant="outline"
                      onClick={() => setConfirmAction({ id: p.id, action: 'START_CLOSING', label: '開始結帳', code: p.periodCode })}>
                      <RefreshCw className="w-3 h-3 mr-1" />開始結帳
                    </Button>
                  )}
                  {canManage && (p.status === 'OPEN' || p.status === 'CLOSING') && (
                    <Button size="sm" variant="default"
                      onClick={() => setConfirmAction({ id: p.id, action: 'CLOSE', label: '執行結帳', code: p.periodCode })}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />執行結帳
                    </Button>
                  )}
                  {canManage && p.status === 'CLOSED' && (
                    <>
                      <Button size="sm" variant="outline"
                        onClick={() => setConfirmAction({ id: p.id, action: 'REOPEN', label: '重新開啟', code: p.periodCode })}>
                        <Unlock className="w-3 h-3 mr-1" />重新開啟
                      </Button>
                      <Button size="sm" variant="destructive"
                        onClick={() => setConfirmAction({ id: p.id, action: 'LOCK', label: '鎖定期間', code: p.periodCode })}>
                        <Lock className="w-3 h-3 mr-1" />鎖定
                      </Button>
                    </>
                  )}
                  {p.status === 'LOCKED' && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" />已鎖定
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                <div><span className="font-medium text-foreground">期間：</span>
                  {p.startDate.slice(0, 10)} ~ {p.endDate.slice(0, 10)}
                </div>
                <div><span className="font-medium text-foreground">傳票數：</span>{p._count.journalEntries}</div>
                {p.closedAt && (
                  <div><span className="font-medium text-foreground">結帳：</span>
                    {new Date(p.closedAt).toLocaleDateString('zh-TW')} ({p.closedBy?.name})
                  </div>
                )}
                {p.lockedAt && (
                  <div><span className="font-medium text-foreground">鎖定：</span>
                    {new Date(p.lockedAt).toLocaleDateString('zh-TW')} ({p.lockedBy?.name})
                  </div>
                )}
              </div>
              {p.notes && <p className="mt-2 text-xs text-muted-foreground">{p.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* New Period Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增會計期間</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>期間類型</Label>
                <Select value={form.periodType} onValueChange={(v) => { if (v) setField('periodType', v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">月結</SelectItem>
                    <SelectItem value="QUARTERLY">季結</SelectItem>
                    <SelectItem value="ANNUAL">年結</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>年度</Label>
                <Select value={form.year} onValueChange={(v) => { if (v) setField('year', v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.periodType === 'MONTHLY' && (
              <div>
                <Label>月份</Label>
                <Select value={form.month} onValueChange={(v) => { if (v) setField('month', v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <SelectItem key={m} value={String(m)}>{m} 月</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.periodType === 'QUARTERLY' && (
              <div>
                <Label>季別</Label>
                <Select value={form.quarter} onValueChange={(v) => { if (v) setField('quarter', v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(q => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>起始日</Label>
                <Input type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} />
              </div>
              <div>
                <Label>截止日</Label>
                <Input type="date" value={form.endDate} onChange={e => setField('endDate', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>備註</Label>
              <Input value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="選填" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={actionLoading}>
              {actionLoading ? '建立中...' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              確認{confirmAction?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            即將對期間 <strong className="text-foreground">{confirmAction?.code}</strong> 執行「{confirmAction?.label}」操作。
            {confirmAction?.action === 'LOCK' && ' 鎖定後將無法再異動此期間的任何資料。'}
            {confirmAction?.action === 'CLOSE' && ' 結帳後此期間將不再接受新傳票建立。'}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={actionLoading}>取消</Button>
            <Button onClick={executeAction} disabled={actionLoading}
              variant={confirmAction?.action === 'LOCK' ? 'destructive' : 'default'}>
              {actionLoading ? '執行中...' : `確認${confirmAction?.label ?? ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
