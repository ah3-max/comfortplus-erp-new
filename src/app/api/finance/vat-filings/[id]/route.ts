import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { status, taxAuthRef, filedAt, paidAt, notes } = body

    const record = await prisma.vatFiling.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(taxAuthRef !== undefined && { taxAuthRef }),
        ...(filedAt !== undefined && { filedAt: filedAt ? new Date(filedAt) : null }),
        ...(paidAt !== undefined && { paidAt: paidAt ? new Date(paidAt) : null }),
        ...(notes !== undefined && { notes }),
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'vat-filings',
      action: 'UPDATE',
      entityType: 'VatFiling',
      entityId: id,
      entityLabel: `${record.filingNo} → ${status ?? record.status}`,
    }).catch(() => {})

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'vat-filings.[id].PUT')
  }
}
