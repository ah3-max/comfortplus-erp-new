import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * POST /api/finance/bank/reconcile
 *
 * 自動比對銀行流水與系統付款紀錄：
 *   金額相符（誤差 < 0.01）+ 方向一致 + 日期差 ≤ 1 天 → isReconciled = true
 *
 * Body: { bankAccountId, startDate?, endDate? }
 *
 * 也可手動指定配對：
 * Body: { matches: [{ bankTransactionId, paymentRecordId? }] }
 *   → 直接標記為已對帳（paymentRecordId 可為 null，表示手動確認無對應付款）
 *
 * 回傳：{ autoMatched, manualMatched, total }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!FINANCE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()

    // ── 手動配對模式 ───────────────────────────────────────────
    if (Array.isArray(body.matches)) {
      const matches = body.matches as Array<{
        bankTransactionId: string
        paymentRecordId?: string | null
      }>
      if (matches.length === 0) {
        return NextResponse.json({ error: '請提供至少一筆配對' }, { status: 400 })
      }

      const now = new Date()
      let manualMatched = 0
      for (const m of matches) {
        await prisma.bankTransaction.update({
          where: { id: m.bankTransactionId },
          data: {
            isReconciled:    true,
            reconciledAt:    now,
            paymentRecordId: m.paymentRecordId ?? null,
          },
        })
        manualMatched++
      }

      logAudit({
        userId: session.user.id, userName: session.user.name ?? '', userRole: role,
        module: 'bank', action: 'MANUAL_RECONCILE', entityType: 'BankTransaction',
        entityId: matches[0].bankTransactionId,
        entityLabel: `手動對帳 ${manualMatched} 筆`,
      }).catch(() => {})

      return NextResponse.json({ autoMatched: 0, manualMatched, total: manualMatched })
    }

    // ── 自動比對模式 ───────────────────────────────────────────
    const { bankAccountId, startDate, endDate } = body
    if (!bankAccountId) {
      return NextResponse.json({ error: '請提供 bankAccountId 或 matches 陣列' }, { status: 400 })
    }

    const dateFilter = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate   && { lte: new Date(endDate) }),
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0

    // 未對帳的銀行流水
    const unreconciledTxs = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId,
        isReconciled: false,
        ...(hasDateFilter && { txDate: dateFilter }),
      },
      orderBy: { txDate: 'asc' },
    })

    if (unreconciledTxs.length === 0) {
      return NextResponse.json({ autoMatched: 0, manualMatched: 0, total: 0 })
    }

    // 同期間系統付款（未關聯銀行交易）
    const minDate = new Date(Math.min(...unreconciledTxs.map(t => t.txDate.getTime())))
    const maxDate = new Date(Math.max(...unreconciledTxs.map(t => t.txDate.getTime())))
    minDate.setDate(minDate.getDate() - 1)
    maxDate.setDate(maxDate.getDate() + 1)

    const payments = await prisma.paymentRecord.findMany({
      where: { paymentDate: { gte: minDate, lte: maxDate } },
      select: { id: true, amount: true, paymentDate: true, direction: true },
    })

    const usedPaymentIds = new Set<string>()
    const now = new Date()
    let autoMatched = 0

    for (const tx of unreconciledTxs) {
      const txAmount = Number(tx.amount)
      const txTime   = tx.txDate.getTime()

      const matched = payments.find(p => {
        if (usedPaymentIds.has(p.id)) return false
        const amountMatch = Math.abs(Number(p.amount) - txAmount) < 0.01
        const dirMatch    = (tx.direction === 'CREDIT' && p.direction === 'INCOMING')
          || (tx.direction === 'DEBIT' && p.direction === 'OUTGOING')
        const daysDiff    = Math.abs(p.paymentDate.getTime() - txTime) / 86400000
        return amountMatch && dirMatch && daysDiff <= 1
      })

      if (!matched) continue

      usedPaymentIds.add(matched.id)
      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          isReconciled:    true,
          reconciledAt:    now,
          paymentRecordId: matched.id,
        },
      })
      autoMatched++
    }

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'bank', action: 'AUTO_RECONCILE', entityType: 'BankAccount',
      entityId: bankAccountId,
      entityLabel: `自動對帳 ${autoMatched}/${unreconciledTxs.length} 筆`,
    }).catch(() => {})

    return NextResponse.json({
      autoMatched,
      manualMatched: 0,
      total: unreconciledTxs.length,
      pending: unreconciledTxs.length - autoMatched,
    })
  } catch (error) {
    return handleApiError(error, 'bank.reconcile')
  }
}
