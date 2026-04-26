import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'WAREHOUSE_MANAGER', 'FINANCE']

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = req.nextUrl.searchParams.get('id')

    if (id) {
      const snapshot = await prisma.mrpSnapshot.findUnique({
        where: { id },
        select: {
          id: true, runAt: true, skuCount: true, alertCount: true,
          resultJson: true, notes: true,
          runBy: { select: { name: true } },
        },
      })
      if (!snapshot) return NextResponse.json({ error: '找不到此 snapshot' }, { status: 404 })
      return NextResponse.json({
        ...snapshot,
        result: JSON.parse(snapshot.resultJson),
        resultJson: undefined,
      })
    }

    const snapshots = await prisma.mrpSnapshot.findMany({
      orderBy: { runAt: 'desc' },
      take: 50,
      select: {
        id: true, runAt: true, skuCount: true, alertCount: true, notes: true,
        runBy: { select: { name: true } },
      },
    })

    return NextResponse.json({ data: snapshots })
  } catch (error) {
    return handleApiError(error, 'mrp.snapshots')
  }
}
