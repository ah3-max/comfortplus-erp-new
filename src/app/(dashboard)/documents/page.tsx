'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, FilePlus, ChevronDown, ChevronRight, Loader2, Clock } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

/* ─── Types ─────────────────────────────────────────────── */
interface DocumentVersion {
  id: string
  documentType: string
  documentName: string
  version: number
  versionNote: string | null
  fileName: string | null
  fileUrl: string | null
  fileSizeBytes: number | null
  mimeType: string | null
  status: string
  effectiveDate: string | null
  previousVersionId: string | null
  createdAt: string
  createdBy: { id: string; name: string | null }
}

interface TypeStat {
  documentType: string
  _count: { id: number }
}

/* ─── Constants ─────────────────────────────────────────── */
const DOC_TYPES = [
  'ALL', 'PRODUCT_SPEC', 'PACKAGING_DESIGN', 'QC_STANDARD',
  'TRAINING_SOP', 'CONTRACT', 'PRICE_LIST',
] as const

const TYPE_COLORS: Record<string, string> = {
  PRODUCT_SPEC:     'bg-blue-100 text-blue-700',
  PACKAGING_DESIGN: 'bg-purple-100 text-purple-700',
  QC_STANDARD:      'bg-orange-100 text-orange-700',
  TRAINING_SOP:     'bg-green-100 text-green-700',
  CONTRACT:         'bg-slate-100 text-slate-700',
  PRICE_LIST:       'bg-amber-100 text-amber-700',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:     'bg-green-100 text-green-700',
  DRAFT:      'bg-gray-100 text-gray-600',
  SUPERSEDED: 'bg-red-100 text-red-700',
  ARCHIVED:   'bg-slate-100 text-slate-500',
  REVIEW:     'bg-yellow-100 text-yellow-700',
  APPROVED:   'bg-teal-100 text-teal-700',
}

/* ─── Component ─────────────────────────────────────────── */
export default function DocumentsPage() {
  const { dict } = useI18n()
  const [documents, setDocuments] = useState<DocumentVersion[]>([])
  const [stats, setStats] = useState<TypeStat[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<string>('ALL')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadDocuments()
  }, [activeType]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDocuments() {
    setLoading(true)
    const params = new URLSearchParams()
    if (activeType !== 'ALL') params.set('type', activeType)
    const res = await fetch(`/api/documents?${params}`)
    if (res.ok) {
      const data = await res.json()
      setDocuments(data.documents ?? [])
      setStats(data.stats ?? [])
    }
    setLoading(false)
  }

  function toggleGroup(name: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  /* ─── Group documents by name ─────────────────────────── */
  const grouped = documents.reduce<Record<string, DocumentVersion[]>>((acc, doc) => {
    const key = `${doc.documentType}::${doc.documentName}`
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {})

  const groupEntries = Object.entries(grouped)

  /* ─── Helpers ─────────────────────────────────────────── */
  const typeLabel = (t: string) =>
    (dict.documents?.types as Record<string, string>)?.[t] ?? t

  const statusLabel = (s: string) =>
    (dict.documents?.statuses as Record<string, string>)?.[s] ?? s

  const statsMap = stats.reduce<Record<string, number>>((m, s) => {
    m[s.documentType] = s._count.id
    return m
  }, {})

  const totalActive = stats.reduce((sum, s) => sum + s._count.id, 0)

  const tabStyle = (t: string) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
      activeType === t
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.documents.title}</h1>
          <p className="text-sm text-slate-500 mt-1">管理商品規格書、包材設計稿、合約等文件版本</p>
        </div>
        <Button>
          <FilePlus className="h-4 w-4 mr-2" />{dict.documents.newVersion}
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{totalActive}</p>
            <p className="text-xs text-slate-500">生效中文件</p>
          </CardContent>
        </Card>
        {DOC_TYPES.filter(t => t !== 'ALL').map(t => (
          <Card key={t}>
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold">{statsMap[t] ?? 0}</p>
              <p className="text-xs text-slate-500">{typeLabel(t)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Type Filter Tabs */}
      <div className="border-b flex gap-0 overflow-x-auto">
        {DOC_TYPES.map(t => (
          <button key={t} className={tabStyle(t)} onClick={() => setActiveType(t)}>
            {t === 'ALL' ? '全部' : typeLabel(t)}
          </button>
        ))}
      </div>

      {/* Document List */}
      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : groupEntries.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>尚無文件紀錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupEntries.map(([groupKey, versions]) => {
            const latest = versions[0]
            const isExpanded = expandedGroups.has(groupKey)
            const olderVersions = versions.slice(1)

            return (
              <Card key={groupKey}>
                <CardContent className="p-5">
                  {/* Main row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[latest.documentType] ?? 'bg-gray-100 text-gray-600'}`}>
                          {typeLabel(latest.documentType)}
                        </span>
                        <Badge variant="outline" className="text-xs font-mono">
                          V{latest.version}
                        </Badge>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[latest.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {statusLabel(latest.status)}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 text-base truncate">
                        {latest.documentName}
                      </p>
                      <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-500">
                        {latest.effectiveDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            生效日：{latest.effectiveDate.substring(0, 10)}
                          </span>
                        )}
                        <span>
                          {latest.createdBy?.name ?? '---'} / {latest.createdAt.substring(0, 10)}
                        </span>
                        {latest.fileName && (
                          <span className="text-xs text-slate-400 truncate max-w-[200px]">
                            {latest.fileName}
                          </span>
                        )}
                      </div>
                      {latest.versionNote && (
                        <p className="text-sm text-slate-500 mt-1">{latest.versionNote}</p>
                      )}
                    </div>
                  </div>

                  {/* Version history toggle */}
                  {olderVersions.length > 0 && (
                    <div className="mt-3 border-t pt-2">
                      <button
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                        onClick={() => toggleGroup(groupKey)}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />
                        }
                        {dict.documents.version}歷史 ({olderVersions.length})
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 pl-5 border-l-2 border-slate-100">
                          {olderVersions.map(v => (
                            <div key={v.id} className="flex items-center gap-3 text-sm">
                              <Badge variant="outline" className="text-xs font-mono">
                                V{v.version}
                              </Badge>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {statusLabel(v.status)}
                              </span>
                              <span className="text-slate-500">
                                {v.createdBy?.name ?? '---'} / {v.createdAt.substring(0, 10)}
                              </span>
                              {v.versionNote && (
                                <span className="text-slate-400 truncate max-w-[300px]">
                                  {v.versionNote}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
