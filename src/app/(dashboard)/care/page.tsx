'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, HeartHandshake, AlertCircle, CalendarDays, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

/* ─── Types ─────────────────────────────────────────────── */
interface CareSchedule {
  id: string; scheduleNo: string; scheduleDate: string
  visitType: string; status: string; purpose: string | null
  content: string | null; result: string | null; notes: string | null
  nextVisitDate: string | null
  supervisor: { id: string; name: string }
  customer: { id: string; name: string; code: string; address: string | null; phone: string | null; contactPerson: string | null }
  serviceRequests: { id: string; requestType: string; urgency: string; status: string }[]
}

interface ServiceRequest {
  id: string; requestType: string; urgency: string; status: string
  description: string; resolution: string | null; createdAt: string
  resolvedAt: string | null
  customer: { id: string; name: string }
  assignedTo: { id: string; name: string } | null
  careSchedule: { id: string; scheduleNo: string; scheduleDate: string } | null
}

interface User     { id: string; name: string }
interface Customer { id: string; name: string; code: string }


const emptySch = {
  customerId: '', supervisorId: '', scheduleDate: '',
  visitType: 'ROUTINE_VISIT', purpose: '', notes: '',
  status: 'SCHEDULED', content: '', result: '', nextVisitDate: '',
}

const emptyReq = {
  customerId: '', requestType: 'OTHER', urgency: 'MEDIUM',
  description: '', status: 'OPEN', resolution: '', assignedToId: '',
}

/* ─── Component ──────────────────────────────────────────── */
export default function CarePage() {
  const { dict } = useI18n()
  const ca = dict.care
  type SchSt = keyof typeof ca.scheduleStatuses
  type ReqSt = keyof typeof ca.requestStatuses
  type UrgSt = keyof typeof ca.urgencies
  type VisTy = keyof typeof ca.visitTypes
  type ReqTy = keyof typeof ca.requestTypes
  const [schedules, setSchedules]   = useState<CareSchedule[]>([])
  const [requests, setRequests]     = useState<ServiceRequest[]>([])
  const [users, setUsers]           = useState<User[]>([])
  const [customers, setCustomers]   = useState<Customer[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'schedules' | 'requests'>('schedules')

  // schedule dialog
  const [schOpen, setSchOpen] = useState(false)
  const [schEdit, setSchEdit] = useState<CareSchedule | null>(null)
  const [schForm, setSchForm] = useState({ ...emptySch })

  // service request dialog
  const [reqOpen, setReqOpen] = useState(false)
  const [reqEdit, setReqEdit] = useState<ServiceRequest | null>(null)
  const [reqForm, setReqForm] = useState({ ...emptyReq })

  // quick complete schedule
  const [completeTarget, setCompleteTarget] = useState<CareSchedule | null>(null)
  const [completeForm, setCompleteForm] = useState({ content: '', result: '', nextVisitDate: '' })
  const [completing, setCompleting] = useState(false)

  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [sch, req, u, c] = await Promise.all([
      fetch('/api/care/schedules').then(r => r.json()),
      fetch('/api/care/service-requests').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
    ])
    setSchedules(Array.isArray(sch) ? sch : [])
    setRequests(Array.isArray(req) ? req : [])
    setUsers(Array.isArray(u) ? u : [])
    setCustomers(Array.isArray(c) ? c : (c.data ?? []))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  /* Schedule CRUD */
  function openNewSch() {
    setSchEdit(null)
    setSchForm({ ...emptySch })
    setSchOpen(true)
  }
  function openEditSch(s: CareSchedule) {
    setSchEdit(s)
    setSchForm({
      customerId:   s.customer.id,
      supervisorId: s.supervisor.id,
      scheduleDate: s.scheduleDate.substring(0, 10),
      visitType:    s.visitType,
      purpose:      s.purpose ?? '',
      notes:        s.notes ?? '',
      status:       s.status,
      content:      s.content ?? '',
      result:       s.result ?? '',
      nextVisitDate: s.nextVisitDate ? s.nextVisitDate.substring(0, 10) : '',
    })
    setSchOpen(true)
  }
  async function saveSch() {
    setSaving(true)
    const body = {
      ...schForm,
      nextVisitDate: schForm.nextVisitDate || null,
      purpose:       schForm.purpose || null,
      notes:         schForm.notes || null,
      content:       schForm.content || null,
      result:        schForm.result || null,
    }
    const url    = schEdit ? `/api/care/schedules/${schEdit.id}` : '/api/care/schedules'
    const method = schEdit ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false); setSchOpen(false); load()
  }
  async function cancelSch(id: string) {
    if (!confirm(ca.cancelConfirm)) return
    await fetch(`/api/care/schedules/${id}`, { method: 'DELETE' })
    load()
  }


  function openCompleteSch(s: CareSchedule) {
    setCompleteTarget(s)
    setCompleteForm({ content: s.content ?? '', result: s.result ?? '', nextVisitDate: '' })
  }

  async function saveCompleteSch() {
    if (!completeTarget) return
    setCompleting(true)
    const res = await fetch(`/api/care/schedules/${completeTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'COMPLETED',
        content: completeForm.content || null,
        result: completeForm.result || null,
        nextVisitDate: completeForm.nextVisitDate || null,
      }),
    })
    setCompleting(false)
    if (res.ok) {
      toast.success(dict.common.saveSuccess)
      setCompleteTarget(null)
      load()
    } else {
      toast.error(dict.common.error)
    }
  }

  /* Service Request CRUD */
  function openNewReq() {
    setReqEdit(null)
    setReqForm({ ...emptyReq })
    setReqOpen(true)
  }
  function openEditReq(r: ServiceRequest) {
    setReqEdit(r)
    setReqForm({
      customerId:   r.customer.id,
      requestType:  r.requestType,
      urgency:      r.urgency,
      description:  r.description,
      status:       r.status,
      resolution:   r.resolution ?? '',
      assignedToId: r.assignedTo?.id ?? '',
    })
    setReqOpen(true)
  }
  async function saveReq() {
    setSaving(true)
    const body = {
      ...reqForm,
      assignedToId: reqForm.assignedToId || null,
      resolution:   reqForm.resolution || null,
    }
    const url    = reqEdit ? `/api/care/service-requests/${reqEdit.id}` : '/api/care/service-requests'
    const method = reqEdit ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false); setReqOpen(false); load()
  }

  /* Stats */
  const openReqs    = requests.filter(r => r.status === 'OPEN').length
  const urgentReqs  = requests.filter(r => r.urgency === 'CRITICAL' && r.status === 'OPEN').length
  const upcomingSch = schedules.filter(s => s.status === 'SCHEDULED').length

  const tabStyle = (t: string) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
      tab === t
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.care.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{dict.care.subtitle}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{upcomingSch}</p>
              <p className="text-sm text-slate-500">{dict.care.pendingSchedules}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <HeartHandshake className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{openReqs}</p>
              <p className="text-sm text-slate-500">{dict.care.openRequests}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{urgentReqs}</p>
              <p className="text-sm text-slate-500">{dict.care.urgentRequests}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="border-b flex gap-0">
        <button className={tabStyle('schedules')} onClick={() => setTab('schedules')}>{dict.care.schedules}</button>
        <button className={tabStyle('requests')}  onClick={() => setTab('requests')}>{dict.care.requests}</button>
      </div>

      {/* ─── Schedules Tab ─────────────────────────────────── */}
      {tab === 'schedules' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={openNewSch}><Plus className="h-4 w-4 mr-2" />{dict.care.newSchedule}</Button>
          </div>

          <Dialog open={schOpen} onOpenChange={setSchOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{schEdit ? dict.common.edit + dict.care.schedules : dict.care.newSchedule}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>{dict.common.customer} *</Label>
                  <Select
                    value={schForm.customerId || '_none'}
                    onValueChange={v => setSchForm(f => ({ ...f, customerId: v === '_none' ? '' : (v ?? '') }))}
                  >
                    <SelectTrigger><SelectValue placeholder={dict.common.select + dict.common.customer} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— {dict.common.select + dict.common.customer} —</SelectItem>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>[{c.code}] {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{ca.supervisorLabel}</Label>
                    <Select
                      value={schForm.supervisorId || '_none'}
                      onValueChange={v => setSchForm(f => ({ ...f, supervisorId: v === '_none' ? '' : (v ?? '') }))}
                    >
                      <SelectTrigger><SelectValue placeholder={dict.common.select} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— {dict.common.select} —</SelectItem>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{ca.scheduleDateLabel} *</Label>
                    <Input type="date" value={schForm.scheduleDate} onChange={e => setSchForm(f => ({ ...f, scheduleDate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{ca.visitTypeLabel}</Label>
                    <Select value={schForm.visitType} onValueChange={v => setSchForm(f => ({ ...f, visitType: v ?? 'ROUTINE_VISIT' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ca.visitTypes).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{dict.common.status}</Label>
                    <Select value={schForm.status} onValueChange={v => setSchForm(f => ({ ...f, status: v ?? 'SCHEDULED' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ca.scheduleStatuses).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{ca.purposeLabel}</Label>
                  <Input value={schForm.purpose} onChange={e => setSchForm(f => ({ ...f, purpose: e.target.value }))} />
                </div>
                {schEdit && (
                  <>
                    <div>
                      <Label>{ca.contentLabel}</Label>
                      <Textarea rows={2} value={schForm.content} onChange={e => setSchForm(f => ({ ...f, content: e.target.value }))} />
                    </div>
                    <div>
                      <Label>{ca.resultLabel}</Label>
                      <Textarea rows={2} value={schForm.result} onChange={e => setSchForm(f => ({ ...f, result: e.target.value }))} />
                    </div>
                    <div>
                      <Label>{ca.nextVisitDateLabel}</Label>
                      <Input type="date" value={schForm.nextVisitDate} onChange={e => setSchForm(f => ({ ...f, nextVisitDate: e.target.value }))} />
                    </div>
                  </>
                )}
                <div>
                  <Label>{dict.common.notes}</Label>
                  <Textarea rows={2} value={schForm.notes} onChange={e => setSchForm(f => ({ ...f, notes: e.target.value }))} placeholder="備註…" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSchOpen(false)}>{dict.common.cancel}</Button>
                <Button onClick={saveSch} disabled={saving || !schForm.customerId || !schForm.scheduleDate}>{saving ? dict.common.saving : dict.common.save}</Button>
              </div>
            </DialogContent>
          </Dialog>

          {loading ? (
            <div className="text-center py-20 text-slate-400">{dict.common.loading}</div>
          ) : (
            <div className="grid gap-3">
              {schedules.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                  <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  {dict.common.noData}
                </div>
              )}
              {schedules.map(s => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-500">{s.scheduleNo}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ca.scheduleStatusColors[s.status as SchSt] ?? ''}`}>
                            {ca.scheduleStatuses[s.status as SchSt] ?? s.status}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {ca.visitTypes[s.visitType as VisTy] ?? s.visitType}
                          </span>
                          {s.serviceRequests.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                              {s.serviceRequests.length} {ca.serviceRequestCount}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800">{s.customer.name}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                          <span>📅 {s.scheduleDate.substring(0, 10)}</span>
                          <span>👤 {s.supervisor.name}</span>
                          {s.customer.address && <span>📍 {s.customer.address}</span>}
                        </div>
                        {s.purpose && <p className="text-sm text-slate-600 mt-1">{s.purpose}</p>}
                        {s.result  && <p className="text-sm text-green-700 mt-1 bg-green-50 rounded p-2">✓ {s.result}</p>}
                        {s.nextVisitDate && (
                          <p className="text-sm text-blue-600 mt-1">{ca.nextVisitPrefix}：{s.nextVisitDate.substring(0, 10)}</p>
                        )}

                      </div>
                      <div className="flex gap-2 shrink-0">
                        {(s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS') && (
                          <Button size="sm" variant="outline" onClick={() => openCompleteSch(s)} className="text-green-600 border-green-200 hover:bg-green-50 gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />{dict.common.complete}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEditSch(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {s.status === 'SCHEDULED' && (
                          <Button size="sm" variant="outline" onClick={() => cancelSch(s.id)} className="text-red-500 border-red-200 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Service Requests Tab ─────────────────────────── */}
      {tab === 'requests' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={openNewReq}><Plus className="h-4 w-4 mr-2" />{dict.care.newRequest}</Button>
          </div>

          <Dialog open={reqOpen} onOpenChange={setReqOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{reqEdit ? dict.common.edit + dict.care.requests : dict.care.newRequest}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>{dict.common.customer} *</Label>
                  <Select
                    value={reqForm.customerId || '_none'}
                    onValueChange={v => setReqForm(f => ({ ...f, customerId: v === '_none' ? '' : (v ?? '') }))}
                  >
                    <SelectTrigger><SelectValue placeholder={dict.common.select + dict.common.customer} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— {dict.common.select + dict.common.customer} —</SelectItem>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>[{c.code}] {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{ca.requestTypeLabel}</Label>
                    <Select value={reqForm.requestType} onValueChange={v => setReqForm(f => ({ ...f, requestType: v ?? 'OTHER' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ca.requestTypes).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{ca.urgencyLabel}</Label>
                    <Select value={reqForm.urgency} onValueChange={v => setReqForm(f => ({ ...f, urgency: v ?? 'MEDIUM' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ca.urgencies).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{dict.common.status}</Label>
                    <Select value={reqForm.status} onValueChange={v => setReqForm(f => ({ ...f, status: v ?? 'OPEN' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ca.requestStatuses).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{dict.tasksExt.assignedTo}</Label>
                    <Select
                      value={reqForm.assignedToId || '_none'}
                      onValueChange={v => setReqForm(f => ({ ...f, assignedToId: v === '_none' ? '' : (v ?? '') }))}
                    >
                      <SelectTrigger><SelectValue placeholder={dict.common.select} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— {dict.common.unassigned} —</SelectItem>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{dict.common.description} *</Label>
                  <Textarea rows={3} value={reqForm.description} onChange={e => setReqForm(f => ({ ...f, description: e.target.value }))} placeholder="描述客戶服務需求…" />
                </div>
                {reqEdit && (
                  <div>
                    <Label>{ca.resolutionLabel}</Label>
                    <Textarea rows={2} value={reqForm.resolution} onChange={e => setReqForm(f => ({ ...f, resolution: e.target.value }))} />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setReqOpen(false)}>{dict.common.cancel}</Button>
                <Button onClick={saveReq} disabled={saving || !reqForm.customerId || !reqForm.description}>{saving ? dict.common.saving : dict.common.save}</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.common.customer}</TableHead>
                    <TableHead>{dict.common.type}</TableHead>
                    <TableHead>{ca.urgencyHeader}</TableHead>
                    <TableHead>{dict.common.status}</TableHead>
                    <TableHead>{dict.common.description}</TableHead>
                    <TableHead>{dict.tasksExt.assignedTo}</TableHead>
                    <TableHead>{dict.common.createdAt}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16 text-slate-400">
                        <HeartHandshake className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        {dict.common.noData}
                      </TableCell>
                    </TableRow>
                  )}
                  {requests.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.customer.name}</TableCell>
                      <TableCell className="text-sm text-slate-500">{ca.requestTypes[r.requestType as ReqTy] ?? r.requestType}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ca.urgencyColors[r.urgency as UrgSt] ?? ''}`}>
                          {ca.urgencies[r.urgency as UrgSt] ?? r.urgency}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ca.requestStatusColors[r.status as ReqSt] ?? ''}`}>
                          {ca.requestStatuses[r.status as ReqSt] ?? r.status}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{r.description}</TableCell>
                      <TableCell className="text-sm">{r.assignedTo?.name ?? '—'}</TableCell>
                      <TableCell className="text-sm text-slate-500">{r.createdAt.substring(0, 10)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => openEditReq(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Complete Schedule Dialog */}
      <Dialog open={!!completeTarget} onOpenChange={o => !o && setCompleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dict.common.complete} — {completeTarget?.customer.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>{ca.contentLabel}</Label>
              <Textarea
                rows={2}
                value={completeForm.content}
                onChange={e => setCompleteForm(f => ({ ...f, content: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{ca.resultLabel} *</Label>
              <Textarea
                rows={2}
                value={completeForm.result}
                onChange={e => setCompleteForm(f => ({ ...f, result: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{ca.nextVisitDateLabel}</Label>
              <Input
                type="date"
                value={completeForm.nextVisitDate}
                onChange={e => setCompleteForm(f => ({ ...f, nextVisitDate: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCompleteTarget(null)} disabled={completing}>{dict.common.cancel}</Button>
            <Button onClick={saveCompleteSch} disabled={completing || !completeForm.result}>
              {completing ? dict.common.saving : dict.common.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
