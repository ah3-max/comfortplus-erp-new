import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { runMrp } from '@/lib/mrp'
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

    const snapshot = req.nextUrl.searchParams.get('snapshot')

    if (snapshot === 'latest') {
      const latest = await prisma.mrpSnapshot.findFirst({
        orderBy: { runAt: 'desc' },
        select: { id: true, runAt: true, skuCount: true, alertCount: true, resultJson: true, runBy: { select: { name: true } } },
      })
      if (!latest) return NextResponse.json({ error: '尚無 MRP 計算紀錄' }, { status: 404 })
      return NextResponse.json({
        ...JSON.parse(latest.resultJson),
        snapshotId: latest.id,
        runBy: latest.runBy.name,
      })
    }

    // Run fresh MRP calculation
    const result = await runMrp()

    // Save snapshot
    await prisma.mrpSnapshot.create({
      data: {
        runById: session.user.id,
        resultJson: JSON.stringify(result),
        skuCount: result.summary.totalSkus,
        alertCount: result.summary.criticalCount + result.summary.warningCount,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, 'mrp.run')
  }
}
