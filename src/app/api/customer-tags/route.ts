import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tags = await prisma.customerTag.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(tags)
  } catch (error) {
    return handleApiError(error, 'customerTags.get')
  }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, color, category } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const tag = await prisma.customerTag.create({
    data: { name, color: color ?? '#6366f1', category: category ?? null },
  })
  return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'customerTags.post')
  }
}
