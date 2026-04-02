import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { notifyByRole } from '@/lib/notify'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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
  } catch (error) { return handleApiError(error, 'qc.get') }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

  // Fetch existing before update to detect status change
  const existingQc = await prisma.qualityCheck.findUnique({
    where: { id },
    select: { qcStatus: true, result: true, qcNo: true, productId: true, purchaseOrderId: true },
  })

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

  // QC completed with ACCEPTED → notify procurement + update PO status
  const newStatus = body.qcStatus ?? existingQc?.qcStatus
  const newResult = body.result ?? existingQc?.result
  if (newStatus === 'COMPLETED' && existingQc?.qcStatus !== 'COMPLETED') {
    const resultLabel = newResult === 'ACCEPTED' ? '允收' : newResult === 'REWORK' ? '重工' : newResult === 'RETURN_TO_SUPPLIER' ? '退供應商' : newResult
    notifyByRole(['PROCUREMENT', 'WAREHOUSE_MANAGER'], {
      title: `品檢完成：${existingQc?.qcNo ?? ''}`,
      message: `結果：${resultLabel}，商品：${check.product?.name ?? ''}`,
      linkUrl: `/qc/${id}`,
      category: 'QC_COMPLETED',
      priority: newResult === 'ACCEPTED' ? 'NORMAL' : 'HIGH',
    }).catch(() => {})

    // If ACCEPTED and linked to PO, advance PO to INSPECTED
    if (newResult === 'ACCEPTED' && existingQc?.purchaseOrderId) {
      await prisma.purchaseOrder.update({
        where: { id: existingQc.purchaseOrderId },
        data: { status: 'INSPECTED' },
      }).catch(() => {})
    }

    // 3-3: QC REJECTED/REWORK → auto-create DefectiveGoods
    if (['RETURN_TO_SUPPLIER', 'REWORK', 'CONDITIONAL_ACCEPT'].includes(newResult ?? '') && existingQc?.productId) {
      const failedQty = Number(check.failedQty ?? 0)
      if (failedQty > 0) {
        const defaultWh = await prisma.warehouse.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } })
        if (defaultWh) {
          const count = await prisma.defectiveGoods.count()
          const today = new Date()
          const dateStr = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
          const defectNo = `DFT${dateStr}${String(count + 1).padStart(4,'0')}`
          await prisma.defectiveGoods.create({
            data: {
              defectNo,
              source: 'QC_FAIL',
              productId: existingQc.productId,
              warehouseId: defaultWh.id,
              quantity: failedQty,
              severity: newResult === 'RETURN_TO_SUPPLIER' ? 'MAJOR' : 'MINOR',
              description: `QC ${existingQc.qcNo} 不良品`,
              qcId: id,
              createdById: session.user.id,
            },
          }).catch(() => {})
        }
      }
    }
  }

  return NextResponse.json(check)
  } catch (error) { return handleApiError(error, 'qc.update') }
}
