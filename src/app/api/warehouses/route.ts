import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
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
  } catch (error) {
    return handleApiError(error, 'warehouses.list')
  }
}

export async function POST(req: NextRequest) {
  try {
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

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'warehouses',
      action: 'CREATE',
      entityType: 'Warehouse',
      entityId: warehouse.id,
      entityLabel: `${warehouse.code} ${warehouse.name}`,
    }).catch(() => {})

    return NextResponse.json(warehouse, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'warehouses.create')
  }
}
