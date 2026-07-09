import startEntry from '@tanstack/react-start/server-entry'
import { handleSweepBatch } from './server/sweep'
import type { SweepMessage } from './server/sweep'

export default {
  fetch: startEntry.fetch,
  async queue(batch: MessageBatch<unknown>) {
    await handleSweepBatch(batch as MessageBatch<SweepMessage>)
  },
}
