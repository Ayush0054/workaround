# Workaround ⭐️🧹

Tidy your GitHub stars. Workaround lists every repo you've starred, flags the dead weight, lets Claude argue about the judgment calls, and sweeps your selection in one go — it can even find repos for you from a plain-English description.

**Stack:** TanStack Start (SSR) · Cloudflare Workers · Tailwind v4 (shadcn-style tokens, light mode) · Anthropic API via Cloudflare AI Gateway · Geist / Geist Mono / Cantarell / Syne Mono.

## Features

- **Flagging (free, deterministic)** — archived, "deprecated" in the description, no commits in 2y/4y, starred 3+ years ago. No AI cost; computed in [src/lib/repo-scoring.ts](src/lib/repo-scoring.ts).
- **AI review** — flagged repos go to Claude, which returns a keep / unstar / unsure verdict with a one-line reason each (structured output, so it always parses).
- **Saved verdicts** — AI review results are stored per GitHub user in D1 and restored when the dashboard reloads.
- **NLP search** — describe a repo in plain English and press Enter:
  - *My stars* — Claude semantically matches the description against your starred repos
  - *All GitHub* — Claude translates the description into a GitHub search query and surfaces non-starred repos you can star in one click (works without an API key too — falls back to raw GitHub search)
  - *Both* — runs the two in parallel
- **Repo pages** — click any row to open `/repo/owner/name` in a new tab: stats, topics, license, and the README as GitHub renders it, plus star/unstar.
- **Bulk sweeps** — selected repositories are published to Cloudflare Queues and processed serially at ~1 unstar/second. D1 stores durable progress, so the sweep continues when the tab closes. Rows disappear only after GitHub confirms the unstar; failures stay in the list with a notice.

## How it works

- **Auth** — GitHub OAuth (authorization-code flow with state check). The access token lives in an encrypted, HttpOnly session cookie (TanStack Start's `useSession`) — no user database.
- **Stars** — fetched from `GET /user/starred` with the `application/vnd.github.star+json` media type so we get `starred_at` timestamps. Paginated 100/page, capped at 3,000 stars (Workers subrequest limits); the UI shows a notice when truncated.
- **Sweeps** — a Queue producer publishes encrypted unstar work, one consumer processes GitHub writes with concurrency capped at one, and D1 stores job/item status for dashboard polling and resume.
- **Verdicts** — D1 upserts each AI recommendation by GitHub login and repository, including the reason and latest review time.
- **AI calls** — all Anthropic traffic can route through Cloudflare AI Gateway (`AI_GATEWAY_URL`), which adds caching, rate limiting, and spend observability for free.

## Setup

### 1. Create a GitHub OAuth App

GitHub App user tokens are limited to repositories accessible to the app installation, so they cannot clean up arbitrary third-party public stars. Workaround uses a classic OAuth App with the `public_repo` scope, which GitHub requires for starring public repositories.

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App
2. Homepage URL: `http://localhost:3000`
3. Authorization callback URL: `http://localhost:3000/api/auth/callback`
4. Generate a client secret

### 2. Configure environment

```sh
cp .dev.vars.example .dev.vars
# fill in GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
# SESSION_SECRET: openssl rand -base64 32
```

Optional AI (enables **AI review** and semantic search over your stars):

- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `AI_GATEWAY_URL` — create an AI Gateway in the Cloudflare dashboard, then use
  `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/anthropic`
- `AI_MODEL` — defaults to `claude-opus-4-8`; set `claude-haiku-4-5` for cheaper calls

### 3. Create the Cloudflare Queue and D1 database

```sh
npx wrangler queues create workaround-unstar
npx wrangler d1 create workaround
```

Copy the D1 `database_id` into `wrangler.jsonc`, replacing
`REPLACE_WITH_D1_DATABASE_ID`, then apply the schema:

```sh
npm run db:migrate:local
npm run db:migrate:remote
```

The queue payload encrypts the OAuth token with `SESSION_SECRET`. Do not rotate that secret while a sweep is still pending.

### 4. Run

```sh
npm install
npm run dev          # http://localhost:3000
```

### 5. Deploy

```sh
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ANTHROPIC_API_KEY   # optional
npm run deploy
```

Then add `https://<your-worker>.workers.dev/api/auth/callback` as a callback URL on the GitHub OAuth App.

## Project layout

```
src/
  routes/
    index.tsx                  root redirect to /dashboard
    dashboard.tsx              public dashboard route and signed-in data handoff
    repo.$owner.$name.tsx      repo detail page (stats, topics, README)
    api/auth/{login,callback,logout}.ts   OAuth server routes
  pages/Dashboard/
    DashboardPage.tsx          dashboard composition
    useDashboard.ts            dashboard state and actions
    components/                dashboard-only UI
    constants.ts, utils.ts     dashboard-only constants and helpers
  server/
    env.ts                     typed Cloudflare env bindings
    crypto.ts                  AES-GCM sealing for queued OAuth tokens
    sweep.ts                   Queue producer/consumer and D1 sweep status
    verdicts.ts                user-scoped AI verdict persistence
    session.ts                 encrypted cookie session
    github.ts                  GitHub REST client (stars, unstar, search, repo, README)
    suggest.ts                 Claude review + semantic search + NL→query
  lib/repo-scoring.ts          deterministic cleanup signals and scoring
  lib/functions.ts             server functions (the RPC boundary)
  components/
    AppHeader.tsx              shared app header and wordmark
    AppFooter.tsx              shared app footer
    ui/                        reusable controls and typography primitives
  styles.css                   design tokens (neutral light palette, fonts)
  worker.ts                    TanStack fetch handler plus Queue consumer
migrations/                    D1 sweep and AI verdict schemas
```

## Design system

Light mode only, neutral grays on white with an indigo accent — tokens live in [src/styles.css](src/styles.css). Type: **Geist** for UI, **Geist Mono** for repo names and counts, **Cantarell** for display headings, **Syne Mono** for the wordmark.

## Roadmap ideas

- Cache star snapshots in KV/D1 so revisits don't re-paginate GitHub
- Cluster duplicates ("you starred 6 HTTP clients") in the AI pass
- Undo window before a sweep starts; export stars before sweeping
- Lists/tags for organizing keepers
