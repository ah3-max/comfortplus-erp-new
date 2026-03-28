import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/samples/[id]
// Update a SampleRecord — e.g. record followUpResult and mark hasFeedback = true
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const existing = await prisma.sampleRecord.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: '找不到樣品記錄' }, { status: 404 })

  const updated = await prisma.sampleRecord.update({
    where: { id },
    data: {
      ...(body.followUpResult !== undefined && { followUpResult: body.followUpResult }),
      ...(body.outcome       !== undefined && { outcome:        body.outcome }),
      ...(body.hasFeedback   !== undefined && { hasFeedback:    body.hasFeedback }),
      ...(body.notes         !== undefined && { notes:          body.notes }),
    },
  })

  return NextResponse.json(updated)
}
