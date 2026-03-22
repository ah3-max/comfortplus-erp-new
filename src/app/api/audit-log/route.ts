import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/audit-log - Query audit logs (admin/manager only)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check role
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!['SUPER_ADMIN', 'GM'].includes(user?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const module = searchParams.get('module')
  const action = searchParams.get('action')
  const userId = searchParams.get('userId')
  const entityType = searchParams.get('entityType')
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const where: any = {}
  if (module) where.module = module
  if (action) where.action = action
  if (userId) where.userId = userId
  if (entityType) where.entityType = entityType
  if (dateFrom || dateTo) {
    where.timestamp = {}
    if (dateFrom) where.timestamp.gte = new Date(dateFrom)
    if (dateTo) where.timestamp.lte = new Date(dateTo + 'T23:59:59')
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: { user: { select: { name: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, limit, offset })
}
