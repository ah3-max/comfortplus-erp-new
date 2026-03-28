import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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
