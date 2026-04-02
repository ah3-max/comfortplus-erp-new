import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const sf = await prisma.seaFreight.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            items: {
              include: {
                product: { select: { id: true, sku: true, name: true, unit: true, weight: true } },
              },
            },
          },
        },
      },
    })

    if (!sf) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const totalCost =
      Number(sf.oceanFreight  ?? 0) + Number(sf.customsFee   ?? 0) +
      Number(sf.documentFee   ?? 0) + Number(sf.portCharge   ?? 0) +
      Number(sf.truckingFee   ?? 0) + Number(sf.insuranceFee ?? 0) +
      Number(sf.storageFee    ?? 0) + Number(sf.otherFee     ?? 0)

    if (!sf.purchaseOrder?.items?.length) {
      return NextResponse.json({ totalCost, allocations: [], note: '無關聯採購單品項，無法分攤' })
    }

    const poItems = sf.purchaseOrder.items
    const itemsWithData = poItems.map(item => ({
      productId: item.productId ?? '',
      sku: item.product?.sku ?? item.skuSnap ?? '',
      name: item.product?.name ?? item.nameSnap ?? '',
      unit: item.product?.unit ?? item.unit ?? '',
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      totalValue: Number(item.unitCost) * Number(item.quantity),
      totalWeightKg: Number(item.product?.weight ?? 0) * Number(item.quantity),
    }))

    const totalWeight = itemsWithData.reduce((s, i) => s + i.totalWeightKg, 0)
    const totalValue  = itemsWithData.reduce((s, i) => s + i.totalValue, 0)

    const allocations = itemsWithData.map(item => {
      const ratio = totalWeight > 0
        ? item.totalWeightKg / totalWeight
        : totalValue > 0 ? item.totalValue / totalValue : 1 / itemsWithData.length

      const allocatedCost = totalCost * ratio
      const costPerUnit = item.quantity > 0 ? allocatedCost / item.quantity : 0

      return {
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        totalValue: item.totalValue,
        totalWeightKg: item.totalWeightKg,
        allocationRatio: Math.round(ratio * 10000) / 100,
        allocatedCost: Math.round(allocatedCost * 100) / 100,
        costPerUnit: Math.round(costPerUnit * 100) / 100,
      }
    })

    return NextResponse.json({
      freightNo: sf.freightNo,
      totalCost,
      allocationBasis: totalWeight > 0 ? '重量比例' : '金額比例',
      costBreakdown: {
        oceanFreight: Number(sf.oceanFreight  ?? 0),
        customsFee:   Number(sf.customsFee    ?? 0),
        documentFee:  Number(sf.documentFee   ?? 0),
        portCharge:   Number(sf.portCharge    ?? 0),
        truckingFee:  Number(sf.truckingFee   ?? 0),
        insuranceFee: Number(sf.insuranceFee  ?? 0),
        storageFee:   Number(sf.storageFee    ?? 0),
        otherFee:     Number(sf.otherFee      ?? 0),
      },
      allocations,
    })
  } catch (error) {
    return handleApiError(error, 'seaFreight.costAllocation.GET')
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'PROCUREMENT'].includes(role)) {
      return NextResponse.json({ error: '無權限進行成本分攤' }, { status: 403 })
    }

    const { id } = await params
    const sf = await prisma.seaFreight.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            items: {
              include: {
                product: { select: { id: true, weight: true } },
              },
            },
          },
        },
      },
    })

    if (!sf) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!sf.purchaseOrder?.items?.length) {
      return NextResponse.json({ error: '無關聯採購單品項' }, { status: 400 })
    }

    const totalCost =
      Number(sf.oceanFreight  ?? 0) + Number(sf.customsFee  ?? 0) +
      Number(sf.documentFee   ?? 0) + Number(sf.portCharge  ?? 0) +
      Number(sf.truckingFee   ?? 0) + Number(sf.insuranceFee ?? 0) +
      Number(sf.storageFee    ?? 0) + Number(sf.otherFee     ?? 0)

    const items = sf.purchaseOrder.items.filter(i => i.productId)
    const totalWeight = items.reduce((s, i) => s + Number(i.product?.weight ?? 0) * Number(i.quantity), 0)
    const totalValue  = items.reduce((s, i) => s + Number(i.unitCost) * Number(i.quantity), 0)

    const updates = items.map(item => {
      const weight = Number(item.product?.weight ?? 0) * Number(item.quantity)
      const value  = Number(item.unitCost) * Number(item.quantity)
      const ratio  = totalWeight > 0 ? weight / totalWeight : totalValue > 0 ? value / totalValue : 1 / items.length
      const costPerUnit = Number(item.quantity) > 0 ? (totalCost * ratio) / Number(item.quantity) : 0

      return prisma.productCostStructure.upsert({
        where: { productId: item.productId! },
        create: { productId: item.productId!, customsCost: costPerUnit },
        update: { customsCost: costPerUnit },
      })
    })

    await Promise.all(updates)

    return NextResponse.json({
      message: `成本分攤完成：已更新 ${updates.length} 項商品的進口成本`,
      updatedCount: updates.length,
    })
  } catch (error) {
    return handleApiError(error, 'seaFreight.costAllocation.POST')
  }
}
