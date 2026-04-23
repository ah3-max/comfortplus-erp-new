import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()

    const before = await prisma.user.findUnique({
      where: { id },
      select: { name: true, role: true, isActive: true, email: true },
    })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {
      name: body.name,
      role: body.role,
      isActive: body.isActive,
    }

    if (body.password) {
      data.password = await bcrypt.hash(body.password, 12)
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    })

    const changes: Record<string, { before: unknown; after: unknown }> = {}
    if (before.role !== user.role) changes.role = { before: before.role, after: user.role }
    if (before.isActive !== user.isActive) changes.isActive = { before: before.isActive, after: user.isActive }
    if (before.name !== user.name) changes.name = { before: before.name, after: user.name }
    if (body.password) changes.password = { before: '***', after: '*** (changed)' }

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'users',
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      entityLabel: `${user.name} <${user.email}>`,
      changes,
    }).catch(() => {})

    return NextResponse.json(user)
  } catch (error) {
    return handleApiError(error, 'users.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    // Cannot deactivate yourself
    if (id === session.user.id) {
      return NextResponse.json({ error: '無法停用自己的帳號' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (target.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: '無法停用超級管理員帳號' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'users',
      action: 'DEACTIVATE',
      entityType: 'User',
      entityId: id,
      entityLabel: `${user.name} <${user.email}>`,
      changes: { isActive: { before: true, after: false } },
    }).catch(() => {})

    return NextResponse.json(user)
  } catch (error) {
    return handleApiError(error, 'users.delete')
  }
}
