import { env as workerEnv } from 'cloudflare:workers'
import type { SweepMessage } from '#/types/sweep'

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
  /** Full Cloudflare AI Gateway chat-completions endpoint. */
  CLOUDFLARE_AI_GATEWAY_URL?: string
  /** Scoped Cloudflare token with AI Gateway Run access. */
  CLOUDFLARE_AI_API_TOKEN?: string
  /** Optional. Defaults to the account's `default` AI Gateway. */
  CLOUDFLARE_AI_GATEWAY_ID?: string
  /** Provider-prefixed model name, e.g. openai/gpt-5.4-mini. */
  CLOUDFLARE_AI_MODEL?: string
  /** Durable sweep progress and item state. */
  DB?: D1Database
  /** Background unstar work. */
  UNSTAR_QUEUE?: Queue<SweepMessage>
  /** Custom product analytics events. */
  ANALYTICS?: AnalyticsEngineDataset
}

export const env: AppEnv = workerEnv
