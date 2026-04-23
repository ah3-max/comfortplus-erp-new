'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2, Clock, FileText, Send, Save, Loader2,
  Phone, MapPin, ShoppingCart, FileSearch, Users, RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface Attachment {
  url: string
  fileName: string
  mimeType?: string
  size?: number
  uploadedAt?: string
}

interface DailyReport {
  id: string | null
  reportDate: string
  visitCount: number
  callCount: number
  orderCount: number
  orderAmount: number
  newCustomerCount: number
  quoteCount: number
  highlights: string
  obstacles: string
  tomorrowPlan: string
  needsHelp: string
  attachments?: Attachment[] | null
  status: string
  submittedAt: string | null
  managerComment: string | null
  reviewedBy: { name: string } | null
  reviewedAt: string | null
}

export default function SalesDailyReportPage() {
  const { dict } = useI18n()
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    visitCount: '0', callCount: '0', orderCount: '0', orderAmount: '0',
    newCustomerCount: '0', quoteCount: '0',
    highlights: '', obstacles: '', tomorrowPlan: '', needsHelp: '',
  })
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [aiDrafting, setAiDrafting] = useState(false)

  const loadToday = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/sales-daily-report/today')
    if (res.ok) {
      const data: DailyReport = await res.json()
      setReport(data)
      setForm({
        visitCount:       String(data.visitCount),
        callCount:        String(data.callCount),
        orderCount:       String(data.orderCount),
        orderAmount:      String(data.orderAmount),
        newCustomerCount: String(data.newCustomerCount),
        quoteCount:       String(data.quoteCount),
        highlights:       data.highlights ?? '',
        obstacles:        data.obstacles ?? '',
        tomorrowPlan:     data.tomorrowPlan ?? '',
        needsHelp:        data.needsHelp ?? '',
      })
      setAttachments(Array.isArray(data.attachments) ? data.attachments : [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadToday() }, [loadToday])

  async function handleSave(submit = false) {
    setSaving(true)
    const res = await fetch('/api/sales-daily-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, attachments, submit }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(submit ? dict.salesDailyReport.submitted : dict.salesDailyReport.draftSaved)
      loadToday()
    } else {
      toast.error(dict.common.saveFailed)
    }
  }

  async function handleQuickSubmit() {
    if (!confirm('一鍵送出今日報表？\n系統會自動抓取今日拜訪/通話/訂單/報價數據，無需填寫文字。')) return
    setSaving(true)
    const res = await fetch('/api/sales-daily-report/quick-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachments }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      const s = data.summary
      toast.success(`今日報表已送出：拜訪 ${s.visits} / 通話 ${s.calls} / 訂單 ${s.orders} / 報價 ${s.quotes}`)
      loadToday()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? dict.common.saveFailed)
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const uploaded: Attachment[] = []
    for (const file of Array.from(files)) {
      const type = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('audio/') ? 'audio'
        : 'document'
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          uploaded.push({
            url: data.url,
            fileName: data.fileName,
            mimeType: data.mimeType,
            size: data.size,
            uploadedAt: new Date().toISOString(),
          })
        } else {
          const err = await res.json().catch(() => ({}))
          toast.error(`${file.name}：${err.error ?? '上傳失敗'}`)
        }
      } catch {
        toast.error(`${file.name} 上傳失敗`)
      }
    }
    setAttachments(prev => [...prev, ...uploaded])
    setUploading(false)
    if (uploaded.length > 0) toast.success(`已上傳 ${uploaded.length} 個檔案`)
  }

  async function handleAiDraft() {
    setAiDrafting(true)
    try {
      const res = await fetch('/api/sales-daily-report/ai-draft', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'AI 草稿產生失敗')
        return
      }
      const draft = await res.json() as { highlights: string; obstacles: string; tomorrowPlan: string }
      setForm(f => ({
        ...f,
        highlights: draft.highlights || f.highlights,
        obstacles: draft.obstacles || f.obstacles,
        tomorrowPlan: draft.tomorrowPlan || f.tomorrowPlan,
      }))
      toast.success('AI 已草擬今日重點，你可以再編輯後送出')
    } catch {
      toast.error('AI 草稿產生失敗')
    } finally {
      setAiDrafting(false)
    }
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (report?.status === 'SUBMITTED' || report?.status === 'APPROVED') return
    handleFiles(e.dataTransfer.files)
  }

  const isLocked = report?.status === 'SUBMITTED' || report?.status === 'APPROVED'
  const isNeedsRevision = report?.status === 'NEEDS_REVISION'
  const isApproved = report?.status === 'APPROVED'
  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  // After 5pm show urgency reminder
  const isAfternoon = new Date().getHours() >= 17
  const showReminder = isAfternoon && !isLocked && !isNeedsRevision

  const sdr = dict.salesDailyReport
  const statFields = [
    { key: 'visitCount',       label: sdr.visitCount,       icon: MapPin,       color: 'text-violet-600' },
    { key: 'callCount',        label: sdr.callCount,        icon: Phone,        color: 'text-blue-600' },
    { key: 'orderCount',       label: sdr.orderCount,       icon: ShoppingCart, color: 'text-emerald-600' },
    { key: 'quoteCount',       label: sdr.quoteCount,       icon: FileSearch,   color: 'text-amber-600' },
    { key: 'newCustomerCount', label: sdr.newCustomerCount, icon: Users,        color: 'text-rose-600' },
  ] as const

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />{sdr.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          {isApproved ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />{sdr.approved}
            </Badge>
          ) : report?.status === 'SUBMITTED' ? (
            <Badge className="bg-blue-100 text-blue-700 border-blue-300 gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />{sdr.statusSubmitted}
            </Badge>
          ) : isNeedsRevision ? (
            <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />{sdr.statusNeedsRevision}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500 border-slate-300 gap-1">
              <Clock className="h-3.5 w-3.5" />{sdr.statusDraft}
            </Badge>
          )}
          <Button variant="ghost" size="icon" onClick={loadToday}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick-submit CTA — one click, auto-fill stats */}
      {!isLocked && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
                <Send className="h-4 w-4" />一鍵送出今日報表
              </p>
              <p className="text-xs text-blue-700/80 mt-0.5">
                自動抓取今日拜訪/通話/訂單/報價，不需填寫文字，立刻送出。
              </p>
            </div>
            <Button onClick={handleQuickSubmit} disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 min-h-[44px] px-5">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              一鍵送出
            </Button>
          </CardContent>
        </Card>
      )}

      {/* End-of-day reminder banner */}
      {showReminder && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
          <Clock className="h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800 font-medium">{sdr.reminderBanner}</p>
        </div>
      )}

      {/* NEEDS_REVISION feedback banner */}
      {isNeedsRevision && report?.managerComment && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {sdr.revisionBanner}
          </div>
          <p className="text-sm text-red-800 pl-6">{report.managerComment}</p>
          {report.reviewedBy && (
            <p className="text-xs text-red-500 pl-6">
              — {report.reviewedBy.name}，{report.reviewedAt ? new Date(report.reviewedAt).toLocaleString('zh-TW') : ''}
            </p>
          )}
        </div>
      )}

      {/* APPROVED feedback */}
      {isApproved && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            {sdr.approvedBanner.replace('{name}', report?.reviewedBy?.name ?? '主管')}
            {report?.reviewedAt ? `（${new Date(report.reviewedAt).toLocaleString('zh-TW')}）` : ''}
            {report?.managerComment && `：${report.managerComment}`}
          </span>
        </div>
      )}

      {/* Stats — editable numbers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{sdr.statsTitle}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{sdr.statsHint}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {statFields.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="text-center space-y-1.5">
                <Icon className={`h-5 w-5 mx-auto ${color}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
                <Input
                  type="number"
                  min="0"
                  className="h-9 text-center font-bold text-lg"
                  value={form[key]}
                  disabled={isLocked}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            <Label className="text-xs text-muted-foreground">{sdr.orderAmount}</Label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={form.orderAmount}
              disabled={isLocked}
              onChange={e => setForm(f => ({ ...f, orderAmount: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Qualitative fields */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">{sdr.contentTitle}</CardTitle>
          {!isLocked && (
            <Button size="sm" variant="outline" onClick={handleAiDraft} disabled={aiDrafting}
              className="text-xs h-8 gap-1">
              {aiDrafting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <span>✨</span>}
              AI 草擬
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{sdr.highlightsLabel} <span className="text-muted-foreground text-xs">{sdr.highlightsHint}</span></Label>
            <Textarea
              rows={3}
              placeholder={sdr.highlightsPlaceholder}
              value={form.highlights}
              disabled={isLocked}
              onChange={e => setForm(f => ({ ...f, highlights: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{sdr.obstaclesLabel} <span className="text-muted-foreground text-xs">{sdr.obstaclesOptional}</span></Label>
            <Textarea
              rows={2}
              placeholder={sdr.obstaclesPlaceholder}
              value={form.obstacles}
              disabled={isLocked}
              onChange={e => setForm(f => ({ ...f, obstacles: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{sdr.tomorrowPlanLabel}</Label>
            <Textarea
              rows={3}
              placeholder={sdr.tomorrowPlanPlaceholder}
              value={form.tomorrowPlan}
              disabled={isLocked}
              onChange={e => setForm(f => ({ ...f, tomorrowPlan: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{sdr.needsHelpLabel} <span className="text-muted-foreground text-xs">{sdr.needsHelpOptional}</span></Label>
            <Input
              placeholder={sdr.needsHelpPlaceholder}
              value={form.needsHelp}
              disabled={isLocked}
              onChange={e => setForm(f => ({ ...f, needsHelp: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Attachments — 一次丟整包檔案 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">附件檔案</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isLocked && (
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <p className="text-sm text-muted-foreground mb-2">
                把照片、PDF、Excel 整包拖進來，或點下方按鈕選檔
              </p>
              <input
                type="file"
                multiple
                id="daily-report-files"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button variant="outline" disabled={uploading}
                onClick={() => document.getElementById('daily-report-files')?.click()}>
                {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                選擇檔案（可多選）
              </Button>
            </div>
          )}
          {attachments.length > 0 && (
            <ul className="space-y-1 text-sm">
              {attachments.map((a, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-slate-50 border border-slate-200">
                  <a href={a.url} target="_blank" rel="noreferrer"
                    className="flex-1 min-w-0 truncate text-blue-600 hover:underline">
                    {a.fileName}
                  </a>
                  {typeof a.size === 'number' && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(a.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                  {!isLocked && (
                    <button type="button" onClick={() => removeAttachment(idx)}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0 min-h-[32px] min-w-[32px]">
                      移除
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {attachments.length === 0 && isLocked && (
            <p className="text-sm text-muted-foreground">無附件</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {!isLocked && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {sdr.saveDraft}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isNeedsRevision ? sdr.submitRevision : sdr.submitReport}
          </Button>
        </div>
      )}

      {report?.status === 'SUBMITTED' && report?.submittedAt && (
        <p className="text-center text-sm text-muted-foreground">
          {sdr.submittedAt.replace('{time}', new Date(report.submittedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }))}
        </p>
      )}
    </div>
  )
}
