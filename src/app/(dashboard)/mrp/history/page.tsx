'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2, ArrowLeft, Download, Eye, GitCompare,
  AlertCircle, AlertTriangle, Clock, CheckCircle2, Package,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Snapshot {
  id: string
  runAt: string
  skuCount: number
  alertCount: number
  notes: string | null
  runBy: { name: string }
}

interface MrpSkuResult {
  productId: string; sku: string; productName: string; category: string
  avgMonthlyDemand: number; forecastNextMonth: number
  currentStock: number; availableStock: number; safetyStock: number
  inTransitQty: number; netRequirement: number
  supplierName: string | null; suggestedOrderQty: number; suggestedOrderDate: string | null
  urgency: 'CRITICAL' | 'WARNING' | 'NORMAL' | 'OK'; urgencyReason: string
}

interface MrpResult {
  runAt: string
  skus: MrpSkuResult[]
  summary: { totalSkus: number; criticalCount: number; warningCount: number; normalCount: number; okCount: number }
}

const URGENCY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  WARNING: 'bg-amber-100 text-amber-800',
  NORMAL: 'bg-blue-100 text-blue-800',
  OK: 'bg-green-100 text-green-800',
}
const URGENCY_LABEL: Record<string, string> = { CRITICAL: '立即採購', WARNING: '注意', NORMAL: '正常', OK: '充足' }

const URGENCY_ICON = {
  CRITICAL: AlertCircle,
  WARNING: AlertTriangle,
  NORMAL: Clock,
  OK: CheckCircle2,
}

function fmt(n: number) { return n.toLocaleString('zh-TW') }

// ── Compare helpers ────────────────────────────────────────────────────────────

const URGENCY_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, NORMAL: 2, OK: 3 }

function urgencyDelta(before: string, after: string): 'better' | 'worse' | 'same' {
  const diff = URGENCY_ORDER[after] - URGENCY_ORDER[before]
  if (diff < 0) return 'worse'
  if (diff > 0) return 'better'
  return 'same'
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MrpHistoryPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [viewSnapshot, setViewSnapshot] = useState<(Snapshot & { result: MrpResult }) | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const [compareData, setCompareData] = useState<{
    a: Snapshot & { result: MrpResult }
    b: Snapshot & { result: MrpResult }
  } | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/mrp/snapshots')
      .then(r => r.json())
      .then(d => setSnapshots(d.data ?? []))
      .catch(() => toast.error('載入失敗'))
      .finally(() => setLoading(false))
  }, [])

  const loadSnapshot = useCallback(async (id: string) => {
    setViewLoading(true)
    try {
      const res = await fetch(`/api/mrp/snapshots?id=${id}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setViewSnapshot(data)
    } catch { toast.error('載入失敗') }
    finally { setViewLoading(false) }
  }, [])

  async function handleCompare() {
    if (!compareA || !compareB || compareA === compareB) {
      toast.error('請選擇兩個不同的快照進行比較')
      return
    }
    setCompareLoading(true)
    try {
      const [ra, rb] = await Promise.all([
        fetch(`/api/mrp/snapshots?id=${compareA}`).then(r => r.json()),
        fetch(`/api/mrp/snapshots?id=${compareB}`).then(r => r.json()),
      ])
      setCompareData({ a: ra, b: rb })
    } catch { toast.error('比較載入失敗') }
    finally { setCompareLoading(false) }
  }

  async function handleExport(id: string) {
    setExporting(id)
    try {
      const res = await fetch(`/api/mrp/export?id=${id}`)
      if (!res.ok) { toast.error('匯出失敗'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = res.headers.get('content-disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? 'mrp.xlsx'
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('匯出失敗') }
    finally { setExporting(null) }
  }

  // ── Compare view ─────────────────────────────────────────────────────────────

  function CompareView() {
    if (!compareData) return null
    const { a, b } = compareData

    const skuMapA = new Map(a.result.skus.map(s => [s.productId, s]))
    const skuMapB = new Map(b.result.skus.map(s => [s.productId, s]))
    const allIds = [...new Set([...skuMapA.keys(), ...skuMapB.keys()])]

    const rows = allIds.map(id => ({
      skuA: skuMapA.get(id),
      skuB: skuMapB.get(id),
    })).filter(r => r.skuA && r.skuB && r.skuA.urgency !== r.skuB.urgency)

    return (
      <Dialog open onOpenChange={() => setCompareData(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>快照比較</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div className="border rounded p-2">
              <p className="font-medium">快照 A（較早）</p>
              <p className="text-muted-foreground">{new Date(a.runAt).toLocaleString('zh-TW')}</p>
              <p className="text-muted-foreground">by {a.runBy.name}</p>
            </div>
            <div className="border rounded p-2">
              <p className="font-medium">快照 B（較新）</p>
              <p className="text-muted-foreground">{new Date(b.runAt).toLocaleString('zh-TW')}</p>
              <p className="text-muted-foreground">by {b.runBy.name}</p>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">兩份快照的 SKU 緊急程度完全相同</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-2">共 {rows.length} 個 SKU 狀態有變化</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>品名</TableHead>
                    <TableHead>快照 A</TableHead>
                    <TableHead>快照 B</TableHead>
                    <TableHead>變化</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ skuA, skuB }) => {
                    const delta = urgencyDelta(skuA!.urgency, skuB!.urgency)
                    return (
                      <TableRow key={skuA!.productId}>
                        <TableCell className="font-mono text-sm">{skuA!.sku}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{skuA!.productName}</TableCell>
                        <TableCell>
                          <Badge className={`${URGENCY_BADGE[skuA!.urgency]} text-xs`}>
                            {URGENCY_LABEL[skuA!.urgency]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${URGENCY_BADGE[skuB!.urgency]} text-xs`}>
                            {URGENCY_LABEL[skuB!.urgency]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={
                            delta === 'worse' ? 'text-red-600 font-medium' :
                            delta === 'better' ? 'text-green-600 font-medium' : ''
                          }>
                            {delta === 'worse' ? '↑ 惡化' : delta === 'better' ? '↓ 改善' : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  // ── View snapshot dialog ──────────────────────────────────────────────────────

  function SnapshotView() {
    if (!viewSnapshot) return null
    const { result } = viewSnapshot
    const UrgencyIcon = (u: string) => {
      const I = URGENCY_ICON[u as keyof typeof URGENCY_ICON] ?? Package
      return <I className="h-4 w-4" />
    }
    return (
      <Dialog open onOpenChange={() => setViewSnapshot(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              MRP 快照 — {new Date(viewSnapshot.runAt).toLocaleString('zh-TW')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {[
              { label: '總 SKU', value: result.summary.totalSkus, color: 'text-slate-700' },
              { label: '立即採購', value: result.summary.criticalCount, color: 'text-red-600' },
              { label: '注意', value: result.summary.warningCount, color: 'text-amber-600' },
              { label: '正常', value: result.summary.normalCount, color: 'text-blue-600' },
              { label: '充足', value: result.summary.okCount, color: 'text-green-600' },
            ].map(c => (
              <Card key={c.label}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>狀態</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>品名</TableHead>
                  <TableHead className="text-right">月均需求</TableHead>
                  <TableHead className="text-right">可用庫存</TableHead>
                  <TableHead className="text-right">淨需求</TableHead>
                  <TableHead>供應商</TableHead>
                  <TableHead className="text-right">建議採購</TableHead>
                  <TableHead>下單日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.skus.map(s => (
                  <TableRow key={s.productId} className={s.urgency === 'CRITICAL' ? 'bg-red-50/40' : ''}>
                    <TableCell>
                      <Badge className={`${URGENCY_BADGE[s.urgency]} text-xs`}>
                        {URGENCY_LABEL[s.urgency]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{s.sku}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{s.productName}</TableCell>
                    <TableCell className="text-right">{fmt(s.avgMonthlyDemand)}</TableCell>
                    <TableCell className="text-right">{fmt(s.availableStock)}</TableCell>
                    <TableCell className={`text-right font-medium ${s.netRequirement > 0 ? 'text-red-600' : ''}`}>
                      {s.netRequirement > 0 ? fmt(s.netRequirement) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{s.supplierName ?? '—'}</TableCell>
                    <TableCell className="text-right">{s.suggestedOrderQty > 0 ? fmt(s.suggestedOrderQty) : '—'}</TableCell>
                    <TableCell className={`text-sm ${s.urgency === 'CRITICAL' ? 'text-red-600 font-medium' : ''}`}>
                      {s.suggestedOrderDate ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/mrp" className="inline-flex items-center gap-1 h-8 px-3 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />返回 MRP
          </Link>
          <div>
            <h1 className="text-xl font-bold">MRP 歷史快照</h1>
            <p className="text-sm text-muted-foreground">保留最近 50 次計算結果</p>
          </div>
        </div>
      </div>

      {/* Compare selector */}
      {snapshots.length >= 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitCompare className="h-4 w-4" /> 快照比較
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="border rounded px-2 py-1 text-sm"
                value={compareA}
                onChange={e => setCompareA(e.target.value)}
              >
                <option value="">選擇快照 A（較早）</option>
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.runAt).toLocaleString('zh-TW')} — {s.runBy.name}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">vs</span>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={compareB}
                onChange={e => setCompareB(e.target.value)}
              >
                <option value="">選擇快照 B（較新）</option>
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.runAt).toLocaleString('zh-TW')} — {s.runBy.name}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={handleCompare} disabled={compareLoading || !compareA || !compareB}>
                {compareLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <GitCompare className="h-4 w-4 mr-1" />}
                比較
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snapshot list */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : snapshots.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">尚無計算紀錄</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>計算時間</TableHead>
                  <TableHead>執行人</TableHead>
                  <TableHead className="text-right">SKU 數</TableHead>
                  <TableHead className="text-right">需注意</TableHead>
                  <TableHead className="w-36">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {new Date(s.runAt).toLocaleString('zh-TW')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.runBy.name}</TableCell>
                    <TableCell className="text-right">{s.skuCount}</TableCell>
                    <TableCell className="text-right">
                      {s.alertCount > 0 ? (
                        <span className="text-amber-600 font-medium">{s.alertCount}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2"
                          onClick={() => loadSnapshot(s.id)} disabled={viewLoading}>
                          <Eye className="h-3.5 w-3.5 mr-1" />查看
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2"
                          onClick={() => handleExport(s.id)} disabled={exporting === s.id}>
                          {exporting === s.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SnapshotView />
      <CompareView />
    </div>
  )
}
