import { ok, badRequest, notFound, serverError } from '../../../../../lib/api-response'
import { withAuth } from '../../../../../lib/auth'
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
  scans(
    project_id,
    scan_started_at:started_at
  )
`

function flattenDrift(row: Record<string, any>): Record<string, any> {
  const scan = Array.isArray(row.scans) ? row.scans[0] : row.scans
  const { scans: _, ...drift } = row

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
  const { data: projects } = await supabase.from('projects').select('id').eq('org_id', orgId)
  const projectIds = projects?.map((p) => p.id) ?? []

  if (projectIds.length === 0) return null

  const { data: scans } = await supabase.from('scans').select('id').in('project_id', projectIds)
  const scanIds = scans?.map((s) => s.id) ?? []

  if (scanIds.length === 0) return null

  const { data, error } = await supabase.from('drifts').select(DRIFT_SELECT).eq('id', id).in('scan_id', scanIds).maybeSingle()

  if (error || !data) return null
  return flattenDrift(data)
}

export async function GET(req: Request, { params }: RouteContext) {
  return withAuth(req, async (_req, org) => {
    const drift = await fetchDriftForOrg(params.id, org.id)

    if (!drift) {
      return notFound('Drift not found')
    }

    return ok(drift)
  })
}

export async function PATCH(req: Request, { params }: RouteContext) {
  return withAuth(req, async (req, org) => {
    let body: { resolved?: unknown }
  try {
    const parsed = await req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return badRequest('body is missing or invalid')
    }
    body = parsed as { resolved?: unknown }
  } catch {
    return badRequest('Invalid JSON body')
  }

  if (typeof body.resolved !== 'boolean') {
    return badRequest('resolved must be a boolean')
  }

    const drift = await fetchDriftForOrg(params.id, org.id)
    if (!drift) {
      return notFound('Drift not found')
    }

    // Re-verify ownership by ensuring scan_id belongs to the org's projects
    const { data: orgProjects } = await supabase.from('projects').select('id').eq('org_id', org.id)
    const orgProjectIds = orgProjects?.map((p) => p.id) ?? []
    const { data: orgScans } = await supabase.from('scans').select('id').in('project_id', orgProjectIds)
    const orgScanIds = orgScans?.map((s) => s.id) ?? []

    const { error: updateError } = await supabase
      .from('drifts')
      .update({ resolved_at: body.resolved ? new Date().toISOString() : null })
      .eq('id', params.id)
      .in('scan_id', orgScanIds)

    if (updateError) {
      return serverError('Failed to update drift')
    }

    const updatedDrift = await fetchDriftForOrg(params.id, org.id)
    if (!updatedDrift) {
      return notFound('Drift not found')
    }

    return ok(updatedDrift)
  })
}
