import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { Either } from 'effect'
import { attempt, originalError, runResult } from '#/lib/errors'
import { env } from '../env'
import { getAppSession } from '../session'
import { redirect } from '../utils/http'
import { exchangeCode, fetchViewer, isGitHubAppUserToken } from './github'
import { upsertUser } from './users'
import { trackEvent } from './analytics'

const OAUTH_STATE_COOKIE = 'gh_oauth_state'

export async function requireSession(): Promise<{
  login: string
  token: string
}> {
  const session = await getAppSession()
  const { login, token } = session.data
  if (!login || !token) throw new Error('Not signed in')
  return { login, token }
}

export async function requireToken(): Promise<string> {
  return (await requireSession()).token
}

export async function getAuthProfile() {
  if (!env.SESSION_SECRET) return null

  const session = await getAppSession()
  if (!session.data.token || !session.data.login) return null
  return {
    login: session.data.login,
    name: session.data.name ?? null,
    email: session.data.email ?? null,
    avatarUrl: session.data.avatarUrl ?? '',
  }
}

export function startGitHubLogin(request: Request): Response {
  const state = crypto.randomUUID()
  setCookie(OAUTH_STATE_COOKIE, state, {
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
  authorize.searchParams.set('scope', 'public_repo user:email')

  return redirect(authorize.toString())
}

export async function completeGitHubLogin(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expectedState = getCookie(OAUTH_STATE_COOKIE)
  deleteCookie(OAUTH_STATE_COOKIE, { path: '/' })

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirect('/?error=oauth_state')
  }

  const result = await runResult(
    attempt(async () => {
      const token = await exchangeCode({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        code,
        redirectUri: `${url.origin}/api/auth/callback`,
      })
      if (isGitHubAppUserToken(token)) {
        return redirect('/?error=github_app_unsupported')
      }

      const viewer = await fetchViewer(token)
      await upsertUser(viewer)
      trackEvent({ name: 'sign_in', dimension: 'github' })

      const session = await getAppSession()
      await session.update({
        token,
        githubId: viewer.id,
        login: viewer.login,
        name: viewer.name,
        email: viewer.email,
        avatarUrl: viewer.avatarUrl,
      })

      return redirect('/dashboard')
    }, 'GitHub sign-in failed'),
  )

  if (Either.isLeft(result)) {
    console.error('OAuth callback failed:', originalError(result.left))
    return redirect('/?error=oauth_failed')
  }

  return result.right
}

export async function signOut(): Promise<Response> {
  const session = await getAppSession()
  await session.clear()
  return redirect('/')
}
