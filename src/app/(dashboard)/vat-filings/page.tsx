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
import { Plus, RefreshCw, Receipt, Calculator } from 'lucide-react'
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

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT:  { label: '草稿',   color: 'bg-gray-100 text-gray-700' },
  FILED:  { label: '已申報', color: 'bg-blue-100 text-blue-700' },
  PAID:   { label: '已繳納', color: 'bg-green-100 text-green-700' },
}

const fmt = (v: string | number) =>
  Number(v).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default function VatFilingsPage() {
  const { dict } = useI18n()
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
  // Bimonthly: odd months = period start
  const bimonthStart = currentMonth % 2 === 1 ? currentMonth : currentMonth - 1
  const bimonthEnd = bimonthStart + 1

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

  // Auto set dates when form period changes
  useEffect(() => {
    const y = Number(form.year)
    const m = Number(form.month)
    if (!y || !m) return
    if (form.periodType === 'BIMONTHLY') {
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m + 1, 0) // end of month m+1
      setForm(f => ({ ...f, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }))
    } else {
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0)
      setForm(f => ({ ...f, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }))
    }
  }, [form.periodType, form.year, form.month])

  async function autoCalc() {
    if (!form.startDate || !form.endDate) { toast.error('請先設定期間'); return }
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
      toast.success('已自動帶入稅務資料')
    } catch {
      toast.error('自動計算失敗')
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
      if (!res.ok) { toast.error(json.error ?? '建立失敗'); return }
      toast.success('申報資料已建立')
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
      if (!res.ok) { toast.error(json.error ?? '更新失敗'); return }
      toast.success('申報狀態已更新')
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
          <h1 className="text-xl font-bold">{dict.nav.vatFilings ?? '營業稅申報'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">雙月/月申報記錄、銷進項稅額彙整</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFilings}><RefreshCw className="w-4 h-4" /></Button>
          {canManage && <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-1" />新增申報</Button>}
        </div>
      </div>

      {/* Summary */}
      {unpaid.length > 0 && (
        <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-3 mb-5 text-sm text-yellow-800">
          ⚠ 有 {unpaid.length} 筆申報尚未完成繳納，合計應納稅額：
          <strong> {fmt(unpaid.reduce((s, f) => s + Number(f.netTax), 0))} 元</strong>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : filings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>尚無申報紀錄</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-2 pr-3">申報單號</th>
                <th className="text-left py-2 pr-3">申報期間</th>
                <th className="text-right py-2 pr-3">銷項稅額</th>
                <th className="text-right py-2 pr-3">進項稅額</th>
                <th className="text-right py-2 pr-3">應納稅額</th>
                <th className="text-left py-2 pr-3">狀態</th>
                <th className="text-left py-2 pr-3">申報日</th>
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
                    {Number(f.netTax) > 0 ? `應繳 ${fmt(f.netTax)}` : `退稅 ${fmt(Math.abs(Number(f.netTax)))}`}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge className={STATUS_MAP[f.status]?.color ?? ''}>{STATUS_MAP[f.status]?.label ?? f.status}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{f.filedAt ? f.filedAt.slice(0, 10) : '-'}</td>
                  {canManage && (
                    <td className="py-2">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditFiling(f)
                        setUpdateForm({ status: f.status, taxAuthRef: f.taxAuthRef ?? '', filedAt: f.filedAt?.slice(0, 10) ?? '', paidAt: f.paidAt?.slice(0, 10) ?? '', notes: f.notes ?? '' })
                      }}>更新</Button>
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
          <DialogHeader><DialogTitle>新增營業稅申報</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>申報頻率</Label>
                <Select value={form.periodType} onValueChange={v => { if (v) setForm(f => ({ ...f, periodType: v })) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BIMONTHLY">雙月申報</SelectItem>
                    <SelectItem value="MONTHLY">月申報</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>年度</Label>
                <Select value={form.year} onValueChange={v => { if (v) setForm(f => ({ ...f, year: v })) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[currentYear, currentYear - 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.periodType === 'BIMONTHLY' ? '起始月' : '月份'}</Label>
                <Select value={form.month} onValueChange={v => { if (v) setForm(f => ({ ...f, month: v })) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(form.periodType === 'BIMONTHLY'
                      ? [1, 3, 5, 7, 9, 11]
                      : Array.from({ length: 12 }, (_, i) => i + 1)
                    ).map(m => <SelectItem key={m} value={String(m)}>{m} 月</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>起始日</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>截止日</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={autoCalc} disabled={calculating} className="w-full">
              <Calculator className="w-4 h-4 mr-1" />
              {calculating ? '計算中...' : '自動帶入銷進項稅額'}
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>銷項稅基</Label>
                <Input type="number" value={form.outputTaxBase} onChange={e => setForm(f => ({ ...f, outputTaxBase: e.target.value }))} />
              </div>
              <div>
                <Label>銷項稅額</Label>
                <Input type="number" value={form.outputTax} onChange={e => setForm(f => ({ ...f, outputTax: e.target.value }))} />
              </div>
              <div>
                <Label>進項稅基</Label>
                <Input type="number" value={form.inputTaxBase} onChange={e => setForm(f => ({ ...f, inputTaxBase: e.target.value }))} />
              </div>
              <div>
                <Label>進項稅額</Label>
                <Input type="number" value={form.inputTax} onChange={e => setForm(f => ({ ...f, inputTax: e.target.value }))} />
              </div>
            </div>
            {form.outputTax && form.inputTax && (
              <div className={`text-sm font-medium p-2 rounded ${(Number(form.outputTax) - Number(form.inputTax)) > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                應納稅額：{fmt(Number(form.outputTax) - Number(form.inputTax))} 元
                {(Number(form.outputTax) - Number(form.inputTax)) <= 0 && ' （可申請退稅）'}
              </div>
            )}
            <div>
              <Label>備註</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="選填" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={actionLoading}>{actionLoading ? '建立中...' : '建立'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={!!editFiling} onOpenChange={open => { if (!open) setEditFiling(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>更新申報狀態 — {editFiling?.filingNo}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>狀態</Label>
              <Select value={updateForm.status} onValueChange={v => { if (v) setUpdateForm(f => ({ ...f, status: v })) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">草稿</SelectItem>
                  <SelectItem value="FILED">已申報</SelectItem>
                  <SelectItem value="PAID">已繳納</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {updateForm.status === 'FILED' || updateForm.status === 'PAID' ? (
              <div>
                <Label>申報日期</Label>
                <Input type="date" value={updateForm.filedAt} onChange={e => setUpdateForm(f => ({ ...f, filedAt: e.target.value }))} />
              </div>
            ) : null}
            {updateForm.status === 'PAID' && (
              <>
                <div>
                  <Label>繳納日期</Label>
                  <Input type="date" value={updateForm.paidAt} onChange={e => setUpdateForm(f => ({ ...f, paidAt: e.target.value }))} />
                </div>
                <div>
                  <Label>稅捐機關序號</Label>
                  <Input value={updateForm.taxAuthRef} onChange={e => setUpdateForm(f => ({ ...f, taxAuthRef: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <Label>備註</Label>
              <Input value={updateForm.notes} onChange={e => setUpdateForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFiling(null)}>取消</Button>
            <Button onClick={handleUpdate} disabled={actionLoading}>{actionLoading ? '更新中...' : '更新'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
