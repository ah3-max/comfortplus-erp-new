import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/notifications - Get current user's notifications
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const category = searchParams.get('category')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  const where: any = { userId: session.user.id, isDismissed: false }
  if (unreadOnly) where.isRead = false
  if (category) where.category = category

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false, isDismissed: false },
    }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

// POST /api/notifications - Mark as read / dismiss / mark all read
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, notificationIds } = body as { action: 'READ' | 'DISMISS' | 'READ_ALL'; notificationIds?: string[] }

  if (action === 'READ_ALL') {
    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return NextResponse.json({ updated: result.count })
  }

  if (action === 'READ' && notificationIds?.length) {
    const result = await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, userId: session.user.id },
      data: { isRead: true, readAt: new Date() },
    })
    return NextResponse.json({ updated: result.count })
  }

  if (action === 'DISMISS' && notificationIds?.length) {
    const result = await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, userId: session.user.id },
      data: { isDismissed: true },
    })
    return NextResponse.json({ updated: result.count })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
