import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { aiHealth, getAiConfig } from '@/lib/ai'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = getAiConfig()
  const providers = await aiHealth()

  return NextResponse.json({
    config,
    providers,
  })
}
