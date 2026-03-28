import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { requisitionScope, buildScopeContext } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

  const scope = requisitionScope(buildScopeContext(session as { user: { id: string; role: string } }))

  const where = {
    ...scope,
    ...(search && {
      OR: [
        { requisitionNumber: { contains: search, mode: 'insensitive' as const } },
        { productionOrder: { productionNo: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
    ...(status && { status: status as never }),
  }

  const [requisitions, total] = await Promise.all([
    prisma.materialRequisition.findMany({
      where,
      include: {
        productionOrder: { select: { id: true, productionNo: true } },
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        handler: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { sku: true, name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.materialRequisition.count({ where }),
  ])

  return NextResponse.json({
    data: requisitions,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.productionOrderId || !body.items?.length) {
      return NextResponse.json({ error: '請選擇生產工單並至少新增一項物料' }, { status: 400 })
    }

    if (!body.fromWarehouseId || !body.toWarehouseId) {
      return NextResponse.json({ error: '請選擇出料倉庫及收料倉庫' }, { status: 400 })
    }

    // Validate production order exists
    const productionOrder = await prisma.productionOrder.findUnique({
      where: { id: body.productionOrderId },
      select: { id: true, productionNo: true },
    })
    if (!productionOrder) {
      return NextResponse.json({ error: '生產工單不存在' }, { status: 400 })
    }

    const requisitionNumber = await generateSequenceNo('MATERIAL_REQUISITION')

    const items = body.items.map((item: {
      productId: string; productName?: string; specification?: string
      quantity: number; bomVersion?: string; unit?: string; serialNumber?: string; memo?: string
    }) => ({
      productId: item.productId,
      productName: item.productName || '',
      specification: item.specification || null,
      quantity: Number(item.quantity),
      bomVersion: item.bomVersion || null,
      unit: item.unit || null,
      serialNumber: item.serialNumber || null,
      memo: item.memo || null,
    }))

    const requisition = await prisma.materialRequisition.create({
      data: {
        requisitionNumber,
        date: body.date ? new Date(body.date) : new Date(),
        productionOrderId: body.productionOrderId,
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        handlerId: body.handlerId || session.user.id,
        status: 'DRAFT',
        notes: body.notes || null,
        createdById: session.user.id,
        items: { create: items },
      },
      include: {
        productionOrder: { select: { productionNo: true } },
        items: true,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'material-requisitions',
      action: 'CREATE',
      entityType: 'MaterialRequisition',
      entityId: requisition.id,
      entityLabel: requisitionNumber,
    }).catch(() => {})

    return NextResponse.json(requisition, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'material-requisitions.POST')
  }
}
