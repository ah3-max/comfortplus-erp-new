'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CustomerForm, customerTypes, devStatusOptions, regionOptions } from '@/components/customers/customer-form'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, Phone, MessageCircle, Users } from 'lucide-react'
import { toast } from 'sonner'

const typeColors: Record<string, string> = {
  NURSING_HOME: 'bg-blue-100 text-blue-700',
  ELDERLY_HOME: 'bg-purple-100 text-purple-700',
  HOSPITAL:     'bg-red-100 text-red-700',
  DISTRIBUTOR:  'bg-green-100 text-green-700',
  OTHER:        'bg-slate-100 text-slate-600',
}

const devStatusColors: Record<string, string> = {
  POTENTIAL:   'border-slate-300 text-slate-600',
  NEGOTIATING: 'bg-amber-100 text-amber-700 border-amber-200',
  CLOSED:      'bg-green-100 text-green-700 border-green-200',
  DORMANT:     'bg-slate-100 text-slate-500 border-slate-200',
  REJECTED:    'bg-red-50 text-red-500 border-red-200',
  OTHER:       'bg-slate-50 text-slate-500 border-slate-200',
}

const gradeColors: Record<string, string> = {
  A: 'bg-amber-400 text-white',
  B: 'bg-blue-400 text-white',
  C: 'bg-green-500 text-white',
  D: 'bg-slate-400 text-white',
}

interface Customer {
  id: string; code: string; name: string; type: string
  contactPerson: string | null; phone: string | null; lineId: string | null
  email: string | null; address: string | null; region: string | null
  taxId: string | null; paymentTerms: string | null; creditLimit: string | null
  grade: string | null; devStatus: string; source: string | null
  salesRepId: string | null; salesRep: { id: string; name: string } | null
  keyAccountMgr?: { id: string; name: string } | null
  isKeyAccount?: boolean
  winRate: number | null; estimatedMonthlyVolume: string | null
  notes: string | null; isActive: boolean; createdAt: string
  _count: { visitRecords: number; callRecords: number; salesOrders: number }
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers]             = useState<Customer[]>([])
  const [loading, setLoading]                 = useState(true)
  const [search, setSearch]                   = useState('')
  const [filterType, setFilterType]           = useState('')
  const [filterRegion, setFilterRegion]       = useState('')
  const [filterStatus, setFilterStatus]       = useState('')
  const [filterKeyAccount, setFilterKeyAccount] = useState(false)
  const [page, setPage]                       = useState(1)
  const [pagination, setPagination]           = useState<{page:number;pageSize:number;total:number;totalPages:number}|null>(null)
  const sp = useSearchParams()
  const [formOpen, setFormOpen]               = useState(sp.get('action') === 'new')
  const [editTarget, setEditTarget]           = useState<Customer | null>(null)

  // Quick prospect creation state
  const [quickOpen,   setQuickOpen]   = useState(false)
  const [quickName,   setQuickName]   = useState('')
  const [quickPhone,  setQuickPhone]  = useState('')
  const [quickRepId,  setQuickRepId]  = useState('')
  const [quickNote,   setQuickNote]   = useState('')
  const [quickSaving, setQuickSaving] = useState(false)
  const [users,       setUsers]       = useState<{id:string; name:string}[]>([])

  // Fetch users when quick dialog opens
  useEffect(() => {
    if (!quickOpen) return
    fetch('/api/users?limit=100').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : (d.users ?? [])))
  }, [quickOpen])

  async function handleQuickCreate() {
    if (!quickName.trim()) { toast.error('請填寫客戶名稱'); return }
    setQuickSaving(true)
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: quickName,
        phone: quickPhone || null,
        salesRepId: quickRepId || null,
        notes: quickNote || null,
        devStatus: 'POTENTIAL',
        source: 'COLD_CALL',
        type: 'OTHER',
      }),
    })
    setQuickSaving(false)
    if (res.ok) {
      const data = await res.json()
      toast.success('潛在客戶已建立')
      setQuickOpen(false)
      setQuickName(''); setQuickPhone(''); setQuickRepId(''); setQuickNote('')
      router.push(`/customers/${data.id}`)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '建立失敗')
    }
  }

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search)            p.set('search', search)
    if (filterType)        p.set('type', filterType)
    if (filterRegion)      p.set('region', filterRegion)
    if (filterStatus)      p.set('devStatus', filterStatus)
    if (filterKeyAccount)  p.set('isKeyAccount', 'true')
    p.set('page', String(page))
    p.set('pageSize', '50')
    try {
      const res = await fetch(`/api/customers?${p}`)
      if (!res.ok) throw new Error('載入失敗')
      const result = await res.json()
      setCustomers(Array.isArray(result) ? result : result.data ?? [])
      setPagination(result.pagination ?? null)
    } catch {
      toast.error('客戶載入失敗，請檢查網路連線')
    } finally {
      setLoading(false)
    }
  }, [search, filterType, filterRegion, filterStatus, filterKeyAccount, page])

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 300)
    return () => clearTimeout(t)
  }, [fetchCustomers])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`確定要停用「${name}」嗎？`)) return
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('客戶已停用'); fetchCustomers() }
    else toast.error('操作失敗')
  }

  const closedCount = customers.filter(c => c.devStatus === 'CLOSED').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">客戶管理</h1>
          <p className="text-sm text-muted-foreground">
            共 {customers.length} 位客戶
            {closedCount > 0 && <span className="ml-2 text-green-600">{closedCount} 位成交</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setQuickOpen(true)}>
            <Phone className="mr-2 h-4 w-4" />
            陌生開發快速建檔
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => window.open('/api/customers/export', '_blank')}>
            匯出 Excel
          </Button>
          <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />新增客戶
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜尋名稱、代碼、聯絡人..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
          value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}>
          <option value="">全部類型</option>
          {customerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
          value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setPage(1) }}>
          <option value="">全部區域</option>
          {regionOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
          value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
          <option value="">全部狀態</option>
          {devStatusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button
          onClick={() => { setFilterKeyAccount(v => !v); setPage(1) }}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            filterKeyAccount
              ? 'bg-amber-100 border-amber-300 text-amber-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          ⭐ 心臟客戶
        </button>
      </div>

      {/* Empty State */}
      {!loading && customers.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">目前無客戶資料</p>
        </div>
      )}

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {loading && (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && customers.map(c => (
          <Link key={c.id} href={`/customers/${c.id}`}>
            <Card className="active:scale-[0.99] transition-transform">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{c.name}</span>
                  <Badge variant="outline" className="text-xs">{c.code}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  {c.grade && <Badge variant="secondary" className="text-xs">{c.grade}級</Badge>}
                  <span>{customerTypes.find(t => t.value === c.type)?.label ?? c.type}</span>
                  {c.region && <span>· {regionOptions.find(r => r.value === c.region)?.label ?? c.region}</span>}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.salesRep?.name ?? '未指派'}</span>
                  <span>{c._count.salesOrders} 筆訂單 · {c._count.visitRecords} 次拜訪</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="hidden md:block rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">代碼</TableHead>
              <TableHead>客戶名稱</TableHead>
              <TableHead className="w-24">類型</TableHead>
              <TableHead className="w-16">等級</TableHead>
              <TableHead className="w-20">狀態</TableHead>
              <TableHead className="w-16">區域</TableHead>
              <TableHead>聯絡人</TableHead>
              <TableHead>負責業務</TableHead>
              <TableHead className="w-16 text-center">紀錄</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="py-16 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              </TableCell></TableRow>
            ) : customers.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="py-16 text-center text-muted-foreground">
                {search || filterType || filterRegion || filterStatus ? '找不到符合的客戶' : '尚無客戶資料，點擊右上角新增'}
              </TableCell></TableRow>
            ) : customers.map(c => (
              <TableRow key={c.id} className="group cursor-pointer hover:bg-slate-50/80"
                onClick={() => router.push(`/customers/${c.id}`)}>
                <TableCell className="font-mono text-sm text-muted-foreground">{c.code}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    {c.isKeyAccount && <span className="text-amber-500 text-xs">⭐</span>}
                    {c.name}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[c.type] ?? 'bg-slate-100 text-slate-600'}`}>
                    {customerTypes.find(t => t.value === c.type)?.label ?? c.type}
                  </span>
                </TableCell>
                <TableCell>
                  {c.grade
                    ? <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${gradeColors[c.grade] ?? ''}`}>{c.grade}</span>
                    : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${devStatusColors[c.devStatus] ?? ''}`}>
                    {devStatusOptions.find(s => s.value === c.devStatus)?.label ?? c.devStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{regionOptions.find(r => r.value === c.region)?.label ?? c.region ?? '—'}</TableCell>
                <TableCell>
                  <div className="text-sm">{c.contactPerson ?? '—'}</div>
                  {c.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />{c.phone}
                      {c.lineId && <><MessageCircle className="h-3 w-3 text-green-500" />{c.lineId}</>}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{c.salesRep?.name ?? <span className="text-muted-foreground">未指派</span>}</TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">
                  {c._count.visitRecords + c._count.callRecords > 0
                    ? <span className="text-blue-600 font-medium">{c._count.visitRecords + c._count.callRecords}</span>
                    : '—'}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditTarget(c); setFormOpen(true) }}>
                        <Pencil className="mr-2 h-4 w-4" />編輯
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(c.id, c.name)} variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />停用
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            共 {pagination.total} 筆，第 {pagination.page}/{pagination.totalPages} 頁
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1}
              onClick={() => setPage(p => p - 1)}>上一頁</Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}>下一頁</Button>
          </div>
        </div>
      )}

      <CustomerForm open={formOpen} onClose={() => setFormOpen(false)}
        onSuccess={fetchCustomers} customer={editTarget} />

      {/* Quick prospect creation dialog */}
      <Dialog open={quickOpen} onOpenChange={o => !o && setQuickOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>快速建立潛在客戶</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
              適用於陌生開發、冷電話開發的機構。建立後可在客戶頁面記錄每次聯繫結果。
            </div>
            <div className="space-y-1.5">
              <Label>機構/客戶名稱 <span className="text-red-500">*</span></Label>
              <Input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="例：XX護理之家" />
            </div>
            <div className="space-y-1.5">
              <Label>電話</Label>
              <Input value={quickPhone} onChange={e => setQuickPhone(e.target.value)} placeholder="02-xxxx-xxxx" />
            </div>
            <div className="space-y-1.5">
              <Label>負責業務</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={quickRepId}
                onChange={e => setQuickRepId(e.target.value)}
              >
                <option value="">-- 不指定 --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>備注</Label>
              <Input value={quickNote} onChange={e => setQuickNote(e.target.value)} placeholder="陌生開發來源、備注..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickOpen(false)} disabled={quickSaving}>取消</Button>
            <Button onClick={handleQuickCreate} disabled={quickSaving}>
              {quickSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              建立並前往記錄
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
