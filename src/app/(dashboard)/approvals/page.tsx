'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle2, XCircle, Clock, AlertTriangle, Settings, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApprovalStep {
  id: string
  stepOrder: number
  stepName: string
  approverId: string | null
  status: string
  action: string | null
  comment: string | null
  actedAt: string | null
  approver: { id: string; name: string } | null
}

interface ApprovalRequest {
  id: string
  requestNo: string
  module: string
  entityLabel: string
  status: string
  currentStep: number
  requestedAt: string
  completedAt: string | null
  notes: string | null
  requestedBy: { id: string; name: string }
  steps: ApprovalStep[]
}

interface TemplateStep {
  stepName: string
  approverRole: string
  isOptional: boolean
}

interface ApprovalTemplate {
  id: string
  name: string
  description: string | null
  module: string
  isActive: boolean
  steps: (TemplateStep & { id: string; stepOrder: number })[]
  createdBy: { id: string; name: string }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  ORDER: '訂單',
  PURCHASE: '採購單',
  INTERNAL_USE: '內部領用',
  QUOTATION: '報價單',
  PURCHASE_REQUEST: '請購單',
  CUSTOM: '自訂',
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  PENDING:   { label: '待審核', variant: 'secondary',    icon: <Clock className="h-3 w-3" /> },
  APPROVED:  { label: '已批准', variant: 'default',      icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED:  { label: '已拒絕', variant: 'destructive',  icon: <XCircle className="h-3 w-3" /> },
  CANCELLED: { label: '已取消', variant: 'outline',      icon: <AlertTriangle className="h-3 w-3" /> },
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: '超級管理員', GM: '總經理', SALES_MANAGER: '業務主管',
  SALES: '業務', CS: '客服', WAREHOUSE_MANAGER: '倉管主管',
  WAREHOUSE: '倉庫', FINANCE: '財務', PROCUREMENT: '採購',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const, icon: null }
  return (
    <Badge variant={cfg.variant} className="flex items-center gap-1">
      {cfg.icon}{cfg.label}
    </Badge>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { dict } = useI18n()
  const [tab, setTab] = useState('inbox')
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [detail, setDetail] = useState<ApprovalRequest | null>(null)
  const [actionDialog, setActionDialog] = useState<{ open: boolean; requestId: string; action: 'APPROVE' | 'REJECT' }>({ open: false, requestId: '', action: 'APPROVE' })
  const [comment, setComment] = useState('')
  const [tmplDialog, setTmplDialog] = useState(false)
  const [tmplForm, setTmplForm] = useState({ name: '', description: '', module: 'ORDER' })
  const [tmplSteps, setTmplSteps] = useState<TemplateStep[]>([{ stepName: '主管核准', approverRole: 'GM', isOptional: false }])
  const [saving, setSaving] = useState(false)

  // New approval request dialog
  const [newReqDialog, setNewReqDialog] = useState(false)
  const [newReqForm, setNewReqForm] = useState({
    templateId: '',
    subject: '',
    description: '',
    refDoc: '',
  })
  const [newReqTemplates, setNewReqTemplates] = useState<ApprovalTemplate[]>([])
  const [newReqSaving, setNewReqSaving] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const view = tab === 'inbox' ? 'pending' : tab === 'mine' ? 'mine' : 'all'
    const p = new URLSearchParams({ view, ...(statusFilter && { status: statusFilter }), ...(moduleFilter && { module: moduleFilter }) })
    const res = await fetch(`/api/approvals?${p}`)
    const json = await res.json()
    setRequests(json.data ?? [])
    setLoading(false)
  }, [tab, statusFilter, moduleFilter])

  const fetchTemplates = useCallback(async () => {
    const res = await fetch('/api/approval-templates')
    const json = await res.json()
    setTemplates(Array.isArray(json) ? json : [])
  }, [])

  const fetchNewReqTemplates = useCallback(async () => {
    const res = await fetch('/api/approval-templates')
    const json = await res.json()
    setNewReqTemplates(Array.isArray(json) ? json : [])
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])
  useEffect(() => { if (tab === 'templates') fetchTemplates() }, [tab, fetchTemplates])

  function openNewReqDialog() {
    setNewReqForm({ templateId: '', subject: '', description: '', refDoc: '' })
    fetchNewReqTemplates()
    setNewReqDialog(true)
  }

  async function handleSubmitNewReq() {
    if (!newReqForm.subject.trim()) {
      toast.error(dict.approvalsPage.subjectRequired)
      return
    }
    const selectedTemplate = newReqTemplates.find(t => t.id === newReqForm.templateId)
    const module = selectedTemplate?.module ?? 'CUSTOM'
    const noteParts: string[] = []
    if (newReqForm.description.trim()) noteParts.push(newReqForm.description.trim())
    if (newReqForm.refDoc.trim()) noteParts.push(`參考單據：${newReqForm.refDoc.trim()}`)
    const notes = noteParts.length > 0 ? noteParts.join('\n') : null

    setNewReqSaving(true)
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: newReqForm.templateId || undefined,
          module,
          entityId: 'MANUAL',
          entityLabel: newReqForm.subject.trim(),
          notes,
        }),
      })
      if (res.ok) {
        toast.success(dict.approvalsPage.submitted)
        setNewReqDialog(false)
        setNewReqForm({ templateId: '', subject: '', description: '', refDoc: '' })
        fetchRequests()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? dict.common.submitFailed)
      }
    } catch {
      toast.error(dict.common.submitFailed)
    } finally {
      setNewReqSaving(false)
    }
  }

  async function handleAction() {
    setSaving(true)
    await fetch(`/api/approvals/${actionDialog.requestId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionDialog.action, comment }),
    })
    setSaving(false)
    setActionDialog({ open: false, requestId: '', action: 'APPROVE' })
    setComment('')
    setDetail(null)
    fetchRequests()
  }

  async function handleCancel(id: string) {
    if (!confirm('確定要取消此簽核申請？')) return
    await fetch(`/api/approvals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CANCEL' }),
    })
    setDetail(null)
    fetchRequests()
  }

  async function handleToggleTemplate(id: string) {
    await fetch(`/api/approval-templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'TOGGLE' }),
    })
    fetchTemplates()
  }

  async function handleSaveTemplate() {
    if (!tmplForm.name || !tmplSteps.length) return
    setSaving(true)
    await fetch('/api/approval-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...tmplForm, steps: tmplSteps }),
    })
    setSaving(false)
    setTmplDialog(false)
    setTmplForm({ name: '', description: '', module: 'ORDER' })
    setTmplSteps([{ stepName: '主管核准', approverRole: 'GM', isOptional: false }])
    fetchTemplates()
  }

  function openDetail(req: ApprovalRequest) { setDetail(req) }

  // ── Render ────────────────────────────────────────────────────────────────

  const RequestRow = ({ req }: { req: ApprovalRequest }) => (
    <div
      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
      onClick={() => openDetail(req)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{req.requestNo}</span>
          <Badge variant="outline" className="text-xs">{MODULE_LABELS[req.module] ?? req.module}</Badge>
        </div>
        <p className="mt-0.5 truncate font-medium">{req.entityLabel}</p>
        <p className="text-xs text-muted-foreground">申請人：{req.requestedBy.name} · {new Date(req.requestedAt).toLocaleDateString('zh-TW')}</p>
      </div>
      <div className="ml-3 shrink-0">
        <StatusBadge status={req.status} />
      </div>
    </div>
  )

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{dict.approvals.title}</h1>
        <Button onClick={openNewReqDialog}>
          <Plus className="mr-2 h-4 w-4" />{dict.approvals.newRequest}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="inbox">我的待辦</TabsTrigger>
          <TabsTrigger value="mine">我的申請</TabsTrigger>
          <TabsTrigger value="all">{dict.common.all}申請</TabsTrigger>
          <TabsTrigger value="templates">簽核範本</TabsTrigger>
        </TabsList>

        {/* ── Filters ── */}
        {tab !== 'templates' && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? '')}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue placeholder={dict.common.all + dict.common.status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{dict.common.all + dict.common.status}</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={moduleFilter} onValueChange={v => setModuleFilter(v ?? '')}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue placeholder={dict.common.all + '模組'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{dict.common.all + '模組'}</SelectItem>
                {Object.entries(MODULE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── Inbox / Mine / All ── */}
        {['inbox', 'mine', 'all'].map(t => (
          <TabsContent key={t} value={t}>
            <Card>
              <CardContent className="pt-4">
                {loading ? (
                  <p className="py-8 text-center text-muted-foreground">{dict.common.loading}</p>
                ) : requests.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">{dict.approvals.noResults}</p>
                ) : (
                  <div className="space-y-2">
                    {requests.map(r => <RequestRow key={r.id} req={r} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* ── Templates ── */}
        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">簽核範本管理</CardTitle>
              <Button size="sm" onClick={() => setTmplDialog(true)}>
                <Plus className="mr-1 h-4 w-4" />{dict.common.create}範本
              </Button>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">{dict.approvals.noApprovals}</p>
              ) : (
                <div className="space-y-3">
                  {templates.map(t => (
                    <div key={t.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{t.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">{MODULE_LABELS[t.module] ?? t.module}</Badge>
                          {!t.isActive && <Badge variant="secondary" className="ml-1 text-xs">停用</Badge>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleTemplate(t.id)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                      {t.description && <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.steps.map(s => (
                          <Badge key={s.id} variant="secondary" className="text-xs">
                            {s.stepOrder}. {s.stepName}（{ROLE_LABELS[s.approverRole] ?? s.approverRole}）
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Detail Dialog ── */}
      {detail && (
        <Dialog open onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{detail.requestNo}</span>
                <StatusBadge status={detail.status} />
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">模組：</span>{MODULE_LABELS[detail.module] ?? detail.module}</div>
                <div><span className="text-muted-foreground">單據：</span>{detail.entityLabel}</div>
                <div><span className="text-muted-foreground">申請人：</span>{detail.requestedBy.name}</div>
                <div><span className="text-muted-foreground">申請時間：</span>{new Date(detail.requestedAt).toLocaleString('zh-TW')}</div>
              </div>
              {detail.notes && (
                <p className="rounded bg-muted/40 p-2 text-sm">{detail.notes}</p>
              )}

              {/* Steps timeline */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">簽核流程</p>
                {detail.steps.map(step => (
                  <div key={step.id} className={`flex items-start gap-3 rounded-lg border p-2 ${step.stepOrder === detail.currentStep && detail.status === 'PENDING' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                    <div className="mt-0.5 shrink-0">
                      {step.status === 'APPROVED' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                       step.status === 'REJECTED' ? <XCircle className="h-4 w-4 text-red-500" /> :
                       <Clock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{step.stepOrder}. {step.stepName}</p>
                      {step.approver && <p className="text-xs text-muted-foreground">審核人：{step.approver.name}</p>}
                      {step.comment && <p className="mt-1 text-xs italic text-muted-foreground">備註：{step.comment}</p>}
                      {step.actedAt && <p className="text-xs text-muted-foreground">{new Date(step.actedAt).toLocaleString('zh-TW')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="flex-wrap gap-2">
              {detail.status === 'PENDING' && (
                <>
                  <Button
                    variant="destructive" size="sm"
                    onClick={() => { setActionDialog({ open: true, requestId: detail.id, action: 'REJECT' }); setDetail(null) }}
                  >
                    <XCircle className="mr-1 h-4 w-4" />拒絕
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setActionDialog({ open: true, requestId: detail.id, action: 'APPROVE' }); setDetail(null) }}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />批准
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleCancel(detail.id)}>{dict.common.cancel}申請</Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>{dict.common.close}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Approve/Reject Dialog ── */}
      <Dialog open={actionDialog.open} onOpenChange={o => !o && setActionDialog({ open: false, requestId: '', action: 'APPROVE' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{actionDialog.action === 'APPROVE' ? dict.common.approve + '簽核' : dict.common.reject + '簽核'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>備註（選填）</Label>
              <Textarea
                placeholder="請輸入備註說明…"
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, requestId: '', action: 'APPROVE' })}>{dict.common.cancel}</Button>
            <Button
              variant={actionDialog.action === 'APPROVE' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={saving}
            >
              {dict.common.confirm}{actionDialog.action === 'APPROVE' ? dict.common.approve : dict.common.reject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Approval Request Dialog ── */}
      <Dialog open={newReqDialog} onOpenChange={o => !o && setNewReqDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dict.approvals.newRequest}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Template selector */}
            <div className="space-y-1.5">
              <Label>簽核範本（選填）</Label>
              <Select
                value={newReqForm.templateId}
                onValueChange={v => setNewReqForm(f => ({ ...f, templateId: (!v || v === '__none__') ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇範本（不選則使用預設流程）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不使用範本（預設流程）</SelectItem>
                  {newReqTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        （{MODULE_LABELS[t.module] ?? t.module}）
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newReqForm.templateId && (() => {
                const t = newReqTemplates.find(x => x.id === newReqForm.templateId)
                return t ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.steps.map(s => (
                      <Badge key={s.id} variant="secondary" className="text-xs">
                        {s.stepOrder}. {s.stepName}
                      </Badge>
                    ))}
                  </div>
                ) : null
              })()}
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label>申請主旨 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="例：採購辦公用品申請"
                value={newReqForm.subject}
                onChange={e => setNewReqForm(f => ({ ...f, subject: e.target.value }))}
              />
            </div>

            {/* Description / reason */}
            <div className="space-y-1.5">
              <Label>說明 / 申請原因</Label>
              <Textarea
                placeholder="請說明申請原因或補充說明..."
                value={newReqForm.description}
                onChange={e => setNewReqForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Reference doc */}
            <div className="space-y-1.5">
              <Label>參考單據編號（選填）</Label>
              <Input
                placeholder="例：PO-2026-001、合約編號..."
                value={newReqForm.refDoc}
                onChange={e => setNewReqForm(f => ({ ...f, refDoc: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewReqDialog(false)} disabled={newReqSaving}>
              {dict.common.cancel}
            </Button>
            <Button onClick={handleSubmitNewReq} disabled={newReqSaving || !newReqForm.subject.trim()}>
              {newReqSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.submit}申請
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Template Dialog ── */}
      <Dialog open={tmplDialog} onOpenChange={setTmplDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dict.common.create}簽核範本</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>範本名稱 *</Label>
                <Input value={tmplForm.name} onChange={e => setTmplForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>適用模組 *</Label>
                <Select value={tmplForm.module} onValueChange={v => setTmplForm(f => ({ ...f, module: v ?? 'ORDER' }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODULE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>說明</Label>
              <Input value={tmplForm.description} onChange={e => setTmplForm(f => ({ ...f, description: e.target.value }))} className="mt-1" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>簽核步驟</Label>
                <Button variant="ghost" size="sm" onClick={() => setTmplSteps(s => [...s, { stepName: '', approverRole: 'GM', isOptional: false }])}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {tmplSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <Input
                      placeholder="步驟名稱"
                      value={step.stepName}
                      onChange={e => setTmplSteps(s => s.map((x, j) => j === i ? { ...x, stepName: e.target.value } : x))}
                      className="flex-1"
                    />
                    <Select
                      value={step.approverRole}
                      onValueChange={v => setTmplSteps(s => s.map((x, j) => j === i ? { ...x, approverRole: v ?? 'GM' } : x))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {tmplSteps.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setTmplSteps(s => s.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTmplDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleSaveTemplate} disabled={saving || !tmplForm.name}>{dict.common.save}範本</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
