import { DashboardLayout } from '#/components/layout'
import {
  DashboardFilters,
  DashboardNotices,
  DashboardOverview,
  DashboardSearch,
  DashboardToolTabs,
  RepositoryResults,
} from './components'
import type { DashboardPageProps } from './types'
import { useDashboard } from './useDashboard'

export function DashboardPage({ auth, repositories }: DashboardPageProps) {
  const dashboard = useDashboard(repositories)

  return (
    <DashboardLayout user={auth}>
      <DashboardToolTabs />

      <section
        id="git-tool-panel"
        role="tabpanel"
        aria-labelledby="git-tool-tab"
        className="flex min-h-0 flex-1 flex-col"
      >
        <DashboardOverview
          liveCount={dashboard.liveCount}
          flaggedCount={dashboard.flaggedCount}
          sweptCount={dashboard.sweptCount}
          selectedCount={dashboard.selectedCount}
          sweeping={dashboard.sweeping}
          confirming={dashboard.confirming}
          onRefresh={dashboard.refreshPage}
          onRequestUnstar={dashboard.requestUnstar}
        />

        <DashboardNotices
          truncated={dashboard.truncated}
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
          onAnalyze={(prompt) => void dashboard.analyze(prompt)}
          onToggleRepo={dashboard.toggleRepo}
          onToggleGithubStar={(result) => void dashboard.toggleGhStar(result)}
          onDismissGithubResults={dashboard.clearGitHubResults}
          loading={dashboard.pageLoading}
        />
      </section>
    </DashboardLayout>
  )
}
