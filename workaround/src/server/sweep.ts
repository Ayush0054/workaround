import { seal, unseal } from './crypto'
import { env } from './env'
import { unstarRepo } from './github'

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

export type SweepStatus = {
  jobId: string
  total: number
  done: number
  failed: number
}

const MAX_ATTEMPTS = 3
const ITEM_INSERT_CHUNK = 20
const QUEUE_SEND_CHUNK = 100

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
    db().prepare(`CREATE INDEX IF NOT EXISTS idx_sweep_jobs_login ON sweep_jobs (login, created_at)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS idx_sweep_items_status ON sweep_items (job_id, status)`),
  ])
  return schemaReady
}

export async function enqueueSweep(login: string, token: string, targets: SweepTarget[]): Promise<SweepStatus> {
  if (!env.UNSTAR_QUEUE) throw new Error('Queue binding UNSTAR_QUEUE is not configured')
  await ensureSchema()

  const jobId = crypto.randomUUID()
  await db()
    .prepare('INSERT INTO sweep_jobs (job_id, login, total, created_at) VALUES (?, ?, ?, ?)')
    .bind(jobId, login, targets.length, Date.now())
    .run()

  for (let i = 0; i < targets.length; i += ITEM_INSERT_CHUNK) {
    const chunk = targets.slice(i, i + ITEM_INSERT_CHUNK)
    const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ')
    await db()
      .prepare(`INSERT OR IGNORE INTO sweep_items (job_id, full_name, owner, name) VALUES ${placeholders}`)
      .bind(...chunk.flatMap((t) => [jobId, t.fullName, t.owner, t.name]))
      .run()
  }

  const sealedToken = await seal(token)
  for (let i = 0; i < targets.length; i += QUEUE_SEND_CHUNK) {
    await env.UNSTAR_QUEUE.sendBatch(
      targets.slice(i, i + QUEUE_SEND_CHUNK).map((t) => ({
        body: {
          jobId,
          owner: t.owner,
          name: t.name,
          fullName: t.fullName,
          sealedToken,
        } satisfies SweepMessage,
      })),
    )
  }

  return { jobId, total: targets.length, done: 0, failed: 0 }
}

export async function sweepStatus(login: string, jobId: string): Promise<SweepStatus | null> {
  await ensureSchema()
  const row = await db()
    .prepare(
      `SELECT j.total AS total,
              SUM(CASE WHEN i.status = 'done' THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN i.status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM sweep_jobs j
       LEFT JOIN sweep_items i ON i.job_id = j.job_id
       WHERE j.job_id = ? AND j.login = ?
       GROUP BY j.job_id`,
    )
    .bind(jobId, login)
    .first<{ total: number; done: number | null; failed: number | null }>()
  if (!row) return null
  return { jobId, total: row.total, done: row.done ?? 0, failed: row.failed ?? 0 }
}

export type ActiveSweep = SweepStatus & { pending: string[] }

/** Unfinished jobs from the last 24h — lets a fresh dashboard load resume progress. */
export async function activeSweeps(login: string): Promise<ActiveSweep[]> {
  await ensureSchema()
  const jobs = await db()
    .prepare(
      `SELECT job_id, total FROM sweep_jobs
       WHERE login = ? AND created_at > ?
       ORDER BY created_at DESC LIMIT 5`,
    )
    .bind(login, Date.now() - 24 * 60 * 60 * 1000)
    .all<{ job_id: string; total: number }>()

  const active: ActiveSweep[] = []
  for (const job of jobs.results) {
    const items = await db()
      .prepare(`SELECT full_name, status FROM sweep_items WHERE job_id = ?`)
      .bind(job.job_id)
      .all<{ full_name: string; status: string }>()
    const pending = items.results.filter((i) => i.status === 'pending').map((i) => i.full_name)
    if (pending.length === 0) continue
    const failed = items.results.filter((i) => i.status === 'failed').length
    active.push({
      jobId: job.job_id,
      total: job.total,
      done: items.results.length - pending.length - failed,
      failed,
      pending,
    })
  }
  return active
}

/** Queue consumer — one unstar per message, status recorded in D1. */
export async function handleSweepBatch(batch: MessageBatch<SweepMessage>): Promise<void> {
  await ensureSchema()
  for (const message of batch.messages) {
    const { jobId, owner, name, fullName, sealedToken } = message.body
    try {
      const token = await unseal(sealedToken)
      await unstarRepo(token, owner, name)
      await db()
        .prepare(`UPDATE sweep_items SET status = 'done' WHERE job_id = ? AND full_name = ?`)
        .bind(jobId, fullName)
        .run()
      message.ack()
    } catch (err) {
      if (message.attempts >= MAX_ATTEMPTS) {
        await db()
          .prepare(`UPDATE sweep_items SET status = 'failed', error = ? WHERE job_id = ? AND full_name = ?`)
          .bind(err instanceof Error ? err.message : String(err), jobId, fullName)
          .run()
        message.ack()
      } else {
        // Back off — GitHub secondary rate limits punish write bursts
        message.retry({ delaySeconds: 15 * message.attempts })
      }
    }
  }
}
