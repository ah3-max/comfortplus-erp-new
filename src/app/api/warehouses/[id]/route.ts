import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER'].includes(role)) {
      return NextResponse.json({ error: '無權限修改/刪除倉庫' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        name:     body.name     || undefined,
        address:  body.address  ?? null,
        notes:    body.notes    ?? null,
        isActive: body.isActive ?? undefined,
      },
    })

    return NextResponse.json(warehouse)
  } catch (error) {
    return handleApiError(error, 'warehouses.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER'].includes(role)) {
      return NextResponse.json({ error: '無權限修改/刪除倉庫' }, { status: 403 })
    }

    const { id } = await params
    const wh = await prisma.warehouse.findUnique({
      where: { id },
      include: { _count: { select: { lots: true } } },
    })
    if (!wh) return NextResponse.json({ error: '找不到倉庫' }, { status: 404 })
    if (wh._count.lots > 0) {
      return NextResponse.json({ error: '倉庫有批號資料，請先移轉或停用' }, { status: 400 })
    }

    // Soft delete
    const updated = await prisma.warehouse.update({
      where: { id },
      data:  { isActive: false },
    })
    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'warehouses.delete')
  }
}
