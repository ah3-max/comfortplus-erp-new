import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'

// POST /api/inbound/[id]/qc — 從入庫單建立 QC 驗收，QC 完成後自動入庫
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  // body: { result: 'ACCEPTED' | 'CONDITIONAL_ACCEPT' | 'RETURN_TO_SUPPLIER' | ..., passedQty?, failedQty?, notes? }

  const inbound = await prisma.inboundRecord.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      seaFreight: { include: { purchaseOrder: true } },
      warehouse: true,
    },
  })

  if (!inbound) return NextResponse.json({ error: 'Inbound not found' }, { status: 404 })

  // Determine QC pass/fail
  const qcResult = body.result // ACCEPTED, CONDITIONAL_ACCEPT, RETURN_TO_SUPPLIER, etc.
  const isPass = qcResult === 'ACCEPTED' || qcResult === 'CONDITIONAL_ACCEPT'

  // Need QC sequence
  const hasQcSeq = await prisma.sequence.findUnique({ where: { type: 'QC' } })
  if (!hasQcSeq) {
    await prisma.sequence.create({ data: { id: 'seq_qc', type: 'QC', prefix: 'QC', currentNo: 0 } })
  }
  const qcNo = await generateSequenceNo('QC')

  const totalQty = inbound.items.reduce((s, i) => s + i.quantity, 0)
  const passedQty = body.passedQty ?? (isPass ? totalQty : 0)
  const failedQty = body.failedQty ?? (isPass ? 0 : totalQty)

  // Transaction: create QC + update inbound + (if pass) update inventory
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create QualityCheck
    const qc = await tx.qualityCheck.create({
      data: {
        qcNo,
        inspectionType: 'INCOMING',
        qcStatus: 'COMPLETED',
        result: qcResult,
        purchaseOrderId: inbound.seaFreight?.purchaseOrder?.id ?? null,
        productId: inbound.items[0]?.productId ?? null,
        inspectionDate: new Date(),
        inspectedById: session.user.id,
        sampleSize: totalQty,
        passedQty,
        failedQty,
        passRate: totalQty > 0 ? Number(((passedQty / totalQty) * 100).toFixed(2)) : null,
        notes: body.notes ?? `入庫 QC — ${inbound.inboundNo}`,
      },
    })

    // 2. Update InboundRecord
    await tx.inboundRecord.update({
      where: { id },
      data: {
        qcResult: isPass ? 'PASS' : 'FAIL',
        checkedById: session.user.id,
        putawayStatus: isPass ? 'IN_PROGRESS' : 'PENDING',
      },
    })

    // 3. If QC pass → update inventory + create transactions
    if (isPass) {
      for (const item of inbound.items) {
        if (!item.productId) continue
        const qty = item.quantity - item.damageQty - item.shortQty

        if (qty <= 0) continue

        // Upsert Inventory
        const inv = await tx.inventory.upsert({
          where: {
            productId_warehouse_category: {
              productId: item.productId,
              warehouse: inbound.warehouse.code,
              category: 'FINISHED_GOODS',
            },
          },
          update: { quantity: { increment: qty } },
          create: {
            productId: item.productId,
            warehouse: inbound.warehouse.code,
            category: 'FINISHED_GOODS',
            quantity: qty,
            safetyStock: 0,
          },
        })

        // Create InventoryTransaction
        await tx.inventoryTransaction.create({
          data: {
            productId: item.productId,
            warehouse: inbound.warehouse.code,
            category: 'FINISHED_GOODS',
            type: 'IN',
            quantity: qty,
            beforeQty: inv.quantity - qty,
            afterQty: inv.quantity,
            referenceType: 'INBOUND_QC',
            referenceId: inbound.inboundNo,
            notes: `入庫驗收通過 ${inbound.inboundNo} / QC ${qcNo}`,
          },
        })

        // 2-7: Create InventoryLot for traceability
        const today = new Date()
        const dateStr = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
        const lotNo = `LOT${dateStr}-${qcNo}-${String(inbound.items.indexOf(item)+1).padStart(2,'0')}`
        await tx.inventoryLot.upsert({
          where: { lotNo },
          update: { quantity: { increment: qty } },
          create: {
            lotNo,
            productId: item.productId,
            warehouseId: inbound.warehouseId,
            category: 'FINISHED_GOODS',
            quantity: qty,
            inboundDate: new Date(),
            purchaseOrderId: inbound.seaFreight?.purchaseOrder?.id ?? null,
          },
        })
      }

      // Update PO items receivedQty
      if (inbound.seaFreight?.purchaseOrder) {
        for (const item of inbound.items) {
          if (!item.productId) continue
          const qty = item.quantity - item.damageQty - item.shortQty
          if (qty <= 0) continue

          // Find matching PO item
          const poItem = await tx.purchaseOrderItem.findFirst({
            where: { orderId: inbound.seaFreight.purchaseOrder.id, productId: item.productId },
          })
          if (poItem) {
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: { receivedQty: { increment: qty } },
            })
          }
        }

        // Check if PO fully received
        const poItems = await tx.purchaseOrderItem.findMany({
          where: { orderId: inbound.seaFreight.purchaseOrder.id },
        })
        const allReceived = poItems.every(i => i.receivedQty >= i.quantity)
        await tx.purchaseOrder.update({
          where: { id: inbound.seaFreight.purchaseOrder.id },
          data: { status: allReceived ? 'RECEIVED' : 'PARTIAL' },
        })
      }
    }

    return qc
  })

  return NextResponse.json({ qc: result, inboundId: id, qcResult: isPass ? 'PASS' : 'FAIL' })
  } catch (error) {
    return handleApiError(error, 'inbound.qc')
  }
}
