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

const JOURNAL_RULES = [
  {
    type: '銷貨確認',
    trigger: '銷售訂單狀態變更為 CONFIRMED/SHIPPED',
    debit: '1130 應收帳款（含稅）',
    credit: '4110/4120 銷貨收入 + 2160 銷項稅額（5%）',
    cogDebit: '5100 銷貨成本（若有 costOfGoods）',
    cogCredit: '1150 存貨',
  },
  {
    type: '採購進貨',
    trigger: '採購訂單狀態變更為 RECEIVED/COMPLETED',
    debit: '1150 存貨 + 1180 進項稅額（5%）',
    credit: '2130 應付帳款（含稅）',
  },
  {
    type: '銷貨退回',
    trigger: '退貨單狀態核准',
    debit: '4200 銷貨退回 + 1180 進項稅額',
    credit: '1130 應收帳款',
  },
  {
    type: '採購退貨',
    trigger: '進貨退貨單核准',
    debit: '2130 應付帳款',
    credit: '1150 存貨 + 1180 進項稅額',
  },
  {
    type: '收款入帳',
    trigger: '收款紀錄建立（direction=INCOMING）',
    debit: '1102 銀行存款',
    credit: '1130 應收帳款',
  },
  {
    type: '付款出帳',
    trigger: '付款紀錄建立（direction=OUTGOING）',
    debit: '2130 應付帳款',
    credit: '1102 銀行存款',
  },
]

export default function AutoJournalPage() {
  const { dict } = useI18n()
  const [tab, setTab] = useState<TabKey>('pending')
  const [pending, setPending] = useState<PendingData | null>(null)
  const [recent, setRecent] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState<string | null>(null) // 'all' | 'sales' | 'purchase'
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
  }, [])

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
  }, [])

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
      toast.success(`✅ 已建立 ${json.created} 筆傳票，跳過 ${json.skipped} 筆（已存在）`)
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
          <h1 className="text-2xl font-bold">{dict.nav?.autoJournal ?? '自動化會計分錄'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">依標準科目範本自動補建傳票，安全冪等（不重複建立）</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto" onClick={() => tab === 'pending' ? loadPending() : loadRecent()}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />重新載入
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: 'pending', label: '待補建傳票' },
          { key: 'recent', label: '近期自動傳票' },
          { key: 'rules', label: '科目規則' },
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
              {posting === 'all' ? '建立中…' : `全部補建傳票（${allPending.length} 筆）`}
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
                補建已選（{selected.size} 筆）
              </Button>
            )}
          </div>

          {loading && <div className="py-8 text-center text-gray-400">載入中…</div>}

          {/* Sales Orders */}
          {!loading && pending && pending.salesOrders.length > 0 && (
            <Section
              title="銷售訂單"
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
            />
          )}

          {/* Purchase Orders */}
          {!loading && pending && pending.purchaseOrders.length > 0 && (
            <Section
              title="採購訂單"
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
            />
          )}

          {!loading && pending && allPending.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-green-400" />
              <p className="font-medium">所有文件均已建立傳票</p>
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
                <th className="px-4 py-3 text-left">傳票號</th>
                <th className="px-4 py-3 text-left">日期</th>
                <th className="px-4 py-3 text-left">摘要</th>
                <th className="px-4 py-3 text-left">來源類型</th>
                <th className="px-4 py-3 text-right">借方合計</th>
                <th className="px-4 py-3 text-right">貸方合計</th>
                <th className="px-4 py-3 text-center">狀態</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">載入中…</td></tr>
              ) : recent.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">無自動傳票</td></tr>
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
                      {e.status === 'POSTED' ? '已過帳' : e.status}
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
          <p className="text-sm text-gray-500">系統預設的自動分錄規則（依台灣會計實務）。稅率固定 5%，科目代碼可在傳票管理調整。</p>
          <div className="grid gap-3">
            {JOURNAL_RULES.map((r, i) => (
              <div key={i} className="border rounded-xl p-4 bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-700 border-0">{r.type}</Badge>
                  <span className="text-xs text-gray-500">{r.trigger}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-1 text-xs">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <span className="font-semibold text-blue-700">借方（Dr）</span>
                    <div className="mt-0.5 text-gray-700">{r.debit}</div>
                    {r.cogDebit && <div className="mt-0.5 text-gray-500">＋ {r.cogDebit}（若有成本）</div>}
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <span className="font-semibold text-green-700">貸方（Cr）</span>
                    <div className="mt-0.5 text-gray-700">{r.credit}</div>
                    {r.cogCredit && <div className="mt-0.5 text-gray-500">＋ {r.cogCredit}（若有成本）</div>}
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
}: {
  title: string
  icon: React.ElementType
  items: PendingItem[]
  selected: Set<string>
  onToggle: (id: string) => void
  onPost: (id: string) => void
  posting: string | null
  fmt: (n: number) => string
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
            <th className="px-4 py-2 text-left">單號</th>
            <th className="px-4 py-2 text-left">往來對象</th>
            <th className="px-4 py-2 text-right">金額</th>
            <th className="px-4 py-2 text-left">狀態</th>
            <th className="px-4 py-2 text-center">日期</th>
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
                  <SkipForward size={11} />補建
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
