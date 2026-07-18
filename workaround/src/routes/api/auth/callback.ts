import { createFileRoute } from '@tanstack/react-router'
import { completeGitHubLogin } from '#/server/services/auth'

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: ({ request }) => completeGitHubLogin(request),
    },
  },
})
