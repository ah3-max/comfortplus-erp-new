import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/notifications/stream
 * Server-Sent Events endpoint for real-time notifications
 * Polls for new unread notifications every 8 seconds and pushes to client
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let lastChecked = new Date()
      let closed = false

      req.signal.addEventListener('abort', () => {
        closed = true
        controller.close()
      })

      // Send initial ping
      const pingData = encoder.encode(`event: ping\ndata: connected\n\n`)
      controller.enqueue(pingData)

      // Poll loop
      while (!closed && !req.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 8000))
        if (closed || req.signal.aborted) break

        try {
          const newNotifs = await prisma.notification.findMany({
            where: {
              userId,
              createdAt: { gt: lastChecked },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              title: true,
              message: true,
              category: true,
              priority: true,
              linkUrl: true,
              isRead: true,
              createdAt: true,
            },
          })

          lastChecked = new Date()

          if (newNotifs.length > 0) {
            const payload = JSON.stringify({ notifications: newNotifs, count: newNotifs.length })
            const data = encoder.encode(`event: notification\ndata: ${payload}\n\n`)
            controller.enqueue(data)
          } else {
            // Heartbeat to keep connection alive
            controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`))
          }
        } catch {
          break
        }
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
