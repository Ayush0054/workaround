import { createFileRoute } from '@tanstack/react-router'
import { getAppSession } from '#/server/session'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        const session = await getAppSession()
        await session.clear()
        return new Response(null, { status: 302, headers: { Location: '/' } })
      },
    },
  },
})
