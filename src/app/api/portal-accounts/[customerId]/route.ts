import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import bcrypt from 'bcryptjs'

const CAN_MANAGE = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER']
const SUPER_ADMIN_ONLY = ['SUPER_ADMIN']

type Params = { params: Promise<{ customerId: string }> }

// GET /api/portal-accounts/[customerId]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!CAN_MANAGE.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { customerId } = await params
    const account = await prisma.portalAccount.findUnique({
      where: { customerId },
      select: {
        id: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        googleId: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ data: account })
  } catch (error) {
    return handleApiError(error, 'portal-accounts.get')
  }
}

// POST /api/portal-accounts/[customerId] — 開通帳號
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!CAN_MANAGE.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { customerId } = await params
    const body = await req.json()

    if (!body.email?.trim()) {
      return NextResponse.json({ error: 'Email 為必填' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 })
    }
    if (!body.password || body.password.length < 8) {
      return NextResponse.json({ error: '密碼至少 8 個字元' }, { status: 400 })
    }

    const existing = await prisma.portalAccount.findUnique({ where: { customerId } })
    if (existing) {
      return NextResponse.json({ error: '此客戶已有 Portal 帳號' }, { status: 409 })
    }

    const emailTaken = await prisma.portalAccount.findUnique({ where: { email: body.email } })
    if (emailTaken) {
      return NextResponse.json({ error: '此 Email 已被其他帳號使用' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(body.password, 12)
    const account = await prisma.portalAccount.create({
      data: {
        customerId,
        email: body.email.trim().toLowerCase(),
        passwordHash,
        createdById: session.user.id,
        isActive: true,
      },
      select: { id: true, email: true, isActive: true, createdAt: true },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'portal-accounts.create')
  }
}

// PATCH /api/portal-accounts/[customerId] — 啟用/停用/重設密碼
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!CAN_MANAGE.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { customerId } = await params
    const body = await req.json()

    const account = await prisma.portalAccount.findUnique({ where: { customerId } })
    if (!account) return NextResponse.json({ error: '帳號不存在' }, { status: 404 })

    // 修改 Email 限 SUPER_ADMIN
    if (body.email !== undefined && !SUPER_ADMIN_ONLY.includes(session.user.role)) {
      return NextResponse.json({ error: '修改 Email 需要最高管理員權限' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)

    if (body.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 })
      }
      const emailTaken = await prisma.portalAccount.findFirst({
        where: { email: body.email.toLowerCase(), id: { not: account.id } },
      })
      if (emailTaken) return NextResponse.json({ error: '此 Email 已被其他帳號使用' }, { status: 409 })
      updateData.email = body.email.trim().toLowerCase()
    }

    if (body.newPassword) {
      if (body.newPassword.length < 8) {
        return NextResponse.json({ error: '密碼至少 8 個字元' }, { status: 400 })
      }
      updateData.passwordHash = await bcrypt.hash(body.newPassword, 12)
    }

    const updated = await prisma.portalAccount.update({
      where: { id: account.id },
      data: updateData,
      select: { id: true, email: true, isActive: true, updatedAt: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'portal-accounts.update')
  }
}

// DELETE /api/portal-accounts/[customerId] — 刪除帳號（SUPER_ADMIN only）
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!SUPER_ADMIN_ONLY.includes(session.user.role)) {
      return NextResponse.json({ error: '刪除帳號需要最高管理員權限' }, { status: 403 })
    }

    const { customerId } = await params
    const account = await prisma.portalAccount.findUnique({ where: { customerId } })
    if (!account) return NextResponse.json({ error: '帳號不存在' }, { status: 404 })

    await prisma.portalAccount.delete({ where: { id: account.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'portal-accounts.delete')
  }
}
