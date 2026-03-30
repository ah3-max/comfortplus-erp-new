import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const HR_ROLES = ['SUPER_ADMIN', 'GM']
  if (!HR_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const month = searchParams.get('month') // YYYY-MM

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (month) {
      const [year, mon] = month.split('-').map(Number)
      const startDate = new Date(year, mon - 1, 1)
      const endDate = new Date(year, mon, 1)
      where.date = { gte: startDate, lt: endDate }
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        user: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(records)
  } catch (error) {
    return handleApiError(error, 'hr.attendance')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const HR_ROLES = ['SUPER_ADMIN', 'GM']
  if (!HR_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

    const body = await req.json()
    const { userId, date, clockIn, clockOut, status, leaveType, overtime, notes } = body

    if (!userId || !date) {
      return NextResponse.json({ error: '請填寫必填欄位 (userId, date)' }, { status: 400 })
    }

    const dateObj = new Date(date)

    const record = await prisma.attendance.upsert({
      where: {
        userId_date: { userId, date: dateObj },
      },
      create: {
        userId,
        date: dateObj,
        clockIn: clockIn ? new Date(clockIn) : undefined,
        clockOut: clockOut ? new Date(clockOut) : undefined,
        status,
        leaveType,
        overtime,
        notes,
      },
      update: {
        clockIn: clockIn ? new Date(clockIn) : undefined,
        clockOut: clockOut ? new Date(clockOut) : undefined,
        status,
        leaveType,
        overtime,
        notes,
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'hr.attendance')
  }
}
