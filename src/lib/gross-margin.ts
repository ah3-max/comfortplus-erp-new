/**
 * 毛利率計算服務
 * FIFO 批次查找優先順序：
 *   1. OutboundRecord → OutboundItem.batchNo（最準確，反映實際出庫批號）
 *   2. InventoryLot FIFO（最舊入庫日期）→ BatchCostAllocation
 *   3. ProductCostStructure.totalCost
 *   4. Product.costPrice（最後兜底）
 */
import { prisma } from '@/lib/prisma'

export interface ItemMarginResult {
  id: string
  batchNo: string | null
  unitCostSnap: number        // 批次成本（TWD）
  warehouseStorageDays: number
  warehouseStorageCost: number // 每單位倉儲成本
  effectiveUnitCost: number   // 有效單位成本 = unitCostSnap + warehouseStorageCost
  grossMarginAmt: number      // 毛利額
  grossMarginRate: number     // 毛利率 %
  costBreakdown: {
    batchCostTWD: number
    exchangeRate: number
    storageDays: number
    storageCostPerUnit: number
    totalCostPerUnit: number
    source: 'outbound_record' | 'lot_fifo' | 'product_structure' | 'cost_price'
  }
}

export interface OrderMarginResult {
  items: ItemMarginResult[]
  costOfGoods: number
  grossProfit: number
  grossMarginPct: number
  warehouseStorageTotal: number
}

const DEFAULT_DAILY_RATE_PER_PALLET = 30   // TWD / 棧板 / 天
const DEFAULT_UNITS_PER_PALLET = 40        // 包 / 棧板

async function getSystemConfigNum(key: string, fallback: number): Promise<number> {
  const cfg = await prisma.systemConfig.findUnique({ where: { key } })
  return cfg?.value ? parseFloat(cfg.value) : fallback
}

export async function calculateOrderMargin(orderId: string): Promise<OrderMarginResult> {
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, costPrice: true, costStructure: true }
          }
        }
      },
    },
  })

  if (!order) throw new Error('Order not found')

  // ── 取出庫紀錄（最準確的批號來源）────────────────────
  const outboundRecords = await prisma.outboundRecord.findMany({
    where: { orderId },
    include: {
      items: { select: { productId: true, batchNo: true } }
    },
  })

  // Build map: productId → first batchNo from outbound records
  const outboundBatchMap = new Map<string, string>()
  for (const rec of outboundRecords) {
    for (const oi of rec.items) {
      if (oi.batchNo && !outboundBatchMap.has(oi.productId)) {
        outboundBatchMap.set(oi.productId, oi.batchNo)
      }
    }
  }

  // ── 取出貨日期 ───────────────────────────────────────
  const shipments = await prisma.shipment.findMany({
    where: { orderId, status: { in: ['SHIPPED', 'DELIVERED'] } },
    orderBy: { shipDate: 'asc' },
    take: 1,
    select: { shipDate: true },
  })

  const [dailyRatePerPallet, unitsPerPallet] = await Promise.all([
    getSystemConfigNum('WAREHOUSE_DAILY_RATE_PER_PALLET', DEFAULT_DAILY_RATE_PER_PALLET),
    getSystemConfigNum('UNITS_PER_PALLET', DEFAULT_UNITS_PER_PALLET),
  ])

  const shipDate = shipments[0]?.shipDate ?? order.orderDate ?? new Date()

  let totalCostOfGoods = 0
  let warehouseStorageTotal = 0
  const itemResults: ItemMarginResult[] = []

  for (const item of order.items) {
    let unitCostTWD = 0
    let exchangeRate = 1
    let batchNo: string | null = null
    let inboundDate: Date | null = null
    let costSource: ItemMarginResult['costBreakdown']['source'] = 'cost_price'

    // ── 優先：OutboundRecord 明確的批號 ─────────────────
    const actualBatchNo = outboundBatchMap.get(item.productId) ?? null

    if (actualBatchNo) {
      const batchCost = await prisma.batchCostAllocation.findUnique({
        where: { batchNo_productId: { batchNo: actualBatchNo, productId: item.productId } },
      })
      if (batchCost?.unitCost) {
        exchangeRate = Number(batchCost.exchangeRate ?? 1)
        unitCostTWD = Number(batchCost.unitCost) * exchangeRate
        batchNo = actualBatchNo
        costSource = 'outbound_record'

        // Inbound date from linked lot
        if (batchCost.lotId) {
          const lot = await prisma.inventoryLot.findUnique({
            where: { id: batchCost.lotId },
            select: { inboundDate: true },
          })
          inboundDate = lot?.inboundDate ?? null
        } else {
          // Try to find lot by lotNo = batchNo
          const lot = await prisma.inventoryLot.findFirst({
            where: { lotNo: actualBatchNo, productId: item.productId },
            select: { inboundDate: true },
          })
          inboundDate = lot?.inboundDate ?? null
        }
      }
    }

    // ── 第二優先：InventoryLot FIFO（最舊入庫日）───────
    if (!batchNo) {
      const oldestLot = await prisma.inventoryLot.findFirst({
        where: { productId: item.productId, quantity: { gt: 0 } },
        orderBy: { inboundDate: 'asc' },
        select: { id: true, lotNo: true, inboundDate: true },
      })
      if (oldestLot) {
        const batchCost = await prisma.batchCostAllocation.findFirst({
          where: {
            productId: item.productId,
            OR: [
              { lotId: oldestLot.id },
              { batchNo: oldestLot.lotNo ?? '' },
            ],
          },
        })
        if (batchCost?.unitCost) {
          exchangeRate = Number(batchCost.exchangeRate ?? 1)
          unitCostTWD = Number(batchCost.unitCost) * exchangeRate
          batchNo = batchCost.batchNo
          costSource = 'lot_fifo'
          inboundDate = oldestLot.inboundDate ?? null
        }
      }
    }

    // ── Fallback：ProductCostStructure → costPrice ────
    if (!batchNo) {
      const cs = item.product.costStructure as Record<string, unknown> | null
      const structureCost = cs?.totalCost != null ? Number(cs.totalCost) : null
      if (structureCost != null && structureCost > 0) {
        unitCostTWD = structureCost
        costSource = 'product_structure'
      } else {
        unitCostTWD = Number(item.product.costPrice ?? 0)
        costSource = 'cost_price'
      }
    }

    // ── 倉儲成本（基於 inboundDate ~ shipDate）──────────
    let warehouseStorageDays = 0
    let warehouseStorageCostPerUnit = 0

    if (inboundDate) {
      warehouseStorageDays = Math.max(
        0,
        Math.round((new Date(shipDate).getTime() - new Date(inboundDate).getTime()) / 86400000)
      )
      const palletsUsed = item.quantity / unitsPerPallet
      const totalStorageCost = palletsUsed * warehouseStorageDays * dailyRatePerPallet
      warehouseStorageCostPerUnit = item.quantity > 0 ? totalStorageCost / item.quantity : 0
    }

    const effectiveUnitCost = unitCostTWD + warehouseStorageCostPerUnit
    const costTotal = effectiveUnitCost * item.quantity
    const grossMarginAmt = Number(item.subtotal) - costTotal
    const grossMarginRate = Number(item.subtotal) > 0
      ? (grossMarginAmt / Number(item.subtotal)) * 100
      : 0

    totalCostOfGoods += costTotal
    warehouseStorageTotal += warehouseStorageCostPerUnit * item.quantity

    itemResults.push({
      id: item.id,
      batchNo,
      unitCostSnap: unitCostTWD,
      warehouseStorageDays,
      warehouseStorageCost: warehouseStorageCostPerUnit,
      effectiveUnitCost,
      grossMarginAmt,
      grossMarginRate,
      costBreakdown: {
        batchCostTWD: unitCostTWD,
        exchangeRate,
        storageDays: warehouseStorageDays,
        storageCostPerUnit: warehouseStorageCostPerUnit,
        totalCostPerUnit: effectiveUnitCost,
        source: costSource,
      }
    })
  }

  const grossProfit = Number(order.totalAmount) - totalCostOfGoods
  const grossMarginPct = Number(order.totalAmount) > 0
    ? (grossProfit / Number(order.totalAmount)) * 100
    : 0

  return { items: itemResults, costOfGoods: totalCostOfGoods, grossProfit, grossMarginPct, warehouseStorageTotal }
}

/** 計算並寫入資料庫 */
export async function persistOrderMargin(orderId: string): Promise<OrderMarginResult> {
  const result = await calculateOrderMargin(orderId)

  await prisma.salesOrder.update({
    where: { id: orderId },
    data: {
      costOfGoods:    result.costOfGoods,
      grossProfit:    result.grossProfit,
      grossMarginPct: result.grossMarginPct,
    }
  })

  for (const item of result.items) {
    await prisma.salesOrderItem.update({
      where: { id: item.id },
      data: {
        batchNo:              item.batchNo ?? undefined,
        unitCostSnap:         item.unitCostSnap,
        warehouseStorageDays: item.warehouseStorageDays,
        warehouseStorageCost: item.warehouseStorageCost,
        effectiveUnitCost:    item.effectiveUnitCost,
        grossMarginAmt:       item.grossMarginAmt,
        grossMarginRate:      item.grossMarginRate,
      }
    })
  }

  return result
}
