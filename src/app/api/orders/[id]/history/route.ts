import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/orders/[id]/history
 * Returns audit log entries for a sales order
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'SalesOrder', entityId: id },
      orderBy: { timestamp: 'desc' },
      take: 100,
      select: {
        id: true,
        userName: true,
        userRole: true,
        timestamp: true,
        action: true,
        changes: true,
        reason: true,
      },
    })

    return NextResponse.json({ logs })
  } catch (error) {
    return handleApiError(error, 'orders.history.GET')
  }
}
