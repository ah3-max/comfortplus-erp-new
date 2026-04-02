import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/bank-reconciliation?bankAccountId=&startDate=&endDate=
 *
 * 取得銀行對帳資料：
 *  - bankTransactions: 未對帳的銀行流水
 *  - systemPayments: 同期間的系統收付款紀錄
 *  - suggestedMatches: 自動配對建議（金額相同 + 日期相近）
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
    const startDate = searchParams.get('startDate')
    const endDate   = searchParams.get('endDate')

    if (!bankAccountId) {
      return NextResponse.json({ error: '請指定銀行帳戶' }, { status: 400 })
    }

    const dateFilter = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate   && { lte: new Date(endDate) }),
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0

    // 未對帳的銀行流水
    const bankTxs = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId,
        isReconciled: false,
        ...(hasDateFilter && { txDate: dateFilter }),
      },
      orderBy: { txDate: 'asc' },
    })

    // 同期間系統收付款（尚未關聯銀行交易）
    const payments = await prisma.paymentRecord.findMany({
      where: {
        ...(hasDateFilter && { paymentDate: dateFilter }),
      },
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { paymentDate: 'asc' },
    })

    // 找已被 match 的 paymentRecordIds
    const matchedPaymentIds = new Set(
      bankTxs.filter(t => t.paymentRecordId).map(t => t.paymentRecordId!)
    )
    const unmatchedPayments = payments.filter(p => !matchedPaymentIds.has(p.id))

    // 自動配對建議：金額相同 + 日期在 ±3 天內
    const suggestedMatches: Array<{ bankTxId: string; paymentId: string; confidence: number }> = []
    const usedBankTxs = new Set<string>()
    const usedPayments = new Set<string>()

    for (const tx of bankTxs) {
      if (usedBankTxs.has(tx.id)) continue
      const txAmount = Number(tx.amount)
      const txDate   = tx.txDate.getTime()

      for (const pay of unmatchedPayments) {
        if (usedPayments.has(pay.id)) continue
        const payAmount = Number(pay.amount)
        const payDate   = pay.paymentDate.getTime()
        const daysDiff  = Math.abs(txDate - payDate) / 86400000

        // 金額完全相符 + 方向一致
        const dirMatch = (tx.direction === 'CREDIT' && pay.direction === 'INCOMING')
          || (tx.direction === 'DEBIT' && pay.direction === 'OUTGOING')

        if (Math.abs(txAmount - payAmount) < 0.01 && dirMatch && daysDiff <= 3) {
          const confidence = daysDiff === 0 ? 0.99 : daysDiff <= 1 ? 0.9 : 0.7
          suggestedMatches.push({ bankTxId: tx.id, paymentId: pay.id, confidence })
          usedBankTxs.add(tx.id)
          usedPayments.add(pay.id)
          break
        }
      }
    }

    // 帳戶資訊
    const account = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { id: true, accountName: true, bankName: true, accountNo: true, currentBalance: true },
    })

    return NextResponse.json({
      account,
      bankTransactions: bankTxs,
      systemPayments: unmatchedPayments,
      suggestedMatches,
      summary: {
        unreconciledCount: bankTxs.length,
        unmatchedPaymentCount: unmatchedPayments.length,
        suggestedCount: suggestedMatches.length,
      },
    })
  } catch (error) {
    return handleApiError(error, 'bank-reconciliation.GET')
  }
}

/**
 * POST /api/finance/bank-reconciliation
 *
 * 確認對帳配對：
 * Body: { matches: [{ bankTransactionId, paymentRecordId }] }
 *
 * 將銀行交易標記為已對帳，並關聯付款紀錄
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { matches } = body as {
      matches: Array<{ bankTransactionId: string; paymentRecordId?: string }>
    }

    if (!matches?.length) {
      return NextResponse.json({ error: '請提供至少一筆配對' }, { status: 400 })
    }

    let reconciled = 0
    const now = new Date()

    for (const m of matches) {
      await prisma.bankTransaction.update({
        where: { id: m.bankTransactionId },
        data: {
          isReconciled: true,
          reconciledAt: now,
          paymentRecordId: m.paymentRecordId ?? null,
        },
      })
      reconciled++
    }

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'bank-reconciliation', action: 'RECONCILE',
      entityType: 'BankTransaction', entityId: matches[0].bankTransactionId,
      entityLabel: `批量對帳 ${reconciled} 筆`,
    }).catch(() => {})

    return NextResponse.json({ reconciled })
  } catch (error) {
    return handleApiError(error, 'bank-reconciliation.POST')
  }
}
