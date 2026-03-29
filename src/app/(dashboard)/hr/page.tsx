'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Users, CalendarDays, Clock, DollarSign, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'

interface Employee {
  id: string; name: string; email: string; role: string; isActive: boolean
  mobile: string | null; title: string | null; hireDate: string | null
  employeeProfile: {
    gender?: string | null; birthday?: string | null; emergencyContact?: string | null
    emergencyPhone?: string | null; bankAccount?: string | null; bankName?: string | null
    education?: string | null
  } | null
}

interface AppointmentRow {
  id: string; effectiveDate: string; type: string
  fromRole: string | null; toRole: string | null; fromTitle: string | null; toTitle: string | null
  reason: string | null; user: { name: string }
}

interface AttendanceRow {
  id: string; date: string; clockIn: string | null; clockOut: string | null
  status: string; leaveType: string | null; overtime: number | null
  user: { name: string }
}

interface PayrollRow {
  id: string; periodYear: number; periodMonth: number
  baseSalary: number; allowances: number; overtimePay: number; bonus: number
  deductions: number; laborInsurance: number; healthInsurance: number; tax: number
  netPay: number; status: string; user: { name: string; email: string }
}

const ATT_STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700',
  ABSENT:  'bg-red-100 text-red-700',
  LATE:    'bg-amber-100 text-amber-700',
  LEAVE:   'bg-blue-100 text-blue-700',
  HOLIDAY: 'bg-slate-100 text-slate-600',
}

function fmt(n: number) { return n.toLocaleString('zh-TW') }

export default function HRPage() {
  const { dict } = useI18n()
  const hr = dict.hr
  const ROLES = hr.roleLabels as Record<string, string>
  const APPT_TYPES = hr.appointmentTypes as Record<string, string>
  const ATT_STATUSES = hr.attendanceStatuses as Record<string, string>
  const PROFILE_FIELDS = hr.profileFields as Record<string, string>
  const PAYROLL_FIELDS = hr.payrollFields as Record<string, string>

  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const isAdmin = ['SUPER_ADMIN', 'GM'].includes(role)
  const canView = ['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)

  // ── employees ──
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmp, setLoadingEmp] = useState(false)
  const [empDetail, setEmpDetail] = useState<Employee | null>(null)
  const [profileForm, setProfileForm] = useState<Record<string, string>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  // ── appointments ──
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [loadingAppt, setLoadingAppt] = useState(false)
  const [apptDialog, setApptDialog] = useState(false)
  const [apptForm, setApptForm] = useState({ userId: '', effectiveDate: '', type: 'HIRE', toRole: '', toTitle: '', reason: '' })

  // ── attendance ──
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [loadingAtt, setLoadingAtt] = useState(false)
  const [attMonth, setAttMonth] = useState(new Date().toISOString().slice(0, 7))
  const [attDialog, setAttDialog] = useState(false)
  const [attForm, setAttForm] = useState({ userId: '', date: new Date().toISOString().slice(0, 10), clockIn: '', clockOut: '', status: 'PRESENT', leaveType: '', overtime: '' })

  // ── payroll ──
  const [payroll, setPayroll] = useState<PayrollRow[]>([])
  const [loadingPay, setLoadingPay] = useState(false)
  const [payYear, setPayYear] = useState(new Date().getFullYear())
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1)
  const [payDialog, setPayDialog] = useState(false)
  const [payForm, setPayForm] = useState({ userId: '', baseSalary: '', allowances: '0', overtimePay: '0', bonus: '0', deductions: '0', laborInsurance: '0', healthInsurance: '0', tax: '0' })
  const [savingPay, setSavingPay] = useState(false)

  const loadEmployees = useCallback(() => {
    if (!canView) return
    setLoadingEmp(true)
    fetch('/api/hr/employees').then(r => r.json()).then(d => setEmployees(d.data ?? d ?? []))
      .finally(() => setLoadingEmp(false))
  }, [canView])

  const loadAppointments = useCallback(() => {
    if (!canView) return
    setLoadingAppt(true)
    fetch('/api/hr/appointments').then(r => r.json()).then(d => setAppointments(d.data ?? d ?? []))
      .finally(() => setLoadingAppt(false))
  }, [canView])

  const loadAttendance = useCallback(() => {
    if (!canView) return
    setLoadingAtt(true)
    fetch(`/api/hr/attendance?month=${attMonth}`).then(r => r.json()).then(d => setAttendance(d.data ?? d ?? []))
      .finally(() => setLoadingAtt(false))
  }, [canView, attMonth])

  const loadPayroll = useCallback(() => {
    if (!canView) return
    setLoadingPay(true)
    fetch(`/api/hr/payroll?periodYear=${payYear}&periodMonth=${payMonth}`).then(r => r.json()).then(d => setPayroll(d.data ?? d ?? []))
      .finally(() => setLoadingPay(false))
  }, [canView, payYear, payMonth])

  async function saveProfile() {
    if (!empDetail) return
    setSavingProfile(true)
    const res = await fetch('/api/hr/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: empDetail.id, ...profileForm }),
    })
    setSavingProfile(false)
    if (res.ok) { toast.success(hr.employeeSaved); setEmpDetail(null); loadEmployees() }
    else toast.error(dict.common.saveFailed)
  }

  async function createAppointment() {
    const res = await fetch('/api/hr/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apptForm),
    })
    if (res.ok) { toast.success(hr.appointmentCreated); setApptDialog(false); loadAppointments() }
    else toast.error(dict.common.createFailed)
  }

  async function createAttendance() {
    const res = await fetch('/api/hr/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: attForm.userId,
        date: attForm.date,
        clockIn: attForm.clockIn ? `${attForm.date}T${attForm.clockIn}:00` : undefined,
        clockOut: attForm.clockOut ? `${attForm.date}T${attForm.clockOut}:00` : undefined,
        status: attForm.status,
        leaveType: attForm.leaveType || undefined,
        overtime: attForm.overtime ? Number(attForm.overtime) : undefined,
      }),
    })
    if (res.ok) { toast.success(hr.attendanceCreated); setAttDialog(false); loadAttendance() }
    else toast.error(dict.common.createFailed)
  }

  async function createPayroll() {
    if (!payForm.userId || !payForm.baseSalary) { toast.error(dict.common.requiredFields); return }
    setSavingPay(true)
    const n = (v: string) => Number(v) || 0
    const base = n(payForm.baseSalary), allow = n(payForm.allowances), ot = n(payForm.overtimePay)
    const bonus = n(payForm.bonus), ded = n(payForm.deductions)
    const labor = n(payForm.laborInsurance), health = n(payForm.healthInsurance), tax = n(payForm.tax)
    const netPay = base + allow + ot + bonus - ded - labor - health - tax
    const res = await fetch('/api/hr/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: payForm.userId, periodYear: payYear, periodMonth: payMonth, baseSalary: base, allowances: allow, overtimePay: ot, bonus, deductions: ded, laborInsurance: labor, healthInsurance: health, tax, netPay }),
    })
    setSavingPay(false)
    if (res.ok) { toast.success(hr.payrollCreated); setPayDialog(false); loadPayroll() }
    else { const d = await res.json(); toast.error(d.error ?? dict.common.createFailed) }
  }

  if (!canView) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">{hr.noAccessHint}</div>
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{hr.title}</h1>
        <p className="text-sm text-muted-foreground">{hr.subtitle}</p>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees" onClick={loadEmployees} className="gap-1.5"><Users className="h-3.5 w-3.5" />{hr.employee}</TabsTrigger>
          <TabsTrigger value="appointments" onClick={loadAppointments} className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{hr.tabAppointments}</TabsTrigger>
          <TabsTrigger value="attendance" onClick={loadAttendance} className="gap-1.5"><Clock className="h-3.5 w-3.5" />{hr.attendance}</TabsTrigger>
          <TabsTrigger value="payroll" onClick={loadPayroll} className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />{hr.payroll}</TabsTrigger>
        </TabsList>

        {/* ═══ Employees ═══ */}
        <TabsContent value="employees" className="mt-4">
          {loadingEmp ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    {[dict.common.name, 'Email', dict.users.role, hr.position, dict.common.phone, hr.joinDate, dict.common.status].map(h => (
                      <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(e => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50/50 cursor-pointer" onClick={() => {
                      setEmpDetail(e)
                      setProfileForm({
                        gender: e.employeeProfile?.gender ?? '',
                        birthday: e.employeeProfile?.birthday?.slice(0, 10) ?? '',
                        emergencyContact: e.employeeProfile?.emergencyContact ?? '',
                        emergencyPhone: e.employeeProfile?.emergencyPhone ?? '',
                        bankAccount: e.employeeProfile?.bankAccount ?? '',
                        bankName: e.employeeProfile?.bankName ?? '',
                        education: e.employeeProfile?.education ?? '',
                      })
                    }}>
                      <td className="px-4 py-2 font-medium">{e.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{e.email}</td>
                      <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{ROLES[e.role] ?? e.role}</Badge></td>
                      <td className="px-4 py-2">{e.title ?? '-'}</td>
                      <td className="px-4 py-2">{e.mobile ?? '-'}</td>
                      <td className="px-4 py-2">{e.hireDate?.slice(0, 10) ?? '-'}</td>
                      <td className="px-4 py-2">{e.isActive
                        ? <span className="text-green-600 text-xs">{hr.statuses.ACTIVE}</span>
                        : <span className="text-slate-400 text-xs">{hr.statuses.RESIGNED}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ═══ Appointments ═══ */}
        <TabsContent value="appointments" className="mt-4 space-y-3">
          {isAdmin && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setApptDialog(true)}><Plus className="h-4 w-4 mr-1" />{hr.addAppointment}</Button>
            </div>
          )}
          {loadingAppt ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
            <div className="space-y-2">
              {appointments.map(a => (
                <Card key={a.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{APPT_TYPES[a.type] ?? a.type}</Badge>
                      <span className="font-medium">{a.user.name}</span>
                      {a.fromTitle && a.toTitle && <span className="text-sm text-muted-foreground">{a.fromTitle} → {a.toTitle}</span>}
                      {a.fromRole && a.toRole && <span className="text-sm text-muted-foreground">{ROLES[a.fromRole] ?? a.fromRole} → {ROLES[a.toRole] ?? a.toRole}</span>}
                    </div>
                    <div className="text-sm text-muted-foreground">{a.effectiveDate?.slice(0, 10)}</div>
                  </CardContent>
                </Card>
              ))}
              {appointments.length === 0 && <div className="text-center py-8 text-muted-foreground">{hr.noResults}</div>}
            </div>
          )}
        </TabsContent>

        {/* ═══ Attendance ═══ */}
        <TabsContent value="attendance" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="month" value={attMonth} onChange={e => setAttMonth(e.target.value)} className="w-40" />
            <Button variant="outline" size="sm" onClick={loadAttendance}>{dict.common.search}</Button>
            {isAdmin && <Button size="sm" onClick={() => { setAttForm(f => ({ ...f, userId: employees[0]?.id ?? '' })); setAttDialog(true) }}><Plus className="h-4 w-4 mr-1" />{hr.addAttendance}</Button>}
          </div>
          {loadingAtt ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    {[dict.common.date, dict.common.name, hr.colClockIn, hr.colClockOut, dict.common.status, hr.colLeaveType, hr.colOvertime].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(a => {
                    const statusLabel = ATT_STATUSES[a.status] ?? a.status
                    const statusColor = ATT_STATUS_COLORS[a.status] ?? ''
                    return (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{a.date?.slice(0, 10)}</td>
                        <td className="px-3 py-2 font-medium">{a.user.name}</td>
                        <td className="px-3 py-2">{a.clockIn ? new Date(a.clockIn).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="px-3 py-2">{a.clockOut ? new Date(a.clockOut).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className={statusColor}>{statusLabel}</Badge></td>
                        <td className="px-3 py-2">{a.leaveType ?? '-'}</td>
                        <td className="px-3 py-2">{a.overtime ? `${a.overtime}h` : '-'}</td>
                      </tr>
                    )
                  })}
                  {attendance.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{dict.common.noRecords}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ═══ Payroll ═══ */}
        <TabsContent value="payroll" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="number" value={payYear} onChange={e => setPayYear(Number(e.target.value))} className="w-24" min={2020} max={2030} />
            <span>{hr.yearUnit}</span>
            <Input type="number" value={payMonth} onChange={e => setPayMonth(Number(e.target.value))} className="w-20" min={1} max={12} />
            <span>{hr.monthUnit}</span>
            <Button variant="outline" size="sm" onClick={loadPayroll}>{dict.common.search}</Button>
            {isAdmin && <Button size="sm" onClick={() => { setPayForm(f => ({ ...f, userId: employees[0]?.id ?? '' })); setPayDialog(true) }}><Plus className="h-4 w-4 mr-1" />{hr.payroll}</Button>}
          </div>
          {loadingPay ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-slate-50">
                  <tr>
                    {[dict.common.name, hr.colBaseSalary, hr.colAllowances, hr.colOvertimePay, hr.colBonus, hr.colDeductions, hr.colLaborInsurance, hr.colHealthInsurance, hr.colTax, hr.colNetPay, dict.common.status].map(h => (
                      <th key={h} className="px-2 py-2 text-right font-medium text-muted-foreground first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payroll.map(p => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium text-left">{p.user.name}</td>
                      <td className="px-2 py-2 text-right">{fmt(Number(p.baseSalary))}</td>
                      <td className="px-2 py-2 text-right">{fmt(Number(p.allowances))}</td>
                      <td className="px-2 py-2 text-right">{fmt(Number(p.overtimePay))}</td>
                      <td className="px-2 py-2 text-right">{fmt(Number(p.bonus))}</td>
                      <td className="px-2 py-2 text-right text-red-600">{fmt(Number(p.deductions))}</td>
                      <td className="px-2 py-2 text-right">{fmt(Number(p.laborInsurance))}</td>
                      <td className="px-2 py-2 text-right">{fmt(Number(p.healthInsurance))}</td>
                      <td className="px-2 py-2 text-right">{fmt(Number(p.tax))}</td>
                      <td className="px-2 py-2 text-right font-bold">{fmt(Number(p.netPay))}</td>
                      <td className="px-2 py-2 text-right"><Badge variant="outline" className="text-xs">{p.status}</Badge></td>
                    </tr>
                  ))}
                  {payroll.length === 0 && (
                    <tr><td colSpan={11} className="px-2 py-8 text-center text-muted-foreground">{dict.common.noRecords}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Employee Profile Dialog */}
      <Dialog open={!!empDetail} onOpenChange={() => setEmpDetail(null)}>
        <DialogContent className="max-w-md">
          {empDetail && (
            <>
              <DialogHeader>
                <DialogTitle>{empDetail.name} — {hr.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {Object.entries(PROFILE_FIELDS).map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-sm">{label}</Label>
                    <Input
                      type={key === 'birthday' ? 'date' : 'text'}
                      value={profileForm[key] ?? ''}
                      onChange={e => setProfileForm(prev => ({ ...prev, [key]: e.target.value }))}
                      className="mt-1"
                      disabled={!isAdmin}
                    />
                  </div>
                ))}
              </div>
              {isAdmin && (
                <DialogFooter>
                  <Button onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{dict.common.save}
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Appointment Dialog */}
      <Dialog open={apptDialog} onOpenChange={setApptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hr.apptDialogTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{hr.employee}</Label>
              <Select value={apptForm.userId || 'none'} onValueChange={(v: string | null) => setApptForm(f => ({ ...f, userId: (v ?? '') === 'none' ? '' : (v ?? '') }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={hr.apptSelectPlaceholder} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{hr.apptSelectPlaceholder}</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{hr.apptFieldType}</Label>
              <Select value={apptForm.type} onValueChange={(v: string | null) => setApptForm(f => ({ ...f, type: v ?? 'HIRE' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APPT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{hr.apptFieldEffectiveDate}</Label>
              <Input type="date" value={apptForm.effectiveDate} onChange={e => setApptForm(f => ({ ...f, effectiveDate: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>{hr.apptFieldNewTitle}</Label>
              <Input value={apptForm.toTitle} onChange={e => setApptForm(f => ({ ...f, toTitle: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>{hr.apptFieldReason}</Label>
              <Input value={apptForm.reason} onChange={e => setApptForm(f => ({ ...f, reason: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApptDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={createAppointment} disabled={!apptForm.userId || !apptForm.effectiveDate}>{dict.common.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={attDialog} onOpenChange={setAttDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hr.attDialogTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{hr.employee}</Label>
              <Select value={attForm.userId || 'none'} onValueChange={v => setAttForm(f => ({ ...f, userId: v === 'none' ? '' : (v ?? '') }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={hr.apptSelectPlaceholder} /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{hr.attFieldDate}</Label><Input type="date" value={attForm.date} onChange={e => setAttForm(f => ({ ...f, date: e.target.value }))} className="mt-1" /></div>
              <div>
                <Label>{hr.attFieldStatus}</Label>
                <Select value={attForm.status} onValueChange={v => setAttForm(f => ({ ...f, status: v ?? 'PRESENT' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ATT_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{hr.attFieldClockIn}</Label><Input type="time" value={attForm.clockIn} onChange={e => setAttForm(f => ({ ...f, clockIn: e.target.value }))} className="mt-1" /></div>
              <div><Label>{hr.attFieldClockOut}</Label><Input type="time" value={attForm.clockOut} onChange={e => setAttForm(f => ({ ...f, clockOut: e.target.value }))} className="mt-1" /></div>
              <div><Label>{hr.attFieldOvertime}</Label><Input type="number" min={0} value={attForm.overtime} onChange={e => setAttForm(f => ({ ...f, overtime: e.target.value }))} className="mt-1" /></div>
              <div><Label>{hr.attFieldLeaveType}</Label><Input value={attForm.leaveType} onChange={e => setAttForm(f => ({ ...f, leaveType: e.target.value }))} className="mt-1" placeholder={hr.attFieldLeaveTypePlaceholder} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={createAttendance} disabled={!attForm.userId}>{dict.common.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payroll Dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hr.addPayrollTitle} ({payYear}/{String(payMonth).padStart(2,'0')})</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{hr.employee}</Label>
              <Select value={payForm.userId || 'none'} onValueChange={v => setPayForm(f => ({ ...f, userId: v === 'none' ? '' : (v ?? '') }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={hr.apptSelectPlaceholder} /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(PAYROLL_FIELDS) as [keyof typeof payForm, string][]).map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input type="number" min={0} value={payForm[key]} onChange={e => setPayForm(prev => ({ ...prev, [key]: e.target.value }))} className="mt-1" />
                </div>
              ))}
            </div>
            {payForm.baseSalary && (
              <div className="rounded bg-slate-50 px-3 py-2 text-sm">
                {hr.salary}：<strong className="text-green-700">${fmt(
                  [payForm.baseSalary, payForm.allowances, payForm.overtimePay, payForm.bonus].reduce((s, v) => s + (Number(v)||0), 0) -
                  [payForm.deductions, payForm.laborInsurance, payForm.healthInsurance, payForm.tax].reduce((s, v) => s + (Number(v)||0), 0)
                )}</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={createPayroll} disabled={savingPay || !payForm.userId || !payForm.baseSalary}>
              {savingPay && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
