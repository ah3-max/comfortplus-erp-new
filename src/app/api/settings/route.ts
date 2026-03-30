import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } })
    return NextResponse.json(configs)
  } catch (error) {
    return handleApiError(error, 'settings.GET')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: '僅管理員可修改設定' }, { status: 403 })
    }

    const body: Record<string, string> = await req.json()

    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        prisma.systemConfig.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'settings.PUT')
  }
}
