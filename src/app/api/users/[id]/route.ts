import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

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

  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  return NextResponse.json(user)
}
