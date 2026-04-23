import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

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

    const before = await prisma.warehouse.findUnique({
      where: { id },
      select: { name: true, isActive: true, code: true },
    })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        name:     body.name     || undefined,
        address:  body.address  ?? null,
        notes:    body.notes    ?? null,
        isActive: body.isActive ?? undefined,
      },
    })

    const changes: Record<string, { before: unknown; after: unknown }> = {}
    if (before.name !== warehouse.name) changes.name = { before: before.name, after: warehouse.name }
    if (before.isActive !== warehouse.isActive) changes.isActive = { before: before.isActive, after: warehouse.isActive }

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'warehouses',
      action: 'UPDATE',
      entityType: 'Warehouse',
      entityId: id,
      entityLabel: `${warehouse.code} ${warehouse.name}`,
      changes,
    }).catch(() => {})

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

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'warehouses',
      action: 'DEACTIVATE',
      entityType: 'Warehouse',
      entityId: id,
      entityLabel: `${wh.code} ${wh.name}`,
      changes: { isActive: { before: true, after: false } },
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'warehouses.delete')
  }
}
