import { ok, badRequest, notFound, serverError } from '../../../../../../lib/api-response'
import { withAuth } from '../../../../../../lib/auth'
import { supabase } from '../../../../../../lib/supabase'

type Params = { params: { id: string } }
type PatchBody = { enabled?: unknown }

async function fetchConfig(id: string, orgId: string) {
  const { data, error } = await supabase
    .from('notification_configs')
    .select('id, type, config, enabled, created_at')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (error || !data) return null
  return data
}

async function parseJsonBody(req: Request) {
  try {
    const parsed = await req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { body: null, error: 'body is missing or invalid' }
    return { body: parsed as PatchBody, error: null }
  } catch {
    return { body: null, error: 'Invalid JSON body' }
  }
}

export async function PATCH(req: Request, { params }: Params) {
  return withAuth(req, async (req, org) => {
    const existing = await fetchConfig(params.id, org.id)
  if (!existing) return notFound('Notification config not found')

  const { body, error: bodyError } = await parseJsonBody(req)
  if (bodyError || !body) return badRequest(bodyError ?? 'Invalid request body')
  if (typeof body.enabled !== 'boolean') return badRequest('enabled must be a boolean')

  const { data, error } = await supabase
    .from('notification_configs')
    .update({ enabled: body.enabled })
    .eq('id', params.id)
    .eq('org_id', org.id)
    .select('id, type, config, enabled, created_at')
    .single()

    if (error || !data) return serverError('Failed to update notification config')
    return ok(data)
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return withAuth(req, async (_req, org) => {
    const existing = await fetchConfig(params.id, org.id)
  if (!existing) return notFound('Notification config not found')

  const { error } = await supabase
    .from('notification_configs')
    .delete()
    .eq('id', params.id)
    .eq('org_id', org.id)

    if (error) return serverError('Failed to delete notification config')
    return ok({ deleted: true })
  })
}
