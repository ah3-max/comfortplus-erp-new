import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/traceability/batch?batchNo=B-VN-260315-001
// One-click batch traceability: factory → warehouse → which customers
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchNo = searchParams.get('batchNo')
  const lotNo = searchParams.get('lotNo')
  const productId = searchParams.get('productId')

  if (!batchNo && !lotNo && !productId) {
    return NextResponse.json({ error: 'batchNo, lotNo, or productId required' }, { status: 400 })
  }

  // ── 1. Find the inventory lot(s) ──
  const lotWhere: any = {}
  if (batchNo) {
    // Search in InboundItem.batchNo or InventoryLot.lotNo containing batchNo
    const inboundItems = await prisma.inboundItem.findMany({
      where: { batchNo: { contains: batchNo } },
      select: { batchNo: true, productId: true, inbound: { select: { id: true, warehouseId: true, seaFreightId: true, arrivalDate: true } } },
    })

    const lots = await prisma.inventoryLot.findMany({
      where: {
        OR: [
          { lotNo: { contains: batchNo } },
          ...(inboundItems.length > 0 ? [{ productId: { in: inboundItems.map(i => i.productId) } }] : []),
        ],
      },
      select: {
        id: true, lotNo: true, productId: true, quantity: true, status: true,
        manufactureDate: true, expiryDate: true, sourceFactory: true,
        warehouseId: true, warehouse: { select: { name: true } },
        product: { select: { id: true, sku: true, name: true, unit: true } },
        purchaseOrderId: true,
        purchaseOrder: { select: { poNo: true, supplierId: true, supplier: { select: { name: true, country: true } } } },
      },
    })

    if (lots.length === 0 && inboundItems.length === 0) {
      return NextResponse.json({ error: 'Batch not found', batchNo }, { status: 404 })
    }

    // ── 2. Find source (production + sea freight) ──
    const poIds = lots.map(l => l.purchaseOrderId).filter(Boolean) as string[]

    const productionOrders = poIds.length > 0 ? await prisma.productionOrder.findMany({
      where: { purchaseOrderId: { in: poIds } },
      select: {
        id: true, productionNo: true, status: true, orderQty: true, producedQty: true,
        defectRate: true, productionStartDate: true, productionEndDate: true, shipmentDate: true,
        factory: { select: { id: true, name: true, country: true } },
      },
    }) : []

    const seaFreights = poIds.length > 0 ? await prisma.seaFreight.findMany({
      where: { OR: [ { purchaseOrderId: { in: poIds } }, ...(inboundItems.map(i => i.inbound.seaFreightId).filter(Boolean).length > 0 ? [{ id: { in: inboundItems.map(i => i.inbound.seaFreightId).filter(Boolean) as string[] } }] : []) ] },
      select: {
        id: true, freightNo: true, status: true, vesselName: true, voyageNo: true,
        containerNo: true, portOfLoading: true, portOfDischarge: true,
        etd: true, eta: true, actualArrival: true, warehouseInDate: true,
        customsDeclarationNo: true, customsStatus: true,
      },
    }) : []

    // ── 3. QC results ──
    const qcResults = await prisma.qualityCheck.findMany({
      where: {
        OR: [
          { batchNo: { contains: batchNo } },
          ...(poIds.length > 0 ? [{ purchaseOrderId: { in: poIds } }] : []),
        ],
      },
      select: {
        id: true, qcNo: true, qcStatus: true, result: true,
        sampleSize: true, passedQty: true, failedQty: true, defectRate: true,
        inspectionDate: true, resultSummary: true,
      },
    })

    // ── 4. Distribution: which customers got this batch ──
    // Search ShipmentItem by batchNo
    const shipmentItems = await prisma.shipmentItem.findMany({
      where: {
        OR: [
          ...(batchNo ? [{ batchNo: { contains: batchNo } }] : []),
          { productId: { in: lots.map(l => l.productId) } },
        ],
      },
      select: {
        id: true, quantity: true, batchNo: true,
        product: { select: { sku: true, name: true } },
        shipment: {
          select: {
            id: true, shipmentNo: true, shipDate: true, status: true,
            address: true,
            order: {
              select: {
                id: true, orderNo: true,
                customer: { select: { id: true, name: true, code: true, region: true } },
              },
            },
          },
        },
      },
    })

    // Filter to only items matching this batch
    const distribution = shipmentItems
      .filter(si => si.batchNo?.includes(batchNo ?? '') || !batchNo)
      .map(si => ({
        customerId: si.shipment.order?.customer?.id,
        customerName: si.shipment.order?.customer?.name ?? '-',
        customerCode: si.shipment.order?.customer?.code ?? '-',
        region: si.shipment.order?.customer?.region ?? '-',
        orderNo: si.shipment.order?.orderNo ?? '-',
        shipmentNo: si.shipment.shipmentNo,
        shipDate: si.shipment.shipDate?.toISOString().slice(0, 10) ?? '-',
        quantity: si.quantity,
        status: si.shipment.status,
      }))

    const uniqueCustomerIds = new Set(distribution.map(d => d.customerId).filter(Boolean))

    // ── 5. Related incidents ──
    const incidents = await prisma.careIncident.findMany({
      where: { batchNo: { contains: batchNo ?? '' } },
      select: {
        id: true, incidentNo: true, incidentType: true, severity: true, status: true,
        issueSummary: true, createdAt: true,
        customer: { select: { name: true } },
      },
    })

    return NextResponse.json({
      batchNo,
      lots: lots.map(l => ({
        lotNo: l.lotNo,
        product: l.product,
        warehouse: l.warehouse?.name ?? '-',
        quantity: l.quantity,
        status: l.status,
        manufactureDate: l.manufactureDate?.toISOString().slice(0, 10),
        expiryDate: l.expiryDate?.toISOString().slice(0, 10),
        sourceFactory: l.sourceFactory ?? l.purchaseOrder?.supplier?.name ?? '-',
        sourceCountry: l.purchaseOrder?.supplier?.country ?? '-',
        poNo: l.purchaseOrder?.poNo ?? '-',
      })),
      production: productionOrders.map(po => ({
        productionNo: po.productionNo,
        factory: po.factory?.name ?? '-',
        country: po.factory?.country ?? '-',
        status: po.status,
        orderQty: po.orderQty,
        producedQty: po.producedQty,
        defectRate: po.defectRate ? Number(po.defectRate) : null,
        productionStart: po.productionStartDate?.toISOString().slice(0, 10),
        productionEnd: po.productionEndDate?.toISOString().slice(0, 10),
        shipDate: po.shipmentDate?.toISOString().slice(0, 10),
      })),
      import: seaFreights.map(sf => ({
        freightNo: sf.freightNo,
        vessel: sf.vesselName,
        voyage: sf.voyageNo,
        container: sf.containerNo,
        portLoading: sf.portOfLoading,
        portDischarge: sf.portOfDischarge,
        etd: sf.etd?.toISOString().slice(0, 10),
        eta: sf.eta?.toISOString().slice(0, 10),
        actualArrival: sf.actualArrival?.toISOString().slice(0, 10),
        warehouseIn: sf.warehouseInDate?.toISOString().slice(0, 10),
        customs: sf.customsStatus,
        declarationNo: sf.customsDeclarationNo,
      })),
      qc: qcResults.map(q => ({
        qcNo: q.qcNo,
        status: q.qcStatus,
        result: q.result,
        sampleSize: q.sampleSize,
        passed: q.passedQty,
        failed: q.failedQty,
        defectRate: q.defectRate ? Number(q.defectRate) : null,
        date: q.inspectionDate?.toISOString().slice(0, 10),
        summary: q.resultSummary,
      })),
      distribution,
      summary: {
        affectedCustomers: uniqueCustomerIds.size,
        totalDistributedQty: distribution.reduce((s, d) => s + d.quantity, 0),
        totalShipments: new Set(distribution.map(d => d.shipmentNo)).size,
      },
      incidents: incidents.map(i => ({
        incidentNo: i.incidentNo,
        type: i.incidentType,
        severity: i.severity,
        status: i.status,
        summary: i.issueSummary,
        customer: i.customer?.name,
        date: i.createdAt.toISOString().slice(0, 10),
      })),
    })
  }

  return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
}
