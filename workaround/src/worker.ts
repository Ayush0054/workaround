import startEntry from '@tanstack/react-start/server-entry'
import { handleSweepBatch } from './server/services/sweep'
import { trackRequest } from './server/services/analytics'
import type { AppEnv } from './server/env'
import type { SweepMessage } from './types/sweep'

export default {
  async fetch(request: Request) {
    const startedAt = Date.now()
    const response = await startEntry.fetch(request)
    trackRequest(request, response, Date.now() - startedAt)
    return response
  },
  async queue(batch: MessageBatch<SweepMessage>) {
    await handleSweepBatch(batch)
  },
} satisfies ExportedHandler<AppEnv, SweepMessage>
