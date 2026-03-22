import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customers = await prisma.customer.findMany({
    where: { isKeyAccount: true, isActive: true },
    include: {
      salesRep:      { select: { id: true, name: true } },
      keyAccountMgr: { select: { id: true, name: true } },
      _count: { select: { followUpLogs: true, salesOrders: true } },
    },
    orderBy: [{ grade: 'asc' }, { name: 'asc' }],
  })

  // Compute daysSinceContact and isOverdueVisit for each
  const now = new Date()
  const result = customers.map(c => {
    const daysSinceContact = c.lastContactDate
      ? Math.floor((now.getTime() - new Date(c.lastContactDate).getTime()) / 86400000)
      : null

    const isOverdueVisit = c.visitFrequencyDays != null
      ? (daysSinceContact === null || daysSinceContact > c.visitFrequencyDays)
      : daysSinceContact !== null && daysSinceContact > 90

    return {
      ...c,
      daysSinceContact,
      isOverdueVisit,
    }
  })

  return NextResponse.json(result)
}
