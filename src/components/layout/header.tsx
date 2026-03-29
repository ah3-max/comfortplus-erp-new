'use client'

import { useSession, signOut } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogOut, User, Bell, RefreshCw, X, Camera, Save, Loader2 } from 'lucide-react'
import { useI18n, LOCALE_OPTIONS } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback, useRef } from 'react'
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

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function listener(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      handler()
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler])
}

export function Header() {
  const { data: session, update: updateSession } = useSession()
  const { dict, locale, setLocale } = useI18n()
  const router = useRouter()
  const user = session?.user
  const roleLabel = dict.roles[user?.role as keyof typeof dict.roles] ?? user?.role

  // Menu states
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)

  useClickOutside(userMenuRef, () => setShowUserMenu(false))
  useClickOutside(notifMenuRef, () => setShowNotifMenu(false))

  // Profile edit state
  const [profileName, setProfileName] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('')
  const [saving, setSaving] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [generating, setGenerating] = useState(false)

  const initials = user?.name?.slice(0, 2) ?? 'U'

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
    if (linkUrl) {
      setShowNotifMenu(false)
      router.push(linkUrl)
    }
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

  const openProfile = async () => {
    setShowUserMenu(false)
    setProfileName(user?.name ?? '')
    // Fetch current avatar
    try {
      const res = await fetch('/api/users/me')
      if (res.ok) {
        const data = await res.json()
        setProfileAvatar(data.avatar ?? '')
      }
    } catch { /* ignore */ }
    setShowProfileModal(true)
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName, avatar: profileAvatar }),
      })
      if (res.ok) {
        toast.success(dict.forms.profileUpdated)
        await updateSession()
        setShowProfileModal(false)
        router.refresh()
      } else {
        toast.error(dict.common.updateFailed)
      }
    } catch {
      toast.error(dict.common.updateFailed)
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error(dict.forms.imageTooLarge)
      return
    }
    // Convert to base64 data URL for simplicity
    const reader = new FileReader()
    reader.onload = () => {
      setProfileAvatar(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
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
          <div className="relative" ref={notifMenuRef}>
            <button
              onClick={() => { setShowNotifMenu(!showNotifMenu); setShowUserMenu(false) }}
              className="relative flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifMenu && (
              <div className="absolute right-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] sm:w-96 rounded-lg border bg-white shadow-lg">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-semibold">{dict.notifications.title}</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        {dict.notifications.markAllRead}
                      </button>
                    )}
                    <button onClick={generateNotifications} disabled={generating} className="text-muted-foreground hover:text-slate-700 disabled:opacity-40" title="重新整理通知">
                      <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="border-t" />
                {notifications.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto opacity-20 mb-2" />
                    <p>{dict.notifications.noNotifications}</p>
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    {notifications.slice(0, 12).map((n) => (
                      <button
                        key={n.id}
                        className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 ${!n.isRead ? 'bg-blue-50/60' : ''}`}
                        onClick={() => markAsRead(n.id, n.linkUrl)}
                      >
                        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                          n.priority === 'URGENT' ? 'bg-red-500' :
                          n.priority === 'HIGH' ? 'bg-orange-400' : 'bg-slate-300'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${n.isRead ? 'text-slate-500' : 'font-semibold text-slate-800'}`}>{n.title}</p>
                          {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                          <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.isRead && <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Badge variant="secondary">{roleLabel}</Badge>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifMenu(false) }}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {(user as any)?.avatar ? (
                <img src={(user as any).avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-medium cursor-pointer">
                  {initials}
                </div>
              )}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-lg border bg-white shadow-lg py-1">
                <div className="px-3 py-2">
                  <p className="font-medium text-sm">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <div className="border-t my-1" />
                <button
                  onClick={openProfile}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <User className="h-4 w-4" />
                  {dict.header.profile}
                </button>
                <div className="border-t my-1" />
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  {dict.header.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowProfileModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">編輯個人資料</h2>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Avatar */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                {profileAvatar ? (
                  <img src={profileAvatar} alt="" className="h-20 w-20 rounded-full object-cover border-2 border-slate-200" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-2xl font-bold border-2 border-slate-200">
                    {profileName?.slice(0, 2) || 'U'}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow hover:bg-blue-700">
                  <Camera className="h-3.5 w-3.5" />
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>
              {profileAvatar && (
                <button onClick={() => setProfileAvatar('')} className="mt-2 text-xs text-red-500 hover:text-red-700">
                  移除頭貼
                </button>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="profile-name">姓名</Label>
              <Input
                id="profile-name"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="輸入姓名"
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2 mb-6">
              <Label>Email</Label>
              <Input value={user?.email ?? ''} disabled className="bg-slate-50" />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowProfileModal(false)}>
                取消
              </Button>
              <Button className="flex-1" onClick={saveProfile} disabled={saving || !profileName.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                儲存
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
