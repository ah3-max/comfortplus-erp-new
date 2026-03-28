import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await prisma.department.findMany({
      include: {
        manager: { select: { name: true } },
        _count: { select: { users: true } },
      },
      orderBy: { code: 'asc' },
    })
    return NextResponse.json(data)
  } catch (error) {
    return handleApiError(error, 'departments.GET')
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
    const { code, name, parentId, managerId } = body

    if (!code || !name) {
      return NextResponse.json({ error: '部門代碼和名稱為必填' }, { status: 400 })
    }

    const dept = await prisma.department.create({
      data: {
        code,
        name,
        parentId: parentId || null,
        managerId: managerId || null,
      },
    })

    return NextResponse.json(dept, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'departments.POST')
  }
}
