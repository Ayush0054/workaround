import { X } from 'lucide-react'

interface DashboardNoticesProps {
  truncated: boolean
  sweepNotice: string | null
  onDismissSweepNotice: () => void
}

export function DashboardNotices({
  truncated,
  sweepNotice,
  onDismissSweepNotice,
}: DashboardNoticesProps) {
  return (
    <>
      {truncated && (
        <p className="mb-4 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 font-mono text-xs text-accent-strong">
          Showing your 3,000 most recent stars — older ones are not loaded yet.
        </p>
      )}

      {sweepNotice && (
        <p className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
          <span>{sweepNotice}</span>
          <button
            onClick={onDismissSweepNotice}
            aria-label="Dismiss"
            className="shrink-0 cursor-pointer hover:opacity-70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      )}
    </>
  )
}
