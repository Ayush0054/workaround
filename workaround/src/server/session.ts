import { useSession } from '@tanstack/react-start/server'
import { env } from './env'

export type SessionData = {
  token?: string
  login?: string
  name?: string | null
  avatarUrl?: string
}

export function getAppSession() {
  return useSession<SessionData>({
    password: env.SESSION_SECRET,
    name: 'workaround_session',
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    },
  })
}
