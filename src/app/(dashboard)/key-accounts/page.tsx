'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Loader2, Star, AlertTriangle, CheckCircle2, TrendingUp, Users, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface KeyAccount {
  id: string
  name: string
  code: string
  type: string
  grade: string
  phone: string | null
  devStatus: string
  lastContactDate: string | null
  nextFollowUpDate: string | null
  visitFrequencyDays: number | null
  relationshipScore: number | null
  keyAccountNote: string | null
  keyAccountSince: string | null
  daysSinceContact: number | null
  isOverdueVisit: boolean
  salesRep: { id: string; name: string } | null
  keyAccountMgr: { id: string; name: string } | null
  _count: { followUpLogs: number; salesOrders: number }
}

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-amber-400 text-white',
  B: 'bg-blue-400 text-white',
  C: 'bg-green-500 text-white',
  D: 'bg-slate-400 text-white',
}

const RELATIONSHIP_LABEL = ['', '初識', '認識', '熟悉', '友好', '信任', '深度信任', '夥伴', '策略夥伴', '核心夥伴', '不可替代']

function KeyAccountCard({ account, router, onRefresh }: {
  account: KeyAccount
  router: ReturnType<typeof useRouter>
  onRefresh: () => void
}) {
  const [logging, setLogging] = useState(false)

  async function quickLog(reaction: string) {
    setLogging(true)
    const res = await fetch(`/api/customers/${account.id}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logType: 'CALL',
        content: '定期維護聯繫',
        customerReaction: reaction,
        logDate: new Date().toISOString(),
      }),
    })
    setLogging(false)
    if (res.ok) { toast.success('已記錄互動'); onRefresh() }
    else toast.error('記錄失敗')
  }

  const relScore = account.relationshipScore
  const relLabel = relScore ? (RELATIONSHIP_LABEL[relScore] ?? `${relScore}/10`) : null

  return (
    <Card className={`transition-shadow hover:shadow-md ${account.isOverdueVisit ? 'border-red-200 bg-red-50/30' : ''}`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <button
              onClick={() => router.push(`/customers/${account.id}`)}
              className="font-semibold text-sm text-left hover:text-blue-600 hover:underline truncate block"
            >
              {account.name}
            </button>
            <p className="text-xs text-muted-foreground font-mono">{account.code}</p>
          </div>
          <Badge className={`${GRADE_COLOR[account.grade] ?? 'bg-slate-200'} text-xs shrink-0`}>
            {account.grade}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2.5">
        {/* Contact status */}
        <div className="flex items-center gap-2 text-xs">
          {account.isOverdueVisit ? (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {account.daysSinceContact !== null ? `${account.daysSinceContact} 天未聯繫` : '從未聯繫'}
              {account.visitFrequencyDays && ` (目標 ${account.visitFrequencyDays} 天)`}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {account.daysSinceContact !== null ? `${account.daysSinceContact} 天前聯繫` : '正常'}
            </span>
          )}
        </div>

        {/* Relationship score */}
        {relScore && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-200 rounded-full h-1.5">
              <div
                className="bg-amber-400 h-1.5 rounded-full"
                style={{ width: `${relScore * 10}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-16 text-right">{relLabel}</span>
          </div>
        )}

        {/* Info row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{account.salesRep ? `業務：${account.salesRep.name}` : '未指定業務'}</span>
          <span>互動 {account._count.followUpLogs} 次</span>
        </div>

        {/* Key account note */}
        {account.keyAccountNote && (
          <p className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1 truncate">
            {account.keyAccountNote}
          </p>
        )}

        {/* Quick log buttons */}
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => router.push(`/customers/${account.id}`)}
            className="flex-1 rounded-md border text-xs py-1.5 hover:bg-slate-50 text-muted-foreground"
          >
            查看詳情
          </button>
          <button
            onClick={() => quickLog('POSITIVE')}
            disabled={logging}
            className="flex-1 rounded-md border border-green-200 bg-green-50 text-xs py-1.5 hover:bg-green-100 text-green-700"
          >
            {logging ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : '✓ 已聯繫'}
          </button>
          <button
            onClick={() => router.push(`/customers/${account.id}?tab=followup`)}
            className="rounded-md border border-blue-200 bg-blue-50 text-xs px-2 py-1.5 hover:bg-blue-100 text-blue-700"
          >
            記錄
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function KeyAccountsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<KeyAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/customers/key-accounts')
    if (res.ok) setAccounts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.code.toLowerCase().includes(search.toLowerCase())
  )

  const overdue = filtered.filter(a => a.isOverdueVisit)
  const onTrack = filtered.filter(a => !a.isOverdueVisit)

  // Stats
  const avgRelScore = accounts.length
    ? Math.round(accounts.reduce((s, a) => s + (a.relationshipScore ?? 0), 0) / accounts.length * 10) / 10
    : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-400 fill-amber-400" />
            心臟客戶管理
          </h1>
          <p className="text-sm text-muted-foreground">共 {accounts.length} 個心臟客戶</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => router.push('/customers?keyAccount=1')}>
            <Users className="mr-2 h-4 w-4" />
            客戶列表管理
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '心臟客戶總數', value: accounts.length, icon: Star, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: '逾期未拜訪', value: overdue.length, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
          { label: '正常維護中', value: onTrack.length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
          { label: '平均關係深度', value: avgRelScore > 0 ? `${avgRelScore}/10` : '—', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-3 flex items-center gap-3`}>
            <s.icon className={`h-5 w-5 ${s.color} shrink-0`} />
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="搜尋客戶名稱或代碼..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {/* Overdue section */}
          {overdue.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                逾期未拜訪 — 需立即行動 ({overdue.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {overdue.map(a => <KeyAccountCard key={a.id} account={a} router={router} onRefresh={load} />)}
              </div>
            </div>
          )}

          {/* On-track section */}
          {onTrack.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                正常維護中 ({onTrack.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {onTrack.map(a => <KeyAccountCard key={a.id} account={a} router={router} onRefresh={load} />)}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Star className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">尚無心臟客戶</p>
              <p className="text-xs mt-1">在客戶詳情頁開啟「心臟客戶設定」即可加入</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
