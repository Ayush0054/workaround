import { createFileRoute } from '@tanstack/react-router'
import { setCookie } from '@tanstack/react-start/server'
import { env } from '#/server/env'

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const state = crypto.randomUUID()
        setCookie('gh_oauth_state', state, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 600,
        })

        const origin = new URL(request.url).origin
        const authorize = new URL('https://github.com/login/oauth/authorize')
        authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID)
        authorize.searchParams.set('redirect_uri', `${origin}/api/auth/callback`)
        authorize.searchParams.set('state', state)
        // Ignored by GitHub Apps (which use fine-grained "Starring" permission);
        // needed for classic OAuth apps to star/unstar public repos.
        authorize.searchParams.set('scope', 'public_repo')

        return new Response(null, {
          status: 302,
          headers: { Location: authorize.toString() },
        })
      },
    },
  },
})
