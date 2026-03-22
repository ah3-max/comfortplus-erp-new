import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const showAll = searchParams.get('showAll') === 'true'

  const warehouses = await prisma.warehouse.findMany({
    where: showAll ? undefined : { isActive: true },
    include: {
      _count: { select: { lots: true, stockCounts: true } },
    },
    orderBy: { code: 'asc' },
  })

  return NextResponse.json(warehouses)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.code || !body.name) {
    return NextResponse.json({ error: '倉庫代碼和名稱為必填' }, { status: 400 })
  }

  const existing = await prisma.warehouse.findUnique({ where: { code: body.code } })
  if (existing) return NextResponse.json({ error: '倉庫代碼已存在' }, { status: 400 })

  const warehouse = await prisma.warehouse.create({
    data: {
      code:    body.code.toUpperCase(),
      name:    body.name,
      address: body.address || null,
      notes:   body.notes   || null,
    },
  })

  return NextResponse.json(warehouse, { status: 201 })
}
