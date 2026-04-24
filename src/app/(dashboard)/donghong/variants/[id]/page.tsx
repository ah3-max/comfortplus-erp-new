'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ArrowLeft, Pencil, Loader2, Plus, PowerOff } from 'lucide-react'
import { toast } from 'sonner'

const COUNTRY_LABELS: Record<string, string> = {
  TW: '台灣', CN: '中國', VN: '越南', TH: '泰國', JP: '日本', OTHER: '其他',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('zh-TW')
}
function fmtDecimal(v: string | number, dp = 4) {
  return Number(v).toLocaleString('zh-TW', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

interface Barcode { id: string; barcodeEan13: string; barcodeType: string; quantityPerUnit: number; notes: string | null; createdAt: string }
interface CostSnapshot { id: string; unitCost: string; currency: string; unitCostTwd: string; exchangeRate: string; effectiveDate: string; notes: string | null }
interface VariantDetail {
  id: string; variantSku: string; masterSku: string; originCode: string; countryOrigin: string
  hsCode: string | null; productImage: string | null; packageImage: string | null
  isActive: boolean; businessUnit: string; createdAt: string; updatedAt: string
  barcodes: Barcode[]
  costSnapshots: CostSnapshot[]
  masterProduct: { id: string; sku: string; name: string } | null
  supplier: { id: string; name: string } | null
}

export default function VariantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { data: session } = useSession()

  const [variant, setVariant]     = useState<VariantDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(false)
  const [editForm, setEditForm]   = useState({ hsCode: '', isActive: true })
  const [saving, setSaving]       = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [barcodeOpen, setBarcodeOpen]       = useState(false)
  const [barcodeInput, setBarcodeInput]     = useState('')
  const [barcodeType, setBarcodeType]       = useState('SINGLE')
  const [barcodeNotes, setBarcodeNotes]     = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [costSnapshots, setCostSnapshots]   = useState<CostSnapshot[]>([])
  const [costLoading, setCostLoading]       = useState(false)

  const role = (session?.user?.role as string) ?? ''
  const canManage = ['SUPER_ADMIN', 'GM', 'PROCUREMENT'].includes(role)
  const canSeeCost = ['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'FINANCE'].includes(role)

  const fetchVariant = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/donghong/variants/${id}`)
      if (!res.ok) { toast.error('載入失敗'); return }
      const data = await res.json()
      setVariant(data)
      setEditForm({ hsCode: data.hsCode ?? '', isActive: data.isActive })
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchCostHistory = useCallback(async () => {
    if (!canSeeCost) return
    setCostLoading(true)
    try {
      const res  = await fetch(`/api/donghong/variants/${id}/cost-history?pageSize=50`)
      if (!res.ok) return
      const data = await res.json()
      setCostSnapshots(data.data)
    } finally {
      setCostLoading(false)
    }
  }, [id, canSeeCost])

  useEffect(() => { fetchVariant() }, [fetchVariant])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/donghong/variants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hsCode: editForm.hsCode || null }),
      })
      if (!res.ok) { toast.error('儲存失敗'); return }
      toast.success('已儲存')
      setEditing(false)
      fetchVariant()
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    const res = await fetch(`/api/donghong/variants/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json()
      toast.error(body.error ?? '停用失敗')
    } else {
      toast.success('已停用')
      router.push('/donghong/variants')
    }
    setDeactivateOpen(false)
  }

  const handleAddBarcode = async () => {
    setBarcodeLoading(true)
    try {
      const res = await fetch(`/api/donghong/variants/${id}/barcodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcodeEan13: barcodeInput, barcodeType, notes: barcodeNotes || null }),
      })
      const body = await res.json()
      if (!res.ok) { toast.error(body.error ?? '新增失敗'); return }
      toast.success('條碼已新增')
      setBarcodeOpen(false)
      setBarcodeInput('')
      setBarcodeNotes('')
      fetchVariant()
    } finally {
      setBarcodeLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!variant) return <div className="p-6 text-muted-foreground">找不到此變體</div>

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold font-mono">{variant.variantSku}</h1>
            <p className="text-sm text-muted-foreground">{variant.masterProduct?.name ?? variant.masterSku}</p>
          </div>
          <Badge variant={variant.isActive ? 'default' : 'secondary'}>
            {variant.isActive ? '啟用' : '停用'}
          </Badge>
        </div>
        {canManage && variant.isActive && (
          <Button variant="destructive" size="sm" onClick={() => setDeactivateOpen(true)}>
            <PowerOff className="w-4 h-4 mr-1" />停用
          </Button>
        )}
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">基本資料</TabsTrigger>
          <TabsTrigger value="barcodes">條碼管理</TabsTrigger>
          {canSeeCost && <TabsTrigger value="cost" onClick={fetchCostHistory}>成本歷史</TabsTrigger>}
          <TabsTrigger value="po">關聯 PO</TabsTrigger>
        </TabsList>

        {/* Tab 1: 基本資料 */}
        <TabsContent value="info" className="mt-4">
          <div className="border rounded-lg p-5 space-y-4">
            <div className="flex justify-end">
              {canManage && !editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="w-4 h-4 mr-1" />編輯
                </Button>
              )}
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              {[
                ['Variant SKU', variant.variantSku],
                ['Master SKU',  variant.masterSku],
                ['產地代碼',    variant.originCode],
                ['產地',        COUNTRY_LABELS[variant.countryOrigin] ?? variant.countryOrigin],
                ['供應商',      variant.supplier?.name ?? '—'],
                ['業務單位',    variant.businessUnit],
                ['建立時間',    fmtDate(variant.createdAt)],
                ['最後更新',    fmtDate(variant.updatedAt)],
              ].map(([label, val]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium mt-0.5">{val}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground">HS Code</dt>
                <dd className="mt-0.5">
                  {editing ? (
                    <Input
                      value={editForm.hsCode}
                      onChange={e => setEditForm(f => ({ ...f, hsCode: e.target.value }))}
                      placeholder="例：6111.20.00"
                      className="h-7 text-sm"
                    />
                  ) : (
                    <span className="font-medium">{variant.hsCode ?? '—'}</span>
                  )}
                </dd>
              </div>
            </dl>
            {editing && (
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); setEditForm({ hsCode: variant.hsCode ?? '', isActive: variant.isActive }) }}>
                  取消
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}儲存
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: 條碼管理 */}
        <TabsContent value="barcodes" className="mt-4">
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <span className="text-sm font-medium">條碼列表</span>
              {canManage && (
                <Button size="sm" onClick={() => setBarcodeOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />新增條碼
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>EAN-13</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>每單位數量</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead>建立時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variant.barcodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">無條碼資料</TableCell>
                  </TableRow>
                ) : (
                  variant.barcodes.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono">{b.barcodeEan13}</TableCell>
                      <TableCell>{b.barcodeType}</TableCell>
                      <TableCell>{b.quantityPerUnit}</TableCell>
                      <TableCell className="text-muted-foreground">{b.notes ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(b.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 3: 成本歷史 */}
        {canSeeCost && (
          <TabsContent value="cost" className="mt-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>生效日期</TableHead>
                    <TableHead className="text-right">成本（原幣）</TableHead>
                    <TableHead>幣別</TableHead>
                    <TableHead className="text-right">匯率</TableHead>
                    <TableHead className="text-right">成本（TWD）</TableHead>
                    <TableHead>備註</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : costSnapshots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">無成本紀錄</TableCell>
                    </TableRow>
                  ) : (
                    costSnapshots.map(s => (
                      <TableRow key={s.id}>
                        <TableCell>{fmtDate(s.effectiveDate)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtDecimal(s.unitCost)}</TableCell>
                        <TableCell><Badge variant="outline">{s.currency}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{fmtDecimal(s.exchangeRate, 4)}</TableCell>
                        <TableCell className="text-right font-mono">
                          NT${fmtDecimal(s.unitCostTwd, 2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.notes ?? '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {/* Tab 4: 關聯 PO（佔位） */}
        <TabsContent value="po" className="mt-4">
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            關聯 PO 功能將於 M03（SupplierQuotation + PurchaseOrder 整合）完成後上線
          </div>
        </TabsContent>
      </Tabs>

      {/* 停用確認 Dialog */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>確認停用？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            停用後此變體將不再顯示於正常列表。若有活躍 PO 引用將無法停用。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDeactivate}>確認停用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增條碼 Dialog */}
      <Dialog open={barcodeOpen} onOpenChange={setBarcodeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增條碼</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">EAN-13 條碼 *</label>
              <Input
                placeholder="13 位數字"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value.replace(/\D/g, '').slice(0, 13))}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="text-sm font-medium">條碼類型</label>
              <Input value={barcodeType} onChange={e => setBarcodeType(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">備註（選填）</label>
              <Input value={barcodeNotes} onChange={e => setBarcodeNotes(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBarcodeOpen(false)}>取消</Button>
            <Button onClick={handleAddBarcode} disabled={barcodeInput.length !== 13 || barcodeLoading}>
              {barcodeLoading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
