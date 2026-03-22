import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const qc = await prisma.qualityCheck.findUnique({
    where: { id },
    include: {
      productionOrder: { select: { id: true, productionNo: true, status: true } },
      purchaseOrder:   { select: { id: true, poNo: true } },
      supplier:        { select: { id: true, name: true, code: true } },
      product:         { select: { id: true, sku: true, name: true } },
      checkItems:      { orderBy: { id: 'asc' } },
    },
  })
  if (!qc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(qc)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const passedQty = body.passedQty !== undefined ? Number(body.passedQty) : undefined
  const failedQty = body.failedQty !== undefined ? Number(body.failedQty) : undefined

  let passRate: number | undefined
  let defectRate: number | undefined
  if (passedQty !== undefined || failedQty !== undefined) {
    const existing = await prisma.qualityCheck.findUnique({ where: { id } })
    const p = passedQty ?? existing?.passedQty ?? 0
    const f = failedQty ?? existing?.failedQty ?? 0
    const total = p + f
    if (total > 0) {
      passRate = Math.round((p / total) * 10000) / 100
      defectRate = Math.round((f / total) * 10000) / 100
    }
  }

  const check = await prisma.qualityCheck.update({
    where: { id },
    data: {
      batchNo:         body.batchNo         ?? undefined,
      inspectionType:  body.inspectionType  ?? undefined,
      sampleSize:      body.sampleSize      !== undefined ? Number(body.sampleSize) : undefined,
      passedQty,
      failedQty,
      passRate,
      defectRate,
      qcStatus:        body.qcStatus        ?? undefined,
      result:          body.result           ?? undefined,
      resultSummary:   body.resultSummary    ?? undefined,
      notes:           body.notes           ?? undefined,
    },
    include: {
      supplier: { select: { id: true, name: true } },
      product:  { select: { id: true, sku: true, name: true } },
    },
  })

  return NextResponse.json(check)
}
