import { createFileRoute } from '@tanstack/react-router'
import { startGitHubLogin } from '#/server/services/auth'

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      GET: ({ request }) => startGitHubLogin(request),
    },
  },
})
