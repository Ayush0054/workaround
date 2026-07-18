import { desc, eq, sql } from 'drizzle-orm'
import { aiVerdicts } from '../db/schema'
import { optionalDatabase } from '../db/client'
import type { AiVerdict } from '#/types/ai'

const WRITE_CHUNK = 100

export async function loadAiVerdicts(login: string): Promise<AiVerdict[]> {
  const database = optionalDatabase()
  if (!database) return []

  const rows = await database
    .select({
      fullName: aiVerdicts.fullName,
      verdict: aiVerdicts.verdict,
      reason: aiVerdicts.reason,
    })
    .from(aiVerdicts)
    .where(eq(aiVerdicts.login, login.toLowerCase()))
    .orderBy(desc(aiVerdicts.reviewedAt))

  return rows.map((row) => ({
    fullName: row.fullName,
    verdict: row.verdict,
    reason: row.reason,
  }))
}

export async function saveAiVerdicts(
  login: string,
  verdicts: AiVerdict[],
): Promise<void> {
  const database = optionalDatabase()
  if (!database || verdicts.length === 0) return

  const owner = login.toLowerCase()
  const reviewedAt = Date.now()
  for (let index = 0; index < verdicts.length; index += WRITE_CHUNK) {
    await database
      .insert(aiVerdicts)
      .values(
        verdicts.slice(index, index + WRITE_CHUNK).map((verdict) => ({
          login: owner,
          fullName: verdict.fullName,
          verdict: verdict.verdict,
          reason: verdict.reason,
          reviewedAt,
        })),
      )
      .onConflictDoUpdate({
        target: [aiVerdicts.login, aiVerdicts.fullName],
        set: {
          verdict: sql`excluded.verdict`,
          reason: sql`excluded.reason`,
          reviewedAt: sql`excluded.reviewed_at`,
        },
      })
  }
}
