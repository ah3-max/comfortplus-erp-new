'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Loader2, Plus, Trash2, Pencil, CheckCircle2, XCircle,
  GitBranch, Link2,
} from 'lucide-react'
import { toast } from 'sonner'

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

interface QuotationItem {
  id: string; variantId: string; unitPrice: number; unit: string; packingSpec: string | null
  variant: { id: string; variantSku: string; masterSku: string; originCode: string; masterProduct: { name: string } | null } | null
}
interface QuotationDetail {
  id: string; quotationNumber: string; status: SQStatus
  supplierId: string; supplier: { id: string; name: string; code: string; country: string | null } | null
  quotedAt: string; validFrom: string; validUntil: string
  currency: string; incoterms: string | null; paymentTerms: string | null
  leadTimeDays: number | null; minOrderQty: number | null; notes: string | null
  createdAt: string; createdById: string
  items: QuotationItem[]
  supersededBy: { id: string; quotationNumber: string; status: string; createdAt: string } | null
  replacedBy: { id: string; quotationNumber: string; status: string; createdAt: string }[]
}
interface Variant { id: string; variantSku: string; masterSku: string; masterProduct: { name: string } | null }

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('zh-TW')
}

export default function SupplierQuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [q, setQ]             = useState<QuotationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)

  // Add-item dialog state
  const [addOpen, setAddOpen]   = useState(false)
  const [variants, setVariants] = useState<Variant[]>([])
  const [newItem, setNewItem]   = useState({ variantId: '', unitPrice: '', unit: 'pc', packingSpec: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/donghong/supplier-quotations/${id}`)
    if (res.ok) setQ(await res.json())
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/donghong/variants?isActive=true&pageSize=100')
      .then(r => r.json())
      .then(d => setVariants(d.data ?? []))
      .catch(() => {})
  }, [])

  async function doActivate() {
    if (!confirm('確定要啟用此報價？啟用後無法直接編輯。')) return
    setActing(true)
    const res = await fetch(`/api/donghong/supplier-quotations/${id}/activate`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) { toast.success('報價已啟用'); load() }
    else toast.error(data.error ?? '啟用失敗')
    setActing(false)
  }

  async function doSupersede() {
    if (!confirm('確定要建立新版本？舊版本將標記為「已取代」。')) return
    setActing(true)
    const res = await fetch(`/api/donghong/supplier-quotations/${id}/supersede`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) { toast.success(`新版本 ${data.quotationNumber} 已建立`); router.push(`/donghong/supplier-quotations/${data.id}`) }
    else toast.error(data.error ?? '建立新版本失敗')
    setActing(false)
  }

  async function doCancel() {
    if (!confirm('確定要取消此報價？')) return
    setActing(true)
    const res = await fetch(`/api/donghong/supplier-quotations/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) { toast.success('報價已取消'); load() }
    else toast.error(data.error ?? '取消失敗')
    setActing(false)
  }

  async function doAddItem() {
    if (!newItem.variantId || !newItem.unitPrice) { toast.error('請選擇 Variant 並填寫單價'); return }
    setActing(true)
    const res = await fetch(`/api/donghong/supplier-quotations/${id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variantId:   newItem.variantId,
        unitPrice:   Number(newItem.unitPrice),
        unit:        newItem.unit || 'pc',
        packingSpec: newItem.packingSpec || undefined,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      if (data.warnings?.length) toast.warning(data.warnings.join('；'))
      toast.success('品項已新增')
      setAddOpen(false)
      setNewItem({ variantId: '', unitPrice: '', unit: 'pc', packingSpec: '' })
      load()
    } else toast.error(data.error ?? '新增失敗')
    setActing(false)
  }

  async function doDeleteItem(itemId: string, sku: string) {
    if (!confirm(`確定要刪除品項 ${sku}？`)) return
    const res = await fetch(`/api/donghong/supplier-quotations/${id}/items/${itemId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('品項已刪除'); load() }
    else { const d = await res.json(); toast.error(d.error ?? '刪除失敗') }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
  if (!q) return <div className="py-24 text-center text-muted-foreground">報價單不存在</div>

  const isDraft = q.status === 'DRAFT'
  const isActive = q.status === 'ACTIVE'
  const isExpired = q.status === 'EXPIRED'
  const isReadonly = ['SUPERSEDED', 'CANCELLED'].includes(q.status)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/donghong/supplier-quotations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono">{q.quotationNumber}</h1>
            <Badge variant="outline" className={STATUS_CLASS[q.status]}>{STATUS_LABELS[q.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {q.supplier?.name ?? '—'} · 有效至 {fmtDate(q.validUntil)} · {q.currency}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          {isDraft && (
            <>
              <Button size="sm" onClick={doActivate} disabled={acting}>
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                啟用
              </Button>
              <Button size="sm" variant="outline" className="text-red-500" onClick={doCancel} disabled={acting}>
                <XCircle className="h-4 w-4 mr-1" /> 取消
              </Button>
            </>
          )}
          {(isActive || isExpired) && (
            <>
              <Button size="sm" variant="outline" onClick={doSupersede} disabled={acting}>
                <GitBranch className="h-4 w-4 mr-1" /> 建立新版本
              </Button>
              <Button size="sm" variant="outline" className="text-red-500" onClick={doCancel} disabled={acting}>
                <XCircle className="h-4 w-4 mr-1" /> 取消
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">基本資料</TabsTrigger>
          <TabsTrigger value="items">報價明細 ({q.items.length})</TabsTrigger>
          <TabsTrigger value="versions">版本鏈</TabsTrigger>
          <TabsTrigger value="po">關聯 PO</TabsTrigger>
        </TabsList>

        {/* Tab 1: Info */}
        <TabsContent value="info">
          <Card>
            <CardContent className="pt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                ['供應商',     q.supplier?.name ?? '—'],
                ['報價日期',   fmtDate(q.quotedAt)],
                ['幣別',       q.currency],
                ['有效期起',   fmtDate(q.validFrom)],
                ['有效期至',   fmtDate(q.validUntil)],
                ['交貨條件',   q.incoterms   ?? '—'],
                ['付款條件',   q.paymentTerms ?? '—'],
                ['交期（天）', q.leadTimeDays != null ? String(q.leadTimeDays) : '—'],
                ['最低訂量',   q.minOrderQty  != null ? String(q.minOrderQty)  : '—'],
                ['備註',       q.notes ?? '—'],
                ['建立時間',   fmtDate(q.createdAt)],
              ].map(([label, val]) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium">{val}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Items */}
        <TabsContent value="items">
          <Card>
            {isDraft && (
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm text-muted-foreground">DRAFT 狀態可新增/刪除品項</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 新增品項
                </Button>
              </CardHeader>
            )}
            <CardContent className={isDraft ? 'pt-0' : 'pt-4'}>
              {q.items.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">尚無品項</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Variant SKU</TableHead>
                      <TableHead>品名</TableHead>
                      <TableHead>單價</TableHead>
                      <TableHead>單位</TableHead>
                      <TableHead>包裝規格</TableHead>
                      {isDraft && <TableHead className="w-16" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.variant?.variantSku ?? '—'}</TableCell>
                        <TableCell>{item.variant?.masterProduct?.name ?? item.variant?.masterSku ?? '—'}</TableCell>
                        <TableCell className="font-medium">{Number(item.unitPrice).toFixed(4)}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.packingSpec ?? '—'}</TableCell>
                        {isDraft && (
                          <TableCell>
                            <Button variant="ghost" size="sm" className="text-red-400 h-7 w-7 p-0"
                              onClick={() => doDeleteItem(item.id, item.variant?.variantSku ?? item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Versions */}
        <TabsContent value="versions">
          <Card>
            <CardContent className="pt-5 space-y-3">
              {/* Replaced-by (newer versions) */}
              {q.replacedBy.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">本版本被以下版本取代：</p>
                  {q.replacedBy.map(r => (
                    <div key={r.id}
                      className="flex items-center gap-3 p-2 rounded border cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/donghong/supplier-quotations/${r.id}`)}>
                      <GitBranch className="h-4 w-4 text-purple-500" />
                      <span className="font-mono text-sm">{r.quotationNumber}</span>
                      <Badge variant="outline" className="text-xs">{r.status}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{fmtDate(r.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Current */}
              <div className="flex items-center gap-3 p-2 rounded border border-blue-200 bg-blue-50">
                <Link2 className="h-4 w-4 text-blue-500" />
                <span className="font-mono text-sm font-semibold">{q.quotationNumber}</span>
                <Badge variant="outline" className={STATUS_CLASS[q.status]}>{STATUS_LABELS[q.status]}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">目前檢視</span>
              </div>

              {/* Superseded-by (older version this supersedes) */}
              {q.supersededBy && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">本版本取代了：</p>
                  <div className="flex items-center gap-3 p-2 rounded border cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/donghong/supplier-quotations/${q.supersededBy!.id}`)}>
                    <GitBranch className="h-4 w-4 text-slate-400" />
                    <span className="font-mono text-sm">{q.supersededBy.quotationNumber}</span>
                    <Badge variant="outline" className="text-xs">{q.supersededBy.status}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{fmtDate(q.supersededBy.createdAt)}</span>
                  </div>
                </div>
              )}

              {!q.supersededBy && q.replacedBy.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">此為初始版本，尚無版本鏈記錄</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: PO */}
        <TabsContent value="po">
          <Card>
            <CardContent className="pt-5">
              <div className="py-12 text-center text-muted-foreground text-sm">
                <p>M03 採購單功能開發後，此處將顯示引用本報價的採購單。</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add item dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增報價品項</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>產地變體 *</Label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={newItem.variantId}
                onChange={e => setNewItem(p => ({ ...p, variantId: e.target.value }))}
              >
                <option value="">選擇 Variant...</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.variantSku} — {v.masterProduct?.name ?? v.masterSku}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>單價 *</Label>
                <Input type="number" min={0} step={0.0001} placeholder="2.5000"
                  value={newItem.unitPrice}
                  onChange={e => setNewItem(p => ({ ...p, unitPrice: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>單位</Label>
                <Input placeholder="pc" value={newItem.unit}
                  onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>包裝規格</Label>
              <Input placeholder="30pc/pack, 4pack/carton" value={newItem.packingSpec}
                onChange={e => setNewItem(p => ({ ...p, packingSpec: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={doAddItem} disabled={acting}>
              {acting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} 新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isReadonly && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          此報價為唯讀狀態（{STATUS_LABELS[q.status]}），如需修改請從 ACTIVE 版本建立新版本。
        </div>
      )}
    </div>
  )
}
