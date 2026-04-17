'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, CheckCircle2, CreditCard, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface ExpenseReport {
  id: string
  reportNo: string
  title: string
  department: string | null
  totalAmount: number
  approvedAt: string | null
  submittedBy: {
    id: string
    name: string
    bankAccountNo: string | null
    bankCode: string | null
    bankAccountName: string | null
  }
  approvedBy: { id: string; name: string } | null
  items: Array<{
    id: string; date: string; category: string
    description: string; amount: number; lineNo: number
  }>
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

export default function FinanceExpensesPage() {
  const [reports, setReports]   = useState<ExpenseReport[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [paying, setPaying]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/expenses/pending-pay?pageSize=100')
      const json = await res.json()
      setReports(json.data ?? [])
    } catch {
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === reports.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(reports.map(r => r.id)))
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // 單筆付款
  async function handlePayOne(id: string) {
    setPaying(true)
    try {
      const res = await fetch(`/api/expenses/${id}/pay`, { method: 'POST' })
      if (res.ok) { toast.success('已標記付款'); load(); setSelected(prev => { const n = new Set(prev); n.delete(id); return n }) }
      else { const d = await res.json(); toast.error(d.error ?? '付款失敗') }
    } finally {
      setPaying(false)
    }
  }

  // 批次付款
  async function handleBatchPay() {
    if (selected.size === 0) { toast.error('請先勾選請款單'); return }
    if (!confirm(`確定批次標記 ${selected.size} 筆為已付款？`)) return
    setPaying(true)
    let success = 0
    let fail = 0
    for (const id of selected) {
      const res = await fetch(`/api/expenses/${id}/pay`, { method: 'POST' })
      res.ok ? success++ : fail++
    }
    setPaying(false)
    toast.success(`完成：${success} 筆付款成功${fail > 0 ? `，${fail} 筆失敗` : ''}`)
    setSelected(new Set())
    load()
  }

  const totalSelected = reports
    .filter(r => selected.has(r.id))
    .reduce((s, r) => s + Number(r.totalAmount), 0)

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">費用請款出納付款</h1>
          <p className="text-sm text-slate-500 mt-0.5">已核准、待出納付款的費用請款單</p>
        </div>
        <Badge className="bg-orange-100 text-orange-700 text-sm px-3 py-1">
          {reports.length} 筆待付
        </Badge>
      </div>

      {/* Stats */}
      {reports.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">待付筆數</div>
              <div className="text-2xl font-bold text-orange-600">{reports.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">待付總金額</div>
              <div className="text-2xl font-bold text-slate-800">
                {fmt(reports.reduce((s, r) => s + Number(r.totalAmount), 0))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <span className="text-sm text-blue-700">
            已選 <strong>{selected.size}</strong> 筆，合計 <strong>{fmt(totalSelected)}</strong> 元
          </span>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 gap-1.5"
            disabled={paying}
            onClick={handleBatchPay}
          >
            {paying
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CreditCard className="h-4 w-4" />
            }
            批次標記已付款
          </Button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <CheckCircle2 className="h-10 w-10 mb-3 text-green-400" />
          <p>目前沒有待付款的請款單</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === reports.length && reports.length > 0}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-6"></TableHead>
                  <TableHead>單號</TableHead>
                  <TableHead>標題</TableHead>
                  <TableHead>申請人</TableHead>
                  <TableHead>銀行帳號</TableHead>
                  <TableHead>核准日</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map(r => {
                  const isExpanded = expanded.has(r.id)
                  const hasBankInfo = r.submittedBy.bankAccountNo
                  return [
                    <TableRow key={r.id} className="hover:bg-slate-50">
                      <TableCell onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="h-4 w-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell
                        className="cursor-pointer"
                        onClick={() => toggleExpand(r.id)}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-slate-400" />
                          : <ChevronRight className="h-4 w-4 text-slate-400" />
                        }
                      </TableCell>
                      <TableCell className="font-mono text-sm">{r.reportNo}</TableCell>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell>{r.submittedBy.name}</TableCell>
                      <TableCell>
                        {hasBankInfo ? (
                          <div className="text-sm">
                            <div className="font-mono">{r.submittedBy.bankAccountNo}</div>
                            <div className="text-xs text-slate-400">
                              {r.submittedBy.bankCode} · {r.submittedBy.bankAccountName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">未設定</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {r.approvedAt
                          ? new Date(r.approvedAt).toLocaleDateString('zh-TW')
                          : '—'
                        }
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {fmt(Number(r.totalAmount))}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={paying}
                          onClick={() => handlePayOne(r.id)}
                        >
                          標記已付
                        </Button>
                      </TableCell>
                    </TableRow>,
                    isExpanded && (
                      <TableRow key={`${r.id}-detail`} className="bg-slate-50">
                        <TableCell colSpan={9} className="py-0">
                          <div className="py-3 px-6 space-y-1">
                            {r.approvedBy && (
                              <p className="text-xs text-slate-400 mb-2">
                                核准人：{r.approvedBy.name}
                              </p>
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
                                <span className="font-mono">{fmt(item.amount)}</span>
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
    </div>
  )
}
