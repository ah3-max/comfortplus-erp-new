import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [inventoryAgg, todayShipments, allShipments, anomalies, inTransit] = await Promise.all([
    // 倉庫庫存總量 + 可用
    prisma.inventory.aggregate({
      _sum: { quantity: true, availableQty: true },
    }),
    // 今日出貨單數
    prisma.shipment.count({
      where: { shipDate: { gte: startOfToday } },
    }),
    // 近 30 天出貨（準時率/簽收率）
    prisma.shipment.findMany({
      where: { shipDate: { gte: new Date(now.getTime() - 30 * 86400000) } },
      select: {
        status: true, signStatus: true,
        expectedDeliveryDate: true, deliveryDate: true,
        anomalyStatus: true,
      },
    }),
    // 物流異常
    prisma.shipment.count({
      where: {
        anomalyStatus: { not: 'NORMAL' },
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
    }),
    // 在途庫存
    prisma.inventory.aggregate({
      where: { category: 'IN_TRANSIT' },
      _sum: { quantity: true },
    }),
  ])

  // 配送準時率
  const delivered = allShipments.filter(s => s.deliveryDate && s.expectedDeliveryDate)
  const onTime = delivered.filter(s => s.deliveryDate! <= s.expectedDeliveryDate!).length
  const deliveryOnTimeRate = delivered.length > 0 ? Math.round((onTime / delivered.length) * 100) : null

  // 簽收完成率
  const shipped = allShipments.filter(s => ['SHIPPED', 'DELIVERED'].includes(s.status))
  const signed = shipped.filter(s => s.signStatus === 'SIGNED').length
  const signRate = shipped.length > 0 ? Math.round((signed / shipped.length) * 100) : null

  return NextResponse.json({
    totalInventory: Number(inventoryAgg._sum.quantity ?? 0),
    availableInventory: Number(inventoryAgg._sum.availableQty ?? 0),
    inTransitInventory: Number(inTransit._sum.quantity ?? 0),
    todayShipments,
    deliveryOnTimeRate,
    signCompletionRate: signRate,
    logisticsAnomalyCount: anomalies,
  })
}
