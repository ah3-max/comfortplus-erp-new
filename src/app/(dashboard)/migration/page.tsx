'use client'

import { useState, useRef } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, Download, CheckCircle2, AlertCircle, Info } from 'lucide-react'

type TabKey = 'customers' | 'products' | 'suppliers' | 'ar' | 'ap' | 'inventory'

interface ImportResult {
  created?: number
  updated?: number
  skipped?: number
  errors?: string[]
}

const TABS: { key: TabKey; color: string }[] = [
  { key: 'customers',  color: 'bg-blue-50 border-blue-200' },
  { key: 'products',   color: 'bg-purple-50 border-purple-200' },
  { key: 'suppliers',  color: 'bg-orange-50 border-orange-200' },
  { key: 'ar',         color: 'bg-green-50 border-green-200' },
  { key: 'ap',         color: 'bg-yellow-50 border-yellow-200' },
  { key: 'inventory',  color: 'bg-red-50 border-red-200' },
]

export default function MigrationPage() {
  const { dict } = useI18n()
  const d = (dict as unknown as Record<string, Record<string, string>>).migration ?? {}
  const [activeTab, setActiveTab] = useState<TabKey>('customers')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const tabConfig: Record<TabKey, { uploadUrl: string; templateUrl: string; accept?: string }> = {
    customers: { uploadUrl: '/api/customers/import',            templateUrl: '/api/customers/import' },
    products:  { uploadUrl: '/api/products/import',             templateUrl: '/api/products/import' },
    suppliers: { uploadUrl: '/api/suppliers/import',            templateUrl: '/api/suppliers/import' },
    ar:        { uploadUrl: '/api/finance/opening-balances?type=ar', templateUrl: '/api/finance/opening-balances?type=ar' },
    ap:        { uploadUrl: '/api/finance/opening-balances?type=ap', templateUrl: '/api/finance/opening-balances?type=ap' },
    inventory: { uploadUrl: '/api/inventory/opening',           templateUrl: '/api/inventory/opening' },
  }

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab)
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setImporting(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(tabConfig[activeTab].uploadUrl, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setResult({ errors: [json.error ?? d.importFailed ?? '匯入失敗'] }); return }
      setResult(json)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const activeColor = TABS.find(t => t.key === activeTab)?.color ?? ''

  const tabLabel = (key: TabKey) => {
    const labels: Record<TabKey, string> = {
      customers: d.tabCustomers ?? '客戶主檔',
      products:  d.tabProducts  ?? '商品主檔',
      suppliers: d.tabSuppliers ?? '供應商主檔',
      ar:        d.tabAr        ?? '應收期初',
      ap:        d.tabAp        ?? '應付期初',
      inventory: d.tabInventory ?? '庫存期初',
    }
    return labels[key]
  }

  const tabHint: Record<TabKey, string> = {
    customers: d.hintCustomers ?? '客戶名稱、分級、地址、電話、聯絡人、床數',
    products:  d.hintProducts  ?? 'SKU、品名、成本價、售價、規格、包裝',
    suppliers: d.hintSuppliers ?? '供應商代碼、名稱、聯絡人、付款條件、國別',
    ar:        d.hintAr        ?? '客戶、發票號、到期日、未收金額（鼎新帳款餘額）',
    ap:        d.hintAp        ?? '供應商、發票號、到期日、未付金額（鼎新帳款餘額）',
    inventory: d.hintInventory ?? 'SKU、倉庫、期初數量（鼎新庫存表）',
  }

  const totalCount = result
    ? (result.created ?? 0) + (result.updated ?? 0)
    : 0

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{d.title ?? '鼎新 A1 資料遷移'}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {d.subtitle ?? '從鼎新 A1 匯出 Excel → 下載範本對照欄位 → 上傳匯入'}
        </p>
      </div>

      {/* Steps Banner */}
      <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-3 text-sm flex-wrap">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
          {d.step1 ?? '從鼎新匯出 Excel'}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
          {d.step2 ?? '下載範本，照欄位貼上資料'}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
          {d.step3 ?? '上傳匯入，確認結果'}
        </span>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all active:scale-[0.97] min-h-[40px] ${
              activeTab === key
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background border-input hover:bg-muted'
            }`}
          >
            {tabLabel(key)}
          </button>
        ))}
      </div>

      {/* Active Tab Card */}
      <div className={`rounded-xl border-2 p-5 space-y-5 ${activeColor}`}>
        {/* Tab title + hint */}
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="font-semibold text-base">{tabLabel(activeTab)}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{tabHint[activeTab]}</p>
          </div>
        </div>

        {/* Download template */}
        <div className="flex items-center gap-3 p-3 bg-background/80 rounded-lg border">
          <div className="flex-1">
            <p className="text-sm font-medium">{d.templateLabel ?? '步驟 2：下載範本'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {d.templateHint ?? '範本包含欄位說明與鼎新欄位對照表'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(tabConfig[activeTab].templateUrl, '_blank')}
            className="shrink-0 min-h-[40px]"
          >
            <Download className="w-4 h-4 mr-1.5" />
            {d.downloadTemplate ?? '下載範本'}
          </Button>
        </div>

        {/* Upload */}
        <div className="space-y-3 p-3 bg-background/80 rounded-lg border">
          <p className="text-sm font-medium">{d.uploadLabel ?? '步驟 3：上傳填好的 Excel'}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-muted hover:file:bg-muted/80 cursor-pointer"
          />
          <Button
            onClick={handleImport}
            disabled={importing}
            className="w-full min-h-[44px]"
          >
            <Upload className="w-4 h-4 mr-2" />
            {importing ? (d.importing ?? '匯入中…') : (d.startImport ?? '開始匯入')}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-lg p-4 space-y-2 ${
            result.errors?.length ? 'bg-destructive/10 border border-destructive/20' : 'bg-emerald-50 border border-emerald-200'
          }`}>
            {totalCount > 0 || (result.skipped !== undefined) ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-medium text-emerald-800">{d.importSuccess ?? '匯入完成'}</span>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2 text-sm">
              {result.created !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-700">{result.created}</p>
                  <p className="text-muted-foreground text-xs">{d.created ?? '新增'}</p>
                </div>
              )}
              {result.updated !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                  <p className="text-muted-foreground text-xs">{d.updated ?? '更新'}</p>
                </div>
              )}
              {result.skipped !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                  <p className="text-muted-foreground text-xs">{d.skipped ?? '略過'}</p>
                </div>
              )}
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{d.errorsLabel ?? '錯誤項目'}</span>
                  <Badge variant="destructive" className="text-xs">{result.errors.length}</Badge>
                </div>
                <ul className="text-xs text-destructive space-y-0.5 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Migration Order Notice */}
      <div className="rounded-xl border bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-semibold">{d.orderTitle ?? '建議匯入順序'}</p>
        <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
          <li>{d.order1 ?? '商品主檔（先建立 SKU）'}</li>
          <li>{d.order2 ?? '供應商主檔（先建立供應商代碼）'}</li>
          <li>{d.order3 ?? '客戶主檔（先建立客戶代碼）'}</li>
          <li>{d.order4 ?? '應收帳款期初（依賴客戶代碼）'}</li>
          <li>{d.order5 ?? '應付帳款期初（依賴供應商代碼）'}</li>
          <li>{d.order6 ?? '庫存期初（依賴商品 SKU）'}</li>
        </ol>
      </div>
    </div>
  )
}
