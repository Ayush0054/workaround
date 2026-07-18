import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingPage } from '#/pages/Landing'
import { landingSearchSchema } from '#/pages/Landing/schemas'
import { getAuth } from '#/server/routes'

export const Route = createFileRoute('/')({
  validateSearch: landingSearchSchema,
  beforeLoad: async () => {
    if (await getAuth()) throw redirect({ to: '/dashboard' })
  },
  component: LandingRoute,
})

function LandingRoute() {
  const { error } = Route.useSearch()
  return <LandingPage error={error} />
}
