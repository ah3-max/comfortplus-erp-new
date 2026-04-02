'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, Loader2, MoreHorizontal, Pencil, CheckCircle2, XCircle,
  Wallet, ImageIcon, X,
} from 'lucide-react'
import { toast } from 'sonner'

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface Fund {
  id: string
  name: string
  holderName: string
  holderId: string | null
  department: string | null
  balance: number
  limit: number
  currency: string
  isActive: boolean
}

interface ReceiptPhoto {
  url: string
  label: string
}

interface PettyCashRecord {
  id: string
  recordNo: string
  fundId: string
  date: string
  category: string
  description: string
  amount: number
  vendor: string | null
  receiptNo: string | null
  receiptPhotos: ReceiptPhoto[] | null
  hasReceipt: boolean
  notes: string | null
  status: string
  reviewNote: string | null
  reviewedAt: string | null
  submittedById: string
  fund: { name: string; holderName: string }
  submittedBy: { name: string }
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const ADMIN_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

const CATEGORY_VALUES = ['OIL', 'MEAL', 'TRANSPORT', 'OFFICE', 'MAINTENANCE', 'POSTAGE', 'CLEANING', 'OTHER']

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-700 border-blue-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  REIMBURSED: 'bg-green-100 text-green-700 border-green-200',
}

// Status labels are provided via dict.pettyCash (see getStatusLabel inside component)

// Category labels are provided via dict.pettyCashCategories (see getCategoryLabel inside component)

const CATEGORY_BADGE: Record<string, string> = {
  OIL: 'bg-orange-100 text-orange-700',
  MEAL: 'bg-yellow-100 text-yellow-700',
  TRANSPORT: 'bg-blue-100 text-blue-700',
  OFFICE: 'bg-indigo-100 text-indigo-700',
  MAINTENANCE: 'bg-red-100 text-red-700',
  POSTAGE: 'bg-teal-100 text-teal-700',
  CLEANING: 'bg-cyan-100 text-cyan-700',
  OTHER: 'bg-gray-100 text-gray-600',
}

const fmtAmount = (n: number) =>
  'NT$ ' + Math.round(n).toLocaleString('zh-TW')

const today = () => new Date().toISOString().slice(0, 10)

/* ─── Default form state ─────────────────────────────────────────────────────── */

function defaultForm() {
  return {
    fundId: '',
    date: today(),
    category: 'OTHER',
    description: '',
    amount: '',
    vendor: '',
    receiptNo: '',
    notes: '',
    receiptPhotos: [] as ReceiptPhoto[],
  }
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */

export default function PettyCashPage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const userId = (session?.user as { id?: string })?.id ?? ''
  const isAdmin = ADMIN_ROLES.includes(role)

  const pc = dict.pettyCash
  const catDict = dict.pettyCashCategories
  const getCategoryLabel = (key: string): string => (catDict as Record<string, string>)[key] ?? key
  const getStatusLabel = (key: string): string => {
    const map: Record<string, string> = {
      PENDING: pc.statusPending,
      CONFIRMED: pc.statusConfirmedLabel,
      REJECTED: pc.statusRejectedLabel,
      REIMBURSED: pc.statusReimbursedLabel,
    }
    return map[key] ?? key
  }
  const STATUS_FILTERS = [
    { value: '', label: pc.filterAll },
    { value: 'PENDING', label: pc.filterPending },
    { value: 'CONFIRMED', label: pc.filterConfirmed },
    { value: 'REJECTED', label: pc.filterRejected },
    { value: 'REIMBURSED', label: pc.filterReimbursed },
  ]
  const CATEGORIES_I18N = CATEGORY_VALUES.map(v => ({ value: v, label: getCategoryLabel(v) }))

  /* ── State ── */
  const [funds, setFunds] = useState<Fund[]>([])
  const [records, setRecords] = useState<PettyCashRecord[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 50, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  // filters
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // dialogs
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [editRecord, setEditRecord] = useState<PettyCashRecord | null>(null)
  const [reviewRecord, setReviewRecord] = useState<PettyCashRecord | null>(null)

  // form
  const [form, setForm] = useState(defaultForm())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // review form
  const [reviewForm, setReviewForm] = useState({ status: 'CONFIRMED', reviewNote: '' })
  const [reviewing, setReviewing] = useState(false)

  /* ── My fund balance ── */
  const myFund = funds.find(f => f.holderId === userId)

  /* ── Fetch funds ── */
  const fetchFunds = useCallback(async () => {
    try {
      const res = await fetch('/api/petty-cash/funds')
      const json = await res.json()
      setFunds(json.data ?? [])
    } catch {
      // silently fail
    }
  }, [])

  /* ── Fetch records ── */
  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (statusFilter) qs.set('status', statusFilter)
      if (categoryFilter) qs.set('category', categoryFilter)
      if (dateFrom) qs.set('dateFrom', dateFrom)
      if (dateTo) qs.set('dateTo', dateTo)
      const res = await fetch(`/api/petty-cash?${qs}`)
      const json = await res.json()
      setRecords(json.data ?? [])
      setPagination(json.pagination ?? { page: 1, pageSize: 50, total: 0, totalPages: 1 })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter, dateFrom, dateTo])

  /* ── Fetch pending count for admins ── */
  const fetchPendingCount = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await fetch('/api/petty-cash?status=PENDING&pageSize=1')
      const json = await res.json()
      setPendingCount(json.pagination?.total ?? 0)
    } catch {
      // silently fail
    }
  }, [isAdmin])

  useEffect(() => {
    fetchFunds()
  }, [fetchFunds])

  useEffect(() => {
    fetchRecords()
    fetchPendingCount()
  }, [fetchRecords, fetchPendingCount])

  /* ── Open new dialog ── */
  function openNewDialog() {
    setForm(defaultForm())
    setShowNewDialog(true)
  }

  /* ── Open edit dialog ── */
  function openEditDialog(rec: PettyCashRecord) {
    setEditRecord(rec)
    setForm({
      fundId: rec.fundId,
      date: rec.date.slice(0, 10),
      category: rec.category,
      description: rec.description,
      amount: String(rec.amount),
      vendor: rec.vendor ?? '',
      receiptNo: rec.receiptNo ?? '',
      notes: rec.notes ?? '',
      receiptPhotos: rec.receiptPhotos ?? [],
    })
    setShowNewDialog(true)
  }

  /* ── Upload receipt photo ── */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'image')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? pc.uploadFailed)
        return
      }
      const d = await res.json()
      setForm(f => ({
        ...f,
        receiptPhotos: [...f.receiptPhotos, { url: d.url, label: file.name }],
      }))
      toast.success(pc.uploadSuccess)
    } catch {
      toast.error(pc.uploadRetry)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removePhoto(idx: number) {
    setForm(f => ({ ...f, receiptPhotos: f.receiptPhotos.filter((_, i) => i !== idx) }))
  }

  /* ── Save record (create or edit) ── */
  async function handleSave() {
    if (!form.fundId) { toast.error(pc.validationNoFund); return }
    if (!form.description) { toast.error(pc.validationNoDesc); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error(pc.validationNoAmount); return }

    setSaving(true)
    const payload = {
      fundId: form.fundId,
      date: form.date,
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      vendor: form.vendor || null,
      receiptNo: form.receiptNo || null,
      notes: form.notes || null,
      receiptPhotos: form.receiptPhotos.length > 0 ? form.receiptPhotos : null,
      hasReceipt: form.receiptPhotos.length > 0 || !!form.receiptNo,
    }

    try {
      let res: Response
      if (editRecord) {
        res = await fetch(`/api/petty-cash/${editRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/petty-cash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        toast.success(editRecord ? pc.updateSuccess : pc.createSuccess)
        setShowNewDialog(false)
        setEditRecord(null)
        fetchRecords()
        fetchFunds()
        fetchPendingCount()
      } else {
        const d = await res.json()
        toast.error(d.error ?? pc.saveFailed)
      }
    } catch {
      toast.error(pc.saveRetry)
    } finally {
      setSaving(false)
    }
  }

  /* ── Finance review ── */
  async function handleReview() {
    if (!reviewRecord) return
    setReviewing(true)
    try {
      const res = await fetch(`/api/petty-cash/${reviewRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reviewForm.status,
          reviewNote: reviewForm.reviewNote || null,
        }),
      })
      if (res.ok) {
        toast.success(pc.reviewSuccess)
        setReviewRecord(null)
        fetchRecords()
        fetchFunds()
        fetchPendingCount()
      } else {
        const d = await res.json()
        toast.error(d.error ?? pc.reviewFailed)
      }
    } catch {
      toast.error(pc.reviewRetry)
    } finally {
      setReviewing(false)
    }
  }

  /* ── Delete record ── */
  async function handleDelete(rec: PettyCashRecord) {
    if (!confirm(pc.deleteConfirm.replace('{recordNo}', rec.recordNo))) return
    try {
      const res = await fetch(`/api/petty-cash/${rec.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(pc.deleteSuccess)
        fetchRecords()
        fetchFunds()
        fetchPendingCount()
      } else {
        const d = await res.json()
        toast.error(d.error ?? pc.deleteFailed)
      }
    } catch {
      toast.error(pc.deleteRetry)
    }
  }

  /* ── Helpers ── */
  const canEdit = (rec: PettyCashRecord) =>
    rec.submittedById === userId && rec.status === 'PENDING'

  /* ─────────────────────────────────────── Render ─────────────────────────────── */

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{pc.title}</h1>
          {myFund ? (
            <p className="text-sm text-muted-foreground mt-0.5">
              <Wallet className="inline h-4 w-4 mr-1 text-blue-500" />
              {myFund.name} {pc.myBalanceLabel}
              <span className="font-semibold text-slate-800">{fmtAmount(myFund.balance)}</span>
              　{pc.myLimitLabel}{fmtAmount(myFund.limit)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{pc.subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && pendingCount > 0 && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-300 text-sm px-3 py-1 cursor-pointer"
              onClick={() => setStatusFilter('PENDING')}
            >
              {pc.pendingBadge.replace('{n}', String(pendingCount))}
            </Badge>
          )}
          <Button
            className="min-h-[44px]"
            onClick={openNewDialog}
          >
            <Plus className="h-4 w-4 mr-1" />
            {pc.addExpense}
          </Button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Status pills */}
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map(sf => (
                <button
                  key={sf.value}
                  onClick={() => setStatusFilter(sf.value)}
                  className={`min-h-[36px] px-3 rounded-full text-sm font-medium border transition-colors
                    ${statusFilter === sf.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                >
                  {sf.label}
                </button>
              ))}
            </div>

            {/* Category dropdown */}
            <Select value={categoryFilter || 'ALL'} onValueChange={v => { if (v) setCategoryFilter(v === 'ALL' ? '' : v) }}>
              <SelectTrigger className="w-36 min-h-[44px]">
                <SelectValue placeholder={pc.categoryLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{pc.allCategories}</SelectItem>
                {CATEGORIES_I18N.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="w-36 min-h-[44px]"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
              <span className="text-muted-foreground text-sm">—</span>
              <Input
                type="date"
                className="w-36 min-h-[44px]"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Table (desktop) / Card list (mobile) ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p>{pc.noRecords}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-24">{pc.colDate}</TableHead>
                  <TableHead>{pc.colAccount}</TableHead>
                  <TableHead className="w-24">{pc.colCategory}</TableHead>
                  <TableHead>{pc.colDescription}</TableHead>
                  <TableHead className="text-right w-28">{pc.colAmount}</TableHead>
                  <TableHead className="w-20 text-center">{pc.colReceipt}</TableHead>
                  <TableHead className="w-24">{pc.colStatus}</TableHead>
                  <TableHead className="w-20">{pc.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(rec => (
                  <TableRow key={rec.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-sm text-muted-foreground">
                      {rec.date.slice(0, 10)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{rec.fund.name}</div>
                      <div className="text-xs text-muted-foreground">{rec.submittedBy.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${CATEGORY_BADGE[rec.category] ?? ''}`}>
                        {getCategoryLabel(rec.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="max-w-[200px] truncate">{rec.description}</div>
                      {rec.vendor && (
                        <div className="text-xs text-muted-foreground truncate">{rec.vendor}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {fmtAmount(rec.amount)}
                    </TableCell>
                    <TableCell className="text-center text-base">
                      {rec.hasReceipt ? '✅' : '⏳'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATUS_BADGE[rec.status] ?? ''}`}
                      >
                        {getStatusLabel(rec.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit(rec) && (
                            <DropdownMenuItem onClick={() => openEditDialog(rec)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {pc.editAction}
                            </DropdownMenuItem>
                          )}
                          {isAdmin && rec.status === 'PENDING' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setReviewRecord(rec)
                                setReviewForm({ status: 'CONFIRMED', reviewNote: '' })
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              {pc.reviewAction}
                            </DropdownMenuItem>
                          )}
                          {(isAdmin || (rec.submittedById === userId && rec.status === 'PENDING')) && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => handleDelete(rec)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {pc.deleteAction}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {records.map(rec => (
              <Card key={rec.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${CATEGORY_BADGE[rec.category] ?? ''}`}>
                          {getCategoryLabel(rec.category)}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${STATUS_BADGE[rec.status] ?? ''}`}>
                          {getStatusLabel(rec.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{rec.hasReceipt ? pc.hasReceipt : pc.noReceipt}</span>
                      </div>
                      <p className="mt-1 font-medium text-sm truncate">{rec.description}</p>
                      {rec.vendor && <p className="text-xs text-muted-foreground truncate">{rec.vendor}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-base">{fmtAmount(rec.amount)}</div>
                      <div className="text-xs text-muted-foreground">{rec.date.slice(0, 10)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2 mt-2">
                    <span>{rec.fund.name} · {rec.submittedBy.name}</span>
                    <div className="flex gap-1">
                      {canEdit(rec) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => openEditDialog(rec)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {isAdmin && rec.status === 'PENDING' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-blue-600"
                          onClick={() => {
                            setReviewRecord(rec)
                            setReviewForm({ status: 'CONFIRMED', reviewNote: '' })
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination info */}
          <p className="text-sm text-muted-foreground text-center">
            {pagination.totalPages > 1
              ? pc.paginationInfo.replace('{total}', String(pagination.total)).replace('{page}', String(pagination.page)).replace('{totalPages}', String(pagination.totalPages))
              : pc.paginationTotal.replace('{total}', String(pagination.total))}
          </p>
        </>
      )}

      {/* ── New / Edit Record Dialog ── */}
      <Dialog
        open={showNewDialog}
        onOpenChange={open => {
          if (!open) { setShowNewDialog(false); setEditRecord(null) }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRecord ? pc.editDialogTitle : pc.newDialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* 帳戶 */}
            <div className="space-y-1">
              <Label>{pc.accountRequired}</Label>
              <Select
                value={form.fundId}
                onValueChange={v => { if (v) setForm(f => ({ ...f, fundId: v })) }}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder={pc.accountPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {funds.filter(f => f.isActive).map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}（{f.holderName}）— {pc.myBalanceLabel} {fmtAmount(f.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 日期 */}
              <div className="space-y-1">
                <Label>{pc.dateRequired}</Label>
                <Input
                  type="date"
                  className="min-h-[44px]"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>

              {/* 類別 */}
              <div className="space-y-1">
                <Label>{pc.categoryRequired}</Label>
                <Select
                  value={form.category}
                  onValueChange={v => { if (v) setForm(f => ({ ...f, category: v })) }}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES_I18N.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 說明 */}
            <div className="space-y-1">
              <Label>{pc.descriptionRequired}</Label>
              <Textarea
                className="resize-none"
                rows={2}
                placeholder={pc.descriptionPlaceholder}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* 金額 */}
            <div className="space-y-1">
              <Label>{pc.amountRequired}</Label>
              <Input
                type="number"
                min="1"
                step="1"
                className="min-h-[44px]"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 商家 */}
              <div className="space-y-1">
                <Label>{pc.vendorLabel}</Label>
                <Input
                  className="min-h-[44px]"
                  placeholder={pc.vendorPlaceholder}
                  value={form.vendor}
                  onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                />
              </div>

              {/* 發票號碼 */}
              <div className="space-y-1">
                <Label>{pc.receiptNoLabel}</Label>
                <Input
                  className="min-h-[44px]"
                  placeholder={pc.receiptNoPlaceholder}
                  value={form.receiptNo}
                  onChange={e => setForm(f => ({ ...f, receiptNo: e.target.value }))}
                />
              </div>
            </div>

            {/* 備注 */}
            <div className="space-y-1">
              <Label>{pc.notesLabel}</Label>
              <Textarea
                className="resize-none"
                rows={2}
                placeholder={pc.notesPlaceholder}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* 上傳收據照片 */}
            <div className="space-y-2">
              <Label>{pc.receiptPhotosLabel}</Label>

              {/* Thumbnail previews */}
              {form.receiptPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.receiptPhotos.map((photo, idx) => (
                    <div key={idx} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.label}
                        className="h-20 w-20 object-cover rounded-md border"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-[80px] truncate text-center">
                        {photo.label}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? pc.uploadingBtn : pc.uploadPhotoBtn}
                </Button>
                <span className="text-xs text-muted-foreground">{pc.uploadHint}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => { setShowNewDialog(false); setEditRecord(null) }}
            >
              {pc.cancelBtn}
            </Button>
            <Button
              className="min-h-[44px]"
              onClick={handleSave}
              disabled={saving || uploading}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editRecord ? pc.saveChangesBtn : pc.createBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Finance Review Dialog ── */}
      <Dialog open={!!reviewRecord} onOpenChange={open => { if (!open) setReviewRecord(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pc.reviewDialogTitle}</DialogTitle>
          </DialogHeader>

          {reviewRecord && (
            <div className="space-y-4 py-1">
              {/* Record details (readonly) */}
              <div className="rounded-lg bg-slate-50 border p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{pc.reviewField_recordNo}</span>
                  <span className="font-mono">{reviewRecord.recordNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{pc.reviewField_date}</span>
                  <span>{reviewRecord.date.slice(0, 10)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{pc.reviewField_account}</span>
                  <span>{reviewRecord.fund.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{pc.reviewField_submitter}</span>
                  <span>{reviewRecord.submittedBy.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{pc.reviewField_category}</span>
                  <Badge variant="outline" className={`text-xs ${CATEGORY_BADGE[reviewRecord.category] ?? ''}`}>
                    {getCategoryLabel(reviewRecord.category)}
                  </Badge>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground flex-shrink-0">{pc.reviewField_description}</span>
                  <span className="text-right">{reviewRecord.description}</span>
                </div>
                {reviewRecord.vendor && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{pc.reviewField_vendor}</span>
                    <span>{reviewRecord.vendor}</span>
                  </div>
                )}
                {reviewRecord.receiptNo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{pc.reviewField_receiptNo}</span>
                    <span className="font-mono">{reviewRecord.receiptNo}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t pt-2 mt-2">
                  <span className="text-muted-foreground">{pc.reviewField_amount}</span>
                  <span className="font-bold text-base">{fmtAmount(reviewRecord.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{pc.reviewField_receipt}</span>
                  <span>{reviewRecord.hasReceipt ? pc.receiptAttached : pc.receiptMissing}</span>
                </div>
              </div>

              {/* Receipt photo thumbnails */}
              {reviewRecord.receiptPhotos && reviewRecord.receiptPhotos.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{pc.receiptPhotosTitle}</p>
                  <div className="flex flex-wrap gap-2">
                    {reviewRecord.receiptPhotos.map((photo, idx) => (
                      <a key={idx} href={photo.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={photo.label}
                          className="h-16 w-16 object-cover rounded-md border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Review decision */}
              <div className="space-y-1">
                <Label>{pc.reviewResultLabel}</Label>
                <Select
                  value={reviewForm.status}
                  onValueChange={v => { if (v) setReviewForm(f => ({ ...f, status: v })) }}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONFIRMED">{pc.statusConfirmed}</SelectItem>
                    <SelectItem value="REJECTED">{pc.statusRejected}</SelectItem>
                    <SelectItem value="REIMBURSED">{pc.statusReimbursed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Review note */}
              <div className="space-y-1">
                <Label>{pc.reviewNoteLabel}</Label>
                <Textarea
                  className="resize-none"
                  rows={3}
                  placeholder={pc.reviewNotePlaceholder}
                  value={reviewForm.reviewNote}
                  onChange={e => setReviewForm(f => ({ ...f, reviewNote: e.target.value }))}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setReviewRecord(null)}
            >
              {pc.cancelBtn}
            </Button>
            <Button
              className="min-h-[44px]"
              onClick={handleReview}
              disabled={reviewing}
            >
              {reviewing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {pc.submitReviewBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
