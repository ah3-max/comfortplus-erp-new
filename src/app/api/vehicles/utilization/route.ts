import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/vehicles/utilization
 * Vehicle utilization analysis based on DeliveryTrips
 * Returns trips count, estimated km, and load rate per vehicle
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const months = Math.min(6, Math.max(1, Number(searchParams.get('months') ?? 1)))

    const since = new Date()
    since.setMonth(since.getMonth() - months)

    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      select: {
        id: true,
        plateNo: true,
        vehicleType: true,
        maxWeight: true,
        trips: {
          where: {
            tripDate: { gte: since.toISOString().slice(0, 10) },
          },
          select: {
            id: true,
            tripDate: true,
            status: true,
            _count: { select: { shipments: true } },
          },
        },
      },
    })

    const totalDays = months * 30
    const workdays = Math.round(totalDays * 5 / 7) // estimate ~5/7 workdays

    const utilization = vehicles.map(v => {
      const completedTrips = v.trips.filter(t => t.status === 'COMPLETED')
      const tripCount = v.trips.length
      const shipmentCount = v.trips.reduce((s, t) => s + t._count.shipments, 0)
      const utilizationRate = workdays > 0 ? Math.round((tripCount / workdays) * 100) : 0

      return {
        vehicleId: v.id,
        plateNo: v.plateNo,
        vehicleType: v.vehicleType,
        maxWeightTons: v.maxWeight ? Number(v.maxWeight) : null,
        tripCount,
        completedTrips: completedTrips.length,
        cancelledTrips: v.trips.filter(t => t.status === 'CANCELLED').length,
        shipmentCount,
        avgShipmentsPerTrip: tripCount > 0 ? Math.round(shipmentCount / tripCount * 10) / 10 : 0,
        utilizationRate,
        utilizationLabel: utilizationRate >= 80 ? '高使用率' : utilizationRate >= 50 ? '中使用率' : '低使用率',
      }
    })

    // Sort by utilization desc
    utilization.sort((a, b) => b.utilizationRate - a.utilizationRate)

    return NextResponse.json({
      period: `${months} 個月`,
      workdays,
      totalTrips: utilization.reduce((s, v) => s + v.tripCount, 0),
      vehicles: utilization,
    })
  } catch (error) {
    return handleApiError(error, 'vehicles.utilization')
  }
}
