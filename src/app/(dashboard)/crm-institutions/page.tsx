'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Upload, Download, RefreshCw, Search, Building2, Phone, MapPin, User } from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────
interface Customer {
  id: string
  code: string
  name: string
  type: string
  grade: string | null
  city: string | null
  region: string | null
  phone: string | null
  contactPerson: string | null
  bedCount: number | null
  devStatus: string
  lastContactDate: string | null
  nextFollowUpDate: string | null
  salesRep: { id: string; name: string } | null
  _count: { visitRecords: number; callRecords: number; salesOrders: number }
}

const GRADES = ['A', 'B', 'C', 'D'] as const
const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  B: 'bg-blue-100 text-blue-800 border-blue-200',
  C: 'bg-amber-100 text-amber-800 border-amber-200',
  D: 'bg-slate-100 text-slate-600 border-slate-200',
}

// ── Main Component ──────────────────────────────────
export default function CrmInstitutionsPage() {
  const { dict } = useI18n()
  const d = (dict as unknown as Record<string, Record<string, string>>).crmInstitutions ?? {}

  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activeGrade, setActiveGrade] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 30

  // Counts per grade
  const [gradeCounts, setGradeCounts] = useState<Record<string, number>>({})

  // Import dialog
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Grade update state
  const [updatingGrade, setUpdatingGrade] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        pageSize: String(PAGE_SIZE),
        page: String(page),
        ...(activeGrade !== 'ALL' ? { grade: activeGrade } : {}),
        ...(search ? { search } : {}),
        ...(region ? { region } : {}),
      })
      const res = await fetch(`/api/customers?${params}`)
      const json = await res.json()
      setCustomers(json.data ?? [])
      setTotal(json.pagination?.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [activeGrade, search, region, page])

  // Load grade counts separately (always unfiltered by grade)
  const loadGradeCounts = useCallback(async () => {
    const results: Record<string, number> = {}
    await Promise.all(
      [...GRADES, 'ALL'].map(async (g) => {
        const params = new URLSearchParams({
          pageSize: '1',
          ...(g !== 'ALL' ? { grade: g } : {}),
          ...(search ? { search } : {}),
          ...(region ? { region } : {}),
        })
        const res = await fetch(`/api/customers?${params}`)
        const json = await res.json()
        results[g] = json.pagination?.total ?? 0
      })
    )
    setGradeCounts(results)
  }, [search, region])

  useEffect(() => {
    setPage(1)
  }, [activeGrade, search, region])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadGradeCounts() }, [loadGradeCounts])

  async function updateGrade(customerId: string, newGrade: string) {
    setUpdatingGrade(customerId)
    try {
      await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: newGrade || null }),
      })
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, grade: newGrade || null } : c))
      loadGradeCounts()
    } finally {
      setUpdatingGrade(null)
    }
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/customers/import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? d.importFailed); return }
      setImportResult(json)
      load()
      loadGradeCounts()
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function downloadTemplate() {
    window.open('/api/customers/import', '_blank')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{d.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{d.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="min-h-[44px]">
            <Download className="w-4 h-4 mr-1" />
            {d.downloadTemplate}
          </Button>
          <Button size="sm" onClick={() => setShowImport(true)} className="min-h-[44px]">
            <Upload className="w-4 h-4 mr-1" />
            {d.importExcel}
          </Button>
        </div>
      </div>

      {/* Grade quadrant cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { grade: 'A', label: d.gradeALabel, sub: d.gradeASub, color: 'border-emerald-300 bg-emerald-50' },
          { grade: 'B', label: d.gradeBLabel, sub: d.gradeBSub, color: 'border-blue-300 bg-blue-50' },
          { grade: 'C', label: d.gradeCLabel, sub: d.gradeCSub, color: 'border-amber-300 bg-amber-50' },
          { grade: 'D', label: d.gradeDLabel, sub: d.gradeDSub, color: 'border-slate-300 bg-slate-50' },
        ].map(({ grade, label, sub, color }) => (
          <button
            key={grade}
            onClick={() => setActiveGrade(activeGrade === grade ? 'ALL' : grade)}
            className={`rounded-xl border-2 p-4 text-left transition-all active:scale-[0.97] ${color} ${activeGrade === grade ? 'ring-2 ring-primary ring-offset-1' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{label}</span>
              <span className="text-2xl font-bold text-muted-foreground">{gradeCounts[grade] ?? 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder={d.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={region} onValueChange={v => setRegion(v === 'ALL' ? '' : (v ?? ''))}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={d.allRegions} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{d.allRegions}</SelectItem>
            <SelectItem value="NORTH_METRO">{d.regionNorthMetro}</SelectItem>
            <SelectItem value="KEELUNG_YILAN">{d.regionKeelungYilan}</SelectItem>
            <SelectItem value="HSINCHU_MIAOLI">{d.regionHsinchuMiaoli}</SelectItem>
            <SelectItem value="TAICHUNG_AREA">{d.regionTaichung}</SelectItem>
            <SelectItem value="YUNLIN_CHIAYI">{d.regionYunlinChiayi}</SelectItem>
            <SelectItem value="TAINAN_AREA">{d.regionTainan}</SelectItem>
            <SelectItem value="KAOHSIUNG_AREA">{d.regionKaohsiung}</SelectItem>
            <SelectItem value="HUALIEN_TAITUNG">{d.regionHualien}</SelectItem>
          </SelectContent>
        </Select>

        {activeGrade !== 'ALL' && (
          <Button variant="outline" size="sm" onClick={() => setActiveGrade('ALL')}>
            {d.clearGrade} ✕
          </Button>
        )}

        <Button variant="outline" size="icon" onClick={() => { load(); loadGradeCounts() }} disabled={loading} className="min-h-[44px] min-w-[44px]">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">
          {d.totalCount} {total} {d.totalUnit}
        </span>
      </div>

      {/* Customer grid */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{d.loading}</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">{d.noData}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {customers.map(c => (
            <CustomerCard
              key={c.id}
              customer={c}
              dict={d}
              onGradeChange={updateGrade}
              updating={updatingGrade === c.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            {d.prev}
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            {d.next}
          </Button>
        </div>
      )}

      {/* Import dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              {d.importTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {d.importHint}
            </p>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
              <Download className="w-4 h-4 mr-1" />
              {d.downloadTemplate}
            </Button>
            <div className="space-y-1.5">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-muted hover:file:bg-muted/80 cursor-pointer"
              />
            </div>
            {importResult && (
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-emerald-700">{d.importSuccess}</p>
                <p>{d.importCreated}：{importResult.created} {d.importUnit}</p>
                <p>{d.importUpdated}：{importResult.updated} {d.importUnit}</p>
                <p>{d.importSkipped}：{importResult.skipped}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImport(false); setImportResult(null) }}>
              {d.close}
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? d.importing : d.startImport}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Customer Card ───────────────────────────────────
function CustomerCard({
  customer: c,
  dict: d,
  onGradeChange,
  updating,
}: {
  customer: Customer
  dict: Record<string, string>
  onGradeChange: (id: string, grade: string) => void
  updating: boolean
}) {
  const lastContact = c.lastContactDate
    ? new Date(c.lastContactDate).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
    : null

  const nextFollowUp = c.nextFollowUpDate
    ? new Date(c.nextFollowUpDate).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
    : null

  const isOverdue = c.nextFollowUpDate && new Date(c.nextFollowUpDate) < new Date()

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* Top row: grade selector + name */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Link href={`/customers/${c.id}`} className="font-semibold text-sm leading-tight hover:underline line-clamp-2">
            {c.name}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">{c.code}</p>
        </div>
        <Select
          value={c.grade ?? 'NONE'}
          onValueChange={v => onGradeChange(c.id, (v ?? 'NONE') === 'NONE' ? '' : (v ?? ''))}
          disabled={updating}
        >
          <SelectTrigger className={`w-16 h-8 text-xs font-bold border rounded-lg ${c.grade ? GRADE_COLORS[c.grade] : 'text-muted-foreground'}`}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">—</SelectItem>
            {GRADES.map(g => (
              <SelectItem key={g} value={g}>
                <span className={`font-bold px-1 rounded ${GRADE_COLORS[g]}`}>{g}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Info rows */}
      <div className="space-y-1">
        {c.city && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{c.city}{c.phone ? ` · ${c.phone}` : ''}</span>
          </div>
        )}
        {c.contactPerson && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="w-3 h-3 shrink-0" />
            <span>{c.contactPerson}</span>
            {c.bedCount && <span className="ml-1">· {c.bedCount}{d.beds}</span>}
          </div>
        )}
        {!c.city && c.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3 h-3 shrink-0" />
            <span>{c.phone}</span>
          </div>
        )}
        {!c.contactPerson && c.bedCount && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3 shrink-0" />
            <span>{c.bedCount}{d.beds}</span>
          </div>
        )}
      </div>

      {/* Bottom stats */}
      <div className="flex items-center justify-between pt-1 border-t">
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{d.visits} {c._count.visitRecords}</span>
          <span>·</span>
          <span>{d.orders} {c._count.salesOrders}</span>
        </div>
        <div className="text-xs">
          {nextFollowUp ? (
            <span className={isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
              {d.nextFollowUp} {nextFollowUp}
            </span>
          ) : lastContact ? (
            <span className="text-muted-foreground">{d.lastContact} {lastContact}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
