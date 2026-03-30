import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  const { searchParams } = new URL(req.url)

  const isManager = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(role)
  const dateStr = searchParams.get('date')
  const repId = searchParams.get('repId')

  const date = dateStr ? new Date(dateStr) : new Date()
  date.setHours(0, 0, 0, 0)
  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)

  try {
    const reports = await prisma.salesDailyReport.findMany({
      where: {
        reportDate: { gte: date, lt: nextDay },
        ...(isManager && repId ? { salesRepId: repId } : !isManager ? { salesRepId: session.user.id } : {}),
      },
      include: {
        salesRep: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(reports)
  } catch (e) {
    return handleApiError(e, 'salesDailyReport.get')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const data = {
      visitCount:       Number(body.visitCount ?? 0),
      callCount:        Number(body.callCount ?? 0),
      orderCount:       Number(body.orderCount ?? 0),
      orderAmount:      Number(body.orderAmount ?? 0),
      newCustomerCount: Number(body.newCustomerCount ?? 0),
      quoteCount:       Number(body.quoteCount ?? 0),
      highlights:       body.highlights ?? '',
      obstacles:        body.obstacles ?? '',
      tomorrowPlan:     body.tomorrowPlan ?? '',
      needsHelp:        body.needsHelp ?? '',
      status:           body.submit ? 'SUBMITTED' : 'DRAFT',
      submittedAt:      body.submit ? new Date() : null,
    }

    const report = await prisma.salesDailyReport.upsert({
      where: { salesRepId_reportDate: { salesRepId: session.user.id, reportDate: today } },
      create: { salesRepId: session.user.id, reportDate: today, ...data },
      update: data,
    })

    return NextResponse.json(report)
  } catch (e) {
    return handleApiError(e, 'salesDailyReport.post')
  }
}
