import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const record = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, code: true } },
        order: { select: { id: true, orderNo: true } },
        items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
      },
    })
    if (!record) return NextResponse.json({ error: '找不到退貨單' }, { status: 404 })
    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'sales-returns.[id].GET')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const { status, reason, disposalMethod, responsibility, refundAmount, refundStatus,
      approvedAt, receivedDate, warehouseId, notes } = body

    const record = await prisma.returnOrder.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(reason !== undefined && { reason }),
        ...(disposalMethod !== undefined && { disposalMethod }),
        ...(responsibility !== undefined && { responsibility }),
        ...(refundAmount !== undefined && { refundAmount: refundAmount ? Number(refundAmount) : null }),
        ...(refundStatus !== undefined && { refundStatus }),
        ...(approvedAt !== undefined && { approvedAt: approvedAt ? new Date(approvedAt) : null }),
        ...(approvedAt !== undefined && { approvedById: session.user.id }),
        ...(receivedDate !== undefined && { receivedDate: receivedDate ? new Date(receivedDate) : null }),
        ...(warehouseId !== undefined && { warehouseId }),
        ...(notes !== undefined && { notes }),
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'sales-returns',
      action: 'UPDATE',
      entityType: 'ReturnOrder',
      entityId: id,
      entityLabel: record.returnNo,
    }).catch(() => {})

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'sales-returns.[id].PUT')
  }
}
