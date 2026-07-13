import { Github, Loader2, Star, X } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { formatCount, timeAgo } from '#/lib/utils'
import type { SearchResult } from '#/server/github'

interface GitHubResultsProps {
  results: SearchResult[]
  translatedQuery: string | null
  busyRepos: ReadonlySet<string>
  isStarred: (fullName: string) => boolean
  onToggleStar: (result: SearchResult) => void
  onDismiss: () => void
}

export function GitHubResults({
  results,
  translatedQuery,
  busyRepos,
  isStarred,
  onToggleStar,
  onDismiss,
}: GitHubResultsProps) {
  return (
    <section className="rise-in mx-4 mt-6 mb-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
        <Github className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground">
          {results.length} from GitHub
          {translatedQuery && <span className="text-faint"> · query: {translatedQuery}</span>}
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss GitHub results"
          className="ml-auto cursor-pointer text-faint hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {results.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          GitHub search found nothing for that description.
        </p>
      ) : (
        <ul>
          {results.map((result) => {
            const starred = isStarred(result.fullName)
            const busy = busyRepos.has(result.fullName)
            return (
              <li
                key={result.id}
                className="group flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <a
                      href={`/repo/${result.owner}/${result.name}`}
                      target="_blank"
                      rel="noopener"
                      className="font-mono text-sm leading-5 hover:underline"
                    >
                      <span className="text-muted-foreground">{result.owner}/</span>
                      <span className="font-semibold">{result.name}</span>
                    </a>
                    <a
                      href={result.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${result.fullName} on GitHub`}
                      className="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                    >
                      <Github className="h-3.5 w-3.5" />
                    </a>
                    {starred && <Badge variant="flag">starred</Badge>}
                    {result.archived && <Badge variant="red">archived</Badge>}
                  </div>
                  {result.description && (
                    <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">
                      {result.description}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-faint">
                    {result.language && <span>{result.language}</span>}
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-3 w-3" />
                      {formatCount(result.stargazersCount)}
                    </span>
                    <span>pushed {timeAgo(result.pushedAt)}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => onToggleStar(result)}>
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Star className={starred ? 'h-3.5 w-3.5 fill-accent text-accent-strong' : 'h-3.5 w-3.5'} />
                  )}
                  {starred ? 'Unstar' : 'Star'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
