'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SupplierForm } from '@/components/purchases/supplier-form'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, Building2 } from 'lucide-react'
import { toast } from 'sonner'

const purchaseTypeLabels: Record<string, string> = {
  FINISHED_GOODS:     '成品',
  OEM:                'OEM代工',
  PACKAGING:          '包材',
  RAW_MATERIAL:       '原物料',
  GIFT_PROMO:         '贈品/活動',
  LOGISTICS_SUPPLIES: '物流耗材',
}

interface Supplier {
  id: string; code: string; name: string; contactPerson: string | null
  phone: string | null; email: string | null; address: string | null
  taxId: string | null; paymentTerms: string | null
  leadTimeDays: number | null; supplyCategories: string | null
  supplyItems: string | null; notes: string | null; isActive: boolean
  _count: { purchaseOrders: number }
}

export default function SuppliersPage() {
  const router = useRouter()
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [formOpen, setFormOpen]     = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search)       params.set('search', search)
    if (showInactive) params.set('showAll', 'true')
    const res = await fetch(`/api/suppliers?${params}`)
    setSuppliers(await res.json())
    setLoading(false)
  }, [search, showInactive])

  useEffect(() => {
    const t = setTimeout(fetchSuppliers, 300)
    return () => clearTimeout(t)
  }, [fetchSuppliers])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`確定要停用供應商「${name}」嗎？`)) return
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('供應商已停用'); fetchSuppliers() }
    else toast.error('操作失敗')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">供應商管理</h1>
          <p className="text-sm text-muted-foreground">共 {suppliers.length} 家供應商</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />新增供應商
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜尋供應商名稱、代碼、聯絡人..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300" />
          顯示停用供應商
        </label>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">供應商代碼</TableHead>
              <TableHead>供應商名稱</TableHead>
              <TableHead>聯絡資訊</TableHead>
              <TableHead>採購分類</TableHead>
              <TableHead className="w-20 text-center">交期(天)</TableHead>
              <TableHead className="w-20 text-center">採購單數</TableHead>
              <TableHead className="w-24">付款條件</TableHead>
              <TableHead className="w-16">狀態</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                  {search ? '找不到符合的供應商' : '尚無供應商，點擊右上角新增'}
                </TableCell>
              </TableRow>
            ) : suppliers.map(s => {
              const categories = s.supplyCategories ? JSON.parse(s.supplyCategories) as string[] : []
              return (
                <TableRow key={s.id} className="group cursor-pointer hover:bg-slate-50/80"
                  onClick={() => router.push(`/suppliers/${s.id}`)}>
                  <TableCell className="font-mono text-sm text-muted-foreground">{s.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <Building2 className="h-4 w-4 text-slate-600" />
                      </div>
                      <div className="font-medium">{s.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{s.contactPerson ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{s.phone ?? s.email ?? '—'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {categories.length > 0
                        ? categories.map((c: string) => (
                          <Badge key={c} variant="outline" className="text-xs px-1.5 py-0">
                            {purchaseTypeLabels[c] ?? c}
                          </Badge>
                        ))
                        : <span className="text-sm text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {s.leadTimeDays != null ? `${s.leadTimeDays} 天` : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium text-blue-600">{s._count.purchaseOrders}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.paymentTerms ?? '—'}</TableCell>
                  <TableCell>
                    {s.isActive
                      ? <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">啟用</Badge>
                      : <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500">停用</Badge>}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => { setEditTarget(s); setFormOpen(true) }}>
                          <Pencil className="mr-2 h-4 w-4" />編輯
                        </DropdownMenuItem>
                        {s.isActive && (
                          <DropdownMenuItem onClick={() => handleDelete(s.id, s.name)} variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" />停用
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <SupplierForm open={formOpen} onClose={() => setFormOpen(false)}
        onSuccess={fetchSuppliers} supplier={editTarget} />
    </div>
  )
}
