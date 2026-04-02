import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

// ── GET /api/credit-debit-notes ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const noteType   = searchParams.get('noteType')   // CREDIT / DEBIT
    const direction  = searchParams.get('direction')   // CUSTOMER / SUPPLIER
    const status     = searchParams.get('status')
    const page       = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize   = Math.min(100, Number(searchParams.get('pageSize') ?? 20))

    const where = {
      ...(noteType  && { noteType }),
      ...(direction && { direction }),
      ...(status    && { status }),
    }

    const [data, total] = await Promise.all([
      prisma.creditDebitNote.findMany({
        where,
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.creditDebitNote.count({ where }),
    ])

    return NextResponse.json({ data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } })
  } catch (error) {
    return handleApiError(error, 'credit-debit-notes.GET')
  }
}

// ── POST /api/credit-debit-notes ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { noteType, direction, customerId, supplierId, originalInvoiceNo,
            salesOrderId, purchaseOrderId, amount, taxAmount, reason, notes } = body

    if (!noteType || !direction || !amount || !reason) {
      return NextResponse.json({ error: '類型、方向、金額、原因為必填' }, { status: 400 })
    }

    const noteNo = await generateSequenceNo('JOURNAL_ENTRY') // reuse or create CDN sequence
    const totalAmount = Number(amount) + Number(taxAmount ?? 0)

    const record = await prisma.creditDebitNote.create({
      data: {
        noteNo: `CDN${noteNo.slice(2)}`, // CDN prefix
        noteType,
        direction,
        customerId:        customerId ?? null,
        supplierId:        supplierId ?? null,
        originalInvoiceNo: originalInvoiceNo ?? null,
        salesOrderId:      salesOrderId ?? null,
        purchaseOrderId:   purchaseOrderId ?? null,
        amount:            Number(amount),
        taxAmount:         taxAmount ? Number(taxAmount) : null,
        totalAmount,
        reason,
        notes: notes ?? null,
        createdById:       session.user.id,
      },
    })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'credit-debit-notes', action: 'CREATE',
      entityType: 'CreditDebitNote', entityId: record.id, entityLabel: record.noteNo,
    }).catch(() => {})

    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'credit-debit-notes.POST')
  }
}
