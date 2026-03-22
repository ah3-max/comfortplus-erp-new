import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ollamaHealth, getAiConfig } from '@/lib/ai'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = getAiConfig()
  const ollama = await ollamaHealth()

  return NextResponse.json({
    config,
    ollama,
  })
}
