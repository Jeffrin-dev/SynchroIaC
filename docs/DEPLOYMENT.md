# SynchroIaC Deployment Guide

## Prerequisites
- Vercel account (Hobby is fine)
- Supabase project (free tier)
- GitHub Personal Access Token (repo scope)
- OpenRouter account (free tier)
- Resend account (free tier)
- Paddle account (sandbox to start)

## Step 1: Supabase setup
1. Create a new Supabase project.
2. Go to SQL Editor and run both migration files in order:
   - supabase/migrations/001_initial_schema.sql
   - supabase/migrations/002_seed_dev.sql
3. From Project Settings → API, copy:
   - Project URL → SUPABASE_URL
   - service_role key → SUPABASE_SERVICE_ROLE_KEY
   - anon key → NEXT_PUBLIC_SUPABASE_ANON_KEY

## Step 2: Vercel setup
1. Import this repo in Vercel.
2. Set all environment variables from .env.local.example.
3. Required for basic function:
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_SUPABASE_URL   (same as SUPABASE_URL)
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   NEXT_PUBLIC_APP_URL        (your Vercel deployment URL)
   DASHBOARD_API_KEY          (set to sia_devkey00000000000000000000000000
                               for dev, rotate after first deploy)
   NEXT_PUBLIC_DASHBOARD_API_KEY (same value as DASHBOARD_API_KEY)

4. Optional (features degrade gracefully without these):
   OPENROUTER_API_KEY
   GITHUB_TOKEN
   RESEND_API_KEY
   PADDLE_WEBHOOK_SECRET
   PADDLE_PRICE_ID_PRO
   PADDLE_PRICE_ID_TEAM

5. Deploy. Vercel auto-deploys on push to main.

## Step 3: Verify deployment
Run the E2E test against your live URL:
  E2E_BASE_URL=https://your-app.vercel.app \
  E2E_API_KEY=sia_devkey00000000000000000000000000 \
  E2E_PROJECT_ID=<uuid from seed> \
  node scripts/e2e-test.js

All tests should pass before connecting a real customer repo.

## Step 4: Customer onboarding
See README.md for the 3-step customer setup process.

## Rotating the dev API key after first deploy
1. Go to /dashboard/settings
2. Click "Rotate API Key"
3. Copy the new key
4. Update DASHBOARD_API_KEY and NEXT_PUBLIC_DASHBOARD_API_KEY
   in Vercel environment variables
5. Redeploy

## Vercel cron
The /api/ping cron runs every 6 hours automatically on Vercel.
No setup needed. Prevents Supabase free tier from pausing.
