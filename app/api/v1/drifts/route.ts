import { requireAuth } from '../../../../lib/auth'
import { supabase } from '../../../../lib/supabase'

const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical'])
const DRIFT_TYPES = new Set(['configuration', 'missing', 'extra', 'security'])

function parseIntegerParam(value: string | null, defaultValue: number, isValid: (value: number) => boolean) {
  if (value === null) return defaultValue
  if (!/^\d+$/.test(value)) return null

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && isValid(parsed) ? parsed : null
}

function buildDriftsQuery(count = false) {
  return supabase
    .from('drifts')
    .select(
      `
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
      `,
      count ? { count: 'exact', head: true } : undefined
    )
}

function applyFilters(query: ReturnType<typeof buildDriftsQuery>, orgId: string, params: URLSearchParams) {
  query = query.eq('scans.projects.org_id', orgId)

  const projectId = params.get('project_id')
  if (projectId) query = query.eq('scans.project_id', projectId)

  const scanId = params.get('scan_id')
  if (scanId) query = query.eq('scan_id', scanId)

  const riskLevel = params.get('risk_level')
  if (riskLevel) query = query.eq('risk_level', riskLevel)

  const driftType = params.get('drift_type')
  if (driftType) query = query.eq('drift_type', driftType)

  const resolved = params.get('resolved')
  if (resolved === 'true') {
    query = query.not('resolved_at', 'is', null)
  } else if (resolved === 'false') {
    query = query.is('resolved_at', null)
  }

  return query
}

function flattenDrift(row: Record<string, any>): Record<string, any> {
  const scan = Array.isArray(row.scans) ? row.scans[0] : row.scans
  const { scans, ...drift } = row

  return {
    ...drift,
    project_id: scan?.project_id ?? null,
    scan_started_at: scan?.scan_started_at ?? null
  }
}

export async function GET(req: Request) {
  const org = await requireAuth(req)
  const params = new URL(req.url).searchParams

  const limit = parseIntegerParam(params.get('limit'), 50, (value) => value >= 1 && value <= 100)
  if (limit === null) {
    return Response.json({ error: 'limit must be an integer between 1 and 100' }, { status: 400 })
  }

  const offset = parseIntegerParam(params.get('offset'), 0, (value) => value >= 0)
  if (offset === null) {
    return Response.json({ error: 'offset must be an integer greater than or equal to 0' }, { status: 400 })
  }

  const riskLevel = params.get('risk_level')
  if (riskLevel && !RISK_LEVELS.has(riskLevel)) {
    return Response.json({ error: 'risk_level must be one of low, medium, high, critical' }, { status: 400 })
  }

  const driftType = params.get('drift_type')
  if (driftType && !DRIFT_TYPES.has(driftType)) {
    return Response.json({ error: 'drift_type must be one of configuration, missing, extra, security' }, { status: 400 })
  }

  const resolved = params.get('resolved')
  if (resolved !== null && resolved !== 'true' && resolved !== 'false') {
    return Response.json({ error: 'resolved must be true or false' }, { status: 400 })
  }

  const { data: drifts, error } = await applyFilters(buildDriftsQuery(), org.id, params)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return Response.json({ error: 'Failed to fetch drifts' }, { status: 500 })
  }

  const { count, error: countError } = await applyFilters(buildDriftsQuery(true), org.id, params)

  if (countError) {
    return Response.json({ error: 'Failed to count drifts' }, { status: 500 })
  }

  return Response.json({ drifts: (drifts ?? []).map((drift) => flattenDrift(drift)), total: count ?? 0, limit, offset })
}
