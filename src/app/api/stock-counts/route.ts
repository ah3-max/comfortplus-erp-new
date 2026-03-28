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
    const warehouseId = searchParams.get('warehouseId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

    const where = {
      ...(search && {
        OR: [
          { countNo: { contains: search, mode: 'insensitive' as const } },
          { warehouse: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(status && { status: status as 'DRAFT' | 'COUNTING' | 'REVIEWING' | 'COMPLETED' | 'CANCELLED' }),
      ...(warehouseId && { warehouseId }),
    }

    const [total, data] = await Promise.all([
      prisma.stockCount.count({ where }),
      prisma.stockCount.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          items: { select: { id: true } },
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
    return handleApiError(error, 'stock-counts.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { warehouseId, countType, plannedDate, notes, items } = body

    if (!warehouseId) return NextResponse.json({ error: '請選擇倉庫' }, { status: 400 })

    const countNo = await generateSequenceNo('STOCK_COUNT')

    // If items provided, use them; otherwise auto-generate from current inventory
    let countItems: Array<{ productId: string; systemQty: number; lotId?: string; locationCode?: string }> = []

    if (items && items.length > 0) {
      countItems = items
    } else {
      // Auto-populate from inventory
      const inventory = await prisma.inventory.findMany({
        where: { warehouse: warehouseId },
        include: { product: { select: { id: true, isActive: true } } },
      })
      countItems = inventory
        .filter(inv => inv.product.isActive)
        .map(inv => ({
          productId: inv.productId,
          systemQty: inv.quantity,
        }))
    }

    const stockCount = await prisma.stockCount.create({
      data: {
        countNo,
        warehouseId,
        countType: countType || 'FULL',
        plannedDate: plannedDate ? new Date(plannedDate) : null,
        notes: notes || null,
        createdById: session.user.id,
        totalItems: countItems.length,
        items: {
          create: countItems.map(item => ({
            productId: item.productId,
            systemQty: item.systemQty,
            countedQty: 0,
            variance: 0,
            lotId: item.lotId ?? null,
            locationCode: item.locationCode ?? null,
          })),
        },
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'stock-counts',
      action: 'CREATE',
      entityType: 'StockCount',
      entityId: stockCount.id,
      entityLabel: countNo,
      changes: { warehouseId: { before: '', after: warehouseId } },
    }).catch(() => {})

    return NextResponse.json(stockCount, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'stock-counts.POST')
  }
}
