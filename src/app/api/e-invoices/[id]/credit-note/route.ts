import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { creditNoteNumber, creditNoteDate, creditNoteAmount } = body

    if (!creditNoteNumber) {
      return NextResponse.json({ error: '請填寫折讓證明單號碼' }, { status: 400 })
    }
    if (!creditNoteAmount || Number(creditNoteAmount) <= 0) {
      return NextResponse.json({ error: '請填寫折讓金額' }, { status: 400 })
    }

    const invoice = await prisma.eInvoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (invoice.status === 'VOIDED') {
      return NextResponse.json({ error: '已作廢的發票無法開立折讓' }, { status: 400 })
    }
    if (invoice.status === 'CREDIT_NOTE') {
      return NextResponse.json({ error: '該發票已有折讓記錄' }, { status: 400 })
    }
    if (!['APPROVED', 'CREATED'].includes(invoice.status)) {
      return NextResponse.json({ error: '只能對有效發票開立折讓' }, { status: 400 })
    }

    // 折讓金額不可超過發票含稅金額
    if (Number(creditNoteAmount) > Number(invoice.totalAmount)) {
      return NextResponse.json({
        error: `折讓金額 (${Number(creditNoteAmount)}) 不可超過發票金額 (${Number(invoice.totalAmount)})`,
      }, { status: 400 })
    }

    const updated = await prisma.eInvoice.update({
      where: { id },
      data: {
        status: 'CREDIT_NOTE',
        creditNoteNumber,
        creditNoteDate: creditNoteDate ? new Date(creditNoteDate) : new Date(),
        creditNoteAmount: Number(creditNoteAmount),
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'e-invoices',
      action: 'CREDIT_NOTE',
      entityType: 'EInvoice',
      entityId: id,
      entityLabel: `${invoice.invoiceNumber} → ${creditNoteNumber}`,
      changes: {
        creditNoteNumber: { before: null, after: creditNoteNumber },
        creditNoteAmount: { before: null, after: Number(creditNoteAmount) },
      },
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'e-invoices.credit-note')
  }
}
