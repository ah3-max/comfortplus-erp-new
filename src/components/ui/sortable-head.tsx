'use client'

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'

interface SortableHeadProps {
  column: string
  label: string
  current: string
  dir: 'asc' | 'desc'
  onSort: (column: string, dir: 'asc' | 'desc') => void
  className?: string
}

/**
 * Clickable TableHead that shows sort arrows and toggles asc/desc.
 * Usage:
 *   <SortableHead column="createdAt" label="建立日期"
 *     current={orderBy} dir={orderDir} onSort={setSort} />
 */
export function SortableHead({ column, label, current, dir, onSort, className }: SortableHeadProps) {
  const isActive = current === column

  function handleClick() {
    if (isActive) {
      onSort(column, dir === 'asc' ? 'desc' : 'asc')
    } else {
      onSort(column, 'asc')
    }
  }

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-slate-50 transition-colors ${className ?? ''}`}
      onClick={handleClick}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          dir === 'asc'
            ? <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
            : <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" />
        )}
      </span>
    </TableHead>
  )
}
