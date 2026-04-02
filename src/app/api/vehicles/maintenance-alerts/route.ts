import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/vehicles/maintenance-alerts
 * Returns vehicles with overdue or upcoming maintenance/expiry within 30 days
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000)

    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      select: {
        id: true,
        plateNo: true,
        vehicleType: true,
        insuranceExpiry: true,
        inspectionExpiry: true,
        licenseTaxExpiry: true,
        fuelTaxExpiry: true,
        tachoCalibrationDate: true,
        currentOdometer: true,
        maintenances: {
          where: { nextServiceDate: { lte: thirtyDaysLater } },
          orderBy: { nextServiceDate: 'asc' },
          take: 1,
          select: { type: true, title: true, nextServiceDate: true, nextServiceKm: true },
        },
      },
    })

    const alerts = vehicles.flatMap(v => {
      const vehicleAlerts: {
        vehicleId: string; plateNo: string; vehicleType: string | null
        alertType: string; message: string; severity: 'CRITICAL' | 'WARNING' | 'INFO'
        expiryDate: Date | null; daysRemaining: number | null
      }[] = []

      const checks: { field: Date | null; label: string }[] = [
        { field: v.insuranceExpiry,       label: '保險' },
        { field: v.inspectionExpiry,      label: '定期驗車' },
        { field: v.licenseTaxExpiry,      label: '牌照稅' },
        { field: v.fuelTaxExpiry,         label: '燃料稅' },
        { field: v.tachoCalibrationDate,  label: '行車紀錄器校正' },
      ]

      for (const { field, label } of checks) {
        if (!field) continue
        const daysRemaining = Math.ceil((new Date(field).getTime() - now.getTime()) / 86400000)
        if (daysRemaining <= 30) {
          vehicleAlerts.push({
            vehicleId: v.id,
            plateNo: v.plateNo,
            vehicleType: v.vehicleType,
            alertType: label,
            message: `${v.plateNo} ${label} ${daysRemaining <= 0 ? '已逾期' : `${daysRemaining} 天後到期`}`,
            severity: daysRemaining <= 0 ? 'CRITICAL' : daysRemaining <= 7 ? 'WARNING' : 'INFO',
            expiryDate: field,
            daysRemaining,
          })
        }
      }

      // Check upcoming maintenance
      for (const m of v.maintenances) {
        if (!m.nextServiceDate) continue
        const daysRemaining = Math.ceil((new Date(m.nextServiceDate).getTime() - now.getTime()) / 86400000)
        vehicleAlerts.push({
          vehicleId: v.id,
          plateNo: v.plateNo,
          vehicleType: v.vehicleType,
          alertType: m.type,
          message: `${v.plateNo} ${m.title} ${daysRemaining <= 0 ? '已逾期' : `${daysRemaining} 天後到期`}`,
          severity: daysRemaining <= 0 ? 'CRITICAL' : daysRemaining <= 7 ? 'WARNING' : 'INFO',
          expiryDate: m.nextServiceDate,
          daysRemaining,
        })
      }

      return vehicleAlerts
    })

    // Sort: CRITICAL first, then WARNING, then INFO, then by daysRemaining
    alerts.sort((a, b) => {
      const order = { CRITICAL: 0, WARNING: 1, INFO: 2 }
      if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity]
      return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0)
    })

    return NextResponse.json({
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'CRITICAL').length,
      warnings: alerts.filter(a => a.severity === 'WARNING').length,
      alerts,
    })
  } catch (error) {
    return handleApiError(error, 'vehicles.maintenanceAlerts')
  }
}
