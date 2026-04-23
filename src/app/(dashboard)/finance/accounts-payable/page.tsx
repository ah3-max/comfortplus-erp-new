'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Loader2, Search, DollarSign, AlertTriangle, Clock, FileCheck,
  ChevronLeft, ChevronRight, Eye, CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'

/* ── Types ── */
interface APRecord {
  id: string
  invoiceNo: string | null
  invoiceDate: string | null
  dueDate: string | null
  amount: number
  paidAmount: number
  balance: number
  status: string
  currency: string
  apCategory: string | null
  notes: string | null
  supplier: { id: string; name: string; code: string | null }
  purchaseOrder: { id: string; poNo: string } | null
}

interface APDetail extends APRecord {
  disbursements: Array<{
    id: string; paymentDate: string; paymentMethod: string | null
    amount: number; currency: string; exchangeRate: number | null
    bankInfo: string | null; notes: string | null
  }>
  settlementItems: Array<{
    id: string; amount: number
    batch: { batchNo: string; paymentDate: string; paymentMethod: string | null; status: string; createdBy: { name: string } | null }
  }>
}

interface Summary {
  totalOutstanding: number
  totalOverdue: number
  overdueCount: number
  unpaidCount: number
}

/* ── Helpers ── */
const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('zh-TW') : '—'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  NOT_DUE:      { label: '未到期', className: 'bg-green-100 text-green-700' },
  DUE:          { label: '已到期', className: 'bg-orange-100 text-orange-700' },
  PARTIAL_PAID: { label: '部分付款', className: 'bg-blue-100 text-blue-700' },
  PAID:         { label: '已付清', className: 'bg-slate-100 text-slate-600' },
}

/* ── Page ── */
export default function AccountsPayablePage() {
  const router = useRouter()

  const [data, setData] = useState<APRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)

  // Detail dialog
  const [detail, setDetail] = useState<APDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '30',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(overdueOnly && { overdue: 'true' }),
      })
      const res = await fetch(`/api/finance/accounts-payable?${params}`)
      const json = await res.json()
      setData(json.data ?? [])
      setSummary(json.summary ?? null)
      setTotalPages(json.pagination?.totalPages ?? 1)
      setTotal(json.pagination?.total ?? 0)
    } catch {
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, overdueOnly])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Search debounce ── */
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  /* ── Detail ── */
  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/finance/accounts-payable/${id}`)
      const json = await res.json()
      setDetail(json)
    } catch {
      toast.error('載入詳情失敗')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">應付帳款管理</h1>

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" /> 未付總額
              </div>
              <p className="text-2xl font-bold">{fmt(summary.totalOutstanding)}</p>
              <p className="text-xs text-muted-foreground">{summary.unpaidCount} 筆未結</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" /> 逾期金額
              </div>
              <p className="text-2xl font-bold text-red-600">{fmt(summary.totalOverdue)}</p>
              <p className="text-xs text-muted-foreground">{summary.overdueCount} 筆逾期</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" /> 逾期比率
              </div>
              <p className="text-2xl font-bold">
                {summary.totalOutstanding > 0
                  ? `${((summary.totalOverdue / summary.totalOutstanding) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileCheck className="h-4 w-4" /> 快速沖帳
              </div>
              <Button variant="outline" className="mt-1 w-full" onClick={() => router.push('/finance/settlement')}>
                前往沖帳作業
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs mb-1 block">搜尋</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="供應商名稱/代碼/發票號/採購單號..."
                  value={searchInput} onChange={e => setSearchInput(e.target.value)} />
              </div>
            </div>
            <div className="w-[140px]">
              <Label className="text-xs mb-1 block">狀態</Label>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(!v || v === 'ALL' ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部</SelectItem>
                  <SelectItem value="NOT_DUE">未到期</SelectItem>
                  <SelectItem value="DUE">已到期</SelectItem>
                  <SelectItem value="PARTIAL_PAID">部分付款</SelectItem>
                  <SelectItem value="PAID">已付清</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant={overdueOnly ? 'default' : 'outline'} size="sm"
              onClick={() => { setOverdueOnly(!overdueOnly); setPage(1) }}
              className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              只看逾期
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            應付明細
            <Badge variant="outline">{total} 筆</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-16"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : data.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">無資料</div>
          ) : (
            <>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>供應商</TableHead>
                      <TableHead>單號</TableHead>
                      <TableHead>到期日</TableHead>
                      <TableHead className="text-right">應付金額</TableHead>
                      <TableHead className="text-right">已付金額</TableHead>
                      <TableHead className="text-right">餘額</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="w-[80px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map(r => {
                      const st = STATUS_MAP[r.status] ?? { label: r.status, className: 'bg-gray-100' }
                      const isOverdue = r.dueDate && new Date(r.dueDate) < new Date() && r.status !== 'PAID'
                      return (
                        <TableRow key={r.id} className={isOverdue ? 'bg-red-50/40' : ''}>
                          <TableCell>
                            <div className="font-medium text-sm">{r.supplier.name}</div>
                            <div className="text-xs text-muted-foreground">{r.supplier.code ?? ''}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.purchaseOrder?.poNo ?? r.invoiceNo ?? r.id.slice(0, 8)}
                          </TableCell>
                          <TableCell className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                            {fmtDate(r.dueDate)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(r.amount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(r.paidAmount)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{fmt(r.balance)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={st.className}>{st.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => openDetail(r.id)} title="檢視詳情">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  第 {page}/{totalPages} 頁，共 {total} 筆
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>應付帳款詳情</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.supplier.name} — ${detail.invoiceNo ?? detail.purchaseOrder?.poNo ?? ''}` : '載入中...'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : detail ? (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">供應商：</span>{detail.supplier.name} ({detail.supplier.code})</div>
                <div><span className="text-muted-foreground">採購單：</span>{detail.purchaseOrder?.poNo ?? '—'}</div>
                <div><span className="text-muted-foreground">發票號：</span>{detail.invoiceNo ?? '—'}</div>
                <div><span className="text-muted-foreground">到期日：</span>{fmtDate(detail.dueDate)}</div>
                <div><span className="text-muted-foreground">應付：</span><span className="font-semibold">{fmt(detail.amount)}</span></div>
                <div><span className="text-muted-foreground">已付：</span>{fmt(detail.paidAmount)}</div>
                <div><span className="text-muted-foreground">餘額：</span><span className="font-bold text-lg">{fmt(detail.balance)}</span></div>
                <div><span className="text-muted-foreground">狀態：</span>
                  <Badge variant="secondary" className={STATUS_MAP[detail.status]?.className}>
                    {STATUS_MAP[detail.status]?.label ?? detail.status}
                  </Badge>
                </div>
                {detail.currency !== 'TWD' && (
                  <div><span className="text-muted-foreground">幣別：</span>{detail.currency}</div>
                )}
              </div>

              {/* Payment History */}
              {detail.disbursements.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4" /> 付款記錄 ({detail.disbursements.length})
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 text-xs">
                          <TableHead>日期</TableHead>
                          <TableHead>方式</TableHead>
                          <TableHead className="text-right">金額</TableHead>
                          <TableHead>備註</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.disbursements.map(d => (
                          <TableRow key={d.id} className="text-sm">
                            <TableCell>{fmtDate(d.paymentDate)}</TableCell>
                            <TableCell>{d.paymentMethod ?? '—'}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{fmt(d.amount)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{d.notes ?? ''}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Settlement History */}
              {detail.settlementItems.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4" /> 沖帳記錄 ({detail.settlementItems.length})
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 text-xs">
                          <TableHead>批號</TableHead>
                          <TableHead>日期</TableHead>
                          <TableHead className="text-right">沖帳金額</TableHead>
                          <TableHead>經辦</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.settlementItems.map(s => (
                          <TableRow key={s.id} className="text-sm">
                            <TableCell className="font-mono text-xs">{s.batch.batchNo}</TableCell>
                            <TableCell>{fmtDate(s.batch.paymentDate)}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{fmt(s.amount)}</TableCell>
                            <TableCell className="text-xs">{s.batch.createdBy?.name ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {detail.disbursements.length === 0 && detail.settlementItems.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">尚無付款/沖帳記錄</div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
