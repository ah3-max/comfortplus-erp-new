'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CalEventType = 'visit' | 'call' | 'task' | 'care' | 'schedule' | 'biz'
type UiEventType  = 'MEETING' | 'VISIT' | 'DELIVERY' | 'PRODUCTION' | 'HOLIDAY' | 'OTHER'

interface CalEvent {
  id:          string
  date:        string        // YYYY-MM-DD
  type:        CalEventType
  title:       string
  customer:    string | null
  user:        string
  color:       string
  status?:     string
  priority?:   string
  // Extended — only set for type === 'biz'
  eventType?:  UiEventType
  startTime?:  string        // HH:MM
  endDate?:    string        // YYYY-MM-DD
  endTime?:    string        // HH:MM
  description?: string
  isAllDay?:   boolean
  isEditable?: boolean
}

interface EventFormState {
  title:       string
  eventType:   UiEventType
  startDate:   string
  startTime:   string
  endDate:     string
  endTime:     string
  description: string
  isAllDay:    boolean
  assignee:    string   // 負責人
  departure:   string   // 出發人員
  prep:        string   // 準備事項
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UI_EVENT_TYPE_VALUES: { value: UiEventType; color: string }[] = [
  { value: 'MEETING',    color: '#6366f1' },
  { value: 'VISIT',      color: '#3b82f6' },
  { value: 'DELIVERY',   color: '#f59e0b' },
  { value: 'PRODUCTION', color: '#8b5cf6' },
  { value: 'HOLIDAY',    color: '#ef4444' },
  { value: 'OTHER',      color: '#64748b' },
]

const FILTER_TYPE_KEYS = ['', 'visit', 'call', 'task', 'care', 'schedule', 'biz'] as const
const FILTER_TYPE_COLORS: Record<string, string> = {
  '':       '#64748b',
  visit:    '#3b82f6',
  call:     '#8b5cf6',
  task:     '#10b981',
  care:     '#14b8a6',
  schedule: '#f59e0b',
  biz:      '#6366f1',
}

const EMPTY_FORM: EventFormState = {
  title:       '',
  eventType:   'MEETING',
  startDate:   '',
  startTime:   '09:00',
  endDate:     '',
  endTime:     '10:00',
  description: '',
  isAllDay:    false,
  assignee:    '',
  departure:   '',
  prep:        '',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}

function padTwo(n: number) {
  return String(n).padStart(2, '0')
}

function fmtMonthKey(year: number, month: number) {
  return `${year}-${padTwo(month)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const { dict } = useI18n()
  const today     = new Date()
  const todayStr  = `${today.getFullYear()}-${padTwo(today.getMonth() + 1)}-${padTwo(today.getDate())}`

  // Build derived constants that depend on dict
  const UI_EVENT_TYPES = UI_EVENT_TYPE_VALUES.map(t => ({
    ...t,
    label: dict.calendarPage.eventTypeLabels[t.value],
  }))
  const UI_EVENT_TYPE_MAP = Object.fromEntries(
    UI_EVENT_TYPES.map(t => [t.value, t])
  ) as Record<UiEventType, { value: UiEventType; label: string; color: string }>

  const TYPE_LABELS: Record<CalEventType, string> = {
    visit:    dict.calendarPage.typeLabels.visit,
    call:     dict.calendarPage.typeLabels.call,
    task:     dict.calendarPage.typeLabels.task,
    care:     dict.calendarPage.typeLabels.care,
    schedule: dict.calendarPage.typeLabels.schedule,
    biz:      dict.calendarPage.typeLabels.biz,
  }

  const FILTER_TYPES = FILTER_TYPE_KEYS.map((key, i) => ({
    key,
    label: dict.calendarPage.filterTypes[i] ?? key,
    color: FILTER_TYPE_COLORS[key],
  }))

  const WEEKDAYS = dict.calendarPage.weekdays

  const [year,     setYear]     = useState(today.getFullYear())
  const [month,    setMonth]    = useState(today.getMonth() + 1)
  const [events,   setEvents]   = useState<CalEvent[]>([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('')

  // Dialog state
  const [dialogOpen,   setDialogOpen]   = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null)
  const [form,         setForm]         = useState<EventFormState>(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CalEvent | null>(null)
  const [deleteOpen,   setDeleteOpen]   = useState(false)
  const [deleting,     setDeleting]     = useState(false)

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/calendar?month=${fmtMonthKey(y, m)}`)
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      toast.error(dict.calendarPage.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(year, month) }, [year, month, load])

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const days     = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)

  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [events])

  const selectedEvents = useMemo(() => {
    if (!selected) return []
    const evs = byDate[selected] ?? []
    return typeFilter ? evs.filter(e => e.type === typeFilter) : evs
  }, [selected, byDate, typeFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    FILTER_TYPES.forEach(f => { if (f.key) c[f.key] = 0 })
    events.forEach(e => { c[e.type] = (c[e.type] ?? 0) + 1 })
    return c
  }, [events])

  function dateStr(d: number) {
    return `${year}-${padTwo(month)}-${padTwo(d)}`
  }

  // ---------------------------------------------------------------------------
  // Dialog helpers
  // ---------------------------------------------------------------------------

  function openCreateDialog(defaultDate?: string) {
    const ds = defaultDate ?? todayStr
    setEditingEvent(null)
    setForm({ ...EMPTY_FORM, startDate: ds, endDate: ds })
    setDialogOpen(true)
  }

  function openEditDialog(event: CalEvent) {
    if (!event.isEditable) return
    setEditingEvent(event)
    // Parse structured notes JSON
    let desc = event.description ?? ''
    let assignee = '', departure = '', prep = ''
    try {
      if (desc.startsWith('{')) {
        const parsed = JSON.parse(desc)
        desc      = parsed.desc      ?? ''
        assignee  = parsed.assignee  ?? ''
        departure = parsed.departure ?? ''
        prep      = parsed.prep      ?? ''
      }
    } catch { /* not JSON, use as plain text */ }
    setForm({
      title:       event.title,
      eventType:   (event.eventType as UiEventType) ?? 'OTHER',
      startDate:   event.date,
      startTime:   event.startTime ?? '09:00',
      endDate:     event.endDate   ?? event.date,
      endTime:     event.endTime   ?? '10:00',
      description: desc,
      isAllDay:    event.isAllDay  ?? false,
      assignee,
      departure,
      prep,
    })
    setDialogOpen(true)
  }

  function setField<K extends keyof EventFormState>(key: K, value: EventFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // ---------------------------------------------------------------------------
  // CRUD operations
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!form.title.trim()) { toast.error(dict.calendarPage.titleRequired); return }
    if (!form.startDate)    { toast.error(dict.calendarPage.startDateRequired); return }

    setSaving(true)
    try {
      // Pack extra fields into a structured notes JSON
      const hasExtra = form.assignee || form.departure || form.prep
      const notesValue = hasExtra
        ? JSON.stringify({
            desc:      form.description,
            assignee:  form.assignee,
            departure: form.departure,
            prep:      form.prep,
          })
        : form.description

      const payload = {
        title:       form.title.trim(),
        eventType:   form.eventType,
        startDate:   form.startDate,
        startTime:   form.isAllDay ? '' : form.startTime,
        endDate:     form.endDate || form.startDate,
        endTime:     form.isAllDay ? '' : form.endTime,
        description: notesValue,
        isAllDay:    form.isAllDay,
      }

      if (editingEvent) {
        const res = await fetch(`/api/calendar/${editingEvent.id}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? dict.common.updateFailed)
        }
        toast.success(dict.calendarPage.eventUpdated)
      } else {
        const res = await fetch('/api/calendar', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? dict.common.createFailed)
        }
        toast.success(dict.calendarPage.eventCreated)
      }

      setDialogOpen(false)
      await load(year, month)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : dict.common.operationFailed)
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(event: CalEvent) {
    setDeleteTarget(event)
    setDeleteOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/calendar/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? dict.common.deleteFailed)
      }
      toast.success(dict.calendarPage.eventDeleted)
      setDeleteOpen(false)
      setDeleteTarget(null)
      if (selected) {
        const remaining = (byDate[selected] ?? []).filter(e => e.id !== deleteTarget.id)
        if (remaining.length === 0) setSelected(null)
      }
      await load(year, month)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : dict.common.deleteFailed)
    } finally {
      setDeleting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4 p-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">{dict.calendar.title}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Type filter chips */}
          {FILTER_TYPES.map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                typeFilter === f.key
                  ? 'text-white border-transparent'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
              }`}
              style={typeFilter === f.key ? { backgroundColor: f.color, borderColor: f.color } : {}}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
              {f.label}
              {f.key && <span className="opacity-70">({counts[f.key] ?? 0})</span>}
            </button>
          ))}

          {/* Add event */}
          <Button
            size="sm"
            onClick={() => openCreateDialog()}
            className="ml-1 min-h-[36px] active:scale-[0.97] transition-transform"
          >
            <Plus className="h-4 w-4 mr-1" />
            {dict.businessCalendar.newEvent}
          </Button>
        </div>
      </div>

      {/* ── Month Navigation ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prev} className="min-h-[44px] min-w-[44px]">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold w-36 text-center select-none">
          {year}{dict.calendarPage.yearLabel} {month}{dict.calendarPage.monthLabel}
        </h2>
        <Button variant="outline" size="icon" onClick={next} className="min-h-[44px] min-w-[44px]">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday} className="min-h-[36px]">
          {dict.calendar.today}
        </Button>
        {loading && <span className="text-sm text-slate-400">{dict.common.loading}</span>}
      </div>

      {/* ── Main Layout ──────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        {/* Calendar Grid */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-3">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((d, i) => (
                  <div
                    key={d}
                    className={`text-center text-xs font-medium py-2 ${
                      i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-px bg-slate-100">
                {/* Leading empty cells */}
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-white min-h-[80px]" />
                ))}

                {/* Actual days */}
                {Array.from({ length: days }, (_, i) => i + 1).map(day => {
                  const ds         = dateStr(day)
                  const isToday    = ds === todayStr
                  const isSelected = ds === selected
                  const dayEvs     = (byDate[ds] ?? []).filter(e => !typeFilter || e.type === typeFilter)
                  const dow        = (firstDow + day - 1) % 7

                  return (
                    <div
                      key={day}
                      onClick={() => setSelected(ds === selected ? null : ds)}
                      className={`bg-white min-h-[80px] p-1.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'ring-2 ring-blue-400 ring-inset'
                          : isToday
                          ? 'ring-1 ring-blue-200 ring-inset'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday    ? 'bg-blue-500 text-white'
                          : dow === 0 ? 'text-red-500'
                          : dow === 6 ? 'text-blue-500'
                          : 'text-slate-700'
                        }`}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvs.slice(0, 3).map(e => (
                          <div
                            key={e.id}
                            className="text-xs px-1 py-0.5 rounded truncate text-white leading-tight"
                            style={{ backgroundColor: e.color }}
                            title={`[${TYPE_LABELS[e.type]}] ${e.title} — ${e.user}`}
                          >
                            {e.title}
                          </div>
                        ))}
                        {dayEvs.length > 3 && (
                          <div className="text-xs text-slate-400 px-1">+{dayEvs.length - 3} {dict.calendarPage.moreEventsUnit}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-2 px-1">
            {([
              { color: '#6366f1', label: dict.calendarPage.legendMeeting },
              { color: '#3b82f6', label: dict.calendarPage.legendVisit },
              { color: '#8b5cf6', label: dict.calendarPage.legendCall },
              { color: '#ef4444', label: dict.calendarPage.legendUrgent },
              { color: '#f59e0b', label: dict.calendarPage.legendHigh },
              { color: '#10b981', label: dict.calendarPage.legendNormal },
              { color: '#14b8a6', label: dict.calendarPage.legendCare },
            ] as { color: string; label: string }[]).map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: l.color }} />
                <span className="text-xs text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Side Panel: Selected day events ─────────────────────────── */}
        {selected && (
          <div className="w-72 shrink-0">
            <Card className="sticky top-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">{selected}</h3>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => openCreateDialog(selected)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-0.5" />
                      {dict.calendarPage.addEventShort}
                    </Button>
                    <button
                      onClick={() => setSelected(null)}
                      className="text-slate-400 hover:text-slate-600 text-lg leading-none ml-1 min-h-[28px] min-w-[28px] flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {selectedEvents.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">{dict.calendar.noEvents}</p>
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.map(e => (
                      <div
                        key={e.id}
                        className="border-l-4 pl-3 py-1.5 group relative"
                        style={{ borderColor: e.color }}
                      >
                        {/* Type badge + actions */}
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded text-white shrink-0"
                            style={{ backgroundColor: e.color }}
                          >
                            {e.isEditable && e.eventType
                              ? UI_EVENT_TYPE_MAP[e.eventType]?.label ?? TYPE_LABELS[e.type]
                              : TYPE_LABELS[e.type]}
                          </span>
                          {e.priority && (
                            <span className="text-xs text-slate-400">
                              {e.priority === 'URGENT' ? dict.calendarPage.priorityUrgent
                                : e.priority === 'HIGH'   ? dict.calendarPage.priorityHigh
                                : e.priority === 'MEDIUM' ? dict.calendarPage.priorityMedium
                                : dict.calendarPage.priorityLow}
                            </span>
                          )}
                          {e.status && !e.isEditable && (
                            <span className="text-xs text-slate-400 ml-auto">{e.status}</span>
                          )}

                          {/* Edit / Delete — only for biz events */}
                          {e.isEditable && (
                            <div className="ml-auto flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditDialog(e)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center"
                                title={dict.calendarPage.editEventTitle}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => confirmDelete(e)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center"
                                title={dict.calendarPage.deleteEventTitle}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="text-sm font-medium text-slate-800 leading-snug">{e.title}</p>

                        {e.customer && (
                          <p className="text-xs text-slate-500 mt-0.5">👤 {e.customer}</p>
                        )}

                        {!e.isAllDay && e.startTime && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            🕐 {e.startTime}{e.endTime ? ` – ${e.endTime}` : ''}
                          </p>
                        )}
                        {e.isAllDay && (
                          <Badge variant="secondary" className="text-xs mt-0.5">{dict.calendarPage.allDayBadge}</Badge>
                        )}

                        {e.description && (() => {
                          try {
                            if (e.description!.startsWith('{')) {
                              const parsed = JSON.parse(e.description!)
                              return (
                                <div className="mt-0.5 space-y-0.5">
                                  {parsed.desc      && <p className="text-xs text-slate-500 line-clamp-2">{parsed.desc}</p>}
                                  {parsed.assignee  && <p className="text-xs text-slate-500">👤 負責：{parsed.assignee}</p>}
                                  {parsed.departure && <p className="text-xs text-slate-500">🚗 出發：{parsed.departure}</p>}
                                  {parsed.prep      && <p className="text-xs text-amber-600">📋 準備：{parsed.prep}</p>}
                                </div>
                              )
                            }
                          } catch { /* ignore */ }
                          return <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{e.description}</p>
                        })()}

                        <p className="text-xs text-slate-400 mt-0.5">{e.user}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Create / Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!saving) setDialogOpen(open) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              {editingEvent ? dict.common.edit : dict.businessCalendar.newEvent}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">
                {dict.calendarPage.fieldTitle} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ev-title"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder={dict.calendarPage.fieldTitlePlaceholder}
                className="min-h-[44px]"
              />
            </div>

            {/* Event Type */}
            <div className="space-y-1.5">
              <Label>{dict.calendarPage.fieldEventType}</Label>
              <Select
                value={form.eventType}
                onValueChange={v => setField('eventType', v as UiEventType)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_EVENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* All-day toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.isAllDay}
                onClick={() => setField('isAllDay', !form.isAllDay)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  form.isAllDay ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.isAllDay ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <Label className="cursor-pointer select-none" onClick={() => setField('isAllDay', !form.isAllDay)}>
                {dict.calendarPage.fieldAllDay}
              </Label>
            </div>

            {/* Start date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-start-date">
                  {dict.calendarPage.fieldStartDate}
                </Label>
                <Input
                  id="ev-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={e => setField('startDate', e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              {!form.isAllDay && (
                <div className="space-y-1.5">
                  <Label htmlFor="ev-start-time">{dict.calendarPage.fieldStartTime}</Label>
                  <Input
                    id="ev-start-time"
                    type="time"
                    value={form.startTime}
                    onChange={e => setField('startTime', e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              )}
            </div>

            {/* End date + time (optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-end-date">{dict.calendarPage.fieldEndDate}</Label>
                <Input
                  id="ev-end-date"
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={e => setField('endDate', e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              {!form.isAllDay && (
                <div className="space-y-1.5">
                  <Label htmlFor="ev-end-time">{dict.calendarPage.fieldEndTime}</Label>
                  <Input
                    id="ev-end-time"
                    type="time"
                    value={form.endTime}
                    onChange={e => setField('endTime', e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              )}
            </div>

            {/* Assignee + Departure */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-assignee">負責人／代辦人</Label>
                <Input
                  id="ev-assignee"
                  value={form.assignee}
                  onChange={e => setField('assignee', e.target.value)}
                  placeholder="誰負責這個行程"
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-departure">出發人員</Label>
                <Input
                  id="ev-departure"
                  value={form.departure}
                  onChange={e => setField('departure', e.target.value)}
                  placeholder="誰要出發 / 出差"
                  className="min-h-[44px]"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">{dict.calendarPage.fieldNotes}</Label>
              <Textarea
                id="ev-desc"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder={dict.calendarPage.notesPlaceholder}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Prep Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="ev-prep">準備事項</Label>
              <Textarea
                id="ev-prep"
                value={form.prep}
                onChange={e => setField('prep', e.target.value)}
                placeholder="需要帶什麼、注意什麼、提前準備的事項"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="min-h-[44px]"
            >
              {dict.common.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="min-h-[44px] active:scale-[0.97] transition-transform"
            >
              {saving ? dict.common.saving : editingEvent ? dict.common.updateSuccess : dict.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={open => { if (!deleting) setDeleteOpen(open) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              {dict.common.deleteConfirm}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            {dict.calendarPage.deleteConfirmPrefix}<span className="font-semibold text-slate-800">{deleteTarget?.title}</span>{dict.calendarPage.deleteConfirmSuffix}
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="min-h-[44px]"
            >
              {dict.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="min-h-[44px] active:scale-[0.97] transition-transform"
            >
              {deleting ? dict.common.loading : dict.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
