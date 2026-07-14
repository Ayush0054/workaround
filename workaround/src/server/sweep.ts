import { Effect, Either } from 'effect'
import { attempt, getErrorMessage, originalError, runResult } from '#/lib/errors'
import { seal, unseal } from './crypto'
import { env } from './env'
import { GitHubApiError, unstarRepo } from './github'

export type SweepMessage = {
  jobId: string
  owner: string
  name: string
  fullName: string
  sealedToken: string
}

export type SweepTarget = {
  owner: string
  name: string
  fullName: string
}

export type SweepFailure = {
  fullName: string
  error: string
}

export type SweepStatus = {
  jobId: string
  total: number
  done: number
  failed: number
  pending: string[]
  completed: string[]
  failures: SweepFailure[]
}

const ITEM_INSERT_CHUNK = 20
const QUEUE_SEND_CHUNK = 100
const MAX_DELIVERY_ATTEMPTS = 3
const WRITE_PACING_MS = 1000

export function queueConfigured(): boolean {
  return Boolean(env.DB && env.UNSTAR_QUEUE)
}

function db(): D1Database {
  if (!env.DB) throw new Error('D1 binding DB is not configured')
  return env.DB
}

let schemaReady: Promise<unknown> | null = null

function ensureSchema(): Promise<unknown> {
  schemaReady ??= db().batch([
    db().prepare(
      `CREATE TABLE IF NOT EXISTS sweep_jobs (
         job_id TEXT PRIMARY KEY,
         login TEXT NOT NULL,
         total INTEGER NOT NULL,
         created_at INTEGER NOT NULL
       )`,
    ),
    db().prepare(
      `CREATE TABLE IF NOT EXISTS sweep_items (
         job_id TEXT NOT NULL,
         full_name TEXT NOT NULL,
         owner TEXT NOT NULL,
         name TEXT NOT NULL,
         status TEXT NOT NULL DEFAULT 'pending',
         error TEXT,
         PRIMARY KEY (job_id, full_name)
       )`,
    ),
    db().prepare(
      'CREATE INDEX IF NOT EXISTS idx_sweep_jobs_login ON sweep_jobs (login, created_at)',
    ),
    db().prepare(
      'CREATE INDEX IF NOT EXISTS idx_sweep_items_status ON sweep_items (job_id, status)',
    ),
  ])
  return schemaReady
}

export async function enqueueSweep(
  login: string,
  token: string,
  targets: SweepTarget[],
): Promise<SweepStatus> {
  const queue = env.UNSTAR_QUEUE
  if (!queue) throw new Error('Queue binding UNSTAR_QUEUE is not configured')
  await ensureSchema()

  const jobId = crypto.randomUUID()
  await db()
    .prepare('INSERT INTO sweep_jobs (job_id, login, total, created_at) VALUES (?, ?, ?, ?)')
    .bind(jobId, login, targets.length, Date.now())
    .run()

  for (let index = 0; index < targets.length; index += ITEM_INSERT_CHUNK) {
    const chunk = targets.slice(index, index + ITEM_INSERT_CHUNK)
    const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ')
    await db()
      .prepare(
        `INSERT OR IGNORE INTO sweep_items (job_id, full_name, owner, name) VALUES ${placeholders}`,
      )
      .bind(...chunk.flatMap((target) => [jobId, target.fullName, target.owner, target.name]))
      .run()
  }

  const sealedToken = await seal(token)
  for (let index = 0; index < targets.length; index += QUEUE_SEND_CHUNK) {
    const published = await runResult(
      attempt(
        () =>
          queue.sendBatch(
            targets.slice(index, index + QUEUE_SEND_CHUNK).map((target) => ({
              body: {
                jobId,
                owner: target.owner,
                name: target.name,
                fullName: target.fullName,
                sealedToken,
              },
            })),
          ),
        'Could not publish sweep work to Cloudflare Queue',
      ),
    )
    if (Either.isLeft(published)) {
      const error = getErrorMessage(originalError(published.left))
      const unsent = targets.slice(index)
      for (let itemIndex = 0; itemIndex < unsent.length; itemIndex += ITEM_INSERT_CHUNK) {
        const chunk = unsent.slice(itemIndex, itemIndex + ITEM_INSERT_CHUNK)
        const placeholders = chunk.map(() => '?').join(', ')
        await db()
          .prepare(
            `UPDATE sweep_items SET status = 'failed', error = ?
             WHERE job_id = ? AND full_name IN (${placeholders})`,
          )
          .bind(error, jobId, ...chunk.map((target) => target.fullName))
          .run()
      }
      break
    }
  }

  const status = await sweepStatus(login, jobId)
  if (!status) throw new Error('Queued sweep could not be read back from D1')
  return status
}

export async function sweepStatus(login: string, jobId: string): Promise<SweepStatus | null> {
  await ensureSchema()
  const job = await db()
    .prepare('SELECT total FROM sweep_jobs WHERE job_id = ? AND login = ?')
    .bind(jobId, login)
    .first<{ total: number }>()
  if (!job) return null

  const items = await db()
    .prepare('SELECT full_name, status, error FROM sweep_items WHERE job_id = ?')
    .bind(jobId)
    .all<{ full_name: string; status: 'pending' | 'done' | 'failed'; error: string | null }>()

  const completed: string[] = []
  const pending: string[] = []
  const failures: SweepFailure[] = []
  for (const item of items.results) {
    if (item.status === 'done') completed.push(item.full_name)
    else if (item.status === 'failed') {
      failures.push({ fullName: item.full_name, error: item.error ?? 'Unknown error' })
    } else pending.push(item.full_name)
  }

  return {
    jobId,
    total: job.total,
    done: completed.length,
    failed: failures.length,
    pending,
    completed,
    failures,
  }
}

/** Unfinished jobs from the last 24 hours, newest first. */
export async function activeSweeps(login: string): Promise<SweepStatus[]> {
  await ensureSchema()
  const jobs = await db()
    .prepare(
      `SELECT job_id FROM sweep_jobs
       WHERE login = ? AND created_at > ?
       ORDER BY created_at DESC LIMIT 5`,
    )
    .bind(login, Date.now() - 24 * 60 * 60 * 1000)
    .all<{ job_id: string }>()

  const statuses: SweepStatus[] = []
  for (const job of jobs.results) {
    const status = await sweepStatus(login, job.job_id)
    if (status && status.done + status.failed < status.total) statuses.push(status)
  }
  return statuses
}

async function itemAlreadyFinished(jobId: string, fullName: string): Promise<boolean> {
  const item = await db()
    .prepare('SELECT status FROM sweep_items WHERE job_id = ? AND full_name = ?')
    .bind(jobId, fullName)
    .first<{ status: string }>()
  return item?.status === 'done' || item?.status === 'failed'
}

async function processMessage(
  message: Message<SweepMessage>,
): Promise<{ retryDelaySeconds: number } | null> {
  const { jobId, owner, name, fullName, sealedToken } = message.body
  if (await itemAlreadyFinished(jobId, fullName)) {
    message.ack()
    return null
  }

  const outcome = await runResult(
    attempt(async () => {
      const token = await unseal(sealedToken)
      await unstarRepo(token, owner, name)
      await db()
        .prepare(
          "UPDATE sweep_items SET status = 'done', error = NULL WHERE job_id = ? AND full_name = ?",
        )
        .bind(jobId, fullName)
        .run()
    }, `Unstar failed for ${fullName}`),
  )

  if (Either.isRight(outcome)) {
    message.ack()
    return null
  }

  const cause = originalError(outcome.left)
  if (message.attempts >= MAX_DELIVERY_ATTEMPTS) {
    await db()
      .prepare(
        "UPDATE sweep_items SET status = 'failed', error = ? WHERE job_id = ? AND full_name = ?",
      )
      .bind(getErrorMessage(cause), jobId, fullName)
      .run()
    message.ack()
    return null
  }

  const retryAfter = cause instanceof GitHubApiError ? cause.retryAfterSeconds : undefined
  const retryDelaySeconds = retryAfter ?? 15 * message.attempts
  message.retry({ delaySeconds: retryDelaySeconds })
  return { retryDelaySeconds }
}

/** Process writes serially; Wrangler also caps this consumer at one concurrent invocation. */
export async function handleSweepBatch(batch: MessageBatch<SweepMessage>): Promise<void> {
  await ensureSchema()
  for (const [index, message] of batch.messages.entries()) {
    const outcome = await processMessage(message)
    if (outcome) {
      for (const waiting of batch.messages.slice(index + 1)) {
        waiting.retry({ delaySeconds: outcome.retryDelaySeconds })
      }
      break
    }
    if (index < batch.messages.length - 1) {
      await Effect.runPromise(Effect.sleep(WRITE_PACING_MS))
    }
  }
}
