'use client'

import { useEffect, useState, useRef } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Plus, Search, AlertCircle, Clock, CheckCircle2, XCircle,
  FileText, Mic, BookOpen, Camera, ClipboardList, Users, ChevronRight,
  Loader2, X, ImagePlus, Upload, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Constants ────────────────────────────────────────────────────────────────

const INCIDENT_TYPE_LABEL: Record<string, string> = {
  COMPLAINT:        '一般客訴',
  SKIN_ISSUE:       '皮膚問題',
  PRODUCT_DEFECT:   '產品瑕疵',
  CARE_PROCESS:     '照護流程',
  STAFF_FEEDBACK:   '員工反映',
  FAMILY_COMPLAINT: '家屬客訴',
  OTHER:            '其他',
}
const INCIDENT_SOURCE_LABEL: Record<string, string> = {
  PHONE_CALL:    '電話',
  LINE_MESSAGE:  'LINE',
  ON_SITE_VISIT: '現場',
  EMAIL:         '電郵',
  SALES_REP:     '業務回報',
  SUPERVISOR:    '督導回報',
  OTHER:         '其他',
}
const SYMPTOM_LABEL: Record<string, string> = {
  SKIN_REDNESS:      '皮膚紅腫',
  SKIN_ULCER:        '壓瘡/潰瘍',
  ALLERGIC_REACTION: '過敏反應',
  PRODUCT_LEAKAGE:   '產品滲漏',
  FIT_ISSUE:         '穿戴不合',
  ODOR_ISSUE:        '異味問題',
  OTHER:             '其他',
}
const SEVERITY_CONFIG: Record<string, { label: string; cls: string }> = {
  LOW:      { label: '低',  cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  MEDIUM:   { label: '中',  cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  HIGH:     { label: '高',  cls: 'bg-orange-50 text-orange-600 border-orange-200' },
  CRITICAL: { label: '緊急', cls: 'bg-red-100 text-red-700 border-red-300' },
}
const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  OPEN:          { label: '待處理', cls: 'bg-red-50 text-red-600 border-red-200',     icon: AlertCircle },
  IN_PROGRESS:   { label: '處理中', cls: 'bg-amber-50 text-amber-600 border-amber-200', icon: Clock },
  PENDING_VISIT: { label: '待現場', cls: 'bg-blue-50 text-blue-600 border-blue-200',   icon: Clock },
  RESOLVED:      { label: '已解決', cls: 'bg-green-50 text-green-600 border-green-200', icon: CheckCircle2 },
  CLOSED:        { label: '已結案', cls: 'bg-slate-50 text-slate-500 border-slate-200', icon: XCircle },
}
const ATTACHMENT_TYPE_LABEL: Record<string, string> = {
  SITE_PHOTO:      '現場照片',
  SKIN_PHOTO:      '皮膚照片',
  CHAT_SCREENSHOT: '聊天截圖',
  AUDIO_RECORDING: '錄音檔',
  TRANSCRIPT:      '逐字稿',
  TRAINING_PHOTO:  '教育訓練照片',
  DOCUMENT:        '文件',
  OTHER:           '其他',
}
const TRANSCRIPT_STATUS_LABEL: Record<string, string> = {
  PENDING:    '待處理',
  PROCESSING: 'AI 分析中…',
  COMPLETED:  '已完成',
  FAILED:     '失敗',
}
const ACTION_ITEM_STATUS_LABEL: Record<string, string> = {
  OPEN:        '待辦',
  IN_PROGRESS: '進行中',
  DONE:        '完成',
  CANCELLED:   '取消',
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ActionItem {
  id: string; actionTitle: string; status: string; dueDate: string | null
  owner: { id: string; name: string } | null
}
interface Incident {
  id: string; incidentNo: string; incidentDate: string; incidentType: string
  incidentSource: string; severity: string; status: string; issueSummary: string
  detailedDescription: string | null; symptomCategory: string | null
  requiresOnSiteVisit: boolean; scheduledVisitDate: string | null
  isKnowledgeBase: boolean
  customer: { id: string; name: string; code: string }
  reportedBy: { id: string; name: string }
  assignedOwner: { id: string; name: string } | null
  product: { id: string; name: string; sku: string } | null
  _count: { attachments: number; visitLogs: number; audioRecords: number; trainingLogs: number; actionItems: number }
  actionItems: ActionItem[]
}

// ── Select styles ─────────────────────────────────────────────────────────────
const sel = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const ta  = `${sel} resize-none`

// ═══════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════

export default function IncidentsPage() {
  const { dict } = useI18n()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [selected,  setSelected]  = useState<Incident | null>(null)
  const [newOpen,   setNewOpen]   = useState(false)
  const [customers, setCustomers] = useState<{ id: string; name: string; code: string }[]>([])
  const [users,     setUsers]     = useState<{ id: string; name: string }[]>([])

  async function load() {
    setLoading(true)
    const qs = new URLSearchParams()
    if (statusFilter)   qs.set('status', statusFilter)
    if (severityFilter) qs.set('severity', severityFilter)
    qs.set('limit', '30')
    const res = await fetch(`/api/incidents?${qs}`)
    if (res.ok) {
      const data = await res.json()
      setIncidents(data.items)
      setTotal(data.total)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/customers?limit=200').then(r => r.ok ? r.json() : null).then(d => {
      setCustomers(Array.isArray(d) ? d : (d?.data ?? []))
    })
    fetch('/api/users').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.users) setUsers(d.users)
      else if (Array.isArray(d)) setUsers(d)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, severityFilter])

  const filtered = incidents.filter(i =>
    !search || i.issueSummary.includes(search) || i.customer.name.includes(search) || i.incidentNo.includes(search)
  )

  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'CLOSED').length
  const openCount     = incidents.filter(i => i.status === 'OPEN').length

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-TW') : '—'

  return (
    <div className="flex h-full">
      {/* ── Left panel: list ── */}
      <div className="w-[420px] shrink-0 border-r flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">{dict.nav.incidents}</h1>
              <p className="text-xs text-muted-foreground">共 {total} 件</p>
            </div>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />{dict.common.create}
            </Button>
          </div>

          {/* Alert badges */}
          {(criticalCount > 0 || openCount > 0) && (
            <div className="flex gap-2 flex-wrap">
              {criticalCount > 0 && (
                <Badge className="bg-red-600 text-white text-xs">
                  <AlertCircle className="mr-1 h-3 w-3" />緊急 {criticalCount} 件
                </Badge>
              )}
              {openCount > 0 && (
                <Badge className="bg-red-100 text-red-700 border border-red-200 text-xs">
                  待處理 {openCount} 件
                </Badge>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm" placeholder={dict.common.searchPlaceholder}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none"
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">全部狀態</option>
              {Object.entries(STATUS_CONFIG).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
            <select className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none"
              value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
              <option value="">全部嚴重度</option>
              {Object.entries(SEVERITY_CONFIG).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
            <button onClick={load} className="rounded border border-input p-1 hover:bg-slate-50">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground text-sm">{dict.common.noRecords}</p>
          ) : filtered.map(incident => {
            const sc  = STATUS_CONFIG[incident.status]   ?? STATUS_CONFIG.OPEN
            const sev = SEVERITY_CONFIG[incident.severity] ?? SEVERITY_CONFIG.MEDIUM
            const isActive = selected?.id === incident.id

            return (
              <button key={incident.id} onClick={() => setSelected(incident)}
                className={`w-full text-left p-4 border-b hover:bg-slate-50 transition-colors ${isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{incident.incidentNo}</span>
                      <Badge variant="outline" className={`text-xs ${sev.cls}`}>{sev.label}</Badge>
                      <Badge variant="outline" className={`text-xs ${sc.cls}`}>
                        <sc.icon className="mr-0.5 h-2.5 w-2.5" />{sc.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{incident.issueSummary}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {incident.customer.name} · {fmtDate(incident.incidentDate)}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {incident._count.attachments > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-0.5">
                          <Camera className="h-3 w-3" />{incident._count.attachments}
                        </span>
                      )}
                      {incident._count.audioRecords > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-0.5">
                          <Mic className="h-3 w-3" />{incident._count.audioRecords}
                        </span>
                      )}
                      {incident.isKnowledgeBase && (
                        <span className="text-xs text-blue-400 flex items-center gap-0.5">
                          <BookOpen className="h-3 w-3" />知識庫
                        </span>
                      )}
                      {incident.actionItems.some(a => a.status === 'OPEN') && (
                        <span className="text-xs text-orange-500 flex items-center gap-0.5">
                          <ClipboardList className="h-3 w-3" />待辦
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right panel: detail ── */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <IncidentDetail
            incident={selected}
            users={users}
            onRefresh={() => { load(); setSelected(null) }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <FileText className="h-12 w-12 mx-auto opacity-30" />
              <p>{dict.common.noData}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── New Incident Dialog ── */}
      <NewIncidentDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        customers={customers}
        users={users}
        onSuccess={() => { setNewOpen(false); load() }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// IncidentDetail Component
// ═══════════════════════════════════════════════════════════════════════

type DetailTab = 'overview' | 'attachments' | 'visits' | 'audio' | 'training' | 'actions'

function IncidentDetail({ incident, users, onRefresh }: {
  incident: Incident
  users: { id: string; name: string }[]
  onRefresh: () => void
}) {
  const [tab,     setTab]     = useState<DetailTab>('overview')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [full,    setFull]    = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)

  // Sub-resource data (any[] intentional — API responses)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [attachments,   setAttachments]   = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [visitLogs,     setVisitLogs]     = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [audioRecords,  setAudioRecords]  = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trainingLogs,  setTrainingLogs]  = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [actionItems,   setActionItems]   = useState<any[]>([])

  // Dialog states
  const [visitOpen,    setVisitOpen]    = useState(false)
  const [audioOpen,    setAudioOpen]    = useState(false)
  const [trainingOpen, setTrainingOpen] = useState(false)
  const [actionOpen,   setActionOpen]   = useState(false)
  const [statusOpen,   setStatusOpen]   = useState(false)

  async function loadFull() {
    setLoading(true)
    const res = await fetch(`/api/incidents/${incident.id}`)
    if (res.ok) setFull(await res.json())
    setLoading(false)
  }

  async function loadTab(t: DetailTab) {
    setTab(t)
    if (t === 'attachments' && attachments.length === 0) {
      const r = await fetch(`/api/incidents/${incident.id}/attachments`); if (r.ok) setAttachments(await r.json())
    }
    if (t === 'visits' && visitLogs.length === 0) {
      const r = await fetch(`/api/incidents/${incident.id}/visit-logs`); if (r.ok) setVisitLogs(await r.json())
    }
    if (t === 'audio' && audioRecords.length === 0) {
      const r = await fetch(`/api/incidents/${incident.id}/audio`); if (r.ok) setAudioRecords(await r.json())
    }
    if (t === 'training' && trainingLogs.length === 0) {
      const r = await fetch(`/api/incidents/${incident.id}/training-logs`); if (r.ok) setTrainingLogs(await r.json())
    }
    if (t === 'actions' && actionItems.length === 0) {
      const r = await fetch(`/api/incidents/${incident.id}/action-items`); if (r.ok) setActionItems(await r.json())
    }
  }

  useEffect(() => { loadFull() }, [incident.id])

  const sc  = STATUS_CONFIG[incident.status]   ?? STATUS_CONFIG.OPEN
  const sev = SEVERITY_CONFIG[incident.severity] ?? SEVERITY_CONFIG.MEDIUM
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-TW') : '—'
  const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'

  async function updateStatus(status: string, resolution?: string) {
    setSaving(true)
    const res = await fetch(`/api/incidents/${incident.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution }),
    })
    setSaving(false)
    if (res.ok) { toast.success('已更新狀態'); setStatusOpen(false); onRefresh() }
    else toast.error('更新失敗')
  }

  const tabDef: { key: DetailTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'overview',     label: '概覽',     icon: FileText },
    { key: 'attachments',  label: '附件',      icon: Camera,      count: incident._count.attachments },
    { key: 'visits',       label: '現場紀錄',  icon: Users,       count: incident._count.visitLogs },
    { key: 'audio',        label: '錄音/逐字稿', icon: Mic,       count: incident._count.audioRecords },
    { key: 'training',     label: '教育訓練',  icon: BookOpen,    count: incident._count.trainingLogs },
    { key: 'actions',      label: '待辦事項',  icon: ClipboardList, count: incident._count.actionItems },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Detail header */}
      <div className={`p-4 border-b ${incident.severity === 'CRITICAL' ? 'bg-red-50' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-muted-foreground">{incident.incidentNo}</span>
              <Badge variant="outline" className={`text-xs ${sev.cls}`}>{sev.label}嚴重度</Badge>
              <Badge variant="outline" className={`text-xs ${sc.cls}`}>
                <sc.icon className="mr-1 h-3 w-3" />{sc.label}
              </Badge>
              {incident.isKnowledgeBase && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                  <BookOpen className="mr-1 h-3 w-3" />知識庫
                </Badge>
              )}
            </div>
            <h2 className="text-base font-semibold">{incident.issueSummary}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {incident.customer.name} · {INCIDENT_TYPE_LABEL[incident.incidentType] ?? incident.incidentType} · {fmtDate(incident.incidentDate)}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {incident.status !== 'CLOSED' && (
              <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)}>更新狀態</Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex overflow-x-auto shrink-0">
        {tabDef.map(t => (
          <button key={t.key} onClick={() => loadTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 ${tab === t.key ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
            {t.count != null && t.count > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 text-xs">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'overview' && (
          <div className="space-y-5 max-w-2xl">
            {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">案件來源：</span>{INCIDENT_SOURCE_LABEL[incident.incidentSource] ?? incident.incidentSource}</div>
              <div><span className="text-muted-foreground">登錄人：</span>{incident.reportedBy.name}</div>
              {incident.assignedOwner && <div><span className="text-muted-foreground">負責人：</span>{incident.assignedOwner.name}</div>}
              {incident.symptomCategory && <div><span className="text-muted-foreground">症狀分類：</span>{SYMPTOM_LABEL[incident.symptomCategory] ?? incident.symptomCategory}</div>}
              {incident.requiresOnSiteVisit && <div><span className="text-muted-foreground">需現場：</span>是 {incident.scheduledVisitDate && `(${fmtDate(incident.scheduledVisitDate)})`}</div>}
            </div>
            {incident.detailedDescription && (
              <div className="rounded bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground mb-1">詳細描述</p>
                <p className="text-sm">{incident.detailedDescription}</p>
              </div>
            )}
            {!!full?.suspectedCause && (
              <div className="rounded bg-amber-50 p-3">
                <p className="text-xs text-muted-foreground mb-1">疑似原因</p>
                <p className="text-sm">{String(full.suspectedCause)}</p>
              </div>
            )}
            {!!full?.immediateActionTaken && (
              <div className="rounded bg-green-50 p-3">
                <p className="text-xs text-muted-foreground mb-1">即時處置</p>
                <p className="text-sm">{String(full.immediateActionTaken)}</p>
              </div>
            )}
            {!!full?.resolution && (
              <div className="rounded bg-blue-50 p-3 border border-blue-200">
                <p className="text-xs text-muted-foreground mb-1">處理結論</p>
                <p className="text-sm text-blue-800">{String(full.resolution)}</p>
              </div>
            )}

            {/* Open action items */}
            {incident.actionItems.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">待辦事項</p>
                <div className="space-y-1.5">
                  {incident.actionItems.map(a => (
                    <div key={a.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                      <span>{a.actionTitle}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {a.owner?.name && <span>{a.owner.name}</span>}
                        {a.dueDate && <span className={new Date(a.dueDate) < new Date() ? 'text-red-500' : ''}>{fmtDate(a.dueDate)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'attachments' && (
          <AttachmentsTab incidentId={incident.id} attachments={attachments} setAttachments={setAttachments} />
        )}

        {tab === 'visits' && (
          <VisitLogsTab
            incidentId={incident.id} visitLogs={visitLogs} setVisitLogs={setVisitLogs}
            open={visitOpen} setOpen={setVisitOpen} users={users}
          />
        )}

        {tab === 'audio' && (
          <AudioTab
            incidentId={incident.id} records={audioRecords} setRecords={setAudioRecords}
            open={audioOpen} setOpen={setAudioOpen}
          />
        )}

        {tab === 'training' && (
          <TrainingTab
            incidentId={incident.id} logs={trainingLogs} setLogs={setTrainingLogs}
            open={trainingOpen} setOpen={setTrainingOpen} users={users}
          />
        )}

        {tab === 'actions' && (
          <ActionItemsTab
            incidentId={incident.id} items={actionItems} setItems={setActionItems}
            open={actionOpen} setOpen={setActionOpen} users={users}
          />
        )}
      </div>

      {/* Update status dialog */}
      <Dialog open={statusOpen} onOpenChange={o => !o && setStatusOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>更新案件狀態</DialogTitle></DialogHeader>
          <UpdateStatusForm
            currentStatus={incident.status}
            onSubmit={updateStatus}
            saving={saving}
            onCancel={() => setStatusOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── UpdateStatusForm ─────────────────────────────────────────────────────────
function UpdateStatusForm({ currentStatus, onSubmit, saving, onCancel }: {
  currentStatus: string
  onSubmit: (status: string, resolution?: string) => void
  saving: boolean
  onCancel: () => void
}) {
  const [status,     setStatus]     = useState(currentStatus)
  const [resolution, setResolution] = useState('')
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(status, resolution || undefined) }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>新狀態</Label>
        <select className={sel} value={status} onChange={e => setStatus(e.target.value)}>
          {Object.entries(STATUS_CONFIG).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
      </div>
      {(status === 'RESOLVED' || status === 'CLOSED') && (
        <div className="space-y-1.5">
          <Label>處理結論 {status === 'CLOSED' ? '*' : ''}</Label>
          <textarea className={ta} rows={3} value={resolution} onChange={e => setResolution(e.target.value)}
            placeholder="說明此案如何解決..." required={status === 'CLOSED'} />
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>取消</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}更新
        </Button>
      </DialogFooter>
    </form>
  )
}

// ── AttachmentsTab ─────────────────────────────────────────────────────────
function AttachmentsTab({ incidentId, attachments, setAttachments }: {
  incidentId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAttachments: (a: any[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [files,     setFiles]     = useState<File[]>([])
  const [attType,   setAttType]   = useState('SITE_PHOTO')
  const [desc,      setDesc]      = useState('')
  const [sensitive, setSensitive] = useState(false)

  async function upload() {
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('attachmentType', attType)
      fd.append('description', desc)
      fd.append('isSensitive', String(sensitive || attType === 'SKIN_PHOTO'))
      const res = await fetch(`/api/incidents/${incidentId}/attachments`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setAttachments([data, ...attachments])
        toast.success('已上傳')
      } else toast.error('上傳失敗')
    }
    setFiles([]); setDesc(''); setUploading(false)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Upload form */}
      <div className="rounded-lg border p-4 space-y-3 bg-slate-50">
        <p className="text-sm font-medium">上傳新附件</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">附件類型</Label>
            <select className={sel} value={attType} onChange={e => { setAttType(e.target.value); if (e.target.value === 'SKIN_PHOTO') setSensitive(true) }}>
              {Object.entries(ATTACHMENT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">說明</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="附件說明..." className="h-9" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="sensitive" checked={sensitive}
            onChange={e => setSensitive(e.target.checked)} />
          <label htmlFor="sensitive" className="text-xs text-muted-foreground">標記為敏感資料（皮膚照片/住民照片）</label>
        </div>
        <label className="flex items-center gap-2 cursor-pointer rounded border border-dashed border-slate-300 px-4 py-3 hover:border-slate-400 transition-colors bg-white">
          <ImagePlus className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-muted-foreground">點擊選擇或拍照上傳（可多選）</span>
          <input type="file" accept="image/*,audio/*,.pdf" multiple capture="environment" className="hidden"
            onChange={e => setFiles(Array.from(e.target.files ?? []))} />
        </label>
        {files.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {files.map((f, i) => (
              <div key={i} className="relative group">
                {f.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(f)} alt={f.name} className="h-14 w-14 object-cover rounded border" />
                ) : (
                  <div className="h-14 w-14 rounded border bg-slate-100 flex items-center justify-center text-xs text-slate-500">{f.name.split('.').pop()}</div>
                )}
                <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" onClick={upload} disabled={!files.length || uploading}>
          {uploading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          <Upload className="mr-1.5 h-3.5 w-3.5" />上傳
        </Button>
      </div>

      {/* Attachment list */}
      {attachments.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground text-sm">尚無附件</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {attachments.map((a: any) => (
            <div key={a.id} className={`rounded-lg border p-3 space-y-2 ${a.isSensitive ? 'border-orange-200 bg-orange-50/30' : ''}`}>
              {a.mimeType?.startsWith('image/') ? (
                <a href={a.fileUrl} target="_blank" rel="noreferrer">
                  <img src={a.fileUrl} alt={a.fileName} className="w-full h-32 object-cover rounded" />
                </a>
              ) : (
                <a href={a.fileUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded bg-slate-100 p-3 hover:bg-slate-200">
                  <FileText className="h-5 w-5 text-slate-500 shrink-0" />
                  <span className="text-sm truncate">{a.fileName || '附件'}</span>
                </a>
              )}
              <div className="text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs mr-1">{ATTACHMENT_TYPE_LABEL[a.attachmentType] ?? a.attachmentType}</Badge>
                {a.isSensitive && <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200">敏感</Badge>}
              </div>
              {a.description && <p className="text-xs text-slate-600">{a.description}</p>}
              <p className="text-xs text-muted-foreground">
                {a.uploadedBy?.name} · {new Date(a.uploadedAt).toLocaleDateString('zh-TW')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── VisitLogsTab ─────────────────────────────────────────────────────────────
function VisitLogsTab({ incidentId, visitLogs, setVisitLogs, open, setOpen, users }: {
  incidentId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visitLogs: any[]; setVisitLogs: (v: any[]) => void
  open: boolean; setOpen: (o: boolean) => void
  users: { id: string; name: string }[]
}) {
  const [saving, setSaving] = useState(false)
  const emptyForm = () => ({ visitDate: new Date().toISOString().slice(0,10), visitType: '現場',
    participants: '', onSiteObservation: '', skinConditionNote: '', careProcessNote: '',
    productUsageNote: '', staffFeedback: '', immediateSuggestion: '', nextFollowupDate: '' })
  const [form, setForm] = useState(emptyForm())
  const sf = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-TW') : '—'

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch(`/api/incidents/${incidentId}/visit-logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) { toast.success('已新增現場紀錄'); setVisitLogs([await res.json(), ...visitLogs]); setOpen(false); setForm(emptyForm()) }
    else toast.error('新增失敗')
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />新增現場紀錄</Button>
      </div>
      {visitLogs.length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm">尚無現場紀錄</p>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : visitLogs.map((l: any) => (
          <div key={l.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{fmtDate(l.visitDate)}</span>
              <Badge variant="outline" className="text-xs">{l.visitType}</Badge>
              <span className="text-xs text-muted-foreground">{l.visitedBy?.name}</span>
            </div>
            {l.onSiteObservation   && <p className="text-sm"><span className="text-muted-foreground">現場觀察：</span>{l.onSiteObservation}</p>}
            {l.skinConditionNote   && <p className="text-sm text-orange-700"><span className="text-muted-foreground">皮膚狀況：</span>{l.skinConditionNote}</p>}
            {l.careProcessNote     && <p className="text-sm"><span className="text-muted-foreground">照護流程：</span>{l.careProcessNote}</p>}
            {l.immediateSuggestion && <p className="text-sm text-blue-700"><span className="text-muted-foreground">即時建議：</span>{l.immediateSuggestion}</p>}
            {l.nextFollowupDate    && <p className="text-xs text-muted-foreground">下次追蹤：{fmtDate(l.nextFollowupDate)}</p>}
          </div>
        ))
      }
      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增現場/電訪紀錄</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>日期</Label><Input type="date" value={form.visitDate} onChange={e => sf('visitDate', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>類型</Label>
                <select className={sel} value={form.visitType} onChange={e => sf('visitType', e.target.value)}>
                  {['電訪','現場','視訊'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>參與人員</Label><Input value={form.participants} onChange={e => sf('participants', e.target.value)} placeholder="張三、李四..." /></div>
            <div className="space-y-1.5"><Label>現場觀察</Label><textarea className={ta} rows={2} value={form.onSiteObservation} onChange={e => sf('onSiteObservation', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>皮膚狀況</Label><textarea className={ta} rows={2} value={form.skinConditionNote} onChange={e => sf('skinConditionNote', e.target.value)} placeholder="如有皮膚問題請詳述..." /></div>
            <div className="space-y-1.5"><Label>照護流程說明</Label><textarea className={ta} rows={2} value={form.careProcessNote} onChange={e => sf('careProcessNote', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>產品使用方式</Label><textarea className={ta} rows={2} value={form.productUsageNote} onChange={e => sf('productUsageNote', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>員工反應/回饋</Label><textarea className={ta} rows={2} value={form.staffFeedback} onChange={e => sf('staffFeedback', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>即時建議</Label><textarea className={ta} rows={2} value={form.immediateSuggestion} onChange={e => sf('immediateSuggestion', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>下次追蹤日期</Label><Input type="date" value={form.nextFollowupDate} onChange={e => sf('nextFollowupDate', e.target.value)} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── AudioTab ─────────────────────────────────────────────────────────────────
function AudioTab({ incidentId, records, setRecords, open, setOpen }: {
  incidentId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  records: any[]; setRecords: (r: any[]) => void
  open: boolean; setOpen: (o: boolean) => void
}) {
  const [saving,     setSaving]     = useState(false)
  const [file,       setFile]       = useState<File | null>(null)
  const [transcript, setTranscript] = useState('')
  const [polling,    setPolling]    = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function pollRecord(recordId: string) {
    const res = await fetch(`/api/incidents/${incidentId}/audio`)
    if (res.ok) {
      const data = await res.json()
      setRecords(data)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = data.find((d: any) => d.id === recordId)
      if (r && r.transcriptStatus === 'PROCESSING') {
        pollRef.current = setTimeout(() => pollRecord(recordId), 5000)
      } else {
        setPolling(null)
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const fd = new FormData()
    if (file) fd.append('file', file)
    if (transcript) fd.append('transcript', transcript)
    const res = await fetch(`/api/incidents/${incidentId}/audio`, { method: 'POST', body: fd })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      setRecords([data, ...records])
      toast.success('已上傳')
      if (transcript && data.transcriptStatus === 'PROCESSING') {
        setPolling(data.id)
        setTimeout(() => pollRecord(data.id), 3000)
      }
      setOpen(false); setFile(null); setTranscript('')
    } else toast.error('上傳失敗')
  }

  async function addTranscript(recordId: string, text: string) {
    const res = await fetch(`/api/incidents/${incidentId}/audio?recordId=${recordId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: text }),
    })
    if (res.ok) {
      toast.success('逐字稿已送出，AI 分析中...')
      setPolling(recordId)
      setTimeout(() => pollRecord(recordId), 3000)
      const updated = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRecords(records.map((r: any) => r.id === recordId ? updated : r))
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />新增錄音/逐字稿</Button>
      </div>
      {records.length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm">尚無錄音紀錄</p>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : records.map((r: any) => (
          <AudioRecordCard key={r.id} record={r} onAddTranscript={addTranscript} polling={polling === r.id} />
        ))
      }
      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增錄音/逐字稿</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>錄音檔（選填）</Label>
              <label className="flex items-center gap-2 cursor-pointer rounded border border-dashed border-slate-300 px-4 py-3 hover:border-slate-400">
                <Mic className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-muted-foreground">{file ? file.name : '點擊上傳錄音檔'}</span>
                <input type="file" accept="audio/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>逐字稿（貼入以觸發 AI 分析）</Label>
              <textarea className={ta} rows={6} value={transcript} onChange={e => setTranscript(e.target.value)}
                placeholder="貼上會議逐字稿，系統將自動產生摘要、會議結論與待辦事項..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving || (!file && !transcript)}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}上傳
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AudioRecordCard({ record, onAddTranscript, polling }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any
  onAddTranscript: (id: string, text: string) => void
  polling: boolean
}) {
  const [editTranscript, setEditTranscript] = useState(false)
  const [text, setText] = useState((record.transcriptText as string) ?? '')

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium">{new Date(record.createdAt as string).toLocaleDateString('zh-TW')}</span>
          <Badge variant="outline" className="text-xs">
            {TRANSCRIPT_STATUS_LABEL[record.transcriptStatus as string] ?? record.transcriptStatus as string}
          </Badge>
          {polling && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
        </div>
        {record.audioFileUrl && <a href={record.audioFileUrl as string} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">播放錄音</a>}
      </div>
      {record.transcriptText ? (
        <div className="rounded bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground mb-1">逐字稿</p>
          <p className="text-sm whitespace-pre-wrap line-clamp-4">{record.transcriptText as string}</p>
        </div>
      ) : !editTranscript ? (
        <button onClick={() => setEditTranscript(true)} className="text-xs text-blue-600 hover:underline">
          + 貼入逐字稿以觸發 AI 分析
        </button>
      ) : (
        <div className="space-y-2">
          <textarea className={`${ta} text-xs`} rows={5} value={text} onChange={e => setText(e.target.value)}
            placeholder="貼入逐字稿..." />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onAddTranscript(record.id as string, text); setEditTranscript(false) }}>送出分析</Button>
            <Button size="sm" variant="outline" onClick={() => setEditTranscript(false)}>取消</Button>
          </div>
        </div>
      )}
      {record.aiSummary && (
        <div className="space-y-2 border-t pt-2">
          <p className="text-xs font-medium text-blue-600">AI 分析結果</p>
          <div className="rounded bg-blue-50 p-3 text-xs space-y-2">
            <div><span className="font-medium">摘要：</span>{record.aiSummary as string}</div>
            {record.aiConclusion && <div><span className="font-medium">結論：</span>{record.aiConclusion as string}</div>}
          </div>
          {record.aiMeetingMinutes && (
            <div className="rounded bg-slate-50 p-3 text-xs">
              <p className="font-medium mb-1">會議記錄</p>
              <p className="whitespace-pre-wrap">{record.aiMeetingMinutes as string}</p>
            </div>
          )}
          {Array.isArray(record.aiActionItems) && record.aiActionItems.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">AI 建議待辦</p>
              <div className="space-y-1">
                {(record.aiActionItems as { title: string; owner?: string; dueDate?: string }[]).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs rounded border px-2 py-1">
                    <span className="flex-1">{item.title}</span>
                    {item.owner   && <span className="text-muted-foreground">{item.owner}</span>}
                    {item.dueDate && <span className="text-muted-foreground">{item.dueDate}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── TrainingTab ───────────────────────────────────────────────────────────────
function TrainingTab({ incidentId, logs, setLogs, open, setOpen, users }: {
  incidentId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logs: any[]; setLogs: (l: any[]) => void
  open: boolean; setOpen: (o: boolean) => void
  users: { id: string; name: string }[]
}) {
  const [saving, setSaving] = useState(false)
  const emptyForm = () => ({ trainingDate: new Date().toISOString().slice(0,10), trainingTopic: '',
    trainerUserId: '', attendees: '', trainingContent: '', trainingResult: '', followupRequired: false, nextFollowupDate: '' })
  const [form, setForm] = useState(emptyForm())
  const sf = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-TW') : '—'

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const body = { ...form,
      attendees: form.attendees ? form.attendees.split(',').map((a: string) => ({ name: a.trim() })) : [],
      nextFollowupDate: form.nextFollowupDate || null }
    const res = await fetch(`/api/incidents/${incidentId}/training-logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) { toast.success('已新增教育訓練紀錄'); setLogs([await res.json(), ...logs]); setOpen(false); setForm(emptyForm()) }
    else toast.error('新增失敗')
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />新增教育訓練</Button>
      </div>
      {logs.length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm">尚無教育訓練紀錄</p>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : logs.map((l: any) => (
          <div key={l.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{fmtDate(l.trainingDate)}</span>
              <span className="text-sm font-medium text-blue-700">{l.trainingTopic}</span>
              <span className="text-xs text-muted-foreground">by {l.trainer?.name}</span>
            </div>
            {l.trainingContent && <p className="text-sm"><span className="text-muted-foreground">內容：</span>{l.trainingContent}</p>}
            {l.trainingResult  && <p className="text-sm text-green-700"><span className="text-muted-foreground">成效：</span>{l.trainingResult}</p>}
            {l.followupRequired && <p className="text-xs text-amber-600">需後續追蹤 {l.nextFollowupDate && `· ${fmtDate(l.nextFollowupDate)}`}</p>}
          </div>
        ))
      }
      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增教育訓練紀錄</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>日期</Label><Input type="date" value={form.trainingDate} onChange={e => sf('trainingDate', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>講師</Label>
                <select className={sel} value={form.trainerUserId} onChange={e => sf('trainerUserId', e.target.value)}>
                  <option value="">請選擇</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>訓練主題 *</Label><Input value={form.trainingTopic} onChange={e => sf('trainingTopic', e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>參與人員（逗號分隔）</Label><Input value={form.attendees} onChange={e => sf('attendees', e.target.value)} placeholder="張三,李四..." /></div>
            <div className="space-y-1.5"><Label>訓練內容</Label><textarea className={ta} rows={3} value={form.trainingContent} onChange={e => sf('trainingContent', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>訓練成效</Label><textarea className={ta} rows={2} value={form.trainingResult} onChange={e => sf('trainingResult', e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="followup" checked={form.followupRequired}
                onChange={e => sf('followupRequired', e.target.checked)} />
              <label htmlFor="followup" className="text-sm">需後續追蹤</label>
              {form.followupRequired && <Input type="date" value={form.nextFollowupDate} onChange={e => sf('nextFollowupDate', e.target.value)} className="flex-1 h-8 text-sm" />}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── ActionItemsTab ─────────────────────────────────────────────────────────────
function ActionItemsTab({ incidentId, items, setItems, open, setOpen, users }: {
  incidentId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[]; setItems: (i: any[]) => void
  open: boolean; setOpen: (o: boolean) => void
  users: { id: string; name: string }[]
}) {
  const [saving, setSaving] = useState(false)
  const emptyForm = () => ({ actionTitle: '', actionDescription: '', ownerUserId: '', dueDate: '' })
  const [form, setForm] = useState(emptyForm())
  const sf = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-TW') : '—'

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch(`/api/incidents/${incidentId}/action-items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) { toast.success('已新增待辦'); setItems([...items, await res.json()]); setOpen(false); setForm(emptyForm()) }
    else toast.error('新增失敗')
  }

  async function updateStatus(itemId: string, status: string) {
    const res = await fetch(`/api/incidents/${incidentId}/action-items?itemId=${itemId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setItems(items.map((i: Record<string, unknown>) => i.id === itemId ? updated : i))
      toast.success('已更新')
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    OPEN: 'bg-red-50 text-red-600', IN_PROGRESS: 'bg-amber-50 text-amber-600',
    DONE: 'bg-green-50 text-green-600', CANCELLED: 'bg-slate-50 text-slate-400',
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />新增待辦</Button>
      </div>
      {items.length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm">尚無待辦事項</p>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : items.map((item: any) => {
          const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'DONE' && item.status !== 'CANCELLED'
          return (
            <div key={item.id} className={`rounded-lg border p-4 space-y-2 ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{item.actionTitle}</p>
                  {item.actionDescription && <p className="text-xs text-muted-foreground mt-0.5">{item.actionDescription}</p>}
                </div>
                <select value={item.status} onChange={e => updateStatus(item.id, e.target.value)}
                  className={`rounded px-2 py-1 text-xs border font-medium ${STATUS_COLORS[item.status] ?? ''}`}>
                  {Object.entries(ACTION_ITEM_STATUS_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {item.owner?.name && <span>負責：{item.owner.name}</span>}
                {item.dueDate && <span className={isOverdue ? 'text-red-500 font-medium' : ''}>截止：{fmtDate(item.dueDate)}</span>}
              </div>
            </div>
          )
        })
      }
      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增待辦事項</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><Label>待辦標題 *</Label><Input value={form.actionTitle} onChange={e => sf('actionTitle', e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>說明</Label><textarea className={ta} rows={2} value={form.actionDescription} onChange={e => sf('actionDescription', e.target.value)} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>負責人</Label>
                <select className={sel} value={form.ownerUserId} onChange={e => sf('ownerUserId', e.target.value)}>
                  <option value="">不指定</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>截止日期</Label><Input type="date" value={form.dueDate} onChange={e => sf('dueDate', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}新增</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// NewIncidentDialog
// ═══════════════════════════════════════════════════════════════════════

function NewIncidentDialog({ open, onClose, customers, users, onSuccess }: {
  open: boolean; onClose: () => void
  customers: { id: string; name: string; code: string }[]
  users: { id: string; name: string }[]
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const emptyForm = () => ({
    customerId: '', incidentDate: new Date().toISOString().slice(0,10),
    incidentType: 'COMPLAINT', incidentSource: 'PHONE_CALL',
    severity: 'MEDIUM', symptomCategory: '',
    issueSummary: '', detailedDescription: '', suspectedCause: '',
    immediateActionTaken: '', requiresOnSiteVisit: false,
    scheduledVisitDate: '', contactPerson: '', assignedOwnerId: '',
  })
  const [form, setForm] = useState(emptyForm())
  const sf = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const body = { ...form, scheduledVisitDate: form.scheduledVisitDate || null, symptomCategory: form.symptomCategory || null }
    const res = await fetch('/api/incidents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) { toast.success('已新增事件'); setForm(emptyForm()); onSuccess() }
    else toast.error('新增失敗')
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>新增客訴/照護事件</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>客戶 *</Label>
              <select className={sel} value={form.customerId} onChange={e => sf('customerId', e.target.value)} required>
                <option value="">請選擇客戶</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>事件日期 *</Label>
              <Input type="date" value={form.incidentDate} onChange={e => sf('incidentDate', e.target.value)} required />
            </div>
          </div>

          {/* Row 2: type + source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>事件類型</Label>
              <select className={sel} value={form.incidentType} onChange={e => sf('incidentType', e.target.value)}>
                {Object.entries(INCIDENT_TYPE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>來源管道</Label>
              <select className={sel} value={form.incidentSource} onChange={e => sf('incidentSource', e.target.value)}>
                {Object.entries(INCIDENT_SOURCE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Severity */}
          <div className="space-y-1.5">
            <Label>嚴重程度</Label>
            <div className="flex gap-2">
              {(['LOW','MEDIUM','HIGH','CRITICAL'] as const).map(s => (
                <button key={s} type="button" onClick={() => sf('severity', s)}
                  className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${form.severity === s ? SEVERITY_CONFIG[s].cls + ' border-current' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                  {SEVERITY_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Symptom */}
          {(form.incidentType === 'SKIN_ISSUE' || form.incidentType === 'PRODUCT_DEFECT') && (
            <div className="space-y-1.5">
              <Label>症狀分類</Label>
              <select className={sel} value={form.symptomCategory} onChange={e => sf('symptomCategory', e.target.value)}>
                <option value="">請選擇</option>
                {Object.entries(SYMPTOM_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )}

          {/* Summary + detail */}
          <div className="space-y-1.5">
            <Label>事件摘要 *</Label>
            <Input value={form.issueSummary} onChange={e => sf('issueSummary', e.target.value)}
              placeholder="一句話描述事件..." required />
          </div>
          <div className="space-y-1.5">
            <Label>詳細描述</Label>
            <textarea className={ta} rows={3} value={form.detailedDescription}
              onChange={e => sf('detailedDescription', e.target.value)} placeholder="詳細情況..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>疑似原因</Label>
              <Input value={form.suspectedCause} onChange={e => sf('suspectedCause', e.target.value)} placeholder="初步判斷原因..." />
            </div>
            <div className="space-y-1.5">
              <Label>聯絡人</Label>
              <Input value={form.contactPerson} onChange={e => sf('contactPerson', e.target.value)} placeholder="對接聯絡人..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>即時處置</Label>
            <textarea className={ta} rows={2} value={form.immediateActionTaken}
              onChange={e => sf('immediateActionTaken', e.target.value)} placeholder="已採取的即時行動..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>負責人</Label>
              <select className={sel} value={form.assignedOwnerId} onChange={e => sf('assignedOwnerId', e.target.value)}>
                <option value="">請選擇</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center gap-2 pb-1">
                <input type="checkbox" id="needVisit" checked={form.requiresOnSiteVisit}
                  onChange={e => sf('requiresOnSiteVisit', e.target.checked)} />
                <label htmlFor="needVisit" className="text-sm">需現場拜訪</label>
              </div>
            </div>
          </div>
          {form.requiresOnSiteVisit && (
            <div className="space-y-1.5">
              <Label>預定現場日期</Label>
              <Input type="date" value={form.scheduledVisitDate} onChange={e => sf('scheduledVisitDate', e.target.value)} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>取消</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}建立事件
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
