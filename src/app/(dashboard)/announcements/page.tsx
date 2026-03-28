'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Megaphone, Pin, Eye, EyeOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Announcement {
  id: string; title: string; content: string; category: string; priority: string
  isPinned: boolean; isPublished: boolean; publishedAt: string | null; expiresAt: string | null
  createdBy: { name: string }; createdAt: string
}

const CATS: Record<string, string> = { GENERAL: '一般', POLICY: '制度', IT: '資訊', HR: '人事', URGENT: '緊急' }
const PRIO_COLOR: Record<string, string> = { LOW: 'bg-slate-100 text-slate-600', NORMAL: 'bg-blue-100 text-blue-700', HIGH: 'bg-orange-100 text-orange-700', URGENT: 'bg-red-100 text-red-700' }

export default function AnnouncementsPage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const isAdmin = ['SUPER_ADMIN', 'GM'].includes(role)

  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', category: 'GENERAL', priority: 'NORMAL', isPinned: false, expiresAt: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const url = isAdmin ? '/api/announcements' : '/api/announcements?published=true'
    fetch(url).then(r => r.json()).then(d => setItems(d.data ?? []))
      .finally(() => setLoading(false))
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setSaving(true)
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, isPublished: true, expiresAt: form.expiresAt || null }),
    })
    setSaving(false)
    if (res.ok) { toast.success(dict.announcements.title); setDialog(false); load() }
    else toast.error(dict.common.saveFailed)
  }

  async function togglePublish(a: Announcement) {
    await fetch(`/api/announcements/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: a.isPublished ? 'UNPUBLISH' : 'PUBLISH' }),
    })
    load()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
    toast.success(dict.common.deleteSuccess)
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.announcements.title}</h1>
          <p className="text-sm text-muted-foreground">公司公告與政策通知</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm({ title: '', content: '', category: 'GENERAL', priority: 'NORMAL', isPinned: false, expiresAt: '' }); setDialog(true) }}>
            <Plus className="h-4 w-4 mr-1" />{dict.announcements.newAnnouncement}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">{dict.announcements.noAnnouncements}</div>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <Card key={a.id} className={a.isPinned ? 'border-amber-300 bg-amber-50/30' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {a.isPinned && <Pin className="h-4 w-4 text-amber-500" />}
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <Badge variant="outline" className={PRIO_COLOR[a.priority] ?? ''}>{a.priority}</Badge>
                    <Badge variant="outline">{CATS[a.category] ?? a.category}</Badge>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => togglePublish(a)}>
                        {a.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-red-500" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm whitespace-pre-wrap">{a.content}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{a.createdBy.name}</span>
                  <span>{new Date(a.createdAt).toLocaleDateString('zh-TW')}</span>
                  {!a.isPublished && <Badge variant="outline" className="bg-slate-100 text-xs">未發佈</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle><Megaphone className="inline h-4 w-4 mr-2" />{dict.announcements.newAnnouncement}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{dict.announcements.subject}</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>{dict.announcements.content}</Label>
              <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>分類</Label>
                <Select value={form.category} onValueChange={(v: string | null) => setForm(f => ({ ...f, category: v ?? 'GENERAL' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>優先級</Label>
                <Select value={form.priority} onValueChange={(v: string | null) => setForm(f => ({ ...f, priority: v ?? 'NORMAL' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{dict.announcements.expireDate}</Label>
              <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title || !form.content}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}發佈
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
