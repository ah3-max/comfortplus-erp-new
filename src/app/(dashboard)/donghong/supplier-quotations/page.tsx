'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Search, ChevronLeft, ChevronRight, FileText } from 'lucide-react'

type SQStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'SUPERSEDED' | 'CANCELLED'

const STATUS_LABELS: Record<SQStatus, string> = {
  DRAFT: '草稿', ACTIVE: '有效', EXPIRED: '過期', SUPERSEDED: '已取代', CANCELLED: '已取消',
}
const STATUS_CLASS: Record<SQStatus, string> = {
  DRAFT:      'bg-slate-100 text-slate-600 border-slate-300',
  ACTIVE:     'bg-green-100 text-green-700 border-green-300',
  EXPIRED:    'bg-yellow-100 text-yellow-700 border-yellow-300',
  SUPERSEDED: 'bg-purple-100 text-purple-700 border-purple-300',
  CANCELLED:  'bg-red-100 text-red-700 border-red-300',
}

interface SupplierQuotation {
  id: string
  quotationNumber: string
  currency: string
  validUntil: string
  status: SQStatus
  supplier: { id: string; name: string; code: string } | null
  _count: { items: number }
}

interface Pagination {
  page: number; pageSize: number; total: number; totalPages: number
}

export default function SupplierQuotationsPage() {
  const router = useRouter()
  const [quotations, setQuotations] = useState<SupplierQuotation[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/donghong/supplier-quotations?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setQuotations(data.data)
      setPagination(data.pagination)
    } catch {
      setQuotations([])
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => {
    const t = setTimeout(fetchList, 300)
    return () => clearTimeout(t)
  }, [fetchList])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">供應商報價管理</h1>
          <p className="text-sm text-muted-foreground">東泓供應鏈 — 管理各供應商報價單</p>
        </div>
        <Button onClick={() => router.push('/donghong/supplier-quotations/new')}>
          <Plus className="h-4 w-4 mr-1" /> 新建報價
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 w-56"
            placeholder="搜尋報價單號..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v ?? 'ALL'); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部狀態</SelectItem>
            {(Object.keys(STATUS_LABELS) as SQStatus[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">共 {pagination.total} 筆</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>報價單號</TableHead>
              <TableHead>供應商</TableHead>
              <TableHead>幣別</TableHead>
              <TableHead>有效期</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="text-center">品項數</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : quotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  尚無報價資料
                </TableCell>
              </TableRow>
            ) : quotations.map(q => (
              <TableRow
                key={q.id}
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => router.push(`/donghong/supplier-quotations/${q.id}`)}
              >
                <TableCell className="font-mono font-medium">{q.quotationNumber}</TableCell>
                <TableCell>{q.supplier?.name ?? '—'}</TableCell>
                <TableCell>{q.currency}</TableCell>
                <TableCell>{q.validUntil ? new Date(q.validUntil).toLocaleDateString('zh-TW') : '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_CLASS[q.status]}>
                    {STATUS_LABELS[q.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">{q._count.items}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {pagination.totalPages} 頁
          </span>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
