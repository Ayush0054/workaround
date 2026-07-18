import { env } from '../env'
import type { AnalyticsEvent } from '../types/analytics'

export function trackEvent({
  name,
  dimension = '-',
  status = '-',
  country = '-',
  value = 1,
  durationMs = 0,
  index = name,
}: AnalyticsEvent): void {
  try {
    env.ANALYTICS?.writeDataPoint({
      blobs: [name, dimension, status, country],
      doubles: [value, durationMs],
      indexes: [index],
    })
  } catch (error) {
    console.warn('Analytics event could not be written', error)
  }
}

function routeName(pathname: string): string {
  if (pathname.startsWith('/repo/')) return '/repo/:owner/:name'
  return pathname
}

export function trackRequest(
  request: Request,
  response: Response,
  durationMs: number,
): void {
  const url = new URL(request.url)
  if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.ico')
    return

  const requestCountry = request.cf?.country
  const country =
    typeof requestCountry === 'string' ? requestCountry : 'unknown'
  trackEvent({
    name: 'request',
    dimension: `${request.method} ${routeName(url.pathname)}`,
    status: String(response.status),
    country,
    durationMs,
    index: url.hostname,
  })
}
