import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/inventory/movement
 * Inventory movement report: per-product opening/inbound/outbound/closing balances for a period.
 *
 * Query params:
 *   startDate   YYYY-MM-DD (required)
 *   endDate     YYYY-MM-DD (required)
 *   warehouseId optional
 *   productId   optional (single product detail)
 *   category    optional (FINISHED_GOODS | RAW_MATERIAL | PACKAGING)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER', 'WAREHOUSE', 'FINANCE', 'PROCUREMENT', 'SALES_MANAGER'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const startStr = searchParams.get('startDate')
    const endStr = searchParams.get('endDate')
    const warehouseId = searchParams.get('warehouseId') ?? undefined
    const productId = searchParams.get('productId') ?? undefined
    const category = searchParams.get('category') ?? undefined

    if (!startStr || !endStr) {
      return NextResponse.json({ error: '必填：startDate, endDate' }, { status: 400 })
    }

    const start = new Date(startStr)
    const end = new Date(endStr)
    end.setHours(23, 59, 59, 999)

    // ── Current inventory snapshot (closing = as-of-now) ──────────────
    // Inventory.warehouse is a plain string, not a FK
    const inventoryWhere = {
      ...(productId ? { productId } : {}),
      product: {
        isActive: true,
        ...(category ? { category } : {}),
      },
    }

    const inventoryRows = await prisma.inventory.findMany({
      where: inventoryWhere,
      select: {
        productId: true,
        quantity: true,
        warehouse: true,  // plain string
        product: { select: { id: true, name: true, sku: true, category: true, unit: true } },
      },
    })

    // Group inventory by productId (summed across warehouses)
    const inventoryByProduct = new Map<string, { qty: number; product: { id: string; name: string; sku: string; category: string; unit: string | null }; warehouses: string[] }>()
    for (const inv of inventoryRows) {
      const existing = inventoryByProduct.get(inv.productId)
      if (existing) {
        existing.qty += inv.quantity
        if (!existing.warehouses.includes(inv.warehouse)) existing.warehouses.push(inv.warehouse)
      } else {
        inventoryByProduct.set(inv.productId, {
          qty: inv.quantity,
          product: inv.product,
          warehouses: [inv.warehouse],
        })
      }
    }

    // ── Inbound in period (InboundItem) ───────────────────────────────
    const inboundItems = await prisma.inboundItem.findMany({
      where: {
        inbound: {
          arrivalDate: { gte: start, lte: end },
          ...(warehouseId ? { warehouseId } : {}),
        },
        ...(productId ? { productId } : {}),
        product: { isActive: true, ...(category ? { category } : {}) },
      },
      select: {
        productId: true,
        quantity: true,
        inbound: { select: { sourceType: true } },
      },
    })
    const inboundByProduct = new Map<string, number>()
    for (const item of inboundItems) {
      inboundByProduct.set(item.productId, (inboundByProduct.get(item.productId) ?? 0) + item.quantity)
    }

    // ── Outbound in period (OutboundItem) ─────────────────────────────
    const outboundItems = await prisma.outboundItem.findMany({
      where: {
        outbound: {
          createdAt: { gte: start, lte: end },
          ...(warehouseId ? { warehouseId } : {}),
        },
        ...(productId ? { productId } : {}),
        product: { isActive: true, ...(category ? { category } : {}) },
      },
      select: { productId: true, quantity: true },
    })
    const outboundByProduct = new Map<string, number>()
    for (const item of outboundItems) {
      outboundByProduct.set(item.productId, (outboundByProduct.get(item.productId) ?? 0) + item.quantity)
    }

    // ── Sales order items (direct ship not via outbound) ──────────────
    const salesItems = await prisma.salesOrderItem.findMany({
      where: {
        order: {
          status: { in: ['SHIPPED', 'COMPLETED', 'SIGNED'] },
          createdAt: { gte: start, lte: end },
        },
        ...(productId ? { productId } : {}),
        product: { isActive: true, ...(category ? { category } : {}) },
      },
      select: { productId: true, quantity: true },
    })
    // Note: these may overlap with OutboundItems; we treat them separately as "sales dispatch"
    const salesByProduct = new Map<string, number>()
    for (const item of salesItems) {
      salesByProduct.set(item.productId, (salesByProduct.get(item.productId) ?? 0) + item.quantity)
    }

    // ── Build result rows ─────────────────────────────────────────────
    // Union of all products appearing in any of the maps
    const allProductIds = new Set<string>([
      ...inventoryByProduct.keys(),
      ...inboundByProduct.keys(),
      ...outboundByProduct.keys(),
      ...salesByProduct.keys(),
    ])

    // For products not in inventoryByProduct, fetch product info
    const missingIds = [...allProductIds].filter(id => !inventoryByProduct.has(id))
    if (missingIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: missingIds }, isActive: true },
        select: { id: true, name: true, sku: true, category: true, unit: true },
      })
      for (const p of products) {
        inventoryByProduct.set(p.id, { qty: 0, product: p, warehouses: [] })
      }
    }

    const rows = [...allProductIds].map(pid => {
      const inv = inventoryByProduct.get(pid)
      if (!inv) return null
      const closingQty = inv.qty
      const inboundQty = inboundByProduct.get(pid) ?? 0
      const outboundQty = outboundByProduct.get(pid) ?? 0
      // Opening = closing - net inbound + net outbound (from recorded movements)
      const openingQty = Math.max(0, closingQty - inboundQty + outboundQty)
      const netChange = inboundQty - outboundQty
      return {
        productId: pid,
        sku: inv.product.sku,
        name: inv.product.name,
        category: inv.product.category,
        unit: inv.product.unit ?? '件',
        warehouses: inv.warehouses,
        openingQty,
        inboundQty,
        outboundQty,
        netChange,
        closingQty,
        turnoverRate: inboundQty > 0 && openingQty > 0
          ? Math.round((outboundQty / ((openingQty + closingQty) / 2)) * 100) / 100
          : null,
      }
    }).filter(Boolean)

    // Sort by outboundQty desc (most active first)
    rows.sort((a, b) => b!.outboundQty - a!.outboundQty)

    // Summary
    const summary = {
      totalProducts: rows.length,
      totalInbound: rows.reduce((s, r) => s + r!.inboundQty, 0),
      totalOutbound: rows.reduce((s, r) => s + r!.outboundQty, 0),
      totalClosing: rows.reduce((s, r) => s + r!.closingQty, 0),
      zeroStock: rows.filter(r => r!.closingQty <= 0).length,
    }

    return NextResponse.json({ data: rows, summary, period: { start: startStr, end: endStr } })
  } catch (error) {
    return handleApiError(error, 'inventory.movement.GET')
  }
}
