# Workaround

[workaround.run](https://workaround.run) — small, practical fixes for the software you use every day.

**Git is the first workaround.** It turns an overflowing GitHub stars list into something you can review, search, and clean up:

- Flag archived, deprecated, and stale repositories.
- Get keep, unstar, or unsure verdicts for judgment calls.
- Search your stars or all of GitHub in plain English.
- Unstar repositories in bulk with durable background progress.

Built with TanStack Start, Cloudflare Workers, D1, Queues, and AI Gateway. The default AI model is `openai/gpt-5.4-mini` through Cloudflare, with Anthropic available as a fallback.

## Run locally

Create a classic GitHub OAuth App with this callback URL:

```text
http://localhost:3000/api/auth/callback
```

Then:

```sh
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Add your GitHub credentials and a random `SESSION_SECRET` to `.dev.vars`. AI is optional; configure `CLOUDFLARE_AI_GATEWAY_URL`, `CLOUDFLARE_AI_MODEL`, and `CLOUDFLARE_AI_API_TOKEN` to enable it.

## Deploy

Create the resources configured in `wrangler.jsonc`, apply the remote migrations, add the production secrets, and deploy:

```sh
npx wrangler queues create workaround-unstar
npx wrangler d1 create workaround
npx wrangler secret put CLOUDFLARE_AI_GATEWAY_URL
npx wrangler secret put CLOUDFLARE_AI_MODEL
npx wrangler secret put CLOUDFLARE_AI_API_TOKEN
npm run db:migrate:remote
npm run deploy
```

Copy the returned D1 database ID into `wrangler.jsonc` before running the migration.

Production OAuth callback:

```text
https://workaround.run/api/auth/callback
```
