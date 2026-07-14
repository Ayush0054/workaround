import { env as workerEnv } from 'cloudflare:workers'
import type { SweepMessage } from './sweep'

export interface AppEnv {
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  /** 32+ char random string used to encrypt the session cookie */
  SESSION_SECRET: string
  /**
   * Optional. Cloudflare AI Gateway endpoint for Anthropic, e.g.
   * https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/anthropic
   * Falls back to the Anthropic API directly when unset.
   */
  AI_GATEWAY_URL?: string
  /** Optional. Enables AI suggestions when set. */
  ANTHROPIC_API_KEY?: string
  /** Optional. Defaults to claude-opus-4-8. */
  AI_MODEL?: string
  /** Durable sweep progress and item state. */
  DB?: D1Database
  /** Background unstar work. */
  UNSTAR_QUEUE?: Queue<SweepMessage>
}

export const env = workerEnv as unknown as AppEnv
