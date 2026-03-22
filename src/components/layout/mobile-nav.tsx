'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Plus,
  AlertOctagon,
  ClipboardCheck,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  isFab?: boolean
}

const navItems: NavItem[] = [
  { label: '首頁', href: '/dashboard', icon: LayoutDashboard },
  { label: '日報', href: '/daily-report', icon: ClipboardCheck },
  { label: '快速輸入', href: '/quick-input', icon: Plus, isFab: true },
  { label: '客訴', href: '/incidents', icon: AlertOctagon },
  { label: '通知', href: '/alerts', icon: Bell },
]

interface MobileNavProps {
  unreadCount?: number
}

export function MobileNav({ unreadCount = 0 }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'border-t border-slate-200/80 dark:border-white/10',
        'bg-white/90 backdrop-blur-2xl dark:bg-gray-900/90',
        'pb-[env(safe-area-inset-bottom)]',
        'shadow-[0_-1px_6px_rgba(0,0,0,0.04)]',
      )}
    >
      <div className="flex items-center justify-evenly px-2 pt-1 pb-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const Icon = item.icon

          if (item.isFab) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -mt-6 flex flex-col items-center"
              >
                <div
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full shadow-lg',
                    'transition-[transform,box-shadow] duration-[180ms] ease-out',
                    'bg-blue-600 text-white active:scale-90 active:shadow-md',
                    isActive && 'ring-4 ring-blue-600/25 bg-blue-700'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span
                  className={cn(
                    'mt-1 text-xs font-medium',
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            )
          }

          const isNotifications = item.href === '/alerts'

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex min-w-[4.5rem] flex-col items-center gap-1 py-1.5',
                'transition-[color,transform] duration-[180ms] ease-out active:scale-90',
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-400 dark:text-slate-500'
              )}
            >
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}

              <span className="relative">
                <Icon className={cn(
                  'h-[22px] w-[22px] transition-[stroke-width] duration-[180ms]',
                  isActive ? 'stroke-[2.5]' : 'stroke-[1.8]',
                )} />
                {isNotifications && unreadCount > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1.5 flex items-center justify-center rounded-full bg-red-500 text-white',
                      'min-w-[16px] h-[16px] px-0.5 text-[10px] font-bold leading-none',
                      'ring-2 ring-white dark:ring-gray-900'
                    )}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>

              <span className={cn(
                'text-[11px] leading-none tracking-wide',
                isActive ? 'font-semibold' : 'font-medium',
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
