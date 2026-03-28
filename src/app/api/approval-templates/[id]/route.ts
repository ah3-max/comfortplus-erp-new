import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()

    // Toggle isActive or update fields
    if (body.action === 'TOGGLE') {
      const current = await prisma.approvalTemplate.findUnique({ where: { id } })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const updated = await prisma.approvalTemplate.update({
        where: { id },
        data: { isActive: !current.isActive },
      })
      return NextResponse.json(updated)
    }

    const { name, description, module, steps } = body
    const template = await prisma.$transaction(async (tx) => {
      await tx.approvalTemplateStep.deleteMany({ where: { templateId: id } })
      return tx.approvalTemplate.update({
        where: { id },
        data: {
          name,
          description: description || null,
          module,
          steps: {
            create: (steps as { stepName: string; approverRole: string; isOptional?: boolean }[]).map((s, i) => ({
              stepOrder: i + 1,
              stepName: s.stepName,
              approverRole: s.approverRole,
              isOptional: s.isOptional ?? false,
            })),
          },
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      })
    })

    return NextResponse.json(template)
  } catch (error) {
    return handleApiError(error, 'approval-templates.PUT')
  }
}
