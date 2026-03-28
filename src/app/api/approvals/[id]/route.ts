import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const record = await prisma.approvalRequest.findUnique({
    where: { id },
    include: {
      requestedBy: { select: { id: true, name: true } },
      template: { select: { id: true, name: true, module: true } },
      steps: {
        include: { approver: { select: { id: true, name: true } } },
        orderBy: { stepOrder: 'asc' },
      },
    },
  })

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(record)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const request = await prisma.approvalRequest.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const role = (session.user as { role?: string }).role ?? ''

    // APPROVE or REJECT a step
    if (body.action === 'APPROVE' || body.action === 'REJECT') {
      if (request.status !== 'PENDING') {
        return NextResponse.json({ error: '此簽核申請已完成或取消' }, { status: 400 })
      }

      const currentStepRecord = request.steps.find(s => s.stepOrder === request.currentStep)
      if (!currentStepRecord) return NextResponse.json({ error: '找不到當前步驟' }, { status: 400 })

      // Check permission: approver or admin
      const isAdmin = ['SUPER_ADMIN', 'GM'].includes(role)
      if (!isAdmin && currentStepRecord.approverId && currentStepRecord.approverId !== session.user.id) {
        return NextResponse.json({ error: '您不是指定簽核人' }, { status: 403 })
      }

      await prisma.$transaction(async (tx) => {
        // Update this step
        await tx.approvalStep.update({
          where: { id: currentStepRecord.id },
          data: {
            status: body.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            action: body.action,
            comment: body.comment || null,
            approverId: session.user.id,
            actedAt: new Date(),
          },
        })

        if (body.action === 'REJECT') {
          // Reject whole request
          await tx.approvalRequest.update({
            where: { id },
            data: { status: 'REJECTED', completedAt: new Date() },
          })
        } else {
          // Check if there is a next step
          const nextStep = request.steps.find(s => s.stepOrder === request.currentStep + 1)
          if (nextStep) {
            await tx.approvalRequest.update({
              where: { id },
              data: { currentStep: request.currentStep + 1 },
            })
          } else {
            // All steps done → APPROVED
            await tx.approvalRequest.update({
              where: { id },
              data: { status: 'APPROVED', completedAt: new Date() },
            })
          }
        }
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: role,
        module: 'approvals',
        action: body.action,
        entityType: 'ApprovalRequest',
        entityId: id,
        entityLabel: request.requestNo,
        changes: { comment: { before: '', after: body.comment ?? '' } },
      }).catch(() => {})

      return NextResponse.json({ success: true })
    }

    // CANCEL
    if (body.action === 'CANCEL') {
      if (request.status === 'APPROVED') {
        return NextResponse.json({ error: '已批准的申請無法取消' }, { status: 400 })
      }
      const isOwner = request.requestedById === session.user.id
      const isAdmin = ['SUPER_ADMIN', 'GM'].includes(role)
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: '權限不足' }, { status: 403 })
      }
      await prisma.approvalRequest.update({
        where: { id },
        data: { status: 'CANCELLED', completedAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'approvals.PUT')
  }
}
