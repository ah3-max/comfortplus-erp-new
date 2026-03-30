import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const asOf = new Date()

    // ── ASSETS ──
    // 1. Cash (payments received - payments made, simplified)
    const [totalReceived, totalDisbursed] = await Promise.all([
      prisma.receiptRecord.aggregate({ _sum: { amount: true } }),
      prisma.disbursementRecord.aggregate({ _sum: { amount: true } }),
    ])
    const cashEstimate = Number(totalReceived._sum.amount ?? 0) - Number(totalDisbursed._sum.amount ?? 0)

    // 2. Accounts Receivable (outstanding)
    const arData = await prisma.accountsReceivable.findMany({
      where: { status: { in: ['NOT_DUE', 'DUE', 'PARTIAL_PAID'] } },
      select: { amount: true, paidAmount: true },
    })
    const arBalance = arData.reduce((s, ar) => s + Number(ar.amount) - Number(ar.paidAmount), 0)
    const arTotal = arData.reduce((s, ar) => s + Number(ar.amount), 0)
    const arPaid = arData.reduce((s, ar) => s + Number(ar.paidAmount), 0)

    // 3. Inventory (current quantity × last known cost from costStructure or costPrice)
    const inventoryItems = await prisma.inventory.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        product: {
          select: {
            costPrice: true,
            costStructure: { select: { totalCost: true } },
          },
        },
      },
    })
    const inventoryValue = inventoryItems.reduce((s, inv) => {
      const unitCost = Number(inv.product.costStructure?.totalCost ?? inv.product.costPrice)
      return s + inv.quantity * unitCost
    }, 0)
    const inventoryQty = inventoryItems.reduce((s, inv) => s + inv.quantity, 0)

    // 4. Sales Invoices outstanding (not yet in AR, confirmed but not paid)
    const invoicesOutstanding = await prisma.salesInvoice.aggregate({
      where: { status: { in: ['CONFIRMED', 'SHIPPED'] } },
      _sum: { totalAmount: true },
      _count: true,
    })

    // ── LIABILITIES ──
    // Accounts Payable outstanding
    const apData = await prisma.accountsPayable.findMany({
      where: { status: { in: ['NOT_DUE', 'DUE', 'PARTIAL_PAID'] } },
      select: { amount: true, paidAmount: true },
    })
    const apBalance = apData.reduce((s, ap) => s + Number(ap.amount) - Number(ap.paidAmount), 0)

    // ── SUMMARY ──
    const totalCurrentAssets = Math.max(0, cashEstimate) + arBalance + inventoryValue
    const totalAssets = totalCurrentAssets

    const totalCurrentLiabilities = apBalance
    const totalLiabilities = totalCurrentLiabilities

    const equity = totalAssets - totalLiabilities

    return NextResponse.json({
      asOf: asOf.toISOString(),
      assets: {
        current: {
          cash: Math.max(0, cashEstimate),
          accountsReceivable: { balance: arBalance, total: arTotal, paid: arPaid, count: arData.length },
          inventory: { value: inventoryValue, quantity: inventoryQty, items: inventoryItems.length },
          salesInvoicesOutstanding: {
            amount: Number(invoicesOutstanding._sum.totalAmount ?? 0),
            count: invoicesOutstanding._count,
          },
          total: totalCurrentAssets,
        },
        total: totalAssets,
      },
      liabilities: {
        current: {
          accountsPayable: { balance: apBalance, count: apData.length },
          total: totalCurrentLiabilities,
        },
        total: totalLiabilities,
      },
      equity: {
        estimated: equity,
        note: '此為由現有資料推算之估計值，不含折舊、攤銷等會計調整。',
      },
    })
  } catch (error) {
    return handleApiError(error, 'finance.balance-sheet.GET')
  }
}
