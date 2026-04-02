'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Upload, Download, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

interface ImportResult {
  created: number
  skipped: number
  errors: string[]
}

function ImportSection({
  type,
  title,
  description,
}: {
  type: 'ar' | 'ap'
  title: string
  description: string
}) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleDownloadTemplate() {
    try {
      const res = await fetch(`/api/finance/opening-balances?type=${type}`)
      if (!res.ok) { toast.error('下載範本失敗'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'ar' ? 'ar_opening_template.xlsx' : 'ap_opening_template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('下載失敗，請稍後再試')
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('請上傳 Excel 檔案（.xlsx 或 .xls）')
      return
    }

    setUploading(true)
    setResult(null)
    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch(`/api/finance/opening-balances?type=${type}`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '匯入失敗'); return }
      setResult(data)
      if (data.created > 0) {
        toast.success(`匯入完成：新增 ${data.created} 筆`)
      } else {
        toast.info('沒有新增任何資料')
      }
    } catch {
      toast.error('上傳失敗，請稍後再試')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Step 1 */}
        <Card className="border-dashed">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 text-primary w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">1</div>
              <div className="space-y-2 flex-1">
                <p className="font-medium text-sm">下載 Excel 範本</p>
                <p className="text-xs text-muted-foreground">
                  範本包含欄位說明與鼎新 A1 對照表，請依照格式填寫後再上傳。
                </p>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-1.5" />
                  下載範本
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card className="border-dashed">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 text-primary w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">2</div>
              <div className="space-y-2 flex-1">
                <p className="font-medium text-sm">上傳期初資料</p>
                <p className="text-xs text-muted-foreground">
                  填寫完成後上傳 Excel，系統會自動建立{type === 'ar' ? '應收帳款' : '應付帳款'}期初餘額。
                </p>
                <Button
                  variant="outline" size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading
                    ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />上傳中...</>
                    : <><Upload className="h-4 w-4 mr-1.5" />選擇 Excel 檔案</>
                  }
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleUpload}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Result */}
      {result && (
        <div className={`rounded-lg border p-4 ${result.errors.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}>
          <div className="flex items-start gap-2">
            {result.errors.length > 0
              ? <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              : <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            }
            <div className="space-y-2">
              <div className="flex gap-4 text-sm font-medium">
                <span className="text-green-700">新增：{result.created} 筆</span>
                <span className="text-slate-600">略過：{result.skipped} 筆</span>
                {result.errors.length > 0 && (
                  <span className="text-amber-700">錯誤：{result.errors.length} 筆</span>
                )}
              </div>
              {result.errors.length > 0 && (
                <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                  {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 10 && <li>...還有 {result.errors.length - 10} 筆錯誤</li>}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">注意事項</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>每次上傳為「新增」，不會覆蓋已有資料，請確認無重複上傳</li>
            {type === 'ar'
              ? <li>客戶須已存在於系統中（可用代碼或名稱比對）</li>
              : <li>供應商須已存在於系統中（可用代碼或名稱比對）</li>
            }
            <li>未付金額欄位必填，且須大於 0</li>
            <li>建議先小量測試後再大量匯入</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

export default function OpeningBalancesPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" />
          期初餘額匯入
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          從鼎新 A1 或其他系統匯入應收 / 應付帳款期初餘額
        </p>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '應收帳款期初', sub: '由 Excel 匯入', color: 'text-blue-600' },
          { label: '應付帳款期初', sub: '由 Excel 匯入', color: 'text-orange-600' },
          { label: '會計科目期初', sub: '由日記帳設定', color: 'text-purple-600' },
          { label: '庫存期初', sub: '由入庫單建立', color: 'text-green-600' },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="pt-4 pb-4">
              <p className={`text-sm font-semibold ${item.color}`}>{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs: AR / AP */}
      <Tabs defaultValue="ar">
        <TabsList>
          <TabsTrigger value="ar">應收帳款（AR）期初</TabsTrigger>
          <TabsTrigger value="ap">應付帳款（AP）期初</TabsTrigger>
        </TabsList>

        <TabsContent value="ar" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                應收帳款期初餘額
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">AR</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ImportSection
                type="ar"
                title="應收帳款期初"
                description="匯入客戶尚未收清的期初應收帳款。每筆資料會建立一筆 AR 記錄，財務人員可後續進行收款沖帳。"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ap" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                應付帳款期初餘額
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">AP</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ImportSection
                type="ap"
                title="應付帳款期初"
                description="匯入尚未付清的期初應付帳款。每筆資料會建立一筆 AP 記錄，財務人員可後續進行付款沖帳。"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
