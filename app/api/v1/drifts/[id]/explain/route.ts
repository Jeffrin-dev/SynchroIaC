import { badGateway, notFound, ok, paymentRequired, tooManyRequests } from '../../../../../../lib/api-response'
import { withAuth } from '../../../../../../lib/auth'
import { explainDrift, type DriftExplainInput } from '../../../../../../lib/openrouter'
import { checkRateLimit } from '../../../../../../lib/ratelimit'
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
  created_at
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
  const { data: projects } = await supabase.from('projects').select('id').eq('org_id', orgId)
  const projectIds = projects?.map((p) => p.id) ?? []

  if (projectIds.length === 0) return null

  const { data: scans } = await supabase.from('scans').select('id').in('project_id', projectIds)
  const scanIds = scans?.map((s) => s.id) ?? []

  if (scanIds.length === 0) return null

  const { data, error } = await supabase.from('drifts').select(DRIFT_SELECT).eq('id', id).in('scan_id', scanIds).maybeSingle()

  if (error || !data) return null

  return data as DriftRecord
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
  const { data: projects } = await supabase.from('projects').select('id').eq('org_id', orgId)
  const projectIds = projects?.map((p) => p.id) ?? []

  if (projectIds.length === 0) return 0

  const { data: scans } = await supabase.from('scans').select('id').in('project_id', projectIds)
  const scanIds = scans?.map((s) => s.id) ?? []

  if (scanIds.length === 0) return 0

  const { count, error } = await supabase
    .from('drifts')
    .select('id', { count: 'exact', head: true })
    .in('scan_id', scanIds)
    .not('explanation', 'is', null)
    .gte('created_at', startOfCurrentMonthIso())

  if (error) {
    throw error
  }

  return count ?? 0
}

export async function POST(req: Request, { params }: RouteContext) {
  return withAuth(req, async (req, org) => {
    const rateLimit = checkRateLimit(`explain:${org.id}`, 20, 60_000)
    if (!rateLimit.allowed) {
      return tooManyRequests(rateLimit.resetAt - Date.now())
    }

    const drift = await fetchDriftForOrg(params.id, org.id)

    if (!drift) {
      return notFound('Drift not found')
    }

    const cachedExplanation = drift.explanation?.trim()
    if (cachedExplanation) {
      return ok({ explanation: cachedExplanation, cached: true })
    }

    if (org.plan === 'free') {
    const monthlyExplanationCount = await countMonthlyExplanations(org.id)
    if (monthlyExplanationCount >= FREE_PLAN_MONTHLY_EXPLANATION_LIMIT) {
      return paymentRequired('Monthly AI explanation limit reached on free plan', '/dashboard/billing')
    }
  }

  let explanation: string
  try {
    explanation = await explainDrift(buildExplainInput(drift))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return badGateway('AI explanation failed', message)
  }

    const { error: updateError } = await supabase.from('drifts').update({ explanation }).eq('id', drift.id)
    if (updateError) {
      console.error('Failed to store drift explanation', updateError)
    }

    return ok({ explanation, cached: false })
  })
}
