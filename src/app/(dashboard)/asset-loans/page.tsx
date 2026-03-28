'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Package, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface AssetLoan {
  id: string; assetName: string; assetCode: string | null; category: string
  borrowDate: string; expectedReturnDate: string | null; actualReturnDate: string | null
  status: string; condition: string | null; notes: string | null
  borrower: { name: string }; createdBy: { name: string }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  BORROWED: { label: '借出中', color: 'bg-blue-100 text-blue-700' },
  RETURNED: { label: '已歸還', color: 'bg-green-100 text-green-700' },
  OVERDUE: { label: '逾期', color: 'bg-red-100 text-red-700' },
  LOST: { label: '遺失', color: 'bg-slate-100 text-slate-600' },
}

const CATS = ['LAPTOP', 'PHONE', 'PROJECTOR', 'VEHICLE', 'OTHER']
const CAT_LABELS: Record<string, string> = { LAPTOP: '筆電', PHONE: '手機', PROJECTOR: '投影機', VEHICLE: '車輛', OTHER: '其他' }

export default function AssetLoansPage() {
  const { data: session } = useSession()
  const [loans, setLoans] = useState<AssetLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ assetName: '', assetCode: '', category: 'LAPTOP', borrowerId: '', borrowDate: new Date().toISOString().slice(0, 10), expectedReturnDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const qs = statusFilter ? `?status=${statusFilter}` : ''
    fetch(`/api/asset-loans${qs}`).then(r => r.json()).then(d => setLoans(d.data ?? []))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setSaving(true)
    const res = await fetch('/api/asset-loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, borrowerId: form.borrowerId || session?.user?.id, expectedReturnDate: form.expectedReturnDate || null }),
    })
    setSaving(false)
    if (res.ok) { toast.success('借用記錄已建立'); setDialog(false); load() }
    else toast.error('建立失敗')
  }

  async function returnAsset(id: string) {
    const res = await fetch(`/api/asset-loans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RETURN' }),
    })
    if (res.ok) { toast.success('已歸還'); load() }
    else toast.error('操作失敗')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">資產借用管理</h1>
          <p className="text-sm text-muted-foreground">管理公司設備借用與歸還</p>
        </div>
        <Button onClick={() => setDialog(true)}><Plus className="h-4 w-4 mr-1" />新增借用</Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter || 'all'} onValueChange={(v: string | null) => setStatusFilter((v ?? '') === 'all' ? '' : (v ?? ''))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : loans.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">暫無借用記錄</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loans.map(l => {
            const st = STATUS_MAP[l.status] ?? { label: l.status, color: '' }
            return (
              <Card key={l.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {l.assetName}
                    </CardTitle>
                    <Badge variant="outline" className={st.color}>{st.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">分類</span><span>{CAT_LABELS[l.category] ?? l.category}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">借用人</span><span>{l.borrower.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">借用日</span><span>{l.borrowDate?.slice(0, 10)}</span></div>
                  {l.expectedReturnDate && <div className="flex justify-between"><span className="text-muted-foreground">預計歸還</span><span>{l.expectedReturnDate.slice(0, 10)}</span></div>}
                  {l.actualReturnDate && <div className="flex justify-between"><span className="text-muted-foreground">實際歸還</span><span>{l.actualReturnDate.slice(0, 10)}</span></div>}
                  {l.status === 'BORROWED' && (
                    <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => returnAsset(l.id)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />歸還
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增借用</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>設備名稱</Label>
              <Input value={form.assetName} onChange={e => setForm(f => ({ ...f, assetName: e.target.value }))} className="mt-1" placeholder="MacBook Pro 14" />
            </div>
            <div>
              <Label>資產編號（選填）</Label>
              <Input value={form.assetCode} onChange={e => setForm(f => ({ ...f, assetCode: e.target.value }))} className="mt-1" placeholder="IT-001" />
            </div>
            <div>
              <Label>分類</Label>
              <Select value={form.category} onValueChange={(v: string | null) => setForm(f => ({ ...f, category: v ?? 'LAPTOP' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>借用日期</Label>
              <Input type="date" value={form.borrowDate} onChange={e => setForm(f => ({ ...f, borrowDate: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>預計歸還日（選填）</Label>
              <Input type="date" value={form.expectedReturnDate} onChange={e => setForm(f => ({ ...f, expectedReturnDate: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={saving || !form.assetName}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
