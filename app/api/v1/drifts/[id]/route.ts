import { requireAuth } from '../../../../../lib/auth'
import { supabase } from '../../../../../lib/supabase'

const DRIFT_SELECT = `
  id,
  scan_id,
  resource_type,
  resource_id,
  attribute,
  desired_value,
  actual_value,
  drift_type,
  risk_level,
  explanation,
  pr_url,
  resolved_at,
  created_at,
  scans!inner(
    project_id,
    scan_started_at:started_at,
    projects!inner(org_id)
  )
`

function flattenDrift(row: Record<string, any>): Record<string, any> {
  const scan = Array.isArray(row.scans) ? row.scans[0] : row.scans
  const { scans, ...drift } = row

  return {
    ...drift,
    project_id: scan?.project_id ?? null,
    scan_started_at: scan?.scan_started_at ?? null
  }
}

type RouteContext = {
  params: {
    id: string
  }
}

async function fetchDriftForOrg(id: string, orgId: string) {
  const { data, error } = await supabase
    .from('drifts')
    .select(DRIFT_SELECT)
    .eq('id', id)
    .eq('scans.projects.org_id', orgId)
    .maybeSingle()

  if (error || !data) return null
  return flattenDrift(data)
}

export async function GET(req: Request, { params }: RouteContext) {
  const org = await requireAuth(req)
  const drift = await fetchDriftForOrg(params.id, org.id)

  if (!drift) {
    return Response.json({ error: 'Drift not found' }, { status: 404 })
  }

  return Response.json(drift)
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const org = await requireAuth(req)

  let body: { resolved?: unknown }
  try {
    const parsed = await req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return Response.json({ error: 'body is missing or invalid' }, { status: 400 })
    }
    body = parsed as { resolved?: unknown }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.resolved !== 'boolean') {
    return Response.json({ error: 'resolved must be a boolean' }, { status: 400 })
  }

  const drift = await fetchDriftForOrg(params.id, org.id)
  if (!drift) {
    return Response.json({ error: 'Drift not found' }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('drifts')
    .update({ resolved_at: body.resolved ? new Date().toISOString() : null })
    .eq('id', params.id)
    .eq('scan_id', drift.scan_id)

  if (updateError) {
    return Response.json({ error: 'Failed to update drift' }, { status: 500 })
  }

  const updatedDrift = await fetchDriftForOrg(params.id, org.id)
  if (!updatedDrift) {
    return Response.json({ error: 'Drift not found' }, { status: 404 })
  }

  return Response.json(updatedDrift)
}
