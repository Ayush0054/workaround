import { useSession as getSession } from '@tanstack/react-start/server'
import { env } from './env'
import type { SessionData } from './types/session'

export function getAppSession() {
  return getSession<SessionData>({
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
