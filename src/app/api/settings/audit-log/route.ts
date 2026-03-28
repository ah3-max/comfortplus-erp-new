import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'GM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))
    const module   = searchParams.get('module') ?? ''
    const userId   = searchParams.get('userId') ?? ''
    const action   = searchParams.get('action') ?? ''

    const where: Record<string, unknown> = {}
    if (module) where.module = module
    if (userId) where.userId = userId
    if (action) where.action = action

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (e) {
    return handleApiError(e, 'settings.auditLog')
  }
}
