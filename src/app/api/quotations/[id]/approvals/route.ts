import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const approvals = await prisma.quotationApproval.findMany({
    where: { quotationId: id },
    orderBy: { approvalLevel: 'asc' },
    include: {
      approver: {
        select: { id: true, name: true, role: true },
      },
    },
  })

  return NextResponse.json(approvals)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json() as { action: 'APPROVE' | 'REJECT'; comment?: string }

  if (!body.action || !['APPROVE', 'REJECT'].includes(body.action)) {
    return NextResponse.json({ error: '請選擇審批動作 (APPROVE 或 REJECT)' }, { status: 400 })
  }

  // Fetch current user's role
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (!currentUser) {
    return NextResponse.json({ error: '找不到使用者' }, { status: 404 })
  }

  const userRole = currentUser.role as string

  // Find the current pending step (lowest approvalLevel first)
  const pendingStep = await prisma.quotationApproval.findFirst({
    where: { quotationId: id, status: 'PENDING' },
    orderBy: { approvalLevel: 'asc' },
  })

  if (!pendingStep) {
    return NextResponse.json({ error: '無待審批步驟' }, { status: 400 })
  }

  // Authorization check: must match role, or be SUPER_ADMIN, or GM can approve any level
  const canDecide =
    userRole === pendingStep.approverRole ||
    userRole === 'SUPER_ADMIN' ||
    userRole === 'GM'

  if (!canDecide) {
    return NextResponse.json({ error: '您沒有此步驟的審批權限' }, { status: 403 })
  }

  const updatedStep = await prisma.$transaction(async (tx) => {
    // Update this step
    const updated = await tx.quotationApproval.update({
      where: { id: pendingStep.id },
      data: {
        status: body.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approverId: session.user.id,
        decidedAt: new Date(),
        comment: body.comment || null,
      },
      include: {
        approver: {
          select: { id: true, name: true, role: true },
        },
      },
    })

    if (body.action === 'REJECT') {
      // Mark remaining PENDING steps as SKIPPED
      await tx.quotationApproval.updateMany({
        where: { quotationId: id, status: 'PENDING' },
        data: { status: 'SKIPPED' },
      })

      // Update quotation to REJECTED
      await tx.quotation.update({
        where: { id },
        data: {
          approvalStatus: 'REJECTED',
          status: 'REJECTED',
        },
      })
    } else {
      // APPROVED — check if there is another PENDING step
      const nextStep = await tx.quotationApproval.findFirst({
        where: { quotationId: id, status: 'PENDING' },
        orderBy: { approvalLevel: 'asc' },
      })

      if (nextStep) {
        // Keep quotation as PENDING_APPROVAL (next level takes over)
        // No change needed
      } else {
        // All levels approved — update quotation to APPROVED
        await tx.quotation.update({
          where: { id },
          data: {
            approvalStatus: 'APPROVED',
            status: 'APPROVED',
            approvedById: session.user.id,
          },
        })
      }
    }

    return updated
  })

  return NextResponse.json(updatedStep)
}
