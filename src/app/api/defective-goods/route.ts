import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const source = searchParams.get('source') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

    const where = {
      ...(search && {
        OR: [
          { defectNo: { contains: search, mode: 'insensitive' as const } },
          { product: { name: { contains: search, mode: 'insensitive' as const } } },
          { batchNo: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status }),
      ...(source && { source }),
    }

    const [total, data] = await Promise.all([
      prisma.defectiveGoods.count({ where }),
      prisma.defectiveGoods.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, name: true, unit: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          resolvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'defective-goods.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { productId, warehouseId, source, quantity, defectType, severity, description, batchNo, lotId, qcId } = body

    if (!productId || !warehouseId || !source || !quantity) {
      return NextResponse.json({ error: '請填寫品項、倉庫、來源及數量' }, { status: 400 })
    }

    // Get product cost for loss calculation
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { costPrice: true },
    })
    const unitCost = Number(product?.costPrice ?? 0)
    const totalLoss = unitCost * quantity

    const defectNo = await generateSequenceNo('DEFECTIVE_GOODS')

    const record = await prisma.defectiveGoods.create({
      data: {
        defectNo,
        source,
        productId,
        warehouseId,
        quantity,
        defectType: defectType || null,
        severity: severity || 'MINOR',
        description: description || null,
        batchNo: batchNo || null,
        lotId: lotId || null,
        qcId: qcId || null,
        unitCost: unitCost || null,
        totalLoss: totalLoss || null,
        createdById: session.user.id,
        status: 'PENDING',
      },
      include: {
        product: { select: { sku: true, name: true, unit: true } },
        warehouse: { select: { name: true } },
      },
    })

    // Move qty to damagedQty in inventory
    await prisma.inventory.updateMany({
      where: { productId, warehouse: warehouseId },
      data: {
        damagedQty: { increment: quantity },
        availableQty: { decrement: quantity },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'defective-goods',
      action: 'CREATE',
      entityType: 'DefectiveGoods',
      entityId: record.id,
      entityLabel: defectNo,
      changes: { quantity: { before: '0', after: String(quantity) } },
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'defective-goods.POST')
  }
}
