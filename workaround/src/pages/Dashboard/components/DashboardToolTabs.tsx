import { GitBranch } from 'lucide-react'

export function DashboardToolTabs() {
  return (
    <nav className="rise-in mb-7 border-b border-border" aria-label="Workaround tools">
      <div role="tablist" aria-label="Available tools">
        <button
          id="git-tool-tab"
          type="button"
          role="tab"
          aria-selected="true"
          aria-controls="git-tool-panel"
          disabled
          className="-mb-px inline-flex h-11 items-center gap-2 border-b-2 border-foreground px-1 text-sm font-semibold text-foreground disabled:cursor-default disabled:opacity-100"
        >
          <GitBranch className="h-4 w-4" />
          Git
        </button>
      </div>
    </nav>
  )
}
