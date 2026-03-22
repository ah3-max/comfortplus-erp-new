'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, BookOpen, AlertCircle, Package, Award, GraduationCap, Loader2, FileText } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

const ENTRY_TYPES = [
  { key: null, label: '全部' },
  { key: 'INCIDENT_CASE', label: '客訴案例', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  { key: 'PRODUCT_FAQ', label: '產品FAQ', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Package },
  { key: 'BRAND_COMPARISON', label: '品牌比較', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Award },
  { key: 'TRAINING_CASE', label: '教育訓練', color: 'bg-green-100 text-green-700 border-green-200', icon: GraduationCap },
  { key: 'BATCH_ISSUE', label: '批號問題', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: FileText },
] as const

const TYPE_BADGE: Record<string, string> = {
  INCIDENT_CASE: 'bg-red-100 text-red-700 border-red-200',
  PRODUCT_FAQ: 'bg-blue-100 text-blue-700 border-blue-200',
  BRAND_COMPARISON: 'bg-purple-100 text-purple-700 border-purple-200',
  TRAINING_CASE: 'bg-green-100 text-green-700 border-green-200',
  BATCH_ISSUE: 'bg-orange-100 text-orange-700 border-orange-200',
}

const TYPE_LABEL: Record<string, string> = {
  INCIDENT_CASE: '客訴案例',
  PRODUCT_FAQ: '產品FAQ',
  BRAND_COMPARISON: '品牌比較',
  TRAINING_CASE: '教育訓練',
  BATCH_ISSUE: '批號問題',
}

interface KnowledgeEntry {
  id: string
  entryType: string
  title: string
  summary: string | null
  tags: string[]
  relatedSkus: string[]
  createdAt: string
  incident?: { id: string; incidentNo: string; severity: string; status: string } | null
}

export default function KnowledgePage() {
  const { t } = useI18n()
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<{ entryType: string; _count: { id: number } }[]>([])
  const [query, setQuery] = useState('')
  const [activeType, setActiveType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchEntries = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (activeType) params.set('type', activeType)
    try {
      const res = await fetch(`/api/knowledge?${params}`)
      const data = await res.json()
      setEntries(data.entries ?? [])
      setTotal(data.total ?? 0)
      setStats(data.stats ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { fetchEntries() }, [activeType])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchEntries()
  }

  const getStatCount = (type: string) => stats.find(s => s.entryType === type)?._count?.id ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> 知識庫
        </h1>
        <p className="text-muted-foreground mt-1">搜尋產品知識、客訴案例與解決方案</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="搜尋標題、摘要、標籤或 SKU..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button type="submit" size="lg">搜尋</Button>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {ENTRY_TYPES.filter(t => t.key).map(t => (
          <Card key={t.key} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveType(activeType === t.key ? null : t.key)}>
            <CardContent className="p-4 flex items-center gap-3">
              {'icon' in t && t.icon && <t.icon className="h-5 w-5 shrink-0" />}
              <div>
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="text-xl font-bold">{getStatCount(t.key!)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Type tabs */}
      <div className="flex gap-2 flex-wrap">
        {ENTRY_TYPES.map(t => (
          <Button key={t.key ?? 'all'} size="sm"
                  variant={activeType === t.key ? 'default' : 'outline'}
                  onClick={() => setActiveType(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">尚無知識條目</p>
            <p className="text-muted-foreground mt-1">
              {query ? '找不到符合條件的結果，請嘗試其他關鍵字' : '知識庫目前為空，可從已結案客訴自動產生'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">共 {total} 筆結果</p>
          {entries.map(entry => (
            <Card key={entry.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={TYPE_BADGE[entry.entryType] ?? ''}>
                        {TYPE_LABEL[entry.entryType] ?? entry.entryType}
                      </Badge>
                      {entry.incident && (
                        <Badge variant="secondary" className="text-xs">
                          來自客訴 {entry.incident.incidentNo}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-base">{entry.title}</h3>
                    {entry.summary && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{entry.summary}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {entry.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                      {entry.relatedSkus.map(sku => (
                        <Badge key={sku} variant="secondary" className="text-xs font-mono">{sku}</Badge>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleDateString('zh-TW')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
