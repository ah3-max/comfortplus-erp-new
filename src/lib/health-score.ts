import { prisma } from '@/lib/prisma'

/**
 * 計算客戶健康分數（0-100）
 *
 * 扣分規則：
 * - 回購間隔：31-60天 -5、61-90天 -10、91-180天 -20、181-365天 -30、365+天/從未 -40
 * - 逾期應收款：1筆 -5、2筆 -10、≥3筆或高額逾期 -20
 * - 互動頻率：60-120天無聯繫 -5、120+天 -10
 * - 開放客訴：每筆 -5（最多 -20）
 * - 黑名單：強制 0
 *
 * 健康等級：80-100 GREEN、60-79 YELLOW、40-59 ORANGE、0-39 RED
 */
export async function calculateHealthScore(customerId: string): Promise<{
  score: number
  level: string
  breakdown: Record<string, number>
}> {
  const now = new Date()
  const dayMs = 86_400_000

  const [customer, lastOrder, overdueARs, interactions, openComplaints] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { isBlacklist: true, isSupplyStopped: true, lastOrderDate: true },
    }),
    prisma.salesOrder.findFirst({
      where: { customerId, status: { not: 'CANCELLED' as never } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.accountsReceivable.findMany({
      where: {
        customerId,
        status: { in: ['OVERDUE', 'BAD_DEBT'] as never[] },
      },
      select: { amount: true, paidAmount: true },
    }),
    prisma.visitRecord.findFirst({
      where: { customerId },
      orderBy: { visitDate: 'desc' },
      select: { visitDate: true },
    }),
    prisma.complaintRecord.findMany({
      where: { customerId, status: { in: ['OPEN', 'PROCESSING'] as never[] } },
      select: { id: true },
    }),
  ])

  if (!customer) throw new Error('Customer not found')

  // Blacklist → force 0
  if (customer.isBlacklist) {
    return { score: 0, level: 'RED', breakdown: { blacklist: -100 } }
  }

  const breakdown: Record<string, number> = {}
  let score = 100

  // 1. Order recency
  const lastOrderAt = lastOrder?.createdAt ?? customer.lastOrderDate
  if (!lastOrderAt) {
    breakdown.orderRecency = -40
  } else {
    const daysSince = Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / dayMs)
    if      (daysSince > 365) breakdown.orderRecency = -40
    else if (daysSince > 180) breakdown.orderRecency = -30
    else if (daysSince > 90)  breakdown.orderRecency = -20
    else if (daysSince > 60)  breakdown.orderRecency = -10
    else if (daysSince > 30)  breakdown.orderRecency = -5
    else                      breakdown.orderRecency = 0
  }

  // 2. Overdue AR
  const overdueCount = overdueARs.length
  if      (overdueCount >= 3) breakdown.overdueAR = -20
  else if (overdueCount === 2) breakdown.overdueAR = -10
  else if (overdueCount === 1) breakdown.overdueAR = -5
  else                         breakdown.overdueAR = 0

  // 3. Interaction recency (last visit)
  if (!interactions?.visitDate) {
    breakdown.interaction = -10
  } else {
    const daysSince = Math.floor((now.getTime() - new Date(interactions.visitDate).getTime()) / dayMs)
    if      (daysSince > 120) breakdown.interaction = -10
    else if (daysSince > 60)  breakdown.interaction = -5
    else                      breakdown.interaction = 0
  }

  // 4. Open complaints (max -20)
  const complaintDeduction = Math.min(openComplaints.length * 5, 20)
  if (complaintDeduction > 0) breakdown.complaints = -complaintDeduction

  // 5. Supply stopped
  if (customer.isSupplyStopped) breakdown.supplyStopped = -10

  // Apply deductions
  for (const v of Object.values(breakdown)) {
    score += v
  }
  score = Math.max(0, Math.min(100, score))

  const level =
    score >= 80 ? 'GREEN' :
    score >= 60 ? 'YELLOW' :
    score >= 40 ? 'ORANGE' : 'RED'

  return { score, level, breakdown }
}

export async function updateCustomerHealthScore(customerId: string) {
  const { score, level } = await calculateHealthScore(customerId)
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      healthScore: score,
      healthLevel: level,
      healthUpdatedAt: new Date(),
    },
  })
  return { score, level }
}
