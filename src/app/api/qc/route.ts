import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type       = searchParams.get('type')              ?? ''
  const supplierId = searchParams.get('supplierId')        ?? ''
  const productId  = searchParams.get('productId')         ?? ''
  const status     = searchParams.get('status')            ?? ''

  const checks = await prisma.qualityCheck.findMany({
    where: {
      ...(type       && { inspectionType: type as never }),
      ...(supplierId && { supplierId }),
      ...(productId  && { productId }),
      ...(status     && { qcStatus: status as never }),
    },
    include: {
      productionOrder: { select: { id: true, productionNo: true } },
      purchaseOrder:   { select: { id: true, poNo: true } },
      supplier:        { select: { id: true, name: true, code: true } },
      product:         { select: { id: true, sku: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(checks)
  } catch (error) { return handleApiError(error, 'qc.list') }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.inspectionType) {
    return NextResponse.json({ error: '請選擇檢驗類型' }, { status: 400 })
  }

  const qcNo = await generateSequenceNo('QC')

  // Calculate rates
  const passedQty = body.passedQty ? Number(body.passedQty) : null
  const failedQty = body.failedQty ? Number(body.failedQty) : null
  const total = (passedQty ?? 0) + (failedQty ?? 0)
  const passRate  = total > 0 && passedQty !== null ? Math.round((passedQty / total) * 10000) / 100 : null
  const defectRate = total > 0 && failedQty !== null ? Math.round((failedQty / total) * 10000) / 100 : null

  const check = await prisma.qualityCheck.create({
    data: {
      qcNo,
      productionOrderId: body.productionOrderId || null,
      purchaseOrderId:   body.purchaseOrderId   || null,
      supplierId:        body.supplierId         || null,
      productId:         body.productId          || null,
      batchNo:           body.batchNo            || null,
      inspectionType:    body.inspectionType,
      resultSummary:   body.resultSummary    || null,
      sampleSize:        body.sampleSize         ? Number(body.sampleSize) : null,
      passedQty,
      failedQty,
      passRate,
      defectRate,
      qcStatus:          body.qcStatus ?? 'PENDING',
      result:            body.result   || null,
      inspectedById:     session.user.id,
      inspectionDate:    new Date(),
      notes:             body.notes || null,
    },
    include: {
      supplier: { select: { id: true, name: true } },
      product:  { select: { id: true, sku: true, name: true } },
    },
  })

  return NextResponse.json(check, { status: 201 })
  } catch (error) { return handleApiError(error, 'qc.create') }
}
