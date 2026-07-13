import { Loader2, Search, WandSparkles } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import type { SearchScope } from '../types'

interface DashboardSearchProps {
  query: string
  scope: SearchScope
  searching: boolean
  error: string | null
  onQueryChange: (query: string) => void
  onScopeChange: (scope: SearchScope) => void
  onSearch: () => void
}

export function DashboardSearch({
  query,
  scope,
  searching,
  error,
  onQueryChange,
  onScopeChange,
  onSearch,
}: DashboardSearchProps) {
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-faint" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSearch()
            }}
            placeholder="Filter instantly, or describe a repo and press Enter to ask AI…"
            className="pl-9"
          />
        </div>
        <select
          value={scope}
          onChange={(event) => onScopeChange(event.target.value as SearchScope)}
          aria-label="Search scope"
          className="h-9 cursor-pointer rounded-lg border border-input bg-card px-2.5 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring/40"
        >
          <option value="starred">My stars</option>
          <option value="github">All GitHub</option>
          <option value="both">Both</option>
        </select>
        <Button variant="outline" onClick={onSearch} disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
          Ask AI
        </Button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  )
}
