import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    const where = userId ? { userId } : {}

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        user: { select: { name: true } },
      },
      orderBy: { effectiveDate: 'desc' },
    })

    return NextResponse.json(appointments)
  } catch (error) {
    return handleApiError(error, 'hr.appointments')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { userId, effectiveDate, type, ...rest } = body

    if (!userId || !effectiveDate || !type) {
      return NextResponse.json({ error: '請填寫必填欄位 (userId, effectiveDate, type)' }, { status: 400 })
    }

    const appointment = await prisma.appointment.create({
      data: {
        userId,
        effectiveDate: new Date(effectiveDate),
        type,
        ...rest,
      },
      include: {
        user: { select: { name: true } },
      },
    })

    return NextResponse.json(appointment, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'hr.appointments')
  }
}
