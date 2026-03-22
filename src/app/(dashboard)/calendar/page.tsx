'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalEvent {
  id: string
  date: string           // YYYY-MM-DD
  type: 'visit' | 'call' | 'task' | 'care' | 'schedule'
  title: string
  customer: string | null
  user: string
  color: string
  status?: string
  priority?: string
}

const TYPE_LABELS: Record<string, string> = {
  visit:    '拜訪',
  call:     '電訪',
  task:     '工作',
  care:     '督導',
  schedule: '行程',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}

export default function CalendarPage() {
  const today    = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)   // selected date YYYY-MM-DD
  const [typeFilter, setTypeFilter] = useState<string>('')

  async function load(y: number, m: number) {
    setLoading(true)
    const res = await fetch(`/api/calendar?year=${y}&month=${m}`)
    const data = await res.json()
    setEvents(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load(year, month) }, [year, month])

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth() + 1) }

  const days       = getDaysInMonth(year, month)
  const firstDow   = getFirstDayOfWeek(year, month)
  const todayStr   = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // events grouped by date
  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [events])

  // selected day events (with type filter)
  const selectedEvents = useMemo(() => {
    if (!selected) return []
    const evs = byDate[selected] ?? []
    return typeFilter ? evs.filter(e => e.type === typeFilter) : evs
  }, [selected, byDate, typeFilter])

  // total counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { visit: 0, call: 0, task: 0, care: 0, schedule: 0 }
    events.forEach(e => { c[e.type] = (c[e.type] ?? 0) + 1 })
    return c
  }, [events])

  function dateStr(d: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const FILTER_TYPES = [
    { key: '', label: '全部', color: '#64748b' },
    { key: 'visit',    label: '拜訪', color: '#3b82f6' },
    { key: 'call',     label: '電訪', color: '#8b5cf6' },
    { key: 'task',     label: '工作', color: '#10b981' },
    { key: 'care',     label: '督導', color: '#14b8a6' },
    { key: 'schedule', label: '行程', color: '#f59e0b' },
  ]

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">業務行事曆</h1>
        <div className="flex items-center gap-2">
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
              {f.key && <span className="opacity-70">({counts[f.key as keyof typeof counts]})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="text-xl font-semibold w-32 text-center">{year} 年 {month} 月</h2>
        <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={goToday}>今天</Button>
        {loading && <span className="text-sm text-slate-400 ml-2">載入中…</span>}
      </div>

      <div className="flex gap-4">
        {/* Calendar Grid */}
        <div className="flex-1">
          <Card>
            <CardContent className="p-3">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((d, i) => (
                  <div key={d} className={`text-center text-xs font-medium py-2 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
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
                {/* Day cells */}
                {Array.from({ length: days }, (_, i) => i + 1).map(day => {
                  const ds    = dateStr(day)
                  const isToday   = ds === todayStr
                  const isSelected = ds === selected
                  const dayEvs = (byDate[ds] ?? []).filter(e => !typeFilter || e.type === typeFilter)
                  const dow = (firstDow + day - 1) % 7

                  return (
                    <div
                      key={day}
                      onClick={() => setSelected(ds === selected ? null : ds)}
                      className={`bg-white min-h-[80px] p-1.5 cursor-pointer transition-colors ${
                        isSelected ? 'ring-2 ring-blue-400 ring-inset' :
                        isToday    ? 'ring-1 ring-blue-200 ring-inset' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-blue-500 text-white' :
                        dow === 0 ? 'text-red-500' :
                        dow === 6 ? 'text-blue-500' : 'text-slate-700'
                      }`}>
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
                          <div className="text-xs text-slate-400 px-1">+{dayEvs.length - 3} 件</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 px-1">
            {[
              { color: '#3b82f6', label: '客戶拜訪' },
              { color: '#8b5cf6', label: '電訪' },
              { color: '#ef4444', label: '緊急工作' },
              { color: '#f59e0b', label: '高優先工作' },
              { color: '#10b981', label: '一般工作' },
              { color: '#14b8a6', label: '督導排程' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
                <span className="text-xs text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel: selected day events */}
        {selected && (
          <div className="w-72 shrink-0">
            <Card className="sticky top-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">{selected}</h3>
                  <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                </div>
                {selectedEvents.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">無事件</p>
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.map(e => (
                      <div key={e.id} className="border-l-4 pl-3 py-1.5" style={{ borderColor: e.color }}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: e.color }}
                          >
                            {TYPE_LABELS[e.type]}
                          </span>
                          {e.priority && (
                            <span className="text-xs text-slate-400">{
                              e.priority === 'URGENT' ? '緊急' :
                              e.priority === 'HIGH'   ? '高'   :
                              e.priority === 'MEDIUM' ? '中'   : '低'
                            }</span>
                          )}
                          {e.status && (
                            <span className="text-xs text-slate-400 ml-auto">{e.status}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-800 leading-snug">{e.title}</p>
                        {e.customer && (
                          <p className="text-xs text-slate-500 mt-0.5">👤 {e.customer}</p>
                        )}
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
    </div>
  )
}
