import { desc } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    githubId: integer('github_id').primaryKey(),
    login: text('login').notNull(),
    name: text('name'),
    email: text('email'),
    avatarUrl: text('avatar_url').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    lastLoginAt: integer('last_login_at').notNull(),
  },
  (table) => [index('idx_users_login').on(table.login)],
)

export const sweepJobs = sqliteTable(
  'sweep_jobs',
  {
    jobId: text('job_id').primaryKey(),
    login: text('login').notNull(),
    total: integer('total').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_sweep_jobs_login').on(table.login, table.createdAt)],
)

export const sweepItems = sqliteTable(
  'sweep_items',
  {
    jobId: text('job_id').notNull(),
    fullName: text('full_name').notNull(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    status: text('status', { enum: ['pending', 'done', 'failed'] })
      .notNull()
      .default('pending'),
    error: text('error'),
  },
  (table) => [
    primaryKey({ columns: [table.jobId, table.fullName] }),
    index('idx_sweep_items_status').on(table.jobId, table.status),
  ],
)

export const aiVerdicts = sqliteTable(
  'ai_verdicts',
  {
    login: text('login').notNull(),
    fullName: text('full_name').notNull(),
    verdict: text('verdict', { enum: ['unstar', 'keep', 'unsure'] }).notNull(),
    reason: text('reason').notNull(),
    reviewedAt: integer('reviewed_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.login, table.fullName] }),
    index('idx_ai_verdicts_login_reviewed').on(
      table.login,
      desc(table.reviewedAt),
    ),
  ],
)

export type UserRecord = typeof users.$inferSelect
