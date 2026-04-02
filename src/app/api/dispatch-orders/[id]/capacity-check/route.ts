import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/dispatch-orders/[id]/capacity-check?vehicleId=xxx
 * Check vehicle capacity against total dispatch weight/volume
 * vehicleId is optional; without it, only returns item totals
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const vehicleId = new URL(req.url).searchParams.get('vehicleId')

    const dispatch = await prisma.dispatchOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { name: true, weight: true } },
          },
        },
      },
    })

    if (!dispatch) return NextResponse.json({ error: '找不到派車單' }, { status: 404 })

    // Calculate total weight from product weights (kg)
    const totalWeightKg = dispatch.items.reduce((sum, item) => {
      const weightKg = Number((item.product as { weight?: number | null })?.weight ?? 0)
      return sum + weightKg * Number(item.quantity)
    }, 0)

    // Fetch vehicle if provided
    let vehicle: { plateNo: string; vehicleType: string | null; maxWeight: number | null; maxVolume: number | null } | null = null
    if (vehicleId) {
      const v = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { plateNo: true, vehicleType: true, maxWeight: true, maxVolume: true },
      })
      if (v) {
        vehicle = {
          plateNo: v.plateNo,
          vehicleType: v.vehicleType,
          maxWeight: v.maxWeight ? Number(v.maxWeight) * 1000 : null, // tons → kg
          maxVolume: v.maxVolume ? Number(v.maxVolume) : null,
        }
      }
    }

    const maxWeightKg = vehicle?.maxWeight ?? null
    const weightPct = maxWeightKg && maxWeightKg > 0 ? Math.round((totalWeightKg / maxWeightKg) * 100) : null
    const isOverweight = maxWeightKg !== null && totalWeightKg > maxWeightKg

    const warnings: string[] = []
    if (isOverweight) warnings.push(`超重：總重量 ${totalWeightKg.toFixed(1)} kg 超過載重上限 ${maxWeightKg} kg`)
    else if (weightPct !== null && weightPct >= 90) warnings.push(`接近載重上限 (${weightPct}%)`)
    if (!vehicleId) warnings.push('未指定車輛，無法檢查載重限制')

    return NextResponse.json({
      vehicleId: vehicleId ?? null,
      vehicle,
      totalWeightKg: Math.round(totalWeightKg * 10) / 10,
      maxWeightKg,
      weightPct,
      isOverweight,
      isOk: !isOverweight,
      warnings,
    })
  } catch (error) {
    return handleApiError(error, 'dispatch.capacityCheck')
  }
}
