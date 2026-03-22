'use client'

import { useEffect, useState } from 'react'
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
import { Plus, Pencil, Trash2, HeartHandshake, AlertCircle, CalendarDays } from 'lucide-react'

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

/* ─── Constants ──────────────────────────────────────────── */
const VISIT_TYPES: Record<string, string> = {
  ROUTINE_VISIT: '定期巡訪', TRAINING: '教育訓練',
  ONBOARDING: '新客戶上線', COMPLAINT_FOLLOW: '客訴跟進',
  PRODUCT_DEMO: '產品示範', OTHER: '其他',
}

const SCHEDULE_STATUSES: Record<string, { label: string; color: string }> = {
  SCHEDULED:   { label: '已排程', color: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: '進行中', color: 'bg-amber-100 text-amber-700' },
  COMPLETED:   { label: '已完成', color: 'bg-green-100 text-green-700' },
  CANCELLED:   { label: '已取消', color: 'bg-slate-100 text-slate-500' },
}

const REQUEST_TYPES: Record<string, string> = {
  SKIN_ISSUE: '皮膚問題', PRODUCT_CHANGE: '產品更換',
  TRAINING: '教育訓練', COMPLAINT: '客訴',
  SUPPLY_ISSUE: '供應問題', NEW_ONBOARD: '新客戶上線', OTHER: '其他',
}

const URGENCIES: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: '緊急', color: 'bg-red-100 text-red-700' },
  HIGH:     { label: '高',   color: 'bg-orange-100 text-orange-700' },
  MEDIUM:   { label: '中',   color: 'bg-yellow-100 text-yellow-700' },
  LOW:      { label: '低',   color: 'bg-slate-100 text-slate-600' },
}

const REQUEST_STATUSES: Record<string, { label: string; color: string }> = {
  OPEN:        { label: '待處理', color: 'bg-red-100 text-red-700' },
  ASSIGNED:    { label: '已指派', color: 'bg-purple-100 text-purple-700' },
  IN_PROGRESS: { label: '處理中', color: 'bg-blue-100 text-blue-700' },
  RESOLVED:    { label: '已解決', color: 'bg-green-100 text-green-700' },
  CLOSED:      { label: '已關閉', color: 'bg-slate-100 text-slate-500' },
}

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
    setCustomers(Array.isArray(c) ? c : [])
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
    if (!confirm('確定取消此排程？')) return
    await fetch(`/api/care/schedules/${id}`, { method: 'DELETE' })
    load()
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
          <h1 className="text-2xl font-bold text-slate-900">照顧督導管理</h1>
          <p className="text-sm text-slate-500 mt-1">督導拜訪排班與客戶服務需求管理</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{upcomingSch}</p>
              <p className="text-sm text-slate-500">待執行排程</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <HeartHandshake className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{openReqs}</p>
              <p className="text-sm text-slate-500">待處理服務需求</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{urgentReqs}</p>
              <p className="text-sm text-slate-500">緊急需求</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="border-b flex gap-0">
        <button className={tabStyle('schedules')} onClick={() => setTab('schedules')}>排班行程</button>
        <button className={tabStyle('requests')}  onClick={() => setTab('requests')}>服務需求</button>
      </div>

      {/* ─── Schedules Tab ─────────────────────────────────── */}
      {tab === 'schedules' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={openNewSch}><Plus className="h-4 w-4 mr-2" />新增排程</Button>
          </div>

          <Dialog open={schOpen} onOpenChange={setSchOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{schEdit ? '編輯排程' : '新增排程'}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>客戶 *</Label>
                  <Select
                    value={schForm.customerId || '_none'}
                    onValueChange={v => setSchForm(f => ({ ...f, customerId: v === '_none' ? '' : (v ?? '') }))}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— 選擇客戶 —</SelectItem>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>[{c.code}] {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>督導人員</Label>
                    <Select
                      value={schForm.supervisorId || '_none'}
                      onValueChange={v => setSchForm(f => ({ ...f, supervisorId: v === '_none' ? '' : (v ?? '') }))}
                    >
                      <SelectTrigger><SelectValue placeholder="選擇督導" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— 選擇 —</SelectItem>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>排程日期 *</Label>
                    <Input type="date" value={schForm.scheduleDate} onChange={e => setSchForm(f => ({ ...f, scheduleDate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>拜訪類型</Label>
                    <Select value={schForm.visitType} onValueChange={v => setSchForm(f => ({ ...f, visitType: v ?? 'ROUTINE_VISIT' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(VISIT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>狀態</Label>
                    <Select value={schForm.status} onValueChange={v => setSchForm(f => ({ ...f, status: v ?? 'SCHEDULED' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SCHEDULE_STATUSES).map(([k, { label }]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>拜訪目的</Label>
                  <Input value={schForm.purpose} onChange={e => setSchForm(f => ({ ...f, purpose: e.target.value }))} placeholder="拜訪目的…" />
                </div>
                {schEdit && (
                  <>
                    <div>
                      <Label>拜訪內容</Label>
                      <Textarea rows={2} value={schForm.content} onChange={e => setSchForm(f => ({ ...f, content: e.target.value }))} placeholder="拜訪內容記錄…" />
                    </div>
                    <div>
                      <Label>結果/回饋</Label>
                      <Textarea rows={2} value={schForm.result} onChange={e => setSchForm(f => ({ ...f, result: e.target.value }))} placeholder="拜訪結果…" />
                    </div>
                    <div>
                      <Label>下次拜訪日期</Label>
                      <Input type="date" value={schForm.nextVisitDate} onChange={e => setSchForm(f => ({ ...f, nextVisitDate: e.target.value }))} />
                    </div>
                  </>
                )}
                <div>
                  <Label>備註</Label>
                  <Textarea rows={2} value={schForm.notes} onChange={e => setSchForm(f => ({ ...f, notes: e.target.value }))} placeholder="備註…" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSchOpen(false)}>取消</Button>
                <Button onClick={saveSch} disabled={saving || !schForm.customerId || !schForm.scheduleDate}>{saving ? '儲存中…' : '儲存'}</Button>
              </div>
            </DialogContent>
          </Dialog>

          {loading ? (
            <div className="text-center py-20 text-slate-400">載入中…</div>
          ) : (
            <div className="grid gap-3">
              {schedules.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                  <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  目前無排程
                </div>
              )}
              {schedules.map(s => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-500">{s.scheduleNo}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${SCHEDULE_STATUSES[s.status]?.color}`}>
                            {SCHEDULE_STATUSES[s.status]?.label}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {VISIT_TYPES[s.visitType] ?? s.visitType}
                          </span>
                          {s.serviceRequests.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                              {s.serviceRequests.length} 件服務需求
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
                          <p className="text-sm text-blue-600 mt-1">下次拜訪：{s.nextVisitDate.substring(0, 10)}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
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
            <Button onClick={openNewReq}><Plus className="h-4 w-4 mr-2" />新增需求</Button>
          </div>

          <Dialog open={reqOpen} onOpenChange={setReqOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{reqEdit ? '編輯服務需求' : '新增服務需求'}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>客戶 *</Label>
                  <Select
                    value={reqForm.customerId || '_none'}
                    onValueChange={v => setReqForm(f => ({ ...f, customerId: v === '_none' ? '' : (v ?? '') }))}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— 選擇客戶 —</SelectItem>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>[{c.code}] {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>需求類型</Label>
                    <Select value={reqForm.requestType} onValueChange={v => setReqForm(f => ({ ...f, requestType: v ?? 'OTHER' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(REQUEST_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>緊急程度</Label>
                    <Select value={reqForm.urgency} onValueChange={v => setReqForm(f => ({ ...f, urgency: v ?? 'MEDIUM' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(URGENCIES).map(([k, { label }]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>狀態</Label>
                    <Select value={reqForm.status} onValueChange={v => setReqForm(f => ({ ...f, status: v ?? 'OPEN' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(REQUEST_STATUSES).map(([k, { label }]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>負責人員</Label>
                    <Select
                      value={reqForm.assignedToId || '_none'}
                      onValueChange={v => setReqForm(f => ({ ...f, assignedToId: v === '_none' ? '' : (v ?? '') }))}
                    >
                      <SelectTrigger><SelectValue placeholder="選擇負責人" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— 未分配 —</SelectItem>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>問題描述 *</Label>
                  <Textarea rows={3} value={reqForm.description} onChange={e => setReqForm(f => ({ ...f, description: e.target.value }))} placeholder="描述客戶服務需求…" />
                </div>
                {reqEdit && (
                  <div>
                    <Label>處理結果</Label>
                    <Textarea rows={2} value={reqForm.resolution} onChange={e => setReqForm(f => ({ ...f, resolution: e.target.value }))} placeholder="記錄處理方式與結果…" />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setReqOpen(false)}>取消</Button>
                <Button onClick={saveReq} disabled={saving || !reqForm.customerId || !reqForm.description}>{saving ? '儲存中…' : '儲存'}</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>客戶</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead>緊急度</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>問題描述</TableHead>
                    <TableHead>負責人</TableHead>
                    <TableHead>建立時間</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16 text-slate-400">
                        <HeartHandshake className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        目前無服務需求
                      </TableCell>
                    </TableRow>
                  )}
                  {requests.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.customer.name}</TableCell>
                      <TableCell className="text-sm text-slate-500">{REQUEST_TYPES[r.requestType] ?? r.requestType}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${URGENCIES[r.urgency]?.color}`}>
                          {URGENCIES[r.urgency]?.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${REQUEST_STATUSES[r.status]?.color}`}>
                          {REQUEST_STATUSES[r.status]?.label}
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
    </div>
  )
}
