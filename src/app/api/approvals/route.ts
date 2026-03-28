import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') || 'mine'   // 'mine' | 'pending' | 'all'
    const status = searchParams.get('status') || ''
    const module = searchParams.get('module') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

    const userId = session.user.id
    const role = (session.user as { role?: string }).role ?? ''

    let where: Record<string, unknown> = {}
    if (view === 'mine') {
      // Requests I submitted
      where = { requestedById: userId }
    } else if (view === 'pending') {
      // Steps assigned to me (or my role) that are PENDING
      where = {
        steps: {
          some: {
            status: 'PENDING',
            OR: [
              { approverId: userId },
              { approverId: null },
            ],
          },
        },
        status: 'PENDING',
      }
    } else if (['SUPER_ADMIN', 'GM'].includes(role)) {
      // Admin sees all
    }

    if (status) where = { ...where, status }
    if (module) where = { ...where, module }

    const [total, data] = await Promise.all([
      prisma.approvalRequest.count({ where }),
      prisma.approvalRequest.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, name: true } },
          steps: {
            include: { approver: { select: { id: true, name: true } } },
            orderBy: { stepOrder: 'asc' },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'approvals.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { templateId, module, entityId, entityLabel, notes } = body

    if (!module || !entityId || !entityLabel) {
      return NextResponse.json({ error: '請填寫模組、單據及標題' }, { status: 400 })
    }

    const requestNo = await generateSequenceNo('APPROVAL_REQUEST')

    // If templateId provided, copy steps from template
    let stepData: { stepOrder: number; stepName: string; approverId?: string }[] = []
    if (templateId) {
      const template = await prisma.approvalTemplate.findUnique({
        where: { id: templateId },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      })
      if (template) {
        stepData = template.steps.map(s => ({
          stepOrder: s.stepOrder,
          stepName: s.stepName,
        }))
      }
    }

    // Fallback: one default step for GM
    if (!stepData.length) {
      stepData = [{ stepOrder: 1, stepName: '主管核准' }]
    }

    const record = await prisma.approvalRequest.create({
      data: {
        requestNo,
        templateId: templateId || null,
        module,
        entityId,
        entityLabel,
        notes: notes || null,
        requestedById: session.user.id,
        status: 'PENDING',
        currentStep: 1,
        steps: { create: stepData },
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'approvals.POST')
  }
}
