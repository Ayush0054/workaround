import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getAuth, getStars } from '#/lib/functions'
import { DashboardPage } from '#/pages/Dashboard'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const auth = await getAuth()
    if (!auth) throw redirect({ to: '/' })
    return { auth }
  },
  loader: () => getStars(),
  // Star fetching walks the whole paginated list on GitHub — reuse it for a
  // few minutes instead of re-fetching on every navigation (manual ⟳ to force).
  staleTime: 5 * 60 * 1000,
  component: DashboardRoute,
})

function DashboardRoute() {
  const router = useRouter()
  const { auth } = Route.useRouteContext()
  const data = Route.useLoaderData()

  return <DashboardPage auth={auth} {...data} onRefresh={() => void router.invalidate()} />
}
