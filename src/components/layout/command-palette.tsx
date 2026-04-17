'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import zhTW from '@/lib/i18n/locales/zh-TW'
import en from '@/lib/i18n/locales/en'
import th from '@/lib/i18n/locales/th'
import {
  navGroups,
  isSubGroup,
  type NavItem,
  type NavGroup,
} from './sidebar'

type FlatItem = {
  href: string
  key: string
  icon: NavItem['icon']
  groupLabelKey: string
  subLabelKey?: string
}

function flatten(groups: NavGroup[]): FlatItem[] {
  const result: FlatItem[] = []
  for (const group of groups) {
    for (const entry of group.items) {
      if (isSubGroup(entry)) {
        for (const item of entry.items) {
          result.push({
            href: item.href,
            key: item.key,
            icon: item.icon,
            groupLabelKey: group.labelKey,
            subLabelKey: entry.subLabelKey,
          })
        }
      } else {
        result.push({
          href: entry.href,
          key: entry.key,
          icon: entry.icon,
          groupLabelKey: group.labelKey,
        })
      }
    }
  }
  return result
}

function dedupe(items: FlatItem[]): FlatItem[] {
  const seen = new Set<string>()
  return items.filter(i => (seen.has(i.href) ? false : (seen.add(i.href), true)))
}

const ALL_ITEMS = dedupe(flatten(navGroups))

function readNav(obj: unknown, key: string): string {
  const nav = (obj as { nav?: Record<string, string> })?.nav
  return nav?.[key] ?? key
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null)
  const router = useRouter()
  const { dict } = useI18n()

  /* keyboard shortcut + event bridge from sidebar button */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    const onEvent = () => setOpen(true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('open-cmd-palette', onEvent)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('open-cmd-palette', onEvent)
    }
  }, [])

  /* load current user's allowed modules */
  useEffect(() => {
    fetch('/api/role-permissions/my')
      .then(r => r.json())
      .then(d => setAllowedModules(d.allowedModules ?? ['*']))
      .catch(() => setAllowedModules([]))
  }, [])

  const canAccess = (key: string) =>
    allowedModules !== null &&
    (allowedModules.includes('*') || allowedModules.includes(key))

  const visibleItems = useMemo(
    () => ALL_ITEMS.filter(i => canAccess(i.key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowedModules]
  )

  const handleSelect = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[15vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl px-4"
            onClick={e => e.stopPropagation()}
          >
            <Command
              label="搜尋功能"
              shouldFilter
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-center gap-2 border-b border-slate-200 px-4">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <Command.Input
                  autoFocus
                  placeholder={readNav(dict, 'searchPlaceholder') || '搜尋功能...'}
                  className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
                <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:inline-block">
                  Esc
                </kbd>
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                {allowedModules === null ? (
                  <div className="py-10 text-center text-sm text-slate-400">載入中...</div>
                ) : visibleItems.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    此帳號尚未開放任何功能
                  </div>
                ) : (
                  <>
                    <Command.Empty className="py-10 text-center text-sm text-slate-500">
                      找不到符合的功能
                    </Command.Empty>
                    {visibleItems.map(item => {
                      const labelZh = readNav(zhTW, item.key)
                      const labelEn = readNav(en, item.key)
                      const labelTh = readNav(th, item.key)
                      const groupZh = readNav(zhTW, item.groupLabelKey)
                      const subZh = item.subLabelKey ? readNav(zhTW, item.subLabelKey) : ''
                      const display = readNav(dict, item.key)
                      const groupDisplay = readNav(dict, item.groupLabelKey)
                      const subDisplay = item.subLabelKey
                        ? readNav(dict, item.subLabelKey)
                        : ''
                      const value = [
                        labelZh, labelEn, labelTh,
                        groupZh, subZh,
                        item.key, item.href,
                      ]
                        .filter(Boolean)
                        .join(' ')
                      const Icon = item.icon
                      return (
                        <Command.Item
                          key={item.href}
                          value={value}
                          onSelect={() => handleSelect(item.href)}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm',
                            'data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-900'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                          <span className="truncate">{display}</span>
                          <span className="ml-auto shrink-0 text-xs text-slate-400">
                            {subDisplay ? `${groupDisplay} · ${subDisplay}` : groupDisplay}
                          </span>
                        </Command.Item>
                      )
                    })}
                  </>
                )}
              </Command.List>
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                <div className="flex gap-3">
                  <span>
                    <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">↑↓</kbd> 選擇
                  </span>
                  <span>
                    <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">↵</kbd> 開啟
                  </span>
                </div>
                <span>
                  <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">Ctrl K</kbd>
                </span>
              </div>
            </Command>
          </div>
        </div>
      )}
    </>
  )
}
