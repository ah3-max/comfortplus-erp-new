/**
 * credit.ts — 客戶信用額度佔用計算
 *
 * 信用佔用 = AR 未收餘額（已確認訂單轉出的應收）+ 尚在 PENDING 的訂單金額
 * 不直接用 SalesOrder 總和，因為 CONFIRMED 訂單會同時存在 AR 與 SalesOrder，
 * 會造成重複計算。
 */
import { prisma } from '@/lib/prisma'

export interface CreditUsage {
  /** AR outstanding (amount − paidAmount, only unpaid) */
  arOutstanding: number
  /** Committed via PENDING orders (no AR yet) */
  pendingCommitted: number
  /** Total credit used */
  total: number
}

/**
 * Compute the customer's current credit usage.
 * - excludeOrderId: skip a specific SalesOrder (used when updating an existing order so it doesn't self-count)
 */
export async function getCustomerCreditUsage(
  customerId: string,
  opts: { excludeOrderId?: string } = {}
): Promise<CreditUsage> {
  const [arAgg, pendingOrders] = await Promise.all([
    prisma.accountsReceivable.aggregate({
      where: { customerId, status: { in: ['NOT_DUE', 'DUE', 'PARTIAL_PAID'] } },
      _sum: { amount: true, paidAmount: true },
    }),
    prisma.salesOrder.findMany({
      where: {
        customerId,
        status: { in: ['PENDING'] }, // AR is only created on CONFIRMED; PENDING is committed but invisible to AR
        ...(opts.excludeOrderId ? { id: { not: opts.excludeOrderId } } : {}),
      },
      select: { totalAmount: true, paidAmount: true },
    }),
  ])

  const arOutstanding = Math.max(
    0,
    Number(arAgg._sum?.amount ?? 0) - Number(arAgg._sum?.paidAmount ?? 0)
  )
  const pendingCommitted = pendingOrders.reduce(
    (s, o) => s + Math.max(0, Number(o.totalAmount) - Number(o.paidAmount)), 0
  )

  return {
    arOutstanding,
    pendingCommitted,
    total: arOutstanding + pendingCommitted,
  }
}
