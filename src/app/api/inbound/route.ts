import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { generateSequenceNo } from '@/lib/sequence'

// GET /api/inbound — list inbound records
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? 20)))
  const status = searchParams.get('putawayStatus')   // PENDING / IN_PROGRESS / COMPLETED
  const qcResult = searchParams.get('qcResult')       // PASS / FAIL / CONDITIONAL
  const search = searchParams.get('search')

  const where: Record<string, unknown> = {}
  if (status) where.putawayStatus = status
  if (qcResult) where.qcResult = qcResult
  if (search) {
    where.OR = [
      { inboundNo: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.inboundRecord.findMany({
      where,
      include: {
        warehouse: { select: { code: true, name: true } },
        seaFreight: { select: { freightNo: true, status: true, purchaseOrder: { select: { poNo: true } } } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inboundRecord.count({ where }),
  ])

  return NextResponse.json({
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

// POST /api/inbound — create inbound record (goods receipt)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { warehouseId, sourceType = 'PURCHASE', sourceId, seaFreightId, arrivalDate, notes, items = [] } = body

    if (!warehouseId) return NextResponse.json({ error: '請選擇倉庫' }, { status: 400 })
    if (!items.length) return NextResponse.json({ error: '請至少新增一筆入庫品項' }, { status: 400 })

    const inboundNo = await generateSequenceNo('INBOUND')

    const record = await prisma.inboundRecord.create({
      data: {
        inboundNo,
        warehouseId,
        sourceType,
        sourceId: sourceId || null,
        seaFreightId: seaFreightId || null,
        arrivalDate: arrivalDate ? new Date(arrivalDate) : new Date(),
        notes: notes || null,
        putawayStatus: 'PENDING',
        items: {
          create: items.map((item: {
            productId: string
            quantity: number
            expectedQty?: number
            batchNo?: string
            unitCost?: number
          }) => ({
            productId: item.productId,
            quantity: Number(item.quantity),
            expectedQty: item.expectedQty ? Number(item.expectedQty) : null,
            batchNo: item.batchNo || null,
            unitCost: item.unitCost ? Number(item.unitCost) : null,
          })),
        },
      },
      include: {
        warehouse: { select: { code: true, name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'inbound.create')
  }
}
