import { RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { TypographyHeading } from '#/components/ui/typography'
import { cn } from '#/lib/utils'

interface DashboardOverviewProps {
  liveCount: number
  flaggedCount: number
  sweptCount: number
  selectedCount: number
  sweeping: boolean
  confirming: boolean
  onRefresh: () => void
  onRequestUnstar: () => void
}

export function DashboardOverview({
  liveCount,
  flaggedCount,
  sweptCount,
  selectedCount,
  sweeping,
  confirming,
  onRefresh,
  onRequestUnstar,
}: DashboardOverviewProps) {
  return (
    <div className="rise-in mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <TypographyHeading
            level={1}
            size="xs"
            className="font-bold tracking-tight"
          >
            Starred repos
          </TypographyHeading>
          <button
            onClick={onRefresh}
            title="Re-fetch stars from GitHub"
            aria-label="Refresh"
            className="cursor-pointer rounded-md p-1 text-faint transition-colors hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {liveCount} starred · {flaggedCount} flagged
          {sweptCount > 0 && (
            <span className="text-accent-strong">
              {' '}
              · {sweptCount} swept this session
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          onClick={onRequestUnstar}
          disabled={selectedCount === 0 || sweeping}
          className={cn(confirming && 'animate-pulse')}
        >
          <Trash2 className="h-4 w-4" />
          {confirming
            ? `Really unstar ${selectedCount}?`
            : `Unstar ${selectedCount || ''}`}
        </Button>
      </div>
    </div>
  )
}
