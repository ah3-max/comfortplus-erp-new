import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.assetLoan.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.action === 'RETURN') {
      const loan = await prisma.assetLoan.update({
        where: { id },
        data: {
          actualReturnDate: new Date(),
          status: 'RETURNED',
          condition: body.condition ?? null,
        },
      })
      return NextResponse.json(loan)
    }

    if (body.action === 'LOST') {
      const loan = await prisma.assetLoan.update({
        where: { id },
        data: { status: 'LOST' },
      })
      return NextResponse.json(loan)
    }

    const { assetName, assetCode, category, borrowerId, borrowDate, expectedReturnDate, notes } = body
    const data: Record<string, unknown> = {}
    if (assetName !== undefined) data.assetName = assetName
    if (assetCode !== undefined) data.assetCode = assetCode
    if (category !== undefined) data.category = category
    if (borrowerId !== undefined) data.borrowerId = borrowerId
    if (borrowDate !== undefined) data.borrowDate = new Date(borrowDate)
    if (expectedReturnDate !== undefined) data.expectedReturnDate = expectedReturnDate ? new Date(expectedReturnDate) : null
    if (notes !== undefined) data.notes = notes

    const loan = await prisma.assetLoan.update({ where: { id }, data })
    return NextResponse.json(loan)
  } catch (error) {
    return handleApiError(error, 'asset-loans.PUT')
  }
}
