import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.competitorPrice.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.competitorPrice.update({
      where: { id },
      data: {
        ...(body.recordDate    !== undefined && { recordDate: new Date(body.recordDate) }),
        ...(body.channel       !== undefined && { channel: body.channel }),
        ...(body.competitor    !== undefined && { competitor: body.competitor }),
        ...(body.productName   !== undefined && { productName: body.productName }),
        ...(body.sku           !== undefined && { sku: body.sku || null }),
        ...(body.spec          !== undefined && { spec: body.spec || null }),
        ...(body.unitPrice     !== undefined && { unitPrice: Number(body.unitPrice) }),
        ...(body.originalPrice !== undefined && { originalPrice: body.originalPrice ? Number(body.originalPrice) : null }),
        ...(body.promoNote     !== undefined && { promoNote: body.promoNote || null }),
        ...(body.isOnShelf     !== undefined && { isOnShelf: body.isOnShelf }),
        ...(body.sourceUrl     !== undefined && { sourceUrl: body.sourceUrl || null }),
        ...(body.notes         !== undefined && { notes: body.notes || null }),
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'competitor-prices.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existing = await prisma.competitorPrice.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.competitorPrice.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'competitor-prices.delete')
  }
}
