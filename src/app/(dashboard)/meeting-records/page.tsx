'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import {
  Plus, Search, CalendarDays, Users, MapPin, Clock, CheckSquare,
  Mic, Upload, Play, Pause, Trash2, Brain, Send, Edit3, ChevronDown, ChevronUp,
} from 'lucide-react'
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
  audioFileUrl: string | null
  transcriptStatus: string
  facilitator: { id: string; name: string } | null
  customer: { id: string; name: string } | null
  _count: { actionItems: number }
}

interface MeetingDetail extends MeetingRecord {
  decisions: string | null
  minutesText: string | null
  agenda: string | null
  transcriptText: string | null
  aiSummary: string | null
  aiActionItems: AiActionItem[] | null
  aiProcessedAt: string | null
  attendeesJson: AttendeeJson[] | null
  actionItems: ActionItem[]
}

interface AiActionItem {
  title: string
  owner?: string
  dueDate?: string | null
  priority?: string
}

interface AttendeeJson {
  userId?: string
  name: string
  role?: string
  isExternal?: boolean
}

interface ActionItem {
  id: string
  actionTitle: string
  actionDescription: string | null
  ownerUserId: string | null
  owner: { id: string; name: string } | null
  dueDate: string | null
  status: string
  priority: string
  completionNote: string | null
  completedAt: string | null
}

interface Customer { id: string; name: string }
interface User { id: string; name: string }

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const ACTION_STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  OVERDUE: 'bg-red-100 text-red-700',
}

const TRANSCRIPT_STATUS_LABEL: Record<string, string> = {
  PENDING: '未處理',
  PROCESSING: 'AI 分析中...',
  COMPLETED: 'AI 已分析',
  FAILED: '分析失敗',
}

const MEETING_TYPE_KEYS = [
  'WEEKLY_ADMIN', 'CHANNEL_NEGOTIATION', 'ASSOCIATION_MEETING', 'EXHIBITION_DEBRIEF',
  'PROMO_PLANNING', 'SUPPLIER_MEETING', 'INTERNAL', 'OTHER',
]
const STATUS_KEYS = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

export default function MeetingRecordsPage() {
  const { dict } = useI18n()
  const [records, setRecords] = useState<MeetingRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('__all__')
  const [statusFilter, setStatusFilter] = useState('__all__')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<MeetingDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])

  // Detail panel tabs
  const [detailTab, setDetailTab] = useState<'info' | 'transcript' | 'actions'>('info')

  // Audio state
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioInputRef = useRef<HTMLInputElement | null>(null)

  // Transcript editing
  const [editingTranscript, setEditingTranscript] = useState(false)
  const [transcriptDraft, setTranscriptDraft] = useState('')
  const [transcribing, setTranscribing] = useState(false)

  // Action items
  const [newActionTitle, setNewActionTitle] = useState('')
  const [newActionOwner, setNewActionOwner] = useState('')
  const [newActionDue, setNewActionDue] = useState('')
  const [addingAction, setAddingAction] = useState(false)

  // Publishing
  const [publishing, setPublishing] = useState(false)

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

  const openDetail = async (rec: MeetingRecord) => {
    setDetailLoading(true)
    setSelected(null)
    setDetailTab('info')
    setEditingTranscript(false)
    try {
      const res = await fetch(`/api/meeting-records/${rec.id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSelected(data)
      setTranscriptDraft(data.transcriptText ?? '')
    } catch { toast.error(dict.common.loadFailed) }
    finally { setDetailLoading(false) }
  }

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/meeting-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? dict.common.createFailed)
      toast.success(dict.meetingRecords.created)
      setShowCreate(false)
      setForm({ title: '', meetingType: 'INTERNAL', status: 'SCHEDULED', meetingDate: new Date().toISOString().slice(0, 10), location: '', isOnline: false, customerId: '', agenda: '', summary: '', decisions: '' })
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : dict.common.createFailed) }
  }

  // M-1: Audio upload
  const handleAudioUpload = async (file: File) => {
    if (!selected) return
    setAudioUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/meeting-records/${selected.id}/audio`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? '上傳失敗')
      const data = await res.json()
      setSelected(s => s ? { ...s, audioFileUrl: data.audioFileUrl, transcriptStatus: data.transcriptStatus } : s)
      toast.success('錄音檔上傳成功')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '上傳失敗') }
    finally { setAudioUploading(false) }
  }

  const handleAudioDelete = async () => {
    if (!selected) return
    try {
      await fetch(`/api/meeting-records/${selected.id}/audio`, { method: 'DELETE' })
      setSelected(s => s ? { ...s, audioFileUrl: null, transcriptStatus: 'PENDING', transcriptText: null, aiSummary: null, aiActionItems: null } : s)
      toast.success('錄音檔已刪除')
    } catch { toast.error('刪除失敗') }
  }

  // M-2+M-3: Transcribe (AI analysis)
  const handleTranscribe = async () => {
    if (!selected) return
    setTranscribing(true)
    try {
      const body: Record<string, string> = {}
      if (transcriptDraft) body.transcriptText = transcriptDraft
      const res = await fetch(`/api/meeting-records/${selected.id}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'AI 分析失敗')
      const data = await res.json()
      setSelected(s => s ? {
        ...s,
        transcriptText: data.transcriptText,
        transcriptStatus: data.transcriptStatus,
        aiSummary: data.aiSummary,
        aiActionItems: data.aiActionItems,
        aiProcessedAt: data.aiProcessedAt,
        summary: data.summary ?? s.summary,
        decisions: data.decisions ?? s.decisions,
      } : s)
      setTranscriptDraft(data.transcriptText ?? '')
      toast.success('AI 分析完成')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'AI 分析失敗') }
    finally { setTranscribing(false) }
  }

  // Save transcript manually
  const handleSaveTranscript = async () => {
    if (!selected) return
    try {
      await fetch(`/api/meeting-records/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptText: transcriptDraft }),
      })
      setSelected(s => s ? { ...s, transcriptText: transcriptDraft } : s)
      setEditingTranscript(false)
      toast.success('逐字稿已儲存')
    } catch { toast.error('儲存失敗') }
  }

  // Add action item
  const handleAddAction = async () => {
    if (!selected || !newActionTitle.trim()) return
    setAddingAction(true)
    try {
      const res = await fetch(`/api/meeting-records/${selected.id}/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionTitle: newActionTitle.trim(),
          ownerUserId: newActionOwner || null,
          dueDate: newActionDue || null,
          priority: 'MEDIUM',
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '新增失敗')
      const item = await res.json()
      setSelected(s => s ? { ...s, actionItems: [...s.actionItems, item], _count: { actionItems: s._count.actionItems + 1 } } : s)
      setNewActionTitle('')
      setNewActionOwner('')
      setNewActionDue('')
      toast.success('待辦事項已新增')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '新增失敗') }
    finally { setAddingAction(false) }
  }

  // Toggle action item status
  const handleToggleAction = async (item: ActionItem) => {
    if (!selected) return
    const newStatus = item.status === 'DONE' ? 'OPEN' : 'DONE'
    try {
      const res = await fetch(`/api/meeting-records/${selected.id}/action-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setSelected(s => s ? { ...s, actionItems: s.actionItems.map(i => i.id === item.id ? updated : i) } : s)
    } catch { toast.error('更新失敗') }
  }

  // M-5: Publish
  const handlePublish = async () => {
    if (!selected) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/meeting-records/${selected.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '發佈失敗')
      const data = await res.json()
      setSelected(s => s ? { ...s, status: 'COMPLETED', actionItems: data.actionItems } : s)
      toast.success(`已發佈！建立 ${data.createdActionItems} 筆待辦事項，通知 ${data.notifiedUsers} 位負責人`)
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '發佈失敗') }
    finally { setPublishing(false) }
  }

  // Completion rate
  const completionRate = (items: ActionItem[]) => {
    if (!items.length) return 0
    return Math.round((items.filter(i => i.status === 'DONE').length / items.length) * 100)
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dict.meetingRecords.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dict.meetingRecords.subtitle}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus size={16} />{dict.meetingRecords.addRecord}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-white border rounded-xl p-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={dict.meetingRecords.searchPlaceholder} className="pl-8 h-9" />
        </div>
        <Select value={typeFilter} onValueChange={v => { if (v) setTypeFilter(v) }}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{dict.meetingRecords.allTypes}</SelectItem>
            {MEETING_TYPE_KEYS.map(k => <SelectItem key={k} value={k}>{(dict.meetingRecords.typeLabels as Record<string, string>)[k]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { if (v) setStatusFilter(v) }}>
          <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{dict.meetingRecords.allStatuses}</SelectItem>
            {STATUS_KEYS.map(k => <SelectItem key={k} value={k}>{(dict.meetingRecords.statusLabels as Record<string, string>)[k]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-12 text-center text-gray-400">{dict.meetingRecords.loading}</div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
            <p>{dict.meetingRecords.empty}</p>
          </div>
        ) : records.map(rec => (
          <div key={rec.id}
            className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer"
            onClick={() => openDetail(rec)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-gray-400">{rec.meetingNo}</span>
                  <Badge className={STATUS_BADGE[rec.status]}>{(dict.meetingRecords.statusLabels as Record<string, string>)[rec.status] ?? rec.status}</Badge>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{(dict.meetingRecords.typeLabels as Record<string, string>)[rec.meetingType] ?? rec.meetingType}</span>
                  {rec.audioFileUrl && (
                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded flex items-center gap-1">
                      <Mic size={10} />有錄音
                    </span>
                  )}
                </div>
                <h3 className="font-semibold mt-1 truncate">{rec.title}</h3>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <CalendarDays size={12} />{new Date(rec.meetingDate).toLocaleDateString('zh-TW')}
                  </span>
                  {rec.location && (
                    <span className="flex items-center gap-1"><MapPin size={12} />{rec.location}</span>
                  )}
                  {rec.isOnline && <span className="text-blue-500">{dict.meetingRecords.onlineMeeting}</span>}
                  {rec.facilitator && (
                    <span className="flex items-center gap-1"><Users size={12} />{rec.facilitator.name}</span>
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
                  {rec._count.actionItems} {dict.meetingRecords.pendingItems}
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
            <DialogTitle>{dict.meetingRecords.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">{dict.meetingRecords.fieldTitle}</div>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={dict.meetingRecords.titlePlaceholder} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.meetingRecords.fieldType}</div>
                <Select value={form.meetingType} onValueChange={v => { if (v) setForm(f => ({ ...f, meetingType: v })) }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPE_KEYS.map(k => <SelectItem key={k} value={k}>{(dict.meetingRecords.typeLabels as Record<string, string>)[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.meetingRecords.fieldStatus}</div>
                <Select value={form.status} onValueChange={v => { if (v) setForm(f => ({ ...f, status: v })) }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_KEYS.map(k => <SelectItem key={k} value={k}>{(dict.meetingRecords.statusLabels as Record<string, string>)[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.meetingRecords.fieldDate}</div>
                <Input type="date" value={form.meetingDate} onChange={e => setForm(f => ({ ...f, meetingDate: e.target.value }))} className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{dict.meetingRecords.fieldLocation}</div>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder={dict.meetingRecords.locationPlaceholder} className="h-9" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{dict.meetingRecords.fieldCustomer}</div>
              <Select value={form.customerId || '__none__'} onValueChange={v => { if (v) setForm(f => ({ ...f, customerId: v === '__none__' ? '' : v })) }}>
                <SelectTrigger className="h-9"><SelectValue placeholder={dict.meetingRecords.customerPlaceholder} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{dict.meetingRecords.noCustomer}</SelectItem>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{dict.meetingRecords.fieldAgenda}</div>
              <textarea value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))}
                rows={2} placeholder={dict.meetingRecords.agendaPlaceholder} className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} className="flex-1" disabled={!form.title}>{dict.meetingRecords.btnCreate}</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>{dict.meetingRecords.btnCancel}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selected || detailLoading} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="py-12 text-center text-gray-400">載入中...</div>
          ) : selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap pr-8">
                  <span className="flex-1">{selected.title}</span>
                  <Badge className={STATUS_BADGE[selected.status]}>{(dict.meetingRecords.statusLabels as Record<string, string>)[selected.status] ?? selected.status}</Badge>
                </DialogTitle>
              </DialogHeader>

              {/* Tabs */}
              <div className="flex border-b gap-0 mt-1">
                {(['info', 'transcript', 'actions'] as const).map(tab => (
                  <button key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${detailTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab === 'info' ? '會議資訊' : tab === 'transcript' ? '逐字稿 / AI 摘要' : `待辦追蹤（${selected.actionItems.length}）`}
                  </button>
                ))}
              </div>

              {/* Tab: Info */}
              {detailTab === 'info' && (
                <div className="space-y-3 text-sm mt-2">
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock size={12} />{new Date(selected.meetingDate).toLocaleDateString('zh-TW')}
                    </div>
                    {selected.location && (
                      <div className="flex items-center gap-1"><MapPin size={12} />{selected.location}</div>
                    )}
                    {selected.facilitator && (
                      <div className="flex items-center gap-1"><Users size={12} />{dict.meetingRecords.facilitatorPrefix}{selected.facilitator.name}</div>
                    )}
                    {selected.customer && (
                      <div className="text-blue-500">{selected.customer.name}</div>
                    )}
                  </div>

                  {selected.summary && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-400 mb-1">會議摘要</div>
                      <div className="whitespace-pre-wrap text-gray-700 text-sm">{selected.summary}</div>
                    </div>
                  )}

                  {selected.decisions && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-blue-400 mb-1">決議事項</div>
                      <div className="whitespace-pre-wrap text-gray-700 text-sm">{selected.decisions}</div>
                    </div>
                  )}

                  {/* Publish button */}
                  {selected.status !== 'COMPLETED' && selected.status !== 'CANCELLED' && (
                    <Button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                    >
                      <Send size={15} />
                      {publishing ? '發佈中...' : '發佈會議記錄（建立待辦 + 通知負責人）'}
                    </Button>
                  )}
                </div>
              )}

              {/* Tab: Transcript + AI */}
              {detailTab === 'transcript' && (
                <div className="space-y-4 mt-2">
                  {/* M-1: Audio section */}
                  <div className="border rounded-lg p-3">
                    <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                      <Mic size={13} />錄音檔
                    </div>
                    {selected.audioFileUrl ? (
                      <div className="space-y-2">
                        <audio
                          ref={audioRef}
                          src={selected.audioFileUrl}
                          onPlay={() => setAudioPlaying(true)}
                          onPause={() => setAudioPlaying(false)}
                          onEnded={() => setAudioPlaying(false)}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="gap-1"
                            onClick={() => {
                              if (audioRef.current) {
                                audioPlaying ? audioRef.current.pause() : audioRef.current.play()
                              }
                            }}>
                            {audioPlaying ? <Pause size={14} /> : <Play size={14} />}
                            {audioPlaying ? '暫停' : '播放'}
                          </Button>
                          <span className="text-xs text-gray-500 flex-1 truncate">{selected.audioFileUrl.split('/').pop()}</span>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 h-8 w-8 p-0"
                            onClick={handleAudioDelete}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                        <div className="text-xs text-gray-400">
                          轉譯狀態：<span className={selected.transcriptStatus === 'COMPLETED' ? 'text-emerald-600' : selected.transcriptStatus === 'FAILED' ? 'text-red-500' : 'text-orange-500'}>
                            {TRANSCRIPT_STATUS_LABEL[selected.transcriptStatus] ?? selected.transcriptStatus}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <input
                          ref={audioInputRef}
                          type="file"
                          accept="audio/*,.mp3,.m4a,.wav,.webm"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) handleAudioUpload(f)
                          }}
                        />
                        <Button size="sm" variant="outline" className="gap-1.5"
                          disabled={audioUploading}
                          onClick={() => audioInputRef.current?.click()}>
                          <Upload size={14} />
                          {audioUploading ? '上傳中...' : '上傳錄音檔（MP3/M4A/WAV，最大 50MB）'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* M-4: Transcript editing */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-gray-500">逐字稿</div>
                      <div className="flex gap-1">
                        {!editingTranscript ? (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                            onClick={() => setEditingTranscript(true)}>
                            <Edit3 size={12} />編輯
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400"
                              onClick={() => { setEditingTranscript(false); setTranscriptDraft(selected.transcriptText ?? '') }}>
                              取消
                            </Button>
                            <Button size="sm" className="h-7 text-xs"
                              onClick={handleSaveTranscript}>
                              儲存
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingTranscript ? (
                      <textarea
                        value={transcriptDraft}
                        onChange={e => setTranscriptDraft(e.target.value)}
                        rows={8}
                        placeholder="貼上或輸入會議逐字稿..."
                        className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {selected.transcriptText || <span className="text-gray-300 italic">尚無逐字稿</span>}
                      </div>
                    )}
                  </div>

                  {/* M-2+M-3: AI Analysis */}
                  <div>
                    <Button
                      onClick={handleTranscribe}
                      disabled={transcribing}
                      variant="outline"
                      className="w-full gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      <Brain size={15} />
                      {transcribing ? 'AI 分析中...' : 'AI 分析逐字稿（提取摘要/決議/待辦）'}
                    </Button>
                  </div>

                  {/* AI Summary */}
                  {selected.aiSummary && (
                    <div className="bg-purple-50 rounded-lg p-3 space-y-2">
                      <div className="text-xs font-medium text-purple-500 flex items-center gap-1">
                        <Brain size={12} />AI 分析結果
                        {selected.aiProcessedAt && (
                          <span className="ml-auto font-normal text-gray-400">
                            {new Date(selected.aiProcessedAt).toLocaleString('zh-TW')}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700">{selected.aiSummary}</div>
                    </div>
                  )}

                  {/* AI Action Items preview */}
                  {selected.aiActionItems && selected.aiActionItems.length > 0 && (
                    <div className="border border-purple-200 rounded-lg p-3">
                      <div className="text-xs font-medium text-purple-500 mb-2">AI 提取的待辦事項（發佈後自動建立）</div>
                      <div className="space-y-1">
                        {selected.aiActionItems.map((item, i) => (
                          <div key={i} className="text-xs flex items-center gap-2 text-gray-600">
                            <span className="w-4 h-4 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shrink-0 text-[10px]">{i + 1}</span>
                            <span className="flex-1">{item.title}</span>
                            {item.owner && <span className="text-gray-400">{item.owner}</span>}
                            {item.dueDate && <span className="text-red-400">{item.dueDate}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Action Items - M-6 */}
              {detailTab === 'actions' && (
                <div className="space-y-3 mt-2">
                  {/* M-6: Completion rate */}
                  {selected.actionItems.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>完成度</span>
                        <span className="font-medium text-gray-700">
                          {selected.actionItems.filter(i => i.status === 'DONE').length}/{selected.actionItems.length}（{completionRate(selected.actionItems)}%）
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${completionRate(selected.actionItems)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action items list */}
                  <div className="space-y-1.5">
                    {selected.actionItems.map(item => (
                      <div key={item.id}
                        className={`border rounded-lg p-3 flex items-start gap-2 ${item.status === 'DONE' ? 'bg-gray-50 opacity-70' : 'bg-white'}`}>
                        <button
                          onClick={() => handleToggleAction(item)}
                          className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${item.status === 'DONE' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'}`}>
                          {item.status === 'DONE' && <span className="text-[10px]">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${item.status === 'DONE' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {item.actionTitle}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400">
                            {item.owner && <span className="flex items-center gap-0.5"><Users size={10} />{item.owner.name}</span>}
                            {item.dueDate && (
                              <span className={`flex items-center gap-0.5 ${new Date(item.dueDate) < new Date() && item.status !== 'DONE' ? 'text-red-500' : ''}`}>
                                <Clock size={10} />{new Date(item.dueDate).toLocaleDateString('zh-TW')}
                              </span>
                            )}
                            <Badge className={`text-[10px] h-4 ${ACTION_STATUS_BADGE[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {item.status === 'OPEN' ? '待辦' : item.status === 'IN_PROGRESS' ? '進行中' : item.status === 'DONE' ? '完成' : item.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    {selected.actionItems.length === 0 && (
                      <div className="py-6 text-center text-gray-400 text-sm">尚無待辦事項</div>
                    )}
                  </div>

                  {/* Add new action item */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="text-xs font-medium text-gray-500">新增待辦事項</div>
                    <Input
                      value={newActionTitle}
                      onChange={e => setNewActionTitle(e.target.value)}
                      placeholder="待辦事項標題"
                      className="h-8 text-sm"
                    />
                    <div className="flex gap-2">
                      <Select value={newActionOwner || '__none__'} onValueChange={v => setNewActionOwner(v === '__none__' ? '' : (v ?? ''))}>
                        <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="負責人" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">不指定</SelectItem>
                          {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        value={newActionDue}
                        onChange={e => setNewActionDue(e.target.value)}
                        className="h-8 w-36 text-xs"
                      />
                    </div>
                    <Button size="sm" className="w-full" disabled={!newActionTitle.trim() || addingAction}
                      onClick={handleAddAction}>
                      {addingAction ? '新增中...' : '新增'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
