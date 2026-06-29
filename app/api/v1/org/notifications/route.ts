import { ok, created, badRequest, serverError } from '../../../../../lib/api-response'
import { withAuth } from '../../../../../lib/auth'
import { supabase } from '../../../../../lib/supabase'

const TYPES = new Set(['email', 'slack'])
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_CONFIGS = 5

type NotificationBody = { type?: unknown; config?: unknown }

async function parseJsonBody(req: Request) {
  try {
    const parsed = await req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { body: null, error: 'body is missing or invalid' }
    return { body: parsed as NotificationBody, error: null }
  } catch {
    return { body: null, error: 'Invalid JSON body' }
  }
}

function validateConfig(type: string, config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return 'config is required'
  const value = config as Record<string, unknown>

  if (type === 'email') {
    return typeof value.email === 'string' && EMAIL_REGEX.test(value.email) ? null : 'config.email must be a valid email address'
  }

  if (type === 'slack') {
    return typeof value.webhook_url === 'string' && value.webhook_url.startsWith('https://hooks.slack.com/')
      ? null
      : 'config.webhook_url must start with https://hooks.slack.com/'
  }

  return 'type must be email or slack'
}

export async function GET(req: Request) {
  return withAuth(req, async (_req, org) => {
    const { data, error } = await supabase
    .from('notification_configs')
    .select('id, type, config, enabled, created_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })

    if (error) return serverError('Failed to fetch notification configs')
    return ok({ notification_configs: data ?? [] })
  })
}

export async function POST(req: Request) {
  return withAuth(req, async (req, org) => {
  const { body, error: bodyError } = await parseJsonBody(req)
  if (bodyError || !body) return badRequest(bodyError ?? 'Invalid request body')

  if (typeof body.type !== 'string' || !TYPES.has(body.type)) {
    return badRequest('type must be email or slack')
  }

  const configError = validateConfig(body.type, body.config)
  if (configError) return badRequest(configError)

  const { count, error: countError } = await supabase
    .from('notification_configs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id)

  if (countError) return serverError('Failed to enforce notification config limit')
  if ((count ?? 0) >= MAX_CONFIGS) return badRequest('Maximum 5 notification configs per org')

  const { data, error } = await supabase
    .from('notification_configs')
    .insert({ org_id: org.id, type: body.type, config: body.config, enabled: true })
    .select('id, type, config, enabled, created_at')
    .single()

    if (error || !data) return serverError('Failed to create notification config')
    return created(data)
  })
}
