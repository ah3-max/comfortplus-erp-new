'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, RefreshCw, Receipt, Calculator, FileDown } from 'lucide-react'
import { toast } from 'sonner'

interface VatFiling {
  id: string
  filingNo: string
  periodCode: string
  startDate: string
  endDate: string
  outputTaxBase: string
  outputTax: string
  inputTaxBase: string
  inputTax: string
  netTax: string
  status: string
  filedAt: string | null
  paidAt: string | null
  taxAuthRef: string | null
  notes: string | null
  createdBy: { name: string }
  createdAt: string
}

interface VatLedgerRow {
  taxBase: number
  taxAmount: number
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:  'bg-gray-100 text-gray-700',
  FILED:  'bg-blue-100 text-blue-700',
  PAID:   'bg-green-100 text-green-700',
}

const fmt = (v: string | number) =>
  Number(v).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default function VatFilingsPage() {
  const { dict } = useI18n()
  const vf = dict.vatFilings
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const canManage = ['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)

  const [filings, setFilings] = useState<VatFiling[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editFiling, setEditFiling] = useState<VatFiling | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)

  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const bimonthStart = currentMonth % 2 === 1 ? currentMonth : currentMonth - 1

  const [form, setForm] = useState({
    periodType: 'BIMONTHLY',
    year: String(currentYear),
    month: String(bimonthStart),
    startDate: '',
    endDate: '',
    outputTaxBase: '', outputTax: '',
    inputTaxBase: '', inputTax: '',
    notes: '',
  })

  const [updateForm, setUpdateForm] = useState({ status: '', taxAuthRef: '', filedAt: '', paidAt: '', notes: '' })

  const STATUS_LABELS = vf.statusLabels as Record<string, string>

  const fetchFilings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finance/vat-filings')
      const json = await res.json()
      setFilings(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFilings() }, [fetchFilings])

  useEffect(() => {
    const y = Number(form.year)
    const m = Number(form.month)
    if (!y || !m) return
    if (form.periodType === 'BIMONTHLY') {
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m + 1, 0)
      setForm(f => ({ ...f, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }))
    } else {
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0)
      setForm(f => ({ ...f, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }))
    }
  }, [form.periodType, form.year, form.month])

  async function autoCalc() {
    if (!form.startDate || !form.endDate) { toast.error(vf.periodRequired); return }
    setCalculating(true)
    try {
      const [outputRes, inputRes] = await Promise.all([
        fetch(`/api/finance/vat-ledger?type=OUTPUT&startDate=${form.startDate}&endDate=${form.endDate}`),
        fetch(`/api/finance/vat-ledger?type=INPUT&startDate=${form.startDate}&endDate=${form.endDate}`),
      ])
      const outputJson = await outputRes.json()
      const inputJson = await inputRes.json()

      const outputRows: VatLedgerRow[] = (outputJson.rows ?? [])
      const inputRows: VatLedgerRow[] = (inputJson.rows ?? [])

      const outputBase = outputRows.reduce((s: number, r: VatLedgerRow) => s + (r.taxBase ?? 0), 0)
      const outputTax = outputRows.reduce((s: number, r: VatLedgerRow) => s + (r.taxAmount ?? 0), 0)
      const inputBase = inputRows.reduce((s: number, r: VatLedgerRow) => s + (r.taxBase ?? 0), 0)
      const inputTax = inputRows.reduce((s: number, r: VatLedgerRow) => s + (r.taxAmount ?? 0), 0)

      setForm(f => ({
        ...f,
        outputTaxBase: String(Math.round(outputBase)),
        outputTax: String(Math.round(outputTax)),
        inputTaxBase: String(Math.round(inputBase)),
        inputTax: String(Math.round(inputTax)),
      }))
      toast.success(vf.autoFilled)
    } catch {
      toast.error(vf.autoCalcFailed)
    } finally {
      setCalculating(false)
    }
  }

  async function handleCreate() {
    setActionLoading(true)
    try {
      const y = form.year
      const m = String(form.month).padStart(2, '0')
      const m2 = String(Number(form.month) + 1).padStart(2, '0')
      const periodCode = form.periodType === 'BIMONTHLY' ? `${y}-${m}/${m2}` : `${y}-${m}`
      const res = await fetch('/api/finance/vat-filings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, periodCode }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? dict.common.createFailed); return }
      toast.success(vf.filingCreated)
      setShowNew(false)
      fetchFilings()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUpdate() {
    if (!editFiling) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/finance/vat-filings/${editFiling.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? dict.common.updateFailed); return }
      toast.success(vf.statusUpdated)
      setEditFiling(null)
      fetchFilings()
    } finally {
      setActionLoading(false)
    }
  }

  const unpaid = filings.filter(f => f.status !== 'PAID' && Number(f.netTax) > 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold">{dict.nav.vatFilings ?? vf.createTitle}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{vf.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFilings}><RefreshCw className="w-4 h-4" /></Button>
          {canManage && <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-1" />{vf.addFiling}</Button>}
        </div>
      </div>

      {/* Summary */}
      {unpaid.length > 0 && (
        <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-3 mb-5 text-sm text-yellow-800">
          ⚠ {vf.unpaidWarning.replace('{n}', String(unpaid.length))}
          <strong> {fmt(unpaid.reduce((s, f) => s + Number(f.netTax), 0))} {vf.unpaidUnit}</strong>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{vf.loading}</div>
      ) : filings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{vf.noData}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-2 pr-3">{vf.colFilingNo}</th>
                <th className="text-left py-2 pr-3">{vf.colPeriod}</th>
                <th className="text-right py-2 pr-3">{vf.colOutputTax}</th>
                <th className="text-right py-2 pr-3">{vf.colInputTax}</th>
                <th className="text-right py-2 pr-3">{vf.colNetTax}</th>
                <th className="text-left py-2 pr-3">{vf.colStatus}</th>
                <th className="text-left py-2 pr-3">{vf.colFiledAt}</th>
                {canManage && <th className="py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {filings.map(f => (
                <tr key={f.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 pr-3 font-medium">{f.filingNo}</td>
                  <td className="py-2 pr-3">{f.periodCode}</td>
                  <td className="py-2 pr-3 text-right">{fmt(f.outputTax)}</td>
                  <td className="py-2 pr-3 text-right">{fmt(f.inputTax)}</td>
                  <td className={`py-2 pr-3 text-right font-bold ${Number(f.netTax) > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {Number(f.netTax) > 0
                      ? vf.taxDue.replace('{n}', fmt(f.netTax))
                      : vf.taxRefund.replace('{n}', fmt(Math.abs(Number(f.netTax))))}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge className={STATUS_COLORS[f.status] ?? ''}>{STATUS_LABELS[f.status] ?? f.status}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{f.filedAt ? f.filedAt.slice(0, 10) : '-'}</td>
                  {canManage && (
                    <td className="py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditFiling(f)
                          setUpdateForm({ status: f.status, taxAuthRef: f.taxAuthRef ?? '', filedAt: f.filedAt?.slice(0, 10) ?? '', paidAt: f.paidAt?.slice(0, 10) ?? '', notes: f.notes ?? '' })
                        }}>{vf.updateBtn}</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          title={vf.exportBtn ?? '匯出 401 申報書'}
                          onClick={() => window.open(`/api/finance/vat-filings/${f.id}/export`, '_blank')}
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Filing Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{vf.createTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{vf.fieldFrequency}</Label>
                <Select value={form.periodType} onValueChange={v => { if (v) setForm(f => ({ ...f, periodType: v })) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BIMONTHLY">{vf.freqBimonthly}</SelectItem>
                    <SelectItem value="MONTHLY">{vf.freqMonthly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{vf.fieldYear}</Label>
                <Select value={form.year} onValueChange={v => { if (v) setForm(f => ({ ...f, year: v })) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[currentYear, currentYear - 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.periodType === 'BIMONTHLY' ? vf.fieldStartMonth : vf.fieldMonth}</Label>
                <Select value={form.month} onValueChange={v => { if (v) setForm(f => ({ ...f, month: v })) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(form.periodType === 'BIMONTHLY'
                      ? [1, 3, 5, 7, 9, 11]
                      : Array.from({ length: 12 }, (_, i) => i + 1)
                    ).map(m => <SelectItem key={m} value={String(m)}>{m}{vf.monthSuffix}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{vf.fieldStartDate}</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>{vf.fieldEndDate}</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={autoCalc} disabled={calculating} className="w-full">
              <Calculator className="w-4 h-4 mr-1" />
              {calculating ? vf.calculating : vf.autoCalcBtn}
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{vf.fieldOutputBase}</Label>
                <Input type="number" value={form.outputTaxBase} onChange={e => setForm(f => ({ ...f, outputTaxBase: e.target.value }))} />
              </div>
              <div>
                <Label>{vf.fieldOutputTax}</Label>
                <Input type="number" value={form.outputTax} onChange={e => setForm(f => ({ ...f, outputTax: e.target.value }))} />
              </div>
              <div>
                <Label>{vf.fieldInputBase}</Label>
                <Input type="number" value={form.inputTaxBase} onChange={e => setForm(f => ({ ...f, inputTaxBase: e.target.value }))} />
              </div>
              <div>
                <Label>{vf.fieldInputTax}</Label>
                <Input type="number" value={form.inputTax} onChange={e => setForm(f => ({ ...f, inputTax: e.target.value }))} />
              </div>
            </div>
            {form.outputTax && form.inputTax && (
              <div className={`text-sm font-medium p-2 rounded ${(Number(form.outputTax) - Number(form.inputTax)) > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {vf.netTaxLabel.replace('{n}', fmt(Number(form.outputTax) - Number(form.inputTax)))}
                {(Number(form.outputTax) - Number(form.inputTax)) <= 0 && vf.canApplyRefund}
              </div>
            )}
            <div>
              <Label>{vf.fieldNotes}</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={vf.notesPlaceholder} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={actionLoading}>{actionLoading ? vf.creating : vf.btnCreate}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={!!editFiling} onOpenChange={open => { if (!open) setEditFiling(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{vf.updateTitle} — {editFiling?.filingNo}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{vf.fieldStatus}</Label>
              <Select value={updateForm.status} onValueChange={v => { if (v) setUpdateForm(f => ({ ...f, status: v })) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {updateForm.status === 'FILED' || updateForm.status === 'PAID' ? (
              <div>
                <Label>{vf.fieldFiledAt}</Label>
                <Input type="date" value={updateForm.filedAt} onChange={e => setUpdateForm(f => ({ ...f, filedAt: e.target.value }))} />
              </div>
            ) : null}
            {updateForm.status === 'PAID' && (
              <>
                <div>
                  <Label>{vf.fieldPaidAt}</Label>
                  <Input type="date" value={updateForm.paidAt} onChange={e => setUpdateForm(f => ({ ...f, paidAt: e.target.value }))} />
                </div>
                <div>
                  <Label>{vf.fieldTaxAuthRef}</Label>
                  <Input value={updateForm.taxAuthRef} onChange={e => setUpdateForm(f => ({ ...f, taxAuthRef: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <Label>{vf.fieldNotes}</Label>
              <Input value={updateForm.notes} onChange={e => setUpdateForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFiling(null)}>{dict.common.cancel}</Button>
            <Button onClick={handleUpdate} disabled={actionLoading}>{actionLoading ? vf.updating : vf.btnUpdate}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
