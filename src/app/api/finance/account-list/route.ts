import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') ?? 'all'
    const includeBalance = searchParams.get('includeBalance') === 'true'

    const where = type !== 'all'
      ? { isActive: true, type }
      : { isActive: true }

    const accounts = await prisma.accountingAccount.findMany({
      where,
      orderBy: { code: 'asc' },
    })

    interface AccountWithBalance {
      id: string; code: string; name: string; type: string; subType: string | null
      normalBalance: string; parentCode: string | null; level: number
      debitTotal?: number; creditTotal?: number; balance?: number
    }

    let result: AccountWithBalance[] = accounts.map(a => ({
      id: a.id, code: a.code, name: a.name, type: a.type,
      subType: a.subType, normalBalance: a.normalBalance,
      parentCode: a.parentCode, level: a.level,
    }))

    if (includeBalance) {
      const balanceData = await prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: { entry: { status: 'POSTED' } },
        _sum: { debit: true, credit: true },
      })
      const balanceMap: Record<string, { debit: number; credit: number }> = {}
      for (const b of balanceData) {
        balanceMap[b.accountId] = {
          debit: Number(b._sum.debit ?? 0),
          credit: Number(b._sum.credit ?? 0),
        }
      }
      result = result.map(a => {
        const b = balanceMap[a.id] ?? { debit: 0, credit: 0 }
        const balance = a.normalBalance === 'DEBIT'
          ? b.debit - b.credit
          : b.credit - b.debit
        return {
          ...a,
          debitTotal: Math.round(b.debit * 100) / 100,
          creditTotal: Math.round(b.credit * 100) / 100,
          balance: Math.round(balance * 100) / 100,
        }
      })
    }

    const byType: Record<string, number> = {}
    for (const a of accounts) {
      byType[a.type] = (byType[a.type] ?? 0) + 1
    }

    return NextResponse.json({
      summary: { total: accounts.length, byType },
      accounts: result,
    })
  } catch (error) {
    return handleApiError(error, 'finance.account-list.GET')
  }
}
