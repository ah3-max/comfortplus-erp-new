import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { notify } from '@/lib/notify'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/notify/customer
 * Unified customer notification: order confirmation / shipment / delivery / overdue
 * Body: {
 *   customerId: string,
 *   type: 'ORDER_CONFIRMED' | 'SHIPMENT_DISPATCHED' | 'DELIVERED' | 'PAYMENT_OVERDUE',
 *   referenceId: string,       // orderId / shipmentId
 *   referenceNo: string,       // human-readable order/shipment no
 *   message?: string           // custom message override
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      customerId: string
      type: string
      referenceId: string
      referenceNo: string
      message?: string
    }

    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId },
      select: { id: true, name: true, email: true, lineId: true },
    })
    if (!customer) return NextResponse.json({ error: '客戶不存在' }, { status: 404 })

    // Find customer's sales rep for in-app notification
    const salesRep = await prisma.customer.findUnique({
      where: { id: body.customerId },
      select: { salesRepId: true },
    })

    const notifyTemplates: Record<string, { title: string; message: string; category: string }> = {
      ORDER_CONFIRMED: {
        title: `訂單確認：${body.referenceNo}`,
        message: body.message ?? `您的訂單 ${body.referenceNo} 已確認，我們將盡快安排出貨`,
        category: 'ORDER_CONFIRMED',
      },
      SHIPMENT_DISPATCHED: {
        title: `出貨通知：${body.referenceNo}`,
        message: body.message ?? `您的訂單已出貨，單號 ${body.referenceNo}，預計近日送達，請注意接收`,
        category: 'SHIPMENT_DISPATCHED',
      },
      DELIVERED: {
        title: `送達確認：${body.referenceNo}`,
        message: body.message ?? `您的訂單 ${body.referenceNo} 已送達，如有任何問題請聯繫我們`,
        category: 'DELIVERY_CONFIRMED',
      },
      PAYMENT_OVERDUE: {
        title: `付款提醒：${body.referenceNo}`,
        message: body.message ?? `訂單 ${body.referenceNo} 付款逾期，請盡速處理，謝謝`,
        category: 'PAYMENT_OVERDUE',
      },
    }

    const template = notifyTemplates[body.type]
    if (!template) return NextResponse.json({ error: '不支援的通知類型' }, { status: 400 })

    // Notify sales rep via in-app
    const targetUserIds = [session.user.id]
    if (salesRep?.salesRepId) targetUserIds.push(salesRep.salesRepId)

    await notify({
      userIds: targetUserIds,
      title: template.title,
      message: `[客戶通知] ${customer.name} — ${template.message}`,
      linkUrl: `/customers/${customer.id}`,
      category: template.category as never,
      priority: body.type === 'PAYMENT_OVERDUE' ? 'HIGH' : 'NORMAL',
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'notify',
      action: 'CUSTOMER_NOTIFY',
      entityType: 'Customer',
      entityId: body.customerId,
      entityLabel: customer.name,
      changes: {
        type: { before: null, after: body.type },
        referenceNo: { before: null, after: body.referenceNo },
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      customerName: customer.name,
      type: body.type,
      message: `通知已發送給 ${customer.name}`,
    })
  } catch (error) {
    return handleApiError(error, 'notify.customer')
  }
}
