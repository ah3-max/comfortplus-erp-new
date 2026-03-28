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
    const record = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        purchase: { select: { id: true, poNo: true } },
        items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
      },
    })
    if (!record) return NextResponse.json({ error: '找不到退貨單' }, { status: 404 })
    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'purchase-returns.[id].GET')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const { status, reason, debitNoteNo, deductAmount, deductStatus,
      approvedAt, shippedDate, notes } = body

    const record = await prisma.purchaseReturn.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(reason !== undefined && { reason }),
        ...(debitNoteNo !== undefined && { debitNoteNo }),
        ...(deductAmount !== undefined && { deductAmount: deductAmount ? Number(deductAmount) : null }),
        ...(deductStatus !== undefined && { deductStatus }),
        ...(approvedAt !== undefined && { approvedAt: approvedAt ? new Date(approvedAt) : null }),
        ...(approvedAt !== undefined && { approvedById: session.user.id }),
        ...(shippedDate !== undefined && { shippedDate: shippedDate ? new Date(shippedDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'purchase-returns',
      action: 'UPDATE',
      entityType: 'PurchaseReturn',
      entityId: id,
      entityLabel: record.returnNo,
    }).catch(() => {})

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'purchase-returns.[id].PUT')
  }
}
