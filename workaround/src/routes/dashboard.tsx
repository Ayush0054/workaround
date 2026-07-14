import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getAuth, getStars } from '#/lib/functions'
import { DashboardPage } from '#/pages/Dashboard'

export const Route = createFileRoute('/dashboard')({
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  loader: async () => {
    const auth = await getAuth()
    if (!auth) {
      return {
        auth: null,
        repos: [],
        truncated: false,
        aiEnabled: false,
        queueEnabled: false,
        savedVerdicts: [],
      }
    }

    return { auth, ...(await getStars()) }
  },
  // Star fetching walks the whole paginated list on GitHub — reuse it for a
  // few minutes instead of re-fetching on every navigation (manual ⟳ to force).
  staleTime: 5 * 60 * 1000,
  component: DashboardRoute,
})

function DashboardRoute() {
  const router = useRouter()
  const { error } = Route.useSearch()
  const { auth, ...data } = Route.useLoaderData()

  return (
    <DashboardPage
      auth={auth}
      authError={error}
      {...data}
      onRefresh={() => void router.invalidate()}
    />
  )
}
