import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(users)
  } catch (error) {
    return handleApiError(error, 'users.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { email, name, password, role } = body

    if (!email || !name || !password || !role) {
      return NextResponse.json({ error: '請填寫所有必填欄位' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: '此 Email 已被使用' }, { status: 400 })

    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, name, password: hashed, role },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'users.create')
  }
}
