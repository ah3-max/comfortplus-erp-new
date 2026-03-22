'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

const statusConfig: Record<
  QuotationStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
    className?: string
  }
> = {
  DRAFT:             { label: '草稿',      variant: 'outline' },
  PENDING_APPROVAL:  { label: '待審批',    variant: 'secondary', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  APPROVED:          { label: '已核准',    variant: 'default',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  SENT:              { label: '已送出',    variant: 'secondary' },
  CUSTOMER_REVIEWING:{ label: '客戶確認中', variant: 'secondary', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  ACCEPTED:          { label: '已接受',    variant: 'default',   className: 'bg-green-100 text-green-700 border-green-200' },
  REJECTED:          { label: '已拒絕',    variant: 'destructive' },
  EXPIRED:           { label: '已過期',    variant: 'outline',   className: 'text-muted-foreground' },
  CONVERTED:         { label: '已轉訂單',  variant: 'default',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
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

const approvalRoleLabel: Record<string, string> = {
  SALES_MANAGER: '業務主管',
  GM: '總經理',
  SUPER_ADMIN: '超級管理員',
}

function ApprovalPanel({ approvals }: { approvals: ApprovalStep[] }) {
  if (approvals.length === 0) return null

  const triggerReason = approvals[0]?.triggerReason

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">審批流程</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {triggerReason && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              <span className="font-semibold">觸發原因：</span>
              {triggerReason}
            </span>
          </div>
        )}

        <div className="space-y-3">
          {[...approvals]
            .sort((a, b) => a.approvalLevel - b.approvalLevel)
            .map((step, idx, arr) => {
              const isLast = idx === arr.length - 1
              const roleLabel =
                approvalRoleLabel[step.approverRole] ?? step.approverRole

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
                        第 {step.approvalLevel} 關：{roleLabel}核准
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
                        {step.status === 'APPROVED'
                          ? '已核准'
                          : step.status === 'REJECTED'
                            ? '已退回'
                            : step.status === 'SKIPPED'
                              ? '已略過'
                              : '等待中'}
                      </Badge>
                    </div>

                    {step.status === 'PENDING' && (
                      <p className="mt-1 text-xs text-amber-600">
                        等待{roleLabel}核准中...
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
                      <p className="mt-1 text-xs text-slate-400">已略過（前一關退回）</p>
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
      toast.error('找不到此報價單')
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
      toast.success('狀態已更新')
      fetchQuotation()
    } else {
      toast.error('更新狀態失敗')
    }
  }

  async function handleConvert() {
    if (!quotation) return
    if (!confirm(`確定要將報價單 ${quotation.quotationNo} 轉為訂單嗎？`)) return
    setActionLoading(true)
    const res = await fetch(`/api/quotations/${id}/convert`, { method: 'POST' })
    setActionLoading(false)
    if (res.ok) {
      const data = await res.json()
      toast.success(`已建立訂單 ${data.orderNo}`)
      router.push(`/orders/${data.orderId}`)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '轉換失敗')
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
      toast.success('報價單已更新')
      setEditOpen(false)
      fetchQuotation()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '更新失敗')
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
        toast.success('已送審，等待主管核准')
      } else {
        toast.success('報價已直接送出（無需審批）')
      }
      fetchQuotation()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '送審失敗')
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
      toast.success(approveAction === 'APPROVE' ? '已核准' : '已退回')
      setApproveOpen(false)
      setApproveComment('')
      fetchQuotation()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '操作失敗')
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

  const sc = statusConfig[quotation.status] ?? { label: quotation.status, variant: 'outline' as const }
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
            <span className="text-sm text-muted-foreground">← 報價管理</span>
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
                編輯
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
                送審
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
                退回
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
                核准
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
                送出報價
              </Button>
              <Button
                variant="outline"
                onClick={handleConvert}
                disabled={actionLoading}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                轉訂單
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
                標記拒絕
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
                標記接受
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
                編輯
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
                轉為訂單
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
            匯出 PDF
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">客戶名稱</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <p className="font-semibold text-sm leading-tight">{quotation.customer.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{quotation.customer.code}</p>
            {quotation.customer.contactPerson && (
              <p className="text-xs text-muted-foreground">聯絡：{quotation.customer.contactPerson}</p>
            )}
            {quotation.customer.phone && (
              <p className="text-xs text-muted-foreground">{quotation.customer.phone}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">有效期限</CardTitle>
          </CardHeader>
          <CardContent>
            {quotation.validUntil ? (
              <p className={`text-sm font-medium ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>
                {formatDate(quotation.validUntil)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">未設定</p>
            )}
            {isExpired && (
              <p className="text-xs text-red-500 mt-0.5">已過期</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">建立人員</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{quotation.createdBy.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">建立日期</CardTitle>
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
            <CardTitle className="text-base">報價明細</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">序號</TableHead>
                <TableHead>品名</TableHead>
                <TableHead className="w-32">SKU</TableHead>
                <TableHead className="text-center w-20">數量</TableHead>
                <TableHead className="text-center w-16">單位</TableHead>
                <TableHead className="text-right w-28">單價</TableHead>
                <TableHead className="text-right w-20">折扣%</TableHead>
                <TableHead className="text-right w-28">小計</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground text-sm">
                    尚無明細項目
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
                  合計
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
            <CardTitle className="text-base">備註</CardTitle>
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
              <CardTitle className="text-base">關聯訂單</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {relatedOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無關聯訂單</p>
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
                        查看訂單 →
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
            <DialogTitle>編輯報價單</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              如需修改明細，請至列表頁重新建立報價單。
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-valid-until">有效期限</Label>
              <Input
                id="edit-valid-until"
                type="date"
                value={editValidUntil}
                onChange={(e) => setEditValidUntil(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">備註</Label>
              <Textarea
                id="edit-notes"
                rows={4}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="輸入備註..."
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
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Decision Dialog */}
      <Dialog open={approveOpen} onOpenChange={(o) => { if (!o) { setApproveOpen(false); setApproveComment('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {approveAction === 'APPROVE' ? '確認核准' : '退回報價單'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {approveAction === 'REJECT' && (
              <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                退回後報價單狀態將變為「已拒絕」，業務需重新建立報價單。
              </div>
            )}
            <div className="space-y-1.5">
              <Label>審批意見（選填）</Label>
              <Textarea
                rows={3}
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="輸入審批意見..."
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
              取消
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
              {approveAction === 'APPROVE' ? '確認核准' : '確認退回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
