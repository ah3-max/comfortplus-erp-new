'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

const ORIGIN_CODES = ['TW_FB', 'CN_KD', 'VN_XX', 'TH_OEM', 'OTHER'] as const
const COUNTRY_OPTIONS = [
  { value: 'TW', label: '台灣' },
  { value: 'CN', label: '中國' },
  { value: 'VN', label: '越南' },
  { value: 'TH', label: '泰國' },
  { value: 'JP', label: '日本' },
  { value: 'OTHER', label: '其他' },
]
const CATEGORY_OPTIONS = ['DIAPER', 'UNDERPAD', 'WIPES', 'CARE', 'OTHER']

interface VariantRow {
  originCode:    typeof ORIGIN_CODES[number] | ''
  countryOrigin: string
  supplierId:    string
  barcode:       string
}

interface Supplier { id: string; name: string }

const emptyVariant = (): VariantRow => ({ originCode: '', countryOrigin: 'TW', supplierId: '', barcode: '' })

export default function NewMasterSkuPage() {
  const router = useRouter()
  const { data: session } = useSession()

  const [masterSku, setMasterSku]   = useState('')
  const [name, setName]             = useState('')
  const [category, setCategory]     = useState('')
  const [series, setSeries]         = useState('')
  const [variants, setVariants]     = useState<VariantRow[]>([emptyVariant()])
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const role = (session?.user?.role as string) ?? ''
  const allowed = ['SUPER_ADMIN', 'GM', 'PROCUREMENT'].includes(role)

  useEffect(() => {
    fetch('/api/suppliers?pageSize=200')
      .then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {})
  }, [])

  const updateVariant = (idx: number, field: keyof VariantRow, value: string) => {
    setVariants(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }
  const addVariant    = () => setVariants(rows => [...rows, emptyVariant()])
  const removeVariant = (idx: number) => setVariants(rows => rows.filter((_, i) => i !== idx))

  const payload = {
    masterSku: masterSku.trim(),
    name:      name.trim(),
    category:  category.trim(),
    ...(series.trim() && { series: series.trim() }),
    variants:  variants
      .filter(v => v.originCode && v.countryOrigin)
      .map(v => ({
        originCode:    v.originCode,
        countryOrigin: v.countryOrigin,
        ...(v.supplierId && { supplierId: v.supplierId }),
        ...(v.barcode    && { barcode: v.barcode }),
      })),
  }

  const isValid =
    payload.masterSku &&
    payload.name &&
    payload.category &&
    payload.variants.length > 0 &&
    payload.variants.every(v => v.originCode && v.countryOrigin)

  const handleSubmit = async () => {
    if (!isValid) { toast.error('請填寫必填欄位'); return }
    setSubmitting(true)
    try {
      const res  = await fetch('/api/donghong/master-skus', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) { toast.error(body.error ?? '建立失敗'); return }
      toast.success(`主檔 SKU ${payload.masterSku} 建立成功`)
      router.push('/donghong/variants')
    } finally {
      setSubmitting(false)
    }
  }

  if (!allowed) {
    return <div className="p-6 text-muted-foreground">權限不足（需要 PROCUREMENT 以上角色）</div>
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">新建主檔 SKU</h1>
          <p className="text-sm text-muted-foreground">建立 Master Product + N 個產地變體</p>
        </div>
      </div>

      {/* Section 1: Master 基本資料 */}
      <div className="border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">主檔資料</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Master SKU *</label>
            <Input
              placeholder="例：CP-I-Night"
              value={masterSku}
              onChange={e => setMasterSku(e.target.value.toUpperCase())}
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">品名 *</label>
            <Input placeholder="例：舒適加夜用尿片" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">類別 *</label>
            <Select value={category} onValueChange={v => { if (v) setCategory(v) }}>
              <SelectTrigger><SelectValue placeholder="選擇類別" /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">系列（選填）</label>
            <Input placeholder="例：夜用系列" value={series} onChange={e => setSeries(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Section 2: Variant 列表 */}
      <div className="border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            產地變體 <Badge variant="outline" className="ml-1">{variants.length}</Badge>
          </h2>
          <Button variant="outline" size="sm" onClick={addVariant}>
            <Plus className="w-4 h-4 mr-1" />新增產地
          </Button>
        </div>

        {variants.map((v, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_1.5fr_1.5fr_auto] gap-2 items-end p-3 bg-muted/30 rounded-md">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">產地代碼 *</label>
              <Select value={v.originCode} onValueChange={val => { if (val) updateVariant(idx, 'originCode', val) }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="代碼" /></SelectTrigger>
                <SelectContent>
                  {ORIGIN_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">產地國家 *</label>
              <Select value={v.countryOrigin} onValueChange={val => { if (val) updateVariant(idx, 'countryOrigin', val) }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">供應商</label>
              <Select value={v.supplierId} onValueChange={val => { if (val) updateVariant(idx, 'supplierId', val) }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="選擇供應商" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">EAN-13 條碼（選填）</label>
              <Input
                className="h-8 text-sm font-mono"
                placeholder="13 位數字"
                value={v.barcode}
                onChange={e => updateVariant(idx, 'barcode', e.target.value.replace(/\D/g, '').slice(0, 13))}
              />
            </div>
            <Button
              variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => removeVariant(idx)}
              disabled={variants.length <= 1}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        {masterSku && (
          <p className="text-xs text-muted-foreground px-1">
            Variant SKU 將自動組合為：{masterSku}-&#123;originCode&#125;
          </p>
        )}
      </div>

      {/* Section 3: 預覽 JSON */}
      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-muted/30"
          onClick={() => setShowPreview(p => !p)}
        >
          <span>預覽 Payload JSON</span>
          {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showPreview && (
          <pre className="px-5 py-4 text-xs bg-muted/20 overflow-auto border-t">
            {JSON.stringify(payload, null, 2)}
          </pre>
        )}
      </div>

      {/* 送出 */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.back()}>取消</Button>
        <Button onClick={handleSubmit} disabled={!isValid || submitting} className="min-w-24">
          {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}送出建立
        </Button>
      </div>
    </div>
  )
}
