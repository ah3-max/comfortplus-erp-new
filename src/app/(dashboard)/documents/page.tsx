'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
  FileText,
  FileArchive,
  Upload,
  Download,
  Trash2,
  Search,
  Loader2,
  Pencil,
  FileSpreadsheet,
  Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'ALL' | 'CONTRACT' | 'INVOICE' | 'MANUAL' | 'REPORT' | 'OTHER'

interface DocumentRecord {
  id: string
  documentName: string
  documentType: string
  fileName: string
  fileUrl: string
  fileSizeBytes: number | null
  mimeType: string | null
  versionNote: string | null
  status: string
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string | null }
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface UploadForm {
  documentName: string
  documentType: Category
  fileName: string
  fileUrl: string
  mimeType: string
  fileSizeBytes: string
  versionNote: string
}

interface EditForm {
  documentName: string
  documentType: Category
  versionNote: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  CONTRACT: 'bg-blue-100 text-blue-700 border-blue-200',
  INVOICE: 'bg-amber-100 text-amber-700 border-amber-200',
  MANUAL: 'bg-green-100 text-green-700 border-green-200',
  REPORT: 'bg-purple-100 text-purple-700 border-purple-200',
  OTHER: 'bg-slate-100 text-slate-600 border-slate-200',
}

const EMPTY_UPLOAD: UploadForm = {
  documentName: '',
  documentType: 'OTHER',
  fileName: '',
  fileUrl: '',
  mimeType: '',
  fileSizeBytes: '',
  versionNote: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return iso.substring(0, 10)
}

function FileTypeIcon({ mimeType, fileName }: { mimeType: string | null; fileName: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const mime = mimeType ?? ''

  if (mime.includes('pdf') || ext === 'pdf') {
    return <FileText className="h-5 w-5 text-red-500 shrink-0" />
  }
  if (mime.includes('spreadsheet') || mime.includes('excel') || ['xls', 'xlsx'].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 text-green-600 shrink-0" />
  }
  if (mime.includes('word') || ['doc', 'docx'].includes(ext)) {
    return <FileText className="h-5 w-5 text-blue-600 shrink-0" />
  }
  if (mime.includes('image') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return <ImageIcon className="h-5 w-5 text-pink-500 shrink-0" />
  }
  if (mime.includes('zip') || mime.includes('compressed') || ['zip', 'rar', '7z'].includes(ext)) {
    return <FileArchive className="h-5 w-5 text-orange-500 shrink-0" />
  }
  return <FileText className="h-5 w-5 text-slate-400 shrink-0" />
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { dict } = useI18n()
  const dc = dict.documents

  const CATEGORIES: { value: Category; label: string }[] = [
    { value: 'ALL', label: dc.categoryLabels.ALL },
    { value: 'CONTRACT', label: dc.categoryLabels.CONTRACT },
    { value: 'INVOICE', label: dc.categoryLabels.INVOICE },
    { value: 'MANUAL', label: dc.categoryLabels.MANUAL },
    { value: 'REPORT', label: dc.categoryLabels.REPORT },
    { value: 'OTHER', label: dc.categoryLabels.OTHER },
  ]
  const CATEGORY_UPLOAD_OPTIONS = CATEGORIES.filter((c) => c.value !== 'ALL')

  // List state
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<Category>('ALL')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadForm, setUploadForm] = useState<UploadForm>(EMPTY_UPLOAD)
  const [uploading, setUploading] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DocumentRecord | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    documentName: '',
    documentType: 'OTHER',
    versionNote: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Load ───────────────────────────────────────────────────────────────────

  const loadDocuments = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: '20' })
        if (activeCategory !== 'ALL') params.set('category', activeCategory)
        if (search) params.set('search', search)

        const res = await fetch(`/api/documents?${params}`)
        if (!res.ok) throw new Error(dict.common.loadFailed)
        const json = await res.json()
        setDocuments(json.data ?? [])
        setPagination(json.pagination ?? null)
      } catch {
        toast.error(dc.loadFailed)
      } finally {
        setLoading(false)
      }
    },
    [activeCategory, search],
  )

  useEffect(() => {
    loadDocuments(1)
  }, [loadDocuments])

  // ─── Search debounce ────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // ─── Upload ─────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!uploadForm.documentName.trim()) {
      toast.error(dc.nameRequired)
      return
    }
    if (!uploadForm.fileName.trim()) {
      toast.error(dc.fileNameRequired)
      return
    }
    if (!uploadForm.fileUrl.trim()) {
      toast.error(dc.pathRequired)
      return
    }

    setUploading(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: uploadForm.documentName.trim(),
          documentType: uploadForm.documentType,
          fileName: uploadForm.fileName.trim(),
          fileUrl: uploadForm.fileUrl.trim(),
          mimeType: uploadForm.mimeType.trim() || null,
          fileSizeBytes: uploadForm.fileSizeBytes ? parseInt(uploadForm.fileSizeBytes, 10) : null,
          versionNote: uploadForm.versionNote.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? dict.common.saveFailed)
      }
      toast.success(dc.addedSuccess)
      setUploadOpen(false)
      setUploadForm(EMPTY_UPLOAD)
      loadDocuments(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.common.saveFailed)
    } finally {
      setUploading(false)
    }
  }

  // ─── Edit ───────────────────────────────────────────────────────────────────

  function openEdit(doc: DocumentRecord) {
    setEditTarget(doc)
    setEditForm({
      documentName: doc.documentName,
      documentType: (doc.documentType as Category) ?? 'OTHER',
      versionNote: doc.versionNote ?? '',
    })
    setEditOpen(true)
  }

  async function handleEdit() {
    if (!editTarget) return
    if (!editForm.documentName.trim()) {
      toast.error(dc.nameRequired)
      return
    }

    setEditSaving(true)
    try {
      const res = await fetch(`/api/documents/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: editForm.documentName.trim(),
          documentType: editForm.documentType,
          versionNote: editForm.versionNote.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? dict.common.saveFailed)
      }
      toast.success(dc.updatedSuccess)
      setEditOpen(false)
      setEditTarget(null)
      loadDocuments(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.common.saveFailed)
    } finally {
      setEditSaving(false)
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? dict.common.deleteFailed)
      }
      toast.success(dc.deletedSuccess)
      setDeleteTarget(null)
      loadDocuments(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.common.deleteFailed)
    } finally {
      setDeleting(false)
    }
  }

  function getCategoryLabel(value: string): string {
    return CATEGORIES.find((c) => c.value === value)?.label ?? value
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const tabStyle = (cat: Category) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
      activeCategory === cat
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dc.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{dc.subtitle}</p>
        </div>
        <Button
          className="min-h-[44px] sm:min-h-auto active:scale-[0.97]"
          onClick={() => {
            setUploadForm(EMPTY_UPLOAD)
            setUploadOpen(true)
          }}
        >
          <Upload className="h-4 w-4 mr-2" />
          {dc.newVersion}
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          className="pl-9 min-h-[44px]"
          placeholder={dc.searchPlaceholder}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* ── Category Tabs ── */}
      <div className="border-b flex gap-0 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            className={tabStyle(cat.value)}
            onClick={() => setActiveCategory(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Document List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{dc.empty}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setUploadForm(EMPTY_UPLOAD)
              setUploadOpen(true)
            }}
          >
            <Upload className="h-4 w-4 mr-1" />
            {dc.uploadFirst}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-0.5">
                    <FileTypeIcon mimeType={doc.mimeType} fileName={doc.fileName} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          CATEGORY_COLORS[doc.documentType] ?? CATEGORY_COLORS.OTHER
                        }`}
                      >
                        {getCategoryLabel(doc.documentType)}
                      </span>
                      <Badge variant="outline" className="text-xs font-mono">
                        {doc.fileName.split('.').pop()?.toUpperCase() ?? 'FILE'}
                      </Badge>
                    </div>

                    <p className="font-semibold text-slate-900 text-sm truncate">
                      {doc.documentName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{doc.fileName}</p>

                    {doc.versionNote && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{doc.versionNote}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                      <span>{formatBytes(doc.fileSizeBytes)}</span>
                      <span>{doc.createdBy?.name ?? '—'}</span>
                      <span>{formatDate(doc.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Download */}
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={doc.fileName}
                      title={dc.downloadLabel}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-blue-600 min-h-[44px] min-w-[44px]"
                      >
                        <Download className="h-4 w-4" />
                        <span className="sr-only">{dc.downloadLabel}</span>
                      </Button>
                    </a>

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-slate-800 min-h-[44px] min-w-[44px]"
                      title={dc.editLabel}
                      onClick={() => openEdit(doc)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">{dc.editLabel}</span>
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-red-600 min-h-[44px] min-w-[44px]"
                      title={dc.deleteLabel}
                      onClick={() => setDeleteTarget(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">{dc.deleteLabel}</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-sm text-slate-500">
              <span>
                {pagination.total} {dict.common.items} — {pagination.page} / {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => loadDocuments(pagination.page - 1)}
                >
                  {dict.common.prevPage}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadDocuments(pagination.page + 1)}
                >
                  {dict.common.nextPage}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dc.btnAdd}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Document Name */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-name">
                {dc.fieldName} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="upload-name"
                value={uploadForm.documentName}
                onChange={(e) => setUploadForm((f) => ({ ...f, documentName: e.target.value }))}
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-category">
                {dc.fieldCategory} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={uploadForm.documentType}
                onValueChange={(v) =>
                  setUploadForm((f) => ({ ...f, documentType: v as Category }))
                }
              >
                <SelectTrigger id="upload-category">
                  <SelectValue placeholder={dc.selectCategory} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_UPLOAD_OPTIONS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Name */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-filename">
                {dc.fieldFileName} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="upload-filename"
                placeholder="contract-2024.pdf"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
                value={uploadForm.fileName}
                onChange={(e) => setUploadForm((f) => ({ ...f, fileName: e.target.value }))}
              />
            </div>

            {/* File URL */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-url">
                {dc.fieldFileUrl} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="upload-url"
                placeholder="/uploads/contract-2024.pdf"
                value={uploadForm.fileUrl}
                onChange={(e) => setUploadForm((f) => ({ ...f, fileUrl: e.target.value }))}
              />
            </div>

            {/* MIME Type (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-mime">{dc.fieldMime}</Label>
              <Input
                id="upload-mime"
                placeholder="application/pdf"
                value={uploadForm.mimeType}
                onChange={(e) => setUploadForm((f) => ({ ...f, mimeType: e.target.value }))}
              />
            </div>

            {/* File Size (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-size">{dc.fieldSize}</Label>
              <Input
                id="upload-size"
                type="number"
                placeholder="204800"
                value={uploadForm.fileSizeBytes}
                onChange={(e) => setUploadForm((f) => ({ ...f, fileSizeBytes: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-desc">{dc.fieldDesc}</Label>
              <Textarea
                id="upload-desc"
                rows={3}
                value={uploadForm.versionNote}
                onChange={(e) => setUploadForm((f) => ({ ...f, versionNote: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              {dict.common.cancel}
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {dc.saving}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {dc.btnAdd}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dc.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Document Name */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">
                {dc.fieldName} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editForm.documentName}
                onChange={(e) => setEditForm((f) => ({ ...f, documentName: e.target.value }))}
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-category">{dc.fieldCategory}</Label>
              <Select
                value={editForm.documentType}
                onValueChange={(v) => setEditForm((f) => ({ ...f, documentType: v as Category }))}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder={dc.selectCategory} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_UPLOAD_OPTIONS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">{dc.fieldDesc}</Label>
              <Textarea
                id="edit-desc"
                rows={3}
                value={editForm.versionNote}
                onChange={(e) => setEditForm((f) => ({ ...f, versionNote: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              {dict.common.cancel}
            </Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {dc.saving}
                </>
              ) : (
                dc.btnSave
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dict.common.deleteConfirm}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            {deleteTarget?.documentName} — {dc.deleteConfirmText}
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              {dict.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {dc.deleting}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {dc.btnDelete}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
