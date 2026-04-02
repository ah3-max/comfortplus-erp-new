import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const transmitStatus = searchParams.get('transmitStatus') ?? ''
  const month = searchParams.get('month') ?? ''         // YYYY-MM
  const invoiceType = searchParams.get('invoiceType') ?? ''  // B2B | B2C
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

  // Build month date range if provided
  let monthFilter = {}
  if (month) {
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0, 23, 59, 59)
    monthFilter = { date: { gte: start, lte: end } }
  }

  const where = {
    ...monthFilter,
    ...(search && {
      OR: [
        { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
        { customerName: { contains: search, mode: 'insensitive' as const } },
        { buyerTaxId: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(status && { status: status as never }),
    ...(transmitStatus && { transmitStatus: transmitStatus as never }),
    ...(invoiceType && { invoiceType: invoiceType as never }),
  }

  const [invoices, total] = await Promise.all([
    prisma.eInvoice.findMany({
      where,
      include: {
        salesInvoice: { select: { id: true, invoiceNumber: true } },
        customer: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.eInvoice.count({ where }),
  ])

  return NextResponse.json({
    data: invoices,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.customerId || !body.invoiceType) {
      return NextResponse.json({ error: '請填寫客戶及發票類型' }, { status: 400 })
    }

    const invoiceNumber = await generateSequenceNo('E_INVOICE')

    const invoice = await prisma.eInvoice.create({
      data: {
        invoiceNumber,
        salesInvoiceId: body.salesInvoiceId || null,
        customerId: body.customerId,
        customerName: body.customerName ?? '',
        invoiceType: body.invoiceType,
        subtotal: Number(body.subtotal ?? 0),
        taxAmount: Number(body.taxAmount ?? 0),
        totalAmount: Number(body.totalAmount ?? 0),
        buyerTaxId: body.buyerTaxId || null,
        buyerName: body.buyerName || null,
        createdById: session.user.id,
      },
      include: {
        salesInvoice: { select: { id: true, invoiceNumber: true } },
        customer: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'e-invoices',
      action: 'CREATE',
      entityType: 'EInvoice',
      entityId: invoice.id,
      entityLabel: invoiceNumber,
    }).catch(() => {})

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'e-invoices.POST')
  }
}
