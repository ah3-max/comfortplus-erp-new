import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/sales-daily-report/summary
 * Manager view: today's report status for all sales reps
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get all sales reps
    const salesReps = await prisma.user.findMany({
      where: { role: { in: ['SALES', 'SALES_MANAGER'] }, isActive: true },
      select: { id: true, name: true, role: true },
    })

    // Get today's submitted reports
    const reports = await prisma.salesDailyReport.findMany({
      where: { reportDate: { gte: today, lt: tomorrow } },
      select: {
        salesRepId: true, status: true, visitCount: true, callCount: true,
        orderCount: true, orderAmount: true, submittedAt: true,
        highlights: true, tomorrowPlan: true,
      },
    })
    const reportMap = new Map(reports.map(r => [r.salesRepId, r]))

    const summary = salesReps.map(rep => ({
      rep,
      report: reportMap.get(rep.id) ?? null,
      submitted: reportMap.get(rep.id)?.status === 'SUBMITTED',
    }))

    return NextResponse.json({
      date: today,
      submittedCount: summary.filter(s => s.submitted).length,
      totalCount: summary.length,
      reps: summary,
    })
  } catch (e) {
    return handleApiError(e, 'salesDailyReport.summary')
  }
}
