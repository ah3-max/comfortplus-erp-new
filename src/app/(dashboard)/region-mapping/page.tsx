'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Plus, MapPin, Search } from 'lucide-react'
import { toast } from 'sonner'

interface RegionMap {
  id: string; city: string; district: string | null; region: string
  deliveryZone: string | null; defaultRouteId: string | null
}

export default function RegionMappingPage() {
  const [mappings, setMappings] = useState<RegionMap[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ city: '', district: '', region: '', deliveryZone: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/region-mapping').then(r => r.json()).then(d => setMappings(d.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = mappings.filter(m =>
    !search || m.city.includes(search) || (m.district?.includes(search) ?? false) || m.region.includes(search)
  )

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/region-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, district: form.district || null, deliveryZone: form.deliveryZone || null }),
    })
    setSaving(false)
    if (res.ok) { toast.success('已儲存'); setDialog(false); load() }
    else toast.error('儲存失敗')
  }

  // Group by city
  const grouped = filtered.reduce((acc, m) => {
    if (!acc[m.city]) acc[m.city] = []
    acc[m.city].push(m)
    return acc
  }, {} as Record<string, RegionMap[]>)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">映射中心</h1>
          <p className="text-sm text-muted-foreground">地區 → 業務區域 / 配送區域對應</p>
        </div>
        <Button onClick={() => { setForm({ city: '', district: '', region: '', deliveryZone: '' }); setDialog(true) }}>
          <Plus className="h-4 w-4 mr-1" />新增對應
        </Button>
      </div>

      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="搜尋城市/區域..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">暫無對應資料</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([city, items]) => (
            <div key={city}>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />{city}
              </h3>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50">
                    <tr>
                      {['區/鄉鎮', '業務區域', '配送區域', '操作'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(m => (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50/50">
                        <td className="px-3 py-2">{m.district ?? '（全市）'}</td>
                        <td className="px-3 py-2 font-medium">{m.region}</td>
                        <td className="px-3 py-2">{m.deliveryZone ?? '-'}</td>
                        <td className="px-3 py-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                            setForm({ city: m.city, district: m.district ?? '', region: m.region, deliveryZone: m.deliveryZone ?? '' })
                            setDialog(true)
                          }}>
                            編輯
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>地區對應</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>城市</Label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="mt-1" placeholder="台北市" />
            </div>
            <div>
              <Label>區/鄉鎮（選填）</Label>
              <Input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} className="mt-1" placeholder="信義區" />
            </div>
            <div>
              <Label>業務區域</Label>
              <Input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className="mt-1" placeholder="北北桃" />
            </div>
            <div>
              <Label>配送區域（選填）</Label>
              <Input value={form.deliveryZone} onChange={e => setForm(f => ({ ...f, deliveryZone: e.target.value }))} className="mt-1" placeholder="Zone A" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !form.city || !form.region}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
