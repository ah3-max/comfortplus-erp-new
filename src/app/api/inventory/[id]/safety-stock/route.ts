import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (
    !['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER', 'WAREHOUSE', 'PROCUREMENT'].includes(role)
  ) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const safetyStock = Number(body.safetyStock)

    if (isNaN(safetyStock) || safetyStock < 0) {
      return NextResponse.json({ error: '安全庫存必須為非負整數' }, { status: 400 })
    }

    const existing = await prisma.inventory.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '找不到庫存記錄' }, { status: 404 })
    }

    const updated = await prisma.inventory.update({
      where: { id },
      data: { safetyStock: Math.round(safetyStock) },
      include: {
        product: {
          select: { id: true, sku: true, name: true, unit: true, leadTimeDays: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'inventory.safety-stock.PUT')
  }
}
