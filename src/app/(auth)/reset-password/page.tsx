'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2 } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('兩次密碼不一致'); return }
    if (password.length < 8) { setError('密碼至少需要 8 個字元'); return }

    setLoading(true); setError('')
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) { setDone(true) }
    else { setError(data.error ?? '發生錯誤，請重試') }
  }

  if (done) return (
    <Card className="w-full max-w-md shadow-lg">
      <CardContent className="pt-10 pb-8 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <p className="text-lg font-medium">密碼已成功重設</p>
        <Button className="w-full" onClick={() => router.push('/login')}>返回登入</Button>
      </CardContent>
    </Card>
  )

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">C+</span>
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">設定新密碼</CardTitle>
        <CardDescription>請輸入您的新密碼（至少 8 個字元）</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>新密碼</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="至少 8 個字元" required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label>確認新密碼</Label>
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="再次輸入密碼" required />
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />處理中…</> : '確認重設密碼'}
          </Button>
          {!token && <p className="text-xs text-center text-red-500">連結無效，請重新申請密碼重設</p>}
        </form>
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
