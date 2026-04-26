'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export default function LtcImportPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorExpanded, setErrorExpanded] = useState(false)

  async function uploadFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('請上傳 .xlsx 或 .xls 格式的 Excel 檔案')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/customers/ltc-import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? '匯入失敗'); return }
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">LTC 機構主檔匯入</h1>
          <p className="text-sm text-muted-foreground">上傳業務 Excel — 自動新建機構或更新現有資料</p>
        </div>
      </div>

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 text-sm text-blue-800 space-y-1">
          <p className="font-medium">匯入規則</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-700">
            <li>第一列必須為表頭（如「機構名稱」、「電話」等）</li>
            <li>系統自動比對表頭名稱，欄位順序不限</li>
            <li>已存在的機構（模糊比對名稱）→ 更新有值欄位</li>
            <li>不存在的機構 → 自動建檔，代碼格式 C#####</li>
            <li>支援欄位：機構名稱、縣市、完整地址、窗口、電話、傳真、Email、床數、區域、使用品牌、業務、歷史紀錄、報價備註、結帳方式、結帳備註、收案對象、提供樣品、他牌股東、最新聯繫、初訪、再追蹤、是否續追、聯繫結果、本月聯繫次數、狀態評分、備註</li>
          </ul>
        </CardContent>
      </Card>

      {/* Drop zone */}
      <Card>
        <CardHeader><CardTitle className="text-base">上傳 Excel 檔案</CardTitle></CardHeader>
        <CardContent>
          <div
            className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
              ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }}
            />
            {loading ? (
              <div className="space-y-2">
                <RefreshCw className="h-10 w-10 mx-auto text-blue-400 animate-spin" />
                <p className="text-sm text-muted-foreground">匯入中，請稍候…</p>
              </div>
            ) : (
              <div className="space-y-3">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-300" />
                <div>
                  <p className="text-sm font-medium text-slate-700">拖放 Excel 至此處，或點擊選擇檔案</p>
                  <p className="text-xs text-muted-foreground mt-1">支援 .xlsx / .xls</p>
                </div>
                <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); inputRef.current?.click() }}>
                  <Upload className="h-4 w-4 mr-1" /> 選擇檔案
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className={result.errors.length > 0 ? 'border-yellow-300' : 'border-green-300'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              匯入完成
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-xs text-green-600">新建機構</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-blue-600">更新機構</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-2xl font-bold text-slate-500">{result.skipped}</p>
                <p className="text-xs text-slate-500">略過（空列）</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-yellow-800"
                  onClick={() => setErrorExpanded(v => !v)}
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {result.errors.length} 筆錯誤（點擊展開）
                  </span>
                  {errorExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {errorExpanded && (
                  <ul className="px-4 pb-3 space-y-1">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-xs text-yellow-700 font-mono">{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setResult(null); if (inputRef.current) inputRef.current.value = '' }}>
                再次匯入
              </Button>
              <Button size="sm" onClick={() => router.push('/customers')}>
                查看客戶列表
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
