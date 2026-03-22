import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
}
