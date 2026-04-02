'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, Loader2, ClipboardCheck, PackageCheck, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type PutawayStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
type QcResult = 'PASS' | 'FAIL' | 'CONDITIONAL' | null

interface InboundItem {
  id: string
  productId: string
  quantity: number
  product: { name: string; sku: string }
}

interface InboundRecord {
  id: string
  inboundNo: string
  arrivalDate: string | null
  putawayStatus: PutawayStatus
  qcResult: QcResult
  notes: string | null
  createdAt: string
  warehouse: { code: string; name: string }
  seaFreight: {
    freightNo: string
    status: string
    purchaseOrder: { poNo: string } | null
  } | null
  items: InboundItem[]
}

const putawayBadge: Record<PutawayStatus, string> = {
  PENDING:     'border-slate-300 text-slate-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 border-amber-200',
  COMPLETED:   'bg-green-100 text-green-700 border-green-200',
}
const putawayLabel: Record<PutawayStatus, string> = {
  PENDING: '待上架', IN_PROGRESS: '上架中', COMPLETED: '已上架',
}

const qcBadge: Record<string, string> = {
  PASS:        'bg-green-100 text-green-700 border-green-200',
  FAIL:        'bg-red-100 text-red-700 border-red-200',
  CONDITIONAL: 'bg-amber-100 text-amber-700 border-amber-200',
}
const qcLabel: Record<string, string> = {
  PASS: '允收', FAIL: '退回', CONDITIONAL: '有條件允收',
}

const QC_RESULTS = [
  { value: 'ACCEPTED',           label: '允收（全部）' },
  { value: 'CONDITIONAL_ACCEPT', label: '有條件允收' },
  { value: 'RETURN_TO_SUPPLIER', label: '退回供應商' },
  { value: 'REWORK',             label: '要求重工' },
]

export default function InboundPage() {
  const [records, setRecords] = useState<InboundRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterQc, setFilterQc] = useState('')
  const [filterPutaway, setFilterPutaway] = useState('')
  const [pagination, setPagination] = useState<{ page: number; total: number; totalPages: number } | null>(null)
  const [page, setPage] = useState(1)

  // QC dialog
  const [qcTarget, setQcTarget] = useState<InboundRecord | null>(null)
  const [qcResult, setQcResult] = useState('ACCEPTED')
  const [qcNotes, setQcNotes] = useState('')
  const [qcLoading, setQcLoading] = useState(false)

  // Putaway dialog
  const [putawayTarget, setPutawayTarget] = useState<InboundRecord | null>(null)
  const [putawayLoading, setPutawayLoading] = useState(false)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    if (search) params.set('search', search)
    if (filterQc) params.set('qcResult', filterQc)
    if (filterPutaway) params.set('putawayStatus', filterPutaway)

    try {
      const res = await fetch(`/api/inbound?${params}`)
      const json = await res.json()
      setRecords(json.data ?? [])
      setPagination(json.pagination ?? null)
    } catch {
      toast.error('載入入庫單失敗')
    } finally {
      setLoading(false)
    }
  }, [page, search, filterQc, filterPutaway])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  async function handleQcSubmit() {
    if (!qcTarget) return
    setQcLoading(true)
    try {
      const res = await fetch(`/api/inbound/${qcTarget.id}/qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: qcResult, notes: qcNotes }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'QC 操作失敗'); return }
      toast.success(`QC 完成：${data.qcResult === 'PASS' ? '允收' : '不允收'}`)
      setQcTarget(null)
      fetchRecords()
    } catch {
      toast.error('QC 操作失敗，請稍後重試')
    } finally {
      setQcLoading(false)
    }
  }

  async function handlePutaway() {
    if (!putawayTarget) return
    setPutawayLoading(true)
    try {
      const res = await fetch(`/api/inbound/${putawayTarget.id}/putaway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '上架操作失敗'); return }
      toast.success('上架完成')
      setPutawayTarget(null)
      fetchRecords()
    } catch {
      toast.error('上架操作失敗，請稍後重試')
    } finally {
      setPutawayLoading(false)
    }
  }

  function fmtDate(s: string | null) {
    if (!s) return '—'
    return new Date(s).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">入庫管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">海運到倉驗收 → QC → 上架</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRecords}>
          <RefreshCw className="h-4 w-4 mr-1" /> 重新整理
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜尋入庫單號..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={filterQc} onValueChange={v => { setFilterQc(v === 'ALL' ? '' : (v ?? '')); setPage(1) }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="QC 結果" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部狀態</SelectItem>
                <SelectItem value="PASS">已允收</SelectItem>
                <SelectItem value="FAIL">已退回</SelectItem>
                <SelectItem value="CONDITIONAL">有條件</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPutaway} onValueChange={v => { setFilterPutaway(v === 'ALL' ? '' : (v ?? '')); setPage(1) }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="上架狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部</SelectItem>
                <SelectItem value="PENDING">待上架</SelectItem>
                <SelectItem value="IN_PROGRESS">上架中</SelectItem>
                <SelectItem value="COMPLETED">已上架</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">目前沒有入庫單</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>入庫單號</TableHead>
                  <TableHead>來源海運單</TableHead>
                  <TableHead>採購單</TableHead>
                  <TableHead>倉庫</TableHead>
                  <TableHead>到倉日</TableHead>
                  <TableHead>品項</TableHead>
                  <TableHead>QC 結果</TableHead>
                  <TableHead>上架狀態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm font-medium">{r.inboundNo}</TableCell>
                    <TableCell className="text-sm">{r.seaFreight?.freightNo ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.seaFreight?.purchaseOrder?.poNo ?? '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{r.warehouse.name}</span>
                      <span className="text-xs text-muted-foreground ml-1">({r.warehouse.code})</span>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(r.arrivalDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.items.map(i => `${i.product.name}×${i.quantity}`).join('、') || '—'}
                    </TableCell>
                    <TableCell>
                      {r.qcResult ? (
                        <Badge variant="outline" className={qcBadge[r.qcResult]}>
                          {qcLabel[r.qcResult] ?? r.qcResult}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">待驗收</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={putawayBadge[r.putawayStatus]}>
                        {putawayLabel[r.putawayStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {!r.qcResult && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => { setQcTarget(r); setQcResult('ACCEPTED'); setQcNotes('') }}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> QC 驗收
                        </Button>
                      )}
                      {r.qcResult === 'PASS' && r.putawayStatus !== 'COMPLETED' && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => setPutawayTarget(r)}
                        >
                          <PackageCheck className="h-3.5 w-3.5 mr-1" /> 確認上架
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-end items-center gap-2 text-sm text-muted-foreground">
          <span>共 {pagination.total} 筆</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
          <span>{page} / {pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>下一頁</Button>
        </div>
      )}

      {/* QC Dialog */}
      <Dialog open={!!qcTarget} onOpenChange={open => !open && setQcTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QC 驗收 — {qcTarget?.inboundNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                品項：{qcTarget?.items.map(i => `${i.product.name}×${i.quantity}`).join('、')}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>驗收結果</Label>
              <Select value={qcResult} onValueChange={v => setQcResult(v ?? 'ACCEPTED')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QC_RESULTS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea
                value={qcNotes}
                onChange={e => setQcNotes(e.target.value)}
                placeholder="驗收備註（可選）"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQcTarget(null)}>取消</Button>
            <Button onClick={handleQcSubmit} disabled={qcLoading}>
              {qcLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              確認送出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Putaway Dialog */}
      <Dialog open={!!putawayTarget} onOpenChange={open => !open && setPutawayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認上架 — {putawayTarget?.inboundNo}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              倉庫：{putawayTarget?.warehouse.name}（{putawayTarget?.warehouse.code}）
            </p>
            <p className="text-sm">
              品項：{putawayTarget?.items.map(i => `${i.product.name}×${i.quantity}`).join('、')}
            </p>
            <p className="text-sm text-muted-foreground mt-2">確認後將標記上架完成，庫存已在 QC 驗收時更新。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPutawayTarget(null)}>取消</Button>
            <Button onClick={handlePutaway} disabled={putawayLoading}>
              {putawayLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              確認上架
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
