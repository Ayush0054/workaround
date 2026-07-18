import { drizzle } from 'drizzle-orm/d1'
import { env } from '../env'
import * as schema from './schema'

export function database() {
  if (!env.DB) throw new Error('D1 binding DB is not configured')
  return drizzle(env.DB, { schema })
}

export function optionalDatabase() {
  return env.DB ? drizzle(env.DB, { schema }) : null
}
