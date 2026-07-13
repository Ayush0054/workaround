import { X } from 'lucide-react'
import { cn } from '#/lib/utils'
import type { DashboardFilter, DashboardTab } from '../types'

interface DashboardFiltersProps {
  activeFilter: DashboardFilter
  tabs: DashboardTab[]
  hasAiMatches: boolean
  onFilterChange: (filter: DashboardFilter) => void
  onClearAiMatches: () => void
}

export function DashboardFilters({
  activeFilter,
  tabs,
  hasAiMatches,
  onFilterChange,
  onClearAiMatches,
}: DashboardFiltersProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-border bg-muted p-0.5">
        {tabs.map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeFilter === value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {count !== null && (
              <span className="ml-1.5 font-mono text-[10px] text-accent-strong">{count}</span>
            )}
          </button>
        ))}
      </div>
      {hasAiMatches && (
        <button
          onClick={onClearAiMatches}
          className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] text-faint hover:text-foreground"
        >
          <X className="h-3 w-3" />
          clear AI matches
        </button>
      )}
    </div>
  )
}
