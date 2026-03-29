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

  const STATUS_LABELS: Record<string, string> = {
    OPEN: dict.periodClose.statusLabels.OPEN,
    CLOSING: dict.periodClose.statusLabels.CLOSING,
    CLOSED: dict.periodClose.statusLabels.CLOSED,
    LOCKED: dict.periodClose.statusLabels.LOCKED,
  }

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
      toast.success(`${confirmAction.label}${dict.common.success}`)
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
          <p className="text-sm text-muted-foreground mt-0.5">{dict.periodClose.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPeriods}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />{dict.periodClose.addPeriod}
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
              <SelectItem key={y} value={String(y)}>{y} {dict.periodClose.filterYear}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{dict.periodClose.loading}</div>
      ) : periods.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{dict.periodClose.empty}</p>
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
                    {p.periodType === 'MONTHLY' ? dict.periodClose.typeMonth : p.periodType === 'QUARTERLY' ? dict.periodClose.typeQuarter : dict.periodClose.typeYear}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage && p.status === 'OPEN' && (
                    <Button size="sm" variant="outline"
                      onClick={() => setConfirmAction({ id: p.id, action: 'START_CLOSING', label: dict.periodClose.actionStartClose, code: p.periodCode })}>
                      <RefreshCw className="w-3 h-3 mr-1" />{dict.periodClose.actionStartClose}
                    </Button>
                  )}
                  {canManage && (p.status === 'OPEN' || p.status === 'CLOSING') && (
                    <Button size="sm" variant="default"
                      onClick={() => setConfirmAction({ id: p.id, action: 'CLOSE', label: dict.periodClose.actionExecuteClose, code: p.periodCode })}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />{dict.periodClose.actionExecuteClose}
                    </Button>
                  )}
                  {canManage && p.status === 'CLOSED' && (
                    <>
                      <Button size="sm" variant="outline"
                        onClick={() => setConfirmAction({ id: p.id, action: 'REOPEN', label: dict.periodClose.actionReopen, code: p.periodCode })}>
                        <Unlock className="w-3 h-3 mr-1" />{dict.periodClose.actionReopen}
                      </Button>
                      <Button size="sm" variant="destructive"
                        onClick={() => setConfirmAction({ id: p.id, action: 'LOCK', label: dict.periodClose.actionLock, code: p.periodCode })}>
                        <Lock className="w-3 h-3 mr-1" />{dict.periodClose.actionLock}
                      </Button>
                    </>
                  )}
                  {p.status === 'LOCKED' && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" />{dict.periodClose.actionLocked}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                <div><span className="font-medium text-foreground">{dict.periodClose.detailPeriod}：</span>
                  {p.startDate.slice(0, 10)} ~ {p.endDate.slice(0, 10)}
                </div>
                <div><span className="font-medium text-foreground">{dict.periodClose.detailVouchers}：</span>{p._count.journalEntries}</div>
                {p.closedAt && (
                  <div><span className="font-medium text-foreground">{dict.periodClose.detailClosed}：</span>
                    {new Date(p.closedAt).toLocaleDateString('zh-TW')} ({p.closedBy?.name})
                  </div>
                )}
                {p.lockedAt && (
                  <div><span className="font-medium text-foreground">{dict.periodClose.detailLocked}：</span>
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
            <DialogTitle>{dict.periodClose.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{dict.periodClose.fieldType}</Label>
                <Select value={form.periodType} onValueChange={(v) => { if (v) setField('periodType', v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">{dict.periodClose.typeMonth}</SelectItem>
                    <SelectItem value="QUARTERLY">{dict.periodClose.typeQuarter}</SelectItem>
                    <SelectItem value="ANNUAL">{dict.periodClose.typeYear}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{dict.periodClose.fieldYear}</Label>
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
                <Label>{dict.periodClose.fieldMonth}</Label>
                <Select value={form.month} onValueChange={(v) => { if (v) setField('month', v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.periodType === 'QUARTERLY' && (
              <div>
                <Label>{dict.periodClose.fieldQuarter}</Label>
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
                <Label>{dict.periodClose.fieldStartDate}</Label>
                <Input type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} />
              </div>
              <div>
                <Label>{dict.periodClose.fieldEndDate}</Label>
                <Input type="date" value={form.endDate} onChange={e => setField('endDate', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{dict.periodClose.fieldNotes}</Label>
              <Input value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder={dict.common.optional} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={actionLoading}>
              {actionLoading ? dict.periodClose.creating : dict.periodClose.btnCreate}
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
              {dict.common.confirm}{confirmAction?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            {confirmAction?.code} — {confirmAction?.label}
            {confirmAction?.action === 'LOCK' && ` ${dict.periodClose.actionLocked}`}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={actionLoading}>{dict.common.cancel}</Button>
            <Button onClick={executeAction} disabled={actionLoading}
              variant={confirmAction?.action === 'LOCK' ? 'destructive' : 'default'}>
              {actionLoading ? dict.periodClose.executing : `${dict.common.confirm}${confirmAction?.label ?? ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
