import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { generateSequenceNo } from '@/lib/sequence'

const MANAGER_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'CS']
const FIELD_ROLES   = ['SALES', 'CARE_SUPERVISOR']
const ALL_ROLES     = [...MANAGER_ROLES, ...FIELD_ROLES]

// ── GET /api/institution-tours?date=YYYY-MM-DD&userId=&status= ───────────────
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role?: string }
  if (!ALL_ROLES.includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    const statusParam = searchParams.get('status')
    const userIdParam = searchParams.get('userId')

    const date = dateParam ? new Date(dateParam) : new Date()
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dateEnd   = new Date(dateStart.getTime() + 86400000)

    // 外勤人員只能看自己的
    const isManager = MANAGER_ROLES.includes(user.role ?? '')
    const targetUserId = isManager
      ? (userIdParam ?? undefined)
      : user.id

    const where: Record<string, unknown> = {
      tourDate: { gte: dateStart, lt: dateEnd },
    }
    if (targetUserId) where.assignedUserId = targetUserId
    if (statusParam && statusParam !== 'ALL') where.status = statusParam

    const tours = await prisma.institutionTour.findMany({
      where,
      include: {
        assignedUser: { select: { id: true, name: true, role: true, avatar: true } },
        customer:     { select: { id: true, name: true, type: true, region: true, address: true } },
        createdBy:    { select: { id: true, name: true } },
      },
      orderBy: [{ plannedStartTime: 'asc' }, { createdAt: 'asc' }],
    })

    // 供新增表單用：取可指派的人員清單
    const fieldUsers = isManager
      ? await prisma.user.findMany({
          where: { role: { in: FIELD_ROLES as never[] }, isActive: true },
          select: { id: true, name: true, role: true },
          orderBy: { name: 'asc' },
        })
      : []

    return NextResponse.json({ data: tours, fieldUsers, date: dateStart.toISOString() })
  } catch (error) {
    return handleApiError(error, 'institution-tours.get')
  }
}

// ── POST /api/institution-tours ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role?: string }
  if (!ALL_ROLES.includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json() as {
      assignedUserId?: string
      customerId: string
      tourDate: string
      plannedStartTime?: string
      reminderMinutes?: number
      tourType?: string
      purpose?: string
    }

    if (!body.customerId || !body.tourDate) {
      return NextResponse.json({ error: '客戶與日期為必填' }, { status: 400 })
    }

    // 外勤人員只能為自己排程
    const assignedUserId = MANAGER_ROLES.includes(user.role ?? '')
      ? (body.assignedUserId ?? user.id)
      : user.id

    const tourDate = new Date(body.tourDate)
    const dateOnly = new Date(tourDate.getFullYear(), tourDate.getMonth(), tourDate.getDate())

    const tourNo = await generateSequenceNo('INSTITUTION_TOUR')

    const tour = await prisma.institutionTour.create({
      data: {
        tourNo,
        assignedUserId,
        customerId:       body.customerId,
        tourDate:         dateOnly,
        plannedStartTime: body.plannedStartTime,
        reminderMinutes:  body.reminderMinutes ?? 30,
        tourType:         body.tourType ?? 'ROUTINE_VISIT',
        purpose:          body.purpose,
        status:           'SCHEDULED',
        createdById:      user.id,
      },
      include: {
        assignedUser: { select: { id: true, name: true, role: true } },
        customer:     { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: tour }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'institution-tours.post')
  }
}
