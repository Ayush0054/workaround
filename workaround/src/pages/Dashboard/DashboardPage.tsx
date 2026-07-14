import { AppHeader, AppWordmark } from '#/components/AppHeader'
import { Button } from '#/components/ui/button'
import {
  DashboardFilters,
  DashboardNotices,
  DashboardOverview,
  DashboardSearch,
  DashboardSignedOut,
  DashboardToolTabs,
  RepositoryResults,
} from './components'
import type { DashboardPageProps } from './types'
import { useDashboard } from './useDashboard'

export function DashboardPage({
  auth,
  authError,
  repos,
  truncated,
  aiEnabled,
  queueEnabled,
  savedVerdicts,
  onRefresh,
}: DashboardPageProps) {
  const dashboard = useDashboard({ repos, aiEnabled, queueEnabled, savedVerdicts })

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader>
        <AppWordmark className="text-lg tracking-tight" />
        {auth ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {auth.avatarUrl && (
                <img src={auth.avatarUrl} alt="" className="h-6 w-6 rounded-full border border-border" />
              )}
              <span className="font-mono text-xs text-muted-foreground">{auth.login}</span>
            </div>
            <form action="/api/auth/logout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        ) : null}
      </AppHeader>

      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden px-4 pb-4">
        <DashboardToolTabs />

        <section
          id="git-tool-panel"
          role="tabpanel"
          aria-labelledby="git-tool-tab"
          className="flex min-h-0 flex-1 flex-col"
        >
          {!auth ? (
            <DashboardSignedOut error={authError} />
          ) : (
            <>
              <DashboardOverview
                liveCount={dashboard.liveCount}
                flaggedCount={dashboard.flaggedCount}
                sweptCount={dashboard.sweptCount}
                selectedCount={dashboard.selectedCount}
                sweeping={dashboard.sweeping}
                confirming={dashboard.confirming}
                onRefresh={onRefresh}
                onRequestUnstar={dashboard.requestUnstar}
              />

              <DashboardNotices
                truncated={truncated}
                sweepNotice={dashboard.sweepNotice}
                onDismissSweepNotice={dashboard.dismissSweepNotice}
              />

              <DashboardSearch
                query={dashboard.query}
                scope={dashboard.scope}
                searching={dashboard.searching}
                error={dashboard.searchError}
                onQueryChange={dashboard.setQuery}
                onScopeChange={dashboard.setScope}
                onSearch={() => void dashboard.askAi()}
              />

              <DashboardFilters
                activeFilter={dashboard.filter}
                tabs={dashboard.tabs}
                hasAiMatches={dashboard.nlpMatches !== null}
                onFilterChange={dashboard.setFilter}
                onClearAiMatches={dashboard.clearNlp}
              />

              <RepositoryResults
                visibleRepos={dashboard.visible}
                liveCount={dashboard.liveCount}
                flaggedCount={dashboard.flaggedCount}
                reviewedCount={dashboard.reviewedCount}
                filter={dashboard.filter}
                aiEnabled={dashboard.aiEnabled}
                analyzing={dashboard.analyzing}
                selected={dashboard.selected}
                selectedCount={dashboard.selectedCount}
                inFlight={dashboard.inFlight}
                verdicts={dashboard.verdicts}
                allVisibleSelected={dashboard.allVisibleSelected}
                someVisibleSelected={dashboard.someVisibleSelected}
                githubResults={dashboard.ghResults}
                translatedQuery={dashboard.translatedQuery}
                githubBusyRepos={dashboard.ghBusy}
                isGithubRepoStarred={dashboard.isGhStarred}
                onToggleAllVisible={dashboard.toggleAllVisible}
                onAnalyze={() => void dashboard.analyze()}
                onToggleRepo={dashboard.toggleRepo}
                onToggleGithubStar={(result) => void dashboard.toggleGhStar(result)}
                onDismissGithubResults={dashboard.clearGitHubResults}
              />
            </>
          )}
        </section>
      </main>
    </div>
  )
}
