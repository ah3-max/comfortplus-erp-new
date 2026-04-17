'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface ExpenseItem {
  id: string
  date: string
  category: string
  description: string
  amount: number
  receiptUrl: string | null
  lineNo: number
}

interface ExpenseReport {
  id: string
  reportNo: string
  title: string
  department: string | null
  status: string
  totalAmount: number
  notes: string | null
  submittedAt: string | null
  submittedBy: { id: string; name: string }
  items: ExpenseItem[]
}

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: '交通', MEAL: '餐費', HOTEL: '住宿',
  OFFICE: '辦公用品', ENTERTAINMENT: '業務招待',
  TRAINING: '教育訓練', OTHER: '其他',
}

function fmt(n: number) {
  return Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function ExpensesPendingPage() {
  const [reports, setReports]       = useState<ExpenseReport[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [acting, setActing]         = useState<string | null>(null)

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/expenses?status=SUBMITTED&pageSize=100')
      const json = await res.json()
      setReports(json.data ?? [])
    } catch {
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleApprove(id: string) {
    setActing(id)
    try {
      const res = await fetch(`/api/expenses/${id}/approve`, { method: 'POST' })
      if (res.ok) { toast.success('已核准'); load() }
      else { const d = await res.json(); toast.error(d.error ?? '核准失敗') }
    } finally {
      setActing(null)
    }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget || !rejectReason.trim()) {
      toast.error('請填寫退回原因')
      return
    }
    setRejecting(true)
    try {
      const res = await fetch(`/api/expenses/${rejectTarget}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (res.ok) {
        toast.success('已退回')
        setRejectTarget(null)
        setRejectReason('')
        load()
      } else {
        const d = await res.json()
        toast.error(d.error ?? '退回失敗')
      }
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">待審核費用請款</h1>
          <p className="text-sm text-slate-500 mt-0.5">審核員工提交的費用請款單</p>
        </div>
        <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
          {reports.length} 筆待審
        </Badge>
      </div>

      {/* Stats */}
      {reports.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">待審筆數</div>
              <div className="text-2xl font-bold text-blue-600">{reports.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">待審總金額</div>
              <div className="text-2xl font-bold text-slate-800">
                {fmt(reports.reduce((s, r) => s + Number(r.totalAmount), 0))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <CheckCircle2 className="h-10 w-10 mb-3 text-green-400" />
          <p>目前沒有待審核的請款單</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6"></TableHead>
                  <TableHead>單號</TableHead>
                  <TableHead>標題</TableHead>
                  <TableHead>申請人</TableHead>
                  <TableHead>部門</TableHead>
                  <TableHead>提交日期</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead className="text-right w-40">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map(r => {
                  const isExpanded = expanded.has(r.id)
                  return [
                    <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => toggleExpand(r.id)}>
                      <TableCell>
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-slate-400" />
                          : <ChevronRight className="h-4 w-4 text-slate-400" />
                        }
                      </TableCell>
                      <TableCell className="font-mono text-sm">{r.reportNo}</TableCell>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell>{r.submittedBy.name}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{r.department ?? '—'}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('zh-TW') : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {fmt(Number(r.totalAmount))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            disabled={acting === r.id}
                            onClick={() => { setRejectTarget(r.id); setRejectReason('') }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />退回
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            disabled={acting === r.id}
                            onClick={() => handleApprove(r.id)}
                          >
                            {acting === r.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            }
                            核准
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>,
                    isExpanded && (
                      <TableRow key={`${r.id}-detail`} className="bg-slate-50">
                        <TableCell colSpan={8} className="py-0">
                          <div className="py-3 px-4 space-y-1">
                            {r.notes && (
                              <p className="text-xs text-slate-500 mb-2">備註：{r.notes}</p>
                            )}
                            {r.items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                                <div className="flex items-center gap-3">
                                  <span className="text-slate-400 text-xs w-20">{item.date.split('T')[0]}</span>
                                  <Badge className="bg-slate-100 text-slate-600 text-xs">
                                    {CATEGORY_LABELS[item.category] ?? item.category}
                                  </Badge>
                                  <span>{item.description}</span>
                                </div>
                                <span className="font-mono font-medium">{fmt(item.amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-end pt-1">
                              <span className="text-sm font-semibold text-slate-700">
                                合計：<span className="text-blue-600">{fmt(Number(r.totalAmount))}</span>
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  ]
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={open => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>退回請款單</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>退回原因 <span className="text-red-500">*</span></Label>
            <Input
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="請填寫退回原因"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>取消</Button>
            <Button
              variant="destructive"
              disabled={rejecting || !rejectReason.trim()}
              onClick={handleRejectConfirm}
            >
              {rejecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              確認退回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
