import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/sea-freight/detention-alerts
 * Returns sea freight shipments at risk of detention/demurrage fees
 * Logic: if actualArrival is set and containerPickupDate is not, calculate days since arrival
 * Free period defaults to 5 days for port storage, 14 days for container detention
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()

    // Find shipments that have arrived but containers not yet picked up
    const shipments = await prisma.seaFreight.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'CANCELLED'] as never[] },
        actualArrival: { not: null },
        containerPickupDate: null,
      },
      select: {
        id: true,
        freightNo: true,
        containerNo: true,
        containerType: true,
        actualArrival: true,
        eta: true,
        customsStatus: true,
        customsReleasedDate: true,
        portOfDischarge: true,
        demurrageFee: true,
        detentionFee: true,
      },
      orderBy: { actualArrival: 'asc' },
    })

    const FREE_DAYS_PORT      = 5   // days before port storage fee
    const FREE_DAYS_DETENTION = 14  // days before container detention fee

    const alerts = shipments.map(s => {
      const arrivalDate = new Date(s.actualArrival!)
      const daysAtPort = Math.floor((now.getTime() - arrivalDate.getTime()) / 86400000)

      const portStorageDaysOver     = Math.max(0, daysAtPort - FREE_DAYS_PORT)
      const containerDetentionOver  = Math.max(0, daysAtPort - FREE_DAYS_DETENTION)

      const severity =
        daysAtPort > FREE_DAYS_DETENTION ? 'CRITICAL' :
        daysAtPort > FREE_DAYS_PORT      ? 'WARNING'  : 'INFO'

      const issues: string[] = []
      if (portStorageDaysOver > 0)    issues.push(`港口倉租已超免費期 ${portStorageDaysOver} 天`)
      if (containerDetentionOver > 0) issues.push(`貨櫃拖延費已超免費期 ${containerDetentionOver} 天`)
      if (s.customsStatus === 'NOT_STARTED') issues.push('尚未開始報關')
      if (s.customsStatus === 'SUBMITTED')   issues.push('報關待審核中')

      return {
        id: s.id,
        freightNo: s.freightNo,
        containerNo: s.containerNo,
        containerType: s.containerType,
        portOfDischarge: s.portOfDischarge,
        actualArrival: s.actualArrival,
        daysAtPort,
        portStorageDaysOver,
        containerDetentionOver,
        customsStatus: s.customsStatus,
        severity,
        issues,
        existingFees: {
          demurrage: s.demurrageFee ? Number(s.demurrageFee) : null,
          detention: s.detentionFee ? Number(s.detentionFee) : null,
        },
      }
    })

    const critical = alerts.filter(a => a.severity === 'CRITICAL')
    const warnings = alerts.filter(a => a.severity === 'WARNING')

    return NextResponse.json({
      total: alerts.length,
      critical: critical.length,
      warnings: warnings.length,
      alerts: alerts.sort((a, b) => b.daysAtPort - a.daysAtPort),
    })
  } catch (error) {
    return handleApiError(error, 'seaFreight.detentionAlerts')
  }
}
