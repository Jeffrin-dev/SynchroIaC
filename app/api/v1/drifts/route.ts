import { ok, badRequest, serverError } from '../../../../lib/api-response'
import { withAuth } from '../../../../lib/auth'
import { supabase } from '../../../../lib/supabase'

const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical'])
const DRIFT_TYPES = new Set(['configuration', 'missing', 'extra', 'security'])

function parseIntegerParam(value: string | null, defaultValue: number, isValid: (_value: number) => boolean) {
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
        scans(
          project_id,
          scan_started_at:started_at
        )
      `,
      count ? { count: 'exact', head: true } : undefined
    )
}

async function getOrgScanIds(orgId: string, projectIdFilter?: string | null): Promise<string[]> {
  let projectQuery = supabase.from('projects').select('id').eq('org_id', orgId)
  if (projectIdFilter) {
    projectQuery = projectQuery.eq('id', projectIdFilter)
  }
  const { data: projects } = await projectQuery
  const projectIds = projects?.map((p) => p.id) ?? []

  if (projectIds.length === 0) return []

  const { data: scans } = await supabase.from('scans').select('id').in('project_id', projectIds)
  return scans?.map((s) => s.id) ?? []
}

function applyFilters(query: ReturnType<typeof buildDriftsQuery>, scanIds: string[], params: URLSearchParams) {
  query = query.in('scan_id', scanIds)

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
  const { scans: _, ...drift } = row

  return {
    ...drift,
    project_id: scan?.project_id ?? null,
    scan_started_at: scan?.scan_started_at ?? null
  }
}

export async function GET(req: Request) {
  return withAuth(req, async (req, org) => {
    const params = new URL(req.url).searchParams

    const scanIds = await getOrgScanIds(org.id, params.get('project_id'))
  if (scanIds.length === 0) {
    return ok({ drifts: [], total: 0, limit: 50, offset: 0 })
  }

  const limit = parseIntegerParam(params.get('limit'), 50, (value) => value >= 1 && value <= 100)
  if (limit === null) {
    return badRequest('limit must be an integer between 1 and 100')
  }

  const offset = parseIntegerParam(params.get('offset'), 0, (value) => value >= 0)
  if (offset === null) {
    return badRequest('offset must be an integer greater than or equal to 0')
  }

  const riskLevel = params.get('risk_level')
  if (riskLevel && !RISK_LEVELS.has(riskLevel)) {
    return badRequest('risk_level must be one of low, medium, high, critical')
  }

  const driftType = params.get('drift_type')
  if (driftType && !DRIFT_TYPES.has(driftType)) {
    return badRequest('drift_type must be one of configuration, missing, extra, security')
  }

  const resolved = params.get('resolved')
  if (resolved !== null && resolved !== 'true' && resolved !== 'false') {
    return badRequest('resolved must be true or false')
  }

  const { data: drifts, error } = await applyFilters(buildDriftsQuery(), scanIds, params)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return serverError('Failed to fetch drifts')
  }

  const { count, error: countError } = await applyFilters(buildDriftsQuery(true), scanIds, params)

  if (countError) {
    return serverError('Failed to count drifts')
  }

    return ok({ drifts: (drifts ?? []).map((drift) => flattenDrift(drift)), total: count ?? 0, limit, offset })
  })
}
