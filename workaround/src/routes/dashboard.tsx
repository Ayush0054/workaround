import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuth, getStars } from '#/server/routes'
import { DashboardPage } from '#/pages/Dashboard'

export const Route = createFileRoute('/dashboard')({
  loader: async () => {
    const auth = await getAuth()
    if (!auth) throw redirect({ to: '/' })

    return {
      auth,
      ...(await getStars()),
    }
  },
  // Star fetching walks the whole paginated list on GitHub — reuse it for a
  // few minutes instead of re-fetching on every navigation (manual ⟳ to force).
  staleTime: 5 * 60 * 1000,
  component: DashboardRoute,
})

function DashboardRoute() {
  const { auth, ...repositories } = Route.useLoaderData()

  return <DashboardPage auth={auth} repositories={repositories} />
}
