'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, Search, CalendarDays, Users, MapPin, Clock, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'

interface MeetingRecord {
  id: string
  meetingNo: string
  title: string
  meetingType: string
  status: string
  meetingDate: string
  location: string | null
  isOnline: boolean
  summary: string | null
  facilitator: { id: string; name: string } | null
  customer: { id: string; name: string } | null
  _count: { actionItems: number }
}

interface Customer { id: string; name: string }
interface User { id: string; name: string }

const TYPE_LABEL: Record<string, string> = {
  WEEKLY_ADMIN: '週行政會議', CHANNEL_NEGOTIATION: '通路談判',
  ASSOCIATION_MEETING: '公會會議', EXHIBITION_DEBRIEF: '展後檢討',
  PROMO_PLANNING: '檔期規劃', SUPPLIER_MEETING: '供應商會議',
  INTERNAL: '內部會議', OTHER: '其他',
}
const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: '已排定', IN_PROGRESS: '進行中', COMPLETED: '已完成', CANCELLED: '已取消',
}

const MEETING_TYPES = Object.entries(TYPE_LABEL)

export default function MeetingRecordsPage() {
  const { dict } = useI18n()
  const [records, setRecords] = useState<MeetingRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('__all__')
  const [statusFilter, setStatusFilter] = useState('__all__')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<MeetingRecord | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])

  // Form state
  const [form, setForm] = useState({
    title: '', meetingType: 'INTERNAL', status: 'SCHEDULED',
    meetingDate: new Date().toISOString().slice(0, 10),
    location: '', isOnline: false, customerId: '',
    agenda: '', summary: '', decisions: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (typeFilter !== '__all__') params.set('meetingType', typeFilter)
      if (statusFilter !== '__all__') params.set('status', statusFilter)
      const res = await fetch(`/api/meeting-records?${params}`)
      if (!res.ok) throw new Error()
      setRecords(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [search, typeFilter, statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/customers?pageSize=200').then(r => r.json()).then(d => setCustomers(d.data ?? []))
    fetch('/api/users?pageSize=100').then(r => r.json()).then(d => setUsers(d.data ?? []))
  }, [])

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/meeting-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, meetingDate: form.meetingDate }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? dict.common.createFailed)
      toast.success(dict.meetingRecords.created)
      setShowCreate(false)
      setForm({ title: '', meetingType: 'INTERNAL', status: 'SCHEDULED', meetingDate: new Date().toISOString().slice(0, 10), location: '', isOnline: false, customerId: '', agenda: '', summary: '', decisions: '' })
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : dict.common.createFailed) }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.meetingRecords ?? '會議 / 拜訪記錄'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">業務拜訪、通路談判、內部會議紀錄管理</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus size={16} />新增記錄
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-white border rounded-xl p-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋標題、摘要…" className="pl-8 h-9" />
        </div>
        <Select value={typeFilter} onValueChange={v => { if (v) setTypeFilter(v) }}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部類型</SelectItem>
            {MEETING_TYPES.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { if (v) setStatusFilter(v) }}>
          <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部狀態</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-12 text-center text-gray-400">載入中…</div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
            <p>尚無會議記錄</p>
          </div>
        ) : records.map(rec => (
          <div key={rec.id}
            className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer"
            onClick={() => setSelected(rec)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-gray-400">{rec.meetingNo}</span>
                  <Badge className={STATUS_BADGE[rec.status]}>{STATUS_LABEL[rec.status]}</Badge>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{TYPE_LABEL[rec.meetingType] ?? rec.meetingType}</span>
                </div>
                <h3 className="font-semibold mt-1 truncate">{rec.title}</h3>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <CalendarDays size={12} />{new Date(rec.meetingDate).toLocaleDateString('zh-TW')}
                  </span>
                  {rec.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />{rec.location}
                    </span>
                  )}
                  {rec.isOnline && <span className="text-blue-500">線上會議</span>}
                  {rec.facilitator && (
                    <span className="flex items-center gap-1">
                      <Users size={12} />{rec.facilitator.name}
                    </span>
                  )}
                  {rec.customer && <span className="text-blue-500">{rec.customer.name}</span>}
                </div>
                {rec.summary && (
                  <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{rec.summary}</p>
                )}
              </div>
              {rec._count.actionItems > 0 && (
                <div className="flex items-center gap-1 text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-lg shrink-0">
                  <CheckSquare size={12} />
                  {rec._count.actionItems} 待辦
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增會議 / 拜訪記錄</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">標題 *</div>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="會議/拜訪標題" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">類型 *</div>
                <Select value={form.meetingType} onValueChange={v => { if (v) setForm(f => ({ ...f, meetingType: v })) }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPES.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">狀態</div>
                <Select value={form.status} onValueChange={v => { if (v) setForm(f => ({ ...f, status: v })) }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">日期 *</div>
                <Input type="date" value={form.meetingDate} onChange={e => setForm(f => ({ ...f, meetingDate: e.target.value }))} className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">地點</div>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="會議地點" className="h-9" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">關聯客戶</div>
              <Select value={form.customerId || '__none__'} onValueChange={v => { if (v) setForm(f => ({ ...f, customerId: v === '__none__' ? '' : v })) }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="選擇客戶（選填）" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不指定</SelectItem>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">議程</div>
              <textarea value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))}
                rows={3} placeholder="會議議程" className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">會議摘要</div>
              <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                rows={3} placeholder="本次會議摘要" className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">決議事項</div>
              <textarea value={form.decisions} onChange={e => setForm(f => ({ ...f, decisions: e.target.value }))}
                rows={2} placeholder="本次決議事項" className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} className="flex-1" disabled={!form.title}>建立</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span>{selected.title}</span>
                  <Badge className={STATUS_BADGE[selected.status]}>{STATUS_LABEL[selected.status]}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />{new Date(selected.meetingDate).toLocaleDateString('zh-TW')}
                  </div>
                  {selected.location && (
                    <div className="flex items-center gap-1"><MapPin size={12} />{selected.location}</div>
                  )}
                  {selected.facilitator && (
                    <div className="flex items-center gap-1"><Users size={12} />主持：{selected.facilitator.name}</div>
                  )}
                  {selected.customer && (
                    <div className="text-blue-500">{selected.customer.name}</div>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs font-medium text-gray-400 mb-1">類型</div>
                  <div>{TYPE_LABEL[selected.meetingType] ?? selected.meetingType}</div>
                </div>
                {selected.summary && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-gray-400 mb-1">會議摘要</div>
                    <div className="whitespace-pre-wrap text-gray-700">{selected.summary}</div>
                  </div>
                )}
                {selected._count.actionItems > 0 && (
                  <div className="flex items-center gap-2 text-orange-500 text-xs">
                    <CheckSquare size={14} />
                    此記錄有 {selected._count.actionItems} 項待辦事項
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
