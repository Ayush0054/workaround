export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export function getSweepFailureHint(error: string | null): string {
  if (error?.includes('(403)')) {
    return 'A 403 usually means this session is not using the configured GitHub OAuth App, or GitHub is rate-limiting writes.'
  }
  if (error?.includes('(429)')) {
    return 'GitHub is rate-limiting writes — give it a minute and sweep again.'
  }
  return 'If this keeps happening, restart the dev server and hard-refresh this page.'
}
