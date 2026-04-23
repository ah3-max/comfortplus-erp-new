'use client'

import { useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2, Play, Upload, AlertTriangle, AlertCircle, Clock, CheckCircle2,
  Package, TrendingDown, Search, FileSpreadsheet, Info,
} from 'lucide-react'
import { toast } from 'sonner'

interface MrpSkuResult {
  productId: string; sku: string; productName: string; category: string
  avgMonthlyDemand: number; demandMonths: number; forecastNextMonth: number
  currentStock: number; availableStock: number; safetyStock: number; reservedQty: number
  inTransitQty: number; inTransitPoNos: string[]
  netRequirement: number; daysUntilSafetyStock: number; burndownDate: string | null
  supplierId: string | null; supplierName: string | null; leadTimeDays: number; moq: number
  suggestedOrderQty: number; suggestedOrderDate: string | null
  urgency: 'CRITICAL' | 'WARNING' | 'NORMAL' | 'OK'; urgencyReason: string
}

interface MrpResult {
  runAt: string
  skus: MrpSkuResult[]
  summary: { totalSkus: number; criticalCount: number; warningCount: number; normalCount: number; okCount: number }
}

const URGENCY_STYLE = {
  CRITICAL: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800', icon: AlertCircle, color: 'text-red-600' },
  WARNING:  { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-800', icon: AlertTriangle, color: 'text-amber-600' },
  NORMAL:   { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-800', icon: Clock, color: 'text-blue-600' },
  OK:       { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800', icon: CheckCircle2, color: 'text-green-600' },
}

const URGENCY_LABEL = { CRITICAL: '立即採購', WARNING: '注意', NORMAL: '正常', OK: '充足' }

function fmt(n: number) { return n.toLocaleString('zh-TW') }

export default function MrpPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const canUpload = ['SUPER_ADMIN', 'GM', 'PROCUREMENT'].includes(role)

  const [result, setResult] = useState<MrpResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState<string>('')
  const [detailSku, setDetailSku] = useState<MrpSkuResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ imported: number; errors?: string[]; unknownSkus?: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const runMrp = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mrp')
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'MRP 計算失敗'); return }
      setResult(json)
      toast.success(`MRP 計算完成，${json.summary.totalSkus} 個 SKU`)
    } catch { toast.error('MRP 計算失敗') }
    finally { setLoading(false) }
  }, [])

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/mrp/upload-history', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? '匯入失敗'); return }
      setUploadResult(json)
      toast.success(`已匯入 ${json.imported} 筆歷史需求資料`)
    } catch { toast.error('匯入失敗') }
    finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const filtered = result?.skus.filter(s => {
    if (urgencyFilter && s.urgency !== urgencyFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return s.sku.toLowerCase().includes(q) || s.productName.toLowerCase().includes(q) || (s.supplierName?.toLowerCase().includes(q) ?? false)
    }
    return true
  }) ?? []

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">MRP 物料需求規劃</h1>
          <p className="text-sm text-muted-foreground mt-0.5">銷售預測 → 淨需求 → 採購建議</p>
        </div>
        <div className="flex gap-2">
          {canUpload && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                匯入歷史數據
              </Button>
            </>
          )}
          <Button size="sm" onClick={runMrp} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {loading ? '計算中…' : '執行 MRP'}
          </Button>
        </div>
      </div>

      {/* Upload result */}
      {uploadResult && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-green-700">匯入完成：{uploadResult.imported} 筆</p>
                {uploadResult.unknownSkus && uploadResult.unknownSkus.length > 0 && (
                  <p className="text-amber-600">找不到的 SKU：{uploadResult.unknownSkus.join(', ')}</p>
                )}
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="text-red-600">
                    {uploadResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Excel format hint */}
      {canUpload && !result && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">Excel 格式說明</p>
                <p>支援兩種格式：</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border rounded p-2">
                    <p className="font-medium mb-1">直式（推薦）</p>
                    <p className="font-mono text-xs">SKU | 月份 | 數量 | 備註</p>
                    <p className="font-mono text-xs text-muted-foreground">A001 | 2024-01 | 500 | ...</p>
                  </div>
                  <div className="border rounded p-2">
                    <p className="font-medium mb-1">橫式（樞紐）</p>
                    <p className="font-mono text-xs">SKU | 2024-01 | 2024-02 | ...</p>
                    <p className="font-mono text-xs text-muted-foreground">A001 | 500 | 480 | ...</p>
                  </div>
                </div>
                <p>第一列標題需包含「SKU」或「品號」。月份格式 YYYY-MM。</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: '總 SKU', value: result.summary.totalSkus, icon: Package, color: 'text-slate-700', filter: '' },
              { label: '立即採購', value: result.summary.criticalCount, icon: AlertCircle, color: 'text-red-600', filter: 'CRITICAL' },
              { label: '注意', value: result.summary.warningCount, icon: AlertTriangle, color: 'text-amber-600', filter: 'WARNING' },
              { label: '正常', value: result.summary.normalCount, icon: Clock, color: 'text-blue-600', filter: 'NORMAL' },
              { label: '充足', value: result.summary.okCount, icon: CheckCircle2, color: 'text-green-600', filter: 'OK' },
            ].map(c => (
              <Card key={c.label} className={`cursor-pointer transition-colors ${urgencyFilter === c.filter ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setUrgencyFilter(urgencyFilter === c.filter ? '' : c.filter)}>
                <CardContent className="p-3 flex items-center gap-2">
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="搜尋 SKU / 品名 / 供應商..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Results table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">狀態</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>品名</TableHead>
                    <TableHead className="text-right">月均需求</TableHead>
                    <TableHead className="text-right">現有庫存</TableHead>
                    <TableHead className="text-right">安全庫存</TableHead>
                    <TableHead className="text-right">在途</TableHead>
                    <TableHead className="text-right">淨需求</TableHead>
                    <TableHead>供應商</TableHead>
                    <TableHead className="text-right">建議採購</TableHead>
                    <TableHead>建議下單日</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        {search || urgencyFilter ? '無符合條件的結果' : '無資料'}
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(s => {
                    const style = URGENCY_STYLE[s.urgency]
                    return (
                      <TableRow key={s.productId} className={`cursor-pointer hover:bg-slate-50 ${s.urgency === 'CRITICAL' ? 'bg-red-50/40' : ''}`}
                        onClick={() => setDetailSku(s)}>
                        <TableCell>
                          <Badge className={`${style.badge} text-xs`}>{URGENCY_LABEL[s.urgency]}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{s.sku}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{s.productName}</TableCell>
                        <TableCell className="text-right">{fmt(s.avgMonthlyDemand)}</TableCell>
                        <TableCell className="text-right">{fmt(s.currentStock)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(s.safetyStock)}</TableCell>
                        <TableCell className="text-right">{s.inTransitQty > 0 ? fmt(s.inTransitQty) : '—'}</TableCell>
                        <TableCell className={`text-right font-medium ${s.netRequirement > 0 ? 'text-red-600' : ''}`}>
                          {s.netRequirement > 0 ? fmt(s.netRequirement) : '—'}
                        </TableCell>
                        <TableCell className="text-sm">{s.supplierName ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {s.suggestedOrderQty > 0 ? fmt(s.suggestedOrderQty) : '—'}
                        </TableCell>
                        <TableCell className={`text-sm ${s.urgency === 'CRITICAL' ? 'text-red-600 font-medium' : ''}`}>
                          {s.suggestedOrderDate ?? '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            計算時間：{new Date(result.runAt).toLocaleString('zh-TW')} · 共 {result.summary.totalSkus} 個 SKU
          </p>
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailSku} onOpenChange={() => setDetailSku(null)}>
        <DialogContent className="max-w-lg">
          {detailSku && (() => {
            const style = URGENCY_STYLE[detailSku.urgency]
            const UrgencyIcon = style.icon
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UrgencyIcon className={`h-5 w-5 ${style.color}`} />
                    {detailSku.sku} — {detailSku.productName}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className={`rounded-lg border p-3 ${style.bg}`}>
                    <p className={`text-sm font-medium ${style.color}`}>{detailSku.urgencyReason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-2">
                      <p className="font-medium text-muted-foreground">需求分析</p>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>月均需求</span><span className="font-medium">{fmt(detailSku.avgMonthlyDemand)}</span></div>
                        <div className="flex justify-between"><span>歷史月數</span><span>{detailSku.demandMonths} 個月</span></div>
                        <div className="flex justify-between"><span>下月預測</span><span className="font-medium">{fmt(detailSku.forecastNextMonth)}</span></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-muted-foreground">庫存狀態</p>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>帳面庫存</span><span>{fmt(detailSku.currentStock)}</span></div>
                        <div className="flex justify-between"><span>可用庫存</span><span className="font-medium">{fmt(detailSku.availableStock)}</span></div>
                        <div className="flex justify-between"><span>安全庫存</span><span>{fmt(detailSku.safetyStock)}</span></div>
                        <div className="flex justify-between"><span>已預留</span><span>{fmt(detailSku.reservedQty)}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-2">
                      <p className="font-medium text-muted-foreground">供應商</p>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>供應商</span><span>{detailSku.supplierName ?? '未設定'}</span></div>
                        <div className="flex justify-between"><span>交期</span><span>{detailSku.leadTimeDays} 天</span></div>
                        <div className="flex justify-between"><span>MOQ</span><span>{fmt(detailSku.moq)}</span></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-muted-foreground">在途採購</p>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>在途數量</span><span>{fmt(detailSku.inTransitQty)}</span></div>
                        {detailSku.inTransitPoNos.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            PO: {detailSku.inTransitPoNos.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {detailSku.netRequirement > 0 && (
                    <div className="border-t pt-3 space-y-2">
                      <p className="font-medium text-sm">採購建議</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between"><span>淨需求</span><span className="font-medium text-red-600">{fmt(detailSku.netRequirement)}</span></div>
                        <div className="flex justify-between"><span>建議採購量</span><span className="font-bold text-lg">{fmt(detailSku.suggestedOrderQty)}</span></div>
                        <div className="flex justify-between"><span>安全庫存觸及日</span><span>{detailSku.burndownDate ?? '—'}</span></div>
                        <div className="flex justify-between"><span>建議下單日</span>
                          <span className={detailSku.urgency === 'CRITICAL' ? 'text-red-600 font-medium' : ''}>
                            {detailSku.suggestedOrderDate ?? '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
