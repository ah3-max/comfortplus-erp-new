import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { receiptScope, buildScopeContext } from '@/lib/scope'
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

  const scope = receiptScope(buildScopeContext(session as { user: { id: string; role: string } }))

  const where = {
    ...scope,
    ...(search && {
      OR: [
        { receiptNumber: { contains: search, mode: 'insensitive' as const } },
        { factory: { name: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
    ...(status && { status: status as never }),
  }

  const [receipts, total] = await Promise.all([
    prisma.productionReceipt.findMany({
      where,
      include: {
        factory: { select: { id: true, name: true, code: true } },
        receivingWarehouse: { select: { id: true, name: true, code: true } },
        handler: { select: { id: true, name: true } },
        productionOrder: { select: { id: true, productionNo: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { sku: true, name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.productionReceipt.count({ where }),
  ])

  return NextResponse.json({
    data: receipts,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.factoryId || !body.items?.length) {
      return NextResponse.json({ error: '請選擇工廠並至少新增一項品項' }, { status: 400 })
    }

    if (!body.receivingWarehouseId) {
      return NextResponse.json({ error: '請選擇收貨倉庫' }, { status: 400 })
    }

    // Validate factory exists
    const factory = await prisma.supplier.findUnique({
      where: { id: body.factoryId },
      select: { id: true, name: true },
    })
    if (!factory) {
      return NextResponse.json({ error: '工廠不存在' }, { status: 400 })
    }

    const receiptNumber = await generateSequenceNo('PRODUCTION_RECEIPT')

    const items = body.items.map((item: {
      productId: string; productName?: string; specification?: string
      quantity: number; bomVersion?: string; manufacturedItemId?: string
      resourceInput?: string; productionTime?: number; unit?: string; memo?: string
    }) => ({
      productId: item.productId,
      productName: item.productName || '',
      specification: item.specification || null,
      quantity: Number(item.quantity),
      bomVersion: item.bomVersion || null,
      manufacturedItemId: item.manufacturedItemId || null,
      resourceInput: item.resourceInput || null,
      productionTime: item.productionTime ? Number(item.productionTime) : null,
      unit: item.unit || null,
      memo: item.memo || null,
    }))

    const receipt = await prisma.productionReceipt.create({
      data: {
        receiptNumber,
        date: body.date ? new Date(body.date) : new Date(),
        factoryId: body.factoryId,
        receivingWarehouseId: body.receivingWarehouseId,
        handlerId: body.handlerId || session.user.id,
        productionOrderId: body.productionOrderId || null,
        status: 'DRAFT',
        notes: body.notes || null,
        createdById: session.user.id,
        items: { create: items },
      },
      include: {
        factory: { select: { name: true } },
        items: true,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'production-receipts',
      action: 'CREATE',
      entityType: 'ProductionReceipt',
      entityId: receipt.id,
      entityLabel: receiptNumber,
    }).catch(() => {})

    return NextResponse.json(receipt, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'production-receipts.POST')
  }
}
