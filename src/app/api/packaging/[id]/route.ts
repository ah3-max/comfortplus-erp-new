import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const material = await prisma.packagingMaterial.update({
    where: { id },
    data: {
      name:             body.name             ?? undefined,
      materialType:     body.materialType     ?? undefined,
      supplierId:       body.supplierId       !== undefined ? (body.supplierId || null) : undefined,
      stockQty:         body.stockQty         !== undefined ? Number(body.stockQty)         : undefined,
      inTransitQty:     body.inTransitQty     !== undefined ? Number(body.inTransitQty)     : undefined,
      sentToFactoryQty: body.sentToFactoryQty !== undefined ? Number(body.sentToFactoryQty) : undefined,
      wastageRate:      body.wastageRate      !== undefined ? body.wastageRate               : undefined,
      unit:             body.unit             ?? undefined,
      safetyStock:      body.safetyStock      !== undefined ? Number(body.safetyStock)       : undefined,
      notes:            body.notes            ?? undefined,
    },
    include: { supplier: { select: { id: true, name: true } } },
  })

  return NextResponse.json(material)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.packagingMaterial.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
