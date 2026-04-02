'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, Plus, Pencil, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const CHANNELS = ['Costco', '全聯', '家樂福', '大樹藥局', '愛買', '丁丁藥局', '蝦皮', '其他']
const COMPETITORS = ['包大人', '來復易', '安安', '金安心', '其他']

interface PriceRecord {
  id: string
  recordDate: string
  channel: string
  competitor: string
  productName: string
  sku: string | null
  spec: string | null
  unitPrice: string
  originalPrice: string | null
  promoNote: string | null
  isOnShelf: boolean
  sourceUrl: string | null
  notes: string | null
  createdBy: { id: string; name: string }
  createdAt: string
}

interface FormState {
  recordDate: string
  channel: string
  competitor: string
  productName: string
  sku: string
  spec: string
  unitPrice: string
  originalPrice: string
  promoNote: string
  isOnShelf: boolean
  sourceUrl: string
  notes: string
}

const emptyForm = (): FormState => ({
  recordDate: new Date().toISOString().slice(0, 10),
  channel: '',
  competitor: '',
  productName: '',
  sku: '',
  spec: '',
  unitPrice: '',
  originalPrice: '',
  promoNote: '',
  isOnShelf: true,
  sourceUrl: '',
  notes: '',
})

export default function CompetitorPricesPage() {
  const [records, setRecords] = useState<PriceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<{ page: number; total: number; totalPages: number } | null>(null)
  const [page, setPage] = useState(1)

  // Filters
  const [filterChannel, setFilterChannel] = useState('')
  const [filterCompetitor, setFilterCompetitor] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PriceRecord | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PriceRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (filterChannel)    params.set('channel', filterChannel)
    if (filterCompetitor) params.set('competitor', filterCompetitor)
    if (filterDateFrom)   params.set('dateFrom', filterDateFrom)
    if (filterDateTo)     params.set('dateTo', filterDateTo)
    try {
      const res = await fetch(`/api/competitor-prices?${params}`)
      const json = await res.json()
      setRecords(json.data ?? [])
      setPagination(json.pagination ?? null)
    } catch {
      toast.error('載入資料失敗')
    } finally {
      setLoading(false)
    }
  }, [page, filterChannel, filterCompetitor, filterDateFrom, filterDateTo])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  function openCreate() {
    setEditTarget(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(r: PriceRecord) {
    setEditTarget(r)
    setForm({
      recordDate:    r.recordDate.slice(0, 10),
      channel:       r.channel,
      competitor:    r.competitor,
      productName:   r.productName,
      sku:           r.sku ?? '',
      spec:          r.spec ?? '',
      unitPrice:     String(r.unitPrice),
      originalPrice: r.originalPrice ? String(r.originalPrice) : '',
      promoNote:     r.promoNote ?? '',
      isOnShelf:     r.isOnShelf,
      sourceUrl:     r.sourceUrl ?? '',
      notes:         r.notes ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.channel || !form.competitor || !form.productName || !form.unitPrice) {
      toast.error('請填寫通路、競品、商品名稱、單價')
      return
    }
    setSaving(true)
    try {
      const url = editTarget ? `/api/competitor-prices/${editTarget.id}` : '/api/competitor-prices'
      const method = editTarget ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          unitPrice:     Number(form.unitPrice),
          originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '操作失敗'); return }
      toast.success(editTarget ? '更新成功' : '新增成功')
      setDialogOpen(false)
      fetchRecords()
    } catch {
      toast.error('操作失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/competitor-prices/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('刪除失敗'); return }
      toast.success('已刪除')
      setDeleteTarget(null)
      fetchRecords()
    } catch {
      toast.error('刪除失敗')
    } finally {
      setDeleting(false)
    }
  }

  // Build trend chart data: group by recordDate+competitor, average unitPrice
  const trendData = (() => {
    const map = new Map<string, Record<string, number[]>>()
    for (const r of records) {
      const d = r.recordDate.slice(0, 10)
      if (!map.has(d)) map.set(d, {})
      const dayMap = map.get(d)!
      if (!dayMap[r.competitor]) dayMap[r.competitor] = []
      dayMap[r.competitor].push(Number(r.unitPrice))
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, byComp]) => {
        const entry: Record<string, unknown> = { date }
        for (const [comp, prices] of Object.entries(byComp)) {
          entry[comp] = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
        }
        return entry
      })
  })()

  const competitorsInData = Array.from(new Set(records.map(r => r.competitor)))
  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

  const fmtPrice = (p: string | null) => p ? `$${Number(p).toLocaleString()}` : '—'
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            競品價格監控
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            每日填報競品在各通路的售價，追蹤趨勢
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRecords}>
            <RefreshCw className="h-4 w-4 mr-1" /> 重新整理
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> 填報價格
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3">
            <Select value={filterChannel} onValueChange={v => { setFilterChannel(v === 'ALL' ? '' : (v ?? '')); setPage(1) }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="全部通路" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部通路</SelectItem>
                {CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCompetitor} onValueChange={v => { setFilterCompetitor(v === 'ALL' ? '' : (v ?? '')); setPage(1) }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="全部競品" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部競品</SelectItem>
                {COMPETITORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input type="date" className="w-36 text-sm" value={filterDateFrom}
                onChange={e => { setFilterDateFrom(e.target.value); setPage(1) }} />
              <span className="text-muted-foreground text-xs">~</span>
              <Input type="date" className="w-36 text-sm" value={filterDateTo}
                onChange={e => { setFilterDateTo(e.target.value); setPage(1) }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">資料列表</TabsTrigger>
          <TabsTrigger value="trend">趨勢圖表</TabsTrigger>
        </TabsList>

        {/* Table */}
        <TabsContent value="table" className="mt-3">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : records.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">尚無價格紀錄</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>通路</TableHead>
                      <TableHead>競品</TableHead>
                      <TableHead>商品</TableHead>
                      <TableHead>規格</TableHead>
                      <TableHead>現價</TableHead>
                      <TableHead>原價</TableHead>
                      <TableHead>促銷說明</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{fmtDate(r.recordDate)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{r.channel}</Badge></TableCell>
                        <TableCell className="font-medium text-sm">{r.competitor}</TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate" title={r.productName}>{r.productName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.spec ?? '—'}</TableCell>
                        <TableCell className="font-mono text-sm font-semibold">{fmtPrice(r.unitPrice)}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground line-through">{fmtPrice(r.originalPrice)}</TableCell>
                        <TableCell className="text-xs text-amber-700 max-w-[120px] truncate">{r.promoNote ?? '—'}</TableCell>
                        <TableCell>
                          {r.isOnShelf
                            ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">上架中</Badge>
                            : <Badge variant="outline" className="bg-slate-100 text-slate-500 text-xs">已下架</Badge>
                          }
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600"
                            onClick={() => setDeleteTarget(r)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-end items-center gap-2 text-sm text-muted-foreground mt-2">
              <span>共 {pagination.total} 筆</span>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
              <span>{page} / {pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>下一頁</Button>
            </div>
          )}
        </TabsContent>

        {/* Trend Chart */}
        <TabsContent value="trend" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">各競品平均單價趨勢</CardTitle>
            </CardHeader>
            <CardContent>
              {trendData.length < 2 ? (
                <div className="text-center text-muted-foreground py-12 text-sm">
                  至少需要 2 個日期的資料才能顯示趨勢圖
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={(v: unknown) => typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? '')} />
                    <Legend />
                    {competitorsInData.map((comp, i) => (
                      <Line
                        key={comp}
                        type="monotone"
                        dataKey={comp}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Summary cards */}
          {competitorsInData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {competitorsInData.map(comp => {
                const prices = records.filter(r => r.competitor === comp).map(r => Number(r.unitPrice))
                const avg = prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : 0
                const min = prices.length ? Math.min(...prices) : 0
                const max = prices.length ? Math.max(...prices) : 0
                return (
                  <Card key={comp}>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-sm font-semibold">{comp}</p>
                      <p className="text-xl font-bold mt-1">${avg.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ${min.toLocaleString()} ~ ${max.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? '編輯價格紀錄' : '新增競品價格'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label>填報日期 *</Label>
              <Input type="date" value={form.recordDate} onChange={e => setForm(f => ({ ...f, recordDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>通路 *</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="選擇通路" /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>競品品牌 *</Label>
              <Select value={form.competitor} onValueChange={v => setForm(f => ({ ...f, competitor: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="選擇競品" /></SelectTrigger>
                <SelectContent>
                  {COMPETITORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>商品名稱 *</Label>
              <Input placeholder="如：包大人 透氣M號" value={form.productName}
                onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>規格</Label>
              <Input placeholder="如：30片/包" value={form.spec}
                onChange={e => setForm(f => ({ ...f, spec: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>SKU（競品）</Label>
              <Input placeholder="可選" value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>現售單價（含促銷）*</Label>
              <Input type="number" placeholder="0" value={form.unitPrice}
                onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>原價（促銷前）</Label>
              <Input type="number" placeholder="可選" value={form.originalPrice}
                onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>促銷說明</Label>
              <Input placeholder="如：買2包送1包、滿千折百" value={form.promoNote}
                onChange={e => setForm(f => ({ ...f, promoNote: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>商品頁連結</Label>
              <Input placeholder="蝦皮/電商連結（可選）" value={form.sourceUrl}
                onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>備註</Label>
              <Textarea rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isOnShelf" checked={form.isOnShelf}
                onChange={e => setForm(f => ({ ...f, isOnShelf: e.target.checked }))}
                className="rounded" />
              <Label htmlFor="isOnShelf">目前上架中</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editTarget ? '更新' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            確認刪除 {deleteTarget?.competitor} 在 {deleteTarget?.channel} 的
            「{deleteTarget?.productName}」價格紀錄？此操作無法復原。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
