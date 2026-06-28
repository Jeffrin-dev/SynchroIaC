import { requireAuth } from '../../../../../../lib/auth'
import { explainDrift, type DriftExplainInput } from '../../../../../../lib/openrouter'
import { supabase } from '../../../../../../lib/supabase'

const FREE_PLAN_MONTHLY_EXPLANATION_LIMIT = 10

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
  created_at,
  scans!inner(
    project_id,
    projects!inner(org_id)
  )
`

type RouteContext = {
  params: {
    id: string
  }
}

type DriftRecord = {
  id: string
  scan_id: string
  resource_type: string | null
  resource_id: string | null
  attribute: string | null
  desired_value: unknown
  actual_value: unknown
  drift_type: string | null
  risk_level: string | null
  explanation: string | null
  created_at: string
}

async function fetchDriftForOrg(id: string, orgId: string): Promise<DriftRecord | null> {
  const { data, error } = await supabase
    .from('drifts')
    .select(DRIFT_SELECT)
    .eq('id', id)
    .eq('scans.projects.org_id', orgId)
    .maybeSingle()

  if (error || !data) return null

  const { scans, ...drift } = data as Record<string, unknown>
  void scans
  return drift as DriftRecord
}

function stringifyDriftValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function buildExplainInput(drift: DriftRecord): DriftExplainInput {
  return {
    resourceType: drift.resource_type ?? '',
    resourceId: drift.resource_id ?? '',
    attribute: drift.attribute ?? '',
    desiredValue: stringifyDriftValue(drift.desired_value),
    actualValue: stringifyDriftValue(drift.actual_value),
    driftType: drift.drift_type ?? '',
    riskLevel: drift.risk_level ?? ''
  }
}

function startOfCurrentMonthIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

async function countMonthlyExplanations(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('drifts')
    .select('id, scans!inner(projects!inner(org_id))', { count: 'exact', head: true })
    .eq('scans.projects.org_id', orgId)
    .not('explanation', 'is', null)
    .gte('created_at', startOfCurrentMonthIso())

  if (error) {
    throw error
  }

  return count ?? 0
}

export async function POST(req: Request, { params }: RouteContext) {
  const org = await requireAuth(req)
  const drift = await fetchDriftForOrg(params.id, org.id)

  if (!drift) {
    return Response.json({ error: 'Drift not found' }, { status: 404 })
  }

  const cachedExplanation = drift.explanation?.trim()
  if (cachedExplanation) {
    return Response.json({ explanation: cachedExplanation, cached: true })
  }

  if (org.plan === 'free') {
    const monthlyExplanationCount = await countMonthlyExplanations(org.id)
    if (monthlyExplanationCount >= FREE_PLAN_MONTHLY_EXPLANATION_LIMIT) {
      return Response.json(
        {
          error: 'Monthly AI explanation limit reached on free plan',
          limit: FREE_PLAN_MONTHLY_EXPLANATION_LIMIT,
          upgrade_url: '/dashboard/billing'
        },
        { status: 402 }
      )
    }
  }

  let explanation: string
  try {
    explanation = await explainDrift(buildExplainInput(drift))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: 'AI explanation failed', detail: message }, { status: 502 })
  }

  const { error: updateError } = await supabase.from('drifts').update({ explanation }).eq('id', drift.id)
  if (updateError) {
    console.error('Failed to store drift explanation', updateError)
  }

  return Response.json({ explanation, cached: false })
}
