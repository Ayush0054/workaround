import { env } from './env'
import type { AiVerdict } from './suggest'

const WRITE_CHUNK = 100

function db(): D1Database | null {
  return env.DB ?? null
}

let schemaReady: Promise<unknown> | null = null

function ensureSchema(): Promise<unknown> | null {
  const database = db()
  if (!database) return null
  schemaReady ??= database
    .prepare(
      `CREATE TABLE IF NOT EXISTS ai_verdicts (
         login TEXT NOT NULL,
         full_name TEXT NOT NULL,
         verdict TEXT NOT NULL CHECK (verdict IN ('unstar', 'keep', 'unsure')),
         reason TEXT NOT NULL,
         reviewed_at INTEGER NOT NULL,
         PRIMARY KEY (login, full_name)
       )`,
    )
    .run()
  return schemaReady
}

export async function loadAiVerdicts(login: string): Promise<AiVerdict[]> {
  const database = db()
  if (!database) return []
  await ensureSchema()

  const rows = await database
    .prepare(
      `SELECT full_name, verdict, reason
       FROM ai_verdicts
       WHERE login = ?
       ORDER BY reviewed_at DESC`,
    )
    .bind(login.toLowerCase())
    .all<{ full_name: string; verdict: AiVerdict['verdict']; reason: string }>()

  return rows.results.map((row) => ({
    fullName: row.full_name,
    verdict: row.verdict,
    reason: row.reason,
  }))
}

export async function saveAiVerdicts(login: string, verdicts: AiVerdict[]): Promise<void> {
  const database = db()
  if (!database || verdicts.length === 0) return
  await ensureSchema()

  const owner = login.toLowerCase()
  const reviewedAt = Date.now()
  for (let index = 0; index < verdicts.length; index += WRITE_CHUNK) {
    await database.batch(
      verdicts.slice(index, index + WRITE_CHUNK).map((verdict) =>
        database
          .prepare(
            `INSERT INTO ai_verdicts (login, full_name, verdict, reason, reviewed_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (login, full_name) DO UPDATE SET
               verdict = excluded.verdict,
               reason = excluded.reason,
               reviewed_at = excluded.reviewed_at`,
          )
          .bind(owner, verdict.fullName, verdict.verdict, verdict.reason, reviewedAt),
      ),
    )
  }
}
