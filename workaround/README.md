# Workaround ⭐️🧹

Tidy your GitHub stars. Workaround lists every repo you've starred, flags the dead weight, lets Claude argue about the judgment calls, and sweeps your selection in one go — it can even find repos for you from a plain-English description.

**Stack:** TanStack Start (SSR) · Cloudflare Workers · Tailwind v4 (shadcn-style tokens, light mode) · Anthropic API via Cloudflare AI Gateway · Geist / Geist Mono / Cantarell / Syne Mono.

## Features

- **Flagging (free, deterministic)** — archived, "deprecated" in the description, no commits in 2y/4y, starred 3+ years ago. No AI cost; computed in [src/server/suggest.ts](src/server/suggest.ts).
- **AI review** — flagged repos go to Claude, which returns a keep / unstar / unsure verdict with a one-line reason each (structured output, so it always parses).
- **NLP search** — describe a repo in plain English and press Enter:
  - *My stars* — Claude semantically matches the description against your starred repos
  - *All GitHub* — Claude translates the description into a GitHub search query and surfaces non-starred repos you can star in one click (works without an API key too — falls back to raw GitHub search)
  - *Both* — runs the two in parallel
- **Repo pages** — click any row to open `/repo/owner/name` in a new tab: stats, topics, license, and the README as GitHub renders it, plus star/unstar.
- **Bulk sweeps** — GitHub has no bulk-unstar endpoint and rate-limits bursts of writes (~80/min, no concurrency), so sweeps run serially at ~1 unstar/second. Rows disappear as they're unstarred; failures stay in the list with a notice. Keep the tab open during a sweep.

## How it works

- **Auth** — GitHub OAuth (authorization-code flow with state check). The access token lives in an encrypted, HttpOnly session cookie (TanStack Start's `useSession`) — no user database.
- **Stars** — fetched from `GET /user/starred` with the `application/vnd.github.star+json` media type so we get `starred_at` timestamps. Paginated 100/page, capped at 3,000 stars (Workers subrequest limits); the UI shows a notice when truncated.
- **AI calls** — all Anthropic traffic can route through Cloudflare AI Gateway (`AI_GATEWAY_URL`), which adds caching, rate limiting, and spend observability for free.

## Setup

### 1. Create a GitHub App (recommended) or OAuth App

**GitHub App** (narrowest consent screen — this is the whole pitch):

1. GitHub → Settings → Developer settings → **GitHub Apps** → New GitHub App
2. Callback URL: `http://localhost:3000/api/auth/callback` (add your production URL later)
3. Enable **"Request user authorization (OAuth) during installation"**
4. Permissions → Account permissions → **Starring: Read and write**. Nothing else.
5. Webhooks: uncheck "Active"
6. Generate a client secret

**OAuth App** also works (`public_repo` scope is requested automatically), but its consent screen asks for more than starring.

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

### 3. Run

```sh
npm install
npm run dev          # http://localhost:3000
```

### 4. Deploy

```sh
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ANTHROPIC_API_KEY   # optional
npm run deploy
```

Then add `https://<your-worker>.workers.dev/api/auth/callback` as a callback URL on the GitHub App.

## Project layout

```
src/
  routes/
    index.tsx                  landing (redirects to /dashboard when signed in)
    dashboard.tsx              star list, filters, AI review, NLP search, bulk sweep
    repo.$owner.$name.tsx      repo detail page (stats, topics, README)
    api/auth/{login,callback,logout}.ts   OAuth server routes
  server/
    env.ts                     typed Cloudflare env bindings
    session.ts                 encrypted cookie session
    github.ts                  GitHub REST client (stars, unstar, search, repo, README)
    suggest.ts                 heuristics + Claude review + semantic search + NL→query
  lib/functions.ts             server functions (the RPC boundary)
  components/                  shadcn-style primitives + RepoRow
  styles.css                   design tokens (neutral light palette, fonts)
```

## Design system

Light mode only, neutral grays on white with an indigo accent — tokens live in [src/styles.css](src/styles.css). Type: **Geist** for UI, **Geist Mono** for repo names and counts, **Cantarell** for display headings, **Syne Mono** for the wordmark.

## Roadmap ideas

- Cache star snapshots in KV/D1 so revisits don't re-paginate GitHub
- Cluster duplicates ("you starred 6 HTTP clients") in the AI pass
- Server-side sweep queue (Cloudflare Queues / Durable Objects) if sweeps ever need to outlive the tab
- Undo window before a sweep starts; export stars before sweeping
- Lists/tags for organizing keepers
