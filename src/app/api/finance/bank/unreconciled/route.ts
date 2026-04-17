import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/bank/unreconciled
 *
 * 待確認對帳清單：isReconciled = false 的 BankTransaction
 * Query: bankAccountId（必填）, startDate?, endDate?, page, pageSize
 *
 * 回傳：
 *   - transactions: 未對帳的銀行流水
 *   - suggestedMatches: 自動配對建議（金額+方向相符，日期差 ≤ 3 天）
 *   - summary: { unreconciledCount, totalDebit, totalCredit }
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const bankAccountId = searchParams.get('bankAccountId')
    const startDate     = searchParams.get('startDate')
    const endDate       = searchParams.get('endDate')
    const page          = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize      = Math.min(200, parseInt(searchParams.get('pageSize') ?? '50'))

    if (!bankAccountId) {
      return NextResponse.json({ error: '請提供 bankAccountId' }, { status: 400 })
    }

    const dateFilter = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate   && { lte: new Date(endDate) }),
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0

    const where = {
      bankAccountId,
      isReconciled: false,
      ...(hasDateFilter && { txDate: dateFilter }),
    }

    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        orderBy: { txDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.bankTransaction.count({ where }),
    ])

    // 同期間系統付款（供建議配對）
    let suggestedMatches: Array<{
      bankTxId: string
      paymentId: string
      paymentNo: string
      confidence: number
    }> = []

    if (transactions.length > 0) {
      const minDate = new Date(Math.min(...transactions.map(t => t.txDate.getTime())))
      const maxDate = new Date(Math.max(...transactions.map(t => t.txDate.getTime())))
      minDate.setDate(minDate.getDate() - 3)
      maxDate.setDate(maxDate.getDate() + 3)

      const payments = await prisma.paymentRecord.findMany({
        where: { paymentDate: { gte: minDate, lte: maxDate } },
        select: { id: true, paymentNo: true, amount: true, paymentDate: true, direction: true },
      })

      const usedBankTxIds  = new Set<string>()
      const usedPaymentIds = new Set<string>()

      for (const tx of transactions) {
        if (usedBankTxIds.has(tx.id)) continue
        const txAmount = Number(tx.amount)
        const txTime   = tx.txDate.getTime()

        for (const p of payments) {
          if (usedPaymentIds.has(p.id)) continue
          const amountMatch = Math.abs(Number(p.amount) - txAmount) < 0.01
          const dirMatch    = (tx.direction === 'CREDIT' && p.direction === 'INCOMING')
            || (tx.direction === 'DEBIT' && p.direction === 'OUTGOING')
          const daysDiff    = Math.abs(p.paymentDate.getTime() - txTime) / 86400000

          if (amountMatch && dirMatch && daysDiff <= 3) {
            const confidence = daysDiff === 0 ? 0.99 : daysDiff <= 1 ? 0.9 : 0.7
            suggestedMatches.push({ bankTxId: tx.id, paymentId: p.id, paymentNo: p.paymentNo, confidence })
            usedBankTxIds.add(tx.id)
            usedPaymentIds.add(p.id)
            break
          }
        }
      }
    }

    // 彙總
    const totalDebit  = transactions.filter(t => t.direction === 'DEBIT').reduce((s, t) => s + Number(t.amount), 0)
    const totalCredit = transactions.filter(t => t.direction === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0)

    return NextResponse.json({
      data: transactions,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      suggestedMatches,
      summary: {
        unreconciledCount: total,
        totalDebit:  Math.round(totalDebit  * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
      },
    })
  } catch (error) {
    return handleApiError(error, 'bank.unreconciled')
  }
}
