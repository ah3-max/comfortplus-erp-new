'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BookOpen,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Tag,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeArticle {
  id: string
  entryType: string
  title: string
  summary: string
  tags: string[]
  relatedSkus: string[]
  relatedBatchNos: string[]
  customerTypes: string[]
  symptomCodes: string[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
  incident?: {
    id: string
    incidentNo: string
    severity: string
    status: string
  } | null
}

interface ArticleFormData {
  entryType: string
  title: string
  summary: string
  tags: string          // comma-separated raw input
  relatedSkus: string   // comma-separated raw input
  isPublic: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTRY_TYPES = [
  { value: 'PRODUCT_FAQ',      label: '產品FAQ',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'INCIDENT_CASE',    label: '客訴案例',  color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'BRAND_COMPARISON', label: '品牌比較',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'TRAINING_CASE',    label: '教育訓練',  color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'BATCH_ISSUE',      label: '批號問題',  color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'OTHER',            label: '其他',      color: 'bg-gray-100 text-gray-700 border-gray-200' },
]

const CATEGORY_FILTERS = [
  { value: '', label: '全部' },
  ...ENTRY_TYPES,
]

const DEFAULT_FORM: ArticleFormData = {
  entryType: 'PRODUCT_FAQ',
  title: '',
  summary: '',
  tags: '',
  relatedSkus: '',
  isPublic: true,
}

function getTypeConfig(entryType: string) {
  return ENTRY_TYPES.find(t => t.value === entryType) ?? {
    value: entryType,
    label: entryType,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
  }
}

function parseCsv(raw: string): string[] {
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ─── Article Form Dialog ──────────────────────────────────────────────────────

interface ArticleFormDialogProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editArticle?: KnowledgeArticle | null
}

function ArticleFormDialog({ open, onClose, onSaved, editArticle }: ArticleFormDialogProps) {
  const isEdit = Boolean(editArticle)
  const [form, setForm] = useState<ArticleFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (editArticle) {
        setForm({
          entryType: editArticle.entryType,
          title: editArticle.title,
          summary: editArticle.summary,
          tags: editArticle.tags.join(', '),
          relatedSkus: editArticle.relatedSkus.join(', '),
          isPublic: editArticle.isPublic,
        })
      } else {
        setForm(DEFAULT_FORM)
      }
    }
  }, [open, editArticle])

  const set = (key: keyof ArticleFormData, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('請填寫標題')
      return
    }
    if (!form.summary.trim()) {
      toast.error('請填寫內容')
      return
    }

    setSaving(true)
    try {
      const payload = {
        entryType: form.entryType,
        title: form.title.trim(),
        summary: form.summary.trim(),
        tags: parseCsv(form.tags),
        relatedSkus: parseCsv(form.relatedSkus),
        isPublic: form.isPublic,
      }

      const url = isEdit ? `/api/knowledge/${editArticle!.id}` : '/api/knowledge'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? '操作失敗')
      }

      toast.success(isEdit ? '文章已更新' : '文章已新增')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {isEdit ? '編輯文章' : '新增文章'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-title">
              標題 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kb-title"
              placeholder="輸入文章標題"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-type">類別</Label>
            <Select value={form.entryType} onValueChange={v => set('entryType', v ?? '')}>
              <SelectTrigger id="kb-type">
                <SelectValue placeholder="選擇類別" />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-summary">
              內容 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="kb-summary"
              placeholder="輸入知識庫內容、說明、解決方案…"
              value={form.summary}
              onChange={e => set('summary', e.target.value)}
              rows={8}
              className="resize-y min-h-[160px]"
              required
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-tags" className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> 標籤
              <span className="text-xs text-muted-foreground font-normal">（逗號分隔）</span>
            </Label>
            <Input
              id="kb-tags"
              placeholder="例：防漏, 尺寸, 更換頻率"
              value={form.tags}
              onChange={e => set('tags', e.target.value)}
            />
          </div>

          {/* Related SKUs */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-skus">
              相關 SKU
              <span className="text-xs text-muted-foreground font-normal ml-1">（逗號分隔）</span>
            </Label>
            <Input
              id="kb-skus"
              placeholder="例：CP-001, CP-002"
              value={form.relatedSkus}
              onChange={e => set('relatedSkus', e.target.value)}
            />
          </div>

          {/* isPublic toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.isPublic}
              onClick={() => set('isPublic', !form.isPublic)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                form.isPublic ? 'bg-primary' : 'bg-input'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                  form.isPublic ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <Label className="cursor-pointer" onClick={() => set('isPublic', !form.isPublic)}>
              {form.isPublic ? '公開（所有人可見）' : '草稿（僅自己可見）'}
            </Label>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? '儲存變更' : '新增文章'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Confirmation Dialog ────────────────────────────────────────────────

interface DeleteDialogProps {
  open: boolean
  articleTitle: string
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
}

function DeleteDialog({ open, articleTitle, onClose, onConfirm, deleting }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            確認刪除
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          確定要刪除文章「<span className="font-medium text-foreground">{articleTitle}</span>」嗎？此操作無法復原。
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            取消
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Article Detail Dialog ─────────────────────────────────────────────────────

interface ArticleDetailDialogProps {
  article: KnowledgeArticle | null
  onClose: () => void
  onEdit: (a: KnowledgeArticle) => void
}

function ArticleDetailDialog({ article, onClose, onEdit }: ArticleDetailDialogProps) {
  if (!article) return null
  const typeConfig = getTypeConfig(article.entryType)

  return (
    <Dialog open={Boolean(article)} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="space-y-2">
              <Badge variant="outline" className={typeConfig.color}>
                {typeConfig.label}
              </Badge>
              <DialogTitle className="text-lg leading-snug">{article.title}</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Meta */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-b pb-3">
          <span>建立：{formatDate(article.createdAt)}</span>
          <span>更新：{formatDate(article.updatedAt)}</span>
          <span className={article.isPublic ? 'text-green-600' : 'text-amber-600'}>
            {article.isPublic ? '● 公開' : '● 草稿'}
          </span>
          {article.incident && (
            <span className="text-blue-600">來自客訴 {article.incident.incidentNo}</span>
          )}
        </div>

        {/* Content */}
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {article.summary}
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3" /> 標籤
            </p>
            <div className="flex flex-wrap gap-1.5">
              {article.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Related SKUs */}
        {article.relatedSkus.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">相關 SKU</p>
            <div className="flex flex-wrap gap-1.5">
              {article.relatedSkus.map(sku => (
                <Badge key={sku} variant="secondary" className="text-xs font-mono">
                  {sku}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1.5" />
            關閉
          </Button>
          <Button onClick={() => { onClose(); onEdit(article) }}>
            <Edit className="h-4 w-4 mr-1.5" />
            編輯文章
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<{ entryType: string; _count: { id: number } }[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')

  // Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editArticle, setEditArticle] = useState<KnowledgeArticle | null>(null)
  const [detailArticle, setDetailArticle] = useState<KnowledgeArticle | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeArticle | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchArticles = useCallback(async (q = search, cat = activeCategory) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '50' })
      if (q) params.set('q', q)
      if (cat) params.set('type', cat)

      const res = await fetch(`/api/knowledge?${params}`)
      if (!res.ok) throw new Error('載入失敗')
      const data = await res.json()
      setArticles(data.entries ?? [])
      setTotal(data.total ?? 0)
      setStats(data.stats ?? [])
    } catch {
      toast.error('無法載入知識庫，請重新整理')
    } finally {
      setLoading(false)
    }
  }, [search, activeCategory])

  useEffect(() => {
    fetchArticles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchArticles(search, activeCategory)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/knowledge/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? '刪除失敗')
      }
      toast.success('文章已刪除')
      setDeleteTarget(null)
      fetchArticles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '刪除失敗')
    } finally {
      setDeleting(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getStatCount = (type: string) =>
    stats.find(s => s.entryType === type)?._count?.id ?? 0

  const openEdit = (article: KnowledgeArticle) => {
    setEditArticle(article)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditArticle(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            知識庫
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            搜尋產品知識、客訴案例與解決方案
          </p>
        </div>
        <Button
          onClick={() => { setEditArticle(null); setFormOpen(true) }}
          className="shrink-0 min-h-[44px]"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          新增文章
        </Button>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="搜尋標題、內容、標籤或 SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 min-h-[44px]"
          />
        </div>
        <Button type="submit" className="min-h-[44px] px-5">
          搜尋
        </Button>
        {search && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px]"
            onClick={() => { setSearch(''); fetchArticles('', activeCategory) }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {ENTRY_TYPES.map(t => (
          <Card
            key={t.value}
            className={`cursor-pointer transition-all active:scale-[0.97] hover:shadow-md ${
              activeCategory === t.value ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() =>
              setActiveCategory(prev => (prev === t.value ? '' : t.value))
            }
          >
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground truncate">{t.label}</p>
              <p className="text-2xl font-bold mt-0.5">{getStatCount(t.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORY_FILTERS.map(f => (
          <Button
            key={f.value}
            size="sm"
            variant={activeCategory === f.value ? 'default' : 'outline'}
            className="min-h-[36px]"
            onClick={() => setActiveCategory(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">尚無知識條目</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || activeCategory
                ? '找不到符合條件的結果，請嘗試其他關鍵字或類別'
                : '知識庫目前為空，點擊「新增文章」開始建立'}
            </p>
            {(search || activeCategory) && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { setSearch(''); setActiveCategory('') }}
              >
                清除篩選
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            共 <span className="font-medium text-foreground">{total}</span> 筆結果
          </p>

          {/* Article grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {articles.map(article => {
              const typeConfig = getTypeConfig(article.entryType)
              return (
                <Card
                  key={article.id}
                  className="flex flex-col hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                        {typeConfig.label}
                      </Badge>
                      {!article.isPublic && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          草稿
                        </Badge>
                      )}
                      {article.incident && (
                        <Badge variant="secondary" className="text-xs">
                          客訴 {article.incident.incidentNo}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base font-semibold leading-snug line-clamp-2">
                      {article.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col gap-3 pb-4">
                    {/* Summary preview */}
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {article.summary}
                    </p>

                    {/* Tags */}
                    {article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <Tag className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        {article.tags.slice(0, 4).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {article.tags.length > 4 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            +{article.tags.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* SKUs */}
                    {article.relatedSkus.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {article.relatedSkus.slice(0, 3).map(sku => (
                          <Badge key={sku} variant="secondary" className="text-xs font-mono">
                            {sku}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Footer meta + actions */}
                    <div className="mt-auto pt-3 border-t flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        更新 {formatDate(article.updatedAt)}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="查看詳情"
                          onClick={() => setDetailArticle(article)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="編輯文章"
                          onClick={() => openEdit(article)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="刪除文章"
                          onClick={() => setDeleteTarget(article)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Article Form Dialog (create / edit) */}
      <ArticleFormDialog
        open={formOpen}
        onClose={handleFormClose}
        onSaved={() => fetchArticles()}
        editArticle={editArticle}
      />

      {/* Article Detail Dialog */}
      <ArticleDetailDialog
        article={detailArticle}
        onClose={() => setDetailArticle(null)}
        onEdit={a => openEdit(a)}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={Boolean(deleteTarget)}
        articleTitle={deleteTarget?.title ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  )
}
