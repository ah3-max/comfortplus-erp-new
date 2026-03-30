import { auth } from '@/auth'
import { redirect } from 'next/navigation'

const SETTINGS_ROLES = ['SUPER_ADMIN', 'GM']

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const role = (session.user as { role?: string }).role ?? ''
  if (!SETTINGS_ROLES.includes(role)) redirect('/dashboard')

  return <>{children}</>
}
