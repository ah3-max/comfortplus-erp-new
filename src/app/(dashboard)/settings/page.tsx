'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2, Save, Building2, CreditCard, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface Config { key: string; value: string; description: string | null }

const sections = [
  {
    title: '公司基本資料',
    icon: <Building2 className="h-4 w-4" />,
    fields: [
      { key: 'company_name',    label: '公司名稱',   placeholder: '舒適加股份有限公司' },
      { key: 'company_tax_id',  label: '統一編號',   placeholder: '12345678' },
      { key: 'company_phone',   label: '聯絡電話',   placeholder: '02-1234-5678' },
      { key: 'company_address', label: '公司地址',   placeholder: '台北市信義區...' },
    ],
  },
  {
    title: '財務設定',
    icon: <CreditCard className="h-4 w-4" />,
    fields: [
      { key: 'default_payment_terms', label: '預設付款條件', placeholder: 'NET30' },
    ],
  },
  {
    title: '單據設定',
    icon: <FileText className="h-4 w-4" />,
    fields: [
      { key: 'quotation_valid_days', label: '報價單有效天數', placeholder: '30' },
    ],
  },
]

export default function SettingsPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'SUPER_ADMIN'

  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((configs: Config[]) => {
        const map: Record<string, string> = {}
        configs.forEach((c) => { map[c.key] = c.value })
        setValues(map)
      })
      .finally(() => setLoading(false))
  }, [])

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false)
    if (res.ok) toast.success('設定已儲存')
    else {
      const data = await res.json()
      toast.error(data.error ?? '儲存失敗')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">系統設定</h1>
          <p className="text-sm text-muted-foreground">管理公司基本資料與系統參數</p>
        </div>
        {isAdmin && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            儲存設定
          </Button>
        )}
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          目前為唯讀模式，僅管理員可修改設定。
        </div>
      )}

      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {section.icon}
              {section.title}
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            {section.fields.map((field) => (
              <div key={field.key} className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right text-sm">{field.label}</Label>
                <div className="col-span-2">
                  <Input
                    value={values[field.key] ?? ''}
                    onChange={(e) => set(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* 版本資訊 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>舒適加 ERP</span>
            <span>V1.0.0</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
