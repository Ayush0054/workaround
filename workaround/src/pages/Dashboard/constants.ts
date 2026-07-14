import type { Signal } from '#/lib/repo-scoring'
import type { DashboardFilter } from './types'

export const CONFIRMATION_TIMEOUT_MS = 4000

/** GitHub recommends serial writes when secondary rate limits are possible. */
export const UNSTAR_PACING_MS = 1000
export const SWEEP_POLL_INTERVAL_MS = 5000

export const FILTER_LABELS: ReadonlyArray<{
  value: Exclude<DashboardFilter, 'nlp'>
  label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'ai', label: 'AI verdicts' },
]

export const AI_VERDICT_ORDER = {
  unstar: 0,
  unsure: 1,
  keep: 2,
} as const

export const SIGNAL_LABELS: Record<Signal, string> = {
  archived: 'archived',
  deprecated: 'deprecated',
  'very-stale': 'no commits 4y+',
  stale: 'no commits 2y+',
  'old-star': 'starred 3y+ ago',
}
