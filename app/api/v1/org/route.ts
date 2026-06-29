import { badRequest, ok, serverError } from '../../../../lib/api-response'
import { withAuth } from '../../../../lib/auth'
import { supabase } from '../../../../lib/supabase'

type OrgPatchBody = { name?: unknown }

function previewApiKey(apiKey: string) {
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
}

async function parseJsonBody(req: Request) {
  try {
    const parsed = await req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { body: null, error: 'body is missing or invalid' }
    }

    return { body: parsed as OrgPatchBody, error: null }
  } catch {
    return { body: null, error: 'Invalid JSON body' }
  }
}

export async function GET(req: Request) {
  return withAuth(req, async (_req, org) => {
    const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, plan, paddle_subscription_id, created_at, api_key')
    .eq('id', org.id)
    .single()

  if (orgError || !organization) {
    return serverError('Failed to fetch organization')
  }

  const { data: notificationConfigs, error: configsError } = await supabase
    .from('notification_configs')
    .select('id, type, config, enabled, created_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })

  if (configsError) {
    return serverError('Failed to fetch notification configs')
  }

  const { api_key: apiKey, paddle_subscription_id: _, ...safeOrg } = organization as Record<string, any>

  return ok({
    org: safeOrg,
      notification_configs: notificationConfigs ?? [],
      api_key_preview: previewApiKey(apiKey as string)
    })
  })
}

export async function PATCH(req: Request) {
  return withAuth(req, async (req, org) => {
  const { body, error: bodyError } = await parseJsonBody(req)

  if (bodyError || !body) {
    return badRequest(bodyError ?? 'Invalid request body')
  }

  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return badRequest('name must be a non-empty string')
  }

  if (body.name.length > 100) {
    return badRequest('name must be 100 characters or fewer')
  }

  const { data, error } = await supabase
    .from('organizations')
    .update({ name: body.name.trim() })
    .eq('id', org.id)
    .select('id, name, plan, paddle_subscription_id, created_at')
    .single()

    if (error || !data) {
      return serverError('Failed to update organization')
    }

    return ok({ org: data })
  })
}
