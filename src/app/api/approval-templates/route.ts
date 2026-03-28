import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const module = searchParams.get('module') || ''

    const templates = await prisma.approvalTemplate.findMany({
      where: {
        ...(module && { module }),
        isActive: true,
      },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(templates)
  } catch (error) {
    return handleApiError(error, 'approval-templates.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, description, module, steps } = body

    if (!name || !module || !steps?.length) {
      return NextResponse.json({ error: '請填寫名稱、模組及步驟' }, { status: 400 })
    }

    const template = await prisma.approvalTemplate.create({
      data: {
        name,
        description: description || null,
        module,
        createdById: session.user.id,
        steps: {
          create: steps.map((s: { stepName: string; approverRole: string; isOptional?: boolean }, i: number) => ({
            stepOrder: i + 1,
            stepName: s.stepName,
            approverRole: s.approverRole,
            isOptional: s.isOptional ?? false,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'approval-templates.POST')
  }
}
