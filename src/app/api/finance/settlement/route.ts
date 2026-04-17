import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { createAutoJournal } from '@/lib/auto-journal'
import { assertPeriodOpen } from '@/lib/period-guard'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

interface SettlementItemInput {
  arId?: string
  apId?: string
  amount: number
}

/**
 * GET /api/finance/settlement — list settlement batches
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20)))
    const direction = searchParams.get('direction') || undefined
    const customerId = searchParams.get('customerId') || undefined
    const supplierId = searchParams.get('supplierId') || undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined

    const where = {
      ...(direction && { direction: direction as 'INCOMING' | 'OUTGOING' }),
      ...(customerId && { customerId }),
      ...(supplierId && { supplierId }),
      ...(dateFrom || dateTo ? {
        paymentDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo + 'T23:59:59') }),
        },
      } : {}),
    }

    const [data, total] = await Promise.all([
      prisma.settlementBatch.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, code: true } },
          supplier: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.settlementBatch.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'finance.settlement.GET')
  }
}

/**
 * POST /api/finance/settlement — execute a settlement batch
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role ?? ''
  if (!FINANCE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      direction, customerId, supplierId,
      paymentDate, paymentMethod, bankAccountId, referenceNo, notes,
      items,
    } = body as {
      direction: 'INCOMING' | 'OUTGOING'
      customerId?: string; supplierId?: string
      paymentDate: string; paymentMethod?: string
      bankAccountId?: string; referenceNo?: string; notes?: string
      items: SettlementItemInput[]
    }

    // Validations
    if (!direction || !paymentDate || !items?.length) {
      return NextResponse.json({ error: '缺少必填欄位（direction, paymentDate, items）' }, { status: 400 })
    }
    if (direction === 'INCOMING' && !customerId) {
      return NextResponse.json({ error: '收款沖帳需指定客戶' }, { status: 400 })
    }
    if (direction === 'OUTGOING' && !supplierId) {
      return NextResponse.json({ error: '付款沖帳需指定供應商' }, { status: 400 })
    }

    const pDate = new Date(paymentDate)
    await assertPeriodOpen(pDate)

    const totalAmount = items.reduce((s, i) => s + Number(i.amount), 0)
    if (totalAmount <= 0) {
      return NextResponse.json({ error: '沖帳合計金額需大於零' }, { status: 400 })
    }

    // Validate each item amount against AR/AP balance
    for (const item of items) {
      if (Number(item.amount) <= 0) {
        return NextResponse.json({ error: '每筆沖帳金額需大於零' }, { status: 400 })
      }

      if (direction === 'INCOMING' && item.arId) {
        const ar = await prisma.accountsReceivable.findUnique({ where: { id: item.arId } })
        if (!ar) return NextResponse.json({ error: `找不到應收帳款 ${item.arId}` }, { status: 404 })
        const balance = Number(ar.amount) - Number(ar.paidAmount)
        if (Number(item.amount) > balance + 0.01) {
          return NextResponse.json({ error: `沖帳金額 ${item.amount} 超過餘額 ${balance.toFixed(0)}（發票 ${ar.invoiceNo ?? ar.id}）` }, { status: 400 })
        }
      }
      if (direction === 'OUTGOING' && item.apId) {
        const ap = await prisma.accountsPayable.findUnique({ where: { id: item.apId } })
        if (!ap) return NextResponse.json({ error: `找不到應付帳款 ${item.apId}` }, { status: 404 })
        const balance = Number(ap.amount) - Number(ap.paidAmount)
        if (Number(item.amount) > balance + 0.01) {
          return NextResponse.json({ error: `沖帳金額 ${item.amount} 超過餘額 ${balance.toFixed(0)}` }, { status: 400 })
        }
      }
    }

    // Execute in transaction
    const batchNo = await generateSequenceNo('SETTLEMENT')

    const batch = await prisma.$transaction(async (tx) => {
      // 1. Create batch
      const created = await tx.settlementBatch.create({
        data: {
          batchNo,
          direction,
          customerId: customerId || null,
          supplierId: supplierId || null,
          totalAmount,
          paymentDate: pDate,
          paymentMethod: paymentMethod || null,
          bankAccountId: bankAccountId || null,
          referenceNo: referenceNo || null,
          notes: notes || null,
          createdById: session.user.id,
        },
      })

      // 2. Create items and update AR/AP
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        await tx.settlementItem.create({
          data: {
            batchId: created.id,
            arId: item.arId || null,
            apId: item.apId || null,
            amount: Number(item.amount),
            lineNo: i + 1,
          },
        })

        if (direction === 'INCOMING' && item.arId) {
          // Create ReceiptRecord
          await tx.receiptRecord.create({
            data: {
              arId: item.arId,
              customerId: customerId!,
              receiptDate: pDate,
              receiptMethod: paymentMethod || 'TRANSFER',
              amount: Number(item.amount),
              bankLast5: referenceNo?.slice(-5) || null,
              reconcileStatus: 'MATCHED',
              notes: `沖帳批號 ${batchNo}`,
              createdById: session.user.id,
            },
          })

          // Update AR
          const ar = await tx.accountsReceivable.findUnique({ where: { id: item.arId } })
          if (ar) {
            const newPaid = Number(ar.paidAmount) + Number(item.amount)
            const newStatus = newPaid >= Number(ar.amount) ? 'PAID' : 'PARTIAL_PAID'
            await tx.accountsReceivable.update({
              where: { id: item.arId },
              data: { paidAmount: newPaid, status: newStatus },
            })
            // Sync SalesOrder.paidAmount
            if (ar.orderId) {
              await tx.salesOrder.update({
                where: { id: ar.orderId },
                data: { paidAmount: { increment: Number(item.amount) } },
              })
            }
          }
        }

        if (direction === 'OUTGOING' && item.apId) {
          // Create DisbursementRecord
          await tx.disbursementRecord.create({
            data: {
              apId: item.apId,
              paymentDate: pDate,
              paymentMethod: paymentMethod || 'T/T',
              amount: Number(item.amount),
              notes: `沖帳批號 ${batchNo}`,
              createdById: session.user.id,
            },
          })

          // Update AP
          const ap = await tx.accountsPayable.findUnique({ where: { id: item.apId } })
          if (ap) {
            const newPaid = Number(ap.paidAmount) + Number(item.amount)
            const newStatus = newPaid >= Number(ap.amount) ? 'PAID' : 'PARTIAL_PAID'
            await tx.accountsPayable.update({
              where: { id: item.apId },
              data: { paidAmount: newPaid, status: newStatus },
            })
            // Sync PurchaseOrder.paidAmount
            if (ap.purchaseOrderId) {
              await tx.purchaseOrder.update({
                where: { id: ap.purchaseOrderId },
                data: { paidAmount: { increment: Number(item.amount) } },
              })
            }
          }
        }
      }

      return created
    })

    // Auto-journal (outside transaction — idempotent)
    const journalType = direction === 'INCOMING' ? 'PAYMENT_IN' : 'PAYMENT_OUT'
    const partyName = direction === 'INCOMING'
      ? (await prisma.customer.findUnique({ where: { id: customerId! }, select: { name: true } }))?.name ?? ''
      : (await prisma.supplier.findUnique({ where: { id: supplierId! }, select: { name: true } }))?.name ?? ''

    createAutoJournal({
      type: journalType,
      referenceType: 'SETTLEMENT',
      referenceId: batch.id,
      entryDate: pDate,
      description: `沖帳 ${batchNo} — ${partyName}`,
      amount: totalAmount,
      taxAmount: 0,
      createdById: session.user.id,
    }).catch(() => {})

    // Audit
    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'finance.settlement',
      action: 'CREATE',
      entityType: 'SettlementBatch',
      entityId: batch.id,
      entityLabel: `${batchNo} ${partyName} $${totalAmount.toLocaleString()}`,
    }).catch(() => {})

    return NextResponse.json(batch, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'finance.settlement.POST')
  }
}
