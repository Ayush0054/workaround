# Workaround ⭐️🧹

Tidy your GitHub stars. Workaround lists every repo you've starred, flags the dead weight, lets Claude argue about the judgment calls, and sweeps your selection in the background — it can even find repos for you from a plain-English description.

**Stack:** TanStack Start (SSR) · Cloudflare Workers + Queues + D1 · Tailwind v4 (shadcn-style tokens, light mode) · Anthropic API via Cloudflare AI Gateway · Geist / Geist Mono / Cantarell / Syne Mono.

## Features

- **Flagging (free, deterministic)** — archived, "deprecated" in the description, no commits in 2y/4y, starred 3+ years ago. No AI cost; computed in [src/server/suggest.ts](src/server/suggest.ts).
- **AI review** — flagged repos go to Claude, which returns a keep / unstar / unsure verdict with a one-line reason each (structured output, so it always parses).
- **NLP search** — describe a repo in plain English and press Enter:
  - *My stars* — Claude semantically matches the description against your starred repos
  - *All GitHub* — Claude translates the description into a GitHub search query and surfaces non-starred repos you can star in one click (works without an API key too — falls back to raw GitHub search)
  - *Both* — runs the two in parallel
- **Repo pages** — click any row to open `/repo/owner/name` in a new tab: stats, topics, license, and the README as GitHub renders it, plus star/unstar.
- **Background sweeps (sync engine)** — GitHub has no bulk-unstar endpoint, so bulk unstars are enqueued to Cloudflare Queues (one message per repo, your token AES-GCM-encrypted inside) and drained server-side with retries and backoff. Per-repo status lands in D1; the UI updates optimistically, polls progress, and resumes unfinished sweeps on your next visit. Closing the tab doesn't stop a sweep. Without the queue/D1 bindings the app falls back to a client-side pool.

## How it works

- **Auth** — GitHub OAuth (authorization-code flow with state check). The access token lives in an encrypted, HttpOnly session cookie (TanStack Start's `useSession`) — no user database.
- **Stars** — fetched from `GET /user/starred` with the `application/vnd.github.star+json` media type so we get `starred_at` timestamps. Paginated 100/page, capped at 3,000 stars (Workers subrequest limits); the UI shows a notice when truncated.
- **AI calls** — all Anthropic traffic can route through Cloudflare AI Gateway (`AI_GATEWAY_URL`), which adds caching, rate limiting, and spend observability for free.
- **Worker entry** — [src/worker.ts](src/worker.ts) exports both the TanStack Start `fetch` handler and the `queue` consumer, so the whole app is still a single Worker.

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

Queues and D1 are simulated locally by the Cloudflare Vite plugin, and the sweep tables create themselves — background sweeps work in dev with zero extra setup.

### 4. Deploy

One-time infra for the sweep engine (Queues needs the Workers Paid plan):

```sh
npx wrangler queues create workaround-unstar
npx wrangler d1 create workaround   # paste the returned database_id into wrangler.jsonc
```

Then secrets and deploy:

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
  worker.ts                    worker entry: TanStack Start fetch + queue consumer
  routes/
    index.tsx                  landing (redirects to /dashboard when signed in)
    dashboard.tsx              star list, filters, AI review, NLP search, sweeps
    repo.$owner.$name.tsx      repo detail page (stats, topics, README)
    api/auth/{login,callback,logout}.ts   OAuth server routes
  server/
    env.ts                     typed Cloudflare env bindings
    session.ts                 encrypted cookie session
    github.ts                  GitHub REST client (stars, unstar, search, repo, README)
    suggest.ts                 heuristics + Claude review + semantic search + NL→query
    sweep.ts                   Queues+D1 sweep engine (enqueue, consumer, status, resume)
    crypto.ts                  AES-GCM sealing for tokens inside queue messages
  lib/functions.ts             server functions (the RPC boundary)
  components/                  shadcn-style primitives + RepoRow
  styles.css                   design tokens (neutral light palette, fonts)
```

## Design system

Light mode only, neutral grays on white with an indigo accent — tokens live in [src/styles.css](src/styles.css). Type: **Geist** for UI, **Geist Mono** for repo names and counts, **Cantarell** for display headings, **Syne Mono** for the wordmark.

## Roadmap ideas

- Cache star snapshots in D1 so revisits don't re-paginate GitHub
- Cluster duplicates ("you starred 6 HTTP clients") in the AI pass
- Undo window before a sweep starts draining; export stars before sweeping
- Lists/tags for organizing keepers
