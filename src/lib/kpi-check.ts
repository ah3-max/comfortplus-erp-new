/**
 * KPI Milestone Check
 *
 * 在訂單建立、拜訪記錄、客戶新增等動作後自動檢查：
 *   - 是否達到 50% / 80% / 100% 里程碑
 *   - 達標時自動通知主管和業務本人
 *
 * 使用方式：
 *   import { checkKpiMilestone } from '@/lib/kpi-check'
 *   await checkKpiMilestone(userId)  // 在建單成功後呼叫
 */

import { prisma } from '@/lib/prisma'
import { notify, notifyManagers } from '@/lib/notify'

const MILESTONES = [100, 80, 50] // 從高到低檢查

export async function checkKpiMilestone(userId: string): Promise<{
  milestone: number | null
  achieveRate: number
  remaining: number
} | null> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  // Get target
  const target = await prisma.salesTarget.findUnique({
    where: { userId_targetMonth: { userId, targetMonth: startOfMonth } },
    include: { user: { select: { name: true } } },
  })

  if (!target) return null

  const revenueTarget = Number(target.revenueTarget)
  if (revenueTarget <= 0) return null

  // Get current actual
  const revenueAgg = await prisma.salesOrder.aggregate({
    where: { createdById: userId, createdAt: { gte: startOfMonth, lte: endOfMonth }, status: { not: 'CANCELLED' } },
    _sum: { totalAmount: true },
  })
  const revenueActual = Number(revenueAgg._sum.totalAmount ?? 0)
  const achieveRate = Math.round((revenueActual / revenueTarget) * 1000) / 10
  const remaining = Math.max(0, revenueTarget - revenueActual)

  // Check milestones — find the highest milestone just crossed
  const previousActual = Number(target.revenueActual ?? 0)
  const previousRate = revenueTarget > 0 ? (previousActual / revenueTarget) * 100 : 0

  let hitMilestone: number | null = null
  for (const ms of MILESTONES) {
    if (achieveRate >= ms && previousRate < ms) {
      hitMilestone = ms
      break
    }
  }

  // Update the snapshot
  await prisma.salesTarget.update({
    where: { id: target.id },
    data: {
      revenueActual: revenueActual,
      achieveRate: achieveRate,
    },
  })

  // Send notifications if milestone hit
  if (hitMilestone) {
    const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

    const emoji = hitMilestone >= 100 ? '🎉' : hitMilestone >= 80 ? '🔥' : '💪'
    const title = hitMilestone >= 100
      ? `${emoji} ${target.user.name} 達標！本月營收目標 100% 達成`
      : `${emoji} ${target.user.name} 達成 ${hitMilestone}% 目標`
    const message = `營收：${fmt(revenueActual)} / ${fmt(revenueTarget)}（${achieveRate}%）`

    // Notify the sales rep
    await notify({
      userIds: [userId],
      title,
      message: hitMilestone >= 100
        ? `恭喜！你已達成本月營收目標 🎯\n${message}`
        : `你已達成 ${hitMilestone}% 的月目標，繼續加油！\n${message}\n距離達標還差 ${fmt(remaining)}`,
      linkUrl: '/kpi',
      category: 'KPI',
      priority: hitMilestone >= 100 ? 'HIGH' : 'NORMAL',
    })

    // Notify managers
    await notifyManagers({
      line: true,
      title,
      message,
      linkUrl: '/kpi',
      category: 'KPI',
    })
  }

  return { milestone: hitMilestone, achieveRate, remaining }
}
