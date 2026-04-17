'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Save, Pencil, Loader2, BookOpen } from 'lucide-react'

interface Mapping {
  id: string
  category: string
  accountCode: string
  accountName: string
  isActive: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT:     '交通費',
  MEAL:          '伙食費',
  HOTEL:         '住宿/租金',
  OFFICE:        '文具用品',
  ENTERTAINMENT: '交際費',
  TRAINING:      '訓練費',
  OTHER:         '其他',
}

export default function ExpenseCategoriesPage() {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ category: '', accountCode: '', accountName: '', isActive: true })

  const fetchMappings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finance/expense-category-mapping')
      const json = await res.json()
      setMappings(json.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchMappings() }, [fetchMappings])

  const openEdit = (m: Mapping) => {
    setForm({ category: m.category, accountCode: m.accountCode, accountName: m.accountName, isActive: m.isActive })
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!form.category || !form.accountCode || !form.accountName) {
      toast.error('請填寫所有欄位')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/finance/expense-category-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { toast.error('儲存失敗'); return }
      toast.success('科目對應已更新')
      setEditOpen(false)
      fetchMappings()
    } catch { toast.error('儲存失敗') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">費用科目設定</h1>
      <p className="text-sm text-muted-foreground">
        設定各費用類別對應的會計科目代碼。費用報銷核准時，系統會依此對應自動產生暫估傳票分錄。
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            費用類別 → 會計科目對應
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>費用類別</TableHead>
                    <TableHead>類別代碼</TableHead>
                    <TableHead>會計科目代碼</TableHead>
                    <TableHead>科目名稱</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">尚無設定，請先執行 seed</TableCell></TableRow>
                  ) : mappings.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{CATEGORY_LABELS[m.category] ?? m.category}</TableCell>
                      <TableCell className="font-mono text-xs">{m.category}</TableCell>
                      <TableCell className="font-mono">{m.accountCode}</TableCell>
                      <TableCell>{m.accountName}</TableCell>
                      <TableCell>
                        <Badge variant={m.isActive ? 'default' : 'secondary'}>
                          {m.isActive ? '啟用' : '停用'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>編輯科目對應 — {CATEGORY_LABELS[form.category] ?? form.category}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>費用類別</Label>
              <Input value={CATEGORY_LABELS[form.category] ?? form.category} disabled />
            </div>
            <div>
              <Label>會計科目代碼</Label>
              <Input value={form.accountCode} placeholder="6300"
                onChange={e => setForm(f => ({ ...f, accountCode: e.target.value }))} />
            </div>
            <div>
              <Label>科目名稱</Label>
              <Input value={form.accountName} placeholder="交通費"
                onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300" />
              <Label>啟用此對應</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
