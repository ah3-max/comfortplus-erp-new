import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const materials = await prisma.packagingMaterial.findMany({
    include: {
      supplier: { select: { id: true, name: true, code: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(materials)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.code || !body.name || !body.materialType) {
    return NextResponse.json({ error: '請填寫代碼、名稱與類型' }, { status: 400 })
  }

  const exists = await prisma.packagingMaterial.findUnique({ where: { code: body.code } })
  if (exists) return NextResponse.json({ error: '代碼已存在' }, { status: 400 })

  const material = await prisma.packagingMaterial.create({
    data: {
      code:             body.code,
      name:             body.name,
      materialType:     body.materialType,
      supplierId:       body.supplierId       || null,
      stockQty:         body.stockQty         ? Number(body.stockQty)         : 0,
      inTransitQty:     body.inTransitQty     ? Number(body.inTransitQty)     : 0,
      sentToFactoryQty: body.sentToFactoryQty ? Number(body.sentToFactoryQty) : 0,
      wastageRate:      body.wastageRate      ? Number(body.wastageRate)      : null,
      unit:             body.unit             || '個',
      safetyStock:      body.safetyStock      ? Number(body.safetyStock)      : 0,
      notes:            body.notes            || null,
    },
    include: { supplier: { select: { id: true, name: true } } },
  })

  return NextResponse.json(material, { status: 201 })
}
