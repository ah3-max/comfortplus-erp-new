'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Building2, ChevronDown, ChevronRight, Users } from 'lucide-react'

interface Department {
  id: string; code: string; name: string; parentId: string | null; isActive: boolean
  manager: { name: string } | null
  _count: { users: number }
  children?: Department[]
}

interface UserRow { id: string; name: string; role: string; title: string | null; departmentId: string | null }

function buildTree(depts: Department[]): Department[] {
  const map = new Map<string, Department>()
  const roots: Department[] = []
  depts.forEach(d => map.set(d.id, { ...d, children: [] }))
  map.forEach(d => {
    if (d.parentId && map.has(d.parentId)) {
      map.get(d.parentId)!.children!.push(d)
    } else {
      roots.push(d)
    }
  })
  return roots
}

function DeptNode({ dept, level, users, roles }: { dept: Department; level: number; users: UserRow[]; roles: Record<string, string> }) {
  const [expanded, setExpanded] = useState(level < 2)
  const hasChildren = dept.children && dept.children.length > 0
  const deptUsers = users.filter(u => u.departmentId === dept.id)

  return (
    <div className={level > 0 ? 'ml-6 border-l border-slate-200 pl-4' : ''}>
      <div
        className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-slate-50/80 rounded-md px-2 -mx-2"
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <div className="w-4" />
        )}
        <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="font-medium text-sm">{dept.name}</span>
        <Badge variant="outline" className="text-[10px] font-mono">{dept.code}</Badge>
        {dept.manager && <span className="text-xs text-muted-foreground">({dept.manager.name})</span>}
        {dept._count.users > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Users className="h-3 w-3" />{dept._count.users}
          </span>
        )}
      </div>

      {expanded && deptUsers.length > 0 && (
        <div className="ml-10 mb-1">
          {deptUsers.map(u => (
            <div key={u.id} className="flex items-center gap-2 py-0.5 text-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
              <span>{u.name}</span>
              <Badge variant="outline" className="text-[10px]">{roles[u.role] ?? u.role}</Badge>
              {u.title && <span className="text-xs text-muted-foreground">{u.title}</span>}
            </div>
          ))}
        </div>
      )}

      {expanded && dept.children?.map(child => (
        <DeptNode key={child.id} dept={child} level={level + 1} users={users} roles={roles} />
      ))}
    </div>
  )
}

export default function OrgChartPage() {
  const { dict } = useI18n()
  const oc = dict.orgChart
  const [depts, setDepts] = useState<Department[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [deptRes, userRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/users'),
      ])
      const deptData = await deptRes.json()
      const userData = await userRes.json()
      setDepts(Array.isArray(deptData) ? deptData : deptData.data ?? [])
      setUsers(Array.isArray(userData) ? userData : userData.data ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const tree = buildTree(depts)

  // Summary
  const totalDepts = depts.length
  const totalUsers = users.length
  const assignedUsers = users.filter(u => u.departmentId).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{oc.title}</h1>
        <p className="text-sm text-muted-foreground">{oc.subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">{oc.department}</p>
              <p className="text-lg font-bold">{totalDepts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">{oc.employee}</p>
              <p className="text-lg font-bold">{totalUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">{oc.assignedDept}</p>
              <p className="text-lg font-bold">{assignedUsers} / {totalUsers}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : tree.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">{oc.noData}</div>
      ) : (
        <Card>
          <CardContent className="p-6">
            {tree.map(root => (
              <DeptNode key={root.id} dept={root} level={0} users={users} roles={oc.roles as Record<string, string>} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
