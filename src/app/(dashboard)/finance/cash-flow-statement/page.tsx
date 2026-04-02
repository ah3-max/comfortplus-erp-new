'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface CashFlowData {
  year: number
  operating: { netIncome: number; arChange: number; apChange: number; total: number }
  investing: { assetAcquisitions: number; total: number }
  financing: { borrowings: number; repayments: number; total: number }
  netCashChange: number
  openingCash: number
  closingCash: number
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function AmountCell({ n }: { n: number }) {
  const cls = n > 0 ? 'text-green-600' : n < 0 ? 'text-red-600' : 'text-muted-foreground'
  return <span className={`font-mono font-medium ${cls}`}>{n > 0 ? '+' : n < 0 ? '-' : ''}${fmt(n)}</span>
}

function Section({ title, items, total, color }: {
  title: string
  items: { label: string; value: number; note?: string }[]
  total: number
  color: string
}) {
  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className={`px-4 py-3 font-semibold text-sm ${color}`}>{title}</div>
      <div className="divide-y">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-slate-700">{item.label}</span>
            {item.note && <span className="text-xs text-muted-foreground mr-2">{item.note}</span>}
            <AmountCell n={item.value} />
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 font-semibold text-sm">
          <span>小計</span>
          <AmountCell n={total} />
        </div>
      </div>
    </div>
  )
}

export default function CashFlowStatementPage() {
  const { dict } = useI18n()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<CashFlowData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/cash-flow-statement?year=${year}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { toast.error(dict.common.loadFailed) }
    finally { setLoading(false) }
  }, [year, dict])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-muted-foreground hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.nav.cashFlowStatement}</h1>
          <p className="text-sm text-muted-foreground">依 IAS 7 間接法編製</p>
        </div>
      </div>

      <div className="flex items-end gap-3 rounded-lg border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{dict.reportsExt.period}</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-md border px-3 py-2 text-sm">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.reportsExt.generate}
        </Button>
      </div>

      {data && (
        <div className="space-y-4">
          <Section
            title="一、營業活動現金流量"
            color="bg-blue-50 text-blue-800 border-b border-blue-100"
            items={[
              { label: '本期淨利潤', value: data.operating.netIncome },
              { label: '應收帳款增減', value: data.operating.arChange, note: '正值=AR減少=現金流入' },
              { label: '應付帳款增減', value: data.operating.apChange, note: '正值=AP增加=現金流入' },
            ]}
            total={data.operating.total}
          />

          <Section
            title="二、投資活動現金流量"
            color="bg-amber-50 text-amber-800 border-b border-amber-100"
            items={[
              { label: '購入固定資產', value: data.investing.assetAcquisitions },
            ]}
            total={data.investing.total}
          />

          <Section
            title="三、籌資活動現金流量"
            color="bg-purple-50 text-purple-800 border-b border-purple-100"
            items={[
              { label: '借款收入', value: data.financing.borrowings },
              { label: '還款支出', value: data.financing.repayments },
            ]}
            total={data.financing.total}
          />

          <div className="rounded-lg border bg-white divide-y">
            {[
              { label: '本期淨現金增減', value: data.netCashChange, bold: true },
              { label: '期初現金（估算）', value: data.openingCash, bold: false },
              { label: '期末現金（估算）', value: data.closingCash, bold: true },
            ].map(row => (
              <div key={row.label} className={`flex items-center justify-between px-4 py-3 text-sm ${row.bold ? 'bg-slate-50 font-semibold' : ''}`}>
                <span className="flex items-center gap-2">
                  {row.label}
                  {row.value > 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : row.value < 0 ? <TrendingDown className="h-4 w-4 text-red-500" /> : null}
                </span>
                <AmountCell n={row.value} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground">
          {dict.reportsExt.noData}
        </div>
      )}
    </div>
  )
}
