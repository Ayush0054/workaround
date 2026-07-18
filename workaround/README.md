# Workaround

[workaround.run](https://workaround.run) — small, practical fixes for the software you use every day.

**Git is the first workaround.** It turns an overflowing GitHub stars list into something you can review, search, and clean up:

- Flag archived, deprecated, and stale repositories.
- Get keep, unstar, or unsure verdicts for judgment calls.
- Search your stars or all of GitHub in plain English.
- Unstar repositories in bulk with durable background progress.

Built with TanStack Start, Cloudflare Workers, D1, Queues, and AI Gateway. The default AI model is `openai/gpt-5.4-mini` through Cloudflare, with Anthropic available as a fallback.

## Structure

```text
src/
├── layouts/              # public and authenticated page shells
├── pages/                # landing and dashboard-owned UI
├── routes/               # TanStack file-route adapters
├── schemas/              # shared Zod UI contracts
├── types/                # shared AI, GitHub, and sweep contracts
└── server/
    ├── db/               # Drizzle D1 client and table schema
    ├── services/         # application and integration logic
    ├── types/            # server-private contracts
    ├── utils/            # prompts, validated HTTP parsing, and crypto
    ├── routes.ts         # thin createServerFn endpoints
    └── schemas.ts        # Zod boundary and provider schemas
```

Wrangler SQL files in `migrations/` remain the deployment migration source of truth for the existing D1 database. Drizzle provides typed application queries without replacing that established migration history. Zod validates server inputs, form values, AI output, and external GitHub responses before application code uses them. Effect handles typed async failures, provider fallback, concurrency, and queue pacing.

The GitHub client follows the official `/user/starred` pagination in 100-repository batches so filtering, counts, and AI candidate discovery operate over the complete available catalog. The dashboard renders the full filtered result rather than adding a second pagination layer after all GitHub pages have already been fetched.

## Run locally

Create a classic GitHub OAuth App with this callback URL:

```text
http://localhost:3000/api/auth/callback
```

Then:

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm run db:migrate:local
pnpm run dev
```

Add your GitHub credentials and a random `SESSION_SECRET` to `.dev.vars`. GitHub sign-in requests `user:email` so the primary verified email can be saved with the user profile. AI is optional; configure `CLOUDFLARE_AI_GATEWAY_URL`, `CLOUDFLARE_AI_MODEL`, and `CLOUDFLARE_AI_API_TOKEN` to enable it.

## Deploy

Create the resources configured in `wrangler.jsonc`, apply the remote migrations, add the production secrets, and deploy:

```sh
pnpm exec wrangler queues create workaround-unstar
pnpm exec wrangler d1 create workaround
pnpm exec wrangler secret put CLOUDFLARE_AI_GATEWAY_URL
pnpm exec wrangler secret put CLOUDFLARE_AI_MODEL
pnpm exec wrangler secret put CLOUDFLARE_AI_API_TOKEN
pnpm run db:migrate:remote
pnpm run deploy
```

Copy the returned D1 database ID into `wrangler.jsonc` before running the migration.

Production OAuth callback:

```text
https://workaround.run/api/auth/callback
```
