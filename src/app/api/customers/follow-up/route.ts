import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { customerId, logType, content } = body

    if (!customerId || !content?.trim()) {
      return NextResponse.json({ error: '請填寫客戶與追蹤內容' }, { status: 400 })
    }

    const log = await prisma.followUpLog.create({
      data: {
        customerId,
        createdById: session.user.id,
        logType: logType ?? 'CALL',
        content: content.trim(),
      },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'customers.followUp')
  }
}
