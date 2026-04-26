'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Upload, Loader2, CheckCircle2, AlertTriangle, Users, FileText,
  ClipboardList, BarChart2, Building2,
} from 'lucide-react'
import { toast } from 'sonner'

interface PipelineResult {
  summary: { totalRows: number; uniqueCustomers: number; processingTimeMs: number }
  customers: { created: number; updated: number; notFound: string[] }
  logs: { created: number; aiGenerated: number; skipped: number; errors: { row: number; reason: string }[] }
  tasks: { created: number; skipped: number }
  stats: {
    competitors: Record<string, number>
    salesAssignment: Record<string, number>
    ltcStages: Record<string, number>
    totalBeds: number
    monthlyContactsUpdated: number
  }
  anomalies: { name: string; issues: string[] }[]
}

const STAGES = [
  { key: 'upload',    label: '上傳解析',   icon: Upload       },
  { key: 'customers', label: '客戶建檔',   icon: Building2    },
  { key: 'logs',      label: '聯繫紀錄',   icon: FileText     },
  { key: 'tasks',     label: '業務任務',   icon: ClipboardList },
  { key: 'stats',     label: '統計分析',   icon: BarChart2    },
]

export default function LtcPipelinePage() {
  const [dragging, setDragging]   = useState(false)
  const [loading,  setLoading]    = useState(false)
  const [stage,    setStage]      = useState<string | null>(null)
  const [result,   setResult]     = useState<PipelineResult | null>(null)
  const [showAnomalies, setShowAnomalies] = useState(false)
  const [showErrors,    setShowErrors]    = useState(false)

  const runPipeline = useCallback(async (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error('只接受 Excel 檔（.xlsx / .xls）')
      return
    }
    setLoading(true)
    setResult(null)
    setStage('upload')
    try {
      const fd = new FormData()
      fd.append('file', file)
      setStage('customers')
      const res = await fetch('/api/ltc-pipeline', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '匯入失敗')
        return
      }
      setStage('stats')
      setResult(data as PipelineResult)
      toast.success(`完成！建立 ${data.customers.created} 家、更新 ${data.customers.updated} 家機構`)
    } catch (e) {
      toast.error(`匯入失敗：${(e as Error).message}`)
    } finally {
      setLoading(false)
      setStage(null)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) runPipeline(file)
  }, [runPipeline])

  const stageIdx = stage ? STAGES.findIndex(s => s.key === stage) : -1

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-600" />LTC 機構批次匯入
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          一個 Excel 完成：客戶建檔 + 14 戰略欄位 + 聯繫紀錄 + 業務任務 + 競品統計 + 異常標記
        </p>
      </div>

      {/* Progress steps */}
      {loading && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STAGES.map((s, i) => {
            const done    = i < stageIdx
            const current = i === stageIdx
            const Icon = s.icon
            return (
              <div key={s.key} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  done    ? 'bg-emerald-100 text-emerald-700' :
                  current ? 'bg-blue-100 text-blue-700 animate-pulse' :
                            'bg-slate-100 text-slate-400'
                }`}>
                  {current ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                  {s.label}
                </div>
                {i < STAGES.length - 1 && <div className="h-px w-3 bg-slate-200 shrink-0" />}
              </div>
            )
          })}
        </div>
      )}

      {/* Drop zone */}
      <Card className={`border-2 border-dashed transition-colors ${
        dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50/40'
      }`}>
        <CardContent className="py-12">
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            className="flex flex-col items-center gap-4 text-center"
          >
            {loading ? (
              <>
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                <p className="text-sm font-medium text-blue-700">正在執行 Pipeline…</p>
                <p className="text-xs text-muted-foreground">AI 自動補空白內容中，請稍候</p>
              </>
            ) : (
              <>
                <Upload className={`h-12 w-12 ${dragging ? 'text-blue-500' : 'text-slate-400'}`} />
                <div>
                  <p className="font-semibold text-slate-700">拖入 Excel 檔案，或點按鈕選擇</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    支援欄位：機構名稱、縣市、床數、使用品牌、業務、銷售階段、聯繫日期、內容、結果…
                  </p>
                </div>
                <input type="file" id="pipeline-file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) runPipeline(f); e.target.value = '' }} />
                <Button onClick={() => document.getElementById('pipeline-file')?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px] px-6 gap-2">
                  <Upload className="h-4 w-4" />選擇 Excel 檔
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '新建機構', value: result.customers.created,  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { label: '更新機構', value: result.customers.updated,  color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: '聯繫紀錄', value: result.logs.created,       color: 'bg-violet-50 text-violet-700 border-violet-200' },
              { label: '業務任務', value: result.tasks.created,      color: 'bg-amber-50 text-amber-700 border-amber-200' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs font-medium mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Competitor stats */}
            {Object.keys(result.stats.competitors).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <BarChart2 className="h-4 w-4 text-blue-500" />競品分佈
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(result.stats.competitors)
                    .sort((a, b) => b[1] - a[1])
                    .map(([brand, count]) => (
                      <div key={brand} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{brand}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${Math.round(count / Math.max(...Object.values(result.stats.competitors)) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}

            {/* Sales assignment */}
            {Object.keys(result.stats.salesAssignment).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-violet-500" />業務指派
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(result.stats.salesAssignment)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{name}</span>
                        <Badge variant="secondary" className="text-xs">{count} 家</Badge>
                      </div>
                    ))}
                  {result.stats.totalBeds > 0 && (
                    <p className="text-xs text-muted-foreground pt-1 border-t">
                      總床數：{result.stats.totalBeds.toLocaleString()} 床
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stage funnel */}
            {Object.keys(result.stats.ltcStages).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-amber-500" />銷售漏斗
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {Object.entries(result.stats.ltcStages)
                    .sort((a, b) => b[1] - a[1])
                    .map(([stage, count]) => (
                      <div key={stage} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{stage}</span>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}

            {/* AI & timing */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">處理摘要</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">總列數</span><span>{result.summary.totalRows}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">唯一機構</span><span>{result.summary.uniqueCustomers}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">AI 補空白</span><span>{result.logs.aiGenerated} 筆</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">本月聯繫更新</span><span>{result.stats.monthlyContactsUpdated} 家</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">處理時間</span>
                  <span>{(result.summary.processingTimeMs / 1000).toFixed(1)} 秒</span></div>
              </CardContent>
            </Card>
          </div>

          {/* Anomalies */}
          {result.anomalies.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-amber-700">
                    <AlertTriangle className="h-4 w-4" />異常標記（{result.anomalies.length} 家）
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs h-7"
                    onClick={() => setShowAnomalies(v => !v)}>
                    {showAnomalies ? '收起' : '展開'}
                  </Button>
                </div>
              </CardHeader>
              {showAnomalies && (
                <CardContent className="max-h-64 overflow-y-auto space-y-1.5">
                  {result.anomalies.map(a => (
                    <div key={a.name} className="flex items-start gap-2 text-sm py-1 border-b last:border-0">
                      <span className="font-medium text-slate-700 min-w-0 flex-1">{a.name}</span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {a.issues.map(issue => (
                          <Badge key={issue} variant="secondary"
                            className="text-xs bg-amber-50 text-amber-700 border-amber-200">{issue}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* Import errors */}
          {result.logs.errors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-red-700">
                    <AlertTriangle className="h-4 w-4" />匯入錯誤（{result.logs.errors.length} 筆）
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs h-7"
                    onClick={() => setShowErrors(v => !v)}>
                    {showErrors ? '收起' : '展開'}
                  </Button>
                </div>
              </CardHeader>
              {showErrors && (
                <CardContent className="max-h-48 overflow-y-auto space-y-1 text-xs text-red-700">
                  {result.logs.errors.map((e, i) => (
                    <div key={i}>第 {e.row} 列：{e.reason}</div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* All done */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">
              Pipeline 完成 — {result.customers.created + result.customers.updated} 家機構、
              {result.logs.created} 筆聯繫紀錄、{result.tasks.created} 個業務任務已寫入。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
