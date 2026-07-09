import { createFileRoute } from '@tanstack/react-router'
import { deleteCookie, getCookie } from '@tanstack/react-start/server'
import { env } from '#/server/env'
import { exchangeCode, fetchViewer } from '#/server/github'
import { getAppSession } from '#/server/session'

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to } })
}

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const expectedState = getCookie('gh_oauth_state')
        deleteCookie('gh_oauth_state')

        if (!code || !state || !expectedState || state !== expectedState) {
          return redirect('/?error=oauth_state')
        }

        try {
          const token = await exchangeCode({
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            code,
            redirectUri: `${url.origin}/api/auth/callback`,
          })
          const viewer = await fetchViewer(token)

          const session = await getAppSession()
          await session.update({
            token,
            login: viewer.login,
            name: viewer.name,
            avatarUrl: viewer.avatarUrl,
          })

          return redirect('/dashboard')
        } catch (err) {
          console.error('OAuth callback failed:', err)
          return redirect('/?error=oauth_failed')
        }
      },
    },
  },
})
