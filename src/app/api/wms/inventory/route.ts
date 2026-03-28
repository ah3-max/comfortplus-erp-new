import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const locationId = searchParams.get('locationId') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

  const where = {
    ...(locationId && { locationId }),
    ...(search && {
      OR: [
        { stockNumber: { contains: search, mode: 'insensitive' as const } },
        { product: { name: { contains: search, mode: 'insensitive' as const } } },
        { product: { sku: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
  }

  const [inventory, total] = await Promise.all([
    prisma.wmsInventory.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true, unit: true } },
        location: {
          select: {
            id: true, code: true, name: true,
            zone: { select: { id: true, code: true, name: true, warehouse: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.wmsInventory.count({ where }),
  ])

  return NextResponse.json({
    data: inventory,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}
