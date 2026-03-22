'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Loader2, Warehouse, Package } from 'lucide-react'
import { toast } from 'sonner'

interface WarehouseItem {
  id: string; code: string; name: string
  address: string | null; notes: string | null; isActive: boolean
  createdAt: string
  _count: { lots: number; stockCounts: number }
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [open, setOpen]             = useState(false)
  const [editing, setEditing]       = useState<WarehouseItem | null>(null)
  const [saving, setSaving]         = useState(false)
  const [form, setForm]             = useState({ code: '', name: '', address: '', notes: '' })

  const fetchWarehouses = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/warehouses?showAll=${showInactive}`)
    setWarehouses(await res.json())
    setLoading(false)
  }, [showInactive])

  useEffect(() => { fetchWarehouses() }, [fetchWarehouses])

  function openCreate() {
    setEditing(null)
    setForm({ code: '', name: '', address: '', notes: '' })
    setOpen(true)
  }
  function openEdit(w: WarehouseItem) {
    setEditing(w)
    setForm({ code: w.code, name: w.name, address: w.address ?? '', notes: w.notes ?? '' })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name) { toast.error('請填寫倉庫名稱'); return }
    if (!editing && !form.code) { toast.error('請填寫倉庫代碼'); return }
    setSaving(true)
    const url    = editing ? `/api/warehouses/${editing.id}` : '/api/warehouses'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(editing ? '倉庫已更新' : '倉庫已新增')
      setOpen(false)
      fetchWarehouses()
    } else {
      const d = await res.json()
      toast.error(d.error ?? '儲存失敗')
    }
  }

  async function toggleActive(w: WarehouseItem) {
    const res = await fetch(`/api/warehouses/${w.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !w.isActive }),
    })
    if (res.ok) { toast.success(w.isActive ? '已停用倉庫' : '已啟用倉庫'); fetchWarehouses() }
    else toast.error('操作失敗')
  }

  const activeCount = warehouses.filter(w => w.isActive).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">倉庫管理</h1>
          <p className="text-sm text-muted-foreground">共 {activeCount} 間倉庫</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            顯示已停用
          </label>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />新增倉庫</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-3 py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : warehouses.map(w => (
          <Card key={w.id} className={`group hover:shadow-md transition-shadow ${!w.isActive ? 'opacity-50' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2.5">
                    <Warehouse className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{w.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{w.code}</span>
                    </div>
                    {w.address && <p className="text-xs text-muted-foreground mt-0.5">{w.address}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(w)}
                    className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  <span>{w._count.lots} 個批號</span>
                </div>
                <div className="ml-auto">
                  {w.isActive
                    ? <Badge variant="outline" className="border-green-400 text-green-600 text-xs">啟用</Badge>
                    : <Badge variant="outline" className="border-red-400 text-red-600 text-xs">停用</Badge>
                  }
                </div>
              </div>
              {w.notes && <p className="mt-2 text-xs text-muted-foreground border-t pt-2">{w.notes}</p>}
              <div className="mt-3 flex justify-end">
                <button onClick={() => toggleActive(w)}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                  {w.isActive ? '停用' : '啟用'}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && warehouses.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-16 text-center text-muted-foreground">
          尚無倉庫資料，請新增第一個倉庫
        </div>
      )}

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? '編輯倉庫' : '新增倉庫'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {!editing && (
              <div className="space-y-1.5">
                <Label>倉庫代碼 <span className="text-red-500">*</span></Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="MAIN / WH-A / COLD" maxLength={20} />
                <p className="text-xs text-muted-foreground">英數大寫，建立後不可更改</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>倉庫名稱 <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="主倉庫 / 冷藏倉" />
            </div>
            <div className="space-y-1.5">
              <Label>地址</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="倉庫地址" />
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="特殊說明..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? '儲存' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
