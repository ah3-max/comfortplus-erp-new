'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, RefreshCw, Hash } from 'lucide-react'

const PERIODS = ['01-02', '03-04', '05-06', '07-08', '09-10', '11-12']

const ROC_YEAR = new Date().getFullYear() - 1911

interface Range {
  id: string
  prefix: string
  year: number
  period: string
  startNumber: number
  endNumber: number
  currentNumber: number
  isActive: boolean
  note: string | null
  createdBy: { id: string; name: string }
  createdAt: string
}

export default function EInvoiceRangesPage() {
  const { data: session } = useSession()
  const { dict } = useI18n()
  const d = (dict as unknown as Record<string, Record<string, string>>).eInvoiceRange ?? {}
  const role = (session?.user as { role?: string })?.role ?? ''
  const canEdit = ['SUPER_ADMIN', 'FINANCE'].includes(role)

  const [ranges, setRanges] = useState<Range[]>([])
  const [loading, setLoading] = useState(false)
  const [filterYear, setFilterYear] = useState<string>(String(ROC_YEAR))

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    prefix: '',
    year: String(ROC_YEAR),
    period: PERIODS[Math.floor((new Date().getMonth()) / 2)],
    startNumber: '1',
    endNumber: '50',
    note: '',
  })

  // Edit dialog
  const [editTarget, setEditTarget] = useState<Range | null>(null)
  const [editForm, setEditForm] = useState({ endNumber: '', note: '', isActive: true })
  const [editing, setEditing] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Range | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const year = filterYear ? `?year=${filterYear}` : ''
      const res = await fetch(`/api/finance/e-invoice-ranges${year}`)
      const json = await res.json()
      setRanges(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [filterYear])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/finance/e-invoice-ranges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: form.prefix,
          year: Number(form.year),
          period: form.period,
          startNumber: Number(form.startNumber),
          endNumber: Number(form.endNumber),
          note: form.note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? d.createFailed)
        return
      }
      setShowCreate(false)
      setForm({ prefix: '', year: String(ROC_YEAR), period: form.period, startNumber: '1', endNumber: '50', note: '' })
      load()
    } finally {
      setCreating(false)
    }
  }

  function openEdit(r: Range) {
    setEditTarget(r)
    setEditForm({ endNumber: String(r.endNumber), note: r.note ?? '', isActive: r.isActive })
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditing(true)
    try {
      const res = await fetch(`/api/finance/e-invoice-ranges/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endNumber: Number(editForm.endNumber),
          isActive: editForm.isActive,
          note: editForm.note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? d.editFailed)
        return
      }
      setEditTarget(null)
      load()
    } finally {
      setEditing(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/finance/e-invoice-ranges/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? d.deleteFailed)
        return
      }
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  const usagePercent = (r: Range) => {
    const used = r.currentNumber - r.startNumber + 1
    const total = r.endNumber - r.startNumber + 1
    return Math.max(0, Math.round((used / total) * 100))
  }

  const years = Array.from({ length: 5 }, (_, i) => String(ROC_YEAR - i))

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{d.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{d.subtitle}</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowCreate(true)} className="min-h-[44px]">
            <Plus className="w-4 h-4 mr-1" />
            {d.newRange}
          </Button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterYear} onValueChange={v => setFilterYear(v ?? String(ROC_YEAR))}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={d.selectYear} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{d.allYears}</SelectItem>
            {years.map(y => (
              <SelectItem key={y} value={y}>{d.rocYear}{y}{d.yearUnit}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} disabled={loading} className="min-h-[44px] min-w-[44px]">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{d.prefix}</TableHead>
              <TableHead>{d.yearPeriod}</TableHead>
              <TableHead>{d.numberRange}</TableHead>
              <TableHead>{d.usage}</TableHead>
              <TableHead>{d.remaining}</TableHead>
              <TableHead>{d.statusLabel}</TableHead>
              <TableHead>{d.note}</TableHead>
              {canEdit && <TableHead className="text-right">{d.actions}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  {d.loading}
                </TableCell>
              </TableRow>
            ) : ranges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  {d.noRanges}
                </TableCell>
              </TableRow>
            ) : ranges.map(r => {
              const used = Math.max(0, r.currentNumber - r.startNumber + 1)
              const total = r.endNumber - r.startNumber + 1
              const remaining = r.endNumber - r.currentNumber
              const pct = usagePercent(r)
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className="font-mono font-bold text-base">{r.prefix}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{d.rocYear}{r.year}{d.yearUnit}</div>
                    <div className="text-sm text-muted-foreground">{r.period}{d.periodSuffix}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {String(r.startNumber).padStart(8, '0')} – {String(r.endNumber).padStart(8, '0')}
                    </div>
                    <div className="text-xs text-muted-foreground">{total}{d.totalLabel}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2 min-w-[80px]">
                        <div
                          className={`h-2 rounded-full transition-all ${pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs w-8 text-right">{pct}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {used}/{total}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${remaining <= 5 ? 'text-destructive' : ''}`}>
                      {remaining}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.isActive ? (
                      <Badge variant="default">{d.active}</Badge>
                    ) : remaining <= 0 ? (
                      <Badge variant="destructive">{d.exhausted}</Badge>
                    ) : (
                      <Badge variant="secondary">{d.inactive}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-sm text-muted-foreground">
                    {r.note ?? '—'}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="icon"
                          className="min-h-[36px] min-w-[36px]"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="min-h-[36px] min-w-[36px] text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(r)}
                          disabled={r.currentNumber >= r.startNumber}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5" />
              {d.newRange}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{d.prefix} <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="ZM"
                  maxLength={2}
                  value={form.prefix}
                  onChange={e => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">{d.prefixHint}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{d.year} <span className="text-destructive">*</span></Label>
                <Select value={form.year} onValueChange={v => setForm(f => ({ ...f, year: v ?? String(ROC_YEAR) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{d.period} <span className="text-destructive">*</span></Label>
              <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v ?? PERIODS[0] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map(p => <SelectItem key={p} value={p}>{p}{d.periodSuffix}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{d.startNumber} <span className="text-destructive">*</span></Label>
                <Input
                  type="number" min={1}
                  value={form.startNumber}
                  onChange={e => setForm(f => ({ ...f, startNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{d.endNumber} <span className="text-destructive">*</span></Label>
                <Input
                  type="number" min={2}
                  value={form.endNumber}
                  onChange={e => setForm(f => ({ ...f, endNumber: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{d.note}</Label>
              <Input
                placeholder={d.notePlaceholder}
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>

            {form.prefix && form.startNumber && (
              <div className="bg-muted rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">{d.previewLabel}</span>
                <span className="font-mono font-bold ml-1">
                  {form.prefix.toUpperCase()}{String(Number(form.startNumber)).padStart(8, '0')}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{d.cancel}</Button>
            <Button onClick={handleCreate} disabled={creating || !form.prefix || !form.year || !form.period}>
              {creating ? d.saving : d.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => { if (!v) setEditTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{d.editRange}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 py-2">
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">{d.prefix}：</span><span className="font-mono font-bold">{editTarget.prefix}</span></div>
                <div><span className="text-muted-foreground">{d.yearPeriod}：</span>{editTarget.year} / {editTarget.period}</div>
                <div><span className="text-muted-foreground">{d.used}：</span>{Math.max(0, editTarget.currentNumber - editTarget.startNumber + 1)} {d.totalLabel}</div>
              </div>

              <div className="space-y-1.5">
                <Label>{d.endNumber}</Label>
                <Input
                  type="number"
                  value={editForm.endNumber}
                  onChange={e => setEditForm(f => ({ ...f, endNumber: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{d.isActive}</Label>
                <Select value={editForm.isActive ? 'true' : 'false'} onValueChange={v => setEditForm(f => ({ ...f, isActive: v === 'true' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{d.active}</SelectItem>
                    <SelectItem value="false">{d.inactive}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{d.note}</Label>
                <Input
                  value={editForm.note}
                  onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>{d.cancel}</Button>
            <Button onClick={handleEdit} disabled={editing}>
              {editing ? d.saving : d.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{d.deleteTitle}</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm">
              {d.deleteConfirm} <strong className="font-mono">{deleteTarget.prefix}</strong> {deleteTarget.year}-{deleteTarget.period} {d.deleteConfirmSuffix}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{d.cancel}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? d.deleting : d.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
