'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

const COUNTRY_LABELS: Record<string, string> = {
  TW: '台灣', CN: '中國', VN: '越南', TH: '泰國', JP: '日本', OTHER: '其他',
}

interface Variant {
  id: string
  variantSku: string
  masterSku: string
  originCode: string
  countryOrigin: string
  isActive: boolean
  barcodes: { barcodeEan13: string }[]
  supplier: { id: string; name: string } | null
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export default function DonghongVariantsPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [variants, setVariants]     = useState<Variant[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [loading, setLoading]       = useState(true)
  const [masterSkuQ, setMasterSkuQ] = useState('')
  const [countryFilter, setCountryFilter] = useState('ALL')
  const [activeFilter, setActiveFilter]   = useState('true')
  const [page, setPage] = useState(1)

  const fetchVariants = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (masterSkuQ)                      params.set('masterSku', masterSkuQ)
      if (countryFilter !== 'ALL')         params.set('countryOrigin', countryFilter)
      if (activeFilter !== 'ALL')          params.set('isActive', activeFilter)
      const res  = await fetch(`/api/donghong/variants?${params}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setVariants(data.data)
      setPagination(data.pagination)
    } catch {
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [masterSkuQ, countryFilter, activeFilter, page])

  useEffect(() => {
    const t = setTimeout(fetchVariants, 300)
    return () => clearTimeout(t)
  }, [fetchVariants])

  const role = (session?.user?.role as string) ?? ''
  const canManage = ['SUPER_ADMIN', 'GM', 'PROCUREMENT'].includes(role)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">產地變體管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">東泓供應鏈 · 各產地 SKU 變體</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/donghong/master-skus/new')}>
              <Plus className="w-4 h-4 mr-1" />新建主檔 SKU
            </Button>
            <Button onClick={() => router.push('/donghong/variants/new')}>
              <Plus className="w-4 h-4 mr-1" />新建變體
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋 Master SKU..."
            value={masterSkuQ}
            onChange={e => { setMasterSkuQ(e.target.value); setPage(1) }}
            className="pl-8 w-56"
          />
        </div>
        <Select value={countryFilter} onValueChange={v => { if (v) { setCountryFilter(v); setPage(1) } }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="產地" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部產地</SelectItem>
            {Object.entries(COUNTRY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={v => { if (v) { setActiveFilter(v); setPage(1) } }}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            <SelectItem value="true">啟用中</SelectItem>
            <SelectItem value="false">已停用</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">共 {pagination.total} 筆</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variant SKU</TableHead>
              <TableHead>Master SKU</TableHead>
              <TableHead>產地</TableHead>
              <TableHead>供應商</TableHead>
              <TableHead>條碼 (EAN-13)</TableHead>
              <TableHead>狀態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : variants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  無資料
                </TableCell>
              </TableRow>
            ) : (
              variants.map(v => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/donghong/variants/${v.id}`)}
                >
                  <TableCell className="font-mono text-sm font-medium">{v.variantSku}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{v.masterSku}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{COUNTRY_LABELS[v.countryOrigin] ?? v.countryOrigin}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{v.supplier?.name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {v.barcodes[0]?.barcodeEan13 ?? '—'}
                    {v.barcodes.length > 1 && (
                      <span className="text-muted-foreground ml-1">+{v.barcodes.length - 1}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.isActive ? 'default' : 'secondary'}>
                      {v.isActive ? '啟用' : '停用'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline" size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {pagination.totalPages} 頁
          </span>
          <Button
            variant="outline" size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
