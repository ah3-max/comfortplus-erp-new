import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/inventory/lots/refresh-expiry
 * Recalculates daysToExpiry, isNearExpiry, isExpired for all active lots with expiryDate.
 * Safe to call from cron or manually from UI.
 */
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER', 'WAREHOUSE', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    return await refreshExpiryStatus()
  } catch (error) {
    return handleApiError(error, 'lots.refresh-expiry.POST')
  }
}

export async function refreshExpiryStatus() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Get warehouse picking strategy for near-expiry threshold
  const strategy = await prisma.warehousePickingStrategy.findFirst({
    select: { expiryAlertDays: true },
  })
  const alertDays = strategy?.expiryAlertDays ?? 90

  // Get all lots with expiryDate that are not scrapped/sold
  const lots = await prisma.inventoryLot.findMany({
    where: {
      expiryDate: { not: null },
      status: { not: 'SCRAPPED' },
    },
    select: { id: true, expiryDate: true },
  })

  let updated = 0

  // Batch update in groups of 50
  for (const lot of lots) {
    if (!lot.expiryDate) continue
    const expiryMs = new Date(lot.expiryDate).setHours(0, 0, 0, 0)
    const daysToExpiry = Math.floor((expiryMs - now.getTime()) / 86400000)
    const isExpired = daysToExpiry < 0
    const isNearExpiry = !isExpired && daysToExpiry <= alertDays

    await prisma.inventoryLot.update({
      where: { id: lot.id },
      data: { daysToExpiry, isExpired, isNearExpiry },
    })
    updated++
  }

  return NextResponse.json({ updated, alertDays })
}
