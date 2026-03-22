'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Zap, Globe } from 'lucide-react'
import { useI18n, LOCALE_OPTIONS } from '@/lib/i18n/context'

export default function LoginPage() {
  const router = useRouter()
  const { dict, locale, setLocale } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [quickLoading, setQuickLoading] = useState(false)

  async function doLogin(e: string, p: string, isQuick = false) {
    setError('')
    if (isQuick) setQuickLoading(true); else setLoading(true)

    const result = await signIn('credentials', { email: e, password: p, redirect: false })

    if (isQuick) setQuickLoading(false); else setLoading(false)

    if (result?.error) {
      setError(dict.login.loginError)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    doLogin(email, password)
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      {/* Language switcher */}
      <div className="flex justify-end px-4 pt-3">
        <div className="flex gap-1">
          {LOCALE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLocale(opt.value)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                locale === opt.value
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {opt.flag} {opt.label}
            </button>
          ))}
        </div>
      </div>
      <CardHeader className="space-y-1 text-center pt-2">
        <div className="flex justify-center mb-2">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">C+</span>
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">{dict.login.appName}</CardTitle>
        <CardDescription>{dict.login.appDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{dict.login.email}</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{dict.login.password}</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || quickLoading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {dict.common.loading}
              </>
            ) : (
              dict.login.submit
            )}
          </Button>

          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-slate-400">{dict.login.devQuickAccess}</span>
            </div>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
              disabled={loading || quickLoading}
              onClick={() => doLogin('admin@comfortplus.com', 'admin1234', true)}
            >
              {quickLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              {dict.login.adminQuickLogin}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
