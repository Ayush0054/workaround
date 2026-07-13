import { Sparkles } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import type { ScoredRepo } from '#/lib/repo-scoring'
import type { SearchResult } from '#/server/github'
import type { AiVerdict } from '#/server/suggest'
import type { DashboardFilter } from '../types'
import { GitHubResults } from './GitHubResults'
import { RepoRow } from './RepoRow'

interface RepositoryResultsProps {
  visibleRepos: ScoredRepo[]
  liveCount: number
  filter: DashboardFilter
  selected: ReadonlySet<string>
  selectedCount: number
  inFlight: ReadonlySet<string>
  verdicts: Record<string, AiVerdict>
  allVisibleSelected: boolean
  someVisibleSelected: boolean
  githubResults: SearchResult[] | null
  translatedQuery: string | null
  githubBusyRepos: ReadonlySet<string>
  isGithubRepoStarred: (fullName: string) => boolean
  onToggleAllVisible: (selected: boolean) => void
  onToggleRepo: (fullName: string, selected: boolean) => void
  onToggleGithubStar: (result: SearchResult) => void
  onDismissGithubResults: () => void
}

export function RepositoryResults({
  visibleRepos,
  liveCount,
  filter,
  selected,
  selectedCount,
  inFlight,
  verdicts,
  allVisibleSelected,
  someVisibleSelected,
  githubResults,
  translatedQuery,
  githubBusyRepos,
  isGithubRepoStarred,
  onToggleAllVisible,
  onToggleRepo,
  onToggleGithubStar,
  onDismissGithubResults,
}: RepositoryResultsProps) {
  return (
    <div
      role="region"
      aria-label="Repository results"
      tabIndex={0}
      className="rise-in min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-muted/95 px-4 py-2 backdrop-blur">
        <Checkbox
          checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
          onCheckedChange={onToggleAllVisible}
          aria-label="Select all visible"
        />
        <span className="font-mono text-xs text-muted-foreground">
          {visibleRepos.length} shown{selectedCount > 0 && ` · ${selectedCount} selected`}
        </span>
        {filter === 'ai' && Object.keys(verdicts).length > 0 && (
          <Badge variant="flag" className="ml-auto">
            <Sparkles className="h-3 w-3" />
            {Object.keys(verdicts).length} reviewed
          </Badge>
        )}
      </div>

      {visibleRepos.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {liveCount === 0
              ? 'No starred repos found — nothing to sweep.'
              : filter === 'ai'
                ? 'No AI verdicts yet — run an AI review on your flagged repos.'
                : filter === 'nlp'
                  ? 'No starred repos matched that description.'
                  : 'Nothing matches this filter.'}
          </p>
        </div>
      ) : (
        <ul>
          {visibleRepos.map((repo) => (
            <RepoRow
              key={repo.id}
              repo={repo}
              verdict={verdicts[repo.fullName]}
              selected={selected.has(repo.fullName)}
              onSelectedChange={(next) => onToggleRepo(repo.fullName, next)}
              unstarring={inFlight.has(repo.fullName)}
            />
          ))}
        </ul>
      )}

      {githubResults !== null && (
        <GitHubResults
          results={githubResults}
          translatedQuery={translatedQuery}
          busyRepos={githubBusyRepos}
          isStarred={isGithubRepoStarred}
          onToggleStar={onToggleGithubStar}
          onDismiss={onDismissGithubResults}
        />
      )}
    </div>
  )
}
