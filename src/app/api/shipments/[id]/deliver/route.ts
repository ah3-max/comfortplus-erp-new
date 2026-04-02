import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { handleApiError } from '@/lib/api-error'
import { buildScopeContext, isOwnDataOnly } from '@/lib/scope'

/**
 * POST /api/shipments/[id]/deliver
 * 送達確認 — 上傳送達照片 + 簽收 → 通知業務/主管/助理
 *
 * Body:
 *   { photos: [{url, note}], signatureUrl?, recipientName?, notes? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as {
      photos: { url: string; note?: string }[]
      signatureUrl?: string
      recipientName?: string
      notes?: string
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: { select: { name: true, code: true } },
            createdBy: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    })

    if (!shipment) return NextResponse.json({ error: '找不到出貨單' }, { status: 404 })

    // 5-1: scope check — SALES/CS can only confirm delivery for their own orders
    const ctx = buildScopeContext(session as { user: { id: string; role: string } })
    if (isOwnDataOnly(ctx.role) && shipment.order.createdBy?.id !== ctx.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update shipment status
    await prisma.shipment.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        deliveryDate: new Date(),
        signStatus: body.signatureUrl ? 'SIGNED' : 'PENDING',
      },
    })

    // Check if all shipments for the order are DELIVERED → update order to SIGNED
    if (shipment.orderId) {
      const allShipments = await prisma.shipment.findMany({
        where: { orderId: shipment.orderId },
        select: { id: true, status: true },
      })
      const allDelivered = allShipments.every(s => s.id === id || s.status === 'DELIVERED')
      if (allDelivered) {
        await prisma.salesOrder.update({
          where: { id: shipment.orderId },
          data: { status: 'SIGNED' },
        })
      }
    }

    // Create ProofOfDelivery record (supports multiple photos)
    for (const photo of body.photos) {
      await prisma.proofOfDelivery.create({
        data: {
          shipmentId: id,
          signerName: body.recipientName || null,
          signedAt: new Date(),
          photoUrl: photo.url,
          anomalyNote: photo.note || null,
          deliveredAt: new Date(),
        },
      })
    }

    // If signature photo exists, create a separate POD record
    if (body.signatureUrl) {
      await prisma.proofOfDelivery.create({
        data: {
          shipmentId: id,
          signerName: body.recipientName || null,
          signedAt: new Date(),
          photoUrl: body.signatureUrl,
          anomalyNote: '簽收單',
          deliveredAt: new Date(),
          isCompleted: true,
        },
      })
    }

    // ── Notify stakeholders (in-app + LINE if configured) ──
    const notifyUserIds: string[] = []
    if (shipment.order.createdBy?.id) notifyUserIds.push(shipment.order.createdBy.id)
    if (shipment.createdBy?.id && shipment.createdBy.id !== shipment.order.createdBy?.id) {
      notifyUserIds.push(shipment.createdBy.id)
    }
    const managers = await prisma.user.findMany({
      where: { role: { in: ['SALES_MANAGER', 'GM'] }, isActive: true },
      select: { id: true },
    })
    managers.forEach(m => { if (!notifyUserIds.includes(m.id)) notifyUserIds.push(m.id) })

    const photoUrl = body.photos[0]?.url
    await notify({
      userIds: notifyUserIds,
      line: true,
      title: `📦 ${shipment.shipmentNo} 已送達`,
      message: [
        `客戶：${shipment.order.customer.name}`,
        body.recipientName ? `簽收人：${body.recipientName}` : '',
        `照片：${body.photos.length} 張`,
        body.notes ? `備註：${body.notes}` : '',
      ].filter(Boolean).join('\n'),
      linkUrl: `/shipments/${id}`,
      category: 'SHIPMENT',
      imageUrl: photoUrl,
    })

    return NextResponse.json({
      ok: true,
      shipmentNo: shipment.shipmentNo,
      customer: shipment.order.customer.name,
      notifiedCount: notifyUserIds.length,
    })
  } catch (error) {
    return handleApiError(error, 'shipments.deliver')
  }
}
