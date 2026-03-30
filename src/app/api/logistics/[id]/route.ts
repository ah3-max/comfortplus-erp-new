import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const provider = await prisma.logisticsProvider.update({
    where: { id },
    data: {
      name:          body.name          || undefined,
      regions:       body.regions       ?? undefined,
      deliveryDays:  body.deliveryDays  != null ? Number(body.deliveryDays) : undefined,
      paymentTerms:  body.paymentTerms  ?? undefined,
      rateCard:      body.rateCard      ?? undefined,
      contactPerson: body.contactPerson ?? undefined,
      contactPhone:  body.contactPhone  ?? undefined,
      contactEmail:  body.contactEmail  ?? undefined,
      claimRules:    body.claimRules    ?? undefined,
      notes:         body.notes         ?? undefined,
      isActive:      body.isActive      ?? undefined,
    },
  })

  return NextResponse.json(provider)
  } catch (error) { return handleApiError(error, 'logistics.update') }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const provider = await prisma.logisticsProvider.update({
    where: { id },
    data: { isActive: false },
  })
  return NextResponse.json(provider)
  } catch (error) { return handleApiError(error, 'logistics.delete') }
}
