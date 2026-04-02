'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft, ChevronRight, RefreshCw, Plus, Loader2, MapPin,
  Clock, CheckCircle2, Car, AlertTriangle, XCircle, ClipboardList,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'

/* ── Types ───────────────────────────────────────────────────────────────── */
interface TourUser    { id: string; name: string; role: string }
interface TourCustomer { id: string; name: string; type: string; region: string | null; address: string | null }
interface Tour {
  id: string; tourNo: string; status: string; tourType: string
  plannedStartTime: string | null; reminderMinutes: number; purpose: string | null
  reportResult: string | null; reportedAt: string | null
  departedAt: string | null; arrivedAt: string | null; completedAt: string | null
  reminderSentAt: string | null
  assignedUser: TourUser; customer: TourCustomer
}

/* ── Constants ───────────────────────────────────────────────────────────── */
const MANAGER_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'CS']

const TOUR_TYPE_VALUES = ['ROUTINE_VISIT', 'DIAPER_CHECK', 'COMPLAINT_FOLLOW', 'TRAINING', 'ONBOARDING', 'PAYMENT', 'OTHER']

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED:   'bg-blue-100 text-blue-700',
  DEPARTED:    'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED:   'bg-green-100 text-green-700',
  MISSED:      'bg-red-100 text-red-700',
  CANCELLED:   'bg-gray-100 text-gray-500',
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'SCHEDULED':   return <Clock className="h-3 w-3" />
    case 'DEPARTED':    return <Car className="h-3 w-3" />
    case 'IN_PROGRESS': return <MapPin className="h-3 w-3" />
    case 'COMPLETED':   return <CheckCircle2 className="h-3 w-3" />
    case 'MISSED':      return <AlertTriangle className="h-3 w-3" />
    case 'CANCELLED':   return <XCircle className="h-3 w-3" />
    default:            return null
  }
}

function formatDate(d: Date) {
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function InstitutionToursPage() {
  const { data: session } = useSession()
  const { dict } = useI18n()
  const itp = dict.institutionToursPage
  const drr = dict.dailyReminderRoles
  const userRole = (session?.user as { role?: string })?.role ?? ''
  const isManager = MANAGER_ROLES.includes(userRole)

  const getTourTypeLabel = (value: string): string =>
    (itp.tourTypes as Record<string, string>)[value] ?? value

  const getStatusLabel = (status: string): string =>
    (itp.statuses as Record<string, string>)[status] ?? status

  const [date, setDate] = useState(() => new Date())
  const [tours, setTours] = useState<Tour[]>([])
  const [fieldUsers, setFieldUsers] = useState<TourUser[]>([])
  const [loading, setLoading] = useState(false)

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [customers, setCustomers] = useState<TourCustomer[]>([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    assignedUserId: '', customerId: '', tourDate: '',
    plannedStartTime: '', reminderMinutes: '30',
    tourType: 'ROUTINE_VISIT', purpose: '',
  })

  // Report dialog
  const [reportTour, setReportTour] = useState<Tour | null>(null)
  const [reportText, setReportText] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

  // Action loading
  const [actionId, setActionId] = useState<string | null>(null)

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const fetchTours = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/institution-tours?date=${dateStr}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setTours(json.data ?? [])
      setFieldUsers(json.fieldUsers ?? [])
    } catch {
      toast.error(itp.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [dateStr])

  useEffect(() => { fetchTours() }, [fetchTours])

  // 開啟新增 dialog 時載入客戶清單
  const openCreate = async () => {
    if (customers.length === 0) {
      try {
        const res = await fetch('/api/customers?pageSize=500&isActive=true')
        const json = await res.json()
        setCustomers(json.data ?? [])
      } catch { /* ignore */ }
    }
    setForm(f => ({ ...f, tourDate: dateStr }))
    setShowCreate(true)
  }

  const handleCreate = async () => {
    if (!form.customerId || !form.tourDate) {
      toast.error(itp.createRequired)
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/institution-tours', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...form,
          reminderMinutes: Number(form.reminderMinutes) || 30,
          assignedUserId:  form.assignedUserId || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(itp.createSuccess)
      setShowCreate(false)
      fetchTours()
    } catch {
      toast.error(itp.createFailed)
    } finally {
      setCreating(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    setActionId(id)
    try {
      const res = await fetch(`/api/institution-tours/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      fetchTours()
    } catch {
      toast.error(itp.statusUpdateFailed)
    } finally {
      setActionId(null)
    }
  }

  const handleSubmitReport = async () => {
    if (!reportTour) return
    setSubmittingReport(true)
    try {
      const res = await fetch(`/api/institution-tours/${reportTour.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'COMPLETED', reportResult: reportText }),
      })
      if (!res.ok) throw new Error()
      toast.success(itp.reportSuccess)
      setReportTour(null)
      setReportText('')
      fetchTours()
    } catch {
      toast.error(itp.reportFailed)
    } finally {
      setSubmittingReport(false)
    }
  }

  // Stats
  const total     = tours.length
  const scheduled = tours.filter(t => t.status === 'SCHEDULED').length
  const departed  = tours.filter(t => ['DEPARTED', 'IN_PROGRESS'].includes(t.status)).length
  const completed = tours.filter(t => t.status === 'COMPLETED').length
  const missed    = tours.filter(t => t.status === 'MISSED').length

  const shiftDate = (days: number) => {
    const d = new Date(date); d.setDate(d.getDate() + days); setDate(d)
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{itp.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{itp.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[90px] text-center">{formatDate(date)}</span>
          <Button variant="outline" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={fetchTours} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" />{itp.addNew}</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: itp.statTotal,       value: total,     color: 'text-foreground' },
          { label: itp.statScheduled,   value: scheduled, color: 'text-blue-600' },
          { label: itp.statInProgress,  value: departed,  color: 'text-amber-600' },
          { label: itp.statCompleted,   value: completed, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {missed > 0 && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          今日 {missed} 筆未完成巡迴，請跟進。
        </div>
      )}

      {/* Tour List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> {dict.common.loading}
        </div>
      ) : tours.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">{dict.common.noData}</div>
      ) : (
        <div className="space-y-3">
          {tours.map(tour => {
            const statusColor = STATUS_COLORS[tour.status] ?? 'bg-gray-100 text-gray-500'
            const statusLabel = getStatusLabel(tour.status)
            const isLoading = actionId === tour.id
            const isOwn = (session?.user as { id?: string })?.id === tour.assignedUser.id

            return (
              <Card key={tour.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{tour.customer.name}</span>
                        {tour.customer.region && (
                          <span className="text-xs text-muted-foreground">{tour.customer.region}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {tour.assignedUser.name}（{(drr as Record<string, string>)[tour.assignedUser.role] ?? tour.assignedUser.role}）
                        </span>
                        {tour.plannedStartTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {tour.plannedStartTime}
                          </span>
                        )}
                        {tour.customer.address && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {tour.customer.address}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={`shrink-0 gap-1 ${statusColor} border-0 text-xs`}>
                      <StatusIcon status={tour.status} />{statusLabel}
                    </Badge>
                  </div>

                  {/* Type + purpose */}
                  <div className="flex gap-2 flex-wrap text-xs">
                    <span className="bg-muted rounded px-2 py-0.5">
                      {getTourTypeLabel(tour.tourType)}
                    </span>
                    {tour.purpose && <span className="text-muted-foreground">{tour.purpose}</span>}
                    {tour.reminderSentAt && (
                      <span className="text-blue-500">✉ 提醒已發送</span>
                    )}
                  </div>

                  {/* Report */}
                  {tour.reportResult && (
                    <div className="bg-muted/50 rounded-md p-2 text-xs text-muted-foreground">
                      <ClipboardList className="h-3 w-3 inline mr-1" />
                      {tour.reportResult}
                    </div>
                  )}

                  {/* Action buttons */}
                  {(isOwn || isManager) && (
                    <div className="flex gap-2 flex-wrap pt-1">
                      {tour.status === 'SCHEDULED' && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs active:scale-[0.97]"
                          disabled={isLoading} onClick={() => handleStatusChange(tour.id, 'DEPARTED')}>
                          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Car className="h-3 w-3" />}
                          出發
                        </Button>
                      )}
                      {tour.status === 'DEPARTED' && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs active:scale-[0.97]"
                          disabled={isLoading} onClick={() => handleStatusChange(tour.id, 'IN_PROGRESS')}>
                          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                          已到達
                        </Button>
                      )}
                      {(tour.status === 'IN_PROGRESS' || tour.status === 'DEPARTED') && (
                        <Button size="sm" className="gap-1 text-xs active:scale-[0.97]"
                          onClick={() => { setReportTour(tour); setReportText(tour.reportResult ?? '') }}>
                          <ClipboardList className="h-3 w-3" />完成並回報
                        </Button>
                      )}
                      {tour.status === 'SCHEDULED' && isManager && (
                        <Button size="sm" variant="ghost" className="gap-1 text-xs text-muted-foreground"
                          disabled={isLoading} onClick={() => handleStatusChange(tour.id, 'CANCELLED')}>
                          取消
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增機構巡迴排程</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {isManager && fieldUsers.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium">指派人員</label>
                <Select value={form.assignedUserId} onValueChange={v => setForm(f => ({ ...f, assignedUserId: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="選擇業務/照顧督導" /></SelectTrigger>
                  <SelectContent>
                    {fieldUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}（{(drr as Record<string, string>)[u.role] ?? u.role}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">目標機構 *</label>
              <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="選擇機構" /></SelectTrigger>
                <SelectContent className="max-h-48">
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">巡迴日期 *</label>
                <Input type="date" value={form.tourDate}
                  onChange={e => setForm(f => ({ ...f, tourDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">預計出發時間</label>
                <Input type="time" value={form.plannedStartTime}
                  onChange={e => setForm(f => ({ ...f, plannedStartTime: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">{itp.tourTypeLabel}</label>
                <Select value={form.tourType} onValueChange={v => setForm(f => ({ ...f, tourType: v ?? 'ROUTINE_VISIT' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TOUR_TYPE_VALUES.map(v => <SelectItem key={v} value={v}>{getTourTypeLabel(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">提醒提前（分鐘）</label>
                <Input type="number" min={5} max={120} value={form.reminderMinutes}
                  onChange={e => setForm(f => ({ ...f, reminderMinutes: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">目的說明</label>
              <Input placeholder="例：確認乾爽褲用量、處理訂單問題"
                value={form.purpose}
                onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={!!reportTour} onOpenChange={open => { if (!open) setReportTour(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>完成回報</DialogTitle>
            <p className="text-sm text-muted-foreground">{reportTour?.customer.name}</p>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-sm font-medium">回報內容</label>
            <Textarea
              placeholder="說明本次拜訪結果、處理事項、後續追蹤…"
              className="min-h-[100px]"
              value={reportText}
              onChange={e => setReportText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportTour(null)}>取消</Button>
            <Button onClick={handleSubmitReport} disabled={submittingReport}>
              {submittingReport ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              完成並送出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
