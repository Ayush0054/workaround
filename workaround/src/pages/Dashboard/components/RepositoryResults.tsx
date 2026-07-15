import { Loader2, Sparkles } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
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
  flaggedCount: number
  reviewedCount: number
  filter: DashboardFilter
  aiEnabled: boolean
  analyzing: boolean
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
  onAnalyze: () => void
  onToggleRepo: (fullName: string, selected: boolean) => void
  onToggleGithubStar: (result: SearchResult) => void
  onDismissGithubResults: () => void
}

export function RepositoryResults({
  visibleRepos,
  liveCount,
  flaggedCount,
  reviewedCount,
  filter,
  aiEnabled,
  analyzing,
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
  onAnalyze,
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
        {filter === 'ai' && reviewedCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="flag">
              <Sparkles className="h-3 w-3" />
              {reviewedCount} reviewed
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onAnalyze}
              disabled={!aiEnabled || analyzing || flaggedCount === 0}
              title={aiEnabled ? undefined : 'Configure an AI provider to enable AI review'}
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {analyzing ? 'Reviewing…' : 'Re-run AI review'}
            </Button>
          </div>
        )}
      </div>

      {visibleRepos.length === 0 ? (
        filter === 'ai' ? (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent-strong">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {reviewedCount > 0
                ? 'No AI verdicts match this filter.'
                : flaggedCount === 0
                  ? 'No flagged repositories to review.'
                  : 'No AI verdicts yet.'}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {reviewedCount > 0
                ? 'Clear the current search to see all reviewed repositories.'
                : flaggedCount === 0
                  ? 'When a repository is flagged, you can ask AI whether it is still worth keeping.'
                  : 'Review your flagged repositories and get a keep, unstar, or unsure verdict for each one.'}
            </p>
            {reviewedCount === 0 && (
              <Button
                variant="accent"
                size="sm"
                onClick={onAnalyze}
                disabled={!aiEnabled || analyzing || flaggedCount === 0}
                title={aiEnabled ? undefined : 'Configure an AI provider to enable AI review'}
                className="mt-5"
              >
                {analyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {analyzing ? 'Reviewing…' : 'Run AI review'}
              </Button>
            )}
          </div>
        ) : (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {liveCount === 0
                ? 'No starred repos found — nothing to sweep.'
                : filter === 'nlp'
                  ? 'No starred repos matched that description.'
                  : 'Nothing matches this filter.'}
            </p>
          </div>
        )
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
