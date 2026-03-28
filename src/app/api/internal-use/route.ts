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
    const purpose = searchParams.get('purpose') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

    const where = {
      ...(search && {
        OR: [
          { useNo: { contains: search, mode: 'insensitive' as const } },
          { notes: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status }),
      ...(purpose && { purpose }),
    }

    const [total, data] = await Promise.all([
      prisma.internalUse.count({ where }),
      prisma.internalUse.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          items: {
            include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
          },
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
    return handleApiError(error, 'internal-use.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { warehouseId, purpose, notes, items } = body

    if (!warehouseId || !purpose || !items?.length) {
      return NextResponse.json({ error: '請填寫倉庫、用途及品項' }, { status: 400 })
    }

    const useNo = await generateSequenceNo('INTERNAL_USE')

    // Calculate total cost
    const productIds = items.map((i: { productId: string }) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, costPrice: true },
    })
    const costMap = Object.fromEntries(products.map(p => [p.id, Number(p.costPrice)]))

    const itemsWithCost = items.map((item: { productId: string; quantity: number; unitCost?: number; notes?: string; lotId?: string }) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitCost: item.unitCost ?? costMap[item.productId] ?? 0,
      totalCost: (item.unitCost ?? costMap[item.productId] ?? 0) * item.quantity,
      notes: item.notes ?? null,
      lotId: item.lotId ?? null,
    }))

    const totalCost = itemsWithCost.reduce((s: number, i: { totalCost: number }) => s + i.totalCost, 0)

    const record = await prisma.internalUse.create({
      data: {
        useNo,
        purpose,
        warehouseId,
        requestedById: session.user.id,
        status: 'PENDING_APPROVAL',
        totalCost,
        notes: notes || null,
        items: { create: itemsWithCost },
      },
      include: {
        items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
        warehouse: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'internal-use',
      action: 'CREATE',
      entityType: 'InternalUse',
      entityId: record.id,
      entityLabel: useNo,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'internal-use.POST')
  }
}
