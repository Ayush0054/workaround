import { Github, Star } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import { cn, formatCount, timeAgo } from '#/lib/utils'
import type { AiVerdict, ScoredRepo, Signal } from '#/server/suggest'

const SIGNAL_LABELS: Record<Signal, string> = {
  archived: 'archived',
  deprecated: 'deprecated',
  'very-stale': 'no commits 4y+',
  stale: 'no commits 2y+',
  'old-star': 'starred 3y+ ago',
}

export interface RepoRowProps {
  repo: ScoredRepo
  verdict?: AiVerdict
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  unstarring?: boolean
}

export function RepoRow({ repo, verdict, selected, onSelectedChange, unstarring }: RepoRowProps) {
  const detailUrl = `/repo/${repo.owner}/${repo.name}`

  return (
    <li
      onClick={() => window.open(detailUrl, '_blank', 'noopener')}
      className={cn(
        'group flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0',
        selected ? 'bg-accent-soft/60' : 'hover:bg-muted/60',
        unstarring && 'pointer-events-none opacity-40',
      )}
    >
      <div className="pt-0.5">
        <Checkbox checked={selected} onCheckedChange={onSelectedChange} aria-label={`Select ${repo.fullName}`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <a
            href={detailUrl}
            target="_blank"
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-sm leading-5 hover:underline"
          >
            <span className="text-muted-foreground">{repo.owner}/</span>
            <span className="font-semibold">{repo.name}</span>
          </a>
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Open ${repo.fullName} on GitHub`}
            className="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
          </a>

          {verdict && (
            <Badge variant={verdict.verdict === 'unstar' ? 'red' : verdict.verdict === 'keep' ? 'green' : 'neutral'}>
              ai: {verdict.verdict}
            </Badge>
          )}
          {repo.signals.map((s) => (
            <Badge key={s} variant={s === 'archived' || s === 'deprecated' ? 'red' : 'flag'}>
              {SIGNAL_LABELS[s]}
            </Badge>
          ))}
        </div>

        {(verdict?.reason || repo.description) && (
          <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">
            {verdict?.reason ?? repo.description}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-faint">
          {repo.language && <span>{repo.language}</span>}
          <span className="inline-flex items-center gap-0.5">
            <Star className="h-3 w-3" />
            {formatCount(repo.stargazersCount)}
          </span>
          <span>pushed {timeAgo(repo.pushedAt)}</span>
          <span>starred {timeAgo(repo.starredAt)}</span>
        </div>
      </div>
    </li>
  )
}
