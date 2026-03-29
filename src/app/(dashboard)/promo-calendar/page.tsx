'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, CalendarRange, Target, TrendingUp, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface PromoRecord {
  id: string
  promoCode: string
  promoName: string
  promoTier: string
  year: number
  eventStartDate: string
  eventEndDate: string
  prepStartDate: string
  negoStartDate: string
  execStartDate: string
  currentPhase: string
  daysUntilEvent: number
  revenueTarget: number | null
  revenueActual: number | null
  orderTarget: number | null
  orderActual: number | null
  targetChannels: string[]
  isActive: boolean
  notes: string | null
  responsibleUser: { id: string; name: string } | null
  _count: { businessEvents: number; meetingRecords: number }
}

const TIER_LABEL: Record<string, string> = {
  NATIONAL_MAJOR: '全國大檔', QUARTERLY: '季度大促',
  MONTHLY: '月檔', FLASH_SALE: '閃購', CHANNEL_SPECIAL: '通路特殊',
}
const TIER_COLOR: Record<string, string> = {
  NATIONAL_MAJOR: 'bg-red-100 text-red-700', QUARTERLY: 'bg-orange-100 text-orange-700',
  MONTHLY: 'bg-blue-100 text-blue-700', FLASH_SALE: 'bg-yellow-100 text-yellow-700',
  CHANNEL_SPECIAL: 'bg-purple-100 text-purple-700',
}
const PHASE_LABEL: Record<string, string> = {
  PREPARATION: '備貨規劃', NEGOTIATION: '談判協商',
  EXECUTION: '執行期', LIVE: '活動中', REVIEW: '檢討期',
}
const PHASE_COLOR: Record<string, string> = {
  PREPARATION: 'bg-gray-100 text-gray-600', NEGOTIATION: 'bg-blue-100 text-blue-700',
  EXECUTION: 'bg-yellow-100 text-yellow-700', LIVE: 'bg-emerald-100 text-emerald-700',
  REVIEW: 'bg-purple-100 text-purple-700',
}

export default function PromoCalendarPage() {
  const { dict } = useI18n()
  const now = new Date()
  const [promos, setPromos] = useState<PromoRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState(String(now.getFullYear()))
  const [tierFilter, setTierFilter] = useState('__all__')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<PromoRecord | null>(null)
  const [form, setForm] = useState({
    promoCode: '', promoName: '', promoTier: 'MONTHLY', year: now.getFullYear(),
    eventStartDate: '', eventEndDate: '',
    revenueTarget: '', orderTarget: '', notes: '',
  })

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year })
      if (tierFilter !== '__all__') params.set('promoTier', tierFilter)
      const res = await fetch(`/api/promo-calendar?${params}`)
      if (!res.ok) throw new Error()
      setPromos(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [year, tierFilter])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/promo-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          revenueTarget: form.revenueTarget ? Number(form.revenueTarget) : null,
          orderTarget: form.orderTarget ? Number(form.orderTarget) : null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? '建立失敗')
      toast.success(dict.promoCalendar.created)
      setShowCreate(false)
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : dict.common.createFailed) }
  }

  // Summary
  const upcoming = promos.filter(p => p.daysUntilEvent > 0 && p.daysUntilEvent <= 90).length
  const live = promos.filter(p => p.currentPhase === 'LIVE').length
  const totalTarget = promos.reduce((s, p) => s + (p.revenueTarget ?? 0), 0)
  const totalActual = promos.reduce((s, p) => s + (p.revenueActual ?? 0), 0)

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.promoCalendar ?? '促銷行事曆'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">電商檔期規劃、談判時程、目標追蹤</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus size={16} />新增檔期
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><AlertCircle size={14} className="text-yellow-500" /><span className="text-xs text-gray-400">90天內檔期</span></div>
          <div className="text-2xl font-bold text-yellow-600">{upcoming}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><CalendarRange size={14} className="text-emerald-500" /><span className="text-xs text-gray-400">進行中</span></div>
          <div className="text-2xl font-bold text-emerald-600">{live}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Target size={14} className="text-blue-500" /><span className="text-xs text-gray-400">年度目標</span></div>
          <div className="text-xl font-bold">{totalTarget > 0 ? fmt(totalTarget) : '-'}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-purple-500" /><span className="text-xs text-gray-400">年度實績</span></div>
          <div className="text-xl font-bold text-purple-600">{totalActual > 0 ? fmt(totalActual) : '-'}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-white border rounded-xl p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">年份</span>
          <Input type="number" value={year} onChange={e => setYear(e.target.value)} className="h-9 w-24" />
        </div>
        <Select value={tierFilter} onValueChange={v => { if (v) setTierFilter(v) }}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部檔級</SelectItem>
            {Object.entries(TIER_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Promo list */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-gray-400">載入中…</div>
        ) : promos.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <CalendarRange size={40} className="mx-auto mb-3 opacity-30" />
            <p>尚無促銷檔期</p>
          </div>
        ) : promos.map(p => {
          const achievePct = p.revenueTarget && p.revenueActual
            ? Math.round(p.revenueActual / p.revenueTarget * 1000) / 10 : null

          return (
            <div key={p.id} className="bg-white border rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => setSelected(p)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-gray-400">{p.promoCode}</span>
                    <Badge className={TIER_COLOR[p.promoTier]}>{TIER_LABEL[p.promoTier]}</Badge>
                    <Badge className={PHASE_COLOR[p.currentPhase]}>{PHASE_LABEL[p.currentPhase]}</Badge>
                    {!p.isActive && <Badge className="bg-gray-100 text-gray-400">已停用</Badge>}
                  </div>
                  <h3 className="font-semibold mt-1">{p.promoName}</h3>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(p.eventStartDate).toLocaleDateString('zh-TW')} ～ {new Date(p.eventEndDate).toLocaleDateString('zh-TW')}
                    {p.daysUntilEvent > 0
                      ? <span className="ml-2 text-yellow-600">距活動 {p.daysUntilEvent} 天</span>
                      : p.currentPhase === 'LIVE'
                      ? <span className="ml-2 text-emerald-600">進行中</span>
                      : <span className="ml-2 text-gray-400">已結束</span>
                    }
                  </div>
                  {p.targetChannels.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {p.targetChannels.map(ch => (
                        <span key={ch} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{ch}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {p.revenueTarget && (
                    <div className="text-xs text-gray-400">目標 {fmt(p.revenueTarget)}</div>
                  )}
                  {achievePct !== null && (
                    <div className={`text-sm font-semibold ${achievePct >= 100 ? 'text-emerald-600' : achievePct >= 80 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {achievePct}%
                    </div>
                  )}
                  {p.responsibleUser && (
                    <div className="text-xs text-gray-400 mt-1">{p.responsibleUser.name}</div>
                  )}
                </div>
              </div>

              {/* Phase timeline */}
              <div className="mt-3 flex gap-1 items-center">
                {['PREPARATION', 'NEGOTIATION', 'EXECUTION', 'LIVE', 'REVIEW'].map((ph, i) => (
                  <div key={ph} className="flex items-center gap-1 flex-1">
                    <div className={`h-1.5 flex-1 rounded-full transition-all ${p.currentPhase === ph || ['LIVE','REVIEW'].includes(ph) && ['LIVE','REVIEW'].includes(p.currentPhase) && i <= ['PREPARATION','NEGOTIATION','EXECUTION','LIVE','REVIEW'].indexOf(p.currentPhase) ? 'bg-blue-500' : 'bg-gray-200'}`} />
                    {i < 4 && <div className={`w-2 h-2 rounded-full shrink-0 ${p.currentPhase === ph ? 'bg-blue-500' : 'bg-gray-200'}`} />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-0.5 px-0.5">
                <span>備貨</span><span>談判</span><span>執行</span><span>活動</span><span>檢討</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增促銷檔期</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">檔期代碼 *</div>
                <Input value={form.promoCode} onChange={e => setForm(f => ({ ...f, promoCode: e.target.value }))} placeholder="618-2026" className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">年份</div>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} className="h-9" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">檔期名稱 *</div>
              <Input value={form.promoName} onChange={e => setForm(f => ({ ...f, promoName: e.target.value }))} placeholder="618購物節" />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">檔級</div>
              <Select value={form.promoTier} onValueChange={v => { if (v) setForm(f => ({ ...f, promoTier: v })) }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIER_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">活動開始 *</div>
                <Input type="date" value={form.eventStartDate} onChange={e => setForm(f => ({ ...f, eventStartDate: e.target.value }))} className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">活動結束 *</div>
                <Input type="date" value={form.eventEndDate} onChange={e => setForm(f => ({ ...f, eventEndDate: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">營收目標</div>
                <Input type="number" value={form.revenueTarget} onChange={e => setForm(f => ({ ...f, revenueTarget: e.target.value }))} placeholder="0" className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">訂單目標</div>
                <Input type="number" value={form.orderTarget} onChange={e => setForm(f => ({ ...f, orderTarget: e.target.value }))} placeholder="0" className="h-9" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} className="flex-1" disabled={!form.promoCode || !form.promoName || !form.eventStartDate || !form.eventEndDate}>建立</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.promoName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2 text-sm">
                <div className="flex gap-2 flex-wrap">
                  <Badge className={TIER_COLOR[selected.promoTier]}>{TIER_LABEL[selected.promoTier]}</Badge>
                  <Badge className={PHASE_COLOR[selected.currentPhase]}>{PHASE_LABEL[selected.currentPhase]}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-400">活動期間</div>
                    <div>{new Date(selected.eventStartDate).toLocaleDateString('zh-TW')} ～ {new Date(selected.eventEndDate).toLocaleDateString('zh-TW')}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-400">備貨啟動</div>
                    <div>{new Date(selected.prepStartDate).toLocaleDateString('zh-TW')}</div>
                  </div>
                  {selected.revenueTarget && (
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">營收目標</div>
                      <div className="font-medium">{fmt(selected.revenueTarget)}</div>
                    </div>
                  )}
                  {selected.revenueActual !== null && (
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">實績</div>
                      <div className="font-medium text-emerald-600">{fmt(selected.revenueActual)}</div>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-400">關聯活動</div>
                    <div>{selected._count.businessEvents} 個</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-400">會議紀錄</div>
                    <div>{selected._count.meetingRecords} 筆</div>
                  </div>
                </div>
                {selected.targetChannels.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">目標通路</div>
                    <div className="flex gap-1 flex-wrap">
                      {selected.targetChannels.map(ch => <span key={ch} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{ch}</span>)}
                    </div>
                  </div>
                )}
                {selected.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">{selected.notes}</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
