import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createAutoJournal } from '@/lib/auto-journal'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/finance/auto-journal
 * Returns documents that are missing auto journal entries.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') ?? 'pending'

    if (view === 'recent') {
      const entries = await prisma.journalEntry.findMany({
        where: { entryType: 'AUTO' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, entryNo: true, entryDate: true, description: true,
          status: true, totalDebit: true, totalCredit: true,
          referenceType: true, referenceId: true, createdAt: true,
        },
      })
      return NextResponse.json({ entries })
    }

    // IDs already journalized
    const [journalizedSO, journalizedPO] = await Promise.all([
      prisma.journalEntry.findMany({
        where: { referenceType: 'SalesOrder', entryType: 'AUTO' },
        select: { referenceId: true },
      }),
      prisma.journalEntry.findMany({
        where: { referenceType: 'PurchaseOrder', entryType: 'AUTO' },
        select: { referenceId: true },
      }),
    ])
    const soIds = journalizedSO.map(e => e.referenceId!).filter(Boolean)
    const poIds = journalizedPO.map(e => e.referenceId!).filter(Boolean)

    const [salesOrders, purchaseOrders] = await Promise.all([
      prisma.salesOrder.findMany({
        where: {
          status: { in: ['CONFIRMED', 'PARTIAL_SHIPPED', 'SHIPPED', 'COMPLETED'] },
          ...(soIds.length > 0 ? { NOT: { id: { in: soIds } } } : {}),
        },
        select: {
          id: true, orderNo: true, totalAmount: true, status: true, createdAt: true,
          customerId: true,
          customer: { select: { name: true, type: true } },
          costOfGoods: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.purchaseOrder.findMany({
        where: {
          status: { in: ['RECEIVED', 'INSPECTED', 'WAREHOUSED', 'CLOSED'] },
          ...(poIds.length > 0 ? { NOT: { id: { in: poIds } } } : {}),
        },
        select: {
          id: true, poNo: true, totalAmount: true, status: true, createdAt: true,
          supplierId: true,
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    return NextResponse.json({
      pending: {
        salesOrders: salesOrders.map(o => ({
          id: o.id,
          refNo: o.orderNo,
          type: 'SalesOrder',
          amount: Number(o.totalAmount),
          cogAmount: o.costOfGoods ? Number(o.costOfGoods) : 0,
          party: o.customer.name,
          customerType: String(o.customer.type).startsWith('B2C') ? 'B2C' : 'B2B',
          date: o.createdAt,
          status: o.status,
        })),
        purchaseOrders: purchaseOrders.map(o => ({
          id: o.id,
          refNo: o.poNo,
          type: 'PurchaseOrder',
          amount: Number(o.totalAmount),
          party: o.supplier.name,
          date: o.createdAt,
          status: o.status,
        })),
      },
      counts: {
        salesOrders: salesOrders.length,
        purchaseOrders: purchaseOrders.length,
      },
    })
  } catch (error) {
    return handleApiError(error, 'finance.auto-journal.GET')
  }
}

/**
 * POST /api/finance/auto-journal
 * Body: { type: 'SalesOrder' | 'PurchaseOrder' | 'ALL', ids?: string[] }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { type, ids } = body as { type: 'SalesOrder' | 'PurchaseOrder' | 'ALL'; ids?: string[] }

    const results: { id: string; refNo: string; journalId: string | null; skipped: boolean }[] = []

    if (type === 'SalesOrder' || type === 'ALL') {
      const where = ids
        ? { id: { in: ids } }
        : { status: { in: ['CONFIRMED', 'PARTIAL_SHIPPED', 'SHIPPED', 'COMPLETED'] as ('CONFIRMED' | 'PARTIAL_SHIPPED' | 'SHIPPED' | 'COMPLETED')[] } }

      const orders = await prisma.salesOrder.findMany({
        where,
        select: {
          id: true, orderNo: true, totalAmount: true, createdAt: true,
          customer: { select: { name: true, type: true } },
          costOfGoods: true,
        },
        take: 200,
      })

      for (const o of orders) {
        const taxBase = Math.round(Number(o.totalAmount) / 1.05)
        const tax = Number(o.totalAmount) - taxBase
        const journalId = await createAutoJournal({
          type: 'SALES_CONFIRM',
          referenceType: 'SalesOrder',
          referenceId: o.id,
          entryDate: new Date(o.createdAt),
          description: `銷貨確認—${o.orderNo}（${o.customer.name}）`,
          amount: taxBase,
          taxAmount: tax,
          cogAmount: o.costOfGoods ? Number(o.costOfGoods) : 0,
          createdById: session.user.id,
          customerType: String(o.customer.type).startsWith('B2C') ? 'B2C' : 'B2B',
        })
        results.push({ id: o.id, refNo: o.orderNo, journalId, skipped: journalId === null })
      }
    }

    if (type === 'PurchaseOrder' || type === 'ALL') {
      const where = ids
        ? { id: { in: ids } }
        : { status: { in: ['RECEIVED', 'INSPECTED', 'WAREHOUSED', 'CLOSED'] as ('RECEIVED' | 'INSPECTED' | 'WAREHOUSED' | 'CLOSED')[] } }

      const orders = await prisma.purchaseOrder.findMany({
        where,
        select: {
          id: true, poNo: true, totalAmount: true, createdAt: true,
          supplier: { select: { name: true } },
        },
        take: 200,
      })

      for (const o of orders) {
        const taxBase = Math.round(Number(o.totalAmount) / 1.05)
        const tax = Number(o.totalAmount) - taxBase
        const journalId = await createAutoJournal({
          type: 'PURCHASE_RECEIVE',
          referenceType: 'PurchaseOrder',
          referenceId: o.id,
          entryDate: new Date(o.createdAt),
          description: `進貨確認—${o.poNo}（${o.supplier.name}）`,
          amount: taxBase,
          taxAmount: tax,
          createdById: session.user.id,
        })
        results.push({ id: o.id, refNo: o.poNo, journalId, skipped: journalId === null })
      }
    }

    const created = results.filter(r => r.journalId !== null && !r.skipped).length
    const skipped = results.filter(r => r.skipped).length

    return NextResponse.json({ ok: true, created, skipped, results })
  } catch (error) {
    return handleApiError(error, 'finance.auto-journal.POST')
  }
}
