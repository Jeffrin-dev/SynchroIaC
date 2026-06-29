# SynchroIaC Deployment Guide

## Prerequisites

- Vercel account (Hobby is fine)
- Supabase project (free tier)
- GitHub Personal Access Token (repo scope)
- OpenRouter account (free tier)
- Resend account (free tier)
- Paddle account (sandbox to start)

---

## Step 1: Supabase setup

1. Create a new Supabase project.
2. Go to SQL Editor and run the schema migration:
   - `supabase/migrations/001_initial_schema.sql`

   > **Development only:** also run `002_seed_dev.sql` if you want a test org and project pre-seeded. Do not run this in production.

3. From Project Settings → API, copy:
   - Project URL → `SUPABASE_URL`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`
   - anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Step 2: Vercel setup

1. Import this repo in Vercel.
2. Set all environment variables from `.env.local.example`.

**Required for basic function:**

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service_role secret key |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon public key |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL |
| `DASHBOARD_API_KEY` | Set to `sia_devkey00000000000000000000000000` for dev. Rotate after first deploy. |
| `NEXT_PUBLIC_DASHBOARD_API_KEY` | Same value as `DASHBOARD_API_KEY` |

**Optional (features degrade gracefully without these):**

| Variable | Feature |
|----------|---------|
| `OPENROUTER_API_KEY` | AI drift explanations |
| `GITHUB_TOKEN` | Fix PR generation |
| `RESEND_API_KEY` | Email drift alerts |
| `PADDLE_WEBHOOK_SECRET` | Billing webhooks |
| `PADDLE_PRICE_ID_PRO` | Pro plan detection |
| `PADDLE_PRICE_ID_TEAM` | Team plan detection |

3. Deploy. Vercel auto-deploys on every push to main.

---

## Step 3: Verify deployment

Run the E2E test against your live URL:

```bash
E2E_BASE_URL=https://your-app.vercel.app \
E2E_API_KEY=sia_devkey00000000000000000000000000 \
E2E_PROJECT_ID=<uuid from projects table> \
node scripts/e2e-test.js
```

All 11 tests should pass before connecting a real customer repo.

---

## Step 4: Customer onboarding

See `README.md` for the 3-step customer setup process.

---

## Rotating the dev API key after first deploy

1. Go to `/dashboard/settings`
2. Click "Rotate API Key"
3. Copy the new key immediately — it is not shown again
4. Update `DASHBOARD_API_KEY` and `NEXT_PUBLIC_DASHBOARD_API_KEY` in Vercel environment variables
5. Redeploy

---

## Vercel cron

The `/api/ping` cron runs once daily at 9am UTC automatically on Vercel Hobby.
No setup needed. Prevents Supabase free tier from pausing due to inactivity.

To increase frequency, upgrade to Vercel Pro and update `vercel.json`:
```json
"schedule": "0 */6 * * *"
```
