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
    const voidReason: string = body.voidReason ?? ''

    const invoice = await prisma.eInvoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (invoice.status === 'VOIDED') {
      return NextResponse.json({ error: '發票已作廢' }, { status: 400 })
    }
    if (invoice.status === 'CREDIT_NOTE') {
      return NextResponse.json({ error: '已開立折讓的發票無法作廢' }, { status: 400 })
    }
    if (invoice.transmitStatus === 'TRANSMITTED') {
      return NextResponse.json({ error: '已傳送的發票無法作廢，請洽財政部系統' }, { status: 400 })
    }

    const updated = await prisma.eInvoice.update({
      where: { id },
      data: {
        status: 'VOIDED',
        voidReason: voidReason || null,
        voidedAt: new Date(),
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'e-invoices',
      action: 'VOID',
      entityType: 'EInvoice',
      entityId: id,
      entityLabel: invoice.invoiceNumber,
      changes: voidReason
        ? { voidReason: { before: invoice.voidReason ?? null, after: voidReason } }
        : undefined,
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'e-invoices.void')
  }
}
