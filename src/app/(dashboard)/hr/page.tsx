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

const ROLES: Record<string, string> = {
  SUPER_ADMIN:'超級管理員', GM:'總經理', SALES_MANAGER:'業務主管',
  SALES:'業務', CARE_SUPERVISOR:'護理主管', ECOMMERCE:'電商',
  CS:'客服', WAREHOUSE_MANAGER:'倉管主管', WAREHOUSE:'倉庫',
  PROCUREMENT:'採購', FINANCE:'財務',
}

const APPT_TYPES: Record<string, string> = {
  HIRE: '到職', PROMOTE: '晉升', TRANSFER: '調動', RESIGN: '離職', TERMINATE: '解聘',
}

const ATT_STATUS: Record<string, { label: string; color: string }> = {
  PRESENT: { label: '出勤', color: 'bg-green-100 text-green-700' },
  ABSENT: { label: '缺勤', color: 'bg-red-100 text-red-700' },
  LATE: { label: '遲到', color: 'bg-amber-100 text-amber-700' },
  LEAVE: { label: '請假', color: 'bg-blue-100 text-blue-700' },
  HOLIDAY: { label: '假日', color: 'bg-slate-100 text-slate-600' },
}

function fmt(n: number) { return n.toLocaleString('zh-TW') }

export default function HRPage() {
  const { dict } = useI18n()
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
    if (res.ok) { toast.success('檔案已儲存'); setEmpDetail(null); loadEmployees() }
    else toast.error('儲存失敗')
  }

  async function createAppointment() {
    const res = await fetch('/api/hr/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apptForm),
    })
    if (res.ok) { toast.success('人事任命已建立'); setApptDialog(false); loadAppointments() }
    else toast.error('建立失敗')
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
    if (res.ok) { toast.success('出勤記錄已建立'); setAttDialog(false); loadAttendance() }
    else toast.error('建立失敗')
  }

  async function createPayroll() {
    if (!payForm.userId || !payForm.baseSalary) { toast.error('請填寫必填欄位'); return }
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
    if (res.ok) { toast.success('薪資記錄已建立'); setPayDialog(false); loadPayroll() }
    else { const d = await res.json(); toast.error(d.error ?? '建立失敗') }
  }

  if (!canView) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">需要管理員或財務權限</div>
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.hr.title}</h1>
        <p className="text-sm text-muted-foreground">員工資料、任命、出勤與薪資管理</p>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees" onClick={loadEmployees} className="gap-1.5"><Users className="h-3.5 w-3.5" />{dict.hr.employee}</TabsTrigger>
          <TabsTrigger value="appointments" onClick={loadAppointments} className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" />任命</TabsTrigger>
          <TabsTrigger value="attendance" onClick={loadAttendance} className="gap-1.5"><Clock className="h-3.5 w-3.5" />{dict.hr.attendance}</TabsTrigger>
          <TabsTrigger value="payroll" onClick={loadPayroll} className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />{dict.hr.payroll}</TabsTrigger>
        </TabsList>

        {/* ═══ 員工 ═══ */}
        <TabsContent value="employees" className="mt-4">
          {loadingEmp ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    {[dict.common.name, 'Email', dict.users.role, dict.hr.position, dict.common.phone, dict.hr.joinDate, dict.common.status].map(h => (
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
                        ? <span className="text-green-600 text-xs">{dict.hr.statuses.ACTIVE}</span>
                        : <span className="text-slate-400 text-xs">{dict.hr.statuses.RESIGNED}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ═══ 任命 ═══ */}
        <TabsContent value="appointments" className="mt-4 space-y-3">
          {isAdmin && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setApptDialog(true)}><Plus className="h-4 w-4 mr-1" />新增任命</Button>
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
              {appointments.length === 0 && <div className="text-center py-8 text-muted-foreground">{dict.hr.noResults}</div>}
            </div>
          )}
        </TabsContent>

        {/* ═══ 出勤 ═══ */}
        <TabsContent value="attendance" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="month" value={attMonth} onChange={e => setAttMonth(e.target.value)} className="w-40" />
            <Button variant="outline" size="sm" onClick={loadAttendance}>{dict.common.search}</Button>
            {isAdmin && <Button size="sm" onClick={() => { setAttForm(f => ({ ...f, userId: employees[0]?.id ?? '' })); setAttDialog(true) }}><Plus className="h-4 w-4 mr-1" />新增出勤</Button>}
          </div>
          {loadingAtt ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    {[dict.common.date, dict.common.name, '上班', '下班', dict.common.status, '假別', '加班'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(a => {
                    const st = ATT_STATUS[a.status] ?? { label: a.status, color: '' }
                    return (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{a.date?.slice(0, 10)}</td>
                        <td className="px-3 py-2 font-medium">{a.user.name}</td>
                        <td className="px-3 py-2">{a.clockIn ? new Date(a.clockIn).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="px-3 py-2">{a.clockOut ? new Date(a.clockOut).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className={st.color}>{st.label}</Badge></td>
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

        {/* ═══ 薪資 ═══ */}
        <TabsContent value="payroll" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="number" value={payYear} onChange={e => setPayYear(Number(e.target.value))} className="w-24" min={2020} max={2030} />
            <span>年</span>
            <Input type="number" value={payMonth} onChange={e => setPayMonth(Number(e.target.value))} className="w-20" min={1} max={12} />
            <span>月</span>
            <Button variant="outline" size="sm" onClick={loadPayroll}>{dict.common.search}</Button>
            {isAdmin && <Button size="sm" onClick={() => { setPayForm(f => ({ ...f, userId: employees[0]?.id ?? '' })); setPayDialog(true) }}><Plus className="h-4 w-4 mr-1" />{dict.hr.payroll}</Button>}
          </div>
          {loadingPay ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-slate-50">
                  <tr>
                    {[dict.common.name, '底薪', '津貼', '加班', '獎金', '扣款', '勞保', '健保', '稅', '實發', dict.common.status].map(h => (
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
                <DialogTitle>{empDetail.name} — {dict.hr.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {[
                  { key: 'gender', label: '性別' },
                  { key: 'birthday', label: '生日', type: 'date' },
                  { key: 'emergencyContact', label: '緊急聯絡人' },
                  { key: 'emergencyPhone', label: '緊急聯絡電話' },
                  { key: 'bankName', label: '銀行名稱' },
                  { key: 'bankAccount', label: '銀行帳號' },
                  { key: 'education', label: '學歷' },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-sm">{f.label}</Label>
                    <Input
                      type={f.type ?? 'text'}
                      value={profileForm[f.key] ?? ''}
                      onChange={e => setProfileForm(prev => ({ ...prev, [f.key]: e.target.value }))}
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
          <DialogHeader><DialogTitle>新增人事任命</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{dict.hr.employee}</Label>
              <Select value={apptForm.userId || 'none'} onValueChange={(v: string | null) => setApptForm(f => ({ ...f, userId: (v ?? '') === 'none' ? '' : (v ?? '') }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="選擇員工" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">選擇員工</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>類型</Label>
              <Select value={apptForm.type} onValueChange={(v: string | null) => setApptForm(f => ({ ...f, type: v ?? 'HIRE' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APPT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>生效日</Label>
              <Input type="date" value={apptForm.effectiveDate} onChange={e => setApptForm(f => ({ ...f, effectiveDate: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>新職稱</Label>
              <Input value={apptForm.toTitle} onChange={e => setApptForm(f => ({ ...f, toTitle: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>原因</Label>
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
          <DialogHeader><DialogTitle>新增出勤記錄</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{dict.hr.employee}</Label>
              <Select value={attForm.userId || 'none'} onValueChange={v => setAttForm(f => ({ ...f, userId: v === 'none' ? '' : (v ?? '') }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="選擇員工" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>日期</Label><Input type="date" value={attForm.date} onChange={e => setAttForm(f => ({ ...f, date: e.target.value }))} className="mt-1" /></div>
              <div>
                <Label>狀態</Label>
                <Select value={attForm.status} onValueChange={v => setAttForm(f => ({ ...f, status: v ?? 'PRESENT' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ATT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>上班時間</Label><Input type="time" value={attForm.clockIn} onChange={e => setAttForm(f => ({ ...f, clockIn: e.target.value }))} className="mt-1" /></div>
              <div><Label>下班時間</Label><Input type="time" value={attForm.clockOut} onChange={e => setAttForm(f => ({ ...f, clockOut: e.target.value }))} className="mt-1" /></div>
              <div><Label>加班(時)</Label><Input type="number" min={0} value={attForm.overtime} onChange={e => setAttForm(f => ({ ...f, overtime: e.target.value }))} className="mt-1" /></div>
              <div><Label>假別</Label><Input value={attForm.leaveType} onChange={e => setAttForm(f => ({ ...f, leaveType: e.target.value }))} className="mt-1" placeholder="特休/事假..." /></div>
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
          <DialogHeader><DialogTitle>新增薪資記錄 ({payYear}/{String(payMonth).padStart(2,'0')})</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{dict.hr.employee}</Label>
              <Select value={payForm.userId || 'none'} onValueChange={v => setPayForm(f => ({ ...f, userId: v === 'none' ? '' : (v ?? '') }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="選擇員工" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'baseSalary', label: '底薪 *' },
                { key: 'allowances', label: '津貼' },
                { key: 'overtimePay', label: '加班費' },
                { key: 'bonus', label: '獎金' },
                { key: 'deductions', label: '扣款' },
                { key: 'laborInsurance', label: '勞保' },
                { key: 'healthInsurance', label: '健保' },
                { key: 'tax', label: '所得稅' },
              ].map(f => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input type="number" min={0} value={payForm[f.key as keyof typeof payForm]} onChange={e => setPayForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="mt-1" />
                </div>
              ))}
            </div>
            {payForm.baseSalary && (
              <div className="rounded bg-slate-50 px-3 py-2 text-sm">
                {dict.hr.salary}：<strong className="text-green-700">${fmt(
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
