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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { dict } = useI18n()
  const ap = dict.approvalsPage
  const MODULE_LABELS = ap.moduleLabels as Record<string, string>

  const approvalStatuses = dict.approvals.statuses as Record<string, string>
  const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    PENDING:   { label: approvalStatuses.PENDING ?? '',   variant: 'secondary',    icon: <Clock className="h-3 w-3" /> },
    APPROVED:  { label: approvalStatuses.APPROVED ?? '',  variant: 'default',      icon: <CheckCircle2 className="h-3 w-3" /> },
    REJECTED:  { label: approvalStatuses.REJECTED ?? '',  variant: 'destructive',  icon: <XCircle className="h-3 w-3" /> },
    CANCELLED: { label: approvalStatuses.CANCELLED ?? '', variant: 'outline',      icon: <AlertTriangle className="h-3 w-3" /> },
  }

  const ROLE_LABELS = (dict.orgChart?.roles ?? {}) as Record<string, string>

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
  const [tmplSteps, setTmplSteps] = useState<TemplateStep[]>([{ stepName: '', approverRole: 'GM', isOptional: false }])
  const [saving, setSaving] = useState(false)

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
      toast.error(ap.subjectRequired)
      return
    }
    const selectedTemplate = newReqTemplates.find(t => t.id === newReqForm.templateId)
    const module = selectedTemplate?.module ?? 'CUSTOM'
    const noteParts: string[] = []
    if (newReqForm.description.trim()) noteParts.push(newReqForm.description.trim())
    if (newReqForm.refDoc.trim()) noteParts.push(`${ap.refDocPrefix}${newReqForm.refDoc.trim()}`)
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
        toast.success(ap.submitted)
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
    if (!confirm(ap.cancelConfirm)) return
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
    setTmplSteps([{ stepName: '', approverRole: 'GM', isOptional: false }])
    fetchTemplates()
  }

  function openDetail(req: ApprovalRequest) { setDetail(req) }

  // ── Render ────────────────────────────────────────────────────────────────

  const RequestRow = ({ req }: { req: ApprovalRequest }) => {
    const cfg = STATUS_CONFIG[req.status] ?? { label: req.status, variant: 'outline' as const, icon: null }
    return (
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
          <p className="text-xs text-muted-foreground">{ap.requestedByLabel}{req.requestedBy.name} · {new Date(req.requestedAt).toLocaleDateString('zh-TW')}</p>
        </div>
        <div className="ml-3 shrink-0">
          <Badge variant={cfg.variant} className="flex items-center gap-1">
            {cfg.icon}{cfg.label}
          </Badge>
        </div>
      </div>
    )
  }

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
          <TabsTrigger value="inbox">{ap.tabInbox}</TabsTrigger>
          <TabsTrigger value="mine">{ap.tabMine}</TabsTrigger>
          <TabsTrigger value="all">{ap.tabAll}</TabsTrigger>
          <TabsTrigger value="templates">{ap.tabTemplates}</TabsTrigger>
        </TabsList>

        {/* ── Filters ── */}
        {tab !== 'templates' && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? '')}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue placeholder={dict.common.all + (dict.common.status ?? '')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{dict.common.all}{dict.common.status ?? ''}</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={moduleFilter} onValueChange={v => setModuleFilter(v ?? '')}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue placeholder={ap.allModules} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{ap.allModules}</SelectItem>
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
              <CardTitle className="text-base">{ap.templatesMgmtTitle}</CardTitle>
              <Button size="sm" onClick={() => setTmplDialog(true)}>
                <Plus className="mr-1 h-4 w-4" />{ap.createTemplate}
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
                          {!t.isActive && <Badge variant="secondary" className="ml-1 text-xs">{ap.disabledBadge}</Badge>}
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
                {(() => {
                  const cfg = STATUS_CONFIG[detail.status] ?? { label: detail.status, variant: 'outline' as const, icon: null }
                  return (
                    <Badge variant={cfg.variant} className="flex items-center gap-1">
                      {cfg.icon}{cfg.label}
                    </Badge>
                  )
                })()}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">{ap.moduleLabel}</span>{MODULE_LABELS[detail.module] ?? detail.module}</div>
                <div><span className="text-muted-foreground">{ap.docLabel}</span>{detail.entityLabel}</div>
                <div><span className="text-muted-foreground">{ap.requestedByLabel}</span>{detail.requestedBy.name}</div>
                <div><span className="text-muted-foreground">{ap.requestedAtLabel}</span>{new Date(detail.requestedAt).toLocaleString('zh-TW')}</div>
              </div>
              {detail.notes && (
                <p className="rounded bg-muted/40 p-2 text-sm">{detail.notes}</p>
              )}

              {/* Steps timeline */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">{ap.stepsTitle}</p>
                {detail.steps.map(step => (
                  <div key={step.id} className={`flex items-start gap-3 rounded-lg border p-2 ${step.stepOrder === detail.currentStep && detail.status === 'PENDING' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                    <div className="mt-0.5 shrink-0">
                      {step.status === 'APPROVED' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                       step.status === 'REJECTED' ? <XCircle className="h-4 w-4 text-red-500" /> :
                       <Clock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{step.stepOrder}. {step.stepName}</p>
                      {step.approver && <p className="text-xs text-muted-foreground">{ap.approverLabel}{step.approver.name}</p>}
                      {step.comment && <p className="mt-1 text-xs italic text-muted-foreground">{ap.commentLabel}{step.comment}</p>}
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
                    <XCircle className="mr-1 h-4 w-4" />{ap.rejectBtn}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setActionDialog({ open: true, requestId: detail.id, action: 'APPROVE' }); setDetail(null) }}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />{ap.approveBtn}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleCancel(detail.id)}>{ap.cancelRequestBtn}</Button>
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
            <DialogTitle>
              {actionDialog.action === 'APPROVE'
                ? `${dict.common.approve ?? ''}${ap.approveSuffix}`
                : `${dict.common.reject ?? ''}${ap.rejectSuffix}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{ap.commentLabel2}</Label>
              <Textarea
                placeholder={ap.commentPlaceholder}
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
              {dict.common.confirm}{actionDialog.action === 'APPROVE' ? (dict.common.approve ?? '') : (dict.common.reject ?? '')}
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
              <Label>{ap.newReqTemplateLabel}</Label>
              <Select
                value={newReqForm.templateId}
                onValueChange={v => setNewReqForm(f => ({ ...f, templateId: (!v || v === '__none__') ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ap.noTemplatePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{ap.noTemplate}</SelectItem>
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
              <Label>{ap.subjectStar}</Label>
              <Input
                placeholder={ap.subjectPlaceholder}
                value={newReqForm.subject}
                onChange={e => setNewReqForm(f => ({ ...f, subject: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>{ap.descLabel}</Label>
              <Textarea
                placeholder={ap.descPlaceholder}
                value={newReqForm.description}
                onChange={e => setNewReqForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Reference doc */}
            <div className="space-y-1.5">
              <Label>{ap.refDocLabel}</Label>
              <Input
                placeholder={ap.refDocPlaceholder}
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
              {ap.submitBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Template Dialog ── */}
      <Dialog open={tmplDialog} onOpenChange={setTmplDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{ap.createTemplate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ap.tmplNameLabel}</Label>
                <Input value={tmplForm.name} onChange={e => setTmplForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{ap.tmplModuleLabel}</Label>
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
              <Label>{ap.tmplDescLabel}</Label>
              <Input value={tmplForm.description} onChange={e => setTmplForm(f => ({ ...f, description: e.target.value }))} className="mt-1" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>{ap.tmplStepsLabel}</Label>
                <Button variant="ghost" size="sm" onClick={() => setTmplSteps(s => [...s, { stepName: '', approverRole: 'GM', isOptional: false }])}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {tmplSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <Input
                      placeholder={ap.tmplStepNamePlaceholder}
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
            <Button onClick={handleSaveTemplate} disabled={saving || !tmplForm.name}>{ap.saveTmplBtn}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
