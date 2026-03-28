import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mobile: true,
        title: true,
        hireDate: true,
        departmentId: true,
        employeeProfile: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    return handleApiError(error, 'hr.employees')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { userId, ...profileData } = body

    if (!userId) {
      return NextResponse.json({ error: '請提供 userId' }, { status: 400 })
    }

    const profile = await prisma.employeeProfile.upsert({
      where: { userId },
      create: { userId, ...profileData },
      update: profileData,
    })

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'hr.employees')
  }
}
