'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n/context'
import { RefreshCw, PlayCircle, CheckCircle2, SkipForward, Zap, FileText, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'

interface PendingItem {
  id: string
  refNo: string
  type: 'SalesOrder' | 'PurchaseOrder'
  amount: number
  cogAmount?: number
  party: string
  customerType?: string
  date: string
  status: string
}

interface RecentEntry {
  id: string
  entryNo: string
  entryDate: string
  description: string
  status: string
  totalDebit: number
  totalCredit: number
  referenceType: string
  referenceId: string
  createdAt: string
}

interface PendingData {
  salesOrders: PendingItem[]
  purchaseOrders: PendingItem[]
}

type TabKey = 'pending' | 'recent' | 'rules'

export default function AutoJournalPage() {
  const { dict } = useI18n()
  const aj = dict.autoJournal
  const [tab, setTab] = useState<TabKey>('pending')
  const [pending, setPending] = useState<PendingData | null>(null)
  const [recent, setRecent] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState<string | null>(null) // 'all' | 'sales' | 'purchase'
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const JOURNAL_RULES = [
    {
      type: aj.rules.salesConfirmType,
      trigger: aj.rules.salesConfirmTrigger,
      debit: aj.rules.salesConfirmDebit,
      credit: aj.rules.salesConfirmCredit,
      cogDebit: aj.rules.salesConfirmCogDebit,
      cogCredit: aj.rules.salesConfirmCogCredit,
    },
    {
      type: aj.rules.purchaseReceiptType,
      trigger: aj.rules.purchaseReceiptTrigger,
      debit: aj.rules.purchaseReceiptDebit,
      credit: aj.rules.purchaseReceiptCredit,
    },
    {
      type: aj.rules.salesReturnType,
      trigger: aj.rules.salesReturnTrigger,
      debit: aj.rules.salesReturnDebit,
      credit: aj.rules.salesReturnCredit,
    },
    {
      type: aj.rules.purchaseReturnType,
      trigger: aj.rules.purchaseReturnTrigger,
      debit: aj.rules.purchaseReturnDebit,
      credit: aj.rules.purchaseReturnCredit,
    },
    {
      type: aj.rules.receiptEntryType,
      trigger: aj.rules.receiptEntryTrigger,
      debit: aj.rules.receiptEntryDebit,
      credit: aj.rules.receiptEntryCredit,
    },
    {
      type: aj.rules.paymentEntryType,
      trigger: aj.rules.paymentEntryTrigger,
      debit: aj.rules.paymentEntryDebit,
      credit: aj.rules.paymentEntryCredit,
    },
  ]

  const fmt = (n: number) =>
    new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  const loadPending = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finance/auto-journal?view=pending')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setPending(json.pending)
    } catch {
      toast.error(dict.common.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [dict.common.loadFailed])

  const loadRecent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finance/auto-journal?view=recent')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setRecent(json.entries)
    } catch {
      toast.error(dict.common.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [dict.common.loadFailed])

  useEffect(() => {
    if (tab === 'pending') loadPending()
    else if (tab === 'recent') loadRecent()
  }, [tab, loadPending, loadRecent])

  const postSelected = async (type: 'SalesOrder' | 'PurchaseOrder' | 'ALL', ids?: string[]) => {
    const key = ids ? 'sel' : type.toLowerCase()
    setPosting(key)
    try {
      const res = await fetch('/api/finance/auto-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ids }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      toast.success(`✅ ${aj.createdMsg} ${json.created} ${aj.skippedMsg} ${json.skipped} ${aj.skippedExisted}`)
      setSelected(new Set())
      loadPending()
    } catch {
      toast.error(dict.autoJournal.batchFailed)
    } finally {
      setPosting(null)
    }
  }

  const allPending = [...(pending?.salesOrders ?? []), ...(pending?.purchaseOrders ?? [])]
  const selectedIds = Array.from(selected)

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{dict.nav?.autoJournal}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{aj.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto" onClick={() => tab === 'pending' ? loadPending() : loadRecent()}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{aj.reload}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: 'pending', label: aj.tabPending },
          { key: 'recent', label: aj.tabRecent },
          { key: 'rules', label: aj.tabRules },
        ] as { key: TabKey; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.key === 'pending' && pending && allPending.length > 0 && (
              <Badge className="ml-1.5 bg-orange-100 text-orange-700 border-0 text-xs">{allPending.length}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Pending ── */}
      {tab === 'pending' && (
        <div className="space-y-4">
          {/* Batch action bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              disabled={!!posting || !pending || allPending.length === 0}
              onClick={() => postSelected('ALL')}
            >
              <Zap size={14} />
              {posting === 'all' ? aj.buildingAll : `${aj.buildAll}（${allPending.length} ${dict.common.items}）`}
            </Button>
            {selected.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={!!posting}
                onClick={() => {
                  const soIds = selectedIds.filter(id => pending?.salesOrders.some(o => o.id === id))
                  const poIds = selectedIds.filter(id => pending?.purchaseOrders.some(o => o.id === id))
                  if (soIds.length > 0) postSelected('SalesOrder', soIds)
                  if (poIds.length > 0) postSelected('PurchaseOrder', poIds)
                }}
              >
                <PlayCircle size={14} />
                {aj.buildSelected}（{selected.size} {dict.common.items}）
              </Button>
            )}
          </div>

          {loading && <div className="py-8 text-center text-gray-400">{dict.common.loading}</div>}

          {/* Sales Orders */}
          {!loading && pending && pending.salesOrders.length > 0 && (
            <Section
              title={aj.salesOrdersTitle}
              icon={FileText}
              items={pending.salesOrders}
              selected={selected}
              onToggle={id => {
                const s = new Set(selected)
                s.has(id) ? s.delete(id) : s.add(id)
                setSelected(s)
              }}
              onPost={id => postSelected('SalesOrder', [id])}
              posting={posting}
              fmt={fmt}
              buildActionLabel={aj.buildAction}
              colDocNo={aj.colDocNo}
              colParty={aj.colParty}
              colAmount={dict.common.amount}
              colStatus={dict.common.status}
              colDate={dict.common.date}
            />
          )}

          {/* Purchase Orders */}
          {!loading && pending && pending.purchaseOrders.length > 0 && (
            <Section
              title={aj.purchaseOrdersTitle}
              icon={ShoppingBag}
              items={pending.purchaseOrders}
              selected={selected}
              onToggle={id => {
                const s = new Set(selected)
                s.has(id) ? s.delete(id) : s.add(id)
                setSelected(s)
              }}
              onPost={id => postSelected('PurchaseOrder', [id])}
              posting={posting}
              fmt={fmt}
              buildActionLabel={aj.buildAction}
              colDocNo={aj.colDocNo}
              colParty={aj.colParty}
              colAmount={dict.common.amount}
              colStatus={dict.common.status}
              colDate={dict.common.date}
            />
          )}

          {!loading && pending && allPending.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-green-400" />
              <p className="font-medium">{aj.noEntries}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Recent ── */}
      {tab === 'recent' && (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">{aj.colVoucherNo}</th>
                <th className="px-4 py-3 text-left">{dict.common.date}</th>
                <th className="px-4 py-3 text-left">{aj.colSummary}</th>
                <th className="px-4 py-3 text-left">{aj.colSourceType}</th>
                <th className="px-4 py-3 text-right">{aj.colDebitTotal}</th>
                <th className="px-4 py-3 text-right">{aj.colCreditTotal}</th>
                <th className="px-4 py-3 text-center">{dict.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">{dict.common.loading}</td></tr>
              ) : recent.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">{aj.noAutoEntries}</td></tr>
              ) : recent.map(e => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{e.entryNo}</td>
                  <td className="px-4 py-3 text-gray-600">{e.entryDate?.slice(0, 10)}</td>
                  <td className="px-4 py-3 max-w-[220px] truncate">{e.description}</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-blue-50 text-blue-700 border-0 text-xs">{e.referenceType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(Number(e.totalDebit))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(Number(e.totalCredit))}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={e.status === 'POSTED' ? 'bg-green-100 text-green-700 border-0' : 'bg-gray-100 text-gray-600 border-0'}>
                      {e.status === 'POSTED' ? aj.posted : e.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Rules ── */}
      {tab === 'rules' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{aj.rulesDesc}</p>
          <div className="grid gap-3">
            {JOURNAL_RULES.map((r, i) => (
              <div key={i} className="border rounded-xl p-4 bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-700 border-0">{r.type}</Badge>
                  <span className="text-xs text-gray-500">{r.trigger}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-1 text-xs">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <span className="font-semibold text-blue-700">{aj.debitLabel}</span>
                    <div className="mt-0.5 text-gray-700">{r.debit}</div>
                    {r.cogDebit && <div className="mt-0.5 text-gray-500">＋ {r.cogDebit}{aj.costNote}</div>}
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <span className="font-semibold text-green-700">{aj.creditLabel}</span>
                    <div className="mt-0.5 text-gray-700">{r.credit}</div>
                    {r.cogCredit && <div className="mt-0.5 text-gray-500">＋ {r.cogCredit}{aj.costNote}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  title, icon: Icon, items, selected, onToggle, onPost, posting, fmt,
  buildActionLabel, colDocNo, colParty, colAmount, colStatus, colDate,
}: {
  title: string
  icon: React.ElementType
  items: PendingItem[]
  selected: Set<string>
  onToggle: (id: string) => void
  onPost: (id: string) => void
  posting: string | null
  fmt: (n: number) => string
  buildActionLabel: string
  colDocNo: string
  colParty: string
  colAmount: string
  colStatus: string
  colDate: string
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
        <Icon size={15} className="text-gray-500" />
        <span className="font-medium text-sm">{title}</span>
        <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">{items.length}</Badge>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-gray-500">
            <th className="px-4 py-2 w-8"></th>
            <th className="px-4 py-2 text-left">{colDocNo}</th>
            <th className="px-4 py-2 text-left">{colParty}</th>
            <th className="px-4 py-2 text-right">{colAmount}</th>
            <th className="px-4 py-2 text-left">{colStatus}</th>
            <th className="px-4 py-2 text-center">{colDate}</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className={`border-b last:border-0 hover:bg-gray-50 ${selected.has(item.id) ? 'bg-blue-50' : ''}`}>
              <td className="px-4 py-2 text-center">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="rounded"
                />
              </td>
              <td className="px-4 py-2 font-mono text-xs font-medium">{item.refNo}</td>
              <td className="px-4 py-2">{item.party}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(item.amount)}</td>
              <td className="px-4 py-2">
                <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">{item.status}</Badge>
              </td>
              <td className="px-4 py-2 text-center text-gray-500 text-xs">
                {new Date(item.date).toLocaleDateString('zh-TW')}
              </td>
              <td className="px-4 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-blue-600"
                  disabled={!!posting}
                  onClick={() => onPost(item.id)}
                >
                  <SkipForward size={11} />{buildActionLabel}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
