import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/finance/fiscal-periods/year-end-close
 *
 * 年結：將指定年度的損益科目（REVENUE / EXPENSE）餘額結轉至保留盈餘科目
 *
 * 流程：
 * 1. 驗證年度所有月結期間都已 CLOSED
 * 2. 查詢所有 REVENUE/EXPENSE 科目的期末餘額
 * 3. 建立結帳傳票（沖銷損益科目 → 轉入保留盈餘）
 * 4. 自動過帳（status=POSTED）
 *
 * Body: { year: number, retainedEarningsAccountId: string, notes?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { year, retainedEarningsAccountId, notes } = body as {
      year: number; retainedEarningsAccountId: string; notes?: string
    }

    if (!year || !retainedEarningsAccountId) {
      return NextResponse.json({ error: '請指定年度與保留盈餘科目' }, { status: 400 })
    }

    // 1. 確認保留盈餘科目存在
    const reAccount = await prisma.accountingAccount.findUnique({ where: { id: retainedEarningsAccountId } })
    if (!reAccount || reAccount.type !== 'EQUITY') {
      return NextResponse.json({ error: '保留盈餘科目不存在或類型非「權益」' }, { status: 400 })
    }

    // 2. 確認該年度所有月結期間已結帳
    const openPeriods = await prisma.fiscalPeriod.findMany({
      where: { year, periodType: 'MONTHLY', status: { in: ['OPEN', 'CLOSING'] } },
    })
    if (openPeriods.length > 0) {
      const codes = openPeriods.map(p => p.periodCode).join(', ')
      return NextResponse.json({
        error: `以下期間尚未結帳：${codes}，請先完成月結再執行年結`,
      }, { status: 422 })
    }

    // 3. 計算所有 REVENUE/EXPENSE 科目的年度餘額
    const yearStart = new Date(year, 0, 1)
    const yearEnd   = new Date(year + 1, 0, 1)

    const balances = await prisma.$queryRaw<Array<{
      accountId: string; code: string; name: string; type: string; normalBalance: string
      totalDebit: number; totalCredit: number
    }>>`
      SELECT
        a.id AS "accountId", a.code, a.name, a.type, a."normalBalance",
        COALESCE(SUM(l.debit), 0)::float AS "totalDebit",
        COALESCE(SUM(l.credit), 0)::float AS "totalCredit"
      FROM "AccountingAccount" a
      JOIN "JournalEntryLine" l ON l."accountId" = a.id
      JOIN "JournalEntry" e ON e.id = l."entryId"
      WHERE a.type IN ('REVENUE', 'EXPENSE')
        AND e.status = 'POSTED'
        AND e."entryDate" >= ${yearStart}
        AND e."entryDate" < ${yearEnd}
      GROUP BY a.id, a.code, a.name, a.type, a."normalBalance"
      HAVING COALESCE(SUM(l.debit), 0) != 0 OR COALESCE(SUM(l.credit), 0) != 0
      ORDER BY a.code
    `

    if (balances.length === 0) {
      return NextResponse.json({ error: '該年度無損益科目餘額，無需年結' }, { status: 422 })
    }

    // 4. 建立結帳傳票
    const lines: { accountId: string; debit: number; credit: number; description: string }[] = []
    let totalRetainedEarnings = 0

    for (const b of balances) {
      const balance = b.totalDebit - b.totalCredit
      if (Math.abs(balance) < 0.01) continue

      if (b.type === 'REVENUE') {
        // REVENUE 正常餘額在貸方，結帳時借方沖銷
        lines.push({
          accountId: b.accountId,
          debit: b.totalCredit - b.totalDebit > 0 ? b.totalCredit - b.totalDebit : 0,
          credit: b.totalDebit - b.totalCredit > 0 ? b.totalDebit - b.totalCredit : 0,
          description: `年結 ${year}：沖銷 ${b.code} ${b.name}`,
        })
        totalRetainedEarnings += (b.totalCredit - b.totalDebit) // 收入增加保留盈餘
      } else {
        // EXPENSE 正常餘額在借方，結帳時貸方沖銷
        lines.push({
          accountId: b.accountId,
          debit: b.totalCredit - b.totalDebit > 0 ? b.totalCredit - b.totalDebit : 0,
          credit: b.totalDebit - b.totalCredit > 0 ? b.totalDebit - b.totalCredit : 0,
          description: `年結 ${year}：沖銷 ${b.code} ${b.name}`,
        })
        totalRetainedEarnings -= (b.totalDebit - b.totalCredit) // 費用減少保留盈餘
      }
    }

    // 保留盈餘行（差額）
    if (totalRetainedEarnings > 0) {
      lines.push({
        accountId: retainedEarningsAccountId,
        debit: 0, credit: totalRetainedEarnings,
        description: `年結 ${year}：本期淨利轉入保留盈餘`,
      })
    } else if (totalRetainedEarnings < 0) {
      lines.push({
        accountId: retainedEarningsAccountId,
        debit: Math.abs(totalRetainedEarnings), credit: 0,
        description: `年結 ${year}：本期淨損轉入保留盈餘`,
      })
    }

    // 驗證借貸平衡
    const totalDebit  = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({ error: '年結傳票借貸不平衡，請聯繫管理員' }, { status: 500 })
    }

    const entryNo = await generateSequenceNo('JOURNAL_ENTRY')

    const closingEntry = await prisma.journalEntry.create({
      data: {
        entryNo,
        entryDate: new Date(year, 11, 31), // 12/31
        description: `${year} 年度結帳 — 損益結轉保留盈餘`,
        status: 'POSTED',
        entryType: 'CLOSING',
        totalDebit,
        totalCredit,
        postedAt: new Date(),
        postedById: session.user.id,
        createdById: session.user.id,
        notes: notes ?? null,
        lines: {
          create: lines.map((l, idx) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
            lineNo: idx + 1,
          })),
        },
      },
      include: { lines: { include: { account: { select: { code: true, name: true } } } } },
    })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'fiscal-periods', action: 'YEAR_END_CLOSE', entityType: 'JournalEntry',
      entityId: closingEntry.id, entityLabel: `${year} 年結 ${entryNo}`,
    }).catch(() => {})

    return NextResponse.json({
      message: `${year} 年結完成`,
      closingEntry,
      summary: {
        accountsClosed: balances.length,
        netIncome: totalRetainedEarnings,
        entryNo,
      },
    })
  } catch (error) {
    return handleApiError(error, 'fiscal-periods.year-end-close')
  }
}
