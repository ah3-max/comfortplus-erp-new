import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/orders/[id]/activity
 * 聚合訂單活動紀錄（AuditLog + 出貨單 + 付款）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true, orderNo: true, createdAt: true,
        createdBy: { select: { name: true } },
        shipments: {
          select: {
            id: true, shipmentNo: true, status: true, createdAt: true,
            createdBy: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Fetch audit logs for this order
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'SalesOrder', entityId: id },
      orderBy: { timestamp: 'desc' },
      take: 100,
    })

    const actionLabels: Record<string, string> = {
      create: '建立訂單',
      update: '更新訂單',
      confirm: '確認訂單',
      cancel: '取消訂單',
      complete: '完成訂單',
      payment: '登錄付款',
      status_change: '狀態變更',
    }

    const events: {
      id: string; timestamp: string; type: 'audit' | 'shipment' | 'payment'
      actor: string; title: string; detail?: string
    }[] = []

    // Order creation event
    events.push({
      id: `create-${order.id}`,
      timestamp: order.createdAt.toISOString(),
      type: 'audit',
      actor: order.createdBy.name,
      title: '建立訂單',
      detail: order.orderNo,
    })

    // Audit log events (skip duplicates of creation)
    for (const log of auditLogs) {
      const action = log.action
      if (action === 'create') continue // Already added above
      const title = actionLabels[action] ?? `操作：${action}`
      let detail: string | undefined
      if (log.changes && typeof log.changes === 'object') {
        const changes = log.changes as Record<string, { from?: unknown; to?: unknown }>
        const parts: string[] = []
        if (changes.status) parts.push(`狀態：${changes.status.from ?? '—'} → ${changes.status.to}`)
        if (changes.paidAmount) parts.push(`已收款：${Number(changes.paidAmount.to).toLocaleString()}`)
        if (parts.length) detail = parts.join('、')
      }
      events.push({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        type: action === 'payment' ? 'payment' : 'audit',
        actor: log.userName,
        title,
        detail,
      })
    }

    // Shipment events
    for (const s of order.shipments) {
      events.push({
        id: `ship-${s.id}`,
        timestamp: s.createdAt.toISOString(),
        type: 'shipment',
        actor: s.createdBy.name,
        title: `建立出貨單 ${s.shipmentNo}`,
        detail: `狀態：${s.status}`,
      })
    }

    // Sort descending by time
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json(events)
  } catch (e) {
    return handleApiError(e, 'orders.activity.get')
  }
}
