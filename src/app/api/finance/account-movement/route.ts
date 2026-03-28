import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// 科目增減紀錄：顯示各科目期初餘額、本期增加、本期減少、期末餘額
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type') || undefined // ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const accounts = await prisma.accountingAccount.findMany({
      where: { isActive: true, ...(type && { type }) },
      orderBy: { code: 'asc' },
    })

    const results = await Promise.all(accounts.map(async acc => {
      const [openAgg, periodAgg] = await Promise.all([
        prisma.journalEntryLine.aggregate({
          where: { accountId: acc.id, entry: { status: 'POSTED', entryDate: { lt: periodStart } } },
          _sum: { debit: true, credit: true },
        }),
        prisma.journalEntryLine.aggregate({
          where: { accountId: acc.id, entry: { status: 'POSTED', entryDate: { gte: periodStart, lte: periodEnd } } },
          _sum: { debit: true, credit: true },
        }),
      ])

      const openD = Number(openAgg._sum.debit ?? 0)
      const openC = Number(openAgg._sum.credit ?? 0)
      const perD = Number(periodAgg._sum.debit ?? 0)
      const perC = Number(periodAgg._sum.credit ?? 0)

      const isDebitNormal = acc.normalBalance === 'DEBIT'
      const openingBalance = isDebitNormal ? openD - openC : openC - openD
      // increase = movement in the normal direction
      const increase = isDebitNormal ? perD : perC
      // decrease = movement opposite to normal direction
      const decrease = isDebitNormal ? perC : perD
      const closingBalance = openingBalance + increase - decrease

      return {
        id: acc.id, code: acc.code, name: acc.name, type: acc.type, normalBalance: acc.normalBalance,
        openingBalance: Math.round(openingBalance * 100) / 100,
        increase: Math.round(increase * 100) / 100,
        decrease: Math.round(decrease * 100) / 100,
        closingBalance: Math.round(closingBalance * 100) / 100,
        netChange: Math.round((closingBalance - openingBalance) * 100) / 100,
      }
    }))

    // Filter out accounts with zero activity
    const active = results.filter(r =>
      r.openingBalance !== 0 || r.increase !== 0 || r.decrease !== 0 || r.closingBalance !== 0
    )

    return NextResponse.json({
      rows: active,
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      totalCount: active.length,
    })
  } catch (error) {
    return handleApiError(error, 'finance.account-movement.GET')
  }
}
