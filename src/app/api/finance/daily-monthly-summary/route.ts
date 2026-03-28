import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// 日/月合計表：按日或月 GROUP BY JournalEntry（POSTED），顯示借貸合計
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') || 'MONTHLY' // DAILY / MONTHLY
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const entries = await prisma.journalEntry.findMany({
      where: {
        status: 'POSTED',
        entryDate: { gte: periodStart, lte: periodEnd },
      },
      select: {
        entryDate: true, totalDebit: true, totalCredit: true, entryType: true,
      },
      orderBy: { entryDate: 'asc' },
    })

    // Group by day or month
    const bucketMap = new Map<string, { label: string; debit: number; credit: number; count: number }>()

    for (const e of entries) {
      const d = new Date(e.entryDate)
      const key = mode === 'DAILY'
        ? d.toISOString().slice(0, 10)
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      const label = mode === 'DAILY'
        ? d.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
        : `${d.getFullYear()}年${d.getMonth() + 1}月`

      if (!bucketMap.has(key)) {
        bucketMap.set(key, { label, debit: 0, credit: 0, count: 0 })
      }
      const bucket = bucketMap.get(key)!
      bucket.debit += Number(e.totalDebit)
      bucket.credit += Number(e.totalCredit)
      bucket.count++
    }

    const rows = Array.from(bucketMap.entries()).map(([key, v]) => ({
      key,
      label: v.label,
      debit: Math.round(v.debit * 100) / 100,
      credit: Math.round(v.credit * 100) / 100,
      count: v.count,
      net: Math.round((v.debit - v.credit) * 100) / 100,
    }))

    const totals = {
      debit: Math.round(rows.reduce((s, r) => s + r.debit, 0) * 100) / 100,
      credit: Math.round(rows.reduce((s, r) => s + r.credit, 0) * 100) / 100,
      count: rows.reduce((s, r) => s + r.count, 0),
    }

    return NextResponse.json({
      mode, rows, totals,
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
    })
  } catch (error) {
    return handleApiError(error, 'finance.daily-monthly-summary.GET')
  }
}
