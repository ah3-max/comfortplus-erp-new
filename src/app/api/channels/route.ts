import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channels = await prisma.salesChannel.findMany({
      include: { _count: { select: { channelOrders: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(channels)
  } catch (error) {
    return handleApiError(error, 'channels.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body.code || !body.name || !body.platform) {
      return NextResponse.json({ error: '請填寫代碼、名稱與平台' }, { status: 400 })
    }

    const exists = await prisma.salesChannel.findUnique({ where: { code: body.code.toUpperCase() } })
    if (exists) return NextResponse.json({ error: '代碼已存在' }, { status: 400 })

    const channel = await prisma.salesChannel.create({
      data: {
        code:           body.code.toUpperCase(),
        name:           body.name,
        platform:       body.platform,
        shopUrl:        body.shopUrl        || null,
        commissionRate: body.commissionRate ? Number(body.commissionRate) : null,
        contactPerson:  body.contactPerson  || null,
        contactPhone:   body.contactPhone   || null,
        notes:          body.notes          || null,
      },
    })

    return NextResponse.json(channel, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'channels.create')
  }
}
