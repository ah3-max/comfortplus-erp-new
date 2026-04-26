import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

type Params = { params: Promise<{ id: string }> }

// POST /api/donghong/supplier-quotations/[id]/activate  — DRAFT → ACTIVE
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const quotation = await prisma.supplierQuotation.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    })
    if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (quotation.status !== 'DRAFT') {
      return NextResponse.json({ error: `目前狀態為 ${quotation.status}，只有 DRAFT 可啟用` }, { status: 400 })
    }
    if (quotation._count.items === 0) {
      return NextResponse.json({ error: '報價單至少需要一筆品項才能啟用' }, { status: 400 })
    }
    if (new Date(quotation.validUntil) < new Date()) {
      return NextResponse.json({ error: '報價有效期已過期，請更新後再啟用' }, { status: 400 })
    }

    const updated = await prisma.supplierQuotation.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: { id: true, quotationNumber: true, status: true, validUntil: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'donghong.supplierQuotations.activate')
  }
}
