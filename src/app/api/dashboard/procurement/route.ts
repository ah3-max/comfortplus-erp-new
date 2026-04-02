import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [monthPurchases, inTransitFreight, productionOrders, qcChecks, lowMaterials] = await Promise.all([
    // 本月採購金額
    prisma.purchaseOrder.aggregate({
      where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // 在途批次
    prisma.seaFreight.count({
      where: { status: { in: ['IN_TRANSIT', 'LOADED', 'BOOKED'] } },
    }),
    // 工廠準時率 + 良率
    prisma.productionOrder.findMany({
      where: { status: 'COMPLETED', updatedAt: { gte: new Date(now.getFullYear(), now.getMonth() - 3, 1) } },
      select: { productionStartDate: true, productionEndDate: true, shipmentDate: true, defectRate: true, passedQty: true, orderQty: true },
    }),
    // QC 異常
    prisma.qualityCheck.findMany({
      where: { createdAt: { gte: startOfMonth } },
      select: { result: true },
    }),
    // 包材缺料
    prisma.packagingMaterial.findMany({
      where: { safetyStock: { gt: 0 } },
    }),
  ])

  // 準時率
  const completedWithDates = productionOrders.filter(p => p.productionStartDate && p.productionEndDate)
  const onTimeCount = completedWithDates.filter(p => {
    return p.shipmentDate != null // 有出廠日 = 按時完成
  }).length
  const onTimeRate = completedWithDates.length > 0 ? Math.round((onTimeCount / completedWithDates.length) * 100) : null

  // 良率/不良率
  const totalOrdered = productionOrders.reduce((s, p) => s + p.orderQty, 0)
  const totalPassed = productionOrders.reduce((s, p) => s + (p.passedQty ?? 0), 0)
  const passRate = totalOrdered > 0 ? Math.round((totalPassed / totalOrdered) * 1000) / 10 : null
  const avgDefect = productionOrders.length > 0
    ? Math.round(productionOrders.reduce((s, p) => s + Number(p.defectRate ?? 0), 0) / productionOrders.length * 10) / 10 : null

  // QC 不良件數
  const qcFailed = qcChecks.filter(q => q.result && !['ACCEPTED'].includes(q.result)).length

  // 包材缺料
  const materialShortage = lowMaterials.filter(m => m.stockQty <= m.safetyStock).length

  // 到港延誤
  const freightDelayed = await prisma.seaFreight.count({
    where: { eta: { lt: now }, actualArrival: null, status: { notIn: ['RECEIVED', 'CANCELLED'] } },
  })

  return NextResponse.json({
    monthPurchaseAmount: Number(monthPurchases._sum.totalAmount ?? 0),
    monthPurchaseCount: monthPurchases._count.id,
    inTransitBatches: inTransitFreight,
    factoryOnTimeRate: onTimeRate,
    passRate,
    avgDefectRate: avgDefect,
    qcAnomalyCount: qcFailed,
    materialShortageCount: materialShortage,
    freightDelayCount: freightDelayed,
  })
  } catch (error) {
    return handleApiError(error, 'dashboard.procurement.GET')
  }
}
