import startEntry from '@tanstack/react-start/server-entry'
import { handleSweepBatch } from './server/sweep'
import type { AppEnv } from './server/env'
import type { SweepMessage } from './server/sweep'

export default {
  fetch: startEntry.fetch,
  async queue(batch: MessageBatch<SweepMessage>) {
    await handleSweepBatch(batch)
  },
} satisfies ExportedHandler<AppEnv, SweepMessage>
