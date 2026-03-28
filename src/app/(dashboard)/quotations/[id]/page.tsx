'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  ShoppingCart,
  Pencil,
  Clock,
  AlertTriangle,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'

type QuotationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'CUSTOMER_REVIEWING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED'

const statusVariant: Record<QuotationStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  DRAFT:              { variant: 'outline' },
  PENDING_APPROVAL:   { variant: 'secondary', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  APPROVED:           { variant: 'default',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  SENT:               { variant: 'secondary' },
  CUSTOMER_REVIEWING: { variant: 'secondary', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  ACCEPTED:           { variant: 'default',   className: 'bg-green-100 text-green-700 border-green-200' },
  REJECTED:           { variant: 'destructive' },
  EXPIRED:            { variant: 'outline',   className: 'text-muted-foreground' },
  CONVERTED:          { variant: 'default',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
}

interface QuotationItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  discount: number
  subtotal: number
  product: { sku: string; name: string; unit: string; sellingPrice: string }
}

interface Quotation {
  id: string
  quotationNo: string
  status: QuotationStatus
  totalAmount: string | number
  validUntil: string | null
  notes: string | null
  createdAt: string
  customer: {
    id: string
    name: string
    code: string
    address: string | null
    phone: string | null
    contactPerson: string | null
  }
  createdBy: { name: string }
  items: QuotationItem[]
}

interface RelatedOrder {
  id: string
  orderNo: string
  status: string
  totalAmount: string | number
  createdAt: string
}

interface ApprovalStep {
  id: string
  approvalLevel: number
  approverRole: string
  triggerReason: string | null
  approverId: string | null
  approver: { id: string; name: string; role: string } | null
  status: string // PENDING | APPROVED | REJECTED | SKIPPED
  comment: string | null
  decidedAt: string | null
  createdAt: string
}

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(Number(val))
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateTime(str: string) {
  return new Date(str).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ApprovalPanel({ approvals }: { approvals: ApprovalStep[] }) {
  const { dict } = useI18n()
  const qt = dict.quotations
  type ApSt = keyof typeof qt.approvalStatuses
  type ApRl = keyof typeof qt.approvalRoles

  if (approvals.length === 0) return null

  const triggerReason = approvals[0]?.triggerReason

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{qt.approvalTitle}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {triggerReason && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              <span className="font-semibold">{qt.triggerReasonPrefix}：</span>
              {triggerReason}
            </span>
          </div>
        )}

        <div className="space-y-3">
          {[...approvals]
            .sort((a, b) => a.approvalLevel - b.approvalLevel)
            .map((step, idx, arr) => {
              const isLast = idx === arr.length - 1
              const roleLabel = qt.approvalRoles[step.approverRole as ApRl] ?? step.approverRole

              return (
                <div key={step.id} className="flex gap-3">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                        step.status === 'APPROVED'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : step.status === 'REJECTED'
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : step.status === 'SKIPPED'
                              ? 'border-slate-300 bg-slate-50 text-slate-400'
                              : 'border-amber-400 bg-amber-50 text-amber-600'
                      }`}
                    >
                      {step.status === 'APPROVED' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : step.status === 'REJECTED' ? (
                        <XCircle className="h-4 w-4" />
                      ) : step.status === 'SKIPPED' ? (
                        <span>—</span>
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    {!isLast && (
                      <div className="mt-1 h-full w-px flex-1 bg-slate-200" />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {step.approvalLevel} {qt.approvalStepLabel}：{roleLabel}{qt.approvalApproveAction}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          step.status === 'APPROVED'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : step.status === 'REJECTED'
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : step.status === 'SKIPPED'
                                ? 'border-slate-200 text-slate-400'
                                : 'border-amber-300 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {qt.approvalStatuses[step.status as ApSt] ?? step.status}
                      </Badge>
                    </div>

                    {step.status === 'PENDING' && (
                      <p className="mt-1 text-xs text-amber-600">
                        {qt.waitingForApproval}
                      </p>
                    )}

                    {step.status === 'APPROVED' && step.approver && (
                      <div className="mt-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs">
                        <p className="font-medium text-emerald-700">
                          {step.approver.name}
                        </p>
                        {step.decidedAt && (
                          <p className="text-emerald-600">
                            {formatDateTime(step.decidedAt)}
                          </p>
                        )}
                        {step.comment && (
                          <p className="mt-1 text-emerald-600 italic">
                            {step.comment}
                          </p>
                        )}
                      </div>
                    )}

                    {step.status === 'REJECTED' && step.approver && (
                      <div className="mt-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs">
                        <p className="font-medium text-red-700">
                          {step.approver.name}
                        </p>
                        {step.decidedAt && (
                          <p className="text-red-600">
                            {formatDateTime(step.decidedAt)}
                          </p>
                        )}
                        {step.comment && (
                          <p className="mt-1 text-red-600 italic">
                            {step.comment}
                          </p>
                        )}
                      </div>
                    )}

                    {step.status === 'SKIPPED' && (
                      <p className="mt-1 text-xs text-slate-400">{qt.skippedReason}</p>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { dict } = useI18n()
  const qt = dict.quotations
  type QuotSt = keyof typeof qt.statuses

  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [relatedOrders, setRelatedOrders] = useState<RelatedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editValidUntil, setEditValidUntil] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Approval state
  const [approvals, setApprovals] = useState<ApprovalStep[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [approveOpen, setApproveOpen] = useState(false)
  const [approveAction, setApproveAction] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [approveComment, setApproveComment] = useState('')
  const [approving, setApproving] = useState(false)

  const fetchQuotation = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/quotations/${id}`)
    if (!res.ok) {
      toast.error(qt.notFound)
      router.push('/quotations')
      return
    }
    const data: Quotation = await res.json()
    setQuotation(data)
    setLoading(false)

    // Fetch related orders
    const ordersRes = await fetch(`/api/orders?quotationId=${id}`)
    if (ordersRes.ok) {
      const ordersData = await ordersRes.json()
      setRelatedOrders(Array.isArray(ordersData) ? ordersData : [])
    }

    // Fetch approvals
    const approvalsRes = await fetch(`/api/quotations/${id}/approvals`)
    if (approvalsRes.ok) {
      setApprovals(await approvalsRes.json())
    }

    // Fetch current user info
    const meRes = await fetch('/api/users/me')
    if (meRes.ok) {
      const me = await meRes.json()
      setCurrentUserId(me.id)
      setCurrentUserRole(me.role)
    }
  }, [id, router])

  useEffect(() => {
    fetchQuotation()
  }, [fetchQuotation])

  async function updateStatus(status: QuotationStatus) {
    if (!quotation) return
    setActionLoading(true)
    const res = await fetch(`/api/quotations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusOnly: true, status }),
    })
    setActionLoading(false)
    if (res.ok) {
      toast.success(qt.statusUpdated)
      fetchQuotation()
    } else {
      toast.error(qt.statusUpdateFailed)
    }
  }

  async function handleConvert() {
    if (!quotation) return
    if (!confirm(`${qt.convertConfirmPrefix} ${quotation.quotationNo} ${qt.convertConfirmSuffix}`)) return
    setActionLoading(true)
    const res = await fetch(`/api/quotations/${id}/convert`, { method: 'POST' })
    setActionLoading(false)
    if (res.ok) {
      const data = await res.json()
      toast.success(`${qt.orderCreatedPrefix} ${data.orderNo}`)
      router.push(`/orders/${data.orderId}`)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? qt.convertFailed)
    }
  }

  function openEdit() {
    if (!quotation) return
    setEditValidUntil(
      quotation.validUntil ? quotation.validUntil.substring(0, 10) : ''
    )
    setEditNotes(quotation.notes ?? '')
    setEditOpen(true)
  }

  async function handleSaveEdit() {
    if (!quotation) return
    setSaving(true)
    const res = await fetch(`/api/quotations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        validUntil: editValidUntil ? new Date(editValidUntil).toISOString() : null,
        notes: editNotes || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(qt.updateSuccess)
      setEditOpen(false)
      fetchQuotation()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? dict.common.updateFailed)
    }
  }

  async function handleSubmitForApproval() {
    if (!quotation) return
    setActionLoading(true)
    const res = await fetch(`/api/quotations/${id}/submit`, { method: 'POST' })
    setActionLoading(false)
    if (res.ok) {
      const data = await res.json()
      if (data.requiresApproval) {
        toast.success(qt.submitSuccess)
      } else {
        toast.success(qt.submitDirectSuccess)
      }
      fetchQuotation()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? qt.submitFailed)
    }
  }

  async function handleDecide() {
    if (!quotation) return
    setApproving(true)
    const res = await fetch(`/api/quotations/${id}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: approveAction, comment: approveComment }),
    })
    setApproving(false)
    if (res.ok) {
      toast.success(approveAction === 'APPROVE' ? qt.approveSuccess : qt.rejectSuccess)
      setApproveOpen(false)
      setApproveComment('')
      fetchQuotation()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? qt.approveFailed)
    }
  }

  // Determine if current user can act on the pending approval step
  const pendingStep = approvals.find((a) => a.status === 'PENDING')
  const canActOnApproval =
    pendingStep !== undefined &&
    (pendingStep.approverRole === currentUserRole ||
      currentUserRole === 'SUPER_ADMIN' ||
      currentUserRole === 'GM')

  // Suppress unused variable warning — currentUserId is available for future use
  void currentUserId

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!quotation) return null

  const sv = statusVariant[quotation.status] ?? { variant: 'outline' as const }
  const sc = { label: qt.statuses[quotation.status as QuotSt] ?? quotation.status, ...sv }
  const isExpired =
    quotation.validUntil && new Date(quotation.validUntil) < new Date()

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push('/quotations')}
          className="mt-0.5 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">← {qt.backToList}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <h1 className="text-xl font-bold font-mono tracking-wide">
              {quotation.quotationNo}
            </h1>
            <Badge
              variant={sc.variant}
              className={sc.className}
            >
              {sc.label}
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {/* DRAFT: edit + submit for approval */}
          {quotation.status === 'DRAFT' && (
            <>
              <Button
                variant="outline"
                onClick={openEdit}
                disabled={actionLoading}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {dict.common.edit}
              </Button>
              <Button
                onClick={handleSubmitForApproval}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {dict.purchasesExt.submitForApproval}
              </Button>
            </>
          )}

          {/* PENDING_APPROVAL: approve / reject (only for eligible approvers) */}
          {quotation.status === 'PENDING_APPROVAL' && canActOnApproval && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setApproveAction('REJECT')
                  setApproveOpen(true)
                }}
                disabled={actionLoading}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <XCircle className="mr-2 h-4 w-4" />
                {qt.rejectBtn}
              </Button>
              <Button
                onClick={() => {
                  setApproveAction('APPROVE')
                  setApproveOpen(true)
                }}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {qt.approveBtn}
              </Button>
            </>
          )}

          {/* APPROVED: send quotation or convert to order */}
          {quotation.status === 'APPROVED' && (
            <>
              <Button
                onClick={() => updateStatus('SENT')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {qt.sendQuotation}
              </Button>
              <Button
                variant="outline"
                onClick={handleConvert}
                disabled={actionLoading}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {qt.convertToOrderBtn}
              </Button>
            </>
          )}

          {quotation.status === 'SENT' && (
            <>
              <Button
                variant="outline"
                onClick={() => updateStatus('REJECTED')}
                disabled={actionLoading}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                {qt.markRejected}
              </Button>
              <Button
                onClick={() => updateStatus('ACCEPTED')}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {dict.common.approve}
              </Button>
            </>
          )}

          {quotation.status === 'ACCEPTED' && (
            <>
              <Button
                variant="outline"
                onClick={openEdit}
                disabled={actionLoading}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {dict.common.edit}
              </Button>
              <Button
                onClick={handleConvert}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="mr-2 h-4 w-4" />
                )}
                {dict.quotations.convertToOrder}
              </Button>
            </>
          )}

          {/* PDF Export — always available */}
          <Button
            variant="outline"
            onClick={() => {
              window.open(`/api/quotations/${quotation.id}/export`, '_blank')
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            {qt.exportPdf}
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{dict.quotations.customer}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <p className="font-semibold text-sm leading-tight">{quotation.customer.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{quotation.customer.code}</p>
            {quotation.customer.contactPerson && (
              <p className="text-xs text-muted-foreground">{qt.contactPrefix}：{quotation.customer.contactPerson}</p>
            )}
            {quotation.customer.phone && (
              <p className="text-xs text-muted-foreground">{quotation.customer.phone}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{dict.quotations.validUntil}</CardTitle>
          </CardHeader>
          <CardContent>
            {quotation.validUntil ? (
              <p className={`text-sm font-medium ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>
                {formatDate(quotation.validUntil)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{qt.notSet}</p>
            )}
            {isExpired && (
              <p className="text-xs text-red-500 mt-0.5">{qt.statuses.EXPIRED}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{dict.common.createdBy}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{quotation.createdBy.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{dict.common.createdAt}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{formatDate(quotation.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Approval Panel — between info cards and items table */}
      {(approvals.length > 0 || quotation.status === 'PENDING_APPROVAL') && (
        <ApprovalPanel approvals={approvals} />
      )}

      {/* Items Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{dict.common.detail}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">序號</TableHead>
                <TableHead>{dict.products.name}</TableHead>
                <TableHead className="w-32">{dict.products.sku}</TableHead>
                <TableHead className="text-center w-20">{dict.common.quantity}</TableHead>
                <TableHead className="text-center w-16">{dict.common.unit}</TableHead>
                <TableHead className="text-right w-28">{dict.common.price}</TableHead>
                <TableHead className="text-right w-20">{qt.discountHeader}</TableHead>
                <TableHead className="text-right w-28">{qt.subtotalHeader}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground text-sm">
                    {qt.noItems}
                  </TableCell>
                </TableRow>
              ) : (
                quotation.items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{item.product.name}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.product.sku}
                    </TableCell>
                    <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {item.product.unit}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {Number(item.discount) > 0 ? `${item.discount}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(item.subtotal)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <tfoot>
              <tr className="border-t bg-slate-50">
                <td colSpan={7} className="px-4 py-3 text-right text-sm font-semibold">
                  {dict.common.total}
                </td>
                <td className="px-4 py-3 text-right font-bold text-base">
                  {formatCurrency(quotation.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {quotation.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{dict.common.notes}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Related Orders */}
      {(quotation.status === 'CONVERTED' || relatedOrders.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">{qt.relatedOrders}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {relatedOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{dict.common.noRecords}</p>
            ) : (
              <div className="space-y-2">
                {relatedOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border bg-slate-50 px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium text-blue-600">
                        {order.orderNo}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{formatCurrency(order.totalAmount)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/orders/${order.id}`)}
                        className="h-7 px-2 text-xs"
                      >
                        {qt.viewOrder} →
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dict.common.edit}{dict.quotations.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {qt.editHint}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-valid-until">{qt.validUntil}</Label>
              <Input
                id="edit-valid-until"
                type="date"
                value={editValidUntil}
                onChange={(e) => setEditValidUntil(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">{dict.common.notes}</Label>
              <Textarea
                id="edit-notes"
                rows={4}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              {dict.common.cancel}
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dict.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Decision Dialog */}
      <Dialog open={approveOpen} onOpenChange={(o) => { if (!o) { setApproveOpen(false); setApproveComment('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {approveAction === 'APPROVE' ? qt.approveDialogTitle : qt.rejectDialogTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {approveAction === 'REJECT' && (
              <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {qt.rejectWarning}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{qt.approvalComment}</Label>
              <Textarea
                rows={3}
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setApproveOpen(false); setApproveComment('') }}
              disabled={approving}
            >
              {dict.common.cancel}
            </Button>
            <Button
              onClick={handleDecide}
              disabled={approving}
              className={
                approveAction === 'APPROVE'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }
            >
              {approving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {approveAction === 'APPROVE' ? qt.confirmApprove : qt.confirmReject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
