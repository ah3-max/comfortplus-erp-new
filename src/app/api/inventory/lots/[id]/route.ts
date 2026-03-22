import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const lot = await prisma.inventoryLot.update({
    where: { id },
    data: {
      location:        body.location        ?? undefined,
      status:          body.status          ?? undefined,
      quantity:        body.quantity != null ? Number(body.quantity) : undefined,
      manufactureDate: body.manufactureDate  ? new Date(body.manufactureDate) : body.manufactureDate === null ? null : undefined,
      expiryDate:      body.expiryDate       ? new Date(body.expiryDate)      : body.expiryDate      === null ? null : undefined,
      sourceFactory:   body.sourceFactory   ?? undefined,
      notes:           body.notes           ?? undefined,
    },
    include: {
      product:   { select: { sku: true, name: true, unit: true } },
      warehouse: { select: { code: true, name: true } },
    },
  })

  return NextResponse.json(lot)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lot = await prisma.inventoryLot.findUnique({ where: { id } })
  if (!lot) return NextResponse.json({ error: '找不到批號' }, { status: 404 })
  if (lot.quantity > 0) return NextResponse.json({ error: '批號尚有庫存，請先歸零或轉移' }, { status: 400 })

  await prisma.inventoryLot.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
