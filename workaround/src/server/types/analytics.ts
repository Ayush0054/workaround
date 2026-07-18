export interface AnalyticsEvent {
  name: string
  dimension?: string
  status?: string
  country?: string
  value?: number
  durationMs?: number
  index?: string
}
