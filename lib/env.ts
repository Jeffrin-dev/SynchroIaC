const requiredServerVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_APP_URL'] as const

for (const key of requiredServerVars) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key}`)
  }
}

const featureWarnings: Array<[keyof NodeJS.ProcessEnv, string]> = [
  ['OPENROUTER_API_KEY', 'AI explanations will fail'],
  ['GITHUB_TOKEN', 'PR generation will fail'],
  ['RESEND_API_KEY', 'Email alerts will fail'],
  ['PADDLE_WEBHOOK_SECRET', 'Paddle webhooks will fail']
]

for (const [key, message] of featureWarnings) {
  if (!process.env[key]) {
    console.warn(`${key} is not set; ${message}`)
  }
}

export const env = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '',
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET ?? '',
  DASHBOARD_API_KEY: process.env.DASHBOARD_API_KEY ?? '',
  PADDLE_PRICE_ID_PRO: process.env.PADDLE_PRICE_ID_PRO ?? '',
  PADDLE_PRICE_ID_TEAM: process.env.PADDLE_PRICE_ID_TEAM ?? '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
}
