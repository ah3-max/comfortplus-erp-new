'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle2, Clock, Bell, BellRing, RefreshCw, ChevronLeft,
  ChevronRight, Users, CheckCheck, AlertCircle, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface ReminderLog {
  id: string
  date: string
  reminderType: string
  isSent: boolean
  sentAt: string | null
  isConfirmed: boolean
  confirmedAt: string | null
  note: string | null
  targetUser: { id: string; name: string; role: string; avatar: string | null }
  confirmedBy: { id: string; name: string } | null
}

interface ActiveUser {
  id: string
  name: string
  role: string
  avatar: string | null
}

// Role labels are provided via dict.dailyReminderRoles (see drr in component)

function formatDate(d: Date) {
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function isoToDate(iso: string) {
  const d = new Date(iso)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export default function DailyReminderPage() {
  const { dict } = useI18n()
  const dr = dict.dailyReminder
  const drr = dict.dailyReminderRoles

  const [date, setDate] = useState(() => new Date())
  const [logs, setLogs] = useState<ReminderLog[]>([])
  const [users, setUsers] = useState<ActiveUser[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})
  const [todayTasks, setTodayTasks] = useState<{ id: string; title: string; status: string; assignedTo: { name: string }; customer: { name: string } | null; priority: string }[]>([])
  const [completingTask, setCompletingTask] = useState<string | null>(null)

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const fetchTodayTasks = useCallback(async () => {
    if (dateStr !== new Date().toISOString().slice(0, 10)) return  // only show for today
    try {
      const res = await fetch(`/api/tasks?dateFrom=${dateStr}&dateTo=${dateStr}&status=PENDING,IN_PROGRESS&pageSize=50`)
      if (!res.ok) return
      const d = await res.json()
      setTodayTasks(Array.isArray(d) ? d : (d.data ?? []))
    } catch { /* ignore */ }
  }, [dateStr])

  async function completeTask(taskId: string) {
    setCompletingTask(taskId)
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE', completedAt: new Date().toISOString() }),
      })
      toast.success('任務已完成')
      setTodayTasks(prev => prev.filter(t => t.id !== taskId))
    } catch { toast.error('更新失敗') }
    finally { setCompletingTask(null) }
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/daily-reminder?date=${dateStr}`)
      if (!res.ok) throw new Error('載入失敗')
      const json = await res.json()
      setLogs(json.data ?? [])
      setUsers(json.users ?? [])
    } catch {
      toast.error(drr.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [dateStr])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => { fetchTodayTasks() }, [fetchTodayTasks])

  // 合併 logs + users，users 中沒有 log 的顯示「未建立」
  const logByUserId = new Map(logs.map(l => [l.targetUser.id, l]))
  const rows = users.map(u => ({ user: u, log: logByUserId.get(u.id) ?? null }))

  const total = rows.length
  const sentCount = rows.filter(r => r.log?.isSent).length
  const confirmedCount = rows.filter(r => r.log?.isConfirmed).length
  const pendingCount = total - confirmedCount

  const handleSendAll = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/daily-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      })
      if (!res.ok) throw new Error('發送失敗')
      const json = await res.json()
      toast.success(dr.toastSent.replace('{created}', String(json.created)).replace('{skipped}', String(json.skipped)))
      fetchLogs()
    } catch {
      toast.error(drr.sendFailed)
    } finally {
      setSending(false)
    }
  }

  const handleConfirm = async (logId: string, isConfirmed: boolean) => {
    setConfirmingId(logId)
    try {
      const res = await fetch(`/api/daily-reminder/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isConfirmed, note: noteMap[logId] }),
      })
      if (!res.ok) throw new Error(drr.confirmFailed)
      toast.success(isConfirmed ? dr.toastConfirmed : dr.toastCancelConfirmed)
      fetchLogs()
    } catch {
      toast.error(dr.toastError)
    } finally {
      setConfirmingId(null)
    }
  }

  const shiftDate = (days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d)
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{dr.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dr.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[90px] text-center">{formatDate(date)}</span>
          <Button variant="outline" size="icon" onClick={() => shiftDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">{dr.statTotal}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BellRing className="h-8 w-8 text-blue-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{sentCount}</p>
              <p className="text-xs text-muted-foreground">{dr.statSent}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCheck className="h-8 w-8 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{confirmedCount}</p>
              <p className="text-xs text-muted-foreground">{dr.statConfirmed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-orange-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">{dr.statPending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Tasks Panel (only shown for today) */}
      {dateStr === new Date().toISOString().slice(0, 10) && todayTasks.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-600" />
              今日待辦任務（{todayTasks.length} 件未完成）
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {todayTasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.assignedTo.name}{t.customer ? ` · ${t.customer.name}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className={
                    t.priority === 'URGENT' ? 'bg-red-100 text-red-700 border-red-200' :
                    t.priority === 'HIGH'   ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }>{t.priority === 'URGENT' ? '緊急' : t.priority === 'HIGH' ? '高' : '中'}</Badge>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300"
                    disabled={completingTask === t.id}
                    onClick={() => completeTask(t.id)}>
                    {completingTask === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    完成
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action */}
      <div className="flex justify-end">
        <Button onClick={handleSendAll} disabled={sending || loading} className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          {sending ? dr.sending : dr.sendAll}
        </Button>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{dr.listTitle}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> {dict.common.loading}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{dr.noMembers}</div>
          ) : (
            <ul className="divide-y">
              {rows.map(({ user, log }) => (
                <li key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* User info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{(drr as Record<string, string>)[user.role] ?? user.role}</p>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {log?.isSent ? (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Bell className="h-3 w-3" /> {dr.badgeSent}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {dr.badgeNotSent}
                      </Badge>
                    )}
                    {log?.isConfirmed ? (
                      <Badge className="gap-1 text-xs bg-green-500 hover:bg-green-600">
                        <CheckCircle2 className="h-3 w-3" /> {dr.badgeConfirmed}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs text-orange-500 border-orange-300">
                        <AlertCircle className="h-3 w-3" /> {dr.badgePending}
                      </Badge>
                    )}
                  </div>

                  {/* Note + confirm action */}
                  {log && (
                    <div className="flex flex-col gap-2 w-full sm:w-56">
                      <Textarea
                        placeholder={dr.notePlaceholder}
                        className="text-xs resize-none h-14"
                        value={noteMap[log.id] ?? log.note ?? ''}
                        onChange={e => setNoteMap(m => ({ ...m, [log.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        {log.isConfirmed ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            disabled={confirmingId === log.id}
                            onClick={() => handleConfirm(log.id, false)}
                          >
                            {confirmingId === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : dr.cancelConfirmBtn}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="flex-1 text-xs gap-1"
                            disabled={confirmingId === log.id}
                            onClick={() => handleConfirm(log.id, true)}
                          >
                            {confirmingId === log.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <CheckCircle2 className="h-3 w-3" />}
                            {dr.confirmBtn}
                          </Button>
                        )}
                      </div>
                      {log.confirmedBy && (
                        <p className="text-xs text-muted-foreground">
                          {dr.confirmedBy.replace('{name}', log.confirmedBy.name)}
                          {log.confirmedAt ? ` · ${new Date(log.confirmedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {/* No log yet */}
                  {!log && (
                    <div className="text-xs text-muted-foreground italic sm:w-56">{dr.noLog}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
