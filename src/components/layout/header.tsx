'use client'

import { useSession, signOut } from 'next-auth/react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { LogOut, User, Bell, RefreshCw } from 'lucide-react'
import { useI18n, LOCALE_OPTIONS } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  title: string
  message?: string
  isRead: boolean
  linkUrl?: string
  priority?: string
  category?: string
  createdAt: string
}

function timeAgo(date: string) {
  const now = Date.now()
  const d = new Date(date).getTime()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return '剛剛'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
  return `${Math.floor(diff / 86400)} 天前`
}

export function Header() {
  const { data: session } = useSession()
  const { dict, locale, setLocale } = useI18n()
  const router = useRouter()
  const user = session?.user
  const roleLabel = dict.roles[user?.role as keyof typeof dict.roles] ?? user?.role
  const initials = user?.name?.slice(0, 2) ?? 'U'
  const currentFlag = LOCALE_OPTIONS.find(o => o.value === locale)?.flag ?? ''

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [generating, setGenerating] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=12')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? [])
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch { /* ignore */ }
  }, [])

  const generateNotifications = useCallback(async () => {
    setGenerating(true)
    try {
      await fetch('/api/notifications/generate', { method: 'POST' })
      await fetchNotifications()
    } catch { /* ignore */ }
    finally { setGenerating(false) }
  }, [fetchNotifications])

  useEffect(() => {
    // 載入時先抓通知，再判斷今天是否已產生過
    fetchNotifications().then(() => {
      const todayKey = `notif_gen_${new Date().toISOString().slice(0, 10)}`
      if (!localStorage.getItem(todayKey)) {
        localStorage.setItem(todayKey, '1')
        generateNotifications()
      }
    })
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications, generateNotifications])

  const markAsRead = async (id: string, linkUrl?: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'READ', notificationIds: [id] }),
      })
    } catch { /* ignore */ }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    if (linkUrl) router.push(linkUrl)
  }

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'READ_ALL' }),
      })
    } catch { /* ignore */ }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  return (
    <header className="flex h-14 lg:h-16 items-center justify-between border-b bg-white px-3 sm:px-4 lg:px-6">
      <div />
      <div className="flex items-center gap-3">
        {/* Language Switcher */}
        <div className="flex items-center gap-1">
          {LOCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setLocale(opt.value)
                toast.success(opt.label, { duration: 1500 })
              }}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                locale === opt.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span>{opt.flag}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Notification Bell */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-96">
            {/* Header row */}
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold">{dict.notifications.title}</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {dict.notifications.markAllRead}
                  </button>
                )}
                <button
                  onClick={generateNotifications}
                  disabled={generating}
                  className="text-muted-foreground hover:text-slate-700 disabled:opacity-40"
                  title="重新整理通知"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <DropdownMenuSeparator />

            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground space-y-1">
                <Bell className="h-8 w-8 mx-auto opacity-20 mb-2" />
                <p>{dict.notifications.noNotifications}</p>
                <button
                  onClick={generateNotifications}
                  disabled={generating}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40"
                >
                  {generating ? '掃描中…' : '立即掃描系統通知'}
                </button>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                {notifications.slice(0, 12).map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer ${!n.isRead ? 'bg-blue-50/60' : ''}`}
                    onClick={() => markAsRead(n.id, n.linkUrl)}
                  >
                    {/* Priority dot */}
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      n.priority === 'URGENT' ? 'bg-red-500' :
                      n.priority === 'HIGH'   ? 'bg-orange-400' :
                                                'bg-slate-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${n.isRead ? 'text-slate-500' : 'font-semibold text-slate-800'}`}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Badge variant="secondary">{roleLabel}</Badge>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-9 w-9 cursor-pointer">
              <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              {dict.header.profile}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {dict.header.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
