'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Plus, CheckCircle2, Circle, Clock, AlertTriangle, Pencil, Trash2, ListTodo, CalendarDays, CalendarCheck, Timer } from 'lucide-react'

interface Task {
  id: string
  title: string
  taskType: string
  priority: string
  status: string
  dueDate: string | null
  description: string | null
  notes: string | null
  completedAt: string | null
  createdAt: string
  customer: { id: string; name: string } | null
  assignedTo: { id: string; name: string }
  createdBy: { id: string; name: string }
}

interface User { id: string; name: string }
interface Customer { id: string; name: string; code: string }

const TASK_TYPES: Record<string, string> = {
  VISIT: '客戶拜訪',
  CALL: '電話聯繫',
  FOLLOW_UP: '跟進客戶',
  PROPOSAL: '提案報價',
  DEMO: '產品展示',
  ADMIN: '行政作業',
  OTHER: '其他',
}

const PRIORITIES: Record<string, { label: string; color: string }> = {
  URGENT: { label: '緊急', color: 'bg-red-100 text-red-700 border-red-200' },
  HIGH:   { label: '高',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
  MEDIUM: { label: '中',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  LOW:    { label: '低',   color: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const STATUSES: Record<string, { label: string; icon: React.ReactNode; col: string }> = {
  PENDING:     { label: '待辦',   icon: <Circle className="h-4 w-4 text-slate-400" />,        col: 'bg-slate-50' },
  IN_PROGRESS: { label: '進行中', icon: <Clock className="h-4 w-4 text-blue-500" />,          col: 'bg-blue-50' },
  DONE:        { label: '已完成', icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,  col: 'bg-green-50' },
  CANCELLED:   { label: '已取消', icon: <AlertTriangle className="h-4 w-4 text-slate-400" />, col: 'bg-slate-50' },
}

const KANBAN_COLS = ['PENDING', 'IN_PROGRESS', 'DONE']

const emptyForm = {
  title: '', taskType: 'FOLLOW_UP', priority: 'MEDIUM', status: 'PENDING',
  dueDate: '', description: '', notes: '', customerId: '', assignedToId: '',
}

type QuickTab = 'today' | 'week' | 'overdue' | 'done' | 'all'

export default function TasksPage() {
  const [tasks, setTasks]         = useState<Task[]>([])
  const [users, setUsers]         = useState<User[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<'kanban' | 'list'>('list')
  const [quickTab, setQuickTab]   = useState<QuickTab>('today')
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterMy, setFilterMy] = useState(false)

  const [open, setOpen]     = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm]     = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus)   params.set('status', filterStatus)
    if (filterPriority) params.set('priority', filterPriority)
    if (filterMy)       params.set('my', 'true')
    const [t, u, c] = await Promise.all([
      fetch('/api/tasks?' + params).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
    ])
    setTasks(Array.isArray(t) ? t : [])
    setUsers(Array.isArray(u) ? u : [])
    setCustomers(Array.isArray(c) ? c : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterStatus, filterPriority, filterMy])

  // Quick tab filtering (client-side)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd   = new Date(todayStart.getTime() + 86400_000)
  const weekEnd    = new Date(todayStart.getTime() + 7 * 86400_000)

  function applyQuickTab(allTasks: Task[]): Task[] {
    switch (quickTab) {
      case 'today':
        return allTasks.filter(t =>
          t.status !== 'DONE' && t.status !== 'CANCELLED' &&
          t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < todayEnd
        )
      case 'week':
        return allTasks.filter(t =>
          t.status !== 'DONE' && t.status !== 'CANCELLED' &&
          t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < weekEnd
        )
      case 'overdue':
        return allTasks.filter(t =>
          t.status !== 'DONE' && t.status !== 'CANCELLED' &&
          t.dueDate && new Date(t.dueDate) < todayStart
        )
      case 'done':
        return allTasks.filter(t => t.status === 'DONE' || t.status === 'CANCELLED')
      case 'all':
      default:
        return allTasks
    }
  }

  const visibleTasks = applyQuickTab(tasks)

  const todayCount   = tasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < todayEnd).length
  const weekCount    = tasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < weekEnd).length
  const overdueCount = tasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate) < todayStart).length
  const doneCount    = tasks.filter(t => t.status === 'DONE' || t.status === 'CANCELLED').length

  const QUICK_TABS: { key: QuickTab; label: string; icon: React.ReactNode; count: number; urgentColor?: boolean }[] = [
    { key: 'today',   label: '今日到期',  icon: <CalendarDays className="h-3.5 w-3.5" />,  count: todayCount,   urgentColor: todayCount > 0 },
    { key: 'week',    label: '本週到期',  icon: <Timer className="h-3.5 w-3.5" />,          count: weekCount },
    { key: 'overdue', label: '逾期待辦',  icon: <AlertTriangle className="h-3.5 w-3.5" />,  count: overdueCount, urgentColor: overdueCount > 0 },
    { key: 'done',    label: '已完成',    icon: <CalendarCheck className="h-3.5 w-3.5" />,  count: doneCount },
    { key: 'all',     label: '全部',      icon: <ListTodo className="h-3.5 w-3.5" />,        count: tasks.length },
  ]

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm })
    setOpen(true)
  }

  function openEdit(t: Task) {
    setEditing(t)
    setForm({
      title:       t.title,
      taskType:    t.taskType,
      priority:    t.priority,
      status:      t.status,
      dueDate:     t.dueDate ? t.dueDate.substring(0, 10) : '',
      description: t.description ?? '',
      notes:       t.notes ?? '',
      customerId:  t.customer?.id ?? '',
      assignedToId: t.assignedTo.id,
    })
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    const body = {
      ...form,
      dueDate:     form.dueDate || null,
      customerId:  form.customerId || null,
      assignedToId: form.assignedToId || null,
      notes:       form.notes || null,
    }
    const url    = editing ? `/api/tasks/${editing.id}` : '/api/tasks'
    const method = editing ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    setOpen(false)
    load()
  }

  async function deleteTask(id: string) {
    if (!confirm('確定刪除此工作？')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    load()
  }

  async function quickStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  const tasksByStatus = (status: string) => visibleTasks.filter(t => t.status === status)

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">任務中心</h1>
          <p className="text-sm text-slate-500 mt-1">管理業務任務與跟進事項</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={view === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setView('kanban')}>看板</Button>
          <Button variant={view === 'list'   ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>清單</Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />新增工作</Button>
        </div>
      </div>

      {/* Quick Tabs */}
      <div className="flex gap-1 border-b">
        {QUICK_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setQuickTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              quickTab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              t.urgentColor ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '編輯工作' : '新增工作'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>標題 *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="工作標題" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>工作類型</Label>
                <Select value={form.taskType} onValueChange={v => setForm(f => ({ ...f, taskType: v ?? 'FOLLOW_UP' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>優先級</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v ?? 'MEDIUM' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITIES).map(([k, { label }]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>狀態</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? 'PENDING' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUSES).map(([k, { label }]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>截止日期</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>關聯客戶</Label>
              <Select
                value={form.customerId || '_none'}
                onValueChange={v => setForm(f => ({ ...f, customerId: v === '_none' ? '' : (v ?? '') }))}
              >
                <SelectTrigger><SelectValue placeholder="選擇客戶（可不填）" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— 無 —</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>[{c.code}] {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>負責人</Label>
              <Select
                value={form.assignedToId || '_none'}
                onValueChange={v => setForm(f => ({ ...f, assignedToId: v === '_none' ? '' : (v ?? '') }))}
              >
                <SelectTrigger><SelectValue placeholder="選擇負責人" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— 選擇 —</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>工作說明</Label>
              <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="描述工作內容…" />
            </div>
            <div>
              <Label>備註</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="備註…" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save} disabled={saving || !form.title}>{saving ? '儲存中…' : '儲存'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterPriority || '_all'} onValueChange={v => setFilterPriority(v === '_all' ? '' : (v ?? ''))}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部優先級" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">全部優先級</SelectItem>
            {Object.entries(PRIORITIES).map(([k, { label }]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={filterMy ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterMy(v => !v)}
        >
          我的工作
        </Button>
        <span className="text-sm text-slate-500 ml-auto">{visibleTasks.length} 筆</span>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">載入中…</div>
      ) : view === 'kanban' ? (
        /* Kanban View */
        <div className="grid grid-cols-3 gap-4">
          {KANBAN_COLS.map(col => {
            const colTasks = tasksByStatus(col)
            const { label, icon, col: colBg } = STATUSES[col]
            return (
              <div key={col} className={`rounded-xl border ${colBg} p-3 min-h-[400px]`}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  {icon}
                  <span className="font-semibold text-sm text-slate-700">{label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{colTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colTasks.map(task => (
                    <div key={task.id} className="bg-white rounded-lg border shadow-sm p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 leading-snug">{task.title}</p>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEdit(task)} className="text-slate-400 hover:text-slate-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteTask(task.id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${PRIORITIES[task.priority]?.color}`}>
                          {PRIORITIES[task.priority]?.label}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
                          {TASK_TYPES[task.taskType] ?? task.taskType}
                        </span>
                      </div>
                      {task.customer && (
                        <p className="text-xs text-slate-500">👤 {task.customer.name}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">{task.assignedTo.name}</p>
                        {task.dueDate && (
                          <p className="text-xs text-slate-400">{task.dueDate.substring(0, 10)}</p>
                        )}
                      </div>
                      {/* Quick status buttons */}
                      <div className="flex gap-1 pt-1 border-t">
                        {col === 'PENDING' && (
                          <button onClick={() => quickStatus(task.id, 'IN_PROGRESS')} className="text-xs text-blue-600 hover:underline">→ 進行中</button>
                        )}
                        {col === 'IN_PROGRESS' && (
                          <button onClick={() => quickStatus(task.id, 'DONE')} className="text-xs text-green-600 hover:underline">→ 完成</button>
                        )}
                        {col !== 'DONE' && (
                          <button onClick={() => quickStatus(task.id, 'CANCELLED')} className="text-xs text-slate-400 hover:underline ml-auto">取消</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <p className="text-center text-sm text-slate-400 py-8">無工作</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>標題</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>優先級</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>客戶</TableHead>
                  <TableHead>負責人</TableHead>
                  <TableHead>截止日</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-slate-400">
                      <ListTodo className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      {quickTab === 'today' ? '今天沒有到期工作' :
                       quickTab === 'overdue' ? '沒有逾期待辦' : '沒有工作項目'}
                    </TableCell>
                  </TableRow>
                )}
                {visibleTasks.map(task => {
                  const isOverdue = task.dueDate
                    && new Date(task.dueDate) < todayStart
                    && task.status !== 'DONE' && task.status !== 'CANCELLED'
                  return (
                  <TableRow key={task.id} className={isOverdue ? 'bg-red-50/40' : ''}>
                    <TableCell>
                      <div className="font-medium text-sm">{task.title}</div>
                      {task.description && <div className="text-xs text-slate-400 truncate max-w-xs">{task.description}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{TASK_TYPES[task.taskType] ?? task.taskType}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITIES[task.priority]?.color}`}>
                        {PRIORITIES[task.priority]?.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {STATUSES[task.status]?.icon}
                        <span className="text-sm">{STATUSES[task.status]?.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{task.customer?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{task.assignedTo.name}</TableCell>
                    <TableCell className="text-sm">
                      {task.dueDate ? (
                        <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                          {task.dueDate.substring(0, 10)}
                          {isOverdue && ' ⚠️'}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {task.status === 'PENDING' && (
                          <button onClick={() => quickStatus(task.id, 'IN_PROGRESS')} className="text-xs text-blue-500 hover:underline mr-1">開始</button>
                        )}
                        {task.status === 'IN_PROGRESS' && (
                          <button onClick={() => quickStatus(task.id, 'DONE')} className="text-xs text-green-600 hover:underline mr-1">完成</button>
                        )}
                        <button onClick={() => openEdit(task)} className="text-slate-400 hover:text-slate-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteTask(task.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
