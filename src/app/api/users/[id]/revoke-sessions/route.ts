import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/users/[id]/revoke-sessions
 * Increment tokenVersion → all existing JWT sessions for this user
 * will be rejected within ≤15 minutes (at next token refresh).
 *
 * Allowed by: SUPER_ADMIN, GM, or the user themselves (self-revoke on password change).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: targetId } = await params
  const role = (session.user as { role?: string }).role ?? ''
  const isSelf = session.user.id === targetId
  const isAdmin = ['SUPER_ADMIN', 'GM'].includes(role)

  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: '無權限撤銷他人的 Session' }, { status: 403 })
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: { tokenVersion: { increment: 1 } },
    select: { id: true, name: true, tokenVersion: true },
  })

  return NextResponse.json({
    message: `已撤銷 ${user.name} 的所有登入，新 tokenVersion: ${user.tokenVersion}`,
  })
  } catch (error) {
    return handleApiError(error, 'users.revokeSessions')
  }
}
