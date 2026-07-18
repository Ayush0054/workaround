import { Github, Star } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import { cn, formatCount, timeAgo } from '#/lib/utils'
import type { ScoredRepo } from '#/lib/repo-scoring'
import type { AiVerdict } from '#/types/ai'
import { SIGNAL_LABELS } from '../constants'

interface RepoRowProps {
  repo: ScoredRepo
  verdict?: AiVerdict
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  unstarring?: boolean
}

export function RepoRow({
  repo,
  verdict,
  selected,
  onSelectedChange,
  unstarring,
}: RepoRowProps) {
  const detailUrl = `/repo/${repo.owner}/${repo.name}`

  return (
    <tr
      className={cn(
        'group border-b border-border transition-colors last:border-b-0',
        selected ? 'bg-accent-soft/60' : 'hover:bg-muted/60',
        unstarring && 'pointer-events-none opacity-40',
      )}
    >
      <td className="w-10 px-4 py-3 align-top">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelectedChange}
          aria-label={`Select ${repo.fullName}`}
        />
      </td>

      <td className="min-w-0 py-3 pr-4 align-top">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <a
            href={detailUrl}
            target="_blank"
            rel="noopener"
            onClick={(event) => event.stopPropagation()}
            className="font-mono text-sm leading-5 hover:underline"
          >
            <span className="text-muted-foreground">{repo.owner}/</span>
            <span className="font-semibold">{repo.name}</span>
          </a>
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Open ${repo.fullName} on GitHub`}
            className="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
          </a>

          {verdict && (
            <Badge
              variant={
                verdict.verdict === 'unstar'
                  ? 'red'
                  : verdict.verdict === 'keep'
                    ? 'green'
                    : 'neutral'
              }
            >
              ai: {verdict.verdict}
            </Badge>
          )}
          {repo.signals.map((signal) => (
            <Badge
              key={signal}
              variant={
                signal === 'archived' || signal === 'deprecated'
                  ? 'red'
                  : 'flag'
              }
            >
              {SIGNAL_LABELS[signal]}
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
      </td>
    </tr>
  )
}
