import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const record = await prisma.afterSalesOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, code: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      processingLogs: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      consumptions: {
        include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(record)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const current = await prisma.afterSalesOrder.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Add processing log
    if (body.action === 'ADD_LOG') {
      if (!body.content) return NextResponse.json({ error: '請填寫處理內容' }, { status: 400 })
      const log = await prisma.afterSalesLog.create({
        data: {
          orderId: id,
          logType: body.logType || 'NOTE',
          content: body.content,
          createdById: session.user.id,
        },
        include: { createdBy: { select: { id: true, name: true } } },
      })
      return NextResponse.json(log, { status: 201 })
    }

    // Add consumption item
    if (body.action === 'ADD_CONSUMPTION') {
      const { productId, quantity, unitCost } = body
      if (!productId || !quantity) return NextResponse.json({ error: '請填寫品項及數量' }, { status: 400 })
      const totalCost = unitCost ? Number(unitCost) * Number(quantity) : null
      const item = await prisma.afterSalesConsumption.create({
        data: {
          orderId: id,
          productId,
          quantity,
          unitCost: unitCost ?? null,
          totalCost,
          notes: body.notes || null,
        },
        include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
      })
      // Recalculate total cost
      const all = await prisma.afterSalesConsumption.findMany({ where: { orderId: id } })
      const total = all.reduce((s, c) => s + Number(c.totalCost ?? 0), 0)
      await prisma.afterSalesOrder.update({ where: { id }, data: { totalCost: total } })
      return NextResponse.json(item, { status: 201 })
    }

    // Update status or fields
    const updated = await prisma.afterSalesOrder.update({
      where: { id },
      data: {
        source: body.source ?? undefined,
        status: body.status ?? undefined,
        priority: body.priority ?? undefined,
        description: body.description ?? undefined,
        notes: body.notes !== undefined ? (body.notes || null) : undefined,
        assignedToId: body.assignedToId ?? undefined,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        completedAt: body.status === 'COMPLETED' ? new Date() : undefined,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'after-sales.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const current = await prisma.afterSalesOrder.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (current.status !== 'OPEN') {
      return NextResponse.json({ error: '只能刪除待處理狀態的服務單' }, { status: 400 })
    }

    // Delete related records first (cascade)
    await prisma.$transaction([
      prisma.afterSalesLog.deleteMany({ where: { orderId: id } }),
      prisma.afterSalesConsumption.deleteMany({ where: { orderId: id } }),
      prisma.afterSalesOrder.delete({ where: { id } }),
    ])
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'after-sales.DELETE')
  }
}
