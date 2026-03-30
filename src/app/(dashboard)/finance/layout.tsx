import { auth } from '@/auth'
import { redirect } from 'next/navigation'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const role = (session.user as { role?: string }).role ?? ''
  if (!FINANCE_ROLES.includes(role)) redirect('/dashboard')

  return <>{children}</>
}
